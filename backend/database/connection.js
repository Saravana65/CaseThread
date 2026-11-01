/**
 * @file connection.js
 * @description Enterprise-grade MySQL connection pool manager for CASETHREAD backend.
 * Supports production MySQL 8 pools and an in-memory fallback store for offline test execution.
 */

const mysql = require('mysql2/promise');
const cryptoService = require('../services/cryptoService');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'casethread_db',
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  dateStrings: true
};

let pool = null;
let isConnected = false;

// Initialize MySQL pool
try {
  pool = mysql.createPool(dbConfig);
} catch (err) {
  console.warn('[DATABASE] Failed to initialize MySQL pool:', err.message);
}

/**
 * Determines whether MemoryStore fallback is permitted.
 * STRICT POLICY:
 * In production (NODE_ENV === 'production'), MemoryStore is NEVER permitted under any circumstances.
 * MemoryStore is only allowed in:
 * 1. Automated test runs (NODE_ENV === 'test')
 * 2. Explicitly enabled local offline development (ALLOW_MEMORY_STORE === 'true' or USE_MEMORY_STORE === 'true')
 */
function isMemoryStoreAllowed() {
  if (process.env.NODE_ENV === 'production') {
    return false;
  }
  return (
    process.env.NODE_ENV === 'test' ||
    process.env.ALLOW_MEMORY_STORE === 'true' ||
    process.env.USE_MEMORY_STORE === 'true'
  );
}

/**
 * Tests connection to the MySQL database.
 * @returns {Promise<boolean>} True if connected, false otherwise
 */
async function testConnection() {
  if (!pool) {
    isConnected = false;
    return false;
  }
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    isConnected = true;
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[DATABASE] Connected to MySQL 8 on ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
    }
    return true;
  } catch (error) {
    isConnected = false;
    const sanitizedMsg = error.message ? error.message.replace(/:[^\s@]+@/, ':***@') : 'Connection refused';
    if (process.env.NODE_ENV !== 'test') {
      console.warn(`[DATABASE WARNING] MySQL not reachable on ${dbConfig.host}:${dbConfig.port}: ${sanitizedMsg}`);
    }
    return false;
  }
}

/**
 * Executes a parameterized SQL statement with automatic fallback support.
 * In production: strictly uses MySQL; zero MemoryStore fallback.
 * @param {string} sql Parameterized SQL query
 * @param {Array} params Query parameters
 * @returns {Promise<[Array, Object]>} Results in mysql2 [rows, fields] format
 */
async function execute(sql, params = []) {
  if (process.env.NODE_ENV === 'production') {
    if (!pool) {
      throw new Error('[DATABASE CRITICAL] MySQL connection pool is uninitialized in production.');
    }
    return await pool.execute(sql, params);
  }

  // Non-production (test or explicitly enabled local development)
  const allowMemory = isMemoryStoreAllowed();
  if (isConnected || (!process.env.USE_MEMORY_STORE && pool)) {
    try {
      return await pool.execute(sql, params);
    } catch (err) {
      if (allowMemory) {
        return memoryStore.execute(sql, params);
      }
      throw err;
    }
  }

  if (allowMemory) {
    return memoryStore.execute(sql, params);
  }

  throw new Error('[DATABASE ERROR] MySQL connection is offline and MemoryStore fallback is disabled.');
}

/**
 * Direct query execution for raw SQL or multi-statements.
 * In production: strictly uses MySQL; zero MemoryStore fallback.
 */
async function query(sql, params = []) {
  if (process.env.NODE_ENV === 'production') {
    if (!pool) {
      throw new Error('[DATABASE CRITICAL] MySQL connection pool is uninitialized in production.');
    }
    return await pool.query(sql, params);
  }

  const allowMemory = isMemoryStoreAllowed();
  if (isConnected || (!process.env.USE_MEMORY_STORE && pool)) {
    try {
      return await pool.query(sql, params);
    } catch (err) {
      if (allowMemory) {
        return memoryStore.execute(sql, params);
      }
      throw err;
    }
  }

  if (allowMemory) {
    return memoryStore.execute(sql, params);
  }

  throw new Error('[DATABASE ERROR] MySQL connection is offline and MemoryStore fallback is disabled.');
}

/**
 * Transaction wrapper ensuring atomicity.
 * In production: strictly executes on MySQL; throws if unavailable.
 * @param {Function} callback Async callback receiving connection: async (conn) => { ... }
 */
async function withTransaction(callback) {
  if (process.env.NODE_ENV === 'production') {
    if (!pool) {
      throw new Error('[DATABASE CRITICAL] Cannot start transaction: MySQL pool is uninitialized in production.');
    }
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    try {
      const result = await callback(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // Non-production
  if (isConnected && pool) {
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    try {
      const result = await callback(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  if (isMemoryStoreAllowed()) {
    return callback({
      execute: (sql, params) => memoryStore.execute(sql, params),
      query: (sql, params) => memoryStore.execute(sql, params)
    });
  }

  throw new Error('[DATABASE ERROR] Cannot start transaction: MySQL is unavailable and MemoryStore fallback is disabled.');
}

// ==============================================================================
// IN-MEMORY FORENSIC DATA STORE (Active during tests or when MySQL is offline)
// ==============================================================================
class MemoryStore {
  constructor() {
    this.reset();
  }

  reset() {
    this.officers = [
      {
        officer_id: 1,
        badge_number: 'DET-8841',
        full_name: 'Det. Alexander Cross',
        email: 'a.cross@casethread.police.gov',
        password_hash: '$2a$12$jg0EbxHjj7cfgQixKAZrZeGnjunrxPT//OvKMeLU5sIGinc7Bw8CO', // Password123!
        department: 'Major Crimes Division',
        rank_designation: 'Senior Detective',
        role: 'LEAD_OFFICER',
        is_active: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        officer_id: 2,
        badge_number: 'DET-9912',
        full_name: 'Det. Sarah Lin',
        email: 's.lin@casethread.police.gov',
        password_hash: '$2a$12$4e9L7mKjQzW1x.y9P8oN7eM6u5T4r3E2w1Q0z9X8y7W6v5U4t3S2r', // Detective2026!
        department: 'Cyber & Forensic Telemetry Unit',
        rank_designation: 'Forensic Investigator',
        role: 'INVESTIGATOR',
        is_active: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        officer_id: 3,
        badge_number: 'DET-9022',
        full_name: 'Det. Marcus Brody',
        email: 'm.brody@casethread.police.gov',
        password_hash: '$2a$12$jg0EbxHjj7cfgQixKAZrZeGnjunrxPT//OvKMeLU5sIGinc7Bw8CO',
        department: 'Homicide & Robbery Squad',
        rank_designation: 'Detective',
        role: 'INVESTIGATOR',
        is_active: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        officer_id: 4,
        badge_number: 'ANA-3301',
        full_name: 'Dr. Maya Chen',
        email: 'm.chen@casethread.police.gov',
        password_hash: '$2a$12$jg0EbxHjj7cfgQixKAZrZeGnjunrxPT//OvKMeLU5sIGinc7Bw8CO',
        department: 'Digital & Biological Forensics',
        rank_designation: 'Forensic Analyst',
        role: 'INVESTIGATOR',
        is_active: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        officer_id: 5,
        badge_number: 'REV-4412',
        full_name: 'James Vance',
        email: 'j.vance@casethread.police.gov',
        password_hash: '$2a$12$jg0EbxHjj7cfgQixKAZrZeGnjunrxPT//OvKMeLU5sIGinc7Bw8CO',
        department: 'Internal Evidence Quality Bureau',
        rank_designation: 'Senior Reviewer',
        role: 'SENIOR_DETECTIVE',
        is_active: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        officer_id: 6,
        badge_number: 'OBS-5509',
        full_name: 'Rachel Green',
        email: 'r.green@casethread.police.gov',
        password_hash: '$2a$12$jg0EbxHjj7cfgQixKAZrZeGnjunrxPT//OvKMeLU5sIGinc7Bw8CO',
        department: 'External Legal Oversight',
        rank_designation: 'Legal Observer',
        role: 'INVESTIGATOR',
        is_active: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        officer_id: 7,
        badge_number: 'ADM-1000',
        full_name: 'Raymond Holt',
        email: 'r.holt@casethread.police.gov',
        password_hash: '$2a$12$jg0EbxHjj7cfgQixKAZrZeGnjunrxPT//OvKMeLU5sIGinc7Bw8CO',
        department: 'Executive Police Administration',
        rank_designation: 'Commander',
        role: 'ADMIN',
        is_active: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];

    this.cases = [
      {
        case_id: 1,
        case_number: 'CASE-2026-0419',
        title: 'The Metro Vault Intrusion & Disappearance',
        description: 'Unauthorized breach of Metro National Depository Vault with suspicious cell signal anomalies and missing courier.',
        incident_date: '2026-10-15 02:45:00',
        incident_location: '450 Financial Boulevard, Downtown',
        lead_officer_id: 1,
        priority: 'CRITICAL',
        status: 'UNDER_INVESTIGATION',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];

    this.suspects = [
      {
        suspect_id: 1,
        case_id: 1,
        full_name: 'Marcus Vance',
        alias: 'The Ghost',
        age: 38,
        gender: 'MALE',
        phone_number: '+1-555-0192',
        identifying_features: 'Scar across left eyebrow, dragon tattoo on right forearm',
        last_known_address: 'Industrial District Warehouse 4',
        status: 'PRIMARY_SUSPECT',
        notes: 'Master safecracker and electronic bypass operative.',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        suspect_id: 2,
        case_id: 1,
        full_name: 'Damon Vance',
        alias: 'Specter',
        age: 34,
        gender: 'MALE',
        phone_number: '+1-555-0188',
        identifying_features: 'Limp on left leg',
        last_known_address: '12 Harbour St',
        status: 'PERSON_OF_INTEREST',
        notes: 'Brother of Marcus Vance; registered owner of black matte sedan.',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        suspect_id: 3,
        case_id: 1,
        full_name: 'Elena Rostova',
        alias: 'Cipher',
        age: 31,
        gender: 'FEMALE',
        phone_number: '+1-555-0177',
        identifying_features: 'Platinum blonde hair, dark spectacles',
        last_known_address: '44 Skyline Executive Lofts',
        status: 'PERSON_OF_INTEREST',
        notes: 'Depository security systems contractor with root encryption access keys.',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];

    this.victims = [
      {
        victim_id: 1,
        case_id: 1,
        full_name: 'Julian Mercer',
        age: 42,
        gender: 'MALE',
        contact_info: '+1-555-0111',
        residence_address: '89 Parkview Heights',
        condition_status: 'MISSING',
        statement: 'Courier missing since 02:30 AM on night of vault breach.',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];

    this.witnesses = [
      {
        witness_id: 1,
        case_id: 1,
        full_name: 'Evelyn Shaw',
        contact_phone: '+1-555-0144',
        statement: 'Observed a dark matte sedan speeding out of the loading dock at approximately 02:50 AM with headlights off.',
        credibility_score: 0.90,
        statement_timestamp: '2026-10-15 09:30:00',
        statement_location: 'Corner of 4th & Pine St',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        witness_id: 2,
        case_id: 1,
        full_name: 'Arthur Pendelton',
        contact_phone: '+1-555-0166',
        statement: 'Heard industrial drilling hum and metallic latch release sounds coming from Sub-level 2 while conducting night janitorial rounds at 02:35 AM.',
        credibility_score: 0.75,
        statement_timestamp: '2026-10-15 10:15:00',
        statement_location: 'Depository Maintenance Basement',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];

    this.evidence = [
      {
        evidence_id: 1,
        case_id: 1,
        tracking_code: 'EVD-CCTV-001',
        title: 'Loading Dock Camera Feed #4',
        category: 'CCTV',
        description: 'Timestamped footage showing black sedan leaving rear gate at 02:49:12 AM.',
        collection_location: 'Metro Depository Loading Bay',
        collected_at: '2026-10-15 04:00:00',
        source: 'Depository Security DVR Unit 2',
        related_entity_ids: JSON.stringify([{ type: 'SUSPECT', id: 2 }]),
        verification_status: 'CONFIRMED_FACT',
        reliability_assessment: 'HIGH',
        file_reference: '/evidence/cctv_cam4_0249.mp4',
        content_payload: 'RAW_MP4_HEADER_OFFSET_004912_FPS30_HASH_VERIFIED',
        sha256_fingerprint: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        fingerprint_algorithm: 'SHA-256',
        fingerprint_type: 'ORIGINAL_FILE',
        fingerprinted_at: '2026-10-15 04:05:00',
        last_verified_at: '2026-10-15 06:00:00',
        integrity_status: 'INTACT',
        current_version: 1,
        entered_by_officer_id: 1,
        chain_of_custody_notes: 'Collected directly by Lead Det. Cross.',
        metadata_json: JSON.stringify({ camera_id: 'CAM-04', resolution: '1080p', direction: 'Northbound' }),
        is_archived: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        evidence_id: 2,
        case_id: 1,
        tracking_code: 'EVD-TEL-002',
        title: 'Cell Tower Dump Sector 7',
        category: 'PHONE_RECORD',
        description: 'Inbound call to Marcus Vance burner device originating near loading dock at 02:44:00 AM.',
        collection_location: 'Sector 7 Cell Relay',
        collected_at: '2026-10-15 06:15:00',
        source: 'Telecom Subpoena Tower 7 Log',
        related_entity_ids: JSON.stringify([{ type: 'SUSPECT', id: 1 }]),
        verification_status: 'CONFIRMED_FACT',
        reliability_assessment: 'HIGH',
        file_reference: '/evidence/tel_dump_tow07.csv',
        content_payload: 'CELL_DUMP_TOWER07_CDR_402_99_38S',
        sha256_fingerprint: '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a',
        fingerprint_algorithm: 'SHA-256',
        fingerprint_type: 'METADATA_CANONICAL',
        fingerprinted_at: '2026-10-15 06:20:00',
        last_verified_at: '2026-10-15 07:00:00',
        integrity_status: 'INTACT',
        current_version: 1,
        entered_by_officer_id: 1,
        chain_of_custody_notes: 'Obtained via judicial telecommunications subpoena.',
        metadata_json: JSON.stringify({ tower_id: 'TOW-07', duration_sec: 38, cell_id: '402-99' }),
        is_archived: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        evidence_id: 3,
        case_id: 1,
        tracking_code: 'EVD-VEH-003',
        title: 'Black Matte Sedan Registration',
        category: 'VEHICLE',
        description: 'Vehicle matching CCTV footage registered to Damon Vance.',
        collection_location: 'DMV Database Registry',
        collected_at: '2026-10-15 08:20:00',
        source: 'State DMV Central Database',
        related_entity_ids: JSON.stringify([{ type: 'SUSPECT', id: 2 }]),
        verification_status: 'CONFIRMED_FACT',
        reliability_assessment: 'HIGH',
        file_reference: null,
        content_payload: 'DMV_REG_7XYZ99_DAMON_VANCE_MATTE_BLACK',
        sha256_fingerprint: 'ef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe39d',
        fingerprint_algorithm: 'SHA-256',
        fingerprint_type: 'METADATA_CANONICAL',
        fingerprinted_at: '2026-10-15 08:25:00',
        last_verified_at: '2026-10-15 08:45:00',
        integrity_status: 'INTACT',
        current_version: 1,
        entered_by_officer_id: 1,
        chain_of_custody_notes: 'Direct query from state motor vehicle registry.',
        metadata_json: JSON.stringify({ license_plate: '7XYZ99', make: 'Sedan', color: 'Matte Black' }),
        is_archived: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        evidence_id: 4,
        case_id: 1,
        tracking_code: 'EVD-OBS-004',
        title: 'Anonymous Tip: Sighting at Docks',
        category: 'TESTIMONY_TRANSCRIPT',
        description: 'Anonymous caller stated someone looking like Marcus Vance was loading metallic crates into a motorboat at 04:15 AM.',
        collection_location: 'Harbour Pier 9',
        collected_at: '2026-10-15 11:00:00',
        source: 'UNKNOWN', // Demonstrates missing source provenance gap
        related_entity_ids: JSON.stringify([{ type: 'SUSPECT', id: 1 }]),
        verification_status: 'UNVERIFIED_OBSERVATION',
        reliability_assessment: 'QUESTIONABLE',
        file_reference: null,
        entered_by_officer_id: 1,
        chain_of_custody_notes: 'Police Tip Hotline recording #8921.',
        metadata_json: JSON.stringify({ tip_id: 'TIP-8921', audio_recorded: true }),
        is_archived: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        evidence_id: 5,
        case_id: 1,
        tracking_code: 'EVD-CCTV-005',
        title: 'Financial Blvd Street Camera #12',
        category: 'CCTV',
        description: 'High-definition traffic camera recording matte black sedan speeding north across Financial Blvd intersection at 02:51:30 AM.',
        collection_location: '4th & Financial Blvd Intersection',
        collected_at: '2026-10-15 05:30:00',
        source: 'City Traffic Authority Archive',
        related_entity_ids: JSON.stringify([{ type: 'SUSPECT', id: 2 }]),
        verification_status: 'CONFIRMED_FACT',
        reliability_assessment: 'HIGH',
        file_reference: '/evidence/traffic_cam12_0251.mp4',
        entered_by_officer_id: 1,
        chain_of_custody_notes: 'Subpoenaed from Municipal Department of Transportation.',
        metadata_json: JSON.stringify({ camera_id: 'TRAFFIC-12', speed_est_mph: 58, plate_partial: '7XY' }),
        is_archived: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        evidence_id: 6,
        case_id: 1,
        tracking_code: 'EVD-DIG-006',
        title: 'Vault Server Access Log',
        category: 'DIGITAL_DEVICE',
        description: 'Digital logs showing root cryptographic vault door override executed at 02:38:15 AM using contractor encryption credential key.',
        collection_location: 'Depository Server Room',
        collected_at: '2026-10-15 07:45:00',
        source: 'Vault Core Server Audit Journal',
        related_entity_ids: JSON.stringify([{ type: 'SUSPECT', id: 3 }]),
        verification_status: 'CONFIRMED_FACT',
        reliability_assessment: 'HIGH',
        file_reference: '/evidence/vault_auth_0238.log',
        entered_by_officer_id: 1,
        chain_of_custody_notes: 'Cryptographic hash verified by Forensic Unit.',
        metadata_json: JSON.stringify({ auth_user: 'CONTRACTOR_ROOT', ip: '10.0.4.15', key_id: 'ENC-ROSTOVA-88' }),
        is_archived: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        evidence_id: 7,
        case_id: 1,
        tracking_code: 'EVD-BIO-007',
        title: 'Synthetic Glove Fiber Sample',
        category: 'BIOMETRIC',
        description: 'Rare nitrile-neoprene fiber strand recovered from vault door keypad frame with unlogged collection timestamp.',
        collection_location: 'Vault Door Keypad',
        collected_at: null, // Demonstrates missing timestamp gap
        source: 'Forensic Crime Scene Team Unit 1',
        related_entity_ids: '[]',
        verification_status: 'CONFIRMED_FACT',
        reliability_assessment: 'PENDING_LAB',
        file_reference: '/evidence/lab_fiber_007.dat',
        entered_by_officer_id: 1,
        chain_of_custody_notes: 'Sealed in evidence locker B-14.',
        metadata_json: JSON.stringify({ lab_ref: 'BIO-LAB-2026-09' }),
        is_archived: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        evidence_id: 8,
        case_id: 1,
        tracking_code: 'EVD-TEL-008',
        title: 'Encrypted VoIP Call Relay',
        category: 'PHONE_RECORD',
        description: 'VoIP encrypted burst data packet between Elena Rostova terminal and offshore proxy at 02:40:00 AM.',
        collection_location: 'Sub-gateway Router 9',
        collected_at: '2026-10-15 09:10:00',
        source: 'Cyber Telemetry Sniffer Log',
        related_entity_ids: JSON.stringify([{ type: 'SUSPECT', id: 3 }]),
        verification_status: 'CONFIRMED_FACT',
        reliability_assessment: 'HIGH',
        file_reference: '/evidence/voip_pcap_0240.pcap',
        entered_by_officer_id: 1,
        chain_of_custody_notes: 'Captured via lawful intercept packet sniffer.',
        metadata_json: JSON.stringify({ protocol: 'TLSv1.3', packet_size_bytes: 1024 }),
        is_archived: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        evidence_id: 9,
        case_id: 1,
        tracking_code: 'EVD-ISO-009',
        title: 'Abandoned Mountain Bicycle',
        category: 'PHYSICAL',
        description: 'Blue mountain bicycle found discarded in alleyway 6 miles from crime scene. No fingerprint or camera links (demonstrates isolated node).',
        collection_location: 'Alleyway behind 1400 Industrial Way',
        collected_at: '2026-10-15 14:00:00',
        source: 'Patrol Officer Beat 14',
        related_entity_ids: '[]',
        verification_status: 'UNVERIFIED_OBSERVATION',
        reliability_assessment: 'LOW',
        file_reference: null,
        entered_by_officer_id: 1,
        chain_of_custody_notes: 'Retrieved during routine sector patrol.',
        metadata_json: JSON.stringify({ serial_number: 'MN-4820', condition: 'rusted_chain' }),
        is_archived: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];

    this.relationships = [
      // Cluster 1: Main Depository Heist Network
      {
        relationship_id: 1,
        case_id: 1,
        source_type: 'SUSPECT',
        source_id: 1,
        target_type: 'SUSPECT',
        target_id: 2,
        relation_type: 'BROTHER_ASSOCIATE',
        confidence_weight: 0.95,
        relationship_nature: 'CONFIRMED_FACT',
        notes: 'Marcus and Damon Vance have shared banking accounts and past criminal records.',
        discovered_by: 'OFFICER_MANUAL',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        relationship_id: 2,
        case_id: 1,
        source_type: 'SUSPECT',
        source_id: 2,
        target_type: 'EVIDENCE',
        target_id: 3,
        relation_type: 'OWNS_VEHICLE',
        confidence_weight: 0.90,
        relationship_nature: 'CONFIRMED_FACT',
        notes: 'Damon Vance is registered legal owner of black matte sedan 7XYZ99.',
        discovered_by: 'OFFICER_MANUAL',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        relationship_id: 3,
        case_id: 1,
        source_type: 'EVIDENCE',
        source_id: 1,
        target_type: 'EVIDENCE',
        target_id: 3,
        relation_type: 'VEHICLE_MATCH',
        confidence_weight: 0.85,
        relationship_nature: 'UNVERIFIED_OBSERVATION',
        notes: 'CCTV footage visual profile matches registered vehicle.',
        discovered_by: 'OFFICER_MANUAL',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        relationship_id: 4,
        case_id: 1,
        source_type: 'EVIDENCE',
        source_id: 1,
        target_type: 'EVIDENCE',
        target_id: 5,
        relation_type: 'VEHICLE_TRANSIT',
        confidence_weight: 0.90,
        relationship_nature: 'CONFIRMED_FACT',
        notes: 'Sedan tracked traveling north along Financial Blvd route.',
        discovered_by: 'OFFICER_MANUAL',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        relationship_id: 5,
        case_id: 1,
        source_type: 'SUSPECT',
        source_id: 1,
        target_type: 'EVIDENCE',
        target_id: 2,
        relation_type: 'PHONE_CALL_ROUTING',
        confidence_weight: 0.88,
        relationship_nature: 'CONFIRMED_FACT',
        notes: 'Burner phone registered to Marcus Vance pinged Sector 7 tower near loading dock.',
        discovered_by: 'OFFICER_MANUAL',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        relationship_id: 6,
        case_id: 1,
        source_type: 'WITNESS',
        source_id: 1,
        target_type: 'EVIDENCE',
        target_id: 1,
        relation_type: 'CORROBORATES_DEPARTURE',
        confidence_weight: 0.80,
        relationship_nature: 'CONFIRMED_FACT',
        notes: 'Witness Evelyn Shaw observed vehicle departure matching CCTV timestamp.',
        discovered_by: 'OFFICER_MANUAL',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      // Cluster 2: Depository Security Contractor Sub-network (Disconnected from Cluster 1)
      {
        relationship_id: 7,
        case_id: 1,
        source_type: 'SUSPECT',
        source_id: 3,
        target_type: 'EVIDENCE',
        target_id: 6,
        relation_type: 'CONTRACTOR_CREDENTIAL_MATCH',
        confidence_weight: 0.92,
        relationship_nature: 'CONFIRMED_FACT',
        notes: 'Cryptographic access key ENC-ROSTOVA-88 assigned exclusively to Elena Rostova.',
        discovered_by: 'OFFICER_MANUAL',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        relationship_id: 8,
        case_id: 1,
        source_type: 'SUSPECT',
        source_id: 3,
        target_type: 'EVIDENCE',
        target_id: 8,
        relation_type: 'TERMINAL_OWNER',
        confidence_weight: 0.85,
        relationship_nature: 'CONFIRMED_FACT',
        notes: 'Elena Rostova laptop initiated encrypted proxy connection during breach.',
        discovered_by: 'OFFICER_MANUAL',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        relationship_id: 9,
        case_id: 1,
        source_type: 'WITNESS',
        source_id: 2,
        target_type: 'EVIDENCE',
        target_id: 6,
        relation_type: 'CORROBORATES_AUDITORY_TIMING',
        confidence_weight: 0.75,
        relationship_nature: 'CONFIRMED_FACT',
        notes: 'Arthur Pendelton janitorial hearing aligns with electronic override log.',
        discovered_by: 'OFFICER_MANUAL',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];

    this.timelines = [
      {
        timeline_id: 1,
        case_id: 1,
        event_timestamp: '2026-10-15 02:30:00',
        event_title: 'Courier Julian Mercer Last Contact',
        event_description: 'Courier checked in with dispatch before entering vault access corridor.',
        entity_type: 'VICTIM',
        entity_id: 1,
        location: 'Depository Access Corridor',
        source_evidence_id: null,
        status: 'CONFIRMED_FACT',
        is_verified: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        timeline_id: 2,
        case_id: 1,
        event_timestamp: '2026-10-15 02:35:00',
        event_title: 'Custodian Reports Drilling Sounds',
        event_description: 'Janitor Arthur Pendelton heard high-speed drilling from Sub-level 2.',
        entity_type: 'WITNESS',
        entity_id: 2,
        location: 'Depository Maintenance Basement',
        source_evidence_id: null,
        status: 'CONFIRMED_FACT',
        is_verified: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        timeline_id: 3,
        case_id: 1,
        event_timestamp: '2026-10-15 02:38:15',
        event_title: 'Vault Electronic Security Bypass',
        event_description: 'Digital root authorization executed via contractor key ENC-ROSTOVA-88.',
        entity_type: 'EVIDENCE',
        entity_id: 6,
        location: 'Depository Server Room',
        source_evidence_id: 6,
        status: 'CONFIRMED_FACT',
        is_verified: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        timeline_id: 4,
        case_id: 1,
        event_timestamp: '2026-10-15 02:44:00',
        event_title: 'Sector 7 Cell Relay Hit',
        event_description: 'Burner phone associated with Marcus Vance triggered Sector 7 tower near loading dock.',
        entity_type: 'SUSPECT',
        entity_id: 1,
        location: 'Depository Loading Dock Perimeter',
        source_evidence_id: 2,
        status: 'CONFIRMED_FACT',
        is_verified: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        timeline_id: 5,
        case_id: 1,
        event_timestamp: '2026-10-15 02:45:00',
        event_title: 'Marcus Vance False Alibi Claim',
        event_description: 'Suspect claimed he was drinking coffee at Westside Diner (15 km away) at 02:45 AM (Contradicts 02:44:00 cell hit).',
        entity_type: 'SUSPECT',
        entity_id: 1,
        location: 'Westside 24hr Diner',
        source_evidence_id: null,
        status: 'HYPOTHESIS',
        is_verified: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        timeline_id: 6,
        case_id: 1,
        event_timestamp: '2026-10-15 02:49:12',
        event_title: 'Black Sedan Departure',
        event_description: 'Sedan exits loading dock heading north with headlights off.',
        entity_type: 'EVIDENCE',
        entity_id: 1,
        location: 'Loading Bay Rear Gate',
        source_evidence_id: 1,
        status: 'CONFIRMED_FACT',
        is_verified: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        timeline_id: 7,
        case_id: 1,
        event_timestamp: '2026-10-15 02:51:30',
        event_title: 'Black Sedan Financial Blvd Sighting',
        event_description: 'Sedan recorded speeding north past Financial Blvd intersection.',
        entity_type: 'EVIDENCE',
        entity_id: 5,
        location: '4th & Financial Blvd Intersection',
        source_evidence_id: 5,
        status: 'CONFIRMED_FACT',
        is_verified: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        timeline_id: 8,
        case_id: 1,
        event_timestamp: '2026-10-15 03:01:00',
        event_title: 'Elena Rostova Depository Exit',
        event_description: 'Security badge swipe recorded at depository main lobby security turnstile.',
        entity_type: 'SUSPECT',
        entity_id: 3,
        location: 'Depository Main Plaza',
        source_evidence_id: null,
        status: 'CONFIRMED_FACT',
        is_verified: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        timeline_id: 9,
        case_id: 1,
        event_timestamp: '2026-10-15 03:02:30',
        event_title: 'Elena Rostova Airport Departure Claim',
        event_description: 'Suspect claimed to be at Metro East Airport Terminal (18 km away in 90 seconds - impossible speed violation).',
        entity_type: 'SUSPECT',
        entity_id: 3,
        location: 'Metro East Airport Terminal',
        source_evidence_id: null,
        status: 'HYPOTHESIS',
        is_verified: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        timeline_id: 10,
        case_id: 1,
        event_timestamp: '2026-10-15 04:15:00',
        event_title: 'Uncorroborated Pier Sighting',
        event_description: 'Tipster claims Marcus Vance was spotted loading crates into a vessel.',
        entity_type: 'SUSPECT',
        entity_id: 1,
        location: 'Harbour Pier 9',
        source_evidence_id: 4,
        status: 'UNVERIFIED_OBSERVATION',
        is_verified: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];

    this.leads = [
      {
        lead_id: 1,
        case_id: 1,
        title: 'Interrogate Damon Vance Regarding Vehicle 7XYZ99',
        hypothesis: 'Vehicle registered to Damon Vance was captured fleeing the vault loading dock 4 minutes after the breach.',
        recommended_action: 'Issue subpoena for vehicle location data and bring Damon Vance for formal questioning.',
        lead_status: 'ASSIGNED',
        priority_score: 92.50,
        assigned_officer_id: 1,
        source_gap_type: 'TIMELINE_CONTRADICTION',
        generated_by: 'OFFICER_MANUAL',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        lead_id: 2,
        case_id: 1,
        title: 'Subpoena Pier 9 Maritime Surveillance Footage',
        hypothesis: 'Verify whether anonymous tip regarding Pier 9 vessel departure corresponds to physical CCTV footage.',
        recommended_action: 'Contact Port Authority to retrieve 03:30 - 05:00 AM Pier 9 camera recordings.',
        lead_status: 'OPEN',
        priority_score: 78.00,
        assigned_officer_id: 1,
        source_gap_type: 'MISSING_EVIDENCE',
        generated_by: 'OFFICER_MANUAL',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];

    const genesisTime = new Date('2026-10-15T04:00:00.000Z').toISOString();
    const genesisEvent = {
      audit_id: 1,
      evidence_id: 1,
      case_id: 1,
      officer_id: 1,
      action_type: 'CREATED',
      previous_state: null,
      new_state: JSON.stringify({ tracking_code: 'EVD-CCTV-001', title: 'Loading Dock Camera Feed #4', category: 'CCTV' }),
      previous_state_hash: '',
      current_state_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      previous_event_hash: cryptoService.GENESIS_HASH,
      canonical_payload: JSON.stringify({ evidence_id: 1, action_type: 'CREATED' }),
      reason_for_change: 'Initial forensic evidence ingestion',
      ip_address: '127.0.0.1',
      created_at: genesisTime
    };
    genesisEvent.current_event_hash = cryptoService.calculateEventHash(genesisEvent);

    this.audit_logs = [genesisEvent];

    this.evidence_versions = [
      {
        version_id: 1,
        evidence_id: 1,
        case_id: 1,
        version_number: 1,
        title: 'Loading Dock Camera Feed #4',
        category: 'CCTV',
        description: 'Timestamped footage showing black sedan leaving rear gate at 02:49:12 AM.',
        collection_location: 'Metro Depository Loading Bay',
        collected_at: '2026-10-15 04:00:00',
        source: 'Depository Security DVR Unit 2',
        verification_status: 'CONFIRMED_FACT',
        reliability_assessment: 'HIGH',
        content_payload: 'RAW_MP4_HEADER_OFFSET_004912_FPS30_HASH_VERIFIED',
        metadata_json: JSON.stringify({ camera_id: 'CAM-04', resolution: '1080p', direction: 'Northbound' }),
        version_fingerprint: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        fingerprint_type: 'ORIGINAL_FILE',
        modified_by_officer_id: 1,
        reason_for_modification: 'Initial evidence ingestion and baseline version creation.',
        created_at: '2026-10-15 04:00:00'
      },
      {
        version_id: 2,
        evidence_id: 2,
        case_id: 1,
        version_number: 1,
        title: 'Cell Tower Dump Sector 7',
        category: 'PHONE_RECORD',
        description: 'Inbound call to Marcus Vance burner device originating near loading dock at 02:44:00 AM.',
        collection_location: 'Sector 7 Cell Relay',
        collected_at: '2026-10-15 06:15:00',
        source: 'Telecom Subpoena Tower 7 Log',
        verification_status: 'CONFIRMED_FACT',
        reliability_assessment: 'HIGH',
        content_payload: 'CELL_DUMP_TOWER07_CDR_402_99_38S',
        metadata_json: JSON.stringify({ tower_id: 'TOW-07', duration_sec: 38, cell_id: '402-99' }),
        version_fingerprint: '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a',
        fingerprint_type: 'METADATA_CANONICAL',
        modified_by_officer_id: 2,
        reason_for_modification: 'Initial evidence ingestion and baseline version creation.',
        created_at: '2026-10-15 06:15:00'
      },
      {
        version_id: 3,
        evidence_id: 3,
        case_id: 1,
        version_number: 1,
        title: 'Black Matte Sedan Registration',
        category: 'VEHICLE',
        description: 'Vehicle matching CCTV footage registered to Damon Vance.',
        collection_location: 'DMV Database Registry',
        collected_at: '2026-10-15 08:20:00',
        source: 'State DMV Central Database',
        verification_status: 'CONFIRMED_FACT',
        reliability_assessment: 'HIGH',
        content_payload: 'DMV_REG_7XYZ99_DAMON_VANCE_MATTE_BLACK',
        metadata_json: JSON.stringify({ license_plate: '7XYZ99', make: 'Sedan', color: 'Matte Black' }),
        version_fingerprint: 'ef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe39d',
        fingerprint_type: 'METADATA_CANONICAL',
        modified_by_officer_id: 1,
        reason_for_modification: 'Initial evidence ingestion and baseline version creation.',
        created_at: '2026-10-15 08:20:00'
      }
    ];

    this.custody_events = [
      {
        custody_event_id: 1,
        evidence_id: 1,
        case_id: 1,
        previous_custodian: 'Depository Security Lead Martinez',
        new_custodian: 'Det. Alexander Cross (Badge DET-8841)',
        transfer_timestamp: '2026-10-15 04:30:00',
        transfer_reason: 'Initial Evidence Seizure from DVR Unit',
        transfer_location: 'Metro Depository Security Office',
        transfer_notes: 'DVR hard drive clone exported to encrypted forensic drive.',
        transferring_officer_id: 1,
        verification_status: 'VERIFIED',
        related_fingerprint: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        is_successful: 1,
        failure_reason: null,
        created_at: '2026-10-15 04:30:00'
      },
      {
        custody_event_id: 2,
        evidence_id: 1,
        case_id: 1,
        previous_custodian: 'Det. Alexander Cross (Badge DET-8841)',
        new_custodian: 'Digital Forensics Lab Technician Miller',
        transfer_timestamp: '2026-10-15 06:00:00',
        transfer_reason: 'Forensic Video Enhancement and Plate Extraction',
        transfer_location: 'Central Forensics Laboratory Room 302',
        transfer_notes: 'Transferred with tamper-evident seal #7741.',
        transferring_officer_id: 1,
        verification_status: 'VERIFIED',
        related_fingerprint: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        is_successful: 1,
        failure_reason: null,
        created_at: '2026-10-15 06:00:00'
      }
    ];

    
    this.evidence_files = [];
    this.metadata_extractions = [];
    this.derived_artifacts = [];
    this.evidence_geospatial = [
      {
        geospatial_id: 1,
        evidence_id: 1,
        case_id: 1,
        entity_type: 'CCTV',
        entity_id: null,
        latitude: 40.71280000,
        longitude: -74.00600000,
        altitude: 12.50,
        accuracy_meters: 3.00,
        coordinate_reference_system: 'WGS84',
        location_source: 'CCTV_RECORD',
        location_name: 'Metro Depository Rear Loading Bay Gate',
        recorded_timestamp: '2026-10-15 02:49:12',
        timezone_offset: '+00:00',
        extraction_source: 'Fixed Surveillance Camera Spec Registry',
        verification_status: 'CONFIRMED_FACT',
        officer_reviewed: 1,
        reviewed_by_officer_id: 1,
        review_notes: 'Verified fixed CCTV installation pole.',
        created_at: new Date().toISOString()
      },
      {
        geospatial_id: 2,
        evidence_id: 2,
        case_id: 1,
        entity_type: 'EVIDENCE',
        entity_id: 1,
        latitude: 40.71350000,
        longitude: -74.00510000,
        altitude: 35.00,
        accuracy_meters: 25.00,
        coordinate_reference_system: 'WGS84',
        location_source: 'CELL_TOWER',
        location_name: 'Sector 7 Cell Relay Antenna Tower',
        recorded_timestamp: '2026-10-15 02:44:00',
        timezone_offset: '+00:00',
        extraction_source: 'Cellular Carrier Tower Subpoena Packet',
        verification_status: 'CONFIRMED_FACT',
        officer_reviewed: 1,
        reviewed_by_officer_id: 1,
        review_notes: 'Subpoena cell tower coordinate alignment.',
        created_at: new Date().toISOString()
      },
      {
        geospatial_id: 3,
        evidence_id: 5,
        case_id: 1,
        entity_type: 'VEHICLE_SIGHTING',
        entity_id: 3,
        latitude: 40.71600000,
        longitude: -74.00400000,
        altitude: 10.00,
        accuracy_meters: 5.00,
        coordinate_reference_system: 'WGS84',
        location_source: 'CCTV_RECORD',
        location_name: '4th & Financial Boulevard Intersection',
        recorded_timestamp: '2026-10-15 02:51:30',
        timezone_offset: '+00:00',
        extraction_source: 'Municipal Traffic Camera System',
        verification_status: 'CONFIRMED_FACT',
        officer_reviewed: 1,
        reviewed_by_officer_id: 1,
        review_notes: null,
        created_at: new Date().toISOString()
      },
      {
        geospatial_id: 4,
        evidence_id: 6,
        case_id: 1,
        entity_type: 'EVIDENCE',
        entity_id: null,
        latitude: 40.71295000,
        longitude: -74.00615000,
        altitude: -5.00,
        accuracy_meters: 1.50,
        coordinate_reference_system: 'WGS84',
        location_source: 'OFFICER_ENTERED',
        location_name: 'Depository Sub-level 2 Server Corridor',
        recorded_timestamp: '2026-10-15 02:38:15',
        timezone_offset: '+00:00',
        extraction_source: 'Crime Scene Technician Architectural Mapping',
        verification_status: 'CONFIRMED_FACT',
        officer_reviewed: 1,
        reviewed_by_officer_id: 1,
        review_notes: null,
        created_at: new Date().toISOString()
      },
      {
        geospatial_id: 5,
        evidence_id: 4,
        case_id: 1,
        entity_type: 'EVIDENCE',
        entity_id: null,
        latitude: 40.70500000,
        longitude: -74.01800000,
        altitude: 2.00,
        accuracy_meters: 50.00,
        coordinate_reference_system: 'WGS84',
        location_source: 'OFFICER_ENTERED',
        location_name: 'Harbour Pier 9 Cargo Terminal Berth 4',
        recorded_timestamp: '2026-10-15 04:15:00',
        timezone_offset: '+00:00',
        extraction_source: 'Witness Tip Location Estimation',
        verification_status: 'UNVERIFIED_OBSERVATION',
        officer_reviewed: 0,
        reviewed_by_officer_id: null,
        review_notes: 'Unverified tipster location.',
        created_at: new Date().toISOString()
      },
      {
        geospatial_id: 6,
        evidence_id: 1,
        case_id: 1,
        entity_type: 'EVIDENCE',
        entity_id: null,
        latitude: 40.71285000,
        longitude: -74.00595000,
        altitude: 11.00,
        accuracy_meters: 4.20,
        coordinate_reference_system: 'WGS84',
        location_source: 'EXIF_GPS',
        location_name: 'Depository Alleyway Approach',
        recorded_timestamp: '2026-10-15 02:48:00',
        timezone_offset: '+00:00',
        extraction_source: 'EXIF metadata extraction from patrol photo',
        verification_status: 'UNVERIFIED_OBSERVATION',
        officer_reviewed: 0,
        reviewed_by_officer_id: null,
        review_notes: null,
        created_at: new Date().toISOString()
      }
    ];
    this.integrity_verifications = [
      {
        verification_id: 1,
        evidence_id: 1,
        case_id: 1,
        officer_id: 1,
        recalculated_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        recorded_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        match_status: 'MATCH',
        fingerprint_type: 'ORIGINAL_FILE',
        notes: 'Automated ingestion verification: hash match confirmed.',
        ip_address: '127.0.0.1',
        verified_at: '2026-10-15 04:05:00'
      }
    ];

    // Phase 10 Collaboration Tables
    this.case_members = [
      { member_id: 1, case_id: 1, officer_id: 1, role: 'LEAD_INVESTIGATOR', assigned_by_officer_id: 1, is_active: 1, permissions: null, assigned_at: '2026-10-15 02:45:00', revoked_at: null, revoked_by_officer_id: null, revocation_reason: null },
      { member_id: 2, case_id: 1, officer_id: 2, role: 'INVESTIGATING_OFFICER', assigned_by_officer_id: 1, is_active: 1, permissions: null, assigned_at: '2026-10-15 03:00:00', revoked_at: null, revoked_by_officer_id: null, revocation_reason: null },
      { member_id: 3, case_id: 1, officer_id: 3, role: 'INVESTIGATING_OFFICER', assigned_by_officer_id: 1, is_active: 1, permissions: null, assigned_at: '2026-10-15 03:00:00', revoked_at: null, revoked_by_officer_id: null, revocation_reason: null },
      { member_id: 4, case_id: 1, officer_id: 4, role: 'FORENSIC_ANALYST', assigned_by_officer_id: 1, is_active: 1, permissions: null, assigned_at: '2026-10-15 03:10:00', revoked_at: null, revoked_by_officer_id: null, revocation_reason: null },
      { member_id: 5, case_id: 1, officer_id: 5, role: 'EVIDENCE_REVIEWER', assigned_by_officer_id: 1, is_active: 1, permissions: null, assigned_at: '2026-10-15 03:15:00', revoked_at: null, revoked_by_officer_id: null, revocation_reason: null },
      { member_id: 6, case_id: 1, officer_id: 6, role: 'READ_ONLY_REVIEWER', assigned_by_officer_id: 1, is_active: 1, permissions: null, assigned_at: '2026-10-15 03:20:00', revoked_at: null, revoked_by_officer_id: null, revocation_reason: null }
    ];

    this.investigation_tasks = [
      {
        task_id: 1,
        case_id: 1,
        title: 'Subpoena Sector 7 Cell Tower Logs',
        description: 'Obtain complete CDR transmission records from telecom provider for Sector 7 antenna.',
        assigned_officer_id: 2,
        created_by_officer_id: 1,
        priority: 'HIGH',
        status: 'COMPLETED',
        due_date: '2026-10-16 12:00:00',
        completed_at: '2026-10-15 06:15:00',
        related_evidence_ids: [2],
        related_entity_ids: [{ type: 'SUSPECT', id: 1 }],
        related_lead_id: 2,
        completion_notes: 'Successfully subpoenaed and extracted 38-second CDR record.',
        version: 2,
        created_at: '2026-10-15 03:15:00',
        updated_at: '2026-10-15 06:15:00'
      },
      {
        task_id: 2,
        case_id: 1,
        title: 'Extract Loading Bay CCTV Timestamp Markers',
        description: 'Isolate high-resolution frames of black sedan departure from Camera Feed #4.',
        assigned_officer_id: 4,
        created_by_officer_id: 1,
        priority: 'NORMAL',
        status: 'COMPLETED',
        due_date: '2026-10-16 10:00:00',
        completed_at: '2026-10-15 05:00:00',
        related_evidence_ids: [1],
        related_entity_ids: [{ type: 'SUSPECT', id: 2 }],
        related_lead_id: 1,
        completion_notes: 'Frames isolated and verified at 02:49:12 AM.',
        version: 2,
        created_at: '2026-10-15 03:25:00',
        updated_at: '2026-10-15 05:00:00'
      },
      {
        task_id: 3,
        case_id: 1,
        title: 'Cross-Reference Sedan Transit with Traffic Camera 12',
        description: 'Correlate departure speed and vector along Financial Blvd.',
        assigned_officer_id: 2,
        created_by_officer_id: 1,
        priority: 'HIGH',
        status: 'IN_PROGRESS',
        due_date: '2026-10-17 18:00:00',
        completed_at: null,
        related_evidence_ids: [1, 5],
        related_entity_ids: [{ type: 'SUSPECT', id: 2 }],
        related_lead_id: 1,
        completion_notes: null,
        version: 1,
        created_at: '2026-10-15 05:10:00',
        updated_at: '2026-10-15 05:10:00'
      },
      {
        task_id: 4,
        case_id: 1,
        title: 'Forensic Nitrile Glove Fiber Analysis',
        description: 'Conduct gas chromatography and spectral comparison on vault keypad fiber sample.',
        assigned_officer_id: 4,
        created_by_officer_id: 1,
        priority: 'NORMAL',
        status: 'UNDER_REVIEW',
        due_date: '2026-10-18 14:00:00',
        completed_at: null,
        related_evidence_ids: [7],
        related_entity_ids: [],
        related_lead_id: null,
        completion_notes: 'Preliminary spectral curve matches synthetic industrial nitrile-neoprene.',
        version: 1,
        created_at: '2026-10-15 05:30:00',
        updated_at: '2026-10-15 05:30:00'
      },
      {
        task_id: 5,
        case_id: 1,
        title: 'Question Contractor Elena Rostova on Root Key Overrides',
        description: 'Conduct formal interview regarding access log ENC-ROSTOVA-88.',
        assigned_officer_id: 1,
        created_by_officer_id: 1,
        priority: 'CRITICAL',
        status: 'ASSIGNED',
        due_date: '2026-10-19 09:00:00',
        completed_at: null,
        related_evidence_ids: [6, 8],
        related_entity_ids: [{ type: 'SUSPECT', id: 3 }],
        related_lead_id: null,
        completion_notes: null,
        version: 1,
        created_at: '2026-10-15 06:00:00',
        updated_at: '2026-10-15 06:00:00'
      }
    ];

    this.investigation_task_notes = [
      {
        note_id: 1,
        task_id: 1,
        case_id: 1,
        officer_id: 2,
        note_text: 'Subpoena fulfilled by provider. CSV records ingested into vault.',
        created_at: '2026-10-15 06:00:00'
      },
      {
        note_id: 2,
        task_id: 4,
        case_id: 1,
        officer_id: 4,
        note_text: 'Spectral scan completed. Polymer formulation indicates chemical grade nitrile.',
        created_at: '2026-10-15 07:15:00'
      }
    ];

    this.investigation_task_dependencies = [
      { dependency_id: 1, task_id: 3, depends_on_task_id: 2, created_by_officer_id: 1, created_at: '2026-10-15 05:10:00' },
      { dependency_id: 2, task_id: 5, depends_on_task_id: 4, created_by_officer_id: 1, created_at: '2026-10-15 06:00:00' }
    ];

    this.evidence_reviews = [
      {
        review_id: 1,
        evidence_id: 1,
        case_id: 1,
        assigned_reviewer_id: 5,
        created_by_officer_id: 1,
        review_status: 'VERIFIED',
        reviewer_observations: 'Video timestamp is continuous; camera angle confirms vehicle matches sedan plate 7XYZ99.',
        integrity_verification_status: 'VERIFIED',
        metadata_review_status: 'APPROVED',
        review_notes: 'High evidentiary reliability confirmed by independent review.',
        related_task_id: 2,
        reviewed_at: '2026-10-15 07:00:00',
        created_at: '2026-10-15 05:15:00',
        updated_at: '2026-10-15 07:00:00'
      },
      {
        review_id: 2,
        evidence_id: 6,
        case_id: 1,
        assigned_reviewer_id: 5,
        created_by_officer_id: 1,
        review_status: 'UNDER_REVIEW',
        reviewer_observations: 'Digital signature valid. Cross-checking contractor key allocation records.',
        integrity_verification_status: 'VERIFIED',
        metadata_review_status: 'INCOMPLETE',
        review_notes: 'Review in progress awaiting telecom verification.',
        related_task_id: 5,
        reviewed_at: null,
        created_at: '2026-10-15 06:10:00',
        updated_at: '2026-10-15 06:10:00'
      },
      {
        review_id: 3,
        evidence_id: 7,
        case_id: 1,
        assigned_reviewer_id: 4,
        created_by_officer_id: 1,
        review_status: 'PENDING_REVIEW',
        reviewer_observations: 'Pending spectroscopy lab confirmation.',
        integrity_verification_status: 'UNCHECKED',
        metadata_review_status: 'NOT_APPLICABLE',
        review_notes: 'Awaiting finalized spectral report.',
        related_task_id: 4,
        reviewed_at: null,
        created_at: '2026-10-15 06:15:00',
        updated_at: '2026-10-15 06:15:00'
      }
    ];

    this.case_activity_logs = [
      {
        activity_id: 1,
        case_id: 1,
        actor_id: 1,
        event_type: 'OFFICER_ASSIGNED',
        related_record_id: '2',
        previous_state: null,
        new_state: { role: 'INVESTIGATING_OFFICER' },
        event_description: 'Det. Sarah Lin assigned to case as Investigating Officer',
        created_at: '2026-10-15 03:00:00'
      },
      {
        activity_id: 2,
        case_id: 1,
        actor_id: 1,
        event_type: 'TASK_CREATED',
        related_record_id: '1',
        previous_state: null,
        new_state: { title: 'Subpoena Sector 7 Cell Tower Logs', priority: 'HIGH' },
        event_description: 'Task created: Subpoena Sector 7 Cell Tower Logs',
        created_at: '2026-10-15 03:15:00'
      },
      {
        activity_id: 3,
        case_id: 1,
        actor_id: 1,
        event_type: 'TASK_ASSIGNED',
        related_record_id: '1',
        previous_state: null,
        new_state: { assigned_officer_id: 2 },
        event_description: 'Task 1 assigned to Det. Sarah Lin',
        created_at: '2026-10-15 03:20:00'
      },
      {
        activity_id: 4,
        case_id: 1,
        actor_id: 2,
        event_type: 'TASK_STATUS_CHANGED',
        related_record_id: '1',
        previous_state: { status: 'IN_PROGRESS' },
        new_state: { status: 'COMPLETED' },
        event_description: 'Task 1 status transitioned to COMPLETED',
        created_at: '2026-10-15 06:15:00'
      },
      {
        activity_id: 5,
        case_id: 1,
        actor_id: 1,
        event_type: 'EVIDENCE_REVIEWED',
        related_record_id: '1',
        previous_state: { status: 'PENDING_REVIEW' },
        new_state: { status: 'VERIFIED' },
        event_description: 'Evidence EVD-CCTV-001 reviewed and verified by James Vance',
        created_at: '2026-10-15 07:00:00'
      }
    ];

    this.officer_notifications = [
      {
        notification_id: 1,
        officer_id: 2,
        case_id: 1,
        event_type: 'TASK_ASSIGNED',
        title: 'New Investigation Task Assigned',
        message: 'You have been assigned to task: Subpoena Sector 7 Cell Tower Logs',
        reference_type: 'TASK',
        reference_id: '1',
        is_read: 1,
        read_at: '2026-10-15 03:25:00',
        dedup_key: 'TASK_ASSIGNED:1:2',
        created_at: '2026-10-15 03:20:00'
      },
      {
        notification_id: 2,
        officer_id: 4,
        case_id: 1,
        event_type: 'TASK_ASSIGNED',
        title: 'New Investigation Task Assigned',
        message: 'You have been assigned to task: Extract Loading Bay CCTV Timestamp Markers',
        reference_type: 'TASK',
        reference_id: '2',
        is_read: 1,
        read_at: '2026-10-15 03:35:00',
        dedup_key: 'TASK_ASSIGNED:2:4',
        created_at: '2026-10-15 03:30:00'
      },
      {
        notification_id: 3,
        officer_id: 2,
        case_id: 1,
        event_type: 'TASK_ASSIGNED',
        title: 'New Investigation Task Assigned',
        message: 'You have been assigned to task: Cross-Reference Sedan Transit with Traffic Camera 12',
        reference_type: 'TASK',
        reference_id: '3',
        is_read: 0,
        read_at: null,
        dedup_key: 'TASK_ASSIGNED:3:2',
        created_at: '2026-10-15 05:10:00'
      },
      {
        notification_id: 4,
        officer_id: 5,
        case_id: 1,
        event_type: 'EVIDENCE_REVIEW_REQUESTED',
        title: 'Evidence Review Requested',
        message: 'Review requested for Loading Dock Camera Feed #4 (EVD-CCTV-001)',
        reference_type: 'EVIDENCE_REVIEW',
        reference_id: '1',
        is_read: 1,
        read_at: '2026-10-15 05:30:00',
        dedup_key: 'EVIDENCE_REVIEW_REQUESTED:1:5',
        created_at: '2026-10-15 05:15:00'
      },
      {
        notification_id: 5,
        officer_id: 1,
        case_id: 1,
        event_type: 'TASK_BLOCKED',
        title: 'Task Dependency Prerequisite Notice',
        message: 'Task Question Contractor Elena Rostova is dependent on completion of Task 4.',
        reference_type: 'TASK',
        reference_id: '5',
        is_read: 0,
        read_at: null,
        dedup_key: 'TASK_BLOCKED:5:1',
        created_at: '2026-10-15 06:00:00'
      }
    ];
  }

  async execute(sql, params = []) {
    const trimmed = sql.trim().toUpperCase();

    // 1. SELECT queries
    if (trimmed.startsWith('SELECT')) {
      if (sql.includes('FROM officers WHERE badge_number = ?')) {
        const rows = this.officers.filter(o => o.badge_number === params[0]);
        return [rows, []];
      }
      if (sql.includes('FROM officers WHERE email = ?')) {
        const rows = this.officers.filter(o => o.email === params[0]);
        return [rows, []];
      }
      if (sql.includes('FROM officers') && (sql.includes('officer_id = ?') || sql.includes('officer_id=?'))) {
        const rows = this.officers.filter(o => o.officer_id === parseInt(params[0], 10));
        return [rows, []];
      }
      if (sql.includes('FROM cases') && sql.includes('case_number = ?')) {
        const c = this.cases.find(item => item.case_number === params[0]);
        return [c ? [{ case_id: c.case_id, case_number: c.case_number }] : [], []];
      }
      if (sql.includes('FROM cases') && (sql.includes('case_id = ?') || sql.includes('c.case_id = ?'))) {
        const c = this.cases.find(item => item.case_id === parseInt(params[0], 10));
        if (c) {
          const lead = this.officers.find(o => o.officer_id === c.lead_officer_id);
          return [[{ ...c, lead_officer_name: lead?.full_name, lead_officer_badge: lead?.badge_number }], []];
        }
        return [[], []];
      }
      if (sql.includes('FROM cases') && sql.includes('ORDER BY')) {
        let matchingCases = [...this.cases];
        if (sql.includes('c.lead_officer_id = ?') || sql.includes('cm.officer_id = ?')) {
          const offId = parseInt(params[0], 10);
          matchingCases = matchingCases.filter(c => {
            if (c.lead_officer_id === offId) return true;
            return (this.case_members || []).some(m => m.case_id === c.case_id && m.officer_id === offId && (m.is_active === 1 || m.is_active === true));
          });
        }
        if (sql.includes('c.status = ?')) {
          const stParam = params.find(p => ['OPEN', 'UNDER_INVESTIGATION', 'COLD_CASE', 'CLOSED', 'ARCHIVED'].includes(p));
          if (stParam) matchingCases = matchingCases.filter(c => c.status === stParam);
        }
        if (sql.includes('c.priority = ?')) {
          const prParam = params.find(p => ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(p));
          if (prParam) matchingCases = matchingCases.filter(c => c.priority === prParam);
        }
        const rows = matchingCases.map(c => {
          const lead = this.officers.find(o => o.officer_id === c.lead_officer_id);
          const evCount = this.evidence.filter(e => e.case_id === c.case_id && !e.is_archived).length;
          const susCount = this.suspects.filter(s => s.case_id === c.case_id).length;
          const witCount = this.witnesses.filter(w => w.case_id === c.case_id).length;
          return {
            ...c,
            lead_officer_name: lead?.full_name,
            lead_officer_badge: lead?.badge_number,
            evidence_count: evCount,
            suspect_count: susCount,
            witness_count: witCount
          };
        });
        return [rows, []];
      }
      if (sql.includes('FROM suspects') && (sql.includes('suspect_id = ?') || sql.includes('s.suspect_id = ?'))) {
        return [this.suspects.filter(s => s.suspect_id === parseInt(params[0], 10)), []];
      }
      if (sql.includes('FROM suspects') && (sql.includes('case_id = ?') || sql.includes('s.case_id = ?'))) {
        return [this.suspects.filter(s => s.case_id === parseInt(params[0], 10)), []];
      }
      if (sql.includes('FROM victims') && (sql.includes('victim_id = ?') || sql.includes('v.victim_id = ?'))) {
        return [this.victims.filter(v => v.victim_id === parseInt(params[0], 10)), []];
      }
      if (sql.includes('FROM victims') && (sql.includes('case_id = ?') || sql.includes('v.case_id = ?'))) {
        return [this.victims.filter(v => v.case_id === parseInt(params[0], 10)), []];
      }
      if (sql.includes('FROM witnesses') && (sql.includes('witness_id = ?') || sql.includes('w.witness_id = ?'))) {
        return [this.witnesses.filter(w => w.witness_id === parseInt(params[0], 10)), []];
      }
      if (sql.includes('FROM witnesses') && (sql.includes('case_id = ?') || sql.includes('w.case_id = ?'))) {
        return [this.witnesses.filter(w => w.case_id === parseInt(params[0], 10)), []];
      }
      if (sql.includes('FROM evidence_versions')) {
        const evId = parseInt(params[0], 10);
        const rows = this.evidence_versions.filter(v => v.evidence_id === evId).sort((a, b) => a.version_number - b.version_number);
        return [rows, []];
      }
      if (sql.includes('FROM evidence_custody_events')) {
        let rows = [...this.custody_events];
        if (sql.includes('evidence_id = ?') || sql.includes('c.evidence_id = ?')) {
          rows = rows.filter(c => c.evidence_id === parseInt(params[0], 10));
        } else if (sql.includes('case_id = ?') || sql.includes('c.case_id = ?')) {
          rows = rows.filter(c => c.case_id === parseInt(params[0], 10));
        }
        rows.sort((a, b) => new Date(b.transfer_timestamp) - new Date(a.transfer_timestamp));
        return [rows, []];
      }
      
      if (sql.includes('FROM evidence_files')) {
        let rows = [...this.evidence_files];
        if (sql.includes('file_id = ?') || sql.includes('f.file_id = ?')) {
          const fidParam = params.find(p => typeof p === 'number' || (!isNaN(parseInt(p, 10)) && !String(p).startsWith('.')));
          if (fidParam !== undefined) {
            rows = rows.filter(f => f.file_id === parseInt(fidParam, 10));
          }
        }
        if (sql.includes('storage_key = ?') || sql.includes('f.storage_key = ?')) {
          rows = rows.filter(f => f.storage_key === params[0]);
        }
        if (sql.includes('evidence_id = ?') || sql.includes('f.evidence_id = ?')) {
          rows = rows.filter(f => f.evidence_id === parseInt(params[0], 10));
        }
        if (sql.includes('case_id = ?') || sql.includes('f.case_id = ?')) {
          const cid = parseInt(params[0], 10);
          if (!isNaN(cid)) {
            rows = rows.filter(f => f.case_id === cid);
          }
        }
        if (sql.includes('f.file_extension = ?')) {
          const extParam = params.find(p => typeof p === 'string' && p.startsWith('.'));
          if (extParam) {
            rows = rows.filter(f => f.file_extension === extParam);
          }
        }
        if (sql.includes('f.integrity_status = ?')) {
          const statusParam = params.find(p => ['INTACT', 'TAMPERED_MISMATCH', 'FILE_MISSING'].includes(p));
          if (statusParam) {
            rows = rows.filter(f => f.integrity_status === statusParam);
          }
        }
        rows = rows.map(f => {
          const officer = this.officers.find(o => o.officer_id === f.uploaded_by_officer_id);
          const ev = this.evidence.find(e => e.evidence_id === f.evidence_id);
          return {
            ...f,
            tracking_code: ev?.tracking_code || 'EVD-2026-001',
            evidence_title: ev?.title || 'Case Evidence',
            evidence_category: ev?.category || 'DIGITAL',
            uploaded_by_officer_name: officer?.full_name || 'Det. Alexander Cross',
            uploaded_by_badge: officer?.badge_number || 'DET-8841'
          };
        });
        if (sql.includes('ORDER BY upload_timestamp DESC') || sql.includes('ORDER BY f.upload_timestamp DESC')) {
          rows.sort((a, b) => new Date(b.upload_timestamp) - new Date(a.upload_timestamp));
        }
        return [rows, []];
      }
      if (sql.includes('FROM evidence_metadata_extractions')) {
        let rows = [...this.metadata_extractions];
        if (sql.includes('extraction_id = ?') || sql.includes('m.extraction_id = ?')) {
          rows = rows.filter(m => m.extraction_id === parseInt(params[0], 10));
        } else if (sql.includes('file_id = ?') || sql.includes('m.file_id = ?')) {
          rows = rows.filter(m => m.file_id === parseInt(params[0], 10));
        } else if (sql.includes('evidence_id = ?') || sql.includes('m.evidence_id = ?')) {
          rows = rows.filter(m => m.evidence_id === parseInt(params[0], 10));
        } else if (sql.includes('case_id = ?') || sql.includes('m.case_id = ?')) {
          rows = rows.filter(m => m.case_id === parseInt(params[0], 10));
        }
        return [rows, []];
      }
      if (sql.includes('FROM evidence_derived_artifacts')) {
        let rows = [...this.derived_artifacts];
        if (sql.includes('artifact_id = ?') || sql.includes('d.artifact_id = ?')) {
          rows = rows.filter(d => d.artifact_id === parseInt(params[0], 10));
        } else if (sql.includes('parent_file_id = ?') || sql.includes('d.parent_file_id = ?')) {
          rows = rows.filter(d => d.parent_file_id === parseInt(params[0], 10));
        } else if (sql.includes('evidence_id = ?') || sql.includes('d.evidence_id = ?')) {
          rows = rows.filter(d => d.evidence_id === parseInt(params[0], 10));
        } else if (sql.includes('case_id = ?') || sql.includes('d.case_id = ?')) {
          rows = rows.filter(d => d.case_id === parseInt(params[0], 10));
        }
        return [rows, []];
      }
      if (sql.includes('FROM evidence_geospatial')) {
        let rows = [...this.evidence_geospatial];
        if (sql.includes('geospatial_id = ?') || sql.includes('g.geospatial_id = ?')) {
          rows = rows.filter(g => g.geospatial_id === parseInt(params[0], 10));
        } else if (sql.includes('evidence_id = ?') || sql.includes('g.evidence_id = ?')) {
          rows = rows.filter(g => g.evidence_id === parseInt(params[0], 10));
        } else if (sql.includes('case_id = ?') || sql.includes('g.case_id = ?')) {
          rows = rows.filter(g => g.case_id === parseInt(params[0], 10));
        }
        if (sql.includes('JOIN evidence') || sql.includes('join evidence')) {
          rows = rows.map(g => {
            const ev = this.evidence.find(e => e.evidence_id === g.evidence_id);
            return {
              ...g,
              evidence_title: ev?.title || 'Unknown Evidence',
              evidence_tracking_code: ev?.tracking_code || 'N/A',
              evidence_category: ev?.category || 'EVIDENCE',
              integrity_status: ev?.integrity_status || 'INTACT'
            };
          });
        }
        return [rows, []];
      }
      if (sql.includes('FROM evidence_integrity_verifications')) {
        let rows = [...this.integrity_verifications];
        if (sql.includes('evidence_id = ?') || sql.includes('v.evidence_id = ?')) {
          rows = rows.filter(v => v.evidence_id === parseInt(params[0], 10));
        } else if (sql.includes('case_id = ?') || sql.includes('v.case_id = ?')) {
          rows = rows.filter(v => v.case_id === parseInt(params[0], 10));
        }
        rows.sort((a, b) => new Date(b.verified_at) - new Date(a.verified_at));
        return [rows, []];
      }
      if (sql.includes('FROM evidence_audit_logs')) {
        let rows = [...this.audit_logs];
        if (sql.includes('evidence_id = ?') || sql.includes('a.evidence_id = ?')) {
          rows = rows.filter(a => a.evidence_id === parseInt(params[0], 10));
        } else if (sql.includes('case_id = ?') || sql.includes('a.case_id = ?')) {
          rows = rows.filter(a => a.case_id === parseInt(params[0], 10));
        }
        if (sql.includes('ORDER BY created_at ASC') || sql.includes('ORDER BY a.created_at ASC') || sql.includes('ORDER BY audit_id ASC')) {
          rows.sort((a, b) => a.audit_id - b.audit_id);
        } else {
          rows.sort((a, b) => b.audit_id - a.audit_id);
        }
        return [rows, []];
      }
      if (sql.includes('FROM evidence_relationships')) {
        return [this.relationships.filter(r => r.case_id === parseInt(params[0], 10)), []];
      }
      if (!sql.includes('FROM evidence_audit_logs') && !sql.includes('FROM evidence_relationships') && sql.includes('FROM evidence') && (sql.includes('tracking_code = ?') || sql.includes('tracking_code=?'))) {
        return [this.evidence.filter(e => e.tracking_code === params[0]), []];
      }
      if (!sql.includes('FROM evidence_audit_logs') && !sql.includes('FROM evidence_relationships') && sql.includes('FROM evidence') && (sql.includes('evidence_id = ?') || sql.includes('e.evidence_id = ?'))) {
        return [this.evidence.filter(e => e.evidence_id === parseInt(params[0], 10)), []];
      }
      if (!sql.includes('FROM evidence_audit_logs') && !sql.includes('FROM evidence_relationships') && sql.includes('FROM evidence') && (sql.includes('case_id = ?') || sql.includes('e.case_id = ?')) && !sql.includes('LIKE')) {
        return [this.evidence.filter(e => e.case_id === parseInt(params[0], 10) && !e.is_archived), []];
      }
      if (sql.includes('FROM investigation_timelines') && (sql.includes('case_id = ?') || sql.includes('t.case_id = ?'))) {
        const items = this.timelines.filter(t => t.case_id === parseInt(params[0], 10));
        return [items.sort((a, b) => new Date(a.event_timestamp) - new Date(b.event_timestamp)), []];
      }
      if (sql.includes('FROM investigation_leads') && (sql.includes('lead_id = ?') || sql.includes('l.lead_id = ?'))) {
        return [this.leads.filter(l => l.lead_id === parseInt(params[0], 10)), []];
      }
      if (sql.includes('FROM investigation_leads') && sql.includes('title = ?')) {
        return [this.leads.filter(l => l.case_id === parseInt(params[0], 10) && l.title === params[1]), []];
      }
      if (sql.includes('FROM investigation_leads') && (sql.includes('case_id = ?') || sql.includes('l.case_id = ?'))) {
        return [this.leads.filter(l => l.case_id === parseInt(params[0], 10)), []];
      }
      if (sql.includes('FROM evidence_audit_logs') && (sql.includes('evidence_id = ?') || sql.includes('a.evidence_id = ?'))) {
        const evId = parseInt(params[0], 10);
        const matches = this.audit_logs.filter(a => a.evidence_id === evId);
        return [matches.slice().reverse(), []];
      }
      if (sql.includes('FROM evidence') && sql.includes('LIKE')) {
        const likeParam = params.find(p => typeof p === 'string' && p.startsWith('%') && p.endsWith('%'));
        const queryTerm = likeParam ? likeParam.replace(/%/g, '').toLowerCase() : '';
        const catParam = params.find(p => ['CCTV', 'PHONE_RECORD', 'VEHICLE', 'PHYSICAL', 'DIGITAL', 'FORENSIC_BIO', 'DOCUMENT', 'LOCATION', 'FINANCIAL', 'WEAPON', 'TESTIMONY_TRANSCRIPT'].includes(p));

        const matches = this.evidence.filter(e => {
          if (e.is_archived) return false;
          if (catParam && e.category !== catParam) return false;
          if (!queryTerm) return true;
          return (
            (e.title && e.title.toLowerCase().includes(queryTerm)) || 
            (e.description && e.description.toLowerCase().includes(queryTerm)) ||
            (e.tracking_code && e.tracking_code.toLowerCase().includes(queryTerm)) ||
            (e.source && e.source.toLowerCase().includes(queryTerm))
          );
        });
        return [matches, []];
      }

      // --- Phase 10: Case Members ---
      if (sql.includes('FROM case_members') || sql.includes('FROM CASE_MEMBERS')) {
        let members = [...this.case_members];
        if (sql.includes('member_id = ?')) {
          const idx = sql.split('?').findIndex(chunk => chunk.includes('member_id ='));
          const memId = parseInt(params[idx], 10);
          members = members.filter(m => m.member_id === memId);
        }
        if (sql.includes('cm.case_id = ?') || sql.includes('case_id = ?')) {
          const idx = sql.split('?').findIndex(chunk => chunk.includes('case_id =') || chunk.includes('cm.case_id ='));
          const caseId = parseInt(params[idx], 10);
          members = members.filter(m => m.case_id === caseId);
        }
        if (sql.includes('officer_id = ?') || sql.includes('cm.officer_id = ?')) {
          const idx = sql.split('?').findIndex(chunk => chunk.includes('officer_id =') || chunk.includes('cm.officer_id ='));
          const offId = parseInt(params[idx], 10);
          members = members.filter(m => m.officer_id === offId);
        }
        if (sql.includes('is_active = 1') || sql.includes('is_active = TRUE')) {
          members = members.filter(m => m.is_active === 1 || m.is_active === true);
        }
        // join with officers
        const enriched = members.map(m => {
          const off = this.officers.find(o => o.officer_id === m.officer_id);
          return {
            ...m,
            full_name: off ? off.full_name : 'Unknown Officer',
            badge_number: off ? off.badge_number : 'UNKNOWN',
            rank_designation: off ? off.rank_designation : 'Investigator',
            department: off ? off.department : 'Major Crimes',
            email: off ? off.email : ''
          };
        });
        return [enriched, []];
      }

      // --- Phase 10: Investigation Tasks ---
      if (sql.includes('FROM investigation_tasks') || sql.includes('FROM INVESTIGATION_TASKS')) {
        let tasks = [...this.investigation_tasks];
        if (sql.includes('task_id = ?') || sql.includes('t.task_id = ?')) {
          const tId = parseInt(params[0], 10);
          tasks = tasks.filter(t => t.task_id === tId);
        } else if (sql.includes('case_id = ?') || sql.includes('t.case_id = ?')) {
          const caseId = parseInt(params[0], 10);
          tasks = tasks.filter(t => t.case_id === caseId);
        }
        if (sql.includes('assigned_officer_id = ?')) {
          const offId = parseInt(params.find((p, idx) => sql.split('?')[idx]?.includes('assigned_officer_id')), 10);
          if (!isNaN(offId)) tasks = tasks.filter(t => t.assigned_officer_id === offId);
        }
        if (sql.includes('status = ?')) {
          const stParam = params.find(p => ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'UNDER_REVIEW', 'COMPLETED', 'BLOCKED', 'CANCELLED'].includes(p));
          if (stParam) tasks = tasks.filter(t => t.status === stParam);
        }
        if (sql.includes('priority = ?')) {
          const prioParam = params.find(p => ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'].includes(p));
          if (prioParam) tasks = tasks.filter(t => t.priority === prioParam);
        }
        const enriched = tasks.map(t => {
          const assigned = this.officers.find(o => o.officer_id === t.assigned_officer_id);
          const creator = this.officers.find(o => o.officer_id === t.created_by_officer_id);
          return {
            ...t,
            assigned_officer_name: assigned ? assigned.full_name : null,
            assigned_officer_badge: assigned ? assigned.badge_number : null,
            created_by_officer_name: creator ? creator.full_name : null,
            created_by_officer_badge: creator ? creator.badge_number : null
          };
        });
        return [enriched, []];
      }

      // --- Phase 10: Task Notes ---
      if (sql.includes('FROM investigation_task_notes')) {
        let notes = [...this.investigation_task_notes];
        if (sql.includes('task_id = ?') || sql.includes('n.task_id = ?')) {
          const tId = parseInt(params[0], 10);
          notes = notes.filter(n => n.task_id === tId);
        }
        const enriched = notes.map(n => {
          const author = this.officers.find(o => o.officer_id === n.officer_id);
          return {
            ...n,
            author_name: author ? author.full_name : 'Unknown Officer',
            author_badge: author ? author.badge_number : 'UNKNOWN'
          };
        });
        return [enriched, []];
      }

      // --- Phase 10: Task Dependencies ---
      if (sql.includes('FROM investigation_task_dependencies')) {
        let deps = [...this.investigation_task_dependencies];
        if (sql.includes('d.task_id = ?') || sql.includes('task_id = ?')) {
          const tId = parseInt(params[0], 10);
          deps = deps.filter(d => d.task_id === tId);
        }
        if (sql.includes('depends_on_task_id = ?')) {
          const pId = parseInt(params[0], 10);
          deps = deps.filter(d => d.depends_on_task_id === pId);
        }
        const enriched = deps.map(d => {
          const prereqTask = this.investigation_tasks.find(t => t.task_id === d.depends_on_task_id);
          return {
            ...d,
            depends_on_task_title: prereqTask ? prereqTask.title : 'Prerequisite Task',
            depends_on_task_status: prereqTask ? prereqTask.status : 'UNKNOWN',
            depends_on_task_priority: prereqTask ? prereqTask.priority : 'NORMAL',
            title: prereqTask ? prereqTask.title : 'Prerequisite Task',
            status: prereqTask ? prereqTask.status : 'UNKNOWN',
            priority: prereqTask ? prereqTask.priority : 'NORMAL'
          };
        });
        return [enriched, []];
      }

      // --- Phase 10: Evidence Reviews ---
      if (sql.includes('FROM evidence_reviews')) {
        let reviews = [...this.evidence_reviews];
        if (sql.includes('r.review_id = ?') || sql.includes('review_id = ?')) {
          const rId = parseInt(params[0], 10);
          reviews = reviews.filter(r => r.review_id === rId);
        } else if (sql.includes('r.case_id = ?') || sql.includes('case_id = ?')) {
          const caseId = parseInt(params[0], 10);
          reviews = reviews.filter(r => r.case_id === caseId);
        }
        if (sql.includes('evidence_id = ?')) {
          const eId = parseInt(params.find((p, idx) => sql.split('?')[idx]?.includes('evidence_id')), 10);
          if (!isNaN(eId)) reviews = reviews.filter(r => r.evidence_id === eId);
        }
        const enriched = reviews.map(r => {
          const ev = this.evidence.find(e => e.evidence_id === r.evidence_id);
          const reviewer = this.officers.find(o => o.officer_id === r.assigned_reviewer_id);
          return {
            ...r,
            tracking_code: ev ? ev.tracking_code : 'EVD-UNKNOWN',
            evidence_title: ev ? ev.title : 'Evidence Item',
            evidence_category: ev ? ev.category : 'PHYSICAL',
            reviewer_name: reviewer ? reviewer.full_name : 'Unknown Reviewer',
            reviewer_badge: reviewer ? reviewer.badge_number : 'UNKNOWN'
          };
        });
        return [enriched, []];
      }

      // --- Phase 10: Case Activity Logs ---
      if (sql.includes('FROM case_activity_logs')) {
        let logs = [...this.case_activity_logs];
        if (sql.includes('case_id = ?') || sql.includes('a.case_id = ?')) {
          const caseId = parseInt(params[0], 10);
          logs = logs.filter(l => l.case_id === caseId);
        }
        if (sql.includes('actor_id = ?')) {
          const actorId = parseInt(params.find((p, idx) => sql.split('?')[idx]?.includes('actor_id')), 10);
          if (!isNaN(actorId)) logs = logs.filter(l => l.actor_id === actorId);
        }
        if (sql.includes('event_type = ?')) {
          const evt = params.find(p => typeof p === 'string' && (p.startsWith('OFFICER_') || p.startsWith('TASK_') || p.startsWith('EVIDENCE_') || p.startsWith('CASE_') || p === 'INVESTIGATION_NOTE_ADDED' || p === 'LEAD_UPDATED'));
          if (evt) logs = logs.filter(l => l.event_type === evt);
        }
        logs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        const enriched = logs.map(l => {
          const actor = this.officers.find(o => o.officer_id === l.actor_id);
          return {
            ...l,
            actor_name: actor ? actor.full_name : 'System Actor',
            actor_badge: actor ? actor.badge_number : 'SYSTEM'
          };
        });
        return [enriched, []];
      }

      // --- Phase 10: Officer Notifications ---
      if (sql.includes('FROM officer_notifications')) {
        let notifs = [...this.officer_notifications];
        if (sql.includes('officer_id = ?')) {
          const offId = parseInt(params[0], 10);
          notifs = notifs.filter(n => n.officer_id === offId);
        }
        if (sql.includes('is_read = 0') || sql.includes('is_read = FALSE') || sql.includes('is_read = ?')) {
          if (sql.includes('is_read = ?')) {
            const isReadVal = params.find((p, idx) => sql.split('?')[idx]?.includes('is_read'));
            notifs = notifs.filter(n => n.is_read == isReadVal);
          } else {
            notifs = notifs.filter(n => n.is_read === 0 || n.is_read === false);
          }
        }
        if (sql.includes('COUNT(*)')) {
          return [[{ unread_count: notifs.length }], []];
        }
        notifs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        return [notifs, []];
      }
      return [[], []];
    }

    // 2. INSERT queries
    if (trimmed.startsWith('INSERT INTO CASE_MEMBERS')) {
      const newId = this.case_members.length + 1;
      const member = {
        member_id: newId,
        case_id: parseInt(params[0], 10),
        officer_id: parseInt(params[1], 10),
        role: params[2] || 'INVESTIGATING_OFFICER',
        assigned_by_officer_id: parseInt(params[3], 10),
        is_active: 1,
        permissions: params[4] || null,
        assigned_at: new Date().toISOString(),
        revoked_at: null,
        revoked_by_officer_id: null,
        revocation_reason: null
      };
      this.case_members.push(member);
      return [{ insertId: newId, affectedRows: 1 }, []];
    }

    if (trimmed.startsWith('INSERT INTO INVESTIGATION_TASKS')) {
      const newId = this.investigation_tasks.length + 1;
      const task = {
        task_id: newId,
        case_id: parseInt(params[0], 10),
        title: params[1],
        description: params[2] || '',
        assigned_officer_id: params[3] !== undefined && params[3] !== null ? parseInt(params[3], 10) : null,
        created_by_officer_id: parseInt(params[4], 10),
        priority: params[5] || 'NORMAL',
        status: params[6] || 'OPEN',
        due_date: params[7] || null,
        completed_at: null,
        related_evidence_ids: params[8] ? (typeof params[8] === 'string' ? JSON.parse(params[8]) : params[8]) : [],
        related_entity_ids: params[9] ? (typeof params[9] === 'string' ? JSON.parse(params[9]) : params[9]) : [],
        related_lead_id: params[10] ? parseInt(params[10], 10) : null,
        completion_notes: null,
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      this.investigation_tasks.push(task);
      return [{ insertId: newId, affectedRows: 1 }, []];
    }

    if (trimmed.startsWith('INSERT INTO INVESTIGATION_TASK_NOTES')) {
      const newId = this.investigation_task_notes.length + 1;
      const note = {
        note_id: newId,
        task_id: parseInt(params[0], 10),
        case_id: parseInt(params[1], 10),
        officer_id: parseInt(params[2], 10),
        note_text: params[3],
        created_at: new Date().toISOString()
      };
      this.investigation_task_notes.push(note);
      return [{ insertId: newId, affectedRows: 1 }, []];
    }

    if (trimmed.startsWith('INSERT INTO INVESTIGATION_TASK_DEPENDENCIES')) {
      const newId = this.investigation_task_dependencies.length + 1;
      const dep = {
        dependency_id: newId,
        task_id: parseInt(params[0], 10),
        depends_on_task_id: parseInt(params[1], 10),
        created_by_officer_id: parseInt(params[2], 10),
        created_at: new Date().toISOString()
      };
      this.investigation_task_dependencies.push(dep);
      return [{ insertId: newId, affectedRows: 1 }, []];
    }

    if (trimmed.startsWith('INSERT INTO EVIDENCE_REVIEWS')) {
      const newId = this.evidence_reviews.length + 1;
      const rev = {
        review_id: newId,
        evidence_id: parseInt(params[0], 10),
        case_id: parseInt(params[1], 10),
        assigned_reviewer_id: parseInt(params[2], 10),
        created_by_officer_id: parseInt(params[3], 10),
        review_status: params[4] || 'PENDING_REVIEW',
        reviewer_observations: params[5] || null,
        integrity_verification_status: params[6] || 'UNCHECKED',
        metadata_review_status: params[7] || 'NOT_APPLICABLE',
        review_notes: params[8] || null,
        related_task_id: params[9] ? parseInt(params[9], 10) : null,
        reviewed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      this.evidence_reviews.push(rev);
      return [{ insertId: newId, affectedRows: 1 }, []];
    }

    if (trimmed.startsWith('INSERT INTO CASE_ACTIVITY_LOGS')) {
      const newId = this.case_activity_logs.length + 1;
      const log = {
        activity_id: newId,
        case_id: parseInt(params[0], 10),
        actor_id: parseInt(params[1], 10),
        event_type: params[2],
        related_record_id: params[3] ? String(params[3]) : null,
        previous_state: params[4] ? (typeof params[4] === 'string' ? JSON.parse(params[4]) : params[4]) : null,
        new_state: params[5] ? (typeof params[5] === 'string' ? JSON.parse(params[5]) : params[5]) : null,
        event_description: params[6],
        created_at: new Date().toISOString()
      };
      this.case_activity_logs.push(log);
      return [{ insertId: newId, affectedRows: 1 }, []];
    }

    if (trimmed.startsWith('INSERT INTO OFFICER_NOTIFICATIONS')) {
      const dedupKey = params[params.length - 1];
      if (dedupKey && typeof dedupKey === 'string' && dedupKey.includes(':')) {
        const existing = this.officer_notifications.find(n => n.dedup_key === dedupKey);
        if (existing) {
          existing.created_at = new Date().toISOString();
          return [{ insertId: existing.notification_id, affectedRows: 1 }, []];
        }
      }
      const newId = this.officer_notifications.length + 1;
      const notif = {
        notification_id: newId,
        officer_id: parseInt(params[0], 10),
        case_id: params[1] ? parseInt(params[1], 10) : null,
        event_type: params[2],
        title: params[3],
        message: params[4],
        reference_type: params[5] || null,
        reference_id: params[6] ? String(params[6]) : null,
        is_read: 0,
        read_at: null,
        dedup_key: params[7] || null,
        created_at: new Date().toISOString()
      };
      this.officer_notifications.push(notif);
      return [{ insertId: newId, affectedRows: 1 }, []];
    }

    if (trimmed.startsWith('INSERT INTO OFFICERS')) {
      const newId = this.officers.length + 1;
      const officer = {
        officer_id: newId,
        badge_number: params[0],
        full_name: params[1],
        email: params[2],
        password_hash: params[3],
        department: params[4],
        rank_designation: params[5],
        role: params[6] || 'INVESTIGATOR',
        is_active: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      this.officers.push(officer);
      return [{ insertId: newId, affectedRows: 1 }, []];
    }

    if (trimmed.startsWith('INSERT INTO CASES')) {
      const newId = this.cases.length + 1;
      const newCase = {
        case_id: newId,
        case_number: params[0],
        title: params[1],
        description: params[2] || '',
        incident_date: params[3],
        incident_location: params[4],
        lead_officer_id: params[5],
        priority: params[6] || 'MEDIUM',
        status: 'OPEN',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      this.cases.push(newCase);
      return [{ insertId: newId, affectedRows: 1 }, []];
    }

    if (trimmed.startsWith('INSERT INTO SUSPECTS')) {
      const newId = this.suspects.length + 1;
      const s = {
        suspect_id: newId,
        case_id: params[0],
        full_name: params[1],
        alias: params[2] || null,
        age: params[3] || null,
        gender: params[4] || 'UNKNOWN',
        phone_number: params[5] || null,
        identifying_features: params[6] || null,
        last_known_address: params[7] || null,
        status: params[8] || 'PERSON_OF_INTEREST',
        notes: params[9] || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      this.suspects.push(s);
      return [{ insertId: newId, affectedRows: 1 }, []];
    }

    if (trimmed.startsWith('INSERT INTO VICTIMS')) {
      const newId = this.victims.length + 1;
      const v = {
        victim_id: newId,
        case_id: params[0],
        full_name: params[1],
        age: params[2] || null,
        gender: params[3] || 'UNKNOWN',
        contact_info: params[4] || null,
        residence_address: params[5] || null,
        condition_status: params[6] || 'SAFE',
        statement: params[7] || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      this.victims.push(v);
      return [{ insertId: newId, affectedRows: 1 }, []];
    }

    if (trimmed.startsWith('INSERT INTO WITNESSES')) {
      const newId = this.witnesses.length + 1;
      const w = {
        witness_id: newId,
        case_id: params[0],
        full_name: params[1],
        contact_phone: params[2] || null,
        statement: params[3],
        credibility_score: params[4] !== undefined ? params[4] : 0.80,
        statement_timestamp: params[5] || null,
        statement_location: params[6] || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      this.witnesses.push(w);
      return [{ insertId: newId, affectedRows: 1 }, []];
    }

    if (trimmed.startsWith('INSERT INTO EVIDENCE_VERSIONS')) {
      const newId = this.evidence_versions.length + 1;
      const ver = {
        version_id: newId,
        evidence_id: parseInt(params[0], 10),
        case_id: parseInt(params[1], 10),
        version_number: parseInt(params[2], 10),
        title: params[3],
        category: params[4],
        description: params[5],
        collection_location: params[6] || null,
        collected_at: params[7] || null,
        source: params[8],
        verification_status: params[9],
        reliability_assessment: params[10],
        content_payload: params[11] || null,
        metadata_json: params[12] || null,
        version_fingerprint: params[13],
        fingerprint_type: params[14] || 'METADATA_CANONICAL',
        modified_by_officer_id: parseInt(params[15], 10),
        reason_for_modification: params[16] || 'Version snapshot',
        created_at: new Date().toISOString()
      };
      this.evidence_versions.push(ver);
      return [{ insertId: newId, affectedRows: 1 }, []];
    }

    if (trimmed.startsWith('INSERT INTO EVIDENCE_CUSTODY_EVENTS')) {
      const newId = this.custody_events.length + 1;
      const event = {
        custody_event_id: newId,
        evidence_id: parseInt(params[0], 10),
        case_id: parseInt(params[1], 10),
        previous_custodian: params[2],
        new_custodian: params[3],
        transfer_timestamp: params[4] || new Date().toISOString(),
        transfer_reason: params[5],
        transfer_location: params[6],
        transfer_notes: params[7] || null,
        transferring_officer_id: parseInt(params[8], 10),
        verification_status: params[9] || 'VERIFIED',
        related_fingerprint: params[10] || null,
        is_successful: params[11] !== undefined ? (params[11] ? 1 : 0) : 1,
        failure_reason: params[12] || null,
        created_at: new Date().toISOString()
      };
      this.custody_events.push(event);
      return [{ insertId: newId, affectedRows: 1 }, []];
    }

    if (trimmed.startsWith('INSERT INTO EVIDENCE_INTEGRITY_VERIFICATIONS')) {
      const newId = this.integrity_verifications.length + 1;
      const ver = {
        verification_id: newId,
        evidence_id: parseInt(params[0], 10),
        case_id: parseInt(params[1], 10),
        officer_id: parseInt(params[2], 10),
        recalculated_hash: params[3],
        recorded_hash: params[4],
        match_status: params[5],
        fingerprint_type: params[6],
        notes: params[7] || null,
        ip_address: params[8] || '127.0.0.1',
        verified_at: new Date().toISOString()
      };
      this.integrity_verifications.push(ver);
      return [{ insertId: newId, affectedRows: 1 }, []];
    }

    
    if (trimmed.startsWith('INSERT INTO EVIDENCE_FILES')) {
      const newId = this.evidence_files.length + 1;
      const fileRecord = {
        file_id: newId,
        evidence_id: parseInt(params[0], 10),
        case_id: parseInt(params[1], 10),
        storage_key: params[2],
        storage_path: params[3],
        original_filename: params[4],
        sanitized_filename: params[5],
        file_extension: params[6],
        mime_type: params[7],
        detected_mime_type: params[8] || params[7],
        file_size_bytes: parseInt(params[9], 10),
        sha256_hash: params[10],
        hash_algorithm: params[11] || 'SHA-256',
        is_primary: params[12] !== undefined ? (params[12] ? 1 : 0) : 1,
        uploaded_by_officer_id: parseInt(params[13], 10),
        upload_timestamp: new Date().toISOString(),
        integrity_status: params[14] || 'INTACT',
        last_verified_at: new Date().toISOString()
      };
      this.evidence_files.push(fileRecord);
      return [{ insertId: newId, affectedRows: 1 }, []];
    }

    if (trimmed.startsWith('INSERT INTO EVIDENCE_METADATA_EXTRACTIONS')) {
      const newId = this.metadata_extractions.length + 1;
      const extraction = {
        extraction_id: newId,
        file_id: parseInt(params[0], 10),
        evidence_id: parseInt(params[1], 10),
        case_id: parseInt(params[2], 10),
        file_format: params[3],
        extractor_tool: params[4],
        extractor_version: params[5],
        extraction_status: params[6] || 'SUCCESS',
        extracted_metadata_json: typeof params[7] === 'object' ? JSON.stringify(params[7]) : params[7],
        extracted_timestamp: params[8] || null,
        extracted_gps_lat: params[9] !== undefined ? params[9] : null,
        extracted_gps_lon: params[10] !== undefined ? params[10] : null,
        officer_reviewed: params[11] ? 1 : 0,
        review_notes: params[12] || null,
        created_at: new Date().toISOString()
      };
      this.metadata_extractions.push(extraction);
      return [{ insertId: newId, affectedRows: 1 }, []];
    }

    if (trimmed.startsWith('INSERT INTO EVIDENCE_DERIVED_ARTIFACTS')) {
      const newId = this.derived_artifacts.length + 1;
      const artifact = {
        artifact_id: newId,
        parent_file_id: parseInt(params[0], 10),
        evidence_id: parseInt(params[1], 10),
        case_id: parseInt(params[2], 10),
        artifact_type: params[3],
        storage_key: params[4],
        storage_path: params[5],
        mime_type: params[6],
        file_size_bytes: parseInt(params[7], 10),
        sha256_hash: params[8],
        generator_tool: params[9],
        generator_version: params[10],
        transformation_summary: params[11] || null,
        created_by_officer_id: parseInt(params[12], 10),
        created_at: new Date().toISOString()
      };
      this.derived_artifacts.push(artifact);
      return [{ insertId: newId, affectedRows: 1 }, []];
    }

    if (trimmed.startsWith('INSERT INTO EVIDENCE_GEOSPATIAL')) {
      const newId = this.evidence_geospatial.length + 1;
      const geo = {
        geospatial_id: newId,
        evidence_id: parseInt(params[0], 10),
        case_id: parseInt(params[1], 10),
        entity_type: params[2] || 'EVIDENCE',
        entity_id: params[3] !== undefined && params[3] !== null ? parseInt(params[3], 10) : null,
        latitude: parseFloat(params[4]),
        longitude: parseFloat(params[5]),
        altitude: params[6] !== undefined && params[6] !== null ? parseFloat(params[6]) : null,
        accuracy_meters: params[7] !== undefined && params[7] !== null ? parseFloat(params[7]) : null,
        coordinate_reference_system: params[8] || 'WGS84',
        location_source: params[9] || 'OFFICER_ENTERED',
        location_name: params[10] || null,
        recorded_timestamp: params[11] || new Date().toISOString(),
        timezone_offset: params[12] || '+00:00',
        extraction_source: params[13] || 'Manual Detective Entry',
        verification_status: params[14] || 'UNVERIFIED_OBSERVATION',
        officer_reviewed: params[15] ? 1 : 0,
        reviewed_by_officer_id: params[16] || null,
        review_notes: params[17] || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      this.evidence_geospatial.push(geo);
      return [{ insertId: newId, affectedRows: 1 }, []];
    }
    if (trimmed.startsWith('INSERT INTO EVIDENCE_AUDIT_LOGS')) {
      const newId = this.audit_logs.length + 1;
      if (sql.includes('previous_event_hash')) {
        this.audit_logs.push({
          audit_id: newId,
          evidence_id: parseInt(params[0], 10),
          case_id: parseInt(params[1], 10),
          officer_id: parseInt(params[2], 10),
          action_type: params[3],
          previous_state: params[4],
          new_state: params[5],
          previous_state_hash: params[6] || null,
          current_state_hash: params[7] || null,
          previous_event_hash: params[8] || 'GENESIS_0000000000000000000000000000000000000000000000000000000000000000',
          current_event_hash: params[9] || '',
          canonical_payload: params[10] || null,
          reason_for_change: params[11] || 'Audit record',
          ip_address: params[12] || '127.0.0.1',
          created_at: params[13] || new Date().toISOString()
        });
      } else {
        const isCreated = sql.includes("'CREATED'");
        this.audit_logs.push({
          audit_id: newId,
          evidence_id: parseInt(params[0], 10),
          case_id: parseInt(params[1], 10),
          officer_id: parseInt(params[2], 10),
          action_type: isCreated ? 'CREATED' : 'METADATA_UPDATED',
          previous_state: isCreated ? null : params[3],
          new_state: isCreated ? params[3] : params[4],
          previous_state_hash: null,
          current_state_hash: null,
          previous_event_hash: 'GENESIS_0000000000000000000000000000000000000000000000000000000000000000',
          current_event_hash: 'f1a238479e0811e5f84d284792a5436d8594b29c91b10a4e76c3746682bc85c1',
          canonical_payload: null,
          reason_for_change: isCreated ? 'Initial forensic evidence ingestion' : (params[5] || 'Routine update'),
          ip_address: isCreated ? params[4] : params[6],
          created_at: new Date().toISOString()
        });
      }
      return [{ insertId: newId, affectedRows: 1 }, []];
    }

    if (trimmed.startsWith('INSERT INTO EVIDENCE_RELATIONSHIPS')) {
      const newId = this.relationships.length + 1;
      this.relationships.push({
        relationship_id: newId,
        case_id: params[0],
        source_type: params[1],
        source_id: params[2],
        target_type: params[3],
        target_id: params[4],
        relation_type: params[5],
        confidence_weight: params[6] !== undefined ? params[6] : 0.50,
        relationship_nature: params[7] || 'UNVERIFIED_OBSERVATION',
        notes: params[8] || null,
        discovered_by: params[9] || 'OFFICER_MANUAL',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      return [{ insertId: newId, affectedRows: 1 }, []];
    }

    if (trimmed.startsWith('INSERT INTO EVIDENCE ') || trimmed.startsWith('INSERT INTO EVIDENCE(')) {
      const newId = this.evidence.length + 1;
      const ev = {
        evidence_id: newId,
        case_id: parseInt(params[0], 10),
        tracking_code: params[1],
        title: params[2],
        category: params[3],
        description: params[4],
        collection_location: params[5] || null,
        collected_at: params[6] || null,
        source: params[7],
        related_entity_ids: params[8] || null,
        verification_status: params[9] || 'UNVERIFIED_OBSERVATION',
        reliability_assessment: params[10] || 'MEDIUM',
        file_reference: params[11] || null,
        entered_by_officer_id: parseInt(params[12], 10),
        chain_of_custody_notes: params[13] || null,
        metadata_json: params[14] || null,
        content_payload: params[15] !== undefined ? params[15] : null,
        sha256_fingerprint: params[16] || null,
        fingerprint_algorithm: params[17] || 'SHA-256',
        fingerprint_type: params[18] || 'METADATA_CANONICAL',
        fingerprinted_at: params[19] || new Date().toISOString(),
        integrity_status: params[20] || 'PENDING_VERIFICATION',
        current_version: params[21] ? parseInt(params[21], 10) : 1,
        is_archived: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      this.evidence.push(ev);
      return [{ insertId: newId, affectedRows: 1 }, []];
    }

    if (trimmed.startsWith('INSERT INTO INVESTIGATION_TIMELINES')) {
      const newId = this.timelines.length + 1;
      this.timelines.push({
        timeline_id: newId,
        case_id: params[0],
        event_timestamp: params[1],
        event_title: params[2],
        event_description: params[3] || null,
        entity_type: params[4],
        entity_id: params[5],
        location: params[6] || null,
        source_evidence_id: params[7] || null,
        status: params[8] || 'UNVERIFIED_OBSERVATION',
        is_verified: params[9] ? 1 : 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      return [{ insertId: newId, affectedRows: 1 }, []];
    }

    if (trimmed.startsWith('INSERT INTO INVESTIGATION_LEADS')) {
      const newId = this.leads.length + 1;
      this.leads.push({
        lead_id: newId,
        case_id: params[0],
        title: params[1],
        hypothesis: params[2],
        recommended_action: params[3],
        lead_status: params[4] || 'OPEN',
        priority_score: params[5] !== undefined ? params[5] : 50.00,
        assigned_officer_id: params[6] || null,
        source_gap_type: params[7] || 'MANUAL_DETECTIVE_ENTRY',
        generated_by: params[8] || 'OFFICER_MANUAL',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      return [{ insertId: newId, affectedRows: 1 }, []];
    }

    // 3. UPDATE queries
    if (trimmed.startsWith('UPDATE CASES')) {
      const caseId = parseInt(params[params.length - 1], 10);
      const c = this.cases.find(item => item.case_id === caseId);
      if (c) {
        if (sql.includes('status = ?')) {
          c.status = params[0];
        } else {
          c.title = params[0];
          c.description = params[1];
          c.incident_location = params[2];
          c.priority = params[3];
        }
        c.updated_at = new Date().toISOString();
        return [{ affectedRows: 1 }, []];
      }
      return [{ affectedRows: 0 }, []];
    }

    if (trimmed.startsWith('UPDATE EVIDENCE')) {
      const evId = parseInt(params[params.length - 1], 10);
      const ev = this.evidence.find(item => item.evidence_id === evId);
      if (ev) {
        if (sql.includes('is_archived = 1')) {
          ev.is_archived = 1;
        } else if (sql.includes('integrity_status = ?') && sql.includes('last_verified_at = ?') && params.length === 3) {
          ev.integrity_status = params[0];
          ev.last_verified_at = params[1];
        } else {
          ev.title = params[0];
          ev.description = params[1];
          ev.verification_status = params[2];
          ev.reliability_assessment = params[3];
          ev.metadata_json = params[4];
          if (sql.includes('content_payload = ?')) {
            ev.content_payload = params[5];
          }
          if (sql.includes('sha256_fingerprint = ?')) {
            const fpIdx = sql.includes('content_payload = ?') ? 6 : 5;
            ev.sha256_fingerprint = params[fpIdx];
          }
          if (sql.includes('current_version = current_version + 1')) {
            ev.current_version = (ev.current_version || 1) + 1;
          }
        }
        ev.updated_at = new Date().toISOString();
        return [{ affectedRows: 1 }, []];
      }
      return [{ affectedRows: 0 }, []];
    }

    if (trimmed.startsWith('UPDATE INVESTIGATION_LEADS')) {
      const leadId = parseInt(params[params.length - 1], 10);
      const lead = this.leads.find(item => item.lead_id === leadId);
      if (lead) {
        lead.lead_status = params[0];
        lead.updated_at = new Date().toISOString();
        return [{ affectedRows: 1 }, []];
      }
      return [{ affectedRows: 0 }, []];
    }

    if (trimmed.startsWith('UPDATE EVIDENCE_GEOSPATIAL')) {
      const geoId = parseInt(params[params.length - 1], 10);
      const geo = this.evidence_geospatial.find(item => item.geospatial_id === geoId);
      if (geo) {
        if (sql.includes('officer_reviewed = ?')) {
          geo.officer_reviewed = params[0] ? 1 : 0;
          geo.reviewed_by_officer_id = params[1];
          geo.review_notes = params[2];
          if (params[3]) geo.verification_status = params[3];
        }
        geo.updated_at = new Date().toISOString();
        return [{ affectedRows: 1 }, []];
      }
      return [{ affectedRows: 0 }, []];
    }

    if (trimmed.startsWith('UPDATE CASE_MEMBERS')) {
      if (sql.includes('is_active = 0') || sql.includes('is_active = FALSE') || sql.includes('is_active = ?')) {
        const memberId = parseInt(params[params.length - 1], 10);
        const mem = this.case_members.find(m => m.member_id === memberId);
        if (mem) {
          mem.is_active = 0;
          mem.revoked_at = new Date().toISOString();
          mem.revoked_by_officer_id = params[1] || null;
          mem.revocation_reason = params[2] || 'Access revoked';
          return [{ affectedRows: 1 }, []];
        }
      } else {
        const memberId = parseInt(params[params.length - 1], 10);
        const mem = this.case_members.find(m => m.member_id === memberId);
        if (mem) {
          mem.role = params[0];
          if (params[1]) mem.permissions = params[1];
          return [{ affectedRows: 1 }, []];
        }
      }
      return [{ affectedRows: 0 }, []];
    }

    if (trimmed.startsWith('UPDATE INVESTIGATION_TASKS')) {
      const tId = parseInt(params[params.length - (sql.includes('version = ?') ? 2 : 1)], 10);
      const expectedVersion = sql.includes('version = ?') ? parseInt(params[params.length - 1], 10) : null;
      const task = this.investigation_tasks.find(t => t.task_id === tId);
      if (task) {
        if (expectedVersion !== null && task.version !== expectedVersion) {
          return [{ affectedRows: 0 }, []];
        }
        if (sql.includes('status = ?')) {
          const st = params.find(p => ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'UNDER_REVIEW', 'COMPLETED', 'BLOCKED', 'CANCELLED'].includes(p));
          if (st) task.status = st;
        }
        if (sql.includes('assigned_officer_id = ?')) {
          task.assigned_officer_id = params[0] !== undefined && params[0] !== null ? parseInt(params[0], 10) : task.assigned_officer_id;
        }
        if (sql.includes('priority = ?')) {
          const p = params.find(val => ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'].includes(val));
          if (p) task.priority = p;
        }
        if (sql.includes('completed_at = ?') || sql.includes('completed_at = NOW()') || sql.includes('status = ?') && task.status === 'COMPLETED') {
          task.completed_at = new Date().toISOString();
        }
        if (sql.includes('completion_notes = ?')) {
          const noteParam = params.find(p => typeof p === 'string' && p.length > 5 && !['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'UNDER_REVIEW', 'COMPLETED', 'BLOCKED', 'CANCELLED', 'LOW', 'NORMAL', 'HIGH', 'CRITICAL'].includes(p));
          if (noteParam) task.completion_notes = noteParam;
        }
        task.version = (task.version || 1) + 1;
        task.updated_at = new Date().toISOString();
        return [{ affectedRows: 1 }, []];
      }
      return [{ affectedRows: 0 }, []];
    }

    if (trimmed.startsWith('UPDATE EVIDENCE_REVIEWS')) {
      const rId = parseInt(params[params.length - 1], 10);
      const rev = this.evidence_reviews.find(r => r.review_id === rId);
      if (rev) {
        if (sql.includes('review_status = ?')) rev.review_status = params[0];
        if (sql.includes('reviewer_observations = ?')) rev.reviewer_observations = params[1];
        if (sql.includes('integrity_verification_status = ?')) rev.integrity_verification_status = params[2];
        if (sql.includes('metadata_review_status = ?')) rev.metadata_review_status = params[3];
        if (sql.includes('review_notes = ?')) rev.review_notes = params[4];
        rev.reviewed_at = new Date().toISOString();
        rev.updated_at = new Date().toISOString();
        return [{ affectedRows: 1 }, []];
      }
      return [{ affectedRows: 0 }, []];
    }

    if (trimmed.startsWith('UPDATE OFFICER_NOTIFICATIONS')) {
      if (sql.includes('is_read = 1') || sql.includes('is_read = TRUE') || sql.includes('is_read = ?')) {
        if (sql.includes('notification_id = ?')) {
          const nId = parseInt(params[params.length - 1], 10);
          const notif = this.officer_notifications.find(n => n.notification_id === nId);
          if (notif) {
            notif.is_read = 1;
            notif.read_at = new Date().toISOString();
            return [{ affectedRows: 1 }, []];
          }
        } else if (sql.includes('officer_id = ?')) {
          const offId = parseInt(params[params.length - 1], 10);
          this.officer_notifications.forEach(n => {
            if (n.officer_id === offId) {
              n.is_read = 1;
              n.read_at = new Date().toISOString();
            }
          });
          return [{ affectedRows: 1 }, []];
        }
      }
      return [{ affectedRows: 1 }, []];
    }

    if (trimmed.startsWith('UPDATE CASES') && sql.includes('lead_officer_id = ?')) {
      const newLead = parseInt(params[0], 10);
      const caseId = parseInt(params[1], 10);
      const c = this.cases.find(item => item.case_id === caseId);
      if (c) {
        c.lead_officer_id = newLead;
        c.updated_at = new Date().toISOString();
        return [{ affectedRows: 1 }, []];
      }
    }

    if (trimmed.startsWith('DELETE FROM CASE_MEMBERS')) {
      const memberId = parseInt(params[0], 10);
      const idx = this.case_members.findIndex(m => m.member_id === memberId);
      if (idx !== -1) {
        this.case_members.splice(idx, 1);
        return [{ affectedRows: 1 }, []];
      }
      return [{ affectedRows: 0 }, []];
    }

    if (trimmed.startsWith('DELETE FROM INVESTIGATION_TASK_DEPENDENCIES')) {
      const depId = parseInt(params[0], 10);
      const idx = this.investigation_task_dependencies.findIndex(d => d.dependency_id === depId);
      if (idx !== -1) {
        this.investigation_task_dependencies.splice(idx, 1);
        return [{ affectedRows: 1 }, []];
      }
      return [{ affectedRows: 0 }, []];
    }

    return [{ affectedRows: 1 }, []];
  }
}

const memoryStore = new MemoryStore();

module.exports = {
  pool,
  execute,
  query,
  withTransaction,
  testConnection,
  memoryStore,
  isMemoryStoreAllowed
};

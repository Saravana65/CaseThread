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
        const rows = this.cases.map(c => {
          const lead = this.officers.find(o => o.officer_id === c.lead_officer_id);
          const evCount = this.evidence.filter(e => e.case_id === c.case_id).length;
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
      return [[], []];
    }

    // 2. INSERT queries
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

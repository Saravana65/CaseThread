/**
 * @file connection.js
 * @description Enterprise-grade MySQL connection pool manager for CASETHREAD backend.
 * Supports production MySQL 8 pools and an in-memory fallback store for offline test execution.
 */

const mysql = require('mysql2/promise');
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
 * Tests connection to the MySQL database.
 * @returns {Promise<boolean>} True if connected, false otherwise
 */
async function testConnection() {
  if (!pool) return false;
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    isConnected = true;
    console.log(`[DATABASE] Connected to MySQL 8 on ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
    return true;
  } catch (error) {
    isConnected = false;
    console.warn(`[DATABASE WARNING] MySQL not reachable on ${dbConfig.host}:${dbConfig.port}: ${error.message}`);
    return false;
  }
}

/**
 * Executes a parameterized SQL statement with automatic fallback support.
 * @param {string} sql Parameterized SQL query
 * @param {Array} params Query parameters
 * @returns {Promise<[Array, Object]>} Results in mysql2 [rows, fields] format
 */
async function execute(sql, params = []) {
  if (isConnected || (!process.env.USE_MEMORY_STORE && pool)) {
    try {
      return await pool.execute(sql, params);
    } catch (err) {
      // If connection was lost or refused, check if we should fall back in test mode
      if (process.env.NODE_ENV === 'test' || process.env.USE_MEMORY_STORE === 'true') {
        return memoryStore.execute(sql, params);
      }
      throw err;
    }
  }

  // In test/mock mode
  return memoryStore.execute(sql, params);
}

/**
 * Direct query execution for raw SQL or multi-statements.
 */
async function query(sql, params = []) {
  if (isConnected || (!process.env.USE_MEMORY_STORE && pool)) {
    try {
      return await pool.query(sql, params);
    } catch (err) {
      if (process.env.NODE_ENV === 'test' || process.env.USE_MEMORY_STORE === 'true') {
        return memoryStore.execute(sql, params);
      }
      throw err;
    }
  }

  return memoryStore.execute(sql, params);
}

/**
 * Transaction wrapper ensuring atomicity.
 * @param {Function} callback Async callback receiving connection: async (conn) => { ... }
 */
async function withTransaction(callback) {
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

  // Fallback for tests
  return callback({
    execute: (sql, params) => memoryStore.execute(sql, params),
    query: (sql, params) => memoryStore.execute(sql, params)
  });
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
        password_hash: '$2a$12$6sI5RfxU9p.9hN9jZqL7yepv3o28CeqT8lH.C2kZJk7t3gXF9H.pS', // Password123!
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

    this.audit_logs = [];
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
      if (sql.includes('FROM evidence_audit_logs') && (sql.includes('evidence_id = ?') || sql.includes('a.evidence_id = ?'))) {
        const evId = parseInt(params[0], 10);
        const matches = this.audit_logs.filter(a => a.evidence_id === evId);
        return [matches.slice().reverse(), []];
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

    if (trimmed.startsWith('INSERT INTO EVIDENCE_AUDIT_LOGS')) {
      const newId = this.audit_logs.length + 1;
      const isCreated = sql.includes("'CREATED'");
      this.audit_logs.push({
        audit_id: newId,
        evidence_id: parseInt(params[0], 10),
        case_id: parseInt(params[1], 10),
        officer_id: parseInt(params[2], 10),
        action_type: isCreated ? 'CREATED' : 'METADATA_UPDATED',
        previous_state: isCreated ? null : params[3],
        new_state: isCreated ? params[3] : params[4],
        reason_for_change: isCreated ? 'Initial forensic evidence ingestion' : (params[5] || 'Routine update'),
        ip_address: isCreated ? params[4] : params[6],
        created_at: new Date().toISOString()
      });
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
        case_id: params[0],
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
        entered_by_officer_id: params[12],
        chain_of_custody_notes: params[13] || null,
        metadata_json: params[14] || null,
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
        } else {
          ev.title = params[0];
          ev.description = params[1];
          ev.verification_status = params[2];
          ev.reliability_assessment = params[3];
          ev.metadata_json = params[4];
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
  memoryStore
};

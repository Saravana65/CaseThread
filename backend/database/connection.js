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
        notes: 'Known specialist in security bypass systems.',
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
        notes: 'Brother of Marcus Vance; owns black sedan.',
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
        metadata_json: JSON.stringify({ camera_id: 'CAM-04', resolution: '1080p' }),
        is_archived: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];

    this.relationships = [
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
        notes: 'Marcus and Damon Vance have shared banking accounts.',
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
      }
    ];

    this.leads = [
      {
        lead_id: 1,
        case_id: 1,
        title: 'Interrogate Damon Vance Regarding Vehicle 7XYZ99',
        hypothesis: 'Vehicle registered to Damon Vance was captured fleeing the vault loading dock.',
        recommended_action: 'Subpoena vehicle location data and question Damon Vance.',
        lead_status: 'ASSIGNED',
        priority_score: 92.50,
        assigned_officer_id: 1,
        source_gap_type: 'TIMELINE_CONTRADICTION',
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

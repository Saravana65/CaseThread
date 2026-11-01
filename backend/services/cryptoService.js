/**
 * @file cryptoService.js
 * @description Cryptographic evidence fingerprinting and tamper-evident audit hash chaining.
 * @project CASETHREAD - Phase 7 Forensic Evidence Integrity
 */

const crypto = require('crypto');
const fs = require('fs');

const GENESIS_HASH = 'GENESIS_0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Computes standard SHA-256 hex digest for given data.
 * @param {string|Buffer} data Raw bytes or string
 * @returns {string} 64-character lowercase hex digest
 */
function generateSha256(data) {
  if (data === null || data === undefined) {
    data = '';
  }
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Recursively canonicalizes an object or array to produce deterministic JSON representation.
 * Keys are strictly sorted in lexicographical order.
 * @param {any} value
 * @returns {any}
 */
function sortKeys(value) {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  const sorted = {};
  const keys = Object.keys(value).sort();
  for (const k of keys) {
    sorted[k] = sortKeys(value[k]);
  }
  return sorted;
}

/**
 * Converts any object/array/value into a deterministic canonical JSON string.
 * @param {any} data
 * @returns {string}
 */
function canonicalize(data) {
  if (data === undefined || data === null) return '';
  if (typeof data === 'string') return data;
  const normalized = sortKeys(data);
  return JSON.stringify(normalized);
}

/**
 * Generates deterministic metadata fingerprint from an evidence metadata object.
 * @param {Object} metadata
 * @returns {string} SHA-256 hex digest
 */
function generateMetadataFingerprint(metadata) {
  const canonicalStr = canonicalize(metadata);
  return generateSha256(canonicalStr);
}

/**
 * Generates an event hash for an audit log entry.
 * Incorporates previous_event_hash, action_type, evidence_id, case_id, officer_id, timestamp, and state hashes.
 * @param {Object} params
 * @returns {string} 64-char hex hash
 */
function calculateEventHash(params) {
  const {
    previous_event_hash = GENESIS_HASH,
    evidence_id,
    case_id,
    officer_id,
    action_type,
    created_at,
    previous_state_hash = '',
    current_state_hash = '',
    reason_for_change = ''
  } = params;

  const canonicalPayload = canonicalize({
    previous_event_hash,
    evidence_id: Number(evidence_id),
    case_id: Number(case_id),
    officer_id: Number(officer_id),
    action_type,
    created_at: created_at ? new Date(created_at).toISOString() : '',
    previous_state_hash: previous_state_hash || '',
    current_state_hash: current_state_hash || '',
    reason_for_change: reason_for_change || ''
  });

  return generateSha256(canonicalPayload);
}

/**
 * Verifies a chronological sequence of audit events for cryptographic integrity.
 * Detects:
 *  - Modified event payloads
 *  - Broken hash linkages (reordered or missing events)
 *  - Corrupted genesis hashes
 * 
 * @param {Array<Object>} auditEvents Array of audit log rows sorted chronologically ASC
 * @returns {Object} { is_valid: boolean, events_checked: number, tampered_event_id: number|null, error: string|null }
 */
function verifyAuditChain(auditEvents) {
  if (!auditEvents || !Array.isArray(auditEvents) || auditEvents.length === 0) {
    return {
      is_valid: true,
      events_checked: 0,
      tampered_event_id: null,
      error: null,
      message: 'Empty audit log: chain is trivially valid.'
    };
  }

  let expectedPrevHash = GENESIS_HASH;

  for (let i = 0; i < auditEvents.length; i++) {
    const event = auditEvents[i];
    const eventId = event.audit_id || event.id || (i + 1);

    // 1. Check link to previous event hash
    if (event.previous_event_hash !== expectedPrevHash) {
      return {
        is_valid: false,
        events_checked: i,
        tampered_event_id: eventId,
        error: `Linkage failure at audit record ID ${eventId}: expected previous hash ${expectedPrevHash}, but found ${event.previous_event_hash}. Event sequence has been modified, deleted, or reordered.`
      };
    }

    // 2. Recompute current event hash from payload
    const recalculated = calculateEventHash({
      previous_event_hash: event.previous_event_hash,
      evidence_id: event.evidence_id,
      case_id: event.case_id,
      officer_id: event.officer_id,
      action_type: event.action_type,
      created_at: event.created_at,
      previous_state_hash: event.previous_state_hash,
      current_state_hash: event.current_state_hash,
      reason_for_change: event.reason_for_change
    });

    if (event.current_event_hash && event.current_event_hash !== recalculated) {
      return {
        is_valid: false,
        events_checked: i,
        tampered_event_id: eventId,
        error: `Payload tampering detected at audit record ID ${eventId}: recorded hash ${event.current_event_hash} does not match recalculated hash ${recalculated}. Content was mutated post-recording.`
      };
    }

    // Advance expected hash for next iteration
    expectedPrevHash = event.current_event_hash || recalculated;
  }

  return {
    is_valid: true,
    events_checked: auditEvents.length,
    tampered_event_id: null,
    error: null,
    head_hash: expectedPrevHash,
    message: `Cryptographic audit chain intact across all ${auditEvents.length} events.`
  };
}

/**
 * Calculates SHA-256 fingerprint from a file stream on disk.
 * Uses chunked streaming to safely hash files of arbitrary size without memory exhaustion.
 * @param {string} filePath Absolute path to file on disk
 * @returns {Promise<{ sha256_hash: string, file_size_bytes: number }>}
 */
function calculateFileSha256(filePath) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      return reject(new Error(`File not found at path: ${filePath}`));
    }
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    let bytesRead = 0;

    stream.on('data', (chunk) => {
      bytesRead += chunk.length;
      hash.update(chunk);
    });

    stream.on('end', () => {
      const sha256_hash = hash.digest('hex');
      resolve({ sha256_hash, file_size_bytes: bytesRead });
    });

    stream.on('error', (err) => {
      reject(err);
    });
  });
}

module.exports = {
  GENESIS_HASH,
  generateSha256,
  calculateFileSha256,
  canonicalize,
  generateMetadataFingerprint,
  calculateEventHash,
  verifyAuditChain
};

/**
 * @file forensic_integrity.test.js
 * @description Comprehensive automated quality assurance test suite for Phase 7:
 * - SHA-256 evidence fingerprint generation & verification
 * - Content mutation detection (TAMPERED_MISMATCH)
 * - Metadata vs file fingerprint distinction
 * - Chain-of-custody transfer tracking & authorization
 * - Tamper-evident append-only audit hash chaining
 * - Audit chain verification, modified event detection, and reordered event detection
 * - Evidence version management & previous state preservation
 * - Explainable algorithmic findings
 * - Case intelligence report generation (JSON/HTML) & authorization
 * 
 * @project CASETHREAD - Phase 7 Forensic Evidence Integrity
 */

process.env.NODE_ENV = 'test';
process.env.USE_MEMORY_STORE = 'true';
process.env.JWT_SECRET = 'a_very_long_cryptographically_secure_random_key_123456789';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const jwt = require('jsonwebtoken');

const app = require('../server');
const { memoryStore } = require('../database/connection');
const cryptoService = require('../services/cryptoService');

let server;
let baseUrl;
let leadToken;
let otherToken;

// Setup test server and tokens
before(async () => {
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}/api/v1`;
      resolve();
    });
  });

  // Token for Lead Officer (Officer 1 - Lead on Case 1)
  leadToken = jwt.sign(
    { officer_id: 1, badge_number: 'DET-8841', role: 'LEAD_OFFICER' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  // Token for Officer 2 (Investigator, NOT lead on Case 1)
  otherToken = jwt.sign(
    { officer_id: 2, badge_number: 'DET-9912', role: 'INVESTIGATOR' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

describe('CASETHREAD Phase 7 - Forensic Evidence Integrity & Explainable Intelligence', () => {

  // ============================================================================
  // STAGE 1: CRYPTOGRAPHIC EVIDENCE FINGERPRINTING
  // ============================================================================
  test('1. Generates genuine SHA-256 fingerprint for content payload on evidence creation', async () => {
    const rawContent = 'SAMPLE_PHYSICAL_EXTRACTION_LOG_BYTES_0x4491AB';
    const expectedHash = cryptoService.generateSha256(rawContent);

    const res = await fetch(`${baseUrl}/evidence`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${leadToken}`
      },
      body: JSON.stringify({
        case_id: 1,
        tracking_code: 'EVD-TEST-FP-001',
        title: 'USB Flash Drive Extraction',
        category: 'DIGITAL',
        description: 'Forensic clone raw hex dump from suspect flash drive',
        source: 'Seized on scene by Det. Cross',
        verification_status: 'CONFIRMED_FACT',
        reliability_assessment: 'HIGH',
        content_payload: rawContent,
        fingerprint_type: 'ORIGINAL_FILE'
      })
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.sha256_fingerprint, expectedHash);
    assert.strictEqual(body.data.fingerprint_type, 'ORIGINAL_FILE');
    assert.strictEqual(body.data.integrity_status, 'INTACT');
    assert.strictEqual(body.data.current_version, 1);
  });

  test('2. Distinguishes metadata-canonical fingerprint when no raw content is provided', async () => {
    const res = await fetch(`${baseUrl}/evidence`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${leadToken}`
      },
      body: JSON.stringify({
        case_id: 1,
        tracking_code: 'EVD-TEST-FP-META',
        title: 'Interview Transcript Audio Metadata',
        category: 'TESTIMONY_TRANSCRIPT',
        description: 'Witness formal deposition transcript metadata log',
        source: 'Recorded in interrogation room 2',
        metadata_json: { duration_seconds: 1420, recording_codec: 'aac' }
      })
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.fingerprint_type, 'METADATA_CANONICAL');
    assert.strictEqual(body.data.sha256_fingerprint.length, 64);
  });

  test('3. Verifies evidence integrity successfully when content matches recorded fingerprint', async () => {
    // Evidence #1 in seed has content_payload = 'RAW_MP4_HEADER_OFFSET_004912_FPS30_HASH_VERIFIED'
    const ev1 = memoryStore.evidence.find(e => e.evidence_id === 1);
    const currentHash = cryptoService.generateSha256(ev1.content_payload);
    ev1.sha256_fingerprint = currentHash;

    const res = await fetch(`${baseUrl}/evidence/1/verify-integrity`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${leadToken}` }
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.match_status, 'MATCH');
    assert.strictEqual(body.data.integrity_status, 'INTACT');
    assert.strictEqual(body.data.recalculated_hash, body.data.recorded_hash);
    assert.ok(body.data.academic_disclaimer.includes('ACADEMIC NOTICE'));
  });

  test('4. Detects integrity mismatch (TAMPERED_MISMATCH) when content payload is altered', async () => {
    // Tamper with content_payload of evidence #1 directly in data store
    const ev1 = memoryStore.evidence.find(e => e.evidence_id === 1);
    const originalContent = ev1.content_payload;
    ev1.content_payload = 'TAMPERED_MALICIOUS_INJECTED_BYTES_0xDEADBEEF';

    const res = await fetch(`${baseUrl}/evidence/1/verify-integrity`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${leadToken}` }
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.match_status, 'MISMATCH');
    assert.strictEqual(body.data.integrity_status, 'TAMPERED_MISMATCH');
    assert.notStrictEqual(body.data.recalculated_hash, body.data.recorded_hash);

    // Restore original content
    ev1.content_payload = originalContent;
  });

  // ============================================================================
  // STAGE 2: CHAIN-OF-CUSTODY EVENT TRACKING
  // ============================================================================
  test('5. Records a valid chain-of-custody transfer with complete provenance metadata', async () => {
    const res = await fetch(`${baseUrl}/custody/transfer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${leadToken}`
      },
      body: JSON.stringify({
        evidence_id: 1,
        case_id: 1,
        previous_custodian: 'Det. Alexander Cross (Badge DET-8841)',
        new_custodian: 'State Crime Lab Forensic Analyst Vance',
        transfer_timestamp: '2026-10-16 10:00:00',
        transfer_reason: 'Spectrographic chemical fiber breakdown',
        transfer_location: 'Central State Crime Lab Vault',
        transfer_notes: 'Delivered in sealed evidence pouch #9921A',
        verification_status: 'VERIFIED'
      })
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.is_successful, true);
    assert.strictEqual(body.data.new_custodian, 'State Crime Lab Forensic Analyst Vance');
    assert.strictEqual(body.data.verification_status, 'VERIFIED');
  });

  test('6. Rejects custody transfer missing mandatory fields with 400', async () => {
    const res = await fetch(`${baseUrl}/custody/transfer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${leadToken}`
      },
      body: JSON.stringify({
        evidence_id: 1,
        case_id: 1,
        previous_custodian: 'Officer Cross'
        // Missing new_custodian, transfer_reason, transfer_location
      })
    });

    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'MISSING_REQUIRED_FIELDS');
  });

  test('7. Rejects custody transfer by unauthorized non-lead officer with 403 (Case Isolation)', async () => {
    const res = await fetch(`${baseUrl}/custody/transfer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${otherToken}` // Officer 2 is not lead on Case 1
      },
      body: JSON.stringify({
        evidence_id: 1,
        case_id: 1,
        previous_custodian: 'Lead Officer',
        new_custodian: 'Unauthorized Officer',
        transfer_reason: 'Unauthorized custody takeover attempt',
        transfer_location: 'Station Locker'
      })
    });

    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'FORBIDDEN_CUSTODY_ACCESS');
  });

  test('8. Retrieves chronological custody history for evidence item', async () => {
    const res = await fetch(`${baseUrl}/custody/evidence/1`, {
      headers: { Authorization: `Bearer ${leadToken}` }
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.total_events >= 2);
    // Chronological order: most recent first
    assert.strictEqual(body.data[0].new_custodian, 'State Crime Lab Forensic Analyst Vance');
  });

  // ============================================================================
  // STAGE 3: TAMPER-EVIDENT AUDIT HASH CHAINING
  // ============================================================================
  test('9. Appends cryptographically chained events linking previous_event_hash', async () => {
    const res = await fetch(`${baseUrl}/evidence/1/audit-chain`, {
      headers: { Authorization: `Bearer ${leadToken}` }
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.chain_status.is_valid, true);
    assert.ok(body.chain_status.events_checked >= 2);
    assert.strictEqual(body.audit_events[0].previous_event_hash, cryptoService.GENESIS_HASH);
  });

  test('10. Detects corrupted audit event payload (Payload Tampering)', () => {
    // Generate synthetic chain
    const event1 = {
      audit_id: 1,
      evidence_id: 99,
      case_id: 1,
      officer_id: 1,
      action_type: 'CREATED',
      created_at: new Date('2026-10-01T10:00:00Z'),
      previous_event_hash: cryptoService.GENESIS_HASH,
      reason_for_change: 'Initial ingestion'
    };
    event1.current_event_hash = cryptoService.calculateEventHash(event1);

    const event2 = {
      audit_id: 2,
      evidence_id: 99,
      case_id: 1,
      officer_id: 1,
      action_type: 'METADATA_UPDATED',
      created_at: new Date('2026-10-01T11:00:00Z'),
      previous_event_hash: event1.current_event_hash,
      reason_for_change: 'Title updated'
    };
    event2.current_event_hash = cryptoService.calculateEventHash(event2);

    const validChain = [event1, event2];
    const initialCheck = cryptoService.verifyAuditChain(validChain);
    assert.strictEqual(initialCheck.is_valid, true);

    // Tamper with event1's reason_for_change post-recording without recomputing hash
    const tamperedChain = [
      { ...event1, reason_for_change: 'MALICIOUS_RETROACTIVE_CHANGE' },
      event2
    ];
    const tamperedCheck = cryptoService.verifyAuditChain(tamperedChain);
    assert.strictEqual(tamperedCheck.is_valid, false);
    assert.strictEqual(tamperedCheck.tampered_event_id, 1);
    assert.ok(tamperedCheck.error.includes('Payload tampering detected'));
  });

  test('11. Detects reordered or missing audit events (Linkage Failure)', () => {
    const event1 = {
      audit_id: 1,
      evidence_id: 99,
      case_id: 1,
      officer_id: 1,
      action_type: 'CREATED',
      created_at: new Date('2026-10-01T10:00:00Z'),
      previous_event_hash: cryptoService.GENESIS_HASH,
      reason_for_change: 'Initial ingestion'
    };
    event1.current_event_hash = cryptoService.calculateEventHash(event1);

    const event2 = {
      audit_id: 2,
      evidence_id: 99,
      case_id: 1,
      officer_id: 1,
      action_type: 'STATUS_CHANGED',
      created_at: new Date('2026-10-01T11:00:00Z'),
      previous_event_hash: event1.current_event_hash,
      reason_for_change: 'Status changed'
    };
    event2.current_event_hash = cryptoService.calculateEventHash(event2);

    const event3 = {
      audit_id: 3,
      evidence_id: 99,
      case_id: 1,
      officer_id: 1,
      action_type: 'METADATA_UPDATED',
      created_at: new Date('2026-10-01T12:00:00Z'),
      previous_event_hash: event2.current_event_hash,
      reason_for_change: 'Meta updated'
    };
    event3.current_event_hash = cryptoService.calculateEventHash(event3);

    // Reorder: Event 1 -> Event 3 -> Event 2 (missing Event 2 in between)
    const reorderedChain = [event1, event3, event2];
    const reorderedCheck = cryptoService.verifyAuditChain(reorderedChain);
    assert.strictEqual(reorderedCheck.is_valid, false);
    assert.strictEqual(reorderedCheck.tampered_event_id, 3);
    assert.ok(reorderedCheck.error.includes('Linkage failure'));
  });

  // ============================================================================
  // STAGE 4: EVIDENCE VERSION MANAGEMENT
  // ============================================================================
  test('12. Creates new version (V2) on evidence update while preserving original V1 values', async () => {
    const res = await fetch(`${baseUrl}/evidence/1`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${leadToken}`
      },
      body: JSON.stringify({
        title: 'Loading Dock Camera Feed #4 (Enhanced 4K)',
        description: 'Digitally contrast-enhanced and sharpened frame sequence',
        verification_status: 'CONFIRMED_FACT',
        reliability_assessment: 'HIGH',
        reason_for_change: 'Forensic video enhancement completed by laboratory'
      })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.current_version, 2);

    // Fetch version history
    const verRes = await fetch(`${baseUrl}/evidence/1/versions`, {
      headers: { Authorization: `Bearer ${leadToken}` }
    });

    assert.strictEqual(verRes.status, 200);
    const verBody = await verRes.json();
    assert.strictEqual(verBody.success, true);
    assert.strictEqual(verBody.total_versions >= 2, true);

    const v1 = verBody.data.find(v => v.version_number === 1);
    const v2 = verBody.data.find(v => v.version_number === 2);

    assert.ok(v1, 'Version 1 must be preserved');
    assert.ok(v2, 'Version 2 must exist');
    assert.strictEqual(v1.title, 'Loading Dock Camera Feed #4');
    assert.strictEqual(v2.title, 'Loading Dock Camera Feed #4 (Enhanced 4K)');
    assert.strictEqual(v2.reason_for_modification, 'Forensic video enhancement completed by laboratory');
  });

  // ============================================================================
  // STAGE 5: EXPLAINABLE INVESTIGATION FINDINGS
  // ============================================================================
  test('13. Algorithmic analysis returns explainable findings with category, rules, calculation, and limitations', async () => {
    const res = await fetch(`${baseUrl}/analysis/cases/1/run`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${leadToken}` }
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);

    const analysis = body.data.analysis;

    // Verify Evidence Gap Explainability
    if (analysis.evidence_gaps && analysis.evidence_gaps.length > 0) {
      const gap = analysis.evidence_gaps[0];
      assert.strictEqual(gap.finding_category, 'EVIDENCE_GAP');
      assert.strictEqual(gap.algorithm_rule, 'FIELD_COMPLETENESS_AND_GRAPH_ISOLATION');
      assert.ok(gap.score_calculation_explanation.length > 0);
      assert.ok(gap.known_limitations.length > 0);
      assert.ok(gap.recommended_follow_up.length > 0);
      assert.strictEqual(gap.nature, 'ALGORITHMIC_INFERENCE');
      assert.ok(gap.judicial_disclaimer.includes('decision aid'));
    }

    // Verify Timeline Anomaly Explainability
    if (analysis.timeline_anomalies && analysis.timeline_anomalies.length > 0) {
      const anom = analysis.timeline_anomalies[0];
      assert.strictEqual(anom.finding_category, 'TIMELINE_ANOMALY');
      assert.strictEqual(anom.algorithm_rule, 'SPATIOTEMPORAL_VELOCITY_CALCULATION');
      assert.ok(anom.score_calculation_explanation.includes('displacement'));
      assert.ok(anom.known_limitations.includes('straight-line geodesic distance'));
      assert.strictEqual(anom.nature, 'ALGORITHMIC_INFERENCE');
    }

    // Verify Prioritized Lead Explainability
    if (analysis.prioritized_leads && analysis.prioritized_leads.length > 0) {
      const lead = analysis.prioritized_leads[0];
      assert.strictEqual(lead.finding_category, 'INVESTIGATIVE_LEAD');
      assert.strictEqual(lead.algorithm_rule, 'BINARY_MAX_HEAP_COMPOSITE_SCORING');
      assert.ok(lead.score_calculation_explanation.includes('40% Source Confidence'));
      assert.ok(lead.known_limitations.includes('does NOT demonstrate guilt'));
      assert.strictEqual(lead.nature, 'HYPOTHESIS');
    }
  });

  // ============================================================================
  // STAGE 7: CASE REPORT GENERATION & EXPORT
  // ============================================================================
  test('14. Exports complete structured case dossier in JSON format with integrity disclosures', async () => {
    const res = await fetch(`${baseUrl}/reports/cases/1/json`, {
      headers: { Authorization: `Bearer ${leadToken}` }
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.report);
    assert.strictEqual(body.report.case_summary.case_number, 'CASE-2026-0419');
    assert.ok(Array.isArray(body.report.evidence_inventory));
    assert.ok(Array.isArray(body.report.chain_of_custody_history));
    assert.ok(Array.isArray(body.report.prioritized_investigative_leads));
    assert.strictEqual(body.report.tamper_evident_audit.chain_intact, true);
    assert.ok(body.report.academic_limitations.length >= 4);

    // Verify zero secrets leaked
    const reportStr = JSON.stringify(body.report);
    assert.ok(!reportStr.includes('password_hash'));
    assert.ok(!reportStr.includes(process.env.JWT_SECRET));
  });

  test('15. Exports formatted printable HTML report containing print controls and audit seal', async () => {
    const res = await fetch(`${baseUrl}/reports/cases/1/html`, {
      headers: { Authorization: `Bearer ${leadToken}` }
    });

    assert.strictEqual(res.status, 200);
    assert.ok(res.headers.get('content-type').includes('text/html'));
    const html = await res.text();
    assert.ok(html.includes('CASETHREAD FORENSIC DOSSIER'));
    assert.ok(html.includes('SHA-256 Fingerprint Digest'));
    assert.ok(html.includes('Chain of Custody Event Log'));
    assert.ok(html.includes('Explainable Algorithmic Leads'));
    assert.ok(html.includes('Tamper-Evident Audit Verification'));
    assert.ok(html.includes('FORENSIC INTEGRITY NOTICE & LEGAL DISCLAIMER'));
  });

  test('16. Rejects unauthorized officer report export with 403 (Case Isolation)', async () => {
    const res = await fetch(`${baseUrl}/reports/cases/1/json`, {
      headers: { Authorization: `Bearer ${otherToken}` } // Officer 2 is not lead on Case 1
    });

    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'FORBIDDEN_REPORT_ACCESS');
  });

});

/**
 * @file evidence_vault.test.js
 * @description Comprehensive automated test suite for Phase 8:
 * Digital Evidence Acquisition, Secure File Vault, Metadata Extraction,
 * Streaming SHA-256 Verification, and Derived Artifact Management.
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
process.env.USE_MEMORY_STORE = 'true';
process.env.JWT_SECRET = 'casethread_super_secure_vault_test_jwt_secret_key_2026!';
process.env.EVIDENCE_VAULT_PATH = path.resolve(__dirname, '../storage/test_vault');

const app = require('../server');
const { execute } = require('../database/connection');
const cryptoService = require('../services/cryptoService');
const vaultService = require('../services/vaultService');

let server;
let baseUrl;
let leadToken;
let investigatorToken;
let unauthorizedOfficerToken;

// Sample Valid Magic Byte Payloads
function createSamplePngBuffer(width = 800, height = 600) {
  const buf = Buffer.alloc(32);
  // PNG Magic Header: 89 50 4E 47 0D 0A 1A 0A
  Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]).copy(buf, 0);
  buf.writeUInt32BE(13, 8); // IHDR length
  buf.write('IHDR', 12);
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  buf.writeUInt8(8, 24); // 8-bit depth
  buf.writeUInt8(6, 25); // RGBA
  return buf;
}

function createSamplePdfBuffer() {
  return Buffer.from(
    '%PDF-1.4\n' +
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n' +
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n' +
    '3 0 obj << /Type /Page /Parent 2 0 R >> endobj\n' +
    '/Title (Forensic Call Detail Report)\n' +
    '/Author (Telecom Analyst Martinez)\n' +
    '/CreationDate (D:20261015024500Z)\n' +
    '%%EOF\n'
  );
}

function createSampleWavBuffer() {
  const buf = Buffer.alloc(44);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); // Subchunk1Size
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(2, 22); // Stereo
  buf.writeUInt32LE(44100, 24); // 44.1kHz
  buf.writeUInt32LE(176400, 28); // Byte rate
  buf.writeUInt16LE(4, 32); // Block align
  buf.writeUInt16LE(16, 34); // 16 bits
  buf.write('data', 36);
  buf.writeUInt32LE(88200, 40); // 88200 bytes = 0.5 sec
  return buf;
}

before(async () => {
  // Clean test vault
  if (fs.existsSync(process.env.EVIDENCE_VAULT_PATH)) {
    fs.rmSync(process.env.EVIDENCE_VAULT_PATH, { recursive: true, force: true });
  }

  // Issue tokens
  leadToken = jwt.sign(
    { officer_id: 1, badge_number: 'DET-8841', role: 'LEAD_OFFICER', full_name: 'Det. Alexander Cross' },
    process.env.JWT_SECRET,
    { expiresIn: '2h' }
  );

  investigatorToken = jwt.sign(
    { officer_id: 2, badge_number: 'DET-9912', role: 'INVESTIGATOR', full_name: 'Det. Sarah Lin' },
    process.env.JWT_SECRET,
    { expiresIn: '2h' }
  );

  unauthorizedOfficerToken = jwt.sign(
    { officer_id: 99, badge_number: 'DET-0099', role: 'UNASSIGNED', full_name: 'Officer Imposter' },
    process.env.JWT_SECRET,
    { expiresIn: '2h' }
  );

  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}/api/v1`;
      resolve();
    });
  });
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  if (fs.existsSync(process.env.EVIDENCE_VAULT_PATH)) {
    fs.rmSync(process.env.EVIDENCE_VAULT_PATH, { recursive: true, force: true });
  }
});

describe('CASETHREAD Phase 8 - Evidence Acquisition, Secure File Vault & Ingestion', () => {
  let uploadedPngFileId;
  let uploadedPdfFileId;
  let uploadedCsvFileId;

  // 1. Valid PNG Image Upload & Magic Byte Verification
  test('1. Ingests valid PNG image into secure vault and extracts image dimensions', async () => {
    const pngBuffer = createSamplePngBuffer(1920, 1080);
    const formData = new FormData();
    formData.append('case_id', '1');
    formData.append('evidence_id', '1');
    formData.append('file', new Blob([pngBuffer], { type: 'image/png' }), 'security_cam_still.png');

    const res = await fetch(`${baseUrl}/vault/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${leadToken}` },
      body: formData
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.sanitized_filename, 'security_cam_still.png');
    assert.strictEqual(body.data.mime_type, 'image/png');
    assert.strictEqual(body.data.detected_mime_type, 'image/png');
    assert.strictEqual(body.data.integrity_status, 'INTACT');
    assert.ok(body.data.sha256_hash && body.data.sha256_hash.length === 64);

    // Verify metadata extraction
    assert.ok(body.data.extraction);
    assert.strictEqual(body.data.extraction.extraction_status, 'SUCCESS');
    assert.strictEqual(body.data.extraction.extracted_metadata.format, 'PNG');
    assert.strictEqual(body.data.extraction.extracted_metadata.dimensions.width, 1920);
    assert.strictEqual(body.data.extraction.extracted_metadata.dimensions.height, 1080);

    uploadedPngFileId = body.data.file_id;
  });

  // 2. Valid PDF Upload & Page Count Extraction
  test('2. Ingests valid PDF document and extracts page count, title, and author', async () => {
    const pdfBuffer = createSamplePdfBuffer();
    const formData = new FormData();
    formData.append('case_id', '1');
    formData.append('evidence_id', '2');
    formData.append('file', new Blob([pdfBuffer], { type: 'application/pdf' }), 'cellular_tower_dump.pdf');

    const res = await fetch(`${baseUrl}/vault/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${leadToken}` },
      body: formData
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.file_extension, '.pdf');
    assert.strictEqual(body.data.detected_mime_type, 'application/pdf');

    // Extracted PDF properties
    assert.ok(body.data.extraction);
    assert.strictEqual(body.data.extraction.extracted_metadata.page_count, 1);
    assert.strictEqual(body.data.extraction.extracted_metadata.document_title, 'Forensic Call Detail Report');
    assert.strictEqual(body.data.extraction.extracted_metadata.document_author, 'Telecom Analyst Martinez');

    uploadedPdfFileId = body.data.file_id;
  });

  // 3. Valid CSV Upload & Tabular Schema Extraction
  test('3. Ingests valid CSV telemetry log and extracts row/column structure', async () => {
    const csvContent = 'timestamp,device_imei,cell_tower_id,call_duration_sec\n' +
                       '2026-10-15 02:44:00,352099001234567,TOW-07,38\n' +
                       '2026-10-15 02:52:10,352099001234567,TOW-08,12\n';
    const formData = new FormData();
    formData.append('case_id', '1');
    formData.append('evidence_id', '2');
    formData.append('file', new Blob([csvContent], { type: 'text/csv' }), 'tower_cdr_dump.csv');

    const res = await fetch(`${baseUrl}/vault/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${leadToken}` },
      body: formData
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.detected_mime_type, 'text/csv');

    // Extracted CSV properties
    assert.ok(body.data.extraction);
    assert.strictEqual(body.data.extraction.extracted_metadata.row_count, 2);
    assert.strictEqual(body.data.extraction.extracted_metadata.column_count, 4);
    assert.ok(body.data.extraction.extracted_metadata.columns.includes('device_imei'));

    uploadedCsvFileId = body.data.file_id;
  });

  // 4. Valid WAV Audio Upload & Audio Specs Extraction
  test('4. Ingests WAV audio recording and extracts duration, sample rate, and channels', async () => {
    const wavBuffer = createSampleWavBuffer();
    const formData = new FormData();
    formData.append('case_id', '1');
    formData.append('evidence_id', '1');
    formData.append('file', new Blob([wavBuffer], { type: 'audio/wav' }), 'vault_wiretap_snip.wav');

    const res = await fetch(`${baseUrl}/vault/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${leadToken}` },
      body: formData
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.data.detected_mime_type, 'audio/wav');
    assert.strictEqual(body.data.extraction.extracted_metadata.sample_rate_hz, 44100);
    assert.strictEqual(body.data.extraction.extracted_metadata.duration_seconds, 0.5);
  });

  // 5. Valid JSON File Upload
  test('5. Ingests JSON cyber-forensic record and extracts schema structure', async () => {
    const jsonStr = JSON.stringify({ device: 'Android 14', network_scan: { ip: '10.0.0.4', port: 443 } });
    const formData = new FormData();
    formData.append('case_id', '1');
    formData.append('evidence_id', '1');
    formData.append('file', new Blob([jsonStr], { type: 'application/json' }), 'device_scan.json');

    const res = await fetch(`${baseUrl}/vault/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${leadToken}` },
      body: formData
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.data.detected_mime_type, 'application/json');
    assert.strictEqual(body.data.extraction.extracted_metadata.root_type, 'OBJECT');
  });

  // 6. Rejects Unsupported File Extensions
  test('6. Rejects dangerous or unsupported file types (.exe, .sh) with 400', async () => {
    const formData = new FormData();
    formData.append('case_id', '1');
    formData.append('evidence_id', '1');
    formData.append('file', new Blob(['MZ\x90\x00\x03\x00\x00\x00'], { type: 'application/x-dosexec' }), 'trojan.exe');

    const res = await fetch(`${baseUrl}/vault/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${leadToken}` },
      body: formData
    });

    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.error.code, 'UNSUPPORTED_FILE_TYPE');
  });

  // 7. Detects MIME Spoofing (Executable disguised as .png)
  test('7. Detects MIME spoofing (binary payload with fake .png extension) with 400', async () => {
    // Fake PNG file that does NOT have the PNG magic bytes
    const fakePng = Buffer.from('NOT_A_PNG_EXECUTABLE_PAYLOAD_BYTES');
    const formData = new FormData();
    formData.append('case_id', '1');
    formData.append('evidence_id', '1');
    formData.append('file', new Blob([fakePng], { type: 'image/png' }), 'fake_camera_still.png');

    const res = await fetch(`${baseUrl}/vault/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${leadToken}` },
      body: formData
    });

    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.error.code, 'MIME_SPOOFING_DETECTED');
  });

  // 8. Rejects Empty File (0 Bytes)
  test('8. Rejects empty file payload (0 bytes) with 400 FILE_EMPTY', async () => {
    const formData = new FormData();
    formData.append('case_id', '1');
    formData.append('evidence_id', '1');
    formData.append('file', new Blob([], { type: 'text/plain' }), 'empty.txt');

    const res = await fetch(`${baseUrl}/vault/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${leadToken}` },
      body: formData
    });

    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.error.code, 'FILE_EMPTY');
  });

  // 9. Sanitizes Malicious Filename & Path Traversal Injection
  test('9. Neutralizes filename injection and path traversal attempts (../../etc/passwd)', async () => {
    const csvContent = 'id,value\n1,safe\n';
    const formData = new FormData();
    formData.append('case_id', '1');
    formData.append('evidence_id', '1');
    formData.append('file', new Blob([csvContent], { type: 'text/csv' }), '../../../../etc/malicious_exploit.csv');

    const res = await fetch(`${baseUrl}/vault/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${leadToken}` },
      body: formData
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    // Path traversal components must be stripped
    assert.strictEqual(body.data.sanitized_filename, 'malicious_exploit.csv');
    assert.ok(!body.data.storage_key.includes('..'));
    assert.ok(!body.data.storage_key.includes('/'));
  });

  // 10. Retrieves Vault Files Catalog for a Case
  test('10. Lists all cataloged vault files for a case with provenance metadata', async () => {
    const res = await fetch(`${baseUrl}/vault/cases/1/files`, {
      headers: { Authorization: `Bearer ${leadToken}` }
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(body.data.length >= 3);
    const first = body.data[0];
    assert.ok(first.storage_key);
    assert.ok(first.sha256_hash);
    assert.ok(first.uploaded_by_officer_name);
  });

  // 11. Secure Streaming Download with Content-Disposition
  test('11. Streams physical evidence file for download with X-Evidence-SHA256 headers', async () => {
    const res = await fetch(`${baseUrl}/vault/files/${uploadedPngFileId}/download`, {
      headers: { Authorization: `Bearer ${leadToken}` }
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('content-type'), 'image/png');
    assert.ok(res.headers.get('content-disposition').includes('attachment; filename="security_cam_still.png"'));
    assert.ok(res.headers.get('x-evidence-sha256').length === 64);

    const fileBytes = await res.arrayBuffer();
    assert.strictEqual(fileBytes.byteLength, 32);
  });

  // 12. Inline Preview Streaming
  test('12. Streams file inline for authorized browser preview', async () => {
    const res = await fetch(`${baseUrl}/vault/files/${uploadedPngFileId}/preview`, {
      headers: { Authorization: `Bearer ${leadToken}` }
    });

    assert.strictEqual(res.status, 200);
    assert.ok(res.headers.get('content-disposition').includes('inline;'));
  });

  // 13. Rejects Unauthorized Download Without Token
  test('13. Rejects unauthenticated file download attempt with 401', async () => {
    const res = await fetch(`${baseUrl}/vault/files/${uploadedPngFileId}/download`);
    assert.strictEqual(res.status, 401);
  });

  // 14. Case Isolation: Rejects Cross-Case Download by Unauthorized Officer
  test('14. Rejects cross-case file access by unauthorized officer with 403 (Case Isolation)', async () => {
    const res = await fetch(`${baseUrl}/vault/files/${uploadedPngFileId}/download`, {
      headers: { Authorization: `Bearer ${unauthorizedOfficerToken}` }
    });

    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.error.code, 'FORBIDDEN_CASE_ACCESS');
  });

  // 15. Verifies Physical Vault File Integrity Against Fingerprint
  test('15. Verifies physical vault file on disk is INTACT against recorded SHA-256 fingerprint', async () => {
    const res = await fetch(`${baseUrl}/vault/files/${uploadedPngFileId}/verify-integrity`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${leadToken}` }
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.data.integrity_status, 'INTACT');
    assert.strictEqual(body.data.match, true);
    assert.strictEqual(body.data.recalculated_hash, body.data.recorded_hash);
  });

  // 16. Detects Physically Modified / Corrupted File (TAMPERED_MISMATCH)
  test('16. Detects bit-level modification of physical file on disk (TAMPERED_MISMATCH)', async () => {
    // Locate file on disk and tamper with bytes
    const [fileRows] = await execute('SELECT * FROM evidence_files WHERE file_id = ?', [uploadedPngFileId]);
    const fileRecord = fileRows[0];
    const physicalPath = vaultService.resolveVaultPath(fileRecord.case_id, fileRecord.storage_key, false);

    // Corrupt file bytes
    fs.writeFileSync(physicalPath, Buffer.from('TAMPERED_MALICIOUS_BYTES_0xDEADBEEF'));

    const res = await fetch(`${baseUrl}/vault/files/${uploadedPngFileId}/verify-integrity`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${leadToken}` }
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.data.integrity_status, 'TAMPERED_MISMATCH');
    assert.strictEqual(body.data.match, false);
    assert.notStrictEqual(body.data.recalculated_hash, body.data.recorded_hash);
  });

  // 17. Detects Missing File on Storage Disk (FILE_MISSING)
  test('17. Detects deleted physical file from vault storage disk (FILE_MISSING)', async () => {
    const [fileRows] = await execute('SELECT * FROM evidence_files WHERE file_id = ?', [uploadedPngFileId]);
    const fileRecord = fileRows[0];
    const physicalPath = vaultService.resolveVaultPath(fileRecord.case_id, fileRecord.storage_key, false);

    // Unlink file from disk
    fs.unlinkSync(physicalPath);

    const res = await fetch(`${baseUrl}/vault/files/${uploadedPngFileId}/verify-integrity`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${leadToken}` }
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.data.integrity_status, 'FILE_MISSING');
    assert.strictEqual(body.data.match, false);
  });

  // 18. Controlled Derived Artifact Generation (PDF Text Extraction)
  test('18. Generates controlled derived artifact (EXTRACTED_TEXT) with separate SHA-256 hash', async () => {
    const res = await fetch(`${baseUrl}/vault/files/${uploadedPdfFileId}/artifacts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${leadToken}`
      },
      body: JSON.stringify({
        artifact_type: 'EXTRACTED_TEXT',
        notes: 'Extracted plain text for algorithmic indexing'
      })
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.artifact_type, 'EXTRACTED_TEXT');
    assert.strictEqual(body.data.parent_file_id, uploadedPdfFileId);
    assert.ok(body.data.sha256_hash && body.data.sha256_hash.length === 64);
    assert.ok(body.data.transformation_summary.includes('Extracted text stream'));
  });

  // 19. Derived Artifact: CSV Normalization
  test('19. Generates normalized JSON derived artifact from CSV telemetry data', async () => {
    const res = await fetch(`${baseUrl}/vault/files/${uploadedCsvFileId}/artifacts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${leadToken}`
      },
      body: JSON.stringify({
        artifact_type: 'NORMALIZED_DATA',
        notes: 'Normalized CDR records into structured JSON'
      })
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.data.artifact_type, 'NORMALIZED_DATA');
    assert.strictEqual(body.data.mime_type, 'application/json');
    assert.ok(body.data.transformation_summary.includes('Normalized 2 tabular records'));
  });

  // 20. Officer Metadata Review Workflow
  test('20. Records officer sign-off and annotations on automated metadata extraction', async () => {
    const [extRows] = await execute('SELECT * FROM evidence_metadata_extractions WHERE file_id = ?', [uploadedPdfFileId]);
    const extractionId = extRows[0].extraction_id;

    const res = await fetch(`${baseUrl}/vault/extractions/${extractionId}/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${leadToken}`
      },
      body: JSON.stringify({
        approved: true,
        review_notes: 'Verified PDF metadata matches telecom provider invoice.'
      })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.data.officer_reviewed, true);
    assert.strictEqual(body.data.review_notes, 'Verified PDF metadata matches telecom provider invoice.');
  });

  // 21. Vault Search & Filtering
  test('21. Searches vault files by case ID, extension, and integrity status', async () => {
    const res = await fetch(`${baseUrl}/vault/search?case_id=1&file_format=pdf`, {
      headers: { Authorization: `Bearer ${leadToken}` }
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(body.data.length >= 1);
    assert.strictEqual(body.data[0].file_extension, '.pdf');
  });

  // 22. Integration: Vault Files Cataloged in Case Dossier Export
  test('22. Case dossier JSON report includes digital vault inventory and derived artifacts', async () => {
    const res = await fetch(`${baseUrl}/reports/cases/1/json`, {
      headers: { Authorization: `Bearer ${leadToken}` }
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(body.data.digital_vault_inventory);
    assert.ok(body.data.digital_vault_inventory.length >= 2);
    assert.ok(body.data.derived_forensic_artifacts);
  });
});

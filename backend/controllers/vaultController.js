/**
 * @file vaultController.js
 * @description Controller for digital evidence file acquisition, vault storage,
 * streaming SHA-256 verification, metadata extraction, and derived artifacts.
 * @project CASETHREAD - Phase 8 Evidence Acquisition & Secure File Vault
 */

const fs = require('fs');
const path = require('path');
const { execute } = require('../database/connection');
const vaultService = require('../services/vaultService');
const cryptoService = require('../services/cryptoService');
const metadataExtractor = require('../services/metadataExtractor');
const artifactService = require('../services/artifactService');

/**
 * Validates officer case access permissions.
 */
async function verifyCaseAccess(officer, caseId) {
  if (!officer) return { authorized: true };
  if (officer.role === 'ADMIN' || officer.role === 'LEAD_OFFICER') {
    return { authorized: true };
  }
  const [cases] = await execute('SELECT lead_officer_id FROM cases WHERE case_id = ?', [caseId]);
  if (!cases || cases.length === 0) {
    return { authorized: false, status: 404, error: 'Case not found' };
  }
  if (cases[0].lead_officer_id !== officer.officer_id) {
    return {
      authorized: false,
      status: 403,
      error: "Access denied: You are not authorized to access files in another officer's case file."
    };
  }
  return { authorized: true };
}

/**
 * Uploads a new evidence file, validates content signatures, calculates streaming SHA-256,
 * stores in secure vault, and triggers automatic metadata extraction.
 */
exports.uploadEvidenceFile = async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({
        success: false,
        error: { code: 'FILE_REQUIRED', message: 'No file uploaded in multipart form data.' }
      });
    }

    // 1. Enforce size bounds
    if (file.size === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'FILE_EMPTY', message: 'Uploaded file is empty (0 bytes). Invalid evidence payload.' }
      });
    }

    if (file.size > vaultService.MAX_FILE_SIZE_BYTES) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'FILE_TOO_LARGE',
          message: `Uploaded file exceeds maximum limit of ${vaultService.MAX_FILE_SIZE_MB}MB.`
        }
      });
    }

    const case_id = parseInt(req.body.case_id, 10);
    const evidence_id = parseInt(req.body.evidence_id, 10);
    const officer_id = req.officer ? req.officer.officer_id : 1;

    if (!case_id || isNaN(case_id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_CASE_ID', message: 'Associated case_id is required.' }
      });
    }

    if (!evidence_id || isNaN(evidence_id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_EVIDENCE_ID', message: 'Associated evidence_id is required.' }
      });
    }

    // 2. Validate Case Access
    if (req.officer) {
      const access = await verifyCaseAccess(req.officer, case_id);
      if (!access.authorized) {
        return res.status(access.status).json({
          success: false,
          error: { code: 'FORBIDDEN_CASE_ACCESS', message: access.error }
        });
      }
    }

    // 3. Validate Evidence exists and belongs to Case
    const [evidenceRows] = await execute('SELECT * FROM evidence WHERE evidence_id = ? AND case_id = ?', [evidence_id, case_id]);
    if (!evidenceRows || evidenceRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'EVIDENCE_NOT_FOUND', message: `Evidence record #${evidence_id} not found in case #${case_id}.` }
      });
    }
    const evidenceItem = evidenceRows[0];

    // 4. Sanitize Filename & Validate Extension
    const rawFilename = file.originalname || 'uploaded_evidence.bin';
    const sanitizedFilename = vaultService.sanitizeFilename(rawFilename);
    const ext = path.extname(sanitizedFilename).toLowerCase();

    if (!vaultService.ALLOWED_EXTENSIONS.has(ext)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'UNSUPPORTED_FILE_TYPE',
          message: `File extension '${ext}' is not permitted in the forensic vault. Allowed formats: PDF, TXT, CSV, JPG, PNG, MP4, WAV, MP3, JSON, XML.`
        }
      });
    }

    // 5. Binary Content Signature Validation (Magic Bytes)
    const fileBuffer = file.buffer || (file.path ? fs.readFileSync(file.path) : null);
    if (!fileBuffer) {
      return res.status(400).json({
        success: false,
        error: { code: 'FILE_READ_ERROR', message: 'Failed to read uploaded file payload.' }
      });
    }

    const signatureCheck = vaultService.validateContentSignature(fileBuffer, ext);
    if (!signatureCheck.valid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MIME_SPOOFING_DETECTED',
          message: `File content failed forensic signature verification: ${signatureCheck.reason}`,
          detected_mime: signatureCheck.detectedMime
        }
      });
    }

    const clientMime = file.mimetype || vaultService.EXTENSION_MIME_MAP[ext] || 'application/octet-stream';
    const detectedMime = signatureCheck.detectedMime;

    // 6. Generate Unique Storage Key & Write to Vault Outside Web Root
    const storageKey = vaultService.generateStorageKey(ext);
    const targetFilePath = vaultService.resolveVaultPath(case_id, storageKey, false);

    // Write file directly to vault
    fs.writeFileSync(targetFilePath, fileBuffer);

    // 7. Calculate SHA-256 Streaming Fingerprint
    const { sha256_hash, file_size_bytes } = await cryptoService.calculateFileSha256(targetFilePath);

    // 8. Insert Record into evidence_files
    const storagePathRel = `cases/${case_id}/originals/${storageKey}`;
    const [insertResult] = await execute(
      `INSERT INTO evidence_files 
       (evidence_id, case_id, storage_key, storage_path, original_filename, sanitized_filename,
        file_extension, mime_type, detected_mime_type, file_size_bytes, sha256_hash, hash_algorithm,
        is_primary, uploaded_by_officer_id, integrity_status, last_verified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SHA-256', 1, ?, 'INTACT', NOW())`,
      [
        evidence_id,
        case_id,
        storageKey,
        storagePathRel,
        rawFilename,
        sanitizedFilename,
        ext,
        clientMime,
        detectedMime,
        file_size_bytes,
        sha256_hash,
        officer_id
      ]
    );

    const fileId = insertResult.insertId;

    // 9. Update Evidence Table with File Reference and Recorded Hash
    await execute(
      `UPDATE evidence 
       SET file_reference = ?, sha256_fingerprint = ?, fingerprint_type = 'ORIGINAL_FILE', 
           fingerprinted_at = NOW(), integrity_status = 'INTACT', last_verified_at = NOW()
       WHERE evidence_id = ?`,
      [storagePathRel, sha256_hash, evidence_id]
    );

    // 10. Append Chained Audit Log
    const [priorLogs] = await execute(
      'SELECT current_event_hash FROM evidence_audit_logs WHERE evidence_id = ? ORDER BY created_at ASC, audit_id ASC',
      [evidence_id]
    );
    const prevEventHash = (priorLogs && priorLogs.length > 0)
      ? priorLogs[priorLogs.length - 1].current_event_hash
      : cryptoService.GENESIS_HASH;

    const eventTime = new Date().toISOString();
    const eventParams = {
      previous_event_hash: prevEventHash,
      evidence_id,
      case_id,
      officer_id,
      action_type: 'FILE_UPLOADED',
      created_at: eventTime,
      previous_state_hash: evidenceItem.sha256_fingerprint || '',
      current_state_hash: sha256_hash,
      reason_for_change: `Acquired and ingested physical file '${sanitizedFilename}' into secure vault.`
    };
    const currentEventHash = cryptoService.calculateEventHash(eventParams);

    await execute(
      `INSERT INTO evidence_audit_logs 
       (evidence_id, case_id, officer_id, action_type, previous_state, new_state, 
        previous_state_hash, current_state_hash, previous_event_hash, current_event_hash, 
        canonical_payload, reason_for_change, ip_address, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        evidence_id,
        case_id,
        officer_id,
        'FILE_UPLOADED',
        JSON.stringify({ file_reference: evidenceItem.file_reference, fingerprint: evidenceItem.sha256_fingerprint }),
        JSON.stringify({ file_id: fileId, storage_key: storageKey, sha256_hash, file_size_bytes }),
        evidenceItem.sha256_fingerprint || null,
        sha256_hash,
        prevEventHash,
        currentEventHash,
        JSON.stringify(eventParams),
        `Acquired and ingested physical file '${sanitizedFilename}' into secure vault.`,
        req.ip || '127.0.0.1',
        eventTime
      ]
    );

    // 11. Automated Format-Aware Metadata Extraction (Stage 4)
    let extractionResult = null;
    try {
      const extracted = await metadataExtractor.extractMetadataFromFile(targetFilePath, ext);
      const [extResult] = await execute(
        `INSERT INTO evidence_metadata_extractions 
         (file_id, evidence_id, case_id, file_format, extractor_tool, extractor_version,
          extraction_status, extracted_metadata_json, extracted_timestamp, extracted_gps_lat,
          extracted_gps_lon, officer_reviewed, review_notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)`,
        [
          fileId,
          evidence_id,
          case_id,
          extracted.extracted_metadata.format || ext.replace('.', '').toUpperCase(),
          extracted.extractor_tool,
          extracted.extractor_version,
          extracted.extraction_status,
          JSON.stringify(extracted.extracted_metadata),
          extracted.extracted_timestamp || null,
          extracted.extracted_gps_lat,
          extracted.extracted_gps_lon
        ]
      );
      extractionResult = {
        extraction_id: extResult.insertId,
        ...extracted
      };
    } catch (extractErr) {
      console.warn('[METADATA EXTRACTION WARNING]', extractErr.message);
    }

    res.status(201).json({
      success: true,
      data: {
        file_id: fileId,
        evidence_id,
        case_id,
        original_filename: rawFilename,
        sanitized_filename: sanitizedFilename,
        file_extension: ext,
        storage_key: storageKey,
        storage_path: storagePathRel,
        file_size_bytes,
        mime_type: clientMime,
        detected_mime_type: detectedMime,
        sha256_hash,
        hash_algorithm: 'SHA-256',
        integrity_status: 'INTACT',
        extraction: extractionResult
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Lists all evidence files in a case.
 */
exports.getFilesByCase = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.caseId, 10);
    if (req.officer) {
      const access = await verifyCaseAccess(req.officer, caseId);
      if (!access.authorized) {
        return res.status(access.status).json({
          success: false,
          error: { code: 'FORBIDDEN_CASE_ACCESS', message: access.error }
        });
      }
    }

    const [rows] = await execute(
      `SELECT f.*, e.tracking_code, e.title AS evidence_title, e.category AS evidence_category,
              o.full_name AS uploaded_by_officer_name, o.badge_number AS uploaded_by_badge
       FROM evidence_files f
       LEFT JOIN evidence e ON f.evidence_id = e.evidence_id
       LEFT JOIN officers o ON f.uploaded_by_officer_id = o.officer_id
       WHERE f.case_id = ?
       ORDER BY f.upload_timestamp DESC`,
      [caseId]
    );

    res.json({
      success: true,
      total: rows.length,
      data: rows
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieves single file metadata, latest extraction, and derived artifacts.
 */
exports.getFileDetails = async (req, res, next) => {
  try {
    const fileId = parseInt(req.params.fileId, 10);
    const [files] = await execute('SELECT * FROM evidence_files WHERE file_id = ?', [fileId]);
    if (!files || files.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'FILE_NOT_FOUND', message: `Evidence file #${fileId} not found.` }
      });
    }

    const file = files[0];
    if (req.officer) {
      const access = await verifyCaseAccess(req.officer, file.case_id);
      if (!access.authorized) {
        return res.status(access.status).json({
          success: false,
          error: { code: 'FORBIDDEN_CASE_ACCESS', message: access.error }
        });
      }
    }

    const [extractions] = await execute('SELECT * FROM evidence_metadata_extractions WHERE file_id = ? ORDER BY created_at DESC', [fileId]);
    const [artifacts] = await execute('SELECT * FROM evidence_derived_artifacts WHERE parent_file_id = ? ORDER BY created_at DESC', [fileId]);

    res.json({
      success: true,
      data: {
        file,
        latest_extraction: extractions[0] || null,
        extractions,
        derived_artifacts: artifacts
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Securely streams file for download with Content-Disposition attachment.
 */
exports.downloadFile = async (req, res, next) => {
  try {
    const fileId = parseInt(req.params.fileId, 10);
    const [files] = await execute('SELECT * FROM evidence_files WHERE file_id = ?', [fileId]);
    if (!files || files.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'FILE_NOT_FOUND', message: `Evidence file #${fileId} not found in database.` }
      });
    }

    const file = files[0];
    if (req.officer) {
      const access = await verifyCaseAccess(req.officer, file.case_id);
      if (!access.authorized) {
        return res.status(access.status).json({
          success: false,
          error: { code: 'FORBIDDEN_CASE_ACCESS', message: access.error }
        });
      }
    }

    let filePath;
    try {
      filePath = vaultService.resolveVaultPath(file.case_id, file.storage_key, false);
    } catch (pathErr) {
      return res.status(403).json({
        success: false,
        error: { code: 'PATH_TRAVERSAL_BLOCKED', message: pathErr.message }
      });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: { code: 'FILE_MISSING_ON_DISK', message: 'Physical evidence file is missing from vault storage volume.' }
      });
    }

    res.setHeader('Content-Type', file.detected_mime_type || file.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${file.sanitized_filename}"`);
    res.setHeader('X-Evidence-SHA256', file.sha256_hash);
    res.setHeader('X-Evidence-Integrity', file.integrity_status);

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
};

/**
 * Securely streams file inline for browser preview (image, PDF, audio, video, text).
 */
exports.previewFile = async (req, res, next) => {
  try {
    const fileId = parseInt(req.params.fileId, 10);
    const [files] = await execute('SELECT * FROM evidence_files WHERE file_id = ?', [fileId]);
    if (!files || files.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'FILE_NOT_FOUND', message: 'Evidence file not found.' }
      });
    }

    const file = files[0];
    if (req.officer) {
      const access = await verifyCaseAccess(req.officer, file.case_id);
      if (!access.authorized) {
        return res.status(access.status).json({
          success: false,
          error: { code: 'FORBIDDEN_CASE_ACCESS', message: access.error }
        });
      }
    }

    const filePath = vaultService.resolveVaultPath(file.case_id, file.storage_key, false);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: { code: 'FILE_MISSING_ON_DISK', message: 'Physical file is not present on disk.' }
      });
    }

    res.setHeader('Content-Type', file.detected_mime_type || file.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${file.sanitized_filename}"`);
    res.setHeader('X-Evidence-SHA256', file.sha256_hash);

    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    next(error);
  }
};

/**
 * Recalculates SHA-256 over physical file on disk and verifies integrity.
 */
exports.verifyVaultFileIntegrity = async (req, res, next) => {
  try {
    const fileId = parseInt(req.params.fileId, 10);
    const officer_id = req.officer ? req.officer.officer_id : 1;

    const [files] = await execute('SELECT * FROM evidence_files WHERE file_id = ?', [fileId]);
    if (!files || files.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'FILE_NOT_FOUND', message: `Evidence file #${fileId} not found.` }
      });
    }

    const file = files[0];
    if (req.officer) {
      const access = await verifyCaseAccess(req.officer, file.case_id);
      if (!access.authorized) {
        return res.status(access.status).json({
          success: false,
          error: { code: 'FORBIDDEN_CASE_ACCESS', message: access.error }
        });
      }
    }

    const filePath = vaultService.resolveVaultPath(file.case_id, file.storage_key, false);

    // 1. Check if file is missing on disk
    if (!fs.existsSync(filePath)) {
      await execute(
        'UPDATE evidence_files SET integrity_status = ?, last_verified_at = NOW() WHERE file_id = ?',
        ['FILE_MISSING', fileId]
      );
      await execute(
        `INSERT INTO evidence_integrity_verifications 
         (evidence_id, case_id, officer_id, recalculated_hash, recorded_hash, match_status, fingerprint_type, notes, ip_address)
         VALUES (?, ?, ?, 'FILE_MISSING', ?, 'MISMATCH', 'ORIGINAL_FILE', 'Physical file missing from storage disk', ?)`,
        [file.evidence_id, file.case_id, officer_id, file.sha256_hash, req.ip || '127.0.0.1']
      );

      return res.status(200).json({
        success: true,
        data: {
          file_id: fileId,
          integrity_status: 'FILE_MISSING',
          match: false,
          message: 'CRITICAL ALERT: Physical evidence file missing from vault storage disk!'
        }
      });
    }

    // 2. Stream recalculated SHA-256
    const { sha256_hash: liveHash } = await cryptoService.calculateFileSha256(filePath);
    const isMatch = (liveHash.toLowerCase() === file.sha256_hash.toLowerCase());
    const newStatus = isMatch ? 'INTACT' : 'TAMPERED_MISMATCH';

    // 3. Update File Record
    await execute(
      'UPDATE evidence_files SET integrity_status = ?, last_verified_at = NOW() WHERE file_id = ?',
      [newStatus, fileId]
    );

    // Also update parent evidence record
    await execute(
      'UPDATE evidence SET integrity_status = ?, last_verified_at = NOW() WHERE evidence_id = ?',
      [newStatus, file.evidence_id]
    );

    // 4. Record Verification Attempt
    await execute(
      `INSERT INTO evidence_integrity_verifications 
       (evidence_id, case_id, officer_id, recalculated_hash, recorded_hash, match_status, fingerprint_type, notes, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, 'ORIGINAL_FILE', ?, ?)`,
      [
        file.evidence_id,
        file.case_id,
        officer_id,
        liveHash,
        file.sha256_hash,
        isMatch ? 'MATCH' : 'MISMATCH',
        isMatch ? 'Physical file byte-level hash match confirmed.' : 'CRITICAL ALERT: File bytes modified on disk.',
        req.ip || '127.0.0.1'
      ]
    );

    // 5. Append Chained Audit Log
    const [priorLogs] = await execute(
      'SELECT current_event_hash FROM evidence_audit_logs WHERE evidence_id = ? ORDER BY created_at ASC, audit_id ASC',
      [file.evidence_id]
    );
    const prevEventHash = (priorLogs && priorLogs.length > 0)
      ? priorLogs[priorLogs.length - 1].current_event_hash
      : cryptoService.GENESIS_HASH;

    const eventTime = new Date().toISOString();
    const eventParams = {
      previous_event_hash: prevEventHash,
      evidence_id: file.evidence_id,
      case_id: file.case_id,
      officer_id,
      action_type: 'INTEGRITY_VERIFIED',
      created_at: eventTime,
      previous_state_hash: file.sha256_hash,
      current_state_hash: liveHash,
      reason_for_change: isMatch ? 'Routine forensic vault verification: intact.' : 'TAMPER ALERT: File on disk has altered content.'
    };
    const currentEventHash = cryptoService.calculateEventHash(eventParams);

    await execute(
      `INSERT INTO evidence_audit_logs 
       (evidence_id, case_id, officer_id, action_type, previous_state, new_state, 
        previous_state_hash, current_state_hash, previous_event_hash, current_event_hash, 
        canonical_payload, reason_for_change, ip_address, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        file.evidence_id,
        file.case_id,
        officer_id,
        'INTEGRITY_VERIFIED',
        JSON.stringify({ integrity_status: file.integrity_status, sha256_hash: file.sha256_hash }),
        JSON.stringify({ integrity_status: newStatus, live_hash: liveHash, match: isMatch }),
        file.sha256_hash,
        liveHash,
        prevEventHash,
        currentEventHash,
        JSON.stringify(eventParams),
        eventParams.reason_for_change,
        req.ip || '127.0.0.1',
        eventTime
      ]
    );

    res.json({
      success: true,
      data: {
        file_id: fileId,
        evidence_id: file.evidence_id,
        recorded_hash: file.sha256_hash,
        recalculated_hash: liveHash,
        integrity_status: newStatus,
        match: isMatch,
        verified_at: eventTime,
        message: isMatch
          ? 'Physical vault file verified INTACT. SHA-256 byte-level hash matches recorded signature.'
          : 'CRITICAL ALERT: File modification detected. Stored bytes do not match recorded fingerprint.'
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Generates a controlled derived artifact for an evidence file (Stage 6).
 */
exports.createDerivedArtifact = async (req, res, next) => {
  try {
    const fileId = parseInt(req.params.fileId, 10);
    const { artifact_type, notes } = req.body;
    const officer_id = req.officer ? req.officer.officer_id : 1;

    if (!artifact_type) {
      return res.status(400).json({
        success: false,
        error: { code: 'ARTIFACT_TYPE_REQUIRED', message: 'artifact_type is required (EXTRACTED_TEXT, NORMALIZED_DATA, THUMBNAIL, PREVIEW_IMAGE).' }
      });
    }

    const [files] = await execute('SELECT * FROM evidence_files WHERE file_id = ?', [fileId]);
    if (!files || files.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'FILE_NOT_FOUND', message: `Evidence file #${fileId} not found.` }
      });
    }

    const file = files[0];
    if (req.officer) {
      const access = await verifyCaseAccess(req.officer, file.case_id);
      if (!access.authorized) {
        return res.status(access.status).json({
          success: false,
          error: { code: 'FORBIDDEN_CASE_ACCESS', message: access.error }
        });
      }
    }

    const artifactData = await artifactService.generateDerivedArtifact(file, artifact_type, {
      officer_id,
      notes
    });

    const [insertResult] = await execute(
      `INSERT INTO evidence_derived_artifacts 
       (parent_file_id, evidence_id, case_id, artifact_type, storage_key, storage_path,
        mime_type, file_size_bytes, sha256_hash, generator_tool, generator_version,
        transformation_summary, created_by_officer_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        artifactData.parent_file_id,
        artifactData.evidence_id,
        artifactData.case_id,
        artifactData.artifact_type,
        artifactData.storage_key,
        artifactData.storage_path,
        artifactData.mime_type,
        artifactData.file_size_bytes,
        artifactData.sha256_hash,
        artifactData.generator_tool,
        artifactData.generator_version,
        artifactData.transformation_summary,
        artifactData.created_by_officer_id
      ]
    );

    artifactData.artifact_id = insertResult.insertId;

    res.status(201).json({
      success: true,
      data: artifactData
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Downloads a derived artifact file.
 */
exports.downloadDerivedArtifact = async (req, res, next) => {
  try {
    const artifactId = parseInt(req.params.artifactId, 10);
    const [artifacts] = await execute('SELECT * FROM evidence_derived_artifacts WHERE artifact_id = ?', [artifactId]);
    if (!artifacts || artifacts.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'ARTIFACT_NOT_FOUND', message: `Derived artifact #${artifactId} not found.` }
      });
    }

    const art = artifacts[0];
    if (req.officer) {
      const access = await verifyCaseAccess(req.officer, art.case_id);
      if (!access.authorized) {
        return res.status(access.status).json({
          success: false,
          error: { code: 'FORBIDDEN_CASE_ACCESS', message: access.error }
        });
      }
    }

    const filePath = vaultService.resolveVaultPath(art.case_id, art.storage_key, true);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: { code: 'ARTIFACT_MISSING_ON_DISK', message: 'Derived artifact file missing from storage disk.' }
      });
    }

    res.setHeader('Content-Type', art.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${art.storage_key}"`);
    res.setHeader('X-Artifact-SHA256', art.sha256_hash);

    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    next(error);
  }
};

/**
 * Allows an officer to review and annotate automated extraction metadata (Stage 5).
 */
exports.reviewExtraction = async (req, res, next) => {
  try {
    const extractionId = parseInt(req.params.extractionId, 10);
    const { review_notes, approved } = req.body;

    const [extractions] = await execute('SELECT * FROM evidence_metadata_extractions WHERE extraction_id = ?', [extractionId]);
    if (!extractions || extractions.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'EXTRACTION_NOT_FOUND', message: `Metadata extraction #${extractionId} not found.` }
      });
    }

    const ext = extractions[0];
    if (req.officer) {
      const access = await verifyCaseAccess(req.officer, ext.case_id);
      if (!access.authorized) {
        return res.status(access.status).json({
          success: false,
          error: { code: 'FORBIDDEN_CASE_ACCESS', message: access.error }
        });
      }
    }

    const reviewed = approved !== undefined ? (approved ? 1 : 0) : 1;
    await execute(
      'UPDATE evidence_metadata_extractions SET officer_reviewed = ?, review_notes = ? WHERE extraction_id = ?',
      [reviewed, review_notes || 'Reviewed and verified by officer', extractionId]
    );

    res.json({
      success: true,
      data: {
        extraction_id: extractionId,
        officer_reviewed: Boolean(reviewed),
        review_notes: review_notes || 'Reviewed and verified by officer'
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Searches evidence vault files with filters (Stage 8).
 */
exports.searchVaultFiles = async (req, res, next) => {
  try {
    const { case_id, file_format, integrity_status, q } = req.query;
    let sql = `
      SELECT f.*, e.tracking_code, e.title AS evidence_title, e.category AS evidence_category,
             o.full_name AS uploaded_by_officer_name, o.badge_number AS uploaded_by_badge
      FROM evidence_files f
      LEFT JOIN evidence e ON f.evidence_id = e.evidence_id
      LEFT JOIN officers o ON f.uploaded_by_officer_id = o.officer_id
      WHERE 1=1
    `;
    const params = [];

    if (case_id) {
      sql += ' AND f.case_id = ?';
      params.push(parseInt(case_id, 10));
    }
    if (file_format) {
      sql += ' AND f.file_extension = ?';
      const cleanExt = file_format.startsWith('.') ? file_format.toLowerCase() : `.${file_format.toLowerCase()}`;
      params.push(cleanExt);
    }
    if (integrity_status) {
      sql += ' AND f.integrity_status = ?';
      params.push(integrity_status);
    }
    if (q) {
      sql += ' AND (f.original_filename LIKE ? OR e.title LIKE ? OR e.tracking_code LIKE ?)';
      const pattern = `%${q}%`;
      params.push(pattern, pattern, pattern);
    }

    sql += ' ORDER BY f.upload_timestamp DESC';

    const [rows] = await execute(sql, params);

    res.json({
      success: true,
      total_matches: rows.length,
      data: rows
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @file artifactService.js
 * @description Generates and manages controlled derived forensic artifacts
 * (e.g. extracted text from PDF/TXT, normalized JSON from CSV, preview images).
 * All artifacts are cryptographically hashed and linked to their parent evidence file.
 * @project CASETHREAD - Phase 8 Derived Artifact Management
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vaultService = require('./vaultService');
const cryptoService = require('./cryptoService');

const GENERATOR_TOOL = 'CaseThread-ArtifactEngine';
const GENERATOR_VERSION = 'v1.0.0';

/**
 * Generates a derived artifact from a parent evidence file.
 * 
 * @param {Object} parentFile Record from evidence_files
 * @param {string} artifactType 'EXTRACTED_TEXT' | 'NORMALIZED_DATA' | 'THUMBNAIL' | 'PREVIEW_IMAGE'
 * @param {Object} options Additional options (officer_id, notes)
 * @returns {Promise<Object>} Created artifact descriptor
 */
async function generateDerivedArtifact(parentFile, artifactType, options = {}) {
  const caseId = parentFile.case_id;
  const originalPath = vaultService.resolveVaultPath(caseId, parentFile.storage_key, false);

  if (!fs.existsSync(originalPath)) {
    throw new Error(`Parent evidence file not found on disk at: ${originalPath}`);
  }

  const { artifactsDir } = vaultService.ensureCaseVault(caseId);
  const ext = parentFile.file_extension.toLowerCase();
  let artifactBuffer = null;
  let artifactExt = '.txt';
  let mimeType = 'text/plain';
  let summary = '';

  const originalBuffer = fs.readFileSync(originalPath);

  switch (artifactType) {
    case 'EXTRACTED_TEXT': {
      if (ext === '.pdf') {
        const rawContent = originalBuffer.toString('binary');
        // Extract text streams enclosed in BT ... ET or stream objects
        const streamMatches = rawContent.match(/stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g) || [];
        let extracted = '';
        for (const s of streamMatches) {
          const textMatches = s.match(/\(([^)]+)\)\s*Tj/g) || [];
          for (const t of textMatches) {
            const clean = t.replace(/\)\s*Tj$/, '').replace(/^\(/, '');
            extracted += clean + ' ';
          }
        }
        if (!extracted.trim()) {
          // Fallback to text patterns or raw ASCII lines
          const asciiLines = rawContent.replace(/[\x00-\x08\x0B-\x1F\x7F-\xFF]/g, ' ')
            .split(/\n+/)
            .filter(l => l.trim().length > 10);
          extracted = asciiLines.slice(0, 50).join('\n');
        }
        artifactBuffer = Buffer.from(extracted || 'Document text stream empty or compressed.', 'utf8');
        summary = `Extracted text stream from PDF (${artifactBuffer.length} bytes extracted).`;
      } else if (ext === '.csv' || ext === '.txt' || ext === '.json' || ext === '.xml') {
        artifactBuffer = originalBuffer;
        summary = `Plaintext extraction preserved from ${ext.toUpperCase()} file.`;
      } else {
        artifactBuffer = Buffer.from(`Binary file inspection: no text streams available for format ${ext}.`, 'utf8');
        summary = `Text extraction placeholder for binary format ${ext}.`;
      }
      artifactExt = '.txt';
      mimeType = 'text/plain';
      break;
    }

    case 'NORMALIZED_DATA': {
      if (ext === '.csv') {
        const text = originalBuffer.toString('utf8');
        const lines = text.split(/\r\n|\r|\n/).filter(l => l.trim().length > 0);
        const headers = (lines[0] || '').split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
        const rows = lines.slice(1).map(line => {
          const vals = line.split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
          const rowObj = {};
          headers.forEach((h, idx) => {
            rowObj[h || `col_${idx + 1}`] = vals[idx] !== undefined ? vals[idx] : null;
          });
          return rowObj;
        });

        const normalizedJson = JSON.stringify({
          source_file: parentFile.original_filename,
          normalized_at: new Date().toISOString(),
          record_count: rows.length,
          columns: headers,
          records: rows
        }, null, 2);

        artifactBuffer = Buffer.from(normalizedJson, 'utf8');
        artifactExt = '.json';
        mimeType = 'application/json';
        summary = `Normalized ${rows.length} tabular records into structured JSON.`;
      } else if (ext === '.json') {
        const parsed = JSON.parse(originalBuffer.toString('utf8'));
        const normalizedJson = JSON.stringify(cryptoService.canonicalize(parsed), null, 2);
        artifactBuffer = Buffer.from(normalizedJson, 'utf8');
        artifactExt = '.json';
        mimeType = 'application/json';
        summary = 'Canonicalized JSON property keys into deterministic order.';
      } else {
        throw new Error(`Normalization is not supported for ${ext} files.`);
      }
      break;
    }

    case 'PREVIEW_IMAGE':
    case 'THUMBNAIL': {
      // For images, generate preview descriptor or store scaled copy
      if (ext === '.png' || ext === '.jpg' || ext === '.jpeg') {
        artifactBuffer = originalBuffer; // In production this would be resized with Sharp/Canvas; here we preserve safe copy
        artifactExt = ext;
        mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
        summary = `Generated preview snapshot from ${parentFile.original_filename}.`;
      } else if (ext === '.mp4') {
        const previewInfo = JSON.stringify({
          preview_type: 'VIDEO_KEYFRAME_DESCRIPTOR',
          source_video: parentFile.original_filename,
          keyframe_timestamp: '00:00:01.000',
          container: 'MP4'
        }, null, 2);
        artifactBuffer = Buffer.from(previewInfo, 'utf8');
        artifactExt = '.json';
        mimeType = 'application/json';
        summary = `Video preview keyframe manifest generated for ${parentFile.original_filename}.`;
      } else {
        throw new Error(`Visual thumbnail generation not supported for ${ext} files.`);
      }
      break;
    }

    default:
      throw new Error(`Unsupported derived artifact type: ${artifactType}`);
  }

  // Generate unique artifact storage key
  const artifactStorageKey = `artifact_${Date.now()}_${crypto.randomBytes(6).toString('hex')}${artifactExt}`;
  const artifactFilePath = path.join(artifactsDir, artifactStorageKey);

  // Write artifact file to disk
  fs.writeFileSync(artifactFilePath, artifactBuffer);

  // Compute separate SHA-256 for the derived artifact
  const artifactHash = cryptoService.generateSha256(artifactBuffer);

  return {
    parent_file_id: parentFile.file_id,
    evidence_id: parentFile.evidence_id,
    case_id: parentFile.case_id,
    artifact_type: artifactType,
    storage_key: artifactStorageKey,
    storage_path: `cases/${caseId}/artifacts/${artifactStorageKey}`,
    mime_type: mimeType,
    file_size_bytes: artifactBuffer.length,
    sha256_hash: artifactHash,
    generator_tool: GENERATOR_TOOL,
    generator_version: GENERATOR_VERSION,
    transformation_summary: summary,
    created_by_officer_id: options.officer_id || 1,
    created_at: new Date().toISOString()
  };
}

module.exports = {
  GENERATOR_TOOL,
  GENERATOR_VERSION,
  generateDerivedArtifact
};

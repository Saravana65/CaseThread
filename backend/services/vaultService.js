/**
 * @file vaultService.js
 * @description Secure digital evidence file vault management, path traversal defenses,
 * magic-byte signature validation, and controlled streaming retrieval.
 * @project CASETHREAD - Phase 8 Evidence Acquisition & Secure Vault
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const VAULT_ROOT = process.env.EVIDENCE_VAULT_PATH 
  ? path.resolve(process.env.EVIDENCE_VAULT_PATH)
  : path.resolve(__dirname, '../storage/vault');

const MAX_FILE_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB || '50', 10);
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// Permitted extensions and standard MIME mappings
const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.txt', '.csv', '.jpg', '.jpeg', '.png',
  '.mp4', '.wav', '.mp3', '.json', '.xml'
]);

const EXTENSION_MIME_MAP = {
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.mp4': 'video/mp4',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.json': 'application/json',
  '.xml': 'application/xml'
};

/**
 * Initializes vault directory structure.
 */
function ensureVaultRoot() {
  if (!fs.existsSync(VAULT_ROOT)) {
    fs.mkdirSync(VAULT_ROOT, { recursive: true });
  }
}

/**
 * Ensures case-specific storage folders exist outside public web root.
 * @param {number|string} caseId
 * @returns {{ originalsDir: string, artifactsDir: string }}
 */
function ensureCaseVault(caseId) {
  ensureVaultRoot();
  const caseDir = path.join(VAULT_ROOT, 'cases', String(caseId));
  const originalsDir = path.join(caseDir, 'originals');
  const artifactsDir = path.join(caseDir, 'artifacts');

  if (!fs.existsSync(originalsDir)) {
    fs.mkdirSync(originalsDir, { recursive: true });
  }
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  return { originalsDir, artifactsDir };
}

/**
 * Sanitizes an untrusted client filename to prevent path traversal and injection.
 * Strips path separators, null bytes, shell metacharacters, and controls.
 * @param {string} originalName
 * @returns {string} Safe sanitized filename
 */
function sanitizeFilename(originalName) {
  if (!originalName || typeof originalName !== 'string') {
    return 'evidence_file.bin';
  }

  // Strip path traversal sequences, directory components, and null bytes
  let sanitized = path.basename(originalName)
    .replace(/\0/g, '')
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/^\.+/, '') // remove leading dots (hidden files or ..)
    .trim();

  if (sanitized.length > 120) {
    const ext = path.extname(sanitized);
    const base = path.basename(sanitized, ext).substring(0, 100);
    sanitized = `${base}${ext}`;
  }

  return sanitized || 'evidence_file.bin';
}

/**
 * Validates actual binary signature (magic bytes) to prevent MIME spoofing.
 * Never trusts client-reported MIME type or extension alone.
 * 
 * @param {Buffer} buffer File header buffer (at least 64 bytes)
 * @param {string} extension Lowercase extension with dot (e.g. '.pdf')
 * @returns {{ valid: boolean, detectedMime: string, reason?: string }}
 */
function validateContentSignature(buffer, extension) {
  if (!buffer || buffer.length === 0) {
    return { valid: false, detectedMime: 'application/octet-stream', reason: 'File payload is empty (0 bytes).' };
  }

  const ext = extension.toLowerCase();

  // 1. PNG Signature: 89 50 4E 47 0D 0A 1A 0A
  if (ext === '.png') {
    if (buffer.length >= 8 &&
        buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47 &&
        buffer[4] === 0x0D && buffer[5] === 0x0A && buffer[6] === 0x1A && buffer[7] === 0x0A) {
      return { valid: true, detectedMime: 'image/png' };
    }
    return { valid: false, detectedMime: 'application/octet-stream', reason: 'Header magic bytes do not match PNG image format.' };
  }

  // 2. JPEG Signature: FF D8 FF
  if (ext === '.jpg' || ext === '.jpeg') {
    if (buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
      return { valid: true, detectedMime: 'image/jpeg' };
    }
    return { valid: false, detectedMime: 'application/octet-stream', reason: 'Header magic bytes do not match JPEG image format.' };
  }

  // 3. PDF Signature: %PDF- (25 50 44 46 2D)
  if (ext === '.pdf') {
    if (buffer.length >= 5 && buffer.toString('utf8', 0, 5) === '%PDF-') {
      return { valid: true, detectedMime: 'application/pdf' };
    }
    return { valid: false, detectedMime: 'application/octet-stream', reason: 'Header magic bytes do not match PDF document specification.' };
  }

  // 4. MP4 Signature: 'ftyp' box in bytes 4-11
  if (ext === '.mp4') {
    if (buffer.length >= 12 && buffer.toString('utf8', 4, 8) === 'ftyp') {
      return { valid: true, detectedMime: 'video/mp4' };
    }
    return { valid: false, detectedMime: 'application/octet-stream', reason: 'Header magic bytes do not match MP4 ISO Base Media format.' };
  }

  // 5. WAV Signature: RIFF....WAVE
  if (ext === '.wav') {
    if (buffer.length >= 12 &&
        buffer.toString('utf8', 0, 4) === 'RIFF' &&
        buffer.toString('utf8', 8, 12) === 'WAVE') {
      return { valid: true, detectedMime: 'audio/wav' };
    }
    return { valid: false, detectedMime: 'application/octet-stream', reason: 'Header magic bytes do not match WAV audio format.' };
  }

  // 6. MP3 Signature: ID3v2 tag or MPEG frame sync (FF FB / FF F3 / FF F2)
  if (ext === '.mp3') {
    if (buffer.length >= 3 && buffer.toString('utf8', 0, 3) === 'ID3') {
      return { valid: true, detectedMime: 'audio/mpeg' };
    }
    if (buffer.length >= 2 && buffer[0] === 0xFF && (buffer[1] & 0xE0) === 0xE0) {
      return { valid: true, detectedMime: 'audio/mpeg' };
    }
    return { valid: false, detectedMime: 'application/octet-stream', reason: 'Header magic bytes do not match MP3 audio stream.' };
  }

  // 7. JSON Signature: Valid JSON string starting with { or [
  if (ext === '.json') {
    const textSample = buffer.toString('utf8').trim();
    if (textSample.startsWith('{') || textSample.startsWith('[')) {
      try {
        JSON.parse(textSample);
        return { valid: true, detectedMime: 'application/json' };
      } catch (e) {
        return { valid: false, detectedMime: 'text/plain', reason: `Malformed JSON structure: ${e.message}` };
      }
    }
    return { valid: false, detectedMime: 'application/octet-stream', reason: 'File does not start with valid JSON object or array character.' };
  }

  // 8. XML Signature: Starts with <?xml or <tag>
  if (ext === '.xml') {
    const textSample = buffer.toString('utf8').trim();
    if (textSample.startsWith('<?xml') || textSample.startsWith('<')) {
      return { valid: true, detectedMime: 'application/xml' };
    }
    return { valid: false, detectedMime: 'application/octet-stream', reason: 'File does not start with valid XML markup root tag.' };
  }

  // 9. Plain Text & CSV: Must contain printable UTF-8 characters without binary control codes
  if (ext === '.txt' || ext === '.csv') {
    const checkLen = Math.min(buffer.length, 2048);
    for (let i = 0; i < checkLen; i++) {
      const byte = buffer[i];
      // Disallow null bytes and non-printable ASCII control codes (except CR, LF, Tab)
      if (byte === 0x00 || (byte < 0x08 && byte !== 0x00) || (byte > 0x0E && byte < 0x1F)) {
        return { valid: false, detectedMime: 'application/octet-stream', reason: 'File contains binary null or control bytes; text/CSV expected.' };
      }
    }
    return { valid: true, detectedMime: ext === '.csv' ? 'text/csv' : 'text/plain' };
  }

  return { valid: false, detectedMime: 'application/octet-stream', reason: `Unsupported file extension: ${ext}` };
}

/**
 * Generates an internal unique storage identifier.
 * Completely disassociates stored physical filename from client-provided filename.
 * @param {string} extension
 * @returns {string} Unique storage key
 */
function generateStorageKey(extension) {
  const safeExt = extension.toLowerCase().startsWith('.') ? extension.toLowerCase() : `.${extension.toLowerCase()}`;
  const timestamp = Date.now();
  const randomHex = crypto.randomBytes(8).toString('hex');
  return `vault_${timestamp}_${randomHex}${safeExt}`;
}

/**
 * Resolves safe absolute path for an evidence vault file and asserts that it cannot escape VAULT_ROOT.
 * @param {number|string} caseId
 * @param {string} storageKey
 * @param {boolean} isArtifact
 * @returns {string} Absolute resolved file path
 */
function resolveVaultPath(caseId, storageKey, isArtifact = false) {
  // Disallow any path traversal characters in storageKey
  if (!storageKey || storageKey.includes('..') || storageKey.includes('/') || storageKey.includes('\\')) {
    throw new Error('Invalid storage key: directory traversal characters forbidden.');
  }

  const { originalsDir, artifactsDir } = ensureCaseVault(caseId);
  const targetDir = isArtifact ? artifactsDir : originalsDir;
  const fullPath = path.resolve(targetDir, storageKey);

  // Assert boundary: target must be inside targetDir
  if (!fullPath.startsWith(path.resolve(targetDir))) {
    throw new Error('Access denied: Storage path traversal violation detected.');
  }

  return fullPath;
}

module.exports = {
  VAULT_ROOT,
  MAX_FILE_SIZE_MB,
  MAX_FILE_SIZE_BYTES,
  ALLOWED_EXTENSIONS,
  EXTENSION_MIME_MAP,
  ensureVaultRoot,
  ensureCaseVault,
  sanitizeFilename,
  validateContentSignature,
  generateStorageKey,
  resolveVaultPath
};

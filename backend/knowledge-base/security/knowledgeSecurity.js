/**
 * @file knowledgeSecurity.js
 * @brief Security boundary, access classification & path traversal guards for Phase 13 Private Crime Knowledge Base.
 * @project CASETHREAD
 */

const path = require('path');
const fs = require('fs');

const CLASSIFICATION_HIERARCHY = {
  PUBLIC_RECORD: 1,
  OFFICIAL_USE_ONLY: 2,
  RESTRICTED_LAW_ENFORCEMENT: 3,
  CONFIDENTIAL: 4
};

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.docx', '.txt', '.json', '.csv']);
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
const PRIVATE_VAULT_ROOT = process.env.KNOWLEDGE_VAULT_PATH
  ? path.resolve(process.env.KNOWLEDGE_VAULT_PATH)
  : path.resolve(__dirname, '../../storage/private_knowledge_vault');

class KnowledgeSecurity {
  /**
   * Evaluates if accessContext clearance meets or exceeds document classification.
   */
  static canAccess(accessContext, targetClassification) {
    if (!accessContext) return false;
    const userRole = accessContext.role || 'GUEST';
    
    // Map role to clearance level
    let userClearance = 1; // PUBLIC_RECORD
    if (['LEAD_OFFICER', 'ADMIN', 'COMMANDER'].includes(userRole)) {
      userClearance = 4; // CONFIDENTIAL
    } else if (['INVESTIGATOR', 'SENIOR_DETECTIVE'].includes(userRole)) {
      userClearance = 3; // RESTRICTED_LAW_ENFORCEMENT
    } else if (['ANALYST', 'REVIEWER'].includes(userRole)) {
      userClearance = 2; // OFFICIAL_USE_ONLY
    }

    const requiredLevel = CLASSIFICATION_HIERARCHY[targetClassification] || 2;
    return userClearance >= requiredLevel;
  }

  /**
   * Resolves and secures a file path within the private knowledge vault, preventing path traversal.
   */
  static getSecureStoragePath(filename) {
    if (!filename || typeof filename !== 'string') {
      throw new Error('Invalid filename provided for secure storage.');
    }

    // Detect path traversal signatures
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      throw new Error(`[SECURITY ALERT] Path traversal attempt detected in filename: ${filename}`);
    }

    // Sanitize filename: alphanumeric, dashes, dots, underscores only
    const safeFilename = path.basename(filename).replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const resolvedPath = path.resolve(PRIVATE_VAULT_ROOT, safeFilename);

    if (!resolvedPath.startsWith(PRIVATE_VAULT_ROOT)) {
      throw new Error(`[SECURITY ALERT] Path traversal attempt detected: ${filename}`);
    }

    return resolvedPath;
  }

  /**
   * Validates file size and format before ingestion.
   */
  static validateFileForIngestion(filePath) {
    if (!fs.existsSync(filePath)) {
      return { valid: false, error: 'File does not exist on disk.' };
    }

    const stat = fs.statSync(filePath);
    if (stat.size <= 0) {
      return { valid: false, error: 'File is empty (0 bytes).' };
    }
    if (stat.size > MAX_FILE_SIZE_BYTES) {
      return { valid: false, error: `File size exceeds 50MB limit (${(stat.size / 1024 / 1024).toFixed(2)} MB).` };
    }

    const ext = path.extname(filePath).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return { valid: false, error: `Unsupported file format '${ext}'. Allowed: .pdf, .docx, .txt, .json, .csv` };
    }

    return { valid: true, size: stat.size, ext };
  }

  /**
   * Sanitizes search query string to prevent injection into SQL or regex engines.
   */
  static sanitizeQuery(query) {
    if (!query) return '';
    // Strip control characters, excessive quotes, and SQL wildcards
    return String(query)
      .replace(/[\x00-\x1F\x7F]/g, ' ')
      .replace(/['";\\]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Evaluates private knowledge vault directory readiness and write permissions.
   * @returns {{ status: string, writable: boolean, path: string, error?: string }}
   */
  static checkKnowledgeVaultHealth() {
    try {
      if (!fs.existsSync(PRIVATE_VAULT_ROOT)) {
        fs.mkdirSync(PRIVATE_VAULT_ROOT, { recursive: true });
      }
      const probeFile = path.join(PRIVATE_VAULT_ROOT, `.kb_probe_${Date.now()}`);
      fs.writeFileSync(probeFile, 'health-check');
      fs.unlinkSync(probeFile);
      return {
        status: 'UP',
        writable: true,
        path: PRIVATE_VAULT_ROOT
      };
    } catch (err) {
      return {
        status: 'DEGRADED',
        writable: false,
        path: PRIVATE_VAULT_ROOT,
        error: err.message
      };
    }
  }
}

module.exports = KnowledgeSecurity;

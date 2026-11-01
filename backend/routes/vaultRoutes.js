/**
 * @file vaultRoutes.js
 * @description Routes for digital evidence vault operations, multipart file uploads,
 * streaming downloads, integrity verification, and metadata review.
 * @project CASETHREAD - Phase 8 Evidence Acquisition & Secure File Vault
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const vaultController = require('../controllers/vaultController');
const { authenticateToken } = require('../middleware/auth');
const vaultService = require('../services/vaultService');

// Multer memory storage configuration with size limit safeguard
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: vaultService.MAX_FILE_SIZE_BYTES
  }
});

// Middleware to handle multer file size error cleanly
function handleUploadErrors(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'FILE_TOO_LARGE',
          message: `Uploaded file exceeds maximum allowed limit of ${vaultService.MAX_FILE_SIZE_MB}MB.`
        }
      });
    }
    return res.status(400).json({
      success: false,
      error: { code: 'UPLOAD_ERROR', message: err.message }
    });
  }
  next(err);
}

// 1. Evidence Acquisition & File Upload
router.post(
  '/upload',
  authenticateToken,
  upload.single('file'),
  handleUploadErrors,
  vaultController.uploadEvidenceFile
);

// 2. Case Files Catalog & Search
router.get('/cases/:caseId/files', authenticateToken, vaultController.getFilesByCase);
router.get('/search', authenticateToken, vaultController.searchVaultFiles);

// 3. File Details, Streaming Download & Preview
router.get('/files/:fileId', authenticateToken, vaultController.getFileDetails);
router.get('/files/:fileId/download', authenticateToken, vaultController.downloadFile);
router.get('/files/:fileId/preview', authenticateToken, vaultController.previewFile);

// 4. Physical Integrity Recalculation
router.post('/files/:fileId/verify-integrity', authenticateToken, vaultController.verifyVaultFileIntegrity);

// 5. Derived Artifacts
router.post('/files/:fileId/artifacts', authenticateToken, vaultController.createDerivedArtifact);
router.get('/artifacts/:artifactId/download', authenticateToken, vaultController.downloadDerivedArtifact);

// 6. Metadata Review Workflow
router.post('/extractions/:extractionId/review', authenticateToken, vaultController.reviewExtraction);

module.exports = router;

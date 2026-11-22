/**
 * @file ingestPipeline.js
 * @brief End-to-end ingestion pipeline for Private Crime Knowledge Base.
 * Validates, deduplicates, extracts, chunks, securely stores, and indexes historical crime records.
 * @project CASETHREAD
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execute } = require('../../database/connection');
const KnowledgeSecurity = require('../security/knowledgeSecurity');
const ExtractorRegistry = require('../extractors/extractorRegistry');
const TextNormalizer = require('../normalization/textNormalizer');
const Chunker = require('../normalization/chunker');

class IngestPipeline {
  /**
   * Computes SHA-256 checksum of a file.
   */
  static async computeFileSha256(filePath) {
    const fileBuffer = await fs.promises.readFile(filePath);
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
  }

  /**
   * Resolves or creates a source record in knowledge_sources.
   */
  static async resolveSource({ sourceName, sourceType, jurisdiction, classification }) {
    const name = sourceName || 'Authorized Crime Knowledge Archive';
    const type = sourceType || 'AUTHORIZED_ARCHIVE';
    const juris = jurisdiction || 'India';
    const classLevel = classification || 'OFFICIAL_USE_ONLY';

    const [existing] = await execute(
      'SELECT source_id FROM knowledge_sources WHERE source_name = ? LIMIT 1',
      [name]
    );

    if (existing.length > 0) {
      return existing[0].source_id;
    }

    const [result] = await execute(
      `INSERT INTO knowledge_sources (source_name, source_type, jurisdiction, data_classification)
       VALUES (?, ?, ?, ?)`,
      [name, type, juris, classLevel]
    );

    return result.insertId;
  }

  /**
   * Ingests a single document file into the private knowledge base.
   * @param {string} filePath - Absolute or relative path to target document
   * @param {object} options
   * @param {string} options.sourceName - Name of the ingestion source
   * @param {string} options.sourceType - Enum value for source_type
   * @param {string} options.classification - Classification level (e.g. OFFICIAL_USE_ONLY)
   * @param {string} options.jurisdiction - Legal jurisdiction
   * @param {string} options.crimeCategory - Category of crime
   * @param {string} options.caseNumber - Case or docket reference number
   * @param {boolean} options.force - Force re-ingestion even if SHA-256 exists
   * @returns {Promise<object>} Ingestion result record
   */
  static async ingestFile(filePath, options = {}) {
    const resolvedPath = path.resolve(filePath);

    // 1. Validate file format and size
    const validation = KnowledgeSecurity.validateFileForIngestion(resolvedPath);
    if (!validation.valid) {
      return {
        status: 'REJECTED',
        filePath: resolvedPath,
        reason: validation.error
      };
    }

    // 2. Compute SHA-256 integrity hash
    const sha256 = await this.computeFileSha256(resolvedPath);

    // 3. Duplicate check against existing knowledge_documents
    const [existingDocs] = await execute(
      'SELECT document_id, document_title, original_sha256 FROM knowledge_documents WHERE original_sha256 = ?',
      [sha256]
    );

    if (existingDocs.length > 0) {
      if (!options.force) {
        return {
          status: 'DUPLICATE_SKIPPED',
          document_id: existingDocs[0].document_id,
          filePath: resolvedPath,
          sha256: sha256,
          reason: `Identical document already ingested (document_id: ${existingDocs[0].document_id})`
        };
      } else {
        // If force is requested, clean up existing document and cascade delete chunks
        await execute('DELETE FROM knowledge_documents WHERE document_id = ?', [existingDocs[0].document_id]);
      }
    }

    // 4. Extract content and metadata
    let extraction;
    try {
      extraction = await ExtractorRegistry.extract(resolvedPath);
    } catch (err) {
      return {
        status: 'EXTRACTION_FAILED',
        filePath: resolvedPath,
        sha256: sha256,
        reason: err.message
      };
    }

    // 5. Normalize text
    const cleanText = TextNormalizer.normalizeText(extraction.text);
    const wordCount = cleanText ? cleanText.split(/\s+/).filter(Boolean).length : 0;

    // 6. Split into chunks
    const chunks = Chunker.chunk(cleanText);

    // 7. Secure file copy to private knowledge vault
    const fileExt = path.extname(resolvedPath).toLowerCase();
    const originalFilename = path.basename(resolvedPath);
    const vaultFilename = `${sha256.slice(0, 16)}_${Date.now()}${fileExt}`;
    const secureStoragePath = KnowledgeSecurity.getSecureStoragePath(vaultFilename);

    // Ensure directory exists
    const vaultDir = path.dirname(secureStoragePath);
    if (!fs.existsSync(vaultDir)) {
      await fs.promises.mkdir(vaultDir, { recursive: true });
    }

    // Copy file
    await fs.promises.copyFile(resolvedPath, secureStoragePath);

    // 8. Resolve source record
    const sourceId = await this.resolveSource({
      sourceName: options.sourceName,
      sourceType: options.sourceType,
      jurisdiction: options.jurisdiction || extraction.metadata?.jurisdiction,
      classification: options.classification
    });

    // 9. Document metadata fields
    const docTitle = options.title || extraction.metadata?.title || originalFilename.replace(/\.[^/.]+$/, '');
    const docTypeEnum = fileExt.replace('.', '').toUpperCase();
    const caseRef = options.caseNumber || extraction.metadata?.case_number || null;
    const jurisdiction = options.jurisdiction || extraction.metadata?.jurisdiction || 'India';
    const crimeCategory = options.crimeCategory || extraction.metadata?.crime_category || 'General Criminal Law';
    const caseOutcome = options.caseOutcome || extraction.metadata?.verdict || null;
    const isOcrRequired = !!extraction.is_ocr_required;
    const classification = options.classification || 'OFFICIAL_USE_ONLY';

    // 10. Insert knowledge_documents row
    const [docResult] = await execute(`
      INSERT INTO knowledge_documents (
        source_id, document_title, original_filename, document_type,
        publication_date, case_reference_number, jurisdiction,
        crime_category, case_outcome, original_sha256, storage_path,
        file_size_bytes, page_count, word_count, is_ocr_required,
        structured_metadata, ingestion_status, last_processed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PROCESSED', NOW())
    `, [
      sourceId,
      docTitle,
      originalFilename,
      docTypeEnum,
      extraction.metadata?.creation_date ? new Date() : null,
      caseRef,
      jurisdiction,
      crimeCategory,
      caseOutcome,
      sha256,
      secureStoragePath,
      validation.size,
      extraction.metadata?.page_count || 1,
      wordCount,
      isOcrRequired,
      JSON.stringify(extraction.metadata || {})
    ]);

    const documentId = docResult.insertId;

    // 11. Insert knowledge_chunks rows
    let insertedChunks = 0;
    for (const chunk of chunks) {
      await execute(`
        INSERT INTO knowledge_chunks (
          document_id, chunk_index, chunk_text, page_number,
          section_reference, searchable_metadata, access_classification
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        documentId,
        chunk.chunk_index,
        chunk.chunk_text,
        chunk.page_number,
        chunk.section_reference,
        JSON.stringify({ char_length: chunk.char_length }),
        classification
      ]);
      insertedChunks++;
    }

    return {
      status: 'SUCCESS',
      document_id: documentId,
      source_id: sourceId,
      title: docTitle,
      filename: originalFilename,
      chunks_created: insertedChunks,
      word_count: wordCount,
      sha256: sha256,
      is_ocr_required: isOcrRequired,
      classification: classification
    };
  }
}

module.exports = IngestPipeline;

/**
 * @file ingestPipeline.js
 * @brief End-to-end ingestion pipeline for Worldwide Private Crime Knowledge Base.
 * Validates, deduplicates, extracts, chunks, securely stores, and indexes historical crime records.
 * Supports both raw document files (.txt, .json, .csv, .pdf, .docx) and structured connector feeds.
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
const LanguageDetector = require('../multilingual/languageDetector');
const TranslationManager = require('../multilingual/translationManager');
const GlobalDeduplicator = require('../deduplication/globalDeduplicator');

class IngestPipeline {
  /**
   * Computes SHA-256 checksum of a file.
   */
  static async computeFileSha256(filePath) {
    const fileBuffer = await fs.promises.readFile(filePath);
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
  }

  /**
   * Computes SHA-256 checksum of raw string or buffer.
   */
  static computeStringSha256(content) {
    return crypto.createHash('sha256').update(Buffer.from(content, 'utf8')).digest('hex');
  }

  /**
   * Resolves or creates a source record in knowledge_sources.
   */
  static async resolveSource({ sourceName, sourceType, jurisdiction, country, classification, reliability, updateFrequency }) {
    const name = sourceName || 'Authorized Crime Knowledge Archive';
    const type = sourceType || 'AUTHORIZED_ARCHIVE';
    const juris = jurisdiction || 'General Jurisdiction';
    const ctry = country || 'Global';
    const classLevel = classification || 'OFFICIAL_USE_ONLY';
    const rel = reliability || 'OFFICIAL_GOVERNMENT';
    const freq = updateFrequency || 'MONTHLY';

    const [existing] = await execute(
      'SELECT source_id FROM knowledge_sources WHERE source_name = ? LIMIT 1',
      [name]
    );

    if (existing.length > 0) {
      // Update last_sync_at
      await execute('UPDATE knowledge_sources SET last_sync_at = NOW() WHERE source_id = ?', [existing[0].source_id]);
      return existing[0].source_id;
    }

    const [result] = await execute(
      `INSERT INTO knowledge_sources (source_name, source_type, jurisdiction, country, data_classification, source_reliability, update_frequency, last_sync_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [name, type, juris, ctry, classLevel, rel, freq]
    );

    return result.insertId;
  }

  /**
   * Ingests a single document file (.txt, .json, .csv, .pdf, .docx) into the knowledge base.
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

    // 5. Language detection & normalization
    const cleanText = TextNormalizer.normalizeText(extraction.text);
    const langInfo = LanguageDetector.detectLanguage(cleanText);
    const transResult = TranslationManager.processTranslation({
      text: cleanText,
      declaredLanguage: langInfo.language
    });

    const wordCount = cleanText ? cleanText.split(/\s+/).filter(Boolean).length : 0;

    // 6. Split into chunks
    const chunks = Chunker.chunk(cleanText);

    // 7. Secure file copy to private knowledge vault
    const fileExt = path.extname(resolvedPath).toLowerCase();
    const originalFilename = path.basename(resolvedPath);
    const vaultFilename = `${sha256.slice(0, 16)}_${Date.now()}${fileExt}`;
    const secureStoragePath = KnowledgeSecurity.getSecureStoragePath(vaultFilename);

    const vaultDir = path.dirname(secureStoragePath);
    if (!fs.existsSync(vaultDir)) {
      await fs.promises.mkdir(vaultDir, { recursive: true });
    }
    await fs.promises.copyFile(resolvedPath, secureStoragePath);

    // 8. Resolve source record
    const sourceCountry = options.country || extraction.metadata?.country || 'India';
    const sourceName = extraction.metadata?.publisher && (!options.sourceName || options.sourceName === 'Administrative File Import')
      ? `${extraction.metadata.publisher} (${sourceCountry})`
      : options.sourceName;
    const sourceId = await this.resolveSource({
      sourceName,
      sourceType: options.sourceType,
      jurisdiction: options.jurisdiction || extraction.metadata?.jurisdiction,
      country: sourceCountry,
      classification: options.classification
    });

    // 9. Document metadata fields
    const docTitle = options.title || extraction.metadata?.title || originalFilename.replace(/\.[^/.]+$/, '');
    const docTypeEnum = fileExt.replace('.', '').toUpperCase();
    const caseRef = options.caseNumber || extraction.metadata?.case_number || null;
    const jurisdiction = options.jurisdiction || extraction.metadata?.jurisdiction || 'General Jurisdiction';
    const crimeCategory = options.crimeCategory || extraction.metadata?.crime_category || 'General Criminal Law';
    const caseOutcome = options.caseOutcome || extraction.metadata?.verdict || null;
    const isOcrRequired = !!extraction.is_ocr_required;
    const classification = options.classification || 'OFFICIAL_USE_ONLY';

    // 10. Insert knowledge_documents row
    const [docResult] = await execute(`
      INSERT INTO knowledge_documents (
        source_id, document_title, original_filename, document_type,
        publication_date, case_reference_number, country, region_state,
        city, jurisdiction, crime_category, case_outcome, original_sha256,
        storage_path, file_size_bytes, page_count, word_count, is_ocr_required,
        language, translated_text, translation_status, record_level,
        stolen_property, crime_subtype, investigative_actions, is_investigation_details_available, documented_circumstances,
        structured_metadata, ingestion_status, last_processed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CASE_LEVEL', ?, ?, ?, ?, ?, ?, 'PROCESSED', NOW())
    `, [
      sourceId,
      docTitle,
      originalFilename,
      docTypeEnum,
      extraction.metadata?.creation_date ? new Date() : null,
      caseRef,
      sourceCountry,
      options.region_state || null,
      options.city || null,
      jurisdiction,
      crimeCategory,
      caseOutcome,
      sha256,
      secureStoragePath,
      validation.size,
      extraction.metadata?.page_count || 1,
      wordCount,
      isOcrRequired,
      transResult.language,
      transResult.translatedText,
      transResult.translationStatus,
      extraction.metadata?.stolen_property || null,
      extraction.metadata?.crime_subtype || null,
      extraction.metadata?.investigative_actions || null,
      Boolean(extraction.metadata?.investigative_actions),
      extraction.metadata?.summary || null,
      JSON.stringify(extraction.metadata || {})
    ]);

    const documentId = docResult.insertId;

    // 11. Insert knowledge_chunks rows
    let insertedChunks = 0;
    for (const chunk of chunks) {
      await execute(`
        INSERT INTO knowledge_chunks (
          document_id, chunk_index, chunk_text, page_number,
          section_reference, language, searchable_metadata, access_classification
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        documentId,
        chunk.chunk_index,
        chunk.chunk_text,
        chunk.page_number,
        chunk.section_reference,
        transResult.language,
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
      classification: classification,
      country: sourceCountry,
      language: transResult.language
    };
  }

  /**
   * Ingests a structured global crime record produced by an operational source connector.
   * @param {object} record - Adapted record from RecordAdapter
   * @param {object} options
   */
  static async ingestGlobalRecord(record, options = {}) {
    // 1. Data quality check
    const quality = GlobalDeduplicator.validateQuality(record);
    if (!quality.isValid && quality.qualityScore < 40) {
      return {
        status: 'REJECTED_LOW_QUALITY',
        caseRef: record.case_reference_number,
        issues: quality.issues
      };
    }

    // 2. Cross-source duplicate check
    const dupCheck = await GlobalDeduplicator.checkCrossSourceDuplicate(record);
    if (dupCheck.isDuplicate && !options.force) {
      return {
        status: 'DUPLICATE_SKIPPED',
        caseRef: record.case_reference_number,
        existingDocumentId: dupCheck.existingDocumentId,
        existingSource: dupCheck.existingSource,
        hasConflicts: dupCheck.hasConflicts,
        conflicts: dupCheck.conflicts
      };
    }

    // 3. Serialize raw payload into private knowledge vault
    const payloadString = JSON.stringify(record.raw_payload || record, null, 2);
    const sha256 = this.computeStringSha256(payloadString);

    // Exact hash duplicate check
    const [existingDocs] = await execute(
      'SELECT document_id FROM knowledge_documents WHERE original_sha256 = ?',
      [sha256]
    );

    if (existingDocs.length > 0) {
      if (!options.force) {
        return {
          status: 'DUPLICATE_SKIPPED',
          document_id: existingDocs[0].document_id,
          reason: 'Exact SHA-256 duplicate already exists.'
        };
      } else {
        await execute('DELETE FROM knowledge_documents WHERE document_id = ?', [existingDocs[0].document_id]);
      }
    }

    const filename = `${sha256.slice(0, 16)}_${Date.now()}.json`;
    const secureStoragePath = KnowledgeSecurity.getSecureStoragePath(filename);
    const vaultDir = path.dirname(secureStoragePath);
    if (!fs.existsSync(vaultDir)) {
      await fs.promises.mkdir(vaultDir, { recursive: true });
    }
    await fs.promises.writeFile(secureStoragePath, payloadString, 'utf8');

    // 4. Resolve source
    const sourceId = await this.resolveSource({
      sourceName: options.sourceName || record.source_name || `${record.country} Crime Data Source`,
      sourceType: options.sourceType || 'GOVERNMENT_OPEN_DATA',
      jurisdiction: record.jurisdiction,
      country: record.country,
      classification: options.classification || 'OFFICIAL_USE_ONLY',
      reliability: record.source_reliability || 'OFFICIAL_GOVERNMENT'
    });

    // 5. Language & translation
    const fullNarrative = `${record.document_title}\n\n${record.documented_circumstances || ''}\n\n${record.investigative_actions || ''}`.trim();
    const cleanText = TextNormalizer.normalizeText(fullNarrative);
    const detectedLang = LanguageDetector.detectLanguage(cleanText);
    const trans = TranslationManager.processTranslation({
      text: cleanText,
      declaredLanguage: record.language || detectedLang.language
    });

    const wordCount = cleanText ? cleanText.split(/\s+/).filter(Boolean).length : 0;
    const classification = options.classification || 'OFFICIAL_USE_ONLY';

    // 6. Insert knowledge_documents
    const [docResult] = await execute(`
      INSERT INTO knowledge_documents (
        source_id, document_title, original_filename, document_type,
        publication_date, case_reference_number, country, region_state,
        city, jurisdiction, crime_category, crime_subtype, incident_datetime,
        case_outcome, stolen_property, property_recovered, documented_circumstances,
        investigation_status, investigative_actions, evidence_types,
        is_investigation_details_available, language, translated_text,
        translation_status, record_level, original_sha256, storage_path,
        file_size_bytes, page_count, word_count, is_ocr_required,
        structured_metadata, ingestion_status, last_processed_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PROCESSED', NOW()
      )
    `, [
      sourceId,
      record.document_title,
      `${record.case_reference_number}.json`,
      'JSON',
      record.publication_date || new Date(),
      record.case_reference_number,
      record.country,
      record.region_state || null,
      record.city || null,
      record.jurisdiction,
      record.crime_category,
      record.crime_subtype || null,
      record.incident_datetime || null,
      record.case_outcome || null,
      record.stolen_property || null,
      record.property_recovered !== undefined ? record.property_recovered : null,
      record.documented_circumstances || null,
      record.investigation_status || null,
      record.investigative_actions || null,
      record.evidence_types || null,
      !!record.is_investigation_details_available,
      trans.language,
      trans.translatedText,
      trans.translationStatus,
      record.record_level || 'CASE_LEVEL',
      sha256,
      secureStoragePath,
      Buffer.byteLength(payloadString, 'utf8'),
      1,
      wordCount,
      false,
      JSON.stringify({ source_url: record.source_url || null, raw_metadata: record.raw_payload || {} })
    ]);

    const documentId = docResult.insertId;

    // 7. Create searchable chunks
    const chunks = Chunker.chunk(cleanText);
    let chunksCreated = 0;
    for (const chunk of chunks) {
      await execute(`
        INSERT INTO knowledge_chunks (
          document_id, chunk_index, chunk_text, page_number,
          section_reference, language, searchable_metadata, access_classification
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        documentId,
        chunk.chunk_index,
        chunk.chunk_text,
        chunk.page_number,
        chunk.section_reference,
        trans.language,
        JSON.stringify({ char_length: chunk.char_length }),
        classification
      ]);
      chunksCreated++;
    }

    return {
      status: 'SUCCESS',
      document_id: documentId,
      source_id: sourceId,
      case_reference_number: record.case_reference_number,
      country: record.country,
      crime_category: record.crime_category,
      chunks_created: chunksCreated,
      sha256: sha256
    };
  }
}

module.exports = IngestPipeline;

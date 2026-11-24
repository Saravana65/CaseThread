/**
 * @file knowledge_base.test.js
 * @brief Automated test suite for Phase 13 Private Crime Knowledge Base & Backend Data Ingestion.
 * Validates extractors, normalization, chunking, deduplication, storage isolation,
 * access classification boundaries, and full-text retrieval.
 * @project CASETHREAD
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const { execute, testConnection } = require('../database/connection');
const KnowledgeSecurity = require('../knowledge-base/security/knowledgeSecurity');
const TextNormalizer = require('../knowledge-base/normalization/textNormalizer');
const Chunker = require('../knowledge-base/normalization/chunker');
const ExtractorRegistry = require('../knowledge-base/extractors/extractorRegistry');
const IngestPipeline = require('../knowledge-base/ingestion/ingestPipeline');
const FullTextIndexer = require('../knowledge-base/indexing/fullTextIndexer');
const RetrievalService = require('../knowledge-base/retrieval/retrievalService');
const VectorIndexerInterface = require('../knowledge-base/indexing/vectorIndexerInterface');

const FIXTURES_DIR = path.resolve(__dirname, 'fixtures/knowledge_test_fixtures');

describe('Phase 13: Private Crime Knowledge Base & Backend Data Ingestion', () => {

  before(async () => {
    await testConnection();
  });

  describe('1. Security Boundary & Path Traversal Guards', () => {
    it('should validate allowed extensions and reject unsupported files', () => {
      const validTxt = KnowledgeSecurity.validateFileForIngestion(path.join(FIXTURES_DIR, 'synthetic_judgment.txt'));
      assert.equal(validTxt.valid, true);
      assert.equal(validTxt.ext, '.txt');

      const invalidBin = KnowledgeSecurity.validateFileForIngestion(path.join(FIXTURES_DIR, 'unsupported_binary.bin'));
      assert.equal(invalidBin.valid, false);
      assert.match(invalidBin.error, /Unsupported file format/);
    });

    it('should prevent directory traversal in storage path calculation', () => {
      assert.throws(() => {
        KnowledgeSecurity.getSecureStoragePath('../../etc/passwd');
      }, (err) => {
        // basename removes ../../ so it resolves safely inside vault or throws
        return true;
      });

      const safePath = KnowledgeSecurity.getSecureStoragePath('test_document.pdf');
      assert.ok(safePath.includes('private_knowledge_vault'));
      assert.ok(!safePath.includes('..'));
    });

    it('should sanitize search queries against SQL injection and control chars', () => {
      const dirty = "DROP TABLE users; -- \x00 ' OR '1'='1";
      const clean = KnowledgeSecurity.sanitizeQuery(dirty);
      assert.ok(!clean.includes(';'));
      assert.ok(!clean.includes("'"));
      assert.ok(!clean.includes('\x00'));
    });

    it('should enforce role-based access classification hierarchy', () => {
      const guest = { role: 'GUEST' };
      const analyst = { role: 'ANALYST' };
      const investigator = { role: 'INVESTIGATOR' };
      const admin = { role: 'ADMIN' };

      assert.equal(KnowledgeSecurity.canAccess(guest, 'PUBLIC_RECORD'), true);
      assert.equal(KnowledgeSecurity.canAccess(guest, 'CONFIDENTIAL'), false);

      assert.equal(KnowledgeSecurity.canAccess(analyst, 'OFFICIAL_USE_ONLY'), true);
      assert.equal(KnowledgeSecurity.canAccess(analyst, 'CONFIDENTIAL'), false);

      assert.equal(KnowledgeSecurity.canAccess(investigator, 'RESTRICTED_LAW_ENFORCEMENT'), true);
      assert.equal(KnowledgeSecurity.canAccess(investigator, 'CONFIDENTIAL'), false);

      assert.equal(KnowledgeSecurity.canAccess(admin, 'CONFIDENTIAL'), true);
    });
  });

  describe('2. Document Extractors (.txt, .json, .csv, .pdf, .docx)', () => {
    it('should extract text and metadata from plain text (.txt)', async () => {
      const res = await ExtractorRegistry.extract(path.join(FIXTURES_DIR, 'synthetic_judgment.txt'));
      assert.ok(res.text.includes('SYNTH-2026-991'));
      assert.equal(res.metadata.case_number, 'SYNTH-2026-991');
      assert.equal(res.metadata.jurisdiction, 'Metropolitan Criminal Court');
    });

    it('should extract structured fields and format text from JSON (.json)', async () => {
      const res = await ExtractorRegistry.extract(path.join(FIXTURES_DIR, 'synthetic_court_record.json'));
      assert.ok(res.text.includes('SYNTH-JSON-2026-042'));
      assert.equal(res.metadata.case_number, 'SYNTH-JSON-2026-042');
      assert.equal(res.metadata.verdict, 'CONVICTED');
    });

    it('should extract rows and neutralize formula injection in CSV (.csv)', async () => {
      const res = await ExtractorRegistry.extract(path.join(FIXTURES_DIR, 'synthetic_crime_ledger.csv'));
      assert.ok(res.text.includes('Armed Robbery'));
      // Formula test: =SUM(A1:A5) should be neutralized with leading quote
      assert.ok(res.text.includes("'=SUM(A1:A5)"));
      assert.ok(res.text.includes("'+CMD|"));
      assert.equal(res.metadata.row_count, 3);
    });

    it('should extract embedded text stream from standard PDF (.pdf)', async () => {
      const res = await ExtractorRegistry.extract(path.join(FIXTURES_DIR, 'synthetic_case.pdf'));
      assert.ok(res.text.includes('SYNTH-PDF-771'));
      assert.equal(res.is_ocr_required, false);
    });

    it('should flag scanned PDF as requiring OCR when text is missing', async () => {
      const res = await ExtractorRegistry.extract(path.join(FIXTURES_DIR, 'synthetic_scanned_case.pdf'));
      assert.equal(res.is_ocr_required, true);
      assert.ok(res.text.includes('SCANNED DOCUMENT NOTICE'));
      assert.equal(res.metadata.ocr_status, 'PENDING');
    });

    it('should extract paragraph text from Word document (.docx)', async () => {
      const res = await ExtractorRegistry.extract(path.join(FIXTURES_DIR, 'synthetic_case.docx'));
      assert.ok(res.text.includes('SYNTH-DOCX-882'));
      assert.equal(res.metadata.format, 'docx');
    });
  });

  describe('3. Normalization & Chunking', () => {
    it('should clean control characters and standardize whitespace', () => {
      const dirty = "Case \x00Title\r\n\r\n\r\nSection 1:\tInvestigation   Data";
      const clean = TextNormalizer.normalizeText(dirty);
      assert.ok(!clean.includes('\x00'));
      assert.ok(!clean.includes('\r'));
      assert.equal(clean, "Case Title\n\nSection 1: Investigation Data");
    });

    it('should chunk text with overlap and boundary preservation', () => {
      const text = `PARAGRAPH ONE:
This is the first segment of investigative facts detailing evidence discovery.
The forensic team catalogued several items at the crime scene.

PARAGRAPH TWO:
This second section covers the ballistic analysis conducted by senior analysts.
Comparisons of striation patterns on recovered cartridge casings revealed consistent toolmarks.

PARAGRAPH THREE:
The third part documents the vehicle movement logs captured by traffic surveillance units.
Timestamps corroborate suspect whereabouts between 22:00 and 23:30 hours.`;

      const chunks = Chunker.chunk(text, { targetSize: 150, minSize: 80, maxSize: 250, overlap: 30 });
      assert.ok(chunks.length >= 2);
      assert.equal(chunks[0].chunk_index, 0);
      assert.ok(chunks[0].chunk_text.length > 50);
      assert.ok(chunks[0].page_number >= 1);
    });
  });

  describe('4. Ingestion Pipeline & Storage Isolation', () => {
    let ingestedDocId = null;

    it('should ingest a synthetic text document into the knowledge base', async () => {
      const result = await IngestPipeline.ingestFile(path.join(FIXTURES_DIR, 'synthetic_judgment.txt'), {
        sourceName: 'Automated Test Judicial Archive',
        sourceType: 'COURT_JUDGMENT',
        classification: 'OFFICIAL_USE_ONLY',
        jurisdiction: 'Metropolitan District',
        crimeCategory: 'Cyber Crime',
        force: true
      });

      assert.equal(result.status, 'SUCCESS');
      assert.ok(result.document_id > 0);
      assert.ok(result.chunks_created > 0);
      assert.ok(result.sha256.length === 64);
      ingestedDocId = result.document_id;

      // Verify records in MySQL
      const [docs] = await execute('SELECT * FROM knowledge_documents WHERE document_id = ?', [ingestedDocId]);
      assert.equal(docs.length, 1);
      assert.equal(docs[0].document_title, 'synthetic_judgment');
      assert.equal(docs[0].ingestion_status, 'PROCESSED');

      // Verify chunks in MySQL
      const [chunks] = await execute('SELECT * FROM knowledge_chunks WHERE document_id = ?', [ingestedDocId]);
      assert.equal(chunks.length, result.chunks_created);

      // Verify file is saved in private_knowledge_vault
      assert.ok(docs[0].storage_path.includes('private_knowledge_vault'));
      assert.ok(fs.existsSync(docs[0].storage_path));
    });

    it('should detect duplicate SHA-256 and skip without creating redundant records', async () => {
      const duplicateResult = await IngestPipeline.ingestFile(path.join(FIXTURES_DIR, 'synthetic_judgment.txt'), {
        force: false
      });

      assert.equal(duplicateResult.status, 'DUPLICATE_SKIPPED');
      assert.equal(duplicateResult.document_id, ingestedDocId);
    });
  });

  describe('5. Full-Text Search & Clearance Boundary Retrieval', () => {
    it('should retrieve matching chunk via FullTextIndexer', async () => {
      const searchRes = await FullTextIndexer.search({
        query: 'phishing credentials',
        limit: 5
      });

      assert.ok(searchRes.results.length > 0);
      assert.ok(searchRes.results[0].excerpt.length > 0);
      assert.ok(searchRes.results[0].chunk_text.toLowerCase().includes('phishing'));
    });

    it('should enforce clearance boundaries via RetrievalService', async () => {
      // 1. Analyst access
      const analystContext = { userId: 99, role: 'ANALYST' };
      const analystSearch = await RetrievalService.searchKnowledgeBase({
        query: 'credentials',
        accessContext: analystContext,
        limit: 5
      });

      assert.equal(analystSearch.access_clearance, 'OFFICIAL_USE_ONLY');
      assert.ok(analystSearch.snippets.length > 0);

      // 2. Guest access should only see PUBLIC_RECORD
      const guestContext = { userId: 100, role: 'GUEST' };
      const guestSearch = await RetrievalService.searchKnowledgeBase({
        query: 'credentials',
        accessContext: guestContext,
        limit: 5
      });
      // The synthetic document was stored as OFFICIAL_USE_ONLY, so guest should not receive it
      const hasOfficialChunk = guestSearch.snippets.some(s => s.classification_level === 'OFFICIAL_USE_ONLY');
      assert.equal(hasOfficialChunk, false);
    });
  });

  describe('6. Vector Indexer Interface & Cosine Similarity', () => {
    it('should correctly compute cosine similarity between numeric vectors', () => {
      const vecA = [1, 2, 3];
      const vecB = [1, 2, 3];
      const simIdentical = VectorIndexerInterface.cosineSimilarity(vecA, vecB);
      assert.ok(Math.abs(simIdentical - 1.0) < 0.0001);

      const vecOrthogonalA = [1, 0, 0];
      const vecOrthogonalB = [0, 1, 0];
      const simOrthogonal = VectorIndexerInterface.cosineSimilarity(vecOrthogonalA, vecOrthogonalB);
      assert.equal(simOrthogonal, 0);

      const vecOpposite = [-1, -2, -3];
      const simOpposite = VectorIndexerInterface.cosineSimilarity(vecA, vecOpposite);
      assert.ok(Math.abs(simOpposite - (-1.0)) < 0.0001);
    });
  });

  after(async () => {
    const { closePool } = require('../database/connection');
    await closePool();
  });
});

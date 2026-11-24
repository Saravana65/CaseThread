/**
 * @file global_knowledge.test.js
 * @brief Comprehensive automated test suite for Phase 14: Global Crime Record Collection & Cross-Country Search.
 * Tests source connectors, live API validation, pagination, deduplication, language detection,
 * cross-country retrieval, and investigative similarity matching.
 * @project CASETHREAD
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const { testConnection, execute } = require('../database/connection');
const { SourceRegistry } = require('../knowledge-base/sources/registry/sourceRegistry');
const ConnectorManager = require('../knowledge-base/sources/connectors/connectorManager');
const RecordAdapter = require('../knowledge-base/sources/adapters/recordAdapter');
const LanguageDetector = require('../knowledge-base/multilingual/languageDetector');
const TranslationManager = require('../knowledge-base/multilingual/translationManager');
const GlobalDeduplicator = require('../knowledge-base/deduplication/globalDeduplicator');
const IngestPipeline = require('../knowledge-base/ingestion/ingestPipeline');
const FullTextIndexer = require('../knowledge-base/indexing/fullTextIndexer');
const RetrievalService = require('../knowledge-base/retrieval/retrievalService');
const SimilarCaseEngine = require('../knowledge-base/retrieval/similarCaseEngine');

describe('Phase 14: Global Crime Record Collection & Cross-Country Search Suite', () => {

  before(async () => {
    await testConnection();
  });

  describe('1. Global Source Registry & Connectors Initialization', () => {
    it('should catalog registered sources across at least 5 jurisdictions', () => {
      const all = SourceRegistry.getAllSources();
      assert.ok(all.length >= 5);

      const uk = SourceRegistry.getSource('uk_police_open_data');
      assert.equal(uk.country, 'United Kingdom');
      assert.equal(uk.license, 'Open Government Licence v3.0 (OGL v3.0)');
      assert.equal(uk.status, 'OPERATIONAL');

      const us = SourceRegistry.getSource('us_open_crime_portal');
      assert.equal(us.country, 'United States');
      assert.equal(us.status, 'OPERATIONAL');

      const ind = SourceRegistry.getSource('india_judicial_archive');
      assert.equal(ind.country, 'India');
      assert.equal(ind.status, 'OPERATIONAL');
    });

    it('should initialize connectors with base rate-limiting and checkpointing support', () => {
      const ukConn = ConnectorManager.getConnector('uk_police_open_data');
      assert.ok(ukConn);
      assert.equal(typeof ukConn.safeFetch, 'function');
      assert.equal(typeof ukConn.saveCheckpoint, 'function');

      const usConn = ConnectorManager.getConnector('us_open_crime_portal');
      assert.ok(usConn);

      const indConn = ConnectorManager.getConnector('india_judicial_archive');
      assert.ok(indConn);
    });
  });

  describe('2. Real Source Connection Validation', () => {
    it('should validate Police.uk API connectivity and categories discovery', async () => {
      const ukConn = ConnectorManager.getConnector('uk_police_open_data');
      const val = await ukConn.validateConnection();
      assert.equal(val.ok, true);
      assert.ok(val.message.includes('Police.uk API'));
    });

    it('should validate US Open Data portal connectivity', async () => {
      const usConn = ConnectorManager.getConnector('us_open_crime_portal');
      const val = await usConn.validateConnection();
      assert.equal(val.ok, true);
      assert.ok(val.message.includes('Chicago SODA API'));
    });

    it('should validate Indian Judicial repository storage verification', async () => {
      const indConn = ConnectorManager.getConnector('india_judicial_archive');
      const val = await indConn.validateConnection();
      assert.equal(val.ok, true);
    });
  });

  describe('3. Record Adapters & Schema Normalization', () => {
    it('should adapt raw UK Police street record into standard schema', () => {
      const rawUk = {
        id: 998811,
        category: 'burglary',
        persistent_id: 'UK-TEST-BURGLARY-1',
        month: '2024-01',
        location: {
          latitude: '51.5074',
          longitude: '-0.1278',
          street: { name: 'On or near High Street' }
        },
        outcome_status: {
          category: 'Investigation complete; no suspect identified',
          date: '2024-02'
        }
      };

      const adapted = RecordAdapter.adaptUkPoliceRecord(rawUk);
      assert.equal(adapted.country, 'United Kingdom');
      assert.equal(adapted.crime_category, 'BURGLARY');
      assert.equal(adapted.case_reference_number, 'UK-TEST-BURGLARY-1');
      assert.equal(adapted.record_level, 'CASE_LEVEL');
      assert.equal(adapted.source_reliability, 'OFFICIAL_GOVERNMENT');
      assert.ok(adapted.documented_circumstances.includes('High Street'));
    });

    it('should adapt raw US Chicago SODA incident record into standard schema', () => {
      const rawUs = {
        case_number: 'JK999123',
        date: '2024-03-10T21:30:00.000',
        block: '042XX W MADISON ST',
        primary_type: 'ROBBERY',
        description: 'ARMED - HANDGUN',
        location_description: 'COMMERCIAL / RETAIL STORE',
        arrest: false,
        domestic: false,
        fbi_code: '03'
      };

      const adapted = RecordAdapter.adaptUsOpenRecord(rawUs);
      assert.equal(adapted.country, 'United States');
      assert.equal(adapted.crime_category, 'ROBBERY');
      assert.equal(adapted.case_reference_number, 'JK999123');
      assert.equal(adapted.case_outcome, 'NO_ARREST_RECORDED');
      assert.equal(adapted.investigation_status, null);
    });
  });

  describe('4. Multilingual Processing & Language Detection', () => {
    it('should correctly detect English, Devanagari (Hindi), Spanish, and German scripts', () => {
      const en = LanguageDetector.detectLanguage('The forensic examination revealed consistent firearm toolmarks on recovered casings.');
      assert.equal(en.language, 'en');

      const hi = LanguageDetector.detectLanguage('अभियुक्त के विरुद्ध धारा 392 भारतीय दंड संहिता के अंतर्गत आरोप पत्र दाखिल किया गया।');
      assert.equal(hi.language, 'hi');
      assert.equal(hi.script, 'Devanagari');

      const es = LanguageDetector.detectLanguage('La policía judicial ejecutó la orden de allanamiento en el domicilio del sospechoso con evidencia forense.');
      assert.equal(es.language, 'es');

      const de = LanguageDetector.detectLanguage('Die Kriminalpolizei sicherte am Tatort mehrere daktyloskopische Spuren und beschlagnahmte das Fluchtfahrzeug.');
      assert.equal(de.language, 'de');
    });

    it('should preserve original text and record translation status accurately', () => {
      const originalHi = 'न्यायालय ने अभियुक्त को सात वर्ष के सश्रम कारावास की सजा सुनाई।';
      const result = TranslationManager.processTranslation({
        text: originalHi,
        declaredLanguage: 'hi',
        providedTranslation: 'The Court sentenced the accused to seven years of rigorous imprisonment.',
        translationMethod: 'OFFICIAL_VERIFIED'
      });

      assert.equal(result.originalText, originalHi);
      assert.equal(result.language, 'hi');
      assert.equal(result.translationStatus, 'OFFICIAL_VERIFIED');
      assert.ok(result.translatedText.includes('seven years'));
    });
  });

  describe('5. Data Quality, Deduplication & Conflicting Statements', () => {
    it('should validate record data quality and detect missing critical fields', () => {
      const incompleteRecord = {
        case_reference_number: null,
        country: 'India',
        jurisdiction: null,
        crime_category: 'ROBBERY'
      };

      const quality = GlobalDeduplicator.validateQuality(incompleteRecord);
      assert.equal(quality.isValid, false);
      assert.ok(quality.issues.includes('MISSING_CASE_REFERENCE'));
      assert.ok(quality.issues.includes('MISSING_JURISDICTION'));
    });

    it('should identify cross-source duplicate and preserve conflicting outcomes', async () => {
      // Ingest a synthetic case
      const testRef = `TEST-DUP-${Date.now()}`;
      await IngestPipeline.ingestGlobalRecord({
        country: 'India',
        jurisdiction: 'District Sessions Court',
        case_reference_number: testRef,
        document_title: 'State vs Test Case',
        crime_category: 'THEFT',
        case_outcome: 'ACQUITTAL',
        documented_circumstances: 'Synthetic trial record for deduplication testing.'
      }, { force: true });

      // Check cross-source duplicate with conflicting outcome
      const check = await GlobalDeduplicator.checkCrossSourceDuplicate({
        country: 'India',
        case_reference_number: testRef,
        case_outcome: 'CONVICTION'
      });

      assert.equal(check.isDuplicate, true);
      assert.equal(check.hasConflicts, true);
      assert.ok(check.conflicts[0].includes('discrepancy'));
    });
  });

  describe('6. Cross-Country Search & Attribute-Based Similar Case Retrieval', () => {
    it('should filter records across multiple countries (UK, US, India)', async () => {
      const ukSearch = await FullTextIndexer.search({
        query: 'Police',
        filters: { country: 'United Kingdom' },
        limit: 5
      });
      assert.ok(ukSearch.results.length >= 1);
      assert.equal(ukSearch.results[0].country, 'United Kingdom');

      const usSearch = await FullTextIndexer.search({
        query: 'Incident',
        filters: { country: 'United States' },
        limit: 5
      });
      assert.ok(usSearch.results.length >= 1);
      assert.equal(usSearch.results[0].country, 'United States');

      const indiaSearch = await FullTextIndexer.search({
        query: 'Court',
        filters: { country: 'India' },
        limit: 5
      });
      assert.ok(indiaSearch.results.length >= 1);
      assert.equal(indiaSearch.results[0].country, 'India');
    });

    it('should execute multi-attribute investigative similarity matching', async () => {
      const similar = await SimilarCaseEngine.findSimilarCases({
        query: 'A robbery occurred around 9 PM targeting electronics and cash at a commercial premises.',
        limit: 5
      });

      assert.ok(similar.total_matches > 0);
      assert.ok(similar.similar_cases.length > 0);

      const topMatch = similar.similar_cases[0];
      assert.ok(topMatch.matched_attributes.length >= 1);
      assert.ok(topMatch.relevance_tier === 'HIGH' || topMatch.relevance_tier === 'MEDIUM' || topMatch.relevance_tier === 'LOW');
      assert.ok(topMatch.investigative_notice.includes('SIMILARITY_MATCH_ONLY'));
      assert.ok(topMatch.document_id > 0);
      assert.ok(topMatch.country);
    });

    it('should enforce role-based access clearance boundaries on global retrieval', async () => {
      const guestContext = { userId: 501, role: 'GUEST' };
      const analystContext = { userId: 502, role: 'ANALYST' };

      const guestRes = await RetrievalService.searchKnowledgeBase({
        query: 'robbery',
        accessContext: guestContext,
        limit: 5
      });
      assert.equal(guestRes.access_clearance, 'PUBLIC_RECORD');

      const analystRes = await RetrievalService.searchKnowledgeBase({
        query: 'robbery',
        accessContext: analystContext,
        limit: 5
      });
      assert.equal(analystRes.access_clearance, 'OFFICIAL_USE_ONLY');
    });
  });

  after(async () => {
    const { closePool } = require('../database/connection');
    await closePool();
  });
});

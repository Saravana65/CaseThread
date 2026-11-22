/**
 * @file hybridRetriever.js
 * @brief Multi-modal hybrid case retriever combining MySQL full-text search,
 * structured metadata filters, and semantic feature vector cosine similarity.
 * @project CASETHREAD
 */

const { execute } = require('../../../database/connection');
const FullTextIndexer = require('../../indexing/fullTextIndexer');
const VectorIndexerInterface = require('../../indexing/vectorIndexerInterface');

class HybridRetriever {
  /**
   * Generates a deterministic normalized term-frequency feature vector for semantic cosine comparison.
   * Encodes key forensic concept dimensions (robbery, burglary, theft, cyber, firearms, electronics, cash, night, commercial).
   */
  static extractFeatureVector(text) {
    const forensicDimensions = [
      /\b(?:robbery|armed|weapon|firearm|heist)\b/i,
      /\b(?:burglary|break-in|forced|entry)\b/i,
      /\b(?:theft|stolen|larceny|shoplift)\b/i,
      /\b(?:cyber|phishing|hash|token|api|ledger)\b/i,
      /\b(?:cash|money|currency|funds|inr|usd)\b/i,
      /\b(?:graphics\s+card|gpu|electronics|computer|hardware|pos)\b/i,
      /\b(?:night|evening|21:00|dark|closing)\b/i,
      /\b(?:commercial|warehouse|store|retail|depot)\b/i,
      /\b(?:arrest|convicted|recovered|disclosed|section\s+27)\b/i,
      /\b(?:cctv|dvr|camera|surveillance|tower\s+dump|cdr)\b/i
    ];

    const str = (text || '').toLowerCase();
    const vec = forensicDimensions.map(pattern => (pattern.test(str) ? 1.0 : 0.0));
    return vec;
  }

  /**
   * Performs hybrid search combining full-text queries and structured metadata filtering.
   * @param {object} params
   * @param {object} params.criteria - Parsed query criteria from QueryParser
   * @param {object} [params.accessContext] - Requester credentials/role
   * @param {number} [params.limit=10]
   */
  static async retrieve({ criteria, accessContext = null, limit = 10 }) {
    const boundedLimit = Math.min(Math.max(1, parseInt(limit) || 10), 25);
    const queryVector = this.extractFeatureVector(criteria.rawQuery);

    // 1. Build search filters
    const filters = {};
    if (criteria.targetCountries && criteria.targetCountries.length > 0) {
      filters.country = criteria.targetCountries[0];
    }
    if (criteria.crimeCategories && criteria.crimeCategories.length > 0) {
      filters.crimeCategory = criteria.crimeCategories[0];
    }

    // 2. Execute full-text retrieval query
    const keywords = [
      ...(criteria.crimeCategories || []),
      ...(criteria.propertyKeywords || []),
      ...(criteria.stolenProperty || [])
    ].join(' ');

    const fullTextSearch = await FullTextIndexer.search({
      query: keywords || criteria.rawQuery,
      filters,
      limit: boundedLimit * 2
    });

    // 3. Fallback database query if full-text search yielded few records
    let candidateDocs = fullTextSearch.results;

    if (candidateDocs.length < 3) {
      const dbSql = `
        SELECT 
          kd.document_id, kd.case_reference_number, kd.document_title, kd.country,
          kd.region_state, kd.city, kd.jurisdiction, kd.crime_category, kd.crime_subtype,
          kd.incident_datetime, kd.stolen_property, kd.property_recovered,
          kd.documented_circumstances, kd.case_outcome, kd.investigation_status,
          kd.investigative_actions, kd.is_investigation_details_available,
          kd.record_level, ks.source_name, ks.source_type, ks.license_terms,
          kc.chunk_text, kc.page_number, kc.section_reference
        FROM knowledge_documents kd
        JOIN knowledge_sources ks ON kd.source_id = ks.source_id
        LEFT JOIN knowledge_chunks kc ON kd.document_id = kc.document_id
        WHERE 1=1
        ${criteria.targetCountries?.length ? `AND kd.country IN (${criteria.targetCountries.map(() => '?').join(',')})` : ''}
        ${criteria.crimeCategories?.length ? `AND kd.crime_category IN (${criteria.crimeCategories.map(() => '?').join(',')})` : ''}
        ORDER BY kd.incident_datetime DESC, kd.document_id DESC
        LIMIT ?
      `;

      const dbParams = [];
      if (criteria.targetCountries?.length) dbParams.push(...criteria.targetCountries);
      if (criteria.crimeCategories?.length) dbParams.push(...criteria.crimeCategories);
      dbParams.push(boundedLimit);

      const [rows] = await execute(dbSql, dbParams);

      const existingIds = new Set(candidateDocs.map(d => d.document_id));
      for (const row of rows) {
        if (!existingIds.has(row.document_id)) {
          candidateDocs.push({
            document_id: row.document_id,
            case_reference_number: row.case_reference_number,
            document_title: row.document_title,
            country: row.country,
            region_state: row.region_state,
            city: row.city,
            jurisdiction: row.jurisdiction,
            crime_category: row.crime_category,
            crime_subtype: row.crime_subtype,
            incident_datetime: row.incident_datetime,
            stolen_property: row.stolen_property,
            property_recovered: row.property_recovered,
            documented_circumstances: row.documented_circumstances,
            case_outcome: row.case_outcome,
            investigation_status: row.investigation_status,
            investigative_actions: row.investigative_actions,
            is_investigation_details_available: !!row.is_investigation_details_available,
            record_level: row.record_level,
            source_name: row.source_name,
            source_type: row.source_type,
            license_terms: row.license_terms,
            chunk_text: row.chunk_text || row.documented_circumstances || '',
            relevance_score: 1.0,
            excerpt: (row.documented_circumstances || '').slice(0, 250)
          });
          existingIds.add(row.document_id);
        }
      }
    }

    // 4. Calculate semantic vector similarity for each candidate
    const scoredCandidates = candidateDocs.map(doc => {
      const docText = `${doc.document_title} ${doc.crime_subtype} ${doc.stolen_property} ${doc.documented_circumstances} ${doc.investigative_actions}`;
      const docVector = this.extractFeatureVector(docText);
      const semanticScore = VectorIndexerInterface.cosineSimilarity(queryVector, docVector);

      return {
        ...doc,
        semantic_similarity: Number(semanticScore.toFixed(3)),
        composite_score: Number(((doc.relevance_score || 1.0) * 0.4 + semanticScore * 0.6).toFixed(3))
      };
    });

    return scoredCandidates.slice(0, boundedLimit);
  }
}

module.exports = HybridRetriever;

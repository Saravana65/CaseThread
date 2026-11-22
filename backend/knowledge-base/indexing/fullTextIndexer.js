/**
 * @file fullTextIndexer.js
 * @brief MySQL FULLTEXT search engine with relevance scoring, filtering, and excerpt generation.
 * @project CASETHREAD
 */

const { execute } = require('../../database/connection');
const KnowledgeSecurity = require('../security/knowledgeSecurity');

class FullTextIndexer {
  /**
   * Generates a concise context excerpt around search terms within chunk text.
   */
  static generateExcerpt(chunkText, query, maxChars = 260) {
    if (!chunkText) return '';
    const cleanQuery = KnowledgeSecurity.sanitizeQuery(query);
    const terms = cleanQuery.split(/\s+/).filter(t => t.length > 2);

    if (terms.length === 0) {
      return chunkText.slice(0, maxChars) + (chunkText.length > maxChars ? '...' : '');
    }

    // Find first occurrence of any term
    let bestIndex = -1;
    for (const term of terms) {
      const idx = chunkText.toLowerCase().indexOf(term.toLowerCase());
      if (idx !== -1 && (bestIndex === -1 || idx < bestIndex)) {
        bestIndex = idx;
      }
    }

    if (bestIndex === -1) {
      return chunkText.slice(0, maxChars) + (chunkText.length > maxChars ? '...' : '');
    }

    const halfWindow = Math.floor(maxChars / 2);
    const start = Math.max(0, bestIndex - halfWindow);
    const end = Math.min(chunkText.length, bestIndex + halfWindow);

    let excerpt = chunkText.substring(start, end).trim();
    if (start > 0) excerpt = '...' + excerpt;
    if (end < chunkText.length) excerpt = excerpt + '...';

    return excerpt;
  }

  /**
   * Executes a full-text search across indexed chunks.
   * @param {object} params
   * @param {string} params.query - Search query string
   * @param {object} params.filters - Filter criteria (classifications, category, jurisdiction, dates)
   * @param {number} params.limit - Max records to return (capped at 50)
   * @param {number} params.offset - Pagination offset
   * @returns {Promise<{ results: Array<object>, totalCount: number, query: string }>}
   */
  static async search({ query, filters = {}, limit = 20, offset = 0 }) {
    const sanitized = KnowledgeSecurity.sanitizeQuery(query);
    const cappedLimit = Math.min(Math.max(1, parseInt(limit) || 20), 50);
    const safeOffset = Math.max(0, parseInt(offset) || 0);

    const conditions = [];
    const params = [];

    // Filter by authorized classifications on chunk
    if (filters.allowedClassifications && Array.isArray(filters.allowedClassifications) && filters.allowedClassifications.length > 0) {
      conditions.push(`kc.access_classification IN (${filters.allowedClassifications.map(() => '?').join(', ')})`);
      params.push(...filters.allowedClassifications);
    }

    // Filter by country
    if (filters.country) {
      conditions.push(`kd.country = ?`);
      params.push(filters.country);
    }

    // Filter by language
    if (filters.language) {
      conditions.push(`kd.language = ?`);
      params.push(filters.language);
    }

    // Filter by record level
    if (filters.recordLevel) {
      conditions.push(`kd.record_level = ?`);
      params.push(filters.recordLevel);
    }

    // Filter by crime category
    if (filters.crimeCategory) {
      conditions.push(`kd.crime_category = ?`);
      params.push(filters.crimeCategory);
    }

    // Filter by jurisdiction
    if (filters.jurisdiction) {
      conditions.push(`kd.jurisdiction = ?`);
      params.push(filters.jurisdiction);
    }

    // Filter by date range
    if (filters.startDate) {
      conditions.push(`(kd.publication_date >= ?)`);
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      conditions.push(`(kd.publication_date <= ?)`);
      params.push(filters.endDate);
    }

    // Full-text or fallback search
    let searchSqlClause = '1=1';
    let countScoreClause = '1.0 AS score';

    if (sanitized && sanitized.length > 0) {
      const terms = sanitized.split(/\s+/).filter(t => t.length > 0);
      const booleanQuery = terms.map(t => `${t}*`).join(' ');

      searchSqlClause = `MATCH(kc.chunk_text) AGAINST(? IN BOOLEAN MODE)`;
      countScoreClause = `MATCH(kc.chunk_text) AGAINST(? IN BOOLEAN MODE) AS score`;
      params.push(booleanQuery);
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')} AND ${searchSqlClause}`
      : `WHERE ${searchSqlClause}`;

    const querySql = `
      SELECT 
        kc.chunk_id,
        kc.document_id,
        kc.chunk_index,
        kc.chunk_text,
        kc.page_number,
        kc.section_reference,
        kc.access_classification,
        kd.document_title,
        kd.case_reference_number,
        kd.country,
        kd.region_state,
        kd.city,
        kd.jurisdiction,
        kd.crime_category,
        kd.crime_subtype,
        kd.incident_datetime,
        kd.stolen_property,
        kd.property_recovered,
        kd.case_outcome,
        kd.investigation_status,
        kd.investigative_actions,
        kd.is_investigation_details_available,
        kd.language,
        kd.record_level,
        kd.publication_date,
        ks.source_name,
        ks.source_type,
        ${countScoreClause}
      FROM knowledge_chunks kc
      JOIN knowledge_documents kd ON kc.document_id = kd.document_id
      JOIN knowledge_sources ks ON kd.source_id = ks.source_id
      ${whereClause}
      ORDER BY score DESC, kc.chunk_id ASC
      LIMIT ? OFFSET ?
    `;

    let finalParams = [];
    if (sanitized && sanitized.length > 0) {
      const terms = sanitized.split(/\s+/).filter(t => t.length > 0);
      const booleanQuery = terms.map(t => `${t}*`).join(' ');
      finalParams.push(booleanQuery);
      finalParams.push(...params);
    } else {
      finalParams.push(...params);
    }
    finalParams.push(cappedLimit, safeOffset);

    let rows;
    try {
      const [res] = await execute(querySql, finalParams);
      rows = res;
    } catch (err) {
      // Fallback search with LIKE if MATCH AGAINST encounters boolean syntax errors or tables empty
      if (sanitized) {
        const fallbackSql = `
          SELECT 
            kc.chunk_id,
            kc.document_id,
            kc.chunk_index,
            kc.chunk_text,
            kc.page_number,
            kc.section_reference,
            kc.access_classification,
            kd.document_title,
            kd.case_reference_number,
            kd.country,
            kd.region_state,
            kd.city,
            kd.jurisdiction,
            kd.crime_category,
            kd.crime_subtype,
            kd.incident_datetime,
            kd.stolen_property,
            kd.property_recovered,
            kd.case_outcome,
            kd.investigation_status,
            kd.investigative_actions,
            kd.is_investigation_details_available,
            kd.language,
            kd.record_level,
            kd.publication_date,
            ks.source_name,
            ks.source_type,
            1.0 AS score
          FROM knowledge_chunks kc
          JOIN knowledge_documents kd ON kc.document_id = kd.document_id
          JOIN knowledge_sources ks ON kd.source_id = ks.source_id
          ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')} AND kc.chunk_text LIKE ?` : `WHERE kc.chunk_text LIKE ?`}
          ORDER BY kc.chunk_id ASC
          LIMIT ? OFFSET ?
        `;
        const fallbackParams = [...conditions.map((_, i) => params[i]), `%${sanitized}%`, cappedLimit, safeOffset];
        const [resFallback] = await execute(fallbackSql, fallbackParams);
        rows = resFallback;
      } else {
        throw err;
      }
    }

    const formattedResults = rows.map(row => ({
      chunk_id: row.chunk_id,
      document_id: row.document_id,
      document_title: row.document_title,
      case_reference_number: row.case_reference_number,
      country: row.country,
      region_state: row.region_state,
      city: row.city,
      jurisdiction: row.jurisdiction,
      crime_category: row.crime_category,
      crime_subtype: row.crime_subtype,
      incident_datetime: row.incident_datetime,
      stolen_property: row.stolen_property,
      property_recovered: row.property_recovered,
      case_outcome: row.case_outcome,
      investigation_status: row.investigation_status,
      investigative_actions: row.investigative_actions,
      is_investigation_details_available: !!row.is_investigation_details_available,
      language: row.language,
      record_level: row.record_level,
      crime_category: row.crime_category,
      case_outcome: row.case_outcome,
      publication_date: row.publication_date,
      classification_level: row.access_classification,
      source_name: row.source_name,
      source_type: row.source_type,
      page_number: row.page_number,
      section_reference: row.section_reference,
      relevance_score: typeof row.score === 'number' ? Number(row.score.toFixed(3)) : 1.0,
      excerpt: this.generateExcerpt(row.chunk_text, sanitized),
      chunk_text: row.chunk_text
    }));

    return {
      results: formattedResults,
      totalCount: formattedResults.length,
      query: sanitized
    };
  }
}

module.exports = FullTextIndexer;

/**
 * @file similarCaseEngine.js
 * @brief Structured and keyword multi-attribute similarity search engine for worldwide crime cases.
 * Handles queries such as "A robbery happened at 9 PM. Only graphics cards were stolen. Find similar cases worldwide."
 * @project CASETHREAD
 */

const { execute } = require('../../database/connection');
const KnowledgeSecurity = require('../security/knowledgeSecurity');

class SimilarCaseEngine {
  /**
   * Parses natural language query into investigative search criteria.
   */
  static parseInvestigativeQuery(queryText) {
    const text = (queryText || '').toLowerCase();
    const criteria = {
      crimeCategories: [],
      propertyKeywords: [],
      premisesKeywords: [],
      targetHour: null,
      countries: []
    };

    // Detect crime category
    if (text.includes('robbery') || text.includes('armed')) criteria.crimeCategories.push('ROBBERY');
    if (text.includes('burglary') || text.includes('break-in') || text.includes('break and enter')) criteria.crimeCategories.push('BURGLARY');
    if (text.includes('theft') || text.includes('stolen') || text.includes('stealing')) criteria.crimeCategories.push('THEFT');
    if (text.includes('homicide') || text.includes('murder')) criteria.crimeCategories.push('HOMICIDE');
    if (text.includes('cyber') || text.includes('phishing') || text.includes('ransomware')) criteria.crimeCategories.push('CYBERCRIME_AND_FRAUD');
    if (text.includes('vehicle') || text.includes('car') || text.includes('auto')) criteria.crimeCategories.push('VEHICLE_THEFT');

    // Detect property keywords
    const propertyList = [
      'graphics card', 'graphics cards', 'gpu', 'gpus', 'computer', 'laptop', 'electronics',
      'jewelry', 'jewellery', 'gold', 'diamonds', 'cash', 'currency', 'mobile', 'smartphone',
      'copper', 'vehicle', 'luxury watches', 'firearms', 'weapons'
    ];

    for (const p of propertyList) {
      if (text.includes(p)) {
        criteria.propertyKeywords.push(p);
      }
    }

    // Detect premises keywords
    const premisesList = ['commercial', 'warehouse', 'retail', 'store', 'shop', 'residence', 'residential', 'apartment', 'house', 'street'];
    for (const prem of premisesList) {
      if (text.includes(prem)) {
        criteria.premisesKeywords.push(prem);
      }
    }

    // Detect approximate incident hour (e.g. 9 pm, 21:00, 10 am)
    const hourMatch = text.match(/(\d{1,2})\s*(?:pm|am|hours|:00)?/i);
    if (hourMatch) {
      let h = parseInt(hourMatch[1]);
      if (/pm/i.test(text) && h < 12) h += 12;
      else if (/am/i.test(text) && h === 12) h = 0;
      if (h >= 0 && h <= 23) criteria.targetHour = h;
    }

    // Detect country filters
    if (text.includes('uk') || text.includes('united kingdom') || text.includes('london')) criteria.countries.push('United Kingdom');
    if (text.includes('us') || text.includes('usa') || text.includes('united states') || text.includes('chicago')) criteria.countries.push('United States');
    if (text.includes('india') || text.includes('delhi')) criteria.countries.push('India');
    if (text.includes('canada')) criteria.countries.push('Canada');
    if (text.includes('australia')) criteria.countries.push('Australia');

    return criteria;
  }

  /**
   * Searches for similar historical cases across international records.
   * @param {object} params
   * @param {string} params.query - Natural language case query
   * @param {object} [params.structuredCriteria] - Explicit criteria overrides
   * @param {object} [params.accessContext] - Requester authorization context
   * @param {number} [params.limit=10]
   */
  static async findSimilarCases({ query, structuredCriteria = null, accessContext = null, limit = 10 }) {
    const criteria = structuredCriteria || this.parseInvestigativeQuery(query);
    const boundedLimit = Math.min(Math.max(1, parseInt(limit) || 10), 30);

    const conditions = [];
    const params = [];

    // Filter by country if specified
    if (criteria.countries && criteria.countries.length > 0) {
      conditions.push(`kd.country IN (${criteria.countries.map(() => '?').join(', ')})`);
      params.push(...criteria.countries);
    }

    // Filter by crime category if detected
    if (criteria.crimeCategories && criteria.crimeCategories.length > 0) {
      conditions.push(`kd.crime_category IN (${criteria.crimeCategories.map(() => '?').join(', ')})`);
      params.push(...criteria.crimeCategories);
    }

    // Keyword matching on property / circumstances / subtype
    const keywords = [...(criteria.propertyKeywords || []), ...(criteria.premisesKeywords || [])];
    if (keywords.length > 0) {
      const keywordClauses = keywords.map(() => `(kd.stolen_property LIKE ? OR kd.documented_circumstances LIKE ? OR kd.crime_subtype LIKE ?)`).join(' OR ');
      conditions.push(`(${keywordClauses})`);
      for (const kw of keywords) {
        params.push(`%${kw}%`, `%${kw}%`, `%${kw}%`);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const querySql = `
      SELECT 
        kd.document_id,
        kd.case_reference_number,
        kd.document_title,
        kd.country,
        kd.region_state,
        kd.city,
        kd.jurisdiction,
        kd.crime_category,
        kd.crime_subtype,
        kd.incident_datetime,
        kd.stolen_property,
        kd.property_recovered,
        kd.documented_circumstances,
        kd.case_outcome,
        kd.investigation_status,
        kd.investigative_actions,
        kd.is_investigation_details_available,
        kd.record_level,
        ks.source_name,
        ks.source_type,
        ks.license_terms
      FROM knowledge_documents kd
      JOIN knowledge_sources ks ON kd.source_id = ks.source_id
      ${whereClause}
      ORDER BY kd.incident_datetime DESC, kd.document_id DESC
      LIMIT ?
    `;

    params.push(boundedLimit);
    let [rows] = await execute(querySql, params);

    // If no exact conjunction match found and conditions were strict, fall back to relaxed search
    if (rows.length === 0 && conditions.length > 1) {
      const relaxedSql = `
        SELECT 
          kd.document_id, kd.case_reference_number, kd.document_title, kd.country,
          kd.region_state, kd.city, kd.jurisdiction, kd.crime_category, kd.crime_subtype,
          kd.incident_datetime, kd.stolen_property, kd.property_recovered,
          kd.documented_circumstances, kd.case_outcome, kd.investigation_status,
          kd.investigative_actions, kd.is_investigation_details_available,
          kd.record_level, ks.source_name, ks.source_type, ks.license_terms
        FROM knowledge_documents kd
        JOIN knowledge_sources ks ON kd.source_id = ks.source_id
        ${criteria.crimeCategories?.length ? `WHERE kd.crime_category IN (${criteria.crimeCategories.map(() => '?').join(',')})` : ''}
        ORDER BY kd.document_id DESC
        LIMIT ?
      `;
      const relaxedParams = criteria.crimeCategories?.length ? [...criteria.crimeCategories, boundedLimit] : [boundedLimit];
      const [relaxedRows] = await execute(relaxedSql, relaxedParams);
      rows = relaxedRows;
    }

    // Attribute matching analysis & ranking
    const evaluatedResults = rows.map(row => {
      const matchedAttributes = [];
      const rowText = `${row.stolen_property || ''} ${row.documented_circumstances || ''} ${row.crime_subtype || ''}`.toLowerCase();

      if (criteria.crimeCategories && criteria.crimeCategories.includes(row.crime_category)) {
        matchedAttributes.push('CRIME_CATEGORY_MATCH');
      }

      for (const p of criteria.propertyKeywords || []) {
        if (rowText.includes(p.toLowerCase())) {
          matchedAttributes.push(`PROPERTY_MATCH: ${p}`);
        }
      }

      for (const prem of criteria.premisesKeywords || []) {
        if (rowText.includes(prem.toLowerCase())) {
          matchedAttributes.push(`PREMISES_MATCH: ${prem}`);
        }
      }

      if (criteria.targetHour !== null && row.incident_datetime) {
        const incidentHour = new Date(row.incident_datetime).getUTCHours();
        const diff = Math.abs(incidentHour - criteria.targetHour);
        if (diff <= 2 || diff >= 22) {
          matchedAttributes.push(`APPROXIMATE_TIME_MATCH: ~${incidentHour}:00`);
        }
      }

      let relevanceTier = 'LOW';
      if (matchedAttributes.length >= 3) relevanceTier = 'HIGH';
      else if (matchedAttributes.length >= 2) relevanceTier = 'MEDIUM';

      return {
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
        matched_attributes: matchedAttributes,
        relevance_tier: relevanceTier,
        investigative_notice: 'SIMILARITY_MATCH_ONLY: This historical record shares documented characteristics (crime category, stolen property, or temporal context). It does NOT imply a shared perpetrator or solve active cases.'
      };
    });

    // Sort by number of matched attributes descending
    evaluatedResults.sort((a, b) => b.matched_attributes.length - a.matched_attributes.length);

    return {
      query,
      criteria,
      total_matches: evaluatedResults.length,
      similar_cases: evaluatedResults
    };
  }
}

module.exports = SimilarCaseEngine;

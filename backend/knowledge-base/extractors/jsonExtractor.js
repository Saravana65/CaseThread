/**
 * @file jsonExtractor.js
 * @brief Structured JSON record extractor for Private Crime Knowledge Base.
 * @project CASETHREAD
 */

const fs = require('fs');

class JsonExtractor {
  /**
   * Extracts text and structured metadata from JSON files.
   * @param {string} filePath
   * @returns {Promise<{ text: string, metadata: object }>}
   */
  static async extract(filePath) {
    const rawContent = await fs.promises.readFile(filePath, 'utf8');
    let parsed;
    try {
      parsed = JSON.parse(rawContent);
    } catch (err) {
      throw new Error(`Invalid JSON in file: ${err.message}`);
    }

    const metadata = {
      format: 'json',
      extracted_at: new Date().toISOString()
    };

    // Extract common fields if present
    const record = Array.isArray(parsed) ? parsed[0] || {} : parsed;
    if (!Array.isArray(parsed)) {
      for (const field of ['title', 'country', 'source_url', 'publisher', 'stolen_property', 'crime_subtype', 'investigative_actions', 'summary']) {
        if (typeof record[field] === 'string') metadata[field] = record[field];
      }
    }

    if (record.case_number || record.case_id || record.docket_number) {
      metadata.case_number = record.case_number || record.case_id || record.docket_number;
    }
    if (record.jurisdiction || record.court || record.court_name) {
      metadata.jurisdiction = record.jurisdiction || record.court || record.court_name;
    }
    if (record.crime_category || record.category || record.offense || record.charge) {
      metadata.crime_category = record.crime_category || record.category || record.offense || record.charge;
    }
    if (record.incident_date || record.date_occurred || record.judgment_date) {
      metadata.incident_date = record.incident_date || record.date_occurred || record.judgment_date;
    }
    if (record.verdict || record.disposition || record.outcome) {
      metadata.verdict = record.verdict || record.disposition || record.outcome;
    }

    // Build human-readable formatted representation for chunking & full-text indexing
    let textRepresentation = '';
    if (Array.isArray(parsed)) {
      textRepresentation = parsed.map((item, idx) => {
        return `[RECORD ${idx + 1}]\n` + Object.entries(item)
          .map(([k, v]) => `${k.toUpperCase()}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
          .join('\n');
      }).join('\n\n---\n\n');
    } else {
      const sections = [];
      if (record.title || record.case_name) {
        sections.push(`CASE TITLE: ${record.title || record.case_name}`);
      }
      if (metadata.case_number) sections.push(`CASE NUMBER: ${metadata.case_number}`);
      if (metadata.jurisdiction) sections.push(`JURISDICTION: ${metadata.jurisdiction}`);
      if (metadata.crime_category) sections.push(`CRIME CATEGORY: ${metadata.crime_category}`);
      if (metadata.incident_date) sections.push(`DATE: ${metadata.incident_date}`);
      if (metadata.verdict) sections.push(`VERDICT / OUTCOME: ${metadata.verdict}`);

      // Add summary or body if available
      if (record.summary || record.abstract) {
        sections.push(`\nSUMMARY:\n${record.summary || record.abstract}`);
      }
      if (record.facts || record.statement_of_facts) {
        sections.push(`\nSTATEMENT OF FACTS:\n${record.facts || record.statement_of_facts}`);
      }
      if (record.analysis || record.findings) {
        sections.push(`\nANALYSIS & FINDINGS:\n${record.analysis || record.findings}`);
      }
      if (record.judgment_text || record.content || record.full_text) {
        sections.push(`\nFULL RECORD TEXT:\n${record.judgment_text || record.content || record.full_text}`);
      }

      // If generic JSON object without standard fields, stringify clearly
      if (sections.length <= 1) {
        textRepresentation = Object.entries(record)
          .map(([k, v]) => `${k.toUpperCase()}: ${typeof v === 'object' ? JSON.stringify(v, null, 2) : v}`)
          .join('\n');
      } else {
        if (metadata.source_url) sections.push(`SOURCE: ${metadata.source_url}`);
        textRepresentation = sections.join('\n');
      }
    }

    return {
      text: textRepresentation,
      metadata
    };
  }
}

module.exports = JsonExtractor;

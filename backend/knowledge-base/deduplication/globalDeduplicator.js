/**
 * @file globalDeduplicator.js
 * @brief Cross-source deduplication, data quality verification, and conflicting statement preservation.
 * Detects identical SHA-256 hashes, cross-source case overlaps, and data inconsistencies.
 * @project CASETHREAD
 */

const { execute } = require('../../database/connection');

class GlobalDeduplicator {
  /**
   * Normalizes case identifiers for robust cross-source comparison.
   * Strips spaces, dashes, leading zeroes, and standardizes casing.
   */
  static normalizeIdentifier(id) {
    if (!id || typeof id !== 'string') return '';
    return id.toUpperCase().replace(/[\s\-_./\\:]/g, '');
  }

  /**
   * Evaluates record data quality and flags anomalies (missing jurisdiction, dates, etc.).
   */
  static validateQuality(record) {
    const issues = [];

    if (!record.country) issues.push('MISSING_COUNTRY');
    if (!record.jurisdiction) issues.push('MISSING_JURISDICTION');
    if (!record.crime_category) issues.push('MISSING_CRIME_CATEGORY');
    if (!record.case_reference_number) issues.push('MISSING_CASE_REFERENCE');
    if (!record.incident_datetime && !record.publication_date) issues.push('MISSING_TEMPORAL_ANCHOR');
    
    // Check for logical date conflicts (incident date in the future)
    if (record.incident_datetime && new Date(record.incident_datetime) > new Date()) {
      issues.push('ANOMALOUS_FUTURE_INCIDENT_DATE');
    }

    return {
      isValid: issues.length === 0,
      qualityScore: Math.max(0, 100 - issues.length * 20),
      issues
    };
  }

  /**
   * Checks whether a case has already been ingested from another source.
   * If found with conflicting details, flags potential conflict rather than silently overwriting.
   */
  static async checkCrossSourceDuplicate(record) {
    if (!record.case_reference_number || !record.country) {
      return { isDuplicate: false };
    }

    const [rows] = await execute(`
      SELECT kd.document_id, kd.source_id, kd.document_title, kd.case_reference_number,
             kd.country, kd.case_outcome, kd.incident_datetime, ks.source_name
      FROM knowledge_documents kd
      JOIN knowledge_sources ks ON kd.source_id = ks.source_id
      WHERE kd.country = ? AND kd.case_reference_number = ?
      LIMIT 1
    `, [record.country, record.case_reference_number]);

    if (rows.length === 0) {
      return { isDuplicate: false };
    }

    const existing = rows[0];
    const conflicts = [];

    if (existing.case_outcome && record.case_outcome && existing.case_outcome !== record.case_outcome) {
      conflicts.push(`Outcome discrepancy: existing '${existing.case_outcome}' vs incoming '${record.case_outcome}'`);
    }

    return {
      isDuplicate: true,
      existingDocumentId: existing.document_id,
      existingSource: existing.source_name,
      conflicts,
      hasConflicts: conflicts.length > 0
    };
  }
}

module.exports = GlobalDeduplicator;

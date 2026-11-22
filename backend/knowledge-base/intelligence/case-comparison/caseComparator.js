/**
 * @file caseComparator.js
 * @brief Structured cross-case comparison engine.
 * Contrasts investigator query facts against historical record attributes,
 * cataloging similar facts, different facts, verified investigative actions, and missing data.
 * @project CASETHREAD
 */

class CaseComparator {
  /**
   * Generates a structured comparison between investigator incident criteria and a historical record.
   * @param {object} criteria - Parsed investigator criteria
   * @param {object} historicalCase - Ranked historical record
   * @returns {object} Structured comparative assessment
   */
  static compare(criteria, historicalCase) {
    const similarFacts = [];
    const differentFacts = [];
    const missingOrUncertain = [];

    const histCategory = historicalCase.crime_category || 'GENERAL_CRIME';
    const histProperty = historicalCase.stolen_property || '';
    const histSubtype = historicalCase.crime_subtype || '';
    const histText = `${histCategory} ${histSubtype} ${histProperty} ${historicalCase.documented_circumstances || ''}`.toLowerCase();

    // 1. Compare Offense Classification
    if (criteria.crimeCategories && criteria.crimeCategories.includes(histCategory)) {
      similarFacts.push(`Offense Category: Both incidents are classified under ${histCategory}.`);
    } else if (criteria.crimeCategories && criteria.crimeCategories.length > 0) {
      differentFacts.push(`Offense Category Divergence: Incident query describes ${criteria.crimeCategories.join('/')}, whereas historical record is filed under ${histCategory} (${histSubtype}).`);
    }

    // 2. Compare Stolen Property / Targeted Items
    const matchingKeywords = [];
    for (const kw of criteria.propertyKeywords || []) {
      if (histText.includes(kw.toLowerCase())) {
        matchingKeywords.push(kw);
      }
    }

    if (matchingKeywords.length > 0) {
      similarFacts.push(`Targeted Property: Shared focus on ${matchingKeywords.join(', ')}.`);
    }

    if (criteria.ignoredItems && criteria.ignoredItems.length > 0) {
      if (criteria.ignoredItems.includes('cash') && histText.includes('cash')) {
        differentFacts.push(`Property Focus: Current incident perpetrator ignored cash, whereas historical case (${historicalCase.case_reference_number}) specifically ransacked cash drawers / currency.`);
      }
    }

    // 3. Compare Timing / Hour
    if (criteria.approximateTime && historicalCase.incident_datetime) {
      const histHour = new Date(historicalCase.incident_datetime).getUTCHours();
      const hourDiff = Math.abs(histHour - criteria.approximateTime.hour24);
      if (hourDiff <= 2 || hourDiff >= 22) {
        similarFacts.push(`Temporal Pattern: Both incidents occurred during the late evening / night window (~${histHour}:00 UTC).`);
      } else {
        differentFacts.push(`Time of Day: Incident occurred at ~${criteria.approximateTime.raw}, whereas historical record occurred at ${histHour}:00 UTC.`);
      }
    } else if (!historicalCase.incident_datetime) {
      missingOrUncertain.push('Incident exact timestamp is unrecorded in source document (aggregated or monthly index only).');
    }

    // 4. Compare Premises / Facility Type
    if (criteria.premises) {
      const premisesLabel = criteria.premises.replace(/_/g, ' ').toLowerCase();
      if (histText.includes(premisesLabel)) {
        similarFacts.push(`Premises Type: Consistent with commercial / distribution facility location.`);
      }
    }

    // 5. Documented Investigative Details
    let investigativeDetailsSummary = null;
    if (historicalCase.is_investigation_details_available && historicalCase.investigative_actions) {
      investigativeDetailsSummary = historicalCase.investigative_actions;
    } else {
      missingOrUncertain.push('Narrative investigative case notes and forensic logs are not published in this public police street dataset (restricted under privacy statutes).');
    }

    // 6. Outcome Analysis (Police vs Judicial)
    const outcomeType = historicalCase.record_level === 'COURT_JUDGMENT' ? 'JUDICIAL_DISPOSITION' : 'POLICE_INVESTIGATION_STATUS';
    const outcomeSummary = historicalCase.case_outcome
      ? `${outcomeType}: ${historicalCase.case_outcome}`
      : 'Outcome not recorded in source.';

    return {
      case_reference_number: historicalCase.case_reference_number,
      document_id: historicalCase.document_id,
      document_title: historicalCase.document_title,
      country: historicalCase.country,
      jurisdiction: historicalCase.jurisdiction,
      record_level: historicalCase.record_level,
      similar_facts: similarFacts,
      different_facts: differentFacts,
      documented_investigative_methods: investigativeDetailsSummary,
      recorded_outcome: outcomeSummary,
      missing_or_uncertain_details: missingOrUncertain,
      source_name: historicalCase.source_name,
      license_terms: historicalCase.license_terms
    };
  }
}

module.exports = CaseComparator;

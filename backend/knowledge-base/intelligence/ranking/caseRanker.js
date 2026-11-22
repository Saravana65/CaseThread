/**
 * @file caseRanker.js
 * @brief Multi-attribute transparent ranking engine for historical crime cases.
 * Generates transparent similarity tiering, matched feature explanations, and explicit non-guilt notices.
 * @project CASETHREAD
 */

class CaseRanker {
  /**
   * Evaluates and ranks candidate cases against investigative criteria.
   * @param {Array<object>} candidates - Retrieved cases from HybridRetriever
   * @param {object} criteria - Parsed criteria from QueryParser
   * @returns {Array<object>} Ranked cases with explanations and non-guilt disclaimers
   */
  static rank(candidates, criteria) {
    if (!Array.isArray(candidates) || candidates.length === 0) {
      return [];
    }

    const ranked = candidates.map(candidate => {
      const matchBreakdown = [];
      let rankScore = 0;

      const docText = `${candidate.crime_category || ''} ${candidate.crime_subtype || ''} ${candidate.stolen_property || ''} ${candidate.documented_circumstances || ''} ${candidate.investigative_actions || ''}`.toLowerCase();

      // 0. Explicit Contextual Follow-Up Target Match (100 pts)
      const targetCaseRef = typeof criteria.followUpTarget === 'object' ? criteria.followUpTarget?.case_reference_number : criteria.followUpTarget;
      if (targetCaseRef && candidate.case_reference_number === targetCaseRef) {
        rankScore += 100;
        matchBreakdown.push({
          attribute: 'CONTEXT_TARGET_MATCH',
          detail: `Direct conversational precedent target (${targetCaseRef})`,
          weight: 100
        });
      }

      // 1. Crime Category Match (30 pts)
      if (criteria.crimeCategories && criteria.crimeCategories.includes(candidate.crime_category)) {
        rankScore += 30;
        matchBreakdown.push({
          attribute: 'CRIME_CATEGORY',
          detail: `Direct classification match (${candidate.crime_category})`,
          weight: 30
        });
      }

      // 2. Stolen Property Match (25 pts)
      let propertyMatched = false;
      for (const item of criteria.propertyKeywords || []) {
        if (docText.includes(item.toLowerCase())) {
          propertyMatched = true;
          rankScore += 25;
          matchBreakdown.push({
            attribute: 'STOLEN_PROPERTY',
            detail: `Targeted item match: ${item}`,
            weight: 25
          });
          break;
        }
      }

      // 3. Temporal Match (Time of day / evening window) (15 pts)
      if (criteria.approximateTime && candidate.incident_datetime) {
        const incidentHour = new Date(candidate.incident_datetime).getUTCHours();
        const diff = Math.abs(incidentHour - criteria.approximateTime.hour24);
        if (diff <= 2 || diff >= 22) {
          rankScore += 15;
          matchBreakdown.push({
            attribute: 'TEMPORAL_WINDOW',
            detail: `Occurred in matching time window (~${incidentHour}:00 vs target ${criteria.approximateTime.raw})`,
            weight: 15
          });
        }
      }

      // 4. Premises / Facility Characteristic Match (15 pts)
      if (criteria.premises && docText.includes(criteria.premises.toLowerCase().replace(/_/g, ' '))) {
        rankScore += 15;
        matchBreakdown.push({
          attribute: 'PREMISES_TYPE',
          detail: `Facility type consistency (${criteria.premises})`,
          weight: 15
        });
      }

      // 5. Documented Investigative Details Presence (10 pts)
      if (candidate.is_investigation_details_available && candidate.investigative_actions) {
        rankScore += 10;
        matchBreakdown.push({
          attribute: 'INVESTIGATIVE_PROVENANCE',
          detail: 'Source contains verified police/judicial investigative methods',
          weight: 10
        });
      }

      // 6. Case Outcome Documentation Presence (5 pts)
      if (candidate.case_outcome && candidate.case_outcome !== 'UNKNOWN') {
        rankScore += 5;
        matchBreakdown.push({
          attribute: 'DOCUMENTED_OUTCOME',
          detail: `Documented judicial/police resolution (${candidate.case_outcome})`,
          weight: 5
        });
      }

      // Determine Qualitative Relevance Tier (No fake percentage scores)
      let relevanceTier = 'LOW';
      if (rankScore >= 55) {
        relevanceTier = 'HIGH';
      } else if (rankScore >= 30) {
        relevanceTier = 'MEDIUM';
      }

      // Generate Human-Readable Reason Explanation
      const explanationParts = matchBreakdown.map(m => m.detail);
      const explanation = explanationParts.length > 0
        ? `Identified as relevant based on: ${explanationParts.join('; ')}.`
        : 'Retrieved as contextual historical record sharing jurisdiction or broad offense class.';

      return {
        ...candidate,
        rank_score: rankScore,
        relevance_tier: relevanceTier,
        match_breakdown: matchBreakdown,
        similarity_explanation: explanation,
        investigative_notice: 'SIMILARITY_MATCH_ONLY: This historical record shares documented characteristics (crime category, stolen property, or temporal context). It does NOT imply a shared perpetrator or solve active cases.'
      };
    });

    // Sort descending by rankScore
    ranked.sort((a, b) => b.rank_score - a.rank_score);

    return ranked;
  }
}

module.exports = CaseRanker;

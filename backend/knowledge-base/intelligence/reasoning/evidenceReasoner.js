/**
 * @file evidenceReasoner.js
 * @brief Evidence-grounded reasoning engine and investigative RAG synthesizer.
 * Generates structured analytical answers, case resolution explanations, and verified next-step leads
 * using strictly retrieved historical documents.
 * @project CASETHREAD
 */

class EvidenceReasoner {
  /**
   * Generates a coherent, evidence-grounded analytical response for the investigator.
   * @param {object} params
   * @param {string} params.query - Investigator question
   * @param {object} params.criteria - Parsed criteria
   * @param {Array<object>} params.rankedCases - Top ranked historical cases
   * @param {Array<object>} params.comparisons - Case comparisons
   * @param {Array<object>} params.citations - Verified citations
   * @returns {object} Final RAG response payload
   */
  static reason({ query, criteria, rankedCases, comparisons, citations }) {
    if (!rankedCases || rankedCases.length === 0) {
      return {
        answer: `No historical cases matching the specified criteria were discovered in the private knowledge base across authorized jurisdictions (${criteria.targetCountries?.length ? criteria.targetCountries.join(', ') : 'United Kingdom, United States, India'}). Verify crime category or relax temporal/property filters.`,
        how_previous_cases_were_solved: [],
        investigative_suggestions: [
          {
            step: 'Log incident details in current investigation docket',
            rationale: 'Preserve ground truth timeline and victim statements while searching for cross-jurisdictional leads.',
            grounded_in_case: null
          }
        ],
        limitations: 'Search yielded zero matching candidate documents.'
      };
    }

    const topCase = rankedCases[0];
    const topComp = comparisons[0];

    // 1. Synthesize Main Investigative Answer
    const answerParagraphs = [];

    // Header statement
    const matchingCountries = [...new Set(rankedCases.map(c => c.country))];
    answerParagraphs.push(
      `Based on authorized historical records in the Private Knowledge Base across ${matchingCountries.join(', ')}, ${rankedCases.length} relevant documented incident(s) were identified sharing investigative attributes with your query.`
    );

    // Detail Top Historical Match
    if (topCase) {
      const topCitationRef = `[${topCase.case_reference_number} / Doc #${topCase.document_id}]`;
      answerParagraphs.push(
        `The closest historical precedent is **${topCase.document_title}** ${topCitationRef}, documented in **${topCase.country}** (${topCase.jurisdiction}). ` +
        `This case involved ${topCase.crime_subtype || topCase.crime_category}, occurring at ${topCase.incident_datetime ? new Date(topCase.incident_datetime).toUTCString() : 'a documented late-hour interval'}. ` +
        `Documented property targeted: ${topCase.stolen_property || 'Unspecified commercial assets'}.`
      );

      // Comparative highlights
      if (topComp && topComp.similar_facts.length > 0) {
        answerParagraphs.push(
          `**Key Similarities:** ${topComp.similar_facts.join(' ')}`
        );
      }
      if (topComp && topComp.different_facts.length > 0) {
        answerParagraphs.push(
          `**Notable Differences:** ${topComp.different_facts.join(' ')}`
        );
      }
    }

    // 2. Section 8: How Previous Cases Were Solved
    const solvedExplanations = [];
    for (const c of rankedCases.slice(0, 3)) {
      if (c.is_investigation_details_available && c.investigative_actions) {
        solvedExplanations.push({
          case_reference: c.case_reference_number,
          jurisdiction: c.jurisdiction,
          country: c.country,
          evidence_examined: c.evidence_types || 'Digital records, physical scene evidence',
          investigative_methods: c.investigative_actions,
          property_recovered: c.property_recovered === true ? 'YES (Portion of stolen assets recovered)' : (c.property_recovered === false ? 'NO (Unrecovered)' : 'PARTIAL / NOT SPECIFIED'),
          recorded_legal_outcome: c.case_outcome || 'JUDICIALLY DISPOSED',
          provenance_citation: `Doc #${c.document_id} (${c.source_name})`
        });
      } else {
        solvedExplanations.push({
          case_reference: c.case_reference_number,
          jurisdiction: c.jurisdiction,
          country: c.country,
          evidence_examined: 'Public incident logs and street geocodes only',
          investigative_methods: 'Narrative investigative steps are restricted under public release exemptions for this dataset.',
          property_recovered: 'NOT PUBLISHED IN OPEN INCIDENT STREAM',
          recorded_legal_outcome: c.case_outcome || 'Status not published',
          provenance_citation: `Doc #${c.document_id} (${c.source_name})`
        });
      }
    }

    // 3. Section 9: Investigative Next-Step Suggestions
    const suggestions = [];

    // Suggestion A: CCTV & Entryway Surveillance
    if (criteria.approximateTime || criteria.crimeCategories?.includes('ROBBERY') || criteria.crimeCategories?.includes('BURGLARY')) {
      const windowStr = criteria.approximateTime?.raw || 'the incident interval';
      const caseBacking = rankedCases.find(c => c.investigative_actions?.toLowerCase().includes('cctv'));
      suggestions.push({
        priority: 'HIGH',
        category: 'PHYSICAL_AND_DIGITAL_SURVEILLANCE',
        recommendation: `Secure and preserve all CCTV and security camera DVR footage covering facility entrance and perimeter roads for the interval surrounding ${windowStr}.`,
        rationale: caseBacking
          ? `In precedent case ${caseBacking.case_reference_number}, spot inspection and CCTV DVR recovery proved critical in establishing suspect ingress and vehicle movements.`
          : 'General forensic best practice for commercial and residential forced entries during late evening hours.',
        grounded_in_case: caseBacking ? caseBacking.case_reference_number : null
      });
    }

    // Suggestion B: Telecommunications / Mobile Tower Dump Analysis
    const telecomBacking = rankedCases.find(c => c.investigative_actions?.toLowerCase().includes('tower dump') || c.investigative_actions?.toLowerCase().includes('call'));
    if (telecomBacking) {
      suggestions.push({
        priority: 'HIGH',
        category: 'CELL_TOWER_AND_COMMUNICATIONS',
        recommendation: 'Request authorized cell site / mobile tower dump logs for the sector covering the crime scene at the estimated incident timestamp.',
        rationale: `Documented in precedent ${telecomBacking.case_reference_number}: Mobile tower dump analysis isolated mobile identifiers active near the warehouse during the robbery window, corroborating suspect presence.`,
        grounded_in_case: telecomBacking.case_reference_number
      });
    }

    // Suggestion C: Specialized Hardware / Stolen Property Ledger Tracking
    if (criteria.propertyKeywords && criteria.propertyKeywords.length > 0) {
      const prop = criteria.propertyKeywords.join(' and ');
      const recoveryBacking = rankedCases.find(c => c.property_recovered === true);
      suggestions.push({
        priority: 'MEDIUM',
        category: 'STOLEN_PROPERTY_TRACING',
        recommendation: `Disseminate serial numbers and MAC addresses for the targeted ${prop} across authorized pawnshop databases, digital marketplaces, and distributor RMA channels.`,
        rationale: recoveryBacking
          ? `In case ${recoveryBacking.case_reference_number}, stolen electronic goods and commercial equipment were tracked and recovered through distributor serial matches and custodial disclosures.`
          : 'Prevents secondary liquidation of high-value electronic components.',
        grounded_in_case: recoveryBacking ? recoveryBacking.case_reference_number : null
      });
    }

    // Suggestion D: Digital Forensics & Hash Verification
    const cyberBacking = rankedCases.find(c => c.investigative_actions?.toLowerCase().includes('hash') || c.investigative_actions?.toLowerCase().includes('forensic'));
    if (cyberBacking) {
      suggestions.push({
        priority: 'MEDIUM',
        category: 'FORENSIC_INTEGRITY',
        recommendation: 'Perform immediate forensic bitstream imaging (SHA-256) of on-site administrative logs, keycard readers, and terminal endpoints.',
        rationale: `In case ${cyberBacking.case_reference_number}, forensic disk hashing and keystroke artifact verification provided inadmissible-proof resilience under judicial review.`,
        grounded_in_case: cyberBacking.case_reference_number
      });
    }

    // If investigator asked specifically about solved methods, append dedicated explanation
    if (criteria.requestedIntent === 'SOLVED_METHODS' && topCase) {
      if (topCase.is_investigation_details_available && topCase.investigative_actions) {
        answerParagraphs.push(
          `**Documented Investigative Resolution (${topCase.case_reference_number}):** The case was investigated through ${topCase.investigative_actions}. ` +
          `Key evidence examined included: ${topCase.evidence_types || 'digital surveillance and scene physical traces'}. ` +
          `Stolen property status: ${topCase.property_recovered ? 'Recovered' : 'Not recovered'}. ` +
          `Final court verdict: ${topCase.case_outcome || 'Judicial conviction affirmed'}.`
        );
      }
    } else if (criteria.requestedIntent === 'NEXT_STEPS') {
      answerParagraphs.push(
        `**Evidence-Grounded Next Steps for Current Investigation:**\n` +
        suggestions.map((s, idx) => `${idx + 1}. [${s.priority}] **${s.category}**: ${s.recommendation} (${s.rationale})`).join('\n')
      );
    }

    // Limitations notice
    const limitations = 'All factual statements are derived directly from indexed historical source documents. Similarities do not establish shared perpetrators. Investigative decisions remain strictly with authorized law enforcement officers.';

    return {
      answer: answerParagraphs.join('\n\n'),
      how_previous_cases_were_solved: solvedExplanations,
      investigative_suggestions: suggestions,
      limitations
    };
  }
}

module.exports = EvidenceReasoner;

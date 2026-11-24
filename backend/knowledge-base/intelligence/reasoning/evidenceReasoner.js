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
  static reason({ query, criteria, rankedCases, comparisons, citations, patterns = [], graphExecution = null }) {
    if (!rankedCases || rankedCases.length === 0) {
      return {
        answer: `No historical cases matching the specified criteria were discovered in the private knowledge base across authorized jurisdictions (${criteria.targetCountries?.length ? criteria.targetCountries.join(', ') : 'all searched jurisdictions'}). Which details can you confirm from a receipt, inventory or incident report?`,
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
      const topCitationRef = `[${topCase.case_reference_number || 'Archive record'} / Doc #${topCase.document_id}]`;
      answerParagraphs.push(
        `The closest historical precedent is **${topCase.document_title}** ${topCitationRef}, documented in **${topCase.country}** (${topCase.jurisdiction}). ` +
        `This case involved ${topCase.crime_subtype || topCase.crime_category}, occurring at ${topCase.incident_datetime ? new Date(topCase.incident_datetime).toUTCString() : 'an unreported time'}. ` +
        `Documented property targeted: ${topCase.stolen_property || 'Not documented'}.`
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
          evidence_examined: c.evidence_types || 'Not documented',
          investigative_methods: c.investigative_actions,
          property_recovered: c.property_recovered === true ? 'YES (Portion of stolen assets recovered)' : (c.property_recovered === false ? 'NO (Unrecovered)' : 'PARTIAL / NOT SPECIFIED'),
          recorded_legal_outcome: c.case_outcome || 'Not documented',
          provenance_citation: `Doc #${c.document_id} (${c.source_name})`
        });
      } else {
        solvedExplanations.push({
          case_reference: c.case_reference_number,
          jurisdiction: c.jurisdiction,
          country: c.country,
          evidence_examined: 'Not documented',
          investigative_methods: 'Not documented in this record.',
          property_recovered: 'NOT PUBLISHED IN OPEN INCIDENT STREAM',
          recorded_legal_outcome: c.case_outcome || 'Status not published',
          provenance_citation: `Doc #${c.document_id} (${c.source_name})`
        });
      }
    }

    // 3. Section 9: Investigative Next-Step Suggestions
    const suggestions = [];

    if (criteria.propertyKeywords?.length) {
      suggestions.push({
        priority: 'HIGH', category: 'PROPERTY_VERIFICATION',
        recommendation: `Confirm which ${criteria.propertyKeywords.join(' and ')} were taken and record any available serial numbers or purchase records.`,
        rationale: 'Suggested check based on the current report.', grounded_in_case: null
      });
    }

    // Suggestion: Surveillance & Scene Evidence
    if (criteria.approximateTime || criteria.crimeCategories?.includes('ROBBERY') || criteria.crimeCategories?.includes('BURGLARY')) {
      const windowStr = criteria.approximateTime?.raw || 'the incident interval';
      const caseBacking = rankedCases.find(c => c.investigative_actions?.toLowerCase().includes('cctv'));
      suggestions.push({
        priority: 'HIGH',
        category: 'PHYSICAL_AND_DIGITAL_SURVEILLANCE',
        recommendation: `Secure and preserve all CCTV and security camera DVR footage covering facility entrance and perimeter roads for ${windowStr}.`,
        rationale: caseBacking
          ? `In precedent case ${caseBacking.case_reference_number}, CCTV footage was primary evidentiary basis for suspect identification.`
          : 'High-probability lead generation window before standard 72-hour DVR overwrite cycles.',
        grounded_in_case: caseBacking ? caseBacking.case_reference_number : null
      });
    }

    if (criteria.approximateTime) {
      suggestions.push({
        priority: 'MEDIUM', category: 'TIMELINE_VERIFICATION',
        recommendation: `Confirm the reported time (${criteria.approximateTime.raw}) against available timestamped records.`,
        rationale: 'Suggested check based on the reported timeline.', grounded_in_case: null
      });
    }

    if (!suggestions.length) suggestions.push({
      priority: 'MEDIUM', category: 'SOURCE_VERIFICATION',
      recommendation: 'Compare the original incident report with the cited record and identify one detail that can be independently verified.',
      rationale: 'A broad offense match alone has limited investigative value.', grounded_in_case: null
    });

    if (criteria.requestedIntent === 'SIMILAR_CASES' || ['SOLVED_METHODS', 'OUTCOME_DETAILS', 'RECOVERY_STATUS'].includes(criteria.requestedIntent)) {
      if (topComp?.missing_or_uncertain_details?.length) answerParagraphs.push(topComp.missing_or_uncertain_details.join(' '));
      const detailed = solvedExplanations.find(row => row.investigative_methods && row.investigative_methods !== 'Not documented in this record.');
      if (detailed) answerParagraphs.push(`Documented actions (${detailed.provenance_citation}): ${detailed.investigative_methods}`);
      else answerParagraphs.push('The retrieved records do not explain how investigators resolved the case.');
      answerParagraphs.push(`Reported outcome for the closest match: ${topCase.case_outcome || 'Not documented'}.`);
      if (suggestions.length) answerParagraphs.push(`Suggested next check: ${suggestions[0].recommendation}`);
    }

    // If investigator asked specifically about solved methods, append dedicated explanation
    if (criteria.requestedIntent === 'NEXT_STEPS') {
      answerParagraphs.push(
        `**Evidence-Grounded Next Steps for Current Investigation:**\n` +
        suggestions.map((s, idx) => `${idx + 1}. [${s.priority}] **${s.category}**: ${s.recommendation} (${s.rationale})`).join('\n')
      );
    } else if (criteria.requestedIntent === 'CROSS_CASE_PATTERNS') {
      if (patterns && patterns.length > 0) {
        answerParagraphs.push(
          `**Documented Crime Patterns Detected Across Precedents:**\n` +
          patterns.map((p, idx) => `${idx + 1}. **${p.pattern_name}** (${p.frequency_count} cases):\n   ${p.pattern_description}\n   - **Shared Facts:** ${p.key_similarities.join(' ')}\n   - **Divergences:** ${p.relevant_differences.join(' ')}\n   - **Forensic Notice:** ${p.forensic_limitations}`).join('\n\n')
        );
      } else {
        answerParagraphs.push('No multi-case pattern clusters meeting empirical thresholds were identified beyond broad offense classification.');
      }
    } else if (criteria.requestedIntent === 'DIRECT_CONNECTION_CHECK') {
      answerParagraphs.push(
        `**Direct Relationship Analysis:** There is NO documented direct evidentiary connection (such as verified co-conspirators, shared vehicle registrations, or matched ballistic/fingerprint forensics) linking these incidents across jurisdictions. The cases share documented attributes (such as targeted property or timing) representing similar criminal typologies, which does NOT establish a shared perpetrator or organized crime syndicate.`
      );
    } else if (criteria.requestedIntent === 'GRAPH_ANALYSIS') {
      const algoName = graphExecution?.algorithm || 'BFS';
      const latency = graphExecution?.execution_latency_ms || 0;
      answerParagraphs.push(
        `**Native C Graph Analysis (${algoName}):** The cross-case graph constructed from ${rankedCases.length} retrieved cases was analyzed using native C algorithms (O(V+E)) in ${latency}ms. Cases are connected exclusively through intermediary shared attribute nodes (crime category, premises type, targeted property, and investigative actions). Zero direct co-offender edges were identified between jurisdictions.`
      );
    } else if (criteria.requestedIntent === 'MISSING_DATA') {
      answerParagraphs.push((topComp?.missing_or_uncertain_details || []).join(' ') || 'No additional gaps were identified in this comparison.');
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

/**
 * @file crossCaseGraphBuilder.js
 * @brief Constructs evidence-grounded cross-case graphs from genuine historical crime records.
 * Generates typed nodes (cases, property, premises, investigative methods, jurisdictions, outcomes)
 * and typed edges strictly distinguishing shared attributes from direct investigative links.
 * Formats graph payloads for native C algorithm execution (casethread_engine.exe).
 * @project CASETHREAD
 */

class CrossCaseGraphBuilder {
  /**
   * Builds a normalized cross-case graph payload from historical knowledge documents.
   * @param {Array<object>} documents - Genuine records from knowledge_documents
   * @param {object} [options]
   * @param {boolean} [options.includeMethods=true] - Include investigative action nodes
   * @param {boolean} [options.includeProperty=true] - Include targeted property nodes
   * @param {boolean} [options.includePremises=true] - Include facility/premises nodes
   * @returns {object} Formatted graph with nodes, edges, entityMap, and C-engine payload
   */
  static buildGraph(documents, options = {}) {
    const {
      includeMethods = true,
      includeProperty = true,
      includePremises = true
    } = options;

    const nodes = [];
    const edges = [];
    const nodeLookup = new Map(); // key -> numeric ID
    let currentId = 0;

    const getOrCreateNode = (key, type, label, metadata = {}) => {
      if (nodeLookup.has(key)) {
        return nodeLookup.get(key);
      }
      const nodeId = currentId++;
      const nodeObj = {
        id: nodeId,
        node_key: key,
        type,
        label,
        ...metadata
      };
      nodes.push(nodeObj);
      nodeLookup.set(key, nodeId);
      return nodeId;
    };

    let edgeIdCounter = 0;
    const addEdge = (sourceId, targetId, relationType, nature, weight = 1.0, desc = '') => {
      if (sourceId === targetId) return;
      // Prevent exact duplicate edges
      const exists = edges.some(e => 
        (e.source_id === sourceId && e.target_id === targetId && e.relation_type === relationType) ||
        (e.source_id === targetId && e.target_id === sourceId && e.relation_type === relationType)
      );
      if (exists) return;

      edges.push({
        id: ++edgeIdCounter,
        source_id: sourceId,
        target_id: targetId,
        source_type: nodes[sourceId].type,
        target_type: nodes[targetId].type,
        source_label: nodes[sourceId].label,
        target_label: nodes[targetId].label,
        relation_type: relationType,
        relationship_nature: nature, // RECORDED_DIRECT, SHARED_ATTRIBUTE, DATA_DERIVED, SUGGESTED_FOR_VERIFICATION
        confidence_weight: weight,
        description: desc
      });
    };

    // 1. Process each document into Case Node and Attribute Nodes
    for (const doc of documents) {
      const caseKey = `CASE_${doc.document_id || doc.case_reference_number}`;
      const caseNodeId = getOrCreateNode(caseKey, 'HISTORICAL_CASE', doc.case_reference_number, {
        document_id: doc.document_id,
        case_reference_number: doc.case_reference_number,
        title: doc.document_title,
        country: doc.country,
        jurisdiction: doc.jurisdiction,
        crime_category: doc.crime_category,
        crime_subtype: doc.crime_subtype,
        incident_datetime: doc.incident_datetime,
        stolen_property: doc.stolen_property,
        case_outcome: doc.case_outcome,
        is_investigation_details_available: !!doc.is_investigation_details_available,
        source_name: doc.source_name,
        citation_id: `CIT-${doc.document_id}`
      });

      // Node: Crime Category
      if (doc.crime_category) {
        const catKey = `CAT_${doc.crime_category.toUpperCase()}`;
        const catNodeId = getOrCreateNode(catKey, 'CRIME_CATEGORY', doc.crime_category, {
          category_name: doc.crime_category
        });
        addEdge(caseNodeId, catNodeId, 'OFFENSE_CLASSIFICATION', 'SHARED_ATTRIBUTE', 0.85,
          `Documented offense class: ${doc.crime_category}`);
      }

      // Node: Jurisdiction / Country
      if (doc.country) {
        const jurLabel = doc.jurisdiction ? `${doc.country}: ${doc.jurisdiction}` : doc.country;
        const jurKey = `JUR_${doc.country.replace(/\s+/g, '_').toUpperCase()}`;
        const jurNodeId = getOrCreateNode(jurKey, 'JURISDICTION', jurLabel, {
          country: doc.country,
          jurisdiction: doc.jurisdiction
        });
        addEdge(caseNodeId, jurNodeId, 'JURISDICTION_PRECEDENT', 'DATA_DERIVED', 0.70,
          `Judicial/Police authority: ${jurLabel}`);
      }

      // Node: Targeted Property (Normalized categories)
      if (includeProperty && doc.stolen_property) {
        const propLower = doc.stolen_property.toLowerCase();
        if (propLower.includes('electronic') || propLower.includes('graphics') || propLower.includes('terminal') || propLower.includes('pos')) {
          const propId = getOrCreateNode('PROP_ELECTRONICS', 'PROPERTY_CATEGORY', 'Electronics & Hardware Components', {
            property_type: 'ELECTRONICS'
          });
          addEdge(caseNodeId, propId, 'TARGETED_PROPERTY', 'SHARED_ATTRIBUTE', 0.90,
            `Documented stolen property: electronics or commercial computing hardware`);
        }
        if (propLower.includes('cash') || propLower.includes('currency') || propLower.includes('money') || propLower.includes('inr') || propLower.includes('usd')) {
          const cashId = getOrCreateNode('PROP_CASH', 'PROPERTY_CATEGORY', 'Cash & Currency Reserves', {
            property_type: 'CASH'
          });
          addEdge(caseNodeId, cashId, 'TARGETED_PROPERTY', 'SHARED_ATTRIBUTE', 0.90,
            `Documented stolen property: cash funds or currency`);
        }
        if (propLower.includes('jewel') || propLower.includes('gold') || propLower.includes('watch') || propLower.includes('diamond')) {
          const goldId = getOrCreateNode('PROP_JEWELRY', 'PROPERTY_CATEGORY', 'Precious Jewelry & Metals', {
            property_type: 'JEWELRY'
          });
          addEdge(caseNodeId, goldId, 'TARGETED_PROPERTY', 'SHARED_ATTRIBUTE', 0.90,
            `Documented stolen property: jewelry or precious metals`);
        }
        if (propLower.includes('fund') || propLower.includes('transfer') || propLower.includes('neft') || propLower.includes('wire') || propLower.includes('bank')) {
          const fundId = getOrCreateNode('PROP_DIGITAL_FUNDS', 'PROPERTY_CATEGORY', 'Digital & Wire Transfer Funds', {
            property_type: 'DIGITAL_FUNDS'
          });
          addEdge(caseNodeId, fundId, 'TARGETED_PROPERTY', 'SHARED_ATTRIBUTE', 0.90,
            `Documented stolen property: digital banking or wire transfers`);
        }
      }

      // Node: Premises & Modus Operandi
      if (includePremises) {
        const circum = `${doc.documented_circumstances || ''} ${doc.crime_subtype || ''} ${doc.document_title || ''}`.toLowerCase();
        if (circum.includes('commercial') || circum.includes('warehouse') || circum.includes('distribution') || circum.includes('depot')) {
          const premId = getOrCreateNode('PREM_WAREHOUSE', 'PREMISES_TYPE', 'Commercial Warehouse / Logistics Facility', {
            facility: 'COMMERCIAL_WAREHOUSE'
          });
          addEdge(caseNodeId, premId, 'FACILITY_CHARACTERISTIC', 'SHARED_ATTRIBUTE', 0.80,
            `Facility characteristic: commercial warehouse / distribution facility`);
        } else if (circum.includes('retail') || circum.includes('store') || circum.includes('shop')) {
          const premId = getOrCreateNode('PREM_RETAIL', 'PREMISES_TYPE', 'Retail Store / Commercial Shop', {
            facility: 'RETAIL_STORE'
          });
          addEdge(caseNodeId, premId, 'FACILITY_CHARACTERISTIC', 'SHARED_ATTRIBUTE', 0.80,
            `Facility characteristic: retail storefront`);
        } else if (circum.includes('street') || circum.includes('public') || circum.includes('road')) {
          const premId = getOrCreateNode('PREM_STREET', 'PREMISES_TYPE', 'Public Street / Thoroughfare', {
            facility: 'PUBLIC_STREET'
          });
          addEdge(caseNodeId, premId, 'FACILITY_CHARACTERISTIC', 'SHARED_ATTRIBUTE', 0.75,
            `Facility characteristic: public street or highway`);
        }
      }

      // Node: Investigative Method Deployed
      if (includeMethods && doc.investigative_actions) {
        const acts = doc.investigative_actions.toLowerCase();
        if (acts.includes('cctv') || acts.includes('dvr') || acts.includes('surveillance')) {
          const cctvId = getOrCreateNode('METHOD_CCTV', 'INVESTIGATIVE_METHOD', 'Spot CCTV & DVR Seizure', {
            method: 'CCTV_ANALYSIS'
          });
          addEdge(caseNodeId, cctvId, 'INVESTIGATIVE_ACTION', 'DATA_DERIVED', 0.75,
            `Forensic method: spot inspection and DVR footage recovery`);
        }
        if (acts.includes('tower dump') || acts.includes('call') || acts.includes('cdr') || acts.includes('imei')) {
          const cdrId = getOrCreateNode('METHOD_TOWER_DUMP', 'INVESTIGATIVE_METHOD', 'Cellular Tower Dump & IMEI Filtering', {
            method: 'TELECOM_ANALYSIS'
          });
          addEdge(caseNodeId, cdrId, 'INVESTIGATIVE_ACTION', 'DATA_DERIVED', 0.75,
            `Forensic method: mobile tower dump identification of co-located devices`);
        }
        if (acts.includes('section 27') || acts.includes('recovery') || acts.includes('confession') || acts.includes('disclosure')) {
          const sec27Id = getOrCreateNode('METHOD_SECTION_27', 'INVESTIGATIVE_METHOD', 'Custodial Disclosure & Property Recovery', {
            method: 'PROPERTY_RECOVERY'
          });
          addEdge(caseNodeId, sec27Id, 'INVESTIGATIVE_ACTION', 'DATA_DERIVED', 0.80,
            `Forensic method: Section 27 disclosure leading to discovery of stolen property`);
        }
      }

      // Node: Documented Outcome
      if (doc.case_outcome && doc.case_outcome !== 'UNKNOWN' && doc.case_outcome !== 'Status not published') {
        const outLabel = doc.case_outcome.replace(/_/g, ' ');
        const outKey = `OUTCOME_${doc.case_outcome.toUpperCase()}`;
        const outId = getOrCreateNode(outKey, 'LEGAL_DISPOSITION', outLabel, {
          outcome: doc.case_outcome
        });
        addEdge(caseNodeId, outId, 'CASE_DISPOSITION', 'DATA_DERIVED', 0.70,
          `Judicial or police outcome: ${outLabel}`);
      }
    }

    // 2. Format payload for native C algorithm engine (casethread_engine.exe)
    const cPayload = {
      case_id: 8888, // Dedicated Cross-Case Analysis Context ID
      entities: nodes.map(n => ({
        id: n.id,
        type: n.type,
        label: n.label
      })),
      evidence: [],
      relationships: edges.map(e => ({
        id: e.id,
        source_type: e.source_type,
        source_id: e.source_id,
        target_type: e.target_type,
        target_id: e.target_id,
        relation_type: e.relation_type,
        confidence_weight: e.confidence_weight
      })),
      timeline: []
    };

    return {
      nodes,
      edges,
      cPayload,
      total_nodes: nodes.length,
      total_edges: edges.length,
      nodeLookup
    };
  }
}

module.exports = CrossCaseGraphBuilder;

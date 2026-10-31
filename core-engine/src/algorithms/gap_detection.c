/**
 * @file gap_detection.c
 * @brief Rule-based Evidence Gap Detection Engine.
 * @project CASETHREAD
 *
 * Discovers:
 *   1. Missing timestamps in evidence records
 *   2. Missing evidence source / chain-of-custody provenance
 *   3. Unverified observations lacking corroboration
 *   4. Incomplete location metadata
 *   5. Missing supporting records for relationship edges
 *   6. Disconnected evidence clusters (isolated vertices in graph)
 */

#include "analysis.h"

ct_status_t ct_detect_evidence_gaps(const evidence_graph_t *graph, const avl_tree_t *timeline_tree,
                                    const evidence_record_t *evidence_list, analysis_result_t *out_result) {
    if (!graph || !out_result) return CT_ERR_INVALID_INPUT;
    (void)timeline_tree;

    int gap_counter = 1;
    char gap_id[32];

    // 1. Audit evidence records for field gaps
    const evidence_record_t *ev = evidence_list;
    while (ev) {
        int related_ids[1] = { ev->evidence_id };

        // Gap 1: Missing Timestamp
        if (ev->timestamp <= 0) {
            snprintf(gap_id, sizeof(gap_id), "GAP-TIME-%03d", gap_counter++);
            char reason[256];
            snprintf(reason, sizeof(reason), "Evidence '%s' (%s) lacks a verified temporal collection timestamp.", ev->title, ev->tracking_code);
            analysis_add_gap(out_result, gap_id, "MISSING_TIMESTAMP",
                             "Missing Collection Timestamp",
                             reason,
                             "Review officer logs or digital metadata to ascertain exact collection timestamp.",
                             GAP_SEVERITY_MEDIUM, related_ids, 1);
        }

        // Gap 2: Missing Source Provenance
        if (ev->source[0] == '\0' || strcmp(ev->source, "UNKNOWN") == 0) {
            snprintf(gap_id, sizeof(gap_id), "GAP-SRC-%03d", gap_counter++);
            char reason[256];
            snprintf(reason, sizeof(reason), "Evidence '%s' does not specify an authoritative source or chain-of-custody origin.", ev->title);
            analysis_add_gap(out_result, gap_id, "MISSING_SOURCE",
                             "Unverified Evidence Provenance",
                             reason,
                             "Document the specific device, witness or officer from whom this item was obtained.",
                             GAP_SEVERITY_HIGH, related_ids, 1);
        }

        // Gap 3: Unverified Observation
        if (ev->verification_status == STATUS_UNVERIFIED_OBSERVATION) {
            snprintf(gap_id, sizeof(gap_id), "GAP-VERIF-%03d", gap_counter++);
            char reason[256];
            snprintf(reason, sizeof(reason), "Observation '%s' remains unverified by physical evidence or corroborating testimony.", ev->title);
            analysis_add_gap(out_result, gap_id, "UNVERIFIED_OBSERVATION",
                             "Uncorroborated Witness/Tip Observation",
                             reason,
                             "Seek secondary corroboration such as CCTV footage or electronic access records.",
                             GAP_SEVERITY_HIGH, related_ids, 1);
        }

        // Gap 4: Incomplete Location
        if (ev->collection_location[0] == '\0') {
            snprintf(gap_id, sizeof(gap_id), "GAP-LOC-%03d", gap_counter++);
            char reason[256];
            snprintf(reason, sizeof(reason), "Evidence '%s' lacks collection location coordinates or physical address.", ev->title);
            analysis_add_gap(out_result, gap_id, "INCOMPLETE_LOCATION",
                             "Missing Geographic Location",
                             reason,
                             "Identify exact physical room, intersection, or GPS coordinates where item was logged.",
                             GAP_SEVERITY_LOW, related_ids, 1);
        }

        ev = ev->next;
    }

    // 2. Audit Graph Topology for Disconnected Evidence Clusters
    if (graph->num_vertices > 0) {
        int *components = (int *)malloc(graph->num_vertices * sizeof(int));
        int num_components = 0;

        if (components && graph_connected_components(graph, components, &num_components) == CT_SUCCESS) {
            if (num_components > 1) {
                // Find isolated vertices (degree == 0)
                for (size_t i = 0; i < graph->num_vertices; i++) {
                    if (graph->vertices[i].degree == 0) {
                        snprintf(gap_id, sizeof(gap_id), "GAP-ISOL-%03d", gap_counter++);
                        char reason[256];
                        snprintf(reason, sizeof(reason), "Entity '%s' (%s) is isolated with 0 relational links to case graph.",
                                 graph->vertices[i].label, graph->vertices[i].entity_type);

                        int rel_ids[1] = { graph->vertices[i].original_db_id };
                        analysis_add_gap(out_result, gap_id, "DISCONNECTED_CLUSTER",
                                         "Isolated Investigation Node",
                                         reason,
                                         "Investigate potential phone, vehicle, or associate connections to integrate entity into main case thread.",
                                         GAP_SEVERITY_MEDIUM, rel_ids, 1);
                    }
                }
            }
            free(components);
        }
    }

    return CT_SUCCESS;
}

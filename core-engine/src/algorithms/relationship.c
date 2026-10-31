/**
 * @file relationship.c
 * @brief Algorithmic evidence relationship discovery module.
 * @project CASETHREAD
 *
 * Distinguishes direct recorded links from algorithmically suggested associations.
 * Rules:
 *   1. Co-location correlation: Two items collected at identical location within 30 min window.
 *   2. Shared entity correlation: Direct links between evidence referencing identical suspects/vehicles.
 */

#include "analysis.h"

#define CO_LOCATION_WINDOW_SEC 1800 // 30 minutes

ct_status_t ct_detect_relationships(evidence_graph_t *graph, const evidence_record_t *evidence_list) {
    if (!graph || !evidence_list) return CT_ERR_INVALID_INPUT;

    // Traverse all pairs of evidence to detect potential algorithmic associations
    const evidence_record_t *e1 = evidence_list;
    while (e1) {
        int v1 = graph_find_vertex_by_db_id(graph, e1->evidence_id, "EVIDENCE");
        if (v1 != -1) {
            const evidence_record_t *e2 = e1->next;
            while (e2) {
                int v2 = graph_find_vertex_by_db_id(graph, e2->evidence_id, "EVIDENCE");
                if (v2 != -1) {
                    // Check Co-location within time threshold
                    if (e1->timestamp > 0 && e2->timestamp > 0 &&
                        e1->collection_location[0] != '\0' && e2->collection_location[0] != '\0' &&
                        strcmp(e1->collection_location, e2->collection_location) == 0) {

                        int64_t diff = labs((long)(e1->timestamp - e2->timestamp));
                        if (diff <= CO_LOCATION_WINDOW_SEC) {
                            // Algorithmic suggested link
                            graph_add_edge(graph, v1, v2, "CO_LOCATED_IN_WINDOW", 0.70f,
                                           STATUS_UNVERIFIED_OBSERVATION,
                                           EDGE_ALGORITHMIC_SUGGESTED,
                                           "Co-location within 30-minute interval at scene");
                        }
                    }

                    // Check Shared Associated Entities
                    entity_ref_t *ref1 = e1->associated_entities;
                    while (ref1) {
                        entity_ref_t *ref2 = e2->associated_entities;
                        while (ref2) {
                            if (ref1->entity_id == ref2->entity_id &&
                                strcmp(ref1->entity_type, ref2->entity_type) == 0) {
                                char rel_desc[128];
                                snprintf(rel_desc, sizeof(rel_desc), "Shared association to %s ID %d", ref1->entity_type, ref1->entity_id);
                                graph_add_edge(graph, v1, v2, "SHARED_ENTITY_LINK", 0.80f,
                                               STATUS_HYPOTHESIS,
                                               EDGE_ALGORITHMIC_SUGGESTED,
                                               rel_desc);
                            }
                            ref2 = ref2->next;
                        }
                        ref1 = ref1->next;
                    }
                }
                e2 = e2->next;
            }
        }
        e1 = e1->next;
    }

    return CT_SUCCESS;
}

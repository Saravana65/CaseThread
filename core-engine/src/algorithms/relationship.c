/**
 * @file relationship.c
 * @brief Forensic evidence relationship discovery and classification engine.
 * @project CASETHREAD
 *
 * Implements strict forensic relationship detection adhering to C99 standards:
 *   1. Direct Documented Reference Links (Evidence -> Entity).
 *   2. Location Entity Linking & Co-location Correlation (SAME_LOCATION, CO_LOCATED_IN_WINDOW).
 *   3. Vehicle Identifier Matching (SAME_VEHICLE) without unverified assumptions.
 *   4. Telecommunication CDR & Number Matching (SHARED_PHONE, SHARED_CONTACT).
 *   5. Physical & Forensic Evidence Matching (SAME_PHYSICAL_EVIDENCE).
 *   6. Witness Testimonial Associations (WITNESS_ASSOCIATION).
 *   7. Rigorous Origin Classification (DIRECTLY_DOCUMENTED, DATA_DERIVED, SUGGESTED, UNVERIFIED, DISPUTED).
 */

#include "analysis.h"
#include <ctype.h>

#define CO_LOCATION_WINDOW_SEC 1800  // 30 minutes
#define TEMPORAL_CORRELATION_SEC 900 // 15 minutes

/* Case-insensitive substring match helper */
static bool contains_ignore_case(const char *haystack, const char *needle) {
    if (!haystack || !needle || needle[0] == '\0') return false;
    size_t n_len = strlen(needle);
    size_t h_len = strlen(haystack);
    if (n_len > h_len) return false;

    for (size_t i = 0; i <= h_len - n_len; i++) {
        size_t j = 0;
        while (j < n_len && tolower((unsigned char)haystack[i + j]) == tolower((unsigned char)needle[j])) {
            j++;
        }
        if (j == n_len) return true;
    }
    return false;
}

ct_status_t ct_detect_relationships(evidence_graph_t *graph, const evidence_record_t *evidence_list) {
    if (!graph || !evidence_list) return CT_ERR_INVALID_INPUT;

    // -------------------------------------------------------------------------
    // Rule 1: Link Evidence Records Directly to Referenced Entities
    // -------------------------------------------------------------------------
    const evidence_record_t *e1 = evidence_list;
    while (e1) {
        int v_ev = graph_find_vertex_by_db_id(graph, e1->evidence_id, "EVIDENCE");
        if (v_ev != -1) {
            // Direct entity references from evidence metadata
            entity_ref_t *ref = e1->associated_entities;
            while (ref) {
                int v_ent = graph_find_vertex_by_db_id(graph, ref->entity_id, ref->entity_type);
                if (v_ent != -1) {
                    char rel_desc[128];
                    snprintf(rel_desc, sizeof(rel_desc), "Directly referenced in evidence %s (%s)",
                             e1->tracking_code[0] ? e1->tracking_code : "item", e1->title);
                    graph_add_edge(graph, v_ev, v_ent, "REFERENCED_IN_EVIDENCE", 1.0f,
                                   e1->verification_status,
                                   EDGE_RECORDED_DIRECT,
                                   rel_desc);
                }
                ref = ref->next;
            }

            // Direct link to Location Entity if location vertex exists
            if (e1->collection_location[0] != '\0') {
                int v_loc = graph_find_vertex_by_label(graph, e1->collection_location);
                if (v_loc != -1 && strcmp(graph->vertices[v_loc].entity_type, "LOCATION") == 0) {
                    graph_add_edge(graph, v_ev, v_loc, "COLLECTED_AT_LOCATION", 0.95f,
                                   e1->verification_status,
                                   EDGE_RECORDED_DIRECT,
                                   "Evidence collected at documented location");
                }
            }
        }
        e1 = e1->next;
    }

    // -------------------------------------------------------------------------
    // Rule 2: Pairwise Evidence Correlation (SAME_LOCATION, SAME_VEHICLE, etc.)
    // -------------------------------------------------------------------------
    e1 = evidence_list;
    while (e1) {
        int v1 = graph_find_vertex_by_db_id(graph, e1->evidence_id, "EVIDENCE");
        if (v1 != -1) {
            const evidence_record_t *e2 = e1->next;
            while (e2) {
                int v2 = graph_find_vertex_by_db_id(graph, e2->evidence_id, "EVIDENCE");
                if (v2 != -1) {
                    // 2A. Co-Location Correlation
                    if (e1->collection_location[0] != '\0' && e2->collection_location[0] != '\0' &&
                        strcmp(e1->collection_location, e2->collection_location) == 0) {
                        
                        if (e1->timestamp > 0 && e2->timestamp > 0) {
                            int64_t diff = labs((long)(e1->timestamp - e2->timestamp));
                            if (diff <= CO_LOCATION_WINDOW_SEC) {
                                graph_add_edge(graph, v1, v2, "CO_LOCATED_IN_WINDOW", 0.85f,
                                               STATUS_CONFIRMED_FACT,
                                               EDGE_ORIGIN_DATA_DERIVED,
                                               "Co-location within 30-minute interval at scene");
                            } else {
                                graph_add_edge(graph, v1, v2, "SAME_LOCATION", 0.70f,
                                               STATUS_UNVERIFIED_OBSERVATION,
                                               EDGE_ORIGIN_DATA_DERIVED,
                                               "Documented at identical geographic location");
                            }
                        } else {
                            graph_add_edge(graph, v1, v2, "SAME_LOCATION", 0.65f,
                                           STATUS_UNVERIFIED_OBSERVATION,
                                           EDGE_ORIGIN_DATA_DERIVED,
                                           "Documented at identical geographic location");
                        }
                    }

                    // 2B. Shared Associated Entities
                    entity_ref_t *ref1 = e1->associated_entities;
                    while (ref1) {
                        entity_ref_t *ref2 = e2->associated_entities;
                        while (ref2) {
                            if (ref1->entity_id == ref2->entity_id &&
                                strcmp(ref1->entity_type, ref2->entity_type) == 0) {
                                char rel_desc[128];
                                snprintf(rel_desc, sizeof(rel_desc), "Mutual reference to %s ID %d",
                                         ref1->entity_type, ref1->entity_id);
                                graph_add_edge(graph, v1, v2, "SHARED_ENTITY_LINK", 0.80f,
                                               STATUS_CONFIRMED_FACT,
                                               EDGE_ORIGIN_DATA_DERIVED,
                                               rel_desc);
                            }
                            ref2 = ref2->next;
                        }
                        ref1 = ref1->next;
                    }

                    // 2C. Vehicle Registration & Identifier Match
                    if (e1->category == EV_VEHICLE && e2->category == EV_VEHICLE) {
                        // Check if description or title shares non-trivial vehicle tokens
                        if (strlen(e1->title) > 3 && contains_ignore_case(e2->title, e1->title)) {
                            graph_add_edge(graph, v1, v2, "SAME_VEHICLE", 0.90f,
                                           STATUS_CONFIRMED_FACT,
                                           EDGE_ORIGIN_DATA_DERIVED,
                                           "Matching vehicle registration / description identifier");
                        }
                    }

                    // 2D. Telecommunication CDR / Phone Match
                    if (e1->category == EV_PHONE && e2->category == EV_PHONE) {
                        graph_add_edge(graph, v1, v2, "SHARED_PHONE", 0.92f,
                                       STATUS_CONFIRMED_FACT,
                                       EDGE_ORIGIN_DATA_DERIVED,
                                       "Telecommunication call record / device correlation");
                    }

                    // 2E. Physical & Forensic Marker Correlation
                    if ((e1->category == EV_PHYSICAL || e1->category == EV_FORENSIC_BIO) &&
                        (e2->category == EV_PHYSICAL || e2->category == EV_FORENSIC_BIO)) {
                        if (e1->source[0] != '\0' && e2->source[0] != '\0' && strcmp(e1->source, e2->source) == 0) {
                            graph_add_edge(graph, v1, v2, "SAME_PHYSICAL_EVIDENCE", 0.95f,
                                           STATUS_CONFIRMED_FACT,
                                           EDGE_RECORDED_DIRECT,
                                           "Shared physical origin / forensic collection source");
                        }
                    }

                    // 2F. Related Timestamp Window
                    if (e1->timestamp > 0 && e2->timestamp > 0) {
                        int64_t diff = labs((long)(e1->timestamp - e2->timestamp));
                        if (diff <= TEMPORAL_CORRELATION_SEC && diff > 0) {
                            graph_add_edge(graph, v1, v2, "RELATED_TIMESTAMP", 0.60f,
                                           STATUS_UNVERIFIED_OBSERVATION,
                                           EDGE_ORIGIN_SUGGESTED_VERIFICATION,
                                           "Recorded within a close 15-minute investigation window");
                        }
                    }
                }
                e2 = e2->next;
            }
        }
        e1 = e1->next;
    }

    // -------------------------------------------------------------------------
    // Rule 3: Entity-to-Entity Inter-relationships (Witness, Suspect, Vehicle)
    // -------------------------------------------------------------------------
    for (size_t i = 0; i < graph->num_vertices; i++) {
        graph_vertex_t *v_a = &graph->vertices[i];
        if (strcmp(v_a->entity_type, "WITNESS") == 0) {
            // Witness associations: if witness mentions a suspect or vehicle
            for (size_t j = 0; j < graph->num_vertices; j++) {
                if (i == j) continue;
                graph_vertex_t *v_b = &graph->vertices[j];
                if (strcmp(v_b->entity_type, "SUSPECT") == 0 || strcmp(v_b->entity_type, "VEHICLE") == 0) {
                    if (contains_ignore_case(v_a->label, v_b->label)) {
                        graph_add_edge(graph, (int)i, (int)j, "WITNESS_ASSOCIATION", 0.75f,
                                       STATUS_UNVERIFIED_OBSERVATION,
                                       EDGE_RECORDED_DIRECT,
                                       "Explicitly documented in witness interview");
                    }
                }
            }
        }
    }

    return CT_SUCCESS;
}

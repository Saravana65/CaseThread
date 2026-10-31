/**
 * @file timeline_analysis.c
 * @brief Chronological timeline sequencing and spatiotemporal anomaly detection.
 * @project CASETHREAD
 *
 * Implements:
 *   1. Chronological event sorting via AVL/BST inorder traversal
 *   2. Detection of impossible velocity / spatiotemporal travel violations
 *   3. Overlapping unverified statements
 */

#include "analysis.h"

#define MAX_TIMELINE_BUFFER 1024
#define IMPOSSIBLE_TRANSIT_SPEED_KMH 120.0f

typedef struct {
    tree_payload_t *events[MAX_TIMELINE_BUFFER];
    size_t count;
} timeline_collector_t;

static void collect_tree_events(const avl_node_t *node, void *user_data) {
    timeline_collector_t *collector = (timeline_collector_t *)user_data;
    if (!node || !collector) return;

    tree_payload_t *p = node->payload;
    while (p && collector->count < MAX_TIMELINE_BUFFER) {
        collector->events[collector->count++] = p;
        p = p->next;
    }
}

ct_status_t ct_analyze_timeline(const avl_tree_t *timeline_tree, const evidence_record_t *evidence_list,
                                analysis_result_t *out_result) {
    if (!out_result) return CT_ERR_INVALID_INPUT;
    (void)evidence_list;

    if (!timeline_tree || timeline_tree->total_events == 0) {
        return CT_SUCCESS;
    }

    timeline_collector_t collector;
    collector.count = 0;

    // Collect all chronological events in sorted order via AVL inorder traversal
    avl_inorder(timeline_tree, collect_tree_events, &collector);

    int anomaly_counter = 1;

    // Inspect consecutive chronological events associated with identical entities
    for (size_t i = 0; i < collector.count; i++) {
        tree_payload_t *e1 = collector.events[i];

        for (size_t j = i + 1; j < collector.count; j++) {
            tree_payload_t *e2 = collector.events[j];

            // If same entity reported at two different locations
            if (e1->entity_id == e2->entity_id &&
                strcmp(e1->entity_type, e2->entity_type) == 0 &&
                e1->location[0] != '\0' && e2->location[0] != '\0' &&
                strcmp(e1->location, e2->location) != 0) {

                int64_t time_diff_sec = e2->timestamp - e1->timestamp;
                if (time_diff_sec < 0) time_diff_sec = -time_diff_sec;

                // If sightings occur within 3 minutes at distinct locations (> 5 km apart assumed)
                if (time_diff_sec < 180) { // Under 3 minutes
                    char explanation[256];
                    snprintf(explanation, sizeof(explanation),
                             "Entity '%s' (ID %d) logged at '%s' at %lld and '%s' at %lld (%lld sec difference). Physically improbable transit interval.",
                             e1->label, e1->entity_id, e1->location, (long long)e1->timestamp,
                             e2->location, (long long)e2->timestamp, (long long)time_diff_sec);

                    analysis_add_anomaly(out_result, e1->entity_id, e1->label,
                                         e1->timestamp, e2->timestamp,
                                         e1->location, e2->location,
                                         "IMPOSSIBLE_TRAVEL_SPEED",
                                         explanation,
                                         "Subpoena intermediate traffic cameras and verify witness statement credibility.");
                }
            }

            // Check overlapping unverified observations
            if (e1->timestamp == e2->timestamp &&
                e1->entity_id == e2->entity_id &&
                (!e1->is_verified || !e2->is_verified) &&
                strcmp(e1->location, e2->location) != 0) {

                char explanation[256];
                snprintf(explanation, sizeof(explanation),
                         "Simultaneous conflicting sightings at %lld: '%s' vs '%s'. Requires verification of witness credibility.",
                         (long long)e1->timestamp, e1->location, e2->location);

                analysis_add_anomaly(out_result, e1->entity_id, e1->label,
                                     e1->timestamp, e2->timestamp,
                                     e1->location, e2->location,
                                     "OVERLAPPING_EVENT_UNVERIFIED",
                                     explanation,
                                     "Re-interview both sources and evaluate potential mistaken identity or false alibi.");
            }
        }
    }

    return CT_SUCCESS;
}

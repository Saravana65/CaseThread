/**
 * @file algorithms.h
 * @brief Core algorithmic reasoning engine for evidence gap detection, timeline anomalies, and lead generation.
 * @project CASETHREAD
 */

#ifndef CASETHREAD_ALGORITHMS_H
#define CASETHREAD_ALGORITHMS_H

#include "common.h"
#include "hashmap.h"
#include "tree.h"
#include "graph.h"

/* Structure representing an identified investigative gap */
typedef struct evidence_gap {
    char gap_id[MAX_CODE_LEN];
    ct_gap_severity_t severity;
    char title[MAX_LABEL_LEN];
    char description[MAX_DESC_LEN];
    char missing_link_type[MAX_LABEL_LEN];
    char recommended_action[MAX_DESC_LEN];
    struct evidence_gap *next;
} evidence_gap_t;

/* Structure representing a timeline contradiction/anomaly */
typedef struct timeline_anomaly {
    int anomaly_id;
    int entity_id;
    int64_t time_1;
    int64_t time_2;
    char location_1[MAX_LABEL_LEN];
    char location_2[MAX_LABEL_LEN];
    char anomaly_type[MAX_LABEL_LEN]; /* e.g. IMPOSSIBLE_TRAVEL_SPEED, ALIBI_CONTRADICTION */
    char explanation[MAX_DESC_LEN];
    struct timeline_anomaly *next;
} timeline_anomaly_t;

/* Structure representing a prioritized investigative lead (for Max-Heap) */
typedef struct investigative_lead {
    char lead_id[MAX_CODE_LEN];
    float priority_score;             /* 0.00 to 100.00 score computed via heuristic */
    char hypothesis[MAX_DESC_LEN];
    char recommended_step[MAX_DESC_LEN];
    int primary_target_entity_id;
} investigative_lead_t;

/* Algorithm Module Declarations */
ct_status_t ct_detect_evidence_gaps(const evidence_graph_t *graph, const avl_tree_t *timeline, evidence_gap_t **gaps_head);
ct_status_t ct_analyze_timeline_anomalies(const avl_tree_t *timeline, timeline_anomaly_t **anomalies_head);
ct_status_t ct_generate_investigative_leads(const evidence_graph_t *graph, const evidence_gap_t *gaps, 
                                            investigative_lead_t *leads_out, size_t max_leads, size_t *leads_count);

void ct_free_gaps(evidence_gap_t *head);
void ct_free_anomalies(timeline_anomaly_t *head);

#endif /* CASETHREAD_ALGORITHMS_H */

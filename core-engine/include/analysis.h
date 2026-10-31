/**
 * @file analysis.h
 * @brief Algorithmic reasoning interfaces: Gap Detection, Timeline Analysis, and Lead Generation.
 * @project CASETHREAD
 */

#ifndef CASETHREAD_ANALYSIS_H
#define CASETHREAD_ANALYSIS_H

#include "common.h"
#include "evidence.h"
#include "hashmap.h"
#include "tree.h"
#include "graph.h"
#include "max_heap.h"

#define MAX_REASON_LEN 512
#define MAX_ACTION_LEN 512

/* Evidence Gap Record */
typedef struct evidence_gap_item {
    char gap_id[MAX_CODE_LEN];
    char gap_category[64];         /* "MISSING_TIMESTAMP", "UNVERIFIED_OBSERVATION", "MISSING_SOURCE", "DISCONNECTED_CLUSTER", etc. */
    char title[MAX_TITLE_LEN];
    char reason[MAX_REASON_LEN];
    char suggested_action[MAX_ACTION_LEN];
    ct_gap_severity_t priority;    /* CRITICAL, HIGH, MEDIUM, LOW */
    char status[32];               /* "PENDING_INVESTIGATION", "VERIFIED", "DISMISSED" */
    int related_evidence_ids[16];
    size_t num_related_evidence;
    struct evidence_gap_item *next;
} evidence_gap_item_t;

/* Timeline Anomaly Record */
typedef struct timeline_anomaly_item {
    int anomaly_id;
    int entity_id;
    char entity_label[MAX_TITLE_LEN];
    int64_t timestamp_1;
    int64_t timestamp_2;
    char location_1[MAX_LOC_LEN];
    char location_2[MAX_LOC_LEN];
    char anomaly_type[64];         /* "IMPOSSIBLE_TRAVEL_SPEED", "OVERLAPPING_EVENT_UNVERIFIED", "MISSING_TIMESTAMP" */
    char explanation[MAX_REASON_LEN];
    char suggested_check[MAX_ACTION_LEN];
    struct timeline_anomaly_item *next;
} timeline_anomaly_item_t;

/* Heuristic Investigative Lead */
typedef struct investigative_lead_item {
    char lead_id[MAX_CODE_LEN];
    char title[MAX_TITLE_LEN];
    char explanation[MAX_DESC_LEN];
    char supporting_relationships[MAX_DESC_LEN];
    char missing_information[MAX_DESC_LEN];
    char suggested_step[MAX_ACTION_LEN];
    float evidence_strength_score;  /* Documented formula: (0.4 * conf) + (0.3 * centrality) + (0.3 * gap_weight) */
    char strength_description[32];  /* "STRONG_CORROBORATION", "MODERATE_LEAD", "PRELIMINARY_HYPOTHESIS" */
    int related_evidence_ids[16];
    size_t num_related_evidence;
    struct investigative_lead_item *next;
} investigative_lead_item_t;

/* Master Analysis Result Container */
typedef struct {
    evidence_gap_item_t *gaps_head;
    size_t total_gaps;
    timeline_anomaly_item_t *anomalies_head;
    size_t total_anomalies;
    investigative_lead_item_t *leads_head;
    size_t total_leads;
    max_heap_t *leads_heap;         /* Binary Max-Heap priority queue for ranking leads */
    size_t nodes_processed;
    size_t edges_evaluated;
    int execution_latency_ms;
} analysis_result_t;

/* Public Algorithm API */
analysis_result_t* analysis_result_create(void);
void analysis_result_free(analysis_result_t *res);

/* 1. Relationship Detection */
ct_status_t ct_detect_relationships(evidence_graph_t *graph, const evidence_record_t *evidence_list);

/* 2. Gap Detection */
ct_status_t ct_detect_evidence_gaps(const evidence_graph_t *graph, const avl_tree_t *timeline_tree,
                                    const evidence_record_t *evidence_list, analysis_result_t *out_result);

/* 3. Timeline Analysis */
ct_status_t ct_analyze_timeline(const avl_tree_t *timeline_tree, const evidence_record_t *evidence_list,
                                analysis_result_t *out_result);

/* 4. Investigative Lead Generation */
ct_status_t ct_generate_leads(const evidence_graph_t *graph, const analysis_result_t *intermediate,
                              analysis_result_t *out_result);

/* Helpers to append report items */
void analysis_add_gap(analysis_result_t *res, const char *gap_id, const char *category, const char *title,
                      const char *reason, const char *action, ct_gap_severity_t priority,
                      const int *evidence_ids, size_t num_ids);

void analysis_add_anomaly(analysis_result_t *res, int entity_id, const char *label,
                          int64_t t1, int64_t t2, const char *loc1, const char *loc2,
                          const char *type, const char *explanation, const char *action);

void analysis_add_lead(analysis_result_t *res, const char *lead_id, const char *title,
                       const char *explanation, const char *supporting_rel, const char *missing_info,
                       const char *suggested_step, float score, const char *strength_desc,
                       const int *evidence_ids, size_t num_ids);

void analysis_finalize_leads(analysis_result_t *res);

#endif /* CASETHREAD_ANALYSIS_H */

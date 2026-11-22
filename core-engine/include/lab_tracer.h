/**
 * @file lab_tracer.h
 * @brief Native C Algorithm Tracer for CaseThread Investigation Lab.
 * @project CASETHREAD - Phase 7 Investigation Lab
 */

#ifndef CASETHREAD_LAB_TRACER_H
#define CASETHREAD_LAB_TRACER_H

#include "common.h"
#include "graph.h"
#include "hashmap.h"
#include "tree.h"
#include "max_heap.h"
#include "trie.h"
#include "evidence.h"
#include <stdio.h>

typedef struct {
    char algorithm[32];         /* "BFS", "DFS", "SHORTEST_PATH", "CONNECTED_COMPONENTS", "HASH_MAP", "AVL_TREE", "MAX_HEAP", "TRIE" */
    char mode[16];              /* "REAL" or "DEMO" */
    int start_node_id;
    int target_node_id;
    char search_term[128];
    char operation[32];         /* "INSERT", "SEARCH", "EXTRACT_MAX", "AUTOCOMPLETE", "RANGE" */
    int num_items;
    char item_keys[32][64];
    float item_priorities[32];
    int64_t item_timestamps[32];
} lab_request_t;

/* Executes requested algorithm with native C step-by-step instrumentation and writes JSON to output stream */
void run_algorithm_lab_query(FILE *out, const evidence_graph_t *graph, const lab_request_t *req);

#endif /* CASETHREAD_LAB_TRACER_H */

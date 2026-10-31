/**
 * @file json_parser.h
 * @brief Zero-dependency JSON tokenizer and deserializer for CASETHREAD IPC payloads.
 * @project CASETHREAD
 */

#ifndef CASETHREAD_JSON_PARSER_H
#define CASETHREAD_JSON_PARSER_H

#include "common.h"
#include "evidence.h"
#include "hashmap.h"
#include "tree.h"
#include "graph.h"
#include "analysis.h"

typedef struct {
    int case_id;
    evidence_record_t *evidence_list;
    hash_map_t *entity_map;
    evidence_graph_t *graph;
    avl_tree_t *timeline_avl;
    bst_t *timeline_bst;
} case_ingestion_context_t;

case_ingestion_context_t* context_create(void);
void context_destroy(case_ingestion_context_t *ctx);

ct_status_t parse_and_ingest_json(case_ingestion_context_t *ctx, const char *json_str);
void emit_analysis_json(FILE *out, const analysis_result_t *res, const evidence_graph_t *graph, int case_id);

#endif /* CASETHREAD_JSON_PARSER_H */

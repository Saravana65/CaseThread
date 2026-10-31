/**
 * @file main.c
 * @brief Main CLI and IPC Entrypoint for CASETHREAD Core DSA Investigation Engine.
 * @project CASETHREAD - Evidence Gap Detection & Investigation Intelligence System
 *
 * Implements the standard I/O IPC contract:
 *   - Ingests structured investigation JSON payload via stdin
 *   - Parses and indexes data into Hash Maps, BST/AVL Trees, and Adjacency-List Graphs
 *   - Executes Graph BFS/DFS, Gap Detection, Timeline Analysis, and Lead Generation
 *   - Streams structured results as JSON to stdout
 *   - Directs telemetry and diagnostic logs exclusively to stderr
 */

#include "common.h"
#include "evidence.h"
#include "hashmap.h"
#include "tree.h"
#include "graph.h"
#include "analysis.h"
#include "json_parser.h"

static void print_usage(const char *prog) {
    fprintf(stderr, "CASETHREAD Core Algorithm Engine (v%s)\n", ENGINE_VERSION);
    fprintf(stderr, "Usage: %s [OPTIONS]\n", prog);
    fprintf(stderr, "Options:\n");
    fprintf(stderr, "  --stdin         Read case JSON payload from standard input (default)\n");
    fprintf(stderr, "  --version       Display engine build version and DSA capabilities\n");
    fprintf(stderr, "  --help          Display this help message\n");
}

static void print_version(void) {
    printf("{\n");
    printf("  \"engine\": \"CASETHREAD-DSA-Core\",\n");
    printf("  \"version\": \"%s\",\n", ENGINE_VERSION);
    printf("  \"dsa_modules\": [\n");
    printf("    \"Separate-Chaining-HashMap-DJB2\",\n");
    printf("    \"Binary-Search-Tree-BST\",\n");
    printf("    \"Self-Balancing-AVL-Tree\",\n");
    printf("    \"Adjacency-List-Graph-BFS-DFS\",\n");
    printf("    \"FIFO-Queue\",\n");
    printf("    \"LIFO-Stack\",\n");
    printf("    \"Dynamic-Linked-List\",\n");
    printf("    \"Rule-Based-Evidence-Gap-Detector\",\n");
    printf("    \"Spatiotemporal-Timeline-Analyzer\",\n");
    printf("    \"Centrality-Weighted-Lead-Generator\"\n");
    printf("  ],\n");
    printf("  \"status\": \"READY\"\n");
    printf("}\n");
}

int main(int argc, char *argv[]) {
    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "--version") == 0) {
            print_version();
            return CT_SUCCESS;
        } else if (strcmp(argv[i], "--help") == 0) {
            print_usage(argv[0]);
            return CT_SUCCESS;
        }
    }

    CT_LOG_INFO("CASETHREAD Core DSA Engine (v%s) active.", ENGINE_VERSION);

    // Read full JSON stream from stdin
    size_t capacity = 1024 * 1024; // 1 MB initial buffer
    char *input_buffer = (char *)malloc(capacity);
    if (!input_buffer) {
        CT_LOG_ERROR("Failed to allocate initial stdin buffer.");
        return CT_ERR_OUT_OF_MEMORY;
    }

    size_t total_bytes = 0;
    size_t bytes = 0;
    char chunk[4096];

    while ((bytes = fread(chunk, 1, sizeof(chunk), stdin)) > 0) {
        if (total_bytes + bytes + 1 >= capacity) {
            capacity *= 2;
            char *expanded = (char *)realloc(input_buffer, capacity);
            if (!expanded) {
                CT_LOG_ERROR("Buffer exceeded reallocation boundary.");
                free(input_buffer);
                return CT_ERR_OUT_OF_MEMORY;
            }
            input_buffer = expanded;
        }
        memcpy(input_buffer + total_bytes, chunk, bytes);
        total_bytes += bytes;
    }
    input_buffer[total_bytes] = '\0';

    CT_LOG_INFO("Payload received: %zu bytes. Initializing DSA context...", total_bytes);

    case_ingestion_context_t *ctx = context_create();
    if (!ctx) {
        CT_LOG_ERROR("Failed to initialize ingestion context.");
        free(input_buffer);
        return CT_ERR_OUT_OF_MEMORY;
    }

    // Ingest data into DSA structures
    if (total_bytes > 0) {
        parse_and_ingest_json(ctx, input_buffer);
    }
    free(input_buffer);

    CT_LOG_INFO("Context populated: %zu graph vertices, %zu evidence items.",
                ctx->graph->num_vertices, ctx->evidence_list ? (size_t)1 : (size_t)0);

    analysis_result_t *result = analysis_result_create();
    if (!result) {
        CT_LOG_ERROR("Failed to allocate analysis result container.");
        context_destroy(ctx);
        return CT_ERR_OUT_OF_MEMORY;
    }

    // Pipeline Execution:
    // 1. Detect Co-location & Shared Entity Relationships (Graph Edges)
    ct_detect_relationships(ctx->graph, ctx->evidence_list);

    // 2. Detect Evidence Gaps (Field missingness & isolated graph nodes)
    ct_detect_evidence_gaps(ctx->graph, ctx->timeline_avl, ctx->evidence_list, result);

    // 3. Spatiotemporal Timeline Anomaly Detection (AVL/BST traversal)
    ct_analyze_timeline(ctx->timeline_avl, ctx->evidence_list, result);

    // 4. Synthesize Prioritized Investigative Leads
    ct_generate_leads(ctx->graph, result, result);

    CT_LOG_INFO("Analysis pipeline complete: %zu gaps, %zu anomalies, %zu leads.",
                result->total_gaps, result->total_anomalies, result->total_leads);

    // Emit structured JSON output to stdout
    emit_analysis_json(stdout, result, ctx);

    // Memory Cleanup
    analysis_result_free(result);
    context_destroy(ctx);

    CT_LOG_INFO("Engine run terminated cleanly.");
    return CT_SUCCESS;
}

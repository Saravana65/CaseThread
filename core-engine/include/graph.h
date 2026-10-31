/**
 * @file graph.h
 * @brief Adjacency list graph representation for Evidence and Entity Network Analysis.
 * @project CASETHREAD
 * 
 * TIME & SPACE COMPLEXITIES:
 *   - Vertex Insertion: O(1)
 *   - Edge Insertion: O(1)
 *   - Edge Deletion: O(deg(V))
 *   - BFS Traversal: O(V + E)
 *   - DFS Traversal: O(V + E)
 *   - Connected Components: O(V + E)
 *   - Shortest Path (BFS): O(V + E)
 *   - Space Complexity: O(V + E)
 */

#ifndef CASETHREAD_GRAPH_H
#define CASETHREAD_GRAPH_H

#include "common.h"
#include "evidence.h"
#include "queue.h"
#include "stack.h"

/* Edge Relationship Nature */
typedef enum {
    EDGE_RECORDED_DIRECT = 1,      /* Explicitly documented in case files / police reports */
    EDGE_ALGORITHMIC_SUGGESTED    /* Detected by algorithmic correlation of shared attributes */
} edge_origin_t;

/* Graph Edge representing an investigative relationship */
typedef struct graph_edge {
    int target_vertex_id;
    char relation_type[64];         /* e.g. "SAME_LOCATION", "SAME_VEHICLE", "CALLED_NUMBER", "EXPLICIT_ASSOCIATION" */
    float confidence_weight;        /* 0.00 to 1.00 */
    verification_status_t status;   /* CONFIRMED_FACT, UNVERIFIED_OBSERVATION, HYPOTHESIS */
    edge_origin_t origin;           /* DIRECT vs SUGGESTED */
    char source_description[MAX_SOURCE_LEN]; /* Provenance of connection */
    bool is_directed;
    struct graph_edge *next;        /* Adjacency list pointer */
} graph_edge_t;

/* Graph Vertex representing an investigation entity or evidence record */
typedef struct graph_vertex {
    int vertex_id;                  /* Contiguous 0-indexed vertex identifier */
    int original_db_id;             /* ID from relational database table */
    char label[MAX_TITLE_LEN];      /* Display label: e.g. "Marcus Vance (Suspect)" */
    char entity_type[32];           /* "SUSPECT", "VICTIM", "WITNESS", "EVIDENCE", "VEHICLE", "LOCATION" */
    verification_status_t status;
    void *entity_data;              /* Pointer to evidence_record_t or custom payload */
    graph_edge_t *edges_head;       /* Head of outgoing edges linked list */
    int degree;                     /* Total incident connections */
} graph_vertex_t;

/* Graph Structure */
typedef struct {
    graph_vertex_t *vertices;       /* Dynamic array of vertices */
    size_t num_vertices;
    size_t capacity;
    bool is_directed;
} evidence_graph_t;

/* Traversal Visitor Callback */
typedef void (*vertex_visitor_fn)(const graph_vertex_t *vertex, void *user_data);

/* Core Graph Construction API */
evidence_graph_t* graph_create(size_t initial_capacity, bool is_directed);
int graph_add_vertex(evidence_graph_t *g, int original_db_id, const char *label, const char *entity_type, verification_status_t status, void *entity_data);
ct_status_t graph_add_edge(evidence_graph_t *g, int src_id, int dest_id, const char *relation_type,
                           float weight, verification_status_t status, edge_origin_t origin, const char *source_desc);
ct_status_t graph_remove_edge(evidence_graph_t *g, int src_id, int dest_id);
const graph_vertex_t* graph_get_vertex(const evidence_graph_t *g, int vertex_id);
int graph_find_vertex_by_label(const evidence_graph_t *g, const char *label);
int graph_find_vertex_by_db_id(const evidence_graph_t *g, int db_id, const char *entity_type);
void graph_destroy(evidence_graph_t *g);

/* Traversals & Algorithmic Inspections */
ct_status_t graph_bfs(const evidence_graph_t *g, int start_vertex_id, vertex_visitor_fn visitor, void *user_data);
ct_status_t graph_dfs(const evidence_graph_t *g, int start_vertex_id, vertex_visitor_fn visitor, void *user_data);
ct_status_t graph_shortest_path(const evidence_graph_t *g, int start_vertex_id, int target_vertex_id,
                                int *path_out, int *path_len_out);
ct_status_t graph_connected_components(const evidence_graph_t *g, int *component_map, int *num_components);
bool graph_detect_cycle(const evidence_graph_t *g);

#endif /* CASETHREAD_GRAPH_H */

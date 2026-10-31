/**
 * @file bfs.c
 * @brief Breadth-First Search (BFS) graph traversal and unweighted shortest relationship path discovery.
 * @project CASETHREAD
 *
 * TIME COMPLEXITY:  O(V + E)
 * SPACE COMPLEXITY: O(V)
 */

#include "graph.h"

ct_status_t graph_bfs(const evidence_graph_t *g, int start_vertex_id, vertex_visitor_fn visitor, void *user_data) {
    if (!g || start_vertex_id < 0 || start_vertex_id >= (int)g->num_vertices) {
        return CT_ERR_INVALID_INPUT;
    }

    bool *visited = (bool *)calloc(g->num_vertices, sizeof(bool));
    if (!visited) return CT_ERR_OUT_OF_MEMORY;

    queue_t *q = queue_create();
    if (!q) {
        free(visited);
        return CT_ERR_OUT_OF_MEMORY;
    }

    visited[start_vertex_id] = true;
    queue_enqueue(q, (void *)(intptr_t)start_vertex_id);

    while (!queue_is_empty(q)) {
        int u = (int)(intptr_t)queue_dequeue(q);
        if (visitor) {
            visitor(&g->vertices[u], user_data);
        }

        graph_edge_t *edge = g->vertices[u].edges_head;
        while (edge) {
            int v = edge->target_vertex_id;
            if (!visited[v]) {
                visited[v] = true;
                queue_enqueue(q, (void *)(intptr_t)v);
            }
            edge = edge->next;
        }
    }

    queue_destroy(q, NULL);
    free(visited);
    return CT_SUCCESS;
}

ct_status_t graph_shortest_path(const evidence_graph_t *g, int start_vertex_id, int target_vertex_id,
                                int *path_out, int *path_len_out) {
    if (!g || !path_out || !path_len_out ||
        start_vertex_id < 0 || start_vertex_id >= (int)g->num_vertices ||
        target_vertex_id < 0 || target_vertex_id >= (int)g->num_vertices) {
        return CT_ERR_INVALID_INPUT;
    }

    *path_len_out = 0;
    if (start_vertex_id == target_vertex_id) {
        path_out[0] = start_vertex_id;
        *path_len_out = 1;
        return CT_SUCCESS;
    }

    bool *visited = (bool *)calloc(g->num_vertices, sizeof(bool));
    int *parent = (int *)malloc(g->num_vertices * sizeof(int));
    if (!visited || !parent) {
        free(visited);
        free(parent);
        return CT_ERR_OUT_OF_MEMORY;
    }

    for (size_t i = 0; i < g->num_vertices; i++) {
        parent[i] = -1;
    }

    queue_t *q = queue_create();
    if (!q) {
        free(visited);
        free(parent);
        return CT_ERR_OUT_OF_MEMORY;
    }

    visited[start_vertex_id] = true;
    queue_enqueue(q, (void *)(intptr_t)start_vertex_id);
    bool found = false;

    while (!queue_is_empty(q)) {
        int u = (int)(intptr_t)queue_dequeue(q);
        if (u == target_vertex_id) {
            found = true;
            break;
        }

        graph_edge_t *edge = g->vertices[u].edges_head;
        while (edge) {
            int v = edge->target_vertex_id;
            if (!visited[v]) {
                visited[v] = true;
                parent[v] = u;
                queue_enqueue(q, (void *)(intptr_t)v);
            }
            edge = edge->next;
        }
    }

    queue_destroy(q, NULL);
    free(visited);

    if (!found) {
        free(parent);
        return CT_ERR_NOT_FOUND;
    }

    // Reconstruct path backward from target to start
    int curr = target_vertex_id;
    int temp_path[1024];
    int len = 0;

    while (curr != -1 && len < 1024) {
        temp_path[len++] = curr;
        curr = parent[curr];
    }
    free(parent);

    // Reverse path so it flows from start to target
    for (int i = 0; i < len; i++) {
        path_out[i] = temp_path[len - 1 - i];
    }
    *path_len_out = len;

    return CT_SUCCESS;
}

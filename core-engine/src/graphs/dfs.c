/**
 * @file dfs.c
 * @brief Depth-First Search (DFS) graph traversal, connected components, and cycle contradiction detection.
 * @project CASETHREAD
 *
 * TIME COMPLEXITY:  O(V + E)
 * SPACE COMPLEXITY: O(V)
 */

#include "graph.h"

static void dfs_recursive(const evidence_graph_t *g, int u, bool *visited, vertex_visitor_fn visitor, void *user_data) {
    visited[u] = true;
    if (visitor) {
        visitor(&g->vertices[u], user_data);
    }

    graph_edge_t *edge = g->vertices[u].edges_head;
    while (edge) {
        int v = edge->target_vertex_id;
        if (!visited[v]) {
            dfs_recursive(g, v, visited, visitor, user_data);
        }
        edge = edge->next;
    }
}

ct_status_t graph_dfs(const evidence_graph_t *g, int start_vertex_id, vertex_visitor_fn visitor, void *user_data) {
    if (!g || start_vertex_id < 0 || start_vertex_id >= (int)g->num_vertices) {
        return CT_ERR_INVALID_INPUT;
    }

    bool *visited = (bool *)calloc(g->num_vertices, sizeof(bool));
    if (!visited) return CT_ERR_OUT_OF_MEMORY;

    dfs_recursive(g, start_vertex_id, visited, visitor, user_data);

    free(visited);
    return CT_SUCCESS;
}

static void component_dfs(const evidence_graph_t *g, int u, bool *visited, int *component_map, int comp_id) {
    visited[u] = true;
    component_map[u] = comp_id;

    graph_edge_t *edge = g->vertices[u].edges_head;
    while (edge) {
        int v = edge->target_vertex_id;
        if (!visited[v]) {
            component_dfs(g, v, visited, component_map, comp_id);
        }
        edge = edge->next;
    }
}

ct_status_t graph_connected_components(const evidence_graph_t *g, int *component_map, int *num_components) {
    if (!g || !component_map || !num_components) return CT_ERR_INVALID_INPUT;

    bool *visited = (bool *)calloc(g->num_vertices, sizeof(bool));
    if (!visited) return CT_ERR_OUT_OF_MEMORY;

    int comp_count = 0;
    for (size_t i = 0; i < g->num_vertices; i++) {
        if (!visited[i]) {
            comp_count++;
            component_dfs(g, (int)i, visited, component_map, comp_count);
        }
    }

    *num_components = comp_count;
    free(visited);
    return CT_SUCCESS;
}

/* Three-color cycle detection for directed/undirected graphs */
static bool detect_cycle_directed(const evidence_graph_t *g, int u, int *color) {
    color[u] = 1; // Gray: currently in recursion stack

    graph_edge_t *edge = g->vertices[u].edges_head;
    while (edge) {
        int v = edge->target_vertex_id;
        if (color[v] == 1) {
            return true; // Cycle detected
        }
        if (color[v] == 0 && detect_cycle_directed(g, v, color)) {
            return true;
        }
        edge = edge->next;
    }

    color[u] = 2; // Black: fully explored
    return false;
}

static bool detect_cycle_undirected(const evidence_graph_t *g, int u, int parent, bool *visited) {
    visited[u] = true;

    graph_edge_t *edge = g->vertices[u].edges_head;
    while (edge) {
        int v = edge->target_vertex_id;
        if (!visited[v]) {
            if (detect_cycle_undirected(g, v, u, visited)) {
                return true;
            }
        } else if (v != parent) {
            return true; // Cycle detected: back-edge to non-parent
        }
        edge = edge->next;
    }
    return false;
}

bool graph_detect_cycle(const evidence_graph_t *g) {
    if (!g || g->num_vertices == 0) return false;

    if (g->is_directed) {
        int *color = (int *)calloc(g->num_vertices, sizeof(int));
        if (!color) return false;

        for (size_t i = 0; i < g->num_vertices; i++) {
            if (color[i] == 0) {
                if (detect_cycle_directed(g, (int)i, color)) {
                    free(color);
                    return true;
                }
            }
        }
        free(color);
        return false;
    } else {
        bool *visited = (bool *)calloc(g->num_vertices, sizeof(bool));
        if (!visited) return false;

        for (size_t i = 0; i < g->num_vertices; i++) {
            if (!visited[i]) {
                if (detect_cycle_undirected(g, (int)i, -1, visited)) {
                    free(visited);
                    return true;
                }
            }
        }
        free(visited);
        return false;
    }
}

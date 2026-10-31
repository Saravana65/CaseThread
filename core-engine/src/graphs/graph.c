/**
 * @file graph.c
 * @brief Adjacency list graph implementation for Evidence & Entity Relational Intelligence.
 * @project CASETHREAD
 */

#include "graph.h"

#define DEFAULT_GRAPH_CAPACITY 64

evidence_graph_t* graph_create(size_t initial_capacity, bool is_directed) {
    size_t cap = initial_capacity ? initial_capacity : DEFAULT_GRAPH_CAPACITY;
    evidence_graph_t *g = (evidence_graph_t *)malloc(sizeof(evidence_graph_t));
    if (!g) return NULL;

    g->vertices = (graph_vertex_t *)calloc(cap, sizeof(graph_vertex_t));
    if (!g->vertices) {
        free(g);
        return NULL;
    }

    g->num_vertices = 0;
    g->capacity = cap;
    g->is_directed = is_directed;
    return g;
}

int graph_add_vertex(evidence_graph_t *g, int original_db_id, const char *label, const char *entity_type, verification_status_t status, void *entity_data) {
    if (!g || !label) return -1;

    // Expand vertex capacity if needed
    if (g->num_vertices >= g->capacity) {
        size_t new_cap = g->capacity * 2;
        graph_vertex_t *new_vertices = (graph_vertex_t *)realloc(g->vertices, new_cap * sizeof(graph_vertex_t));
        if (!new_vertices) return -1;
        // Zero out newly allocated slots
        memset(new_vertices + g->capacity, 0, (new_cap - g->capacity) * sizeof(graph_vertex_t));
        g->vertices = new_vertices;
        g->capacity = new_cap;
    }

    int id = (int)g->num_vertices++;
    graph_vertex_t *v = &g->vertices[id];
    v->vertex_id = id;
    v->original_db_id = original_db_id;
    strncpy(v->label, label, sizeof(v->label) - 1);
    v->label[sizeof(v->label) - 1] = '\0';
    if (entity_type) {
        strncpy(v->entity_type, entity_type, sizeof(v->entity_type) - 1);
        v->entity_type[sizeof(v->entity_type) - 1] = '\0';
    } else {
        strcpy(v->entity_type, "UNKNOWN");
    }
    v->status = status;
    v->entity_data = entity_data;
    v->edges_head = NULL;
    v->degree = 0;

    return id;
}

static ct_status_t add_single_directed_edge(evidence_graph_t *g, int src_id, int dest_id, const char *relation_type,
                                            float weight, verification_status_t status, edge_origin_t origin, const char *source_desc) {
    graph_vertex_t *src = &g->vertices[src_id];

    // Check if edge already exists
    graph_edge_t *curr = src->edges_head;
    while (curr) {
        if (curr->target_vertex_id == dest_id && strcmp(curr->relation_type, relation_type) == 0) {
            curr->confidence_weight = weight;
            curr->status = status;
            curr->origin = origin;
            return CT_SUCCESS;
        }
        curr = curr->next;
    }

    graph_edge_t *edge = (graph_edge_t *)malloc(sizeof(graph_edge_t));
    if (!edge) return CT_ERR_OUT_OF_MEMORY;

    edge->target_vertex_id = dest_id;
    strncpy(edge->relation_type, relation_type ? relation_type : "ASSOCIATED", sizeof(edge->relation_type) - 1);
    edge->relation_type[sizeof(edge->relation_type) - 1] = '\0';
    edge->confidence_weight = weight;
    edge->status = status;
    edge->origin = origin;
    if (source_desc) {
        strncpy(edge->source_description, source_desc, sizeof(edge->source_description) - 1);
        edge->source_description[sizeof(edge->source_description) - 1] = '\0';
    } else {
        edge->source_description[0] = '\0';
    }
    edge->is_directed = g->is_directed;
    edge->next = src->edges_head;
    src->edges_head = edge;
    src->degree++;

    return CT_SUCCESS;
}

ct_status_t graph_add_edge(evidence_graph_t *g, int src_id, int dest_id, const char *relation_type,
                           float weight, verification_status_t status, edge_origin_t origin, const char *source_desc) {
    if (!g || src_id < 0 || src_id >= (int)g->num_vertices || dest_id < 0 || dest_id >= (int)g->num_vertices) {
        return CT_ERR_INVALID_INPUT;
    }

    ct_status_t res = add_single_directed_edge(g, src_id, dest_id, relation_type, weight, status, origin, source_desc);
    if (res != CT_SUCCESS) return res;

    if (!g->is_directed) {
        res = add_single_directed_edge(g, dest_id, src_id, relation_type, weight, status, origin, source_desc);
    }
    return res;
}

ct_status_t graph_remove_edge(evidence_graph_t *g, int src_id, int dest_id) {
    if (!g || src_id < 0 || src_id >= (int)g->num_vertices || dest_id < 0 || dest_id >= (int)g->num_vertices) {
        return CT_ERR_INVALID_INPUT;
    }

    graph_vertex_t *src = &g->vertices[src_id];
    graph_edge_t *curr = src->edges_head;
    graph_edge_t *prev = NULL;

    while (curr) {
        if (curr->target_vertex_id == dest_id) {
            if (prev) {
                prev->next = curr->next;
            } else {
                src->edges_head = curr->next;
            }
            free(curr);
            src->degree--;
            break;
        }
        prev = curr;
        curr = curr->next;
    }

    if (!g->is_directed) {
        graph_vertex_t *dest = &g->vertices[dest_id];
        curr = dest->edges_head;
        prev = NULL;
        while (curr) {
            if (curr->target_vertex_id == src_id) {
                if (prev) {
                    prev->next = curr->next;
                } else {
                    dest->edges_head = curr->next;
                }
                free(curr);
                dest->degree--;
                break;
            }
            prev = curr;
            curr = curr->next;
        }
    }

    return CT_SUCCESS;
}

const graph_vertex_t* graph_get_vertex(const evidence_graph_t *g, int vertex_id) {
    if (!g || vertex_id < 0 || vertex_id >= (int)g->num_vertices) return NULL;
    return &g->vertices[vertex_id];
}

int graph_find_vertex_by_label(const evidence_graph_t *g, const char *label) {
    if (!g || !label) return -1;
    for (size_t i = 0; i < g->num_vertices; i++) {
        if (strcmp(g->vertices[i].label, label) == 0) {
            return (int)i;
        }
    }
    return -1;
}

int graph_find_vertex_by_db_id(const evidence_graph_t *g, int db_id, const char *entity_type) {
    if (!g) return -1;
    for (size_t i = 0; i < g->num_vertices; i++) {
        if (g->vertices[i].original_db_id == db_id) {
            if (!entity_type || strcmp(g->vertices[i].entity_type, entity_type) == 0) {
                return (int)i;
            }
        }
    }
    return -1;
}

void graph_destroy(evidence_graph_t *g) {
    if (!g) return;
    for (size_t i = 0; i < g->num_vertices; i++) {
        graph_edge_t *edge = g->vertices[i].edges_head;
        while (edge) {
            graph_edge_t *next = edge->next;
            free(edge);
            edge = next;
        }
    }
    free(g->vertices);
    free(g);
}

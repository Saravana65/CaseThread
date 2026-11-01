/**
 * @file json_parser.c
 * @brief Resilient JSON deserializer and structured serializer for CASETHREAD IPC pipeline.
 * @project CASETHREAD
 */

#include "json_parser.h"
#include <ctype.h>

case_ingestion_context_t* context_create(void) {
    case_ingestion_context_t *ctx = (case_ingestion_context_t *)calloc(1, sizeof(case_ingestion_context_t));
    if (!ctx) return NULL;
    ctx->entity_map = hashmap_create(64);
    ctx->graph = graph_create(64, false); // Undirected association network
    ctx->timeline_avl = avl_create();
    ctx->timeline_bst = bst_create();
    return ctx;
}

void context_destroy(case_ingestion_context_t *ctx) {
    if (!ctx) return;
    if (ctx->evidence_list) evidence_free(ctx->evidence_list);
    if (ctx->entity_map) hashmap_destroy(ctx->entity_map, NULL);
    if (ctx->graph) graph_destroy(ctx->graph);
    if (ctx->timeline_avl) avl_destroy(ctx->timeline_avl);
    if (ctx->timeline_bst) bst_destroy(ctx->timeline_bst);
    free(ctx);
}

/* Helpers to find simple key/value pairs in JSON substring */
static const char* find_key(const char *json, const char *key) {
    char pattern[128];
    snprintf(pattern, sizeof(pattern), "\"%s\"", key);
    const char *pos = strstr(json, pattern);
    if (!pos) return NULL;
    pos += strlen(pattern);
    while (*pos && (*pos == ' ' || *pos == ':' || *pos == '\t' || *pos == '\r' || *pos == '\n')) {
        pos++;
    }
    return pos;
}

static bool extract_string(const char *pos, char *dest, size_t dest_len) {
    if (!pos || *pos != '"') return false;
    pos++; // Skip opening quote
    size_t i = 0;
    while (*pos && *pos != '"' && i + 1 < dest_len) {
        if (*pos == '\\' && *(pos + 1)) pos++; // Skip escape
        dest[i++] = *pos++;
    }
    dest[i] = '\0';
    return true;
}

static int extract_int(const char *pos) {
    if (!pos) return 0;
    return atoi(pos);
}

static int64_t extract_int64(const char *pos) {
    if (!pos) return 0;
    return (int64_t)atoll(pos);
}

static float extract_float(const char *pos) {
    if (!pos) return 0.0f;
    return (float)atof(pos);
}

ct_status_t parse_and_ingest_json(case_ingestion_context_t *ctx, const char *json_str) {
    if (!ctx || !json_str) return CT_ERR_INVALID_INPUT;

    // Check Case ID
    const char *case_id_pos = find_key(json_str, "case_id");
    if (case_id_pos) {
        ctx->case_id = extract_int(case_id_pos);
    }

    // 1. Ingest Entities
    const char *entities_pos = strstr(json_str, "\"entities\"");
    if (entities_pos) {
        const char *curr = strchr(entities_pos, '[');
        if (curr) {
            curr++;
            while (*curr && *curr != ']') {
                const char *obj_start = strchr(curr, '{');
                if (!obj_start) break;
                const char *obj_end = strchr(obj_start, '}');
                if (!obj_end) break;

                int id = 0;
                char type[32] = "UNKNOWN";
                char label[MAX_TITLE_LEN] = "Entity";

                const char *id_p = find_key(obj_start, "id");
                if (id_p && id_p < obj_end) id = extract_int(id_p);

                const char *type_p = find_key(obj_start, "type");
                if (type_p && type_p < obj_end) extract_string(type_p, type, sizeof(type));

                const char *label_p = find_key(obj_start, "label");
                if (label_p && label_p < obj_end) extract_string(label_p, label, sizeof(label));

                int v_id = graph_add_vertex(ctx->graph, id, label, type, STATUS_CONFIRMED_FACT, NULL);

                // Index in Hash Map: "SUSPECT:1" -> vertex_id and generic "ID:1" -> vertex_id
                char map_key[64];
                snprintf(map_key, sizeof(map_key), "%s:%d", type, id);
                hashmap_put(ctx->entity_map, map_key, (void *)(intptr_t)(v_id + 1));

                char id_key[64];
                snprintf(id_key, sizeof(id_key), "ID:%d", id);
                hashmap_put(ctx->entity_map, id_key, (void *)(intptr_t)(v_id + 1));

                curr = obj_end + 1;
            }
        }
    }

    // 2. Ingest Evidence Items
    const char *ev_pos = strstr(json_str, "\"evidence\"");
    if (ev_pos) {
        const char *curr = strchr(ev_pos, '[');
        if (curr) {
            curr++;
            while (*curr && *curr != ']') {
                const char *obj_start = strchr(curr, '{');
                if (!obj_start) break;
                const char *obj_end = strchr(obj_start, '}');
                if (!obj_end) break;

                int id = 0;
                char code[MAX_CODE_LEN] = "";
                char title[MAX_TITLE_LEN] = "Evidence";
                char cat_str[32] = "PHYSICAL";
                char source[MAX_SOURCE_LEN] = "";
                char verif_str[32] = "CONFIRMED_FACT";

                const char *id_p = find_key(obj_start, "id");
                if (id_p && id_p < obj_end) id = extract_int(id_p);

                const char *code_p = find_key(obj_start, "tracking_code");
                if (code_p && code_p < obj_end) extract_string(code_p, code, sizeof(code));

                const char *title_p = find_key(obj_start, "title");
                if (title_p && title_p < obj_end) extract_string(title_p, title, sizeof(title));

                const char *cat_p = find_key(obj_start, "category");
                if (cat_p && cat_p < obj_end) extract_string(cat_p, cat_str, sizeof(cat_str));

                const char *src_p = find_key(obj_start, "source");
                if (src_p && src_p < obj_end) extract_string(src_p, source, sizeof(source));

                const char *verif_p = find_key(obj_start, "verification_status");
                if (verif_p && verif_p < obj_end) extract_string(verif_p, verif_str, sizeof(verif_str));

                evidence_category_t cat = evidence_category_from_str(cat_str);
                verification_status_t verif = evidence_status_from_str(verif_str);

                evidence_record_t *ev_rec = evidence_create(id, ctx->case_id, code, title, cat);
                if (ev_rec) {
                    ev_rec->verification_status = verif;
                    strncpy(ev_rec->source, source, sizeof(ev_rec->source) - 1);

                    const char *loc_p = find_key(obj_start, "location");
                    if (!loc_p || loc_p >= obj_end) loc_p = find_key(obj_start, "collection_location");
                    if (loc_p && loc_p < obj_end) extract_string(loc_p, ev_rec->collection_location, sizeof(ev_rec->collection_location));

                    const char *ts_p = find_key(obj_start, "timestamp");
                    if (!ts_p || ts_p >= obj_end) ts_p = find_key(obj_start, "collected_at");
                    if (ts_p && ts_p < obj_end) ev_rec->timestamp = extract_int64(ts_p);

                    char rel_str[32] = "";
                    const char *rel_p = find_key(obj_start, "reliability_score");
                    if (!rel_p || rel_p >= obj_end) rel_p = find_key(obj_start, "reliability");
                    if (rel_p && rel_p < obj_end) {
                        if (*rel_p == '"') {
                            extract_string(rel_p, rel_str, sizeof(rel_str));
                            ev_rec->reliability = evidence_reliability_from_str(rel_str);
                        } else {
                            float r_val = extract_float(rel_p);
                            if (r_val >= 0.8f) ev_rec->reliability = RELIABILITY_HIGH;
                            else if (r_val >= 0.5f) ev_rec->reliability = RELIABILITY_MEDIUM;
                            else ev_rec->reliability = RELIABILITY_LOW;
                        }
                    }

                    ev_rec->next = ctx->evidence_list;
                    ctx->evidence_list = ev_rec;

                    int v_id = graph_add_vertex(ctx->graph, id, title, "EVIDENCE", verif, ev_rec);

                    char map_key[64];
                    snprintf(map_key, sizeof(map_key), "EVIDENCE:%d", id);
                    hashmap_put(ctx->entity_map, map_key, (void *)(intptr_t)(v_id + 1));
                    if (code[0] != '\0') {
                        char code_key[128];
                        snprintf(code_key, sizeof(code_key), "CODE:%s", code);
                        hashmap_put(ctx->entity_map, code_key, (void *)(intptr_t)(v_id + 1));
                    }
                }

                curr = obj_end + 1;
            }
        }
    }

    // 3. Ingest Relationships
    const char *rel_pos = strstr(json_str, "\"relationships\"");
    if (rel_pos) {
        const char *curr = strchr(rel_pos, '[');
        if (curr) {
            curr++;
            while (*curr && *curr != ']') {
                const char *obj_start = strchr(curr, '{');
                if (!obj_start) break;
                const char *obj_end = strchr(obj_start, '}');
                if (!obj_end) break;

                char src_type[32] = "";
                char tgt_type[32] = "";
                int src_id = 0, tgt_id = 0;
                char rel_type[64] = "ASSOCIATED";
                float weight = 0.5f;

                const char *st_p = find_key(obj_start, "source_type");
                if (st_p && st_p < obj_end) extract_string(st_p, src_type, sizeof(src_type));

                const char *si_p = find_key(obj_start, "source_id");
                if (si_p && si_p < obj_end) src_id = extract_int(si_p);

                const char *tt_p = find_key(obj_start, "target_type");
                if (tt_p && tt_p < obj_end) extract_string(tt_p, tgt_type, sizeof(tgt_type));

                const char *ti_p = find_key(obj_start, "target_id");
                if (ti_p && ti_p < obj_end) tgt_id = extract_int(ti_p);

                const char *rt_p = find_key(obj_start, "relation_type");
                if (!rt_p || rt_p >= obj_end) rt_p = find_key(obj_start, "relationship_type");
                if (rt_p && rt_p < obj_end) extract_string(rt_p, rel_type, sizeof(rel_type));

                const char *w_p = find_key(obj_start, "confidence_weight");
                if (!w_p || w_p >= obj_end) w_p = find_key(obj_start, "confidence");
                if (w_p && w_p < obj_end) weight = extract_float(w_p);

                char key1[64], key2[64];
                snprintf(key1, sizeof(key1), "%s:%d", src_type, src_id);
                snprintf(key2, sizeof(key2), "%s:%d", tgt_type, tgt_id);

                intptr_t v1_val = (intptr_t)hashmap_get(ctx->entity_map, key1);
                intptr_t v2_val = (intptr_t)hashmap_get(ctx->entity_map, key2);

                if (v1_val <= 0) {
                    char id_key1[32];
                    snprintf(id_key1, sizeof(id_key1), "ID:%d", src_id);
                    v1_val = (intptr_t)hashmap_get(ctx->entity_map, id_key1);
                }
                if (v2_val <= 0) {
                    char id_key2[32];
                    snprintf(id_key2, sizeof(id_key2), "ID:%d", tgt_id);
                    v2_val = (intptr_t)hashmap_get(ctx->entity_map, id_key2);
                }

                if (v1_val > 0 && v2_val > 0) {
                    int v1 = (int)(v1_val - 1);
                    int v2 = (int)(v2_val - 1);
                    graph_add_edge(ctx->graph, v1, v2, rel_type, weight, STATUS_CONFIRMED_FACT, EDGE_RECORDED_DIRECT, "Recorded case file association");
                }

                curr = obj_end + 1;
            }
        }
    }

    // 4. Ingest Timeline Events
    const char *time_pos = strstr(json_str, "\"timeline\"");
    if (time_pos) {
        const char *curr = strchr(time_pos, '[');
        if (curr) {
            curr++;
            while (*curr && *curr != ']') {
                const char *obj_start = strchr(curr, '{');
                if (!obj_start) break;
                const char *obj_end = strchr(obj_start, '}');
                if (!obj_end) break;

                int event_id = 0;
                int64_t epoch = 0;
                char entity_type[32] = "";
                int entity_id = 0;
                char loc[MAX_LOC_LEN] = "";
                char status_str[32] = "CONFIRMED_FACT";

                const char *eid_p = find_key(obj_start, "event_id");
                if (!eid_p || eid_p >= obj_end) eid_p = find_key(obj_start, "id");
                if (eid_p && eid_p < obj_end) event_id = extract_int(eid_p);

                const char *ep_p = find_key(obj_start, "timestamp_epoch");
                if (!ep_p || ep_p >= obj_end) ep_p = find_key(obj_start, "timestamp");
                if (ep_p && ep_p < obj_end) epoch = extract_int64(ep_p);

                const char *et_p = find_key(obj_start, "entity_type");
                if (et_p && et_p < obj_end) extract_string(et_p, entity_type, sizeof(entity_type));

                const char *en_id_p = find_key(obj_start, "entity_id");
                if (en_id_p && en_id_p < obj_end) entity_id = extract_int(en_id_p);

                const char *loc_p = find_key(obj_start, "location");
                if (loc_p && loc_p < obj_end) extract_string(loc_p, loc, sizeof(loc));

                const char *st_p = find_key(obj_start, "verification_status");
                if (!st_p || st_p >= obj_end) st_p = find_key(obj_start, "status");
                if (st_p && st_p < obj_end) extract_string(st_p, status_str, sizeof(status_str));

                verification_status_t status = evidence_status_from_str(status_str);

                tree_payload_t *p1 = tree_payload_create(event_id, epoch, "Timeline Incident", loc, entity_id, entity_type, status, status == STATUS_CONFIRMED_FACT);
                tree_payload_t *p2 = tree_payload_create(event_id, epoch, "Timeline Incident", loc, entity_id, entity_type, status, status == STATUS_CONFIRMED_FACT);

                if (p1 && ctx->timeline_avl) avl_insert(ctx->timeline_avl, epoch, p1);
                if (p2 && ctx->timeline_bst) bst_insert(ctx->timeline_bst, epoch, p2);

                curr = obj_end + 1;
            }
        }
    }

    // 5. Ingest Targeted Graph Exploration Query (Optional)
    const char *q_pos = strstr(json_str, "\"query\"");
    if (q_pos) {
        const char *obj_start = strchr(q_pos, '{');
        if (obj_start) {
            const char *obj_end = strchr(obj_start, '}');
            if (obj_end) {
                const char *act_p = find_key(obj_start, "action");
                if (act_p && act_p < obj_end) extract_string(act_p, ctx->query.action, sizeof(ctx->query.action));

                const char *sid_p = find_key(obj_start, "source_id");
                if (sid_p && sid_p < obj_end) ctx->query.source_id = extract_int(sid_p);

                const char *st_p = find_key(obj_start, "source_type");
                if (st_p && st_p < obj_end) extract_string(st_p, ctx->query.source_type, sizeof(ctx->query.source_type));

                const char *tid_p = find_key(obj_start, "target_id");
                if (tid_p && tid_p < obj_end) ctx->query.target_id = extract_int(tid_p);

                const char *tt_p = find_key(obj_start, "target_type");
                if (tt_p && tt_p < obj_end) extract_string(tt_p, ctx->query.target_type, sizeof(ctx->query.target_type));

                const char *nid_p = find_key(obj_start, "node_id");
                if (nid_p && nid_p < obj_end) ctx->query.node_id = extract_int(nid_p);

                const char *nt_p = find_key(obj_start, "node_type");
                if (nt_p && nt_p < obj_end) extract_string(nt_p, ctx->query.node_type, sizeof(ctx->query.node_type));

                const char *dep_p = find_key(obj_start, "depth");
                if (dep_p && dep_p < obj_end) ctx->query.depth = extract_int(dep_p);
                if (ctx->query.depth <= 0) ctx->query.depth = 2;
            }
        }
    }

    return CT_SUCCESS;
}

void emit_analysis_json(FILE *out, const analysis_result_t *res, const case_ingestion_context_t *ctx) {
    if (!out || !ctx) return;
    const evidence_graph_t *graph = ctx->graph;
    int case_id = ctx->case_id;

    // 1. Calculate Connected Components & Classifications
    int *comp_map = NULL;
    int num_comp = 0;
    size_t isolated_count = 0;
    if (graph && graph->num_vertices > 0) {
        comp_map = (int *)calloc(graph->num_vertices, sizeof(int));
        if (comp_map) {
            graph_connected_components(graph, comp_map, &num_comp);
        }
        for (size_t i = 0; i < graph->num_vertices; i++) {
            if (graph->vertices[i].degree == 0) {
                isolated_count++;
            }
        }
    }

    size_t count_direct = 0, count_derived = 0, count_suggested = 0, count_unverified = 0, count_disputed = 0;
    size_t total_edges = 0;
    if (graph) {
        for (size_t i = 0; i < graph->num_vertices; i++) {
            graph_edge_t *e = graph->vertices[i].edges_head;
            while (e) {
                if ((int)i <= e->target_vertex_id) {
                    total_edges++;
                    if (e->origin == EDGE_RECORDED_DIRECT) count_direct++;
                    else if (e->origin == EDGE_ORIGIN_DATA_DERIVED) count_derived++;
                    else if (e->origin == EDGE_ORIGIN_SUGGESTED_VERIFICATION || e->origin == EDGE_ALGORITHMIC_SUGGESTED) count_suggested++;
                    else if (e->origin == EDGE_ORIGIN_UNVERIFIED) count_unverified++;
                    else if (e->origin == EDGE_ORIGIN_DISPUTED) count_disputed++;
                }
                e = e->next;
            }
        }
    }

    fprintf(out, "{\n");
    fprintf(out, "  \"status\": \"SUCCESS\",\n");
    fprintf(out, "  \"engine_version\": \"%s\",\n", ENGINE_VERSION);
    fprintf(out, "  \"case_id\": %d,\n", case_id);
    fprintf(out, "  \"metrics\": {\n");
    fprintf(out, "    \"nodes_processed\": %zu,\n", graph ? graph->num_vertices : 0);
    fprintf(out, "    \"edges_evaluated\": %zu,\n", total_edges);
    fprintf(out, "    \"connected_components\": %d,\n", num_comp);
    fprintf(out, "    \"isolated_nodes_count\": %zu,\n", isolated_count);
    fprintf(out, "    \"gaps_detected\": %zu,\n", res ? res->total_gaps : 0);
    fprintf(out, "    \"anomalies_detected\": %zu,\n", res ? res->total_anomalies : 0);
    fprintf(out, "    \"leads_generated\": %zu\n", res ? res->total_leads : 0);
    fprintf(out, "  },\n");

    // Classification Summary
    fprintf(out, "  \"classification_summary\": {\n");
    fprintf(out, "    \"directly_documented\": %zu,\n", count_direct);
    fprintf(out, "    \"data_derived\": %zu,\n", count_derived);
    fprintf(out, "    \"suggested_for_verification\": %zu,\n", count_suggested);
    fprintf(out, "    \"unverified\": %zu,\n", count_unverified);
    fprintf(out, "    \"disputed\": %zu,\n", count_disputed);
    fprintf(out, "    \"total_relationships\": %zu\n", total_edges);
    fprintf(out, "  },\n");

    // 2. Graph Nodes
    fprintf(out, "  \"graph_nodes\": [\n");
    if (graph) {
        for (size_t i = 0; i < graph->num_vertices; i++) {
            const graph_vertex_t *v = &graph->vertices[i];
            int comp_id = comp_map ? comp_map[i] : 1;
            bool is_iso = (v->degree == 0);
            fprintf(out, "    {\n");
            fprintf(out, "      \"node_id\": %d,\n", v->vertex_id);
            fprintf(out, "      \"db_id\": %d,\n", v->original_db_id);
            fprintf(out, "      \"label\": \"%s\",\n", v->label);
            fprintf(out, "      \"entity_type\": \"%s\",\n", v->entity_type);
            fprintf(out, "      \"verification_status\": \"%s\",\n", evidence_status_to_str(v->status));
            fprintf(out, "      \"degree\": %d,\n", v->degree);
            fprintf(out, "      \"component_id\": %d,\n", comp_id);
            fprintf(out, "      \"is_isolated\": %s\n", is_iso ? "true" : "false");
            fprintf(out, "    }%s\n", (i + 1 < graph->num_vertices) ? "," : "");
        }
    }
    fprintf(out, "  ],\n");

    // 3. Graph Edges (Undirected unique pairs)
    fprintf(out, "  \"graph_edges\": [\n");
    if (graph) {
        bool first_edge = true;
        for (size_t i = 0; i < graph->num_vertices; i++) {
            graph_edge_t *e = graph->vertices[i].edges_head;
            while (e) {
                if ((int)i <= e->target_vertex_id) {
                    if (!first_edge) fprintf(out, ",\n");
                    first_edge = false;
                    int dest = e->target_vertex_id;
                    fprintf(out, "    {\n");
                    fprintf(out, "      \"edge_id\": %d,\n", e->edge_id);
                    fprintf(out, "      \"source_id\": %d,\n", (int)i);
                    fprintf(out, "      \"target_id\": %d,\n", dest);
                    fprintf(out, "      \"source_label\": \"%s\",\n", graph->vertices[i].label);
                    fprintf(out, "      \"target_label\": \"%s\",\n", graph->vertices[dest].label);
                    fprintf(out, "      \"source_type\": \"%s\",\n", graph->vertices[i].entity_type);
                    fprintf(out, "      \"target_type\": \"%s\",\n", graph->vertices[dest].entity_type);
                    fprintf(out, "      \"relation_type\": \"%s\",\n", e->relation_type);
                    fprintf(out, "      \"confidence_weight\": %.2f,\n", e->confidence_weight);
                    fprintf(out, "      \"verification_status\": \"%s\",\n", evidence_status_to_str(e->status));
                    fprintf(out, "      \"relationship_nature\": \"%s\",\n", edge_origin_to_str(e->origin));
                    fprintf(out, "      \"source_description\": \"%s\"\n", e->source_description);
                    fprintf(out, "    }");
                }
                e = e->next;
            }
        }
        if (!first_edge) fprintf(out, "\n");
    }
    fprintf(out, "  ],\n");

    // 4. Isolated Evidence Nodes
    fprintf(out, "  \"isolated_nodes\": [\n");
    if (graph) {
        bool first_iso = true;
        for (size_t i = 0; i < graph->num_vertices; i++) {
            if (graph->vertices[i].degree == 0) {
                if (!first_iso) fprintf(out, ",\n");
                first_iso = false;
                fprintf(out, "    {\"node_id\": %d, \"db_id\": %d, \"label\": \"%s\", \"entity_type\": \"%s\"}",
                        (int)i, graph->vertices[i].original_db_id, graph->vertices[i].label, graph->vertices[i].entity_type);
            }
        }
        if (!first_iso) fprintf(out, "\n");
    }
    fprintf(out, "  ],\n");

    // 5. Connected Components
    fprintf(out, "  \"connected_components\": [\n");
    if (graph && comp_map && num_comp > 0) {
        for (int c = 1; c <= num_comp; c++) {
            fprintf(out, "    {\n");
            fprintf(out, "      \"component_id\": %d,\n", c);
            fprintf(out, "      \"nodes\": [");
            bool first_node = true;
            for (size_t i = 0; i < graph->num_vertices; i++) {
                if (comp_map[i] == c) {
                    if (!first_node) fprintf(out, ", ");
                    fprintf(out, "{\"vertex_id\": %d, \"label\": \"%s\", \"type\": \"%s\"}",
                            (int)i, graph->vertices[i].label, graph->vertices[i].entity_type);
                    first_node = false;
                }
            }
            fprintf(out, "]\n");
            fprintf(out, "    }%s\n", (c < num_comp) ? "," : "");
        }
    }
    fprintf(out, "  ],\n");

    // 6. Targeted Query Execution Result (if query requested)
    if (ctx->query.action[0] != '\0') {
        fprintf(out, "  \"query_result\": {\n");
        fprintf(out, "    \"action\": \"%s\",\n", ctx->query.action);

        if (strcmp(ctx->query.action, "FIND_PATH") == 0) {
            int src_v = graph_find_vertex_by_db_id(graph, ctx->query.source_id,
                                                   ctx->query.source_type[0] ? ctx->query.source_type : NULL);
            int tgt_v = graph_find_vertex_by_db_id(graph, ctx->query.target_id,
                                                   ctx->query.target_type[0] ? ctx->query.target_type : NULL);

            if (src_v == -1 && ctx->query.source_id >= 0 && ctx->query.source_id < (int)graph->num_vertices) {
                src_v = ctx->query.source_id;
            }
            if (tgt_v == -1 && ctx->query.target_id >= 0 && ctx->query.target_id < (int)graph->num_vertices) {
                tgt_v = ctx->query.target_id;
            }

            if (src_v != -1 && tgt_v != -1) {
                int path[1024];
                int path_len = 0;
                ct_status_t p_res = graph_shortest_path(graph, src_v, tgt_v, path, &path_len);

                if (p_res == CT_SUCCESS && path_len > 0) {
                    fprintf(out, "    \"found\": true,\n");
                    fprintf(out, "    \"path_length\": %d,\n", path_len);
                    fprintf(out, "    \"explanation\": \"Discovered %d-hop investigative chain connecting '%s' to '%s'\",\n",
                            path_len - 1, graph->vertices[src_v].label, graph->vertices[tgt_v].label);
                    fprintf(out, "    \"steps\": [\n");
                    for (int p = 0; p < path_len; p++) {
                        int v_idx = path[p];
                        fprintf(out, "      {\"step\": %d, \"node_id\": %d, \"label\": \"%s\", \"type\": \"%s\"}%s\n",
                                p + 1, v_idx, graph->vertices[v_idx].label, graph->vertices[v_idx].entity_type,
                                (p + 1 < path_len) ? "," : "");
                    }
                    fprintf(out, "    ]\n");
                } else {
                    fprintf(out, "    \"found\": false,\n");
                    fprintf(out, "    \"message\": \"No relational path connects the selected investigation entities in the case graph.\"\n");
                }
            } else {
                fprintf(out, "    \"found\": false,\n");
                fprintf(out, "    \"message\": \"One or both entity identifiers could not be resolved in the case network.\"\n");
            }
        } else if (strcmp(ctx->query.action, "EXPLORE_NODE") == 0) {
            int node_v = graph_find_vertex_by_db_id(graph, ctx->query.node_id,
                                                    ctx->query.node_type[0] ? ctx->query.node_type : NULL);
            if (node_v == -1 && ctx->query.node_id >= 0 && ctx->query.node_id < (int)graph->num_vertices) {
                node_v = ctx->query.node_id;
            }

            if (node_v != -1) {
                int sub[1024];
                size_t sub_len = 0;
                graph_explore_subgraph(graph, node_v, ctx->query.depth, sub, &sub_len, 1024);

                fprintf(out, "    \"start_node\": %d,\n", node_v);
                fprintf(out, "    \"start_label\": \"%s\",\n", graph->vertices[node_v].label);
                fprintf(out, "    \"depth\": %d,\n", ctx->query.depth);
                fprintf(out, "    \"explored_count\": %zu,\n", sub_len);
                fprintf(out, "    \"subgraph_nodes\": [\n");
                for (size_t s = 0; s < sub_len; s++) {
                    int sv = sub[s];
                    fprintf(out, "      {\"node_id\": %d, \"label\": \"%s\", \"type\": \"%s\", \"degree\": %d}%s\n",
                            sv, graph->vertices[sv].label, graph->vertices[sv].entity_type, graph->vertices[sv].degree,
                            (s + 1 < sub_len) ? "," : "");
                }
                fprintf(out, "    ]\n");
            } else {
                fprintf(out, "    \"found\": false,\n");
                fprintf(out, "    \"message\": \"Target entity node could not be resolved for exploration.\"\n");
            }
        }
        fprintf(out, "  },\n");
    }

    if (comp_map) free(comp_map);

    // 7. Evidence Gaps
    fprintf(out, "  \"evidence_gaps\": [\n");
    if (res) {
        evidence_gap_item_t *gap = res->gaps_head;
        while (gap) {
            fprintf(out, "    {\n");
            fprintf(out, "      \"gap_id\": \"%s\",\n", gap->gap_id);
            fprintf(out, "      \"category\": \"%s\",\n", gap->gap_category);
            fprintf(out, "      \"title\": \"%s\",\n", gap->title);
            fprintf(out, "      \"reason\": \"%s\",\n", gap->reason);
            fprintf(out, "      \"suggested_action\": \"%s\",\n", gap->suggested_action);
            fprintf(out, "      \"priority\": \"%s\",\n",
                    gap->priority == GAP_SEVERITY_CRITICAL ? "CRITICAL" :
                    gap->priority == GAP_SEVERITY_HIGH ? "HIGH" :
                    gap->priority == GAP_SEVERITY_MEDIUM ? "MEDIUM" : "LOW");
            fprintf(out, "      \"status\": \"%s\"\n", gap->status);
            fprintf(out, "    }%s\n", gap->next ? "," : "");
            gap = gap->next;
        }
    }
    fprintf(out, "  ],\n");

    // 8. Timeline Anomalies
    fprintf(out, "  \"timeline_anomalies\": [\n");
    if (res) {
        timeline_anomaly_item_t *anom = res->anomalies_head;
        while (anom) {
            fprintf(out, "    {\n");
            fprintf(out, "      \"anomaly_id\": %d,\n", anom->anomaly_id);
            fprintf(out, "      \"entity_label\": \"%s\",\n", anom->entity_label);
            fprintf(out, "      \"anomaly_type\": \"%s\",\n", anom->anomaly_type);
            fprintf(out, "      \"explanation\": \"%s\",\n", anom->explanation);
            fprintf(out, "      \"suggested_check\": \"%s\"\n", anom->suggested_check);
            fprintf(out, "    }%s\n", anom->next ? "," : "");
            anom = anom->next;
        }
    }
    fprintf(out, "  ],\n");

    // 9. Prioritized Leads
    fprintf(out, "  \"prioritized_leads\": [\n");
    if (res) {
        investigative_lead_item_t *lead = res->leads_head;
        while (lead) {
            fprintf(out, "    {\n");
            fprintf(out, "      \"lead_id\": \"%s\",\n", lead->lead_id);
            fprintf(out, "      \"title\": \"%s\",\n", lead->title);
            fprintf(out, "      \"explanation\": \"%s\",\n", lead->explanation);
            fprintf(out, "      \"supporting_relationships\": \"%s\",\n", lead->supporting_relationships);
            fprintf(out, "      \"missing_information\": \"%s\",\n", lead->missing_information);
            fprintf(out, "      \"suggested_step\": \"%s\",\n", lead->suggested_step);
            fprintf(out, "      \"score\": %.2f,\n", lead->evidence_strength_score);
            fprintf(out, "      \"strength\": \"%s\"\n", lead->strength_description);
            fprintf(out, "    }%s\n", lead->next ? "," : "");
            lead = lead->next;
        }
    }
    fprintf(out, "  ]\n");
    fprintf(out, "}\n");
}

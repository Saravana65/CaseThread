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

                const char *st_p = find_key(obj_start, "status");
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

    return CT_SUCCESS;
}

void emit_analysis_json(FILE *out, const analysis_result_t *res, const evidence_graph_t *graph, int case_id) {
    if (!out) return;

    fprintf(out, "{\n");
    fprintf(out, "  \"status\": \"SUCCESS\",\n");
    fprintf(out, "  \"engine_version\": \"%s\",\n", ENGINE_VERSION);
    fprintf(out, "  \"case_id\": %d,\n", case_id);
    fprintf(out, "  \"metrics\": {\n");
    fprintf(out, "    \"nodes_processed\": %zu,\n", graph ? graph->num_vertices : 0);
    fprintf(out, "    \"gaps_detected\": %zu,\n", res ? res->total_gaps : 0);
    fprintf(out, "    \"anomalies_detected\": %zu,\n", res ? res->total_anomalies : 0);
    fprintf(out, "    \"leads_generated\": %zu\n", res ? res->total_leads : 0);
    fprintf(out, "  },\n");

    // Connected Components
    fprintf(out, "  \"connected_components\": [\n");
    if (graph && graph->num_vertices > 0) {
        int *comp_map = (int *)malloc(graph->num_vertices * sizeof(int));
        int num_comp = 0;
        if (comp_map && graph_connected_components(graph, comp_map, &num_comp) == CT_SUCCESS) {
            for (int c = 1; c <= num_comp; c++) {
                fprintf(out, "    {\n");
                fprintf(out, "      \"component_id\": %d,\n", c);
                fprintf(out, "      \"nodes\": [");
                bool first = true;
                for (size_t i = 0; i < graph->num_vertices; i++) {
                    if (comp_map[i] == c) {
                        if (!first) fprintf(out, ", ");
                        fprintf(out, "{\"vertex_id\": %d, \"label\": \"%s\", \"type\": \"%s\"}",
                                (int)i, graph->vertices[i].label, graph->vertices[i].entity_type);
                        first = false;
                    }
                }
                fprintf(out, "]\n");
                fprintf(out, "    }%s\n", (c < num_comp) ? "," : "");
            }
        }
        free(comp_map);
    }
    fprintf(out, "  ],\n");

    // Evidence Gaps
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

    // Timeline Anomalies
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

    // Prioritized Leads
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

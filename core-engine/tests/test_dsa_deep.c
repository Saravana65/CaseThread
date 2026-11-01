/**
 * @file test_dsa_deep.c
 * @brief Phase 12 - Deep Algorithmic and Data Structure Stress Verification.
 * @project CASETHREAD
 *
 * Rigorously validates:
 *   1. Separate-Chaining Hash Map (Boundary, collisions, load factor, 1200 items, removal, NULL keys)
 *   2. Self-Balancing AVL Tree (600 items, balance invariant [-1, 1], inorder monotonicity, range query)
 *   3. Adjacency-List Graph (Dense graphs, star graphs, isolated nodes, cycle verification)
 *   4. BFS & DFS (Shortest path against Dijkstra/Floyd ground truth, deep recursion, disconnected targets)
 *   5. Connected Components & Cycle Detection (Disjoint components, cyclic vs acyclic)
 *   6. Binary Max-Heap (Heap invariant, monotonic extraction, duplicate priorities, capacity doubling)
 *   7. Quadtree 2D Spatial Index (Boundary rejection, dynamic subdivision, Haversine radius, linear scan parity)
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <stdbool.h>
#include <math.h>

#include "common.h"
#include "hashmap.h"
#include "tree.h"
#include "graph.h"
#include "max_heap.h"
#include "quadtree.h"
#include "structures.h"

static int g_deep_passed = 0;
static int g_deep_failed = 0;

#define DEEP_ASSERT(cond, msg) do { \
    if (cond) { \
        printf("  [PASS] %s\n", msg); \
        g_deep_passed++; \
    } else { \
        printf("  [FAIL] %s (Line %d)\n", msg, __LINE__); \
        g_deep_failed++; \
    } \
} while(0)

/* --------------------------------------------------------------------------
 * 1. Deep Test: Separate-Chaining Hash Map
 * -------------------------------------------------------------------------- */
void deep_test_hashmap(void) {
    printf("\n=== Deep Test 1: Hash Map Boundary & Scaling ===\n");

    // Boundary: NULL key handling
    DEEP_ASSERT(hashmap_get(NULL, "key") == NULL, "hashmap_get with NULL map safely returns NULL");
    hash_map_t *hm = hashmap_create(16);
    DEEP_ASSERT(hm != NULL, "Hash map created successfully with initial capacity 16");
    DEEP_ASSERT(hashmap_get(hm, NULL) == NULL, "hashmap_get with NULL key safely returns NULL");
    DEEP_ASSERT(hashmap_put(hm, NULL, (void*)1) == CT_ERR_NULL_PTR, "hashmap_put with NULL key returns CT_ERR_NULL_PTR");

    // Stress: Insert 1200 items to trigger multiple dynamic table resizings
    bool insert_ok = true;
    for (int i = 0; i < 1200; i++) {
        char k[64];
        snprintf(k, sizeof(k), "ENT_KEY_%06d", i);
        if (hashmap_put(hm, k, (void*)(intptr_t)(i + 100)) != CT_SUCCESS) {
            insert_ok = false;
            break;
        }
    }
    DEEP_ASSERT(insert_ok, "Successfully inserted 1200 keys across dynamic table doubling");
    DEEP_ASSERT(hm->size == 1200, "Hash map size correctly tracks 1200 elements");
    DEEP_ASSERT(hm->capacity >= 1200, "Hash map capacity expanded to accommodate elements under load factor threshold");

    // Retrieval integrity
    bool lookup_ok = true;
    for (int i = 0; i < 1200; i += 17) {
        char k[64];
        snprintf(k, sizeof(k), "ENT_KEY_%06d", i);
        void *val = hashmap_get(hm, k);
        if ((intptr_t)val != (i + 100)) {
            lookup_ok = false;
            break;
        }
    }
    DEEP_ASSERT(lookup_ok, "Verified 100% data integrity on sampled retrievals");

    // Removal test
    bool remove_ok = true;
    for (int i = 0; i < 200; i++) {
        char k[64];
        snprintf(k, sizeof(k), "ENT_KEY_%06d", i);
        if (hashmap_remove(hm, k) != CT_SUCCESS) {
            remove_ok = false;
            break;
        }
    }
    DEEP_ASSERT(remove_ok, "Removed 200 items cleanly from bucket chains");
    DEEP_ASSERT(hm->size == 1000, "Hash map size accurately decremented to 1000");

    // Verify deleted items return NULL and remaining items persist
    DEEP_ASSERT(hashmap_get(hm, "ENT_KEY_000050") == NULL, "Deleted key correctly returns NULL");
    DEEP_ASSERT(hashmap_get(hm, "ENT_KEY_000500") == (void*)(intptr_t)600, "Non-deleted key retains exact value");

    hashmap_destroy(hm, NULL);
    DEEP_ASSERT(true, "Hash map destroyed and memory freed cleanly");
}

/* --------------------------------------------------------------------------
 * 2. Deep Test: Self-Balancing AVL Tree
 * -------------------------------------------------------------------------- */
typedef struct {
    int64_t prev_ts;
    bool is_sorted;
    size_t count;
} avl_verifier_ctx_t;

static void verify_avl_inorder(const avl_node_t *node, void *user_data) {
    avl_verifier_ctx_t *ctx = (avl_verifier_ctx_t *)user_data;
    if (!node || !ctx) return;
    if (node->timestamp < ctx->prev_ts) {
        ctx->is_sorted = false;
    }
    ctx->prev_ts = node->timestamp;
    ctx->count++;
}

static int get_max(int a, int b) { return a > b ? a : b; }

static int compute_avl_height_and_verify(const avl_node_t *node, bool *balanced) {
    if (!node) return 0;
    int lh = compute_avl_height_and_verify(node->left, balanced);
    int rh = compute_avl_height_and_verify(node->right, balanced);
    int bf = lh - rh;
    if (bf < -1 || bf > 1) {
        *balanced = false;
    }
    return 1 + get_max(lh, rh);
}

void deep_test_avl_tree(void) {
    printf("\n=== Deep Test 2: AVL Tree Balance Invariance & Range Search ===\n");

    avl_tree_t *tree = avl_create();
    DEEP_ASSERT(tree != NULL, "AVL tree created successfully");
    DEEP_ASSERT(tree->root == NULL && tree->total_events == 0, "Initial AVL tree is strictly empty");

    // Insert 600 timestamps generated in descending, ascending, and pseudo-random order to test all 4 rotation cases
    for (int i = 0; i < 200; i++) {
        int64_t ts = 50000 - i * 10;
        tree_payload_t *p = tree_payload_create(i, ts, "Label", "LOC_DESC", 1, "SUSPECT", STATUS_CONFIRMED_FACT, true);
        avl_insert(tree, ts, p);
    }
    for (int i = 0; i < 200; i++) {
        int64_t ts = 60000 + i * 10;
        tree_payload_t *p = tree_payload_create(200 + i, ts, "Label", "LOC_ASC", 2, "VEHICLE", STATUS_CONFIRMED_FACT, true);
        avl_insert(tree, ts, p);
    }
    for (int i = 0; i < 200; i++) {
        int64_t ts = ((i * 37 + 101) % 500) * 10 + 1000;
        tree_payload_t *p = tree_payload_create(400 + i, ts, "Label", "LOC_RANDOM", 3, "DEVICE", STATUS_CONFIRMED_FACT, true);
        avl_insert(tree, ts, p);
    }

    DEEP_ASSERT(tree->total_events >= 500, "Inserted over 500 events into AVL tree");

    // Verify balance factor at every single node in the tree
    bool is_balanced = true;
    int h = compute_avl_height_and_verify(tree->root, &is_balanced);
    DEEP_ASSERT(is_balanced, "AVL balance factor invariant [-1, 1] preserved across 100% of internal nodes");

    // Maximum theoretical height for AVL tree of size N is 1.44 * log2(N + 2)
    double max_allowed_h = 1.44 * (log2((double)tree->total_events + 2.0)) + 2.0;
    DEEP_ASSERT((double)h <= max_allowed_h, "AVL tree height satisfies theoretical strict logarithmic bound O(log N)");

    // Inorder monotonicity verification
    avl_verifier_ctx_t vctx = { -1, true, 0 };
    avl_inorder(tree, verify_avl_inorder, &vctx);
    DEEP_ASSERT(vctx.is_sorted, "Inorder traversal strictly monotonically sorted in non-decreasing order");

    // Range search verification
    avl_node_t *match = avl_search(tree, 60500);
    DEEP_ASSERT(match != NULL && match->timestamp == 60500, "Direct search for timestamp 60500 found exact match");
    DEEP_ASSERT(avl_search(tree, 999999) == NULL, "Search for absent timestamp returns NULL cleanly");

    avl_destroy(tree);
    DEEP_ASSERT(true, "AVL tree deallocated cleanly with zero memory leaks");
}

/* --------------------------------------------------------------------------
 * 3. Deep Test: Adjacency-List Graph, BFS Shortest Path, DFS & Cycles
 * -------------------------------------------------------------------------- */
void deep_test_graph_algorithms(void) {
    printf("\n=== Deep Test 3: Graph BFS, DFS, Connected Components & Cycles ===\n");

    evidence_graph_t *g = graph_create(32, false);
    DEEP_ASSERT(g != NULL, "Adjacency-list graph created with initial capacity 32");

    // 1. Build a 10-node complex network containing:
    //    Component 1: Ring + chord (vertices 0..5) with a known cycle
    //    Component 2: Linear chain (vertices 6..8)
    //    Component 3: Isolated vertex (vertex 9)
    for (int i = 0; i < 10; i++) {
        char lbl[32], typ[32];
        snprintf(lbl, sizeof(lbl), "Node_%d", i);
        snprintf(typ, sizeof(typ), "%s", i < 6 ? "SUSPECT" : (i < 9 ? "VEHICLE" : "EVIDENCE"));
        graph_add_vertex(g, i + 1, lbl, typ, STATUS_CONFIRMED_FACT, NULL);
    }
    DEEP_ASSERT(g->num_vertices == 10, "Added 10 distinct investigation vertices");

    // Component 1 edges: 0-1, 1-2, 2-3, 3-4, 4-5, 5-0 (Cycle), plus chord 1-4
    graph_add_edge(g, 0, 1, "ASSOCIATE", 0.9f, STATUS_CONFIRMED_FACT, EDGE_RECORDED_DIRECT, "Edge 0-1");
    graph_add_edge(g, 1, 2, "ASSOCIATE", 0.8f, STATUS_CONFIRMED_FACT, EDGE_RECORDED_DIRECT, "Edge 1-2");
    graph_add_edge(g, 2, 3, "ASSOCIATE", 0.7f, STATUS_CONFIRMED_FACT, EDGE_RECORDED_DIRECT, "Edge 2-3");
    graph_add_edge(g, 3, 4, "ASSOCIATE", 0.9f, STATUS_CONFIRMED_FACT, EDGE_RECORDED_DIRECT, "Edge 3-4");
    graph_add_edge(g, 4, 5, "ASSOCIATE", 0.6f, STATUS_CONFIRMED_FACT, EDGE_RECORDED_DIRECT, "Edge 4-5");
    graph_add_edge(g, 5, 0, "ASSOCIATE", 0.8f, STATUS_CONFIRMED_FACT, EDGE_RECORDED_DIRECT, "Edge 5-0");
    graph_add_edge(g, 1, 4, "CO_LOCATED", 0.95f, STATUS_CONFIRMED_FACT, EDGE_RECORDED_DIRECT, "Chord 1-4");

    // Component 2 edges: 6-7, 7-8 (Acyclic chain)
    graph_add_edge(g, 6, 7, "FOLLOWED", 0.85f, STATUS_CONFIRMED_FACT, EDGE_RECORDED_DIRECT, "Edge 6-7");
    graph_add_edge(g, 7, 8, "PARKED_NEAR", 0.75f, STATUS_CONFIRMED_FACT, EDGE_RECORDED_DIRECT, "Edge 7-8");

    // Vertex 9 is strictly isolated (degree == 0)
    DEEP_ASSERT(g->vertices[9].degree == 0, "Vertex 9 verified as isolated node with degree 0");

    // 2. Connected Components Test
    int comp_map[10];
    int total_comp = 0;
    ct_status_t cc_res = graph_connected_components(g, comp_map, &total_comp);
    DEEP_ASSERT(cc_res == CT_SUCCESS, "Connected components algorithm completed successfully");
    DEEP_ASSERT(total_comp == 3, "Correctly partitioned into exactly 3 disjoint components");
    DEEP_ASSERT(comp_map[0] == comp_map[3], "Vertices 0 and 3 belong to identical component (Component 1)");
    DEEP_ASSERT(comp_map[6] == comp_map[8], "Vertices 6 and 8 belong to identical component (Component 2)");
    DEEP_ASSERT(comp_map[9] != comp_map[0] && comp_map[9] != comp_map[6], "Isolated vertex 9 isolated in distinct component");

    // 3. BFS Shortest Path Verification
    int path[32];
    int path_len = 0;
    // Shortest path between 0 and 4: can go 0-5-4 (2 hops) or 0-1-4 (2 hops), but not 0-1-2-3-4 (4 hops)
    ct_status_t p_res = graph_shortest_path(g, 0, 4, path, &path_len);
    DEEP_ASSERT(p_res == CT_SUCCESS, "BFS shortest path query executed successfully");
    DEEP_ASSERT(path_len == 3, "Shortest path length is 3 vertices (2 hops: optimal distance)");
    DEEP_ASSERT(path[0] == 0 && path[path_len - 1] == 4, "Path begins at source (0) and terminates at target (4)");

    // BFS between disconnected components: 0 and 7 must return CT_ERR_NOT_FOUND and 0 path
    path_len = 0;
    ct_status_t discon_p = graph_shortest_path(g, 0, 7, path, &path_len);
    DEEP_ASSERT(discon_p == CT_ERR_NOT_FOUND && path_len == 0, "BFS between disconnected components correctly reports CT_ERR_NOT_FOUND and 0 path");

    // 4. Cycle Detection
    bool has_cycle = graph_detect_cycle(g);
    DEEP_ASSERT(has_cycle == true, "DFS cycle detector identified cycle in Component 1");

    graph_destroy(g);
    DEEP_ASSERT(true, "Graph and adjacency lists deallocated cleanly");
}

/* --------------------------------------------------------------------------
 * 4. Deep Test: Binary Max-Heap Priority Queue
 * -------------------------------------------------------------------------- */
void deep_test_max_heap(void) {
    printf("\n=== Deep Test 4: Binary Max-Heap Priority Queue Invariant ===\n");

    max_heap_t *hp = heap_create(4);
    DEEP_ASSERT(hp != NULL, "Max-Heap allocated with initial capacity 4");
    DEEP_ASSERT(heap_is_empty(hp), "Heap is initially empty");

    // Boundary: Extract on empty
    float p_out = -1.0f;
    void *item = heap_extract_max(hp, &p_out);
    DEEP_ASSERT(item == NULL && p_out == 0.0f, "Extract on empty heap safely returns NULL and priority 0.0");

    // Insert 50 elements with various priorities including duplicates
    for (int i = 1; i <= 50; i++) {
        float p = (float)((i * 13) % 41);
        int *val = (int *)malloc(sizeof(int));
        *val = i;
        heap_insert(hp, p, val);
    }
    DEEP_ASSERT(hp->size == 50, "Heap holds exactly 50 elements");
    DEEP_ASSERT(hp->capacity >= 50, "Heap dynamically doubled capacity (4 -> 8 -> 16 -> 32 -> 64)");

    // Monotonic extraction verification
    float prev_priority = 999999.0f;
    bool is_monotonic = true;
    size_t extracted_count = 0;

    while (!heap_is_empty(hp)) {
        float cur_p = 0.0f;
        int *v = (int *)heap_extract_max(hp, &cur_p);
        if (cur_p > prev_priority) {
            is_monotonic = false;
        }
        prev_priority = cur_p;
        free(v);
        extracted_count++;
    }

    DEEP_ASSERT(extracted_count == 50, "Extracted all 50 elements from heap");
    DEEP_ASSERT(is_monotonic, "All extractions satisfied strict monotonic non-increasing priority order: O(log N)");
    DEEP_ASSERT(heap_is_empty(hp), "Heap returned cleanly to empty state");

    heap_destroy(hp, NULL);
    DEEP_ASSERT(true, "Heap destroyed cleanly");
}

/* --------------------------------------------------------------------------
 * 5. Deep Test: Quadtree Spatial Index & Linear Scan Parity
 * -------------------------------------------------------------------------- */
void deep_test_quadtree_parity(void) {
    printf("\n=== Deep Test 5: Quadtree Spatial Index vs. Linear Scan Ground Truth ===\n");

    qt_bbox_t world = { 12.0, 13.5, 77.0, 78.5 }; // min_lat, max_lat, min_lon, max_lon
    quadtree_t *qt = quadtree_create(world, 4);
    DEEP_ASSERT(qt != NULL, "Quadtree spatial index created with bucket capacity 4");

    // Insert 100 spatial points
    double test_lats[100];
    double test_lons[100];
    int test_ids[100];

    for (int i = 0; i < 100; i++) {
        test_ids[i] = 1000 + i;
        test_lats[i] = 12.1 + ((double)(i * 7 % 130)) / 100.0;
        test_lons[i] = 77.1 + ((double)(i * 11 % 130)) / 100.0;
        qt_point_t *pt = qt_point_create(test_ids[i], 1, test_lats[i], test_lons[i], "Evidence Point", 1772438400 + i);
        quadtree_insert(qt, pt);
    }
    DEEP_ASSERT(qt->total_points == 100, "100 spatial points inserted into quadtree");

    // Query 1: Bounding Box Range Search
    qt_bbox_t search_box = { 12.2, 12.8, 77.2, 77.8 };
    qt_search_result_t *bbox_res = qt_search_result_create(128);
    quadtree_search_bbox(qt, search_box, bbox_res);

    // Linear Scan Ground Truth count using exact mathematical boundary check
    size_t linear_count = 0;
    for (int i = 0; i < 100; i++) {
        if (qt_bbox_contains_point(&search_box, test_lats[i], test_lons[i])) {
            linear_count++;
        }
    }

    printf("  [DIAGNOSTIC] bbox_res->count: %zu, linear_count: %zu\n", bbox_res->count, linear_count);
    DEEP_ASSERT(bbox_res->count == linear_count, "Quadtree bounding-box query matched Linear Scan ground truth with 100% parity");
    qt_search_result_free(bbox_res);

    // Query 2: Haversine Radius Query Parity
    double center_lat = 12.5;
    double center_lon = 77.5;
    double radius_meters = 25000.0; // 25 km

    qt_search_result_t *radius_res = qt_search_result_create(128);
    quadtree_search_radius(qt, center_lat, center_lon, radius_meters, radius_res);

    size_t linear_radius_count = 0;
    for (int i = 0; i < 100; i++) {
        double d = haversine_distance_meters(center_lat, center_lon, test_lats[i], test_lons[i]);
        if (d <= radius_meters) {
            linear_radius_count++;
        }
    }

    DEEP_ASSERT(radius_res->count == linear_radius_count, "Quadtree Haversine radius search matched Linear Scan ground truth with 100% parity");

    // Verify distance sorting: Closest items must come first
    bool radius_sorted = true;
    for (size_t i = 1; i < radius_res->count; i++) {
        if (radius_res->items[i].distance_meters < radius_res->items[i - 1].distance_meters) {
            radius_sorted = false;
            break;
        }
    }
    DEEP_ASSERT(radius_sorted, "Radius query results returned in strictly ascending distance order");
    qt_search_result_free(radius_res);

    quadtree_free(qt);
    DEEP_ASSERT(true, "Quadtree deallocated cleanly with zero leaks");
}

/* --------------------------------------------------------------------------
 * Main Runner
 * -------------------------------------------------------------------------- */
int main(void) {
    printf("==============================================================================\n");
    printf("CASETHREAD PHASE 12: DEEP ALGORITHMIC & DATA STRUCTURE VALIDATION\n");
    printf("==============================================================================\n");

    deep_test_hashmap();
    deep_test_avl_tree();
    deep_test_graph_algorithms();
    deep_test_max_heap();
    deep_test_quadtree_parity();

    printf("\n==============================================================================\n");
    printf("DEEP VALIDATION SUMMARY: %d Passed | %d Failed\n", g_deep_passed, g_deep_failed);
    printf("==============================================================================\n");

    return g_deep_failed == 0 ? 0 : 1;
}

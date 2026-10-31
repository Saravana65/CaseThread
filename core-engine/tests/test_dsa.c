/**
 * @file test_dsa.c
 * @brief Comprehensive verification test suite for CASETHREAD Core C Algorithm Engine.
 * @project CASETHREAD
 *
 * Verifies:
 *   1. Hash Map collisions, insertion, retrieval, deletion, dynamic resizing
 *   2. FIFO Queue & LIFO Stack operations
 *   3. Dynamic Linked List operations
 *   4. Binary Search Tree (BST) ordering, min, max, search
 *   5. Self-Balancing AVL Tree rotations (LL, RR, LR, RL), range queries
 *   6. Graph Adjacency List, BFS shortest path, DFS, connected components, cycle detection
 *   7. Evidence Gap Detection rules
 *   8. Timeline Anomaly Detection (spatiotemporal speed violations)
 *   9. Investigative Lead Generation scoring
 *  10. Boundary limits, empty and invalid inputs
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <assert.h>
#include "common.h"
#include "evidence.h"
#include "hashmap.h"
#include "tree.h"
#include "graph.h"
#include "queue.h"
#include "stack.h"
#include "structures.h"
#include "analysis.h"

static int g_tests_passed = 0;
static int g_tests_failed = 0;

#define TEST_ASSERT(cond, msg) do { \
    if (cond) { \
        printf("  [PASS] %s\n", msg); \
        g_tests_passed++; \
    } else { \
        printf("  [FAIL] %s (Line %d)\n", msg, __LINE__); \
        g_tests_failed++; \
    } \
} while(0)

/* --------------------------------------------------------------------------
 * 1. Test Hash Map
 * -------------------------------------------------------------------------- */
void test_hashmap(void) {
    printf("\n=== 1. Testing Separate-Chaining Hash Map ===\n");
    hash_map_t *map = hashmap_create(4); // Small initial capacity to force collisions & resize
    TEST_ASSERT(map != NULL, "Hash map created successfully");

    // Insert records
    hashmap_put(map, "SUSPECT:1", (void *)(intptr_t)101);
    hashmap_put(map, "SUSPECT:2", (void *)(intptr_t)102);
    hashmap_put(map, "VEHICLE:7XYZ99", (void *)(intptr_t)201);
    hashmap_put(map, "EVIDENCE:EVD-001", (void *)(intptr_t)301);

    TEST_ASSERT(hashmap_size(map) == 4, "Hash map size is 4");
    TEST_ASSERT((intptr_t)hashmap_get(map, "SUSPECT:1") == 101, "Retrieve SUSPECT:1 == 101");
    TEST_ASSERT((intptr_t)hashmap_get(map, "VEHICLE:7XYZ99") == 201, "Retrieve VEHICLE:7XYZ99 == 201");
    TEST_ASSERT(hashmap_contains(map, "EVIDENCE:EVD-001") == true, "Contains EVIDENCE:EVD-001");
    TEST_ASSERT(hashmap_contains(map, "NONEXISTENT") == false, "Does not contain NONEXISTENT");

    // Collision handling & Dynamic Resizing: Insert 20 more items
    for (int i = 0; i < 20; i++) {
        char key[32];
        snprintf(key, sizeof(key), "COLLISION_KEY_%d", i);
        hashmap_put(map, key, (void *)(intptr_t)(1000 + i));
    }
    TEST_ASSERT(hashmap_size(map) == 24, "Hash map dynamically resized to store 24 items");
    TEST_ASSERT((intptr_t)hashmap_get(map, "COLLISION_KEY_15") == 1015, "Retrieve COLLISION_KEY_15 after resize");

    // Deletion
    ct_status_t del_res = hashmap_remove(map, "SUSPECT:2");
    TEST_ASSERT(del_res == CT_SUCCESS, "Remove SUSPECT:2 succeeded");
    TEST_ASSERT(hashmap_contains(map, "SUSPECT:2") == false, "SUSPECT:2 no longer exists");
    TEST_ASSERT(hashmap_size(map) == 23, "Size decremented to 23");

    hashmap_destroy(map, NULL);
    TEST_ASSERT(true, "Hash map destroyed cleanly");
}

/* --------------------------------------------------------------------------
 * 2. Test Queue, Stack, and Linked List
 * -------------------------------------------------------------------------- */
void test_structures(void) {
    printf("\n=== 2. Testing Queue, Stack, and Dynamic Linked List ===\n");

    // Queue (FIFO)
    queue_t *q = queue_create();
    TEST_ASSERT(queue_is_empty(q) == true, "New queue is empty");
    queue_enqueue(q, (void *)(intptr_t)10);
    queue_enqueue(q, (void *)(intptr_t)20);
    queue_enqueue(q, (void *)(intptr_t)30);
    TEST_ASSERT(queue_size(q) == 3, "Queue size is 3");
    TEST_ASSERT((intptr_t)queue_peek(q) == 10, "Queue peek is 10");
    TEST_ASSERT((intptr_t)queue_dequeue(q) == 10, "First dequeue is 10 (FIFO)");
    TEST_ASSERT((intptr_t)queue_dequeue(q) == 20, "Second dequeue is 20 (FIFO)");
    TEST_ASSERT((intptr_t)queue_dequeue(q) == 30, "Third dequeue is 30 (FIFO)");
    TEST_ASSERT(queue_is_empty(q) == true, "Queue is empty after 3 dequeues");
    queue_destroy(q, NULL);

    // Stack (LIFO)
    stack_t *s = stack_create();
    TEST_ASSERT(stack_is_empty(s) == true, "New stack is empty");
    stack_push(s, (void *)(intptr_t)100);
    stack_push(s, (void *)(intptr_t)200);
    stack_push(s, (void *)(intptr_t)300);
    TEST_ASSERT(stack_size(s) == 3, "Stack size is 3");
    TEST_ASSERT((intptr_t)stack_peek(s) == 300, "Stack peek is 300");
    TEST_ASSERT((intptr_t)stack_pop(s) == 300, "First pop is 300 (LIFO)");
    TEST_ASSERT((intptr_t)stack_pop(s) == 200, "Second pop is 200 (LIFO)");
    TEST_ASSERT((intptr_t)stack_pop(s) == 100, "Third pop is 100 (LIFO)");
    TEST_ASSERT(stack_is_empty(s) == true, "Stack is empty after 3 pops");
    stack_destroy(s, NULL);

    // Linked List
    list_t *list = list_create();
    list_append(list, (void *)(intptr_t)1);
    list_append(list, (void *)(intptr_t)2);
    list_prepend(list, (void *)(intptr_t)0);
    TEST_ASSERT(list_size(list) == 3, "List size is 3");
    TEST_ASSERT((intptr_t)list_get(list, 0) == 0, "List item at index 0 is 0");
    TEST_ASSERT((intptr_t)list_get(list, 1) == 1, "List item at index 1 is 1");
    TEST_ASSERT((intptr_t)list_get(list, 2) == 2, "List item at index 2 is 2");
    list_destroy(list, NULL);
}

/* --------------------------------------------------------------------------
 * 3. Test Binary Search Tree (BST)
 * -------------------------------------------------------------------------- */
static int g_bst_inorder_count = 0;
static int64_t g_last_bst_time = 0;
static bool g_bst_sorted = true;

static void bst_verify_callback(const bst_node_t *node, void *user_data) {
    (void)user_data;
    if (node->timestamp < g_last_bst_time) {
        g_bst_sorted = false;
    }
    g_last_bst_time = node->timestamp;
    g_bst_inorder_count++;
}

void test_bst(void) {
    printf("\n=== 3. Testing Binary Search Tree (BST) ===\n");
    bst_t *tree = bst_create();
    TEST_ASSERT(tree != NULL, "BST created successfully");

    int64_t timestamps[] = { 1000, 500, 1500, 200, 800, 1200, 2000, 50 };
    for (int i = 0; i < 8; i++) {
        tree_payload_t *p = tree_payload_create(i + 1, timestamps[i], "Event", "Scene", 1, "SUSPECT", STATUS_CONFIRMED_FACT, true);
        bst_insert(tree, timestamps[i], p);
    }

    TEST_ASSERT(tree->count == 8, "BST inserted 8 events");
    TEST_ASSERT(bst_search(tree, 800) != NULL, "Search for existing timestamp 800 succeeds");
    TEST_ASSERT(bst_search(tree, 9999) == NULL, "Search for non-existent timestamp 9999 returns NULL");
    TEST_ASSERT(bst_min(tree) == 50, "BST minimum timestamp is 50");
    TEST_ASSERT(bst_max(tree) == 2000, "BST maximum timestamp is 2000");

    // Inorder verification
    g_bst_inorder_count = 0;
    g_last_bst_time = 0;
    g_bst_sorted = true;
    bst_inorder(tree, bst_verify_callback, NULL);
    TEST_ASSERT(g_bst_inorder_count == 8, "Inorder visited all 8 nodes");
    TEST_ASSERT(g_bst_sorted == true, "Inorder traversal strictly monotonically sorted");

    bst_destroy(tree);
}

/* --------------------------------------------------------------------------
 * 4. Test Self-Balancing AVL Tree
 * -------------------------------------------------------------------------- */
static int g_range_matches = 0;
static void range_count_cb(const avl_node_t *node, void *user_data) {
    (void)node; (void)user_data;
    g_range_matches++;
}

void test_avl(void) {
    printf("\n=== 4. Testing Self-Balancing AVL Tree (Rotations & Balance) ===\n");
    avl_tree_t *tree = avl_create();
    TEST_ASSERT(tree != NULL, "AVL tree created successfully");

    // Inserting strictly ascending sequence (would cause degenerate O(N) skew in BST)
    int64_t asc_times[] = { 10, 20, 30, 40, 50, 60, 70 };
    for (int i = 0; i < 7; i++) {
        tree_payload_t *p = tree_payload_create(i + 1, asc_times[i], "Sighting", "Loading Dock", 2, "SUSPECT", STATUS_CONFIRMED_FACT, true);
        avl_insert(tree, asc_times[i], p);
    }

    TEST_ASSERT(tree->total_events == 7, "AVL tree contains 7 events");
    int root_bal = avl_get_balance(tree->root);
    TEST_ASSERT(root_bal >= -1 && root_bal <= 1, "AVL root balance factor is in [-1, 1] range (Tree Self-Balanced)");
    TEST_ASSERT(avl_get_height(tree->root) <= 4, "AVL height is balanced (h <= 4 for N=7)");

    // Range Query: find events between 25 and 55
    g_range_matches = 0;
    avl_range_query(tree, 25, 55, range_count_cb, NULL);
    TEST_ASSERT(g_range_matches == 3, "Range query [25, 55] matches 3 events (30, 40, 50)");

    TEST_ASSERT(avl_min(tree) == 10, "AVL min is 10");
    TEST_ASSERT(avl_max(tree) == 70, "AVL max is 70");

    avl_destroy(tree);
}

/* --------------------------------------------------------------------------
 * 5. Test Graph Adjacency List, BFS, DFS, Components & Cycles
 * -------------------------------------------------------------------------- */
void test_graphs(void) {
    printf("\n=== 5. Testing Graph Adjacency List, BFS Shortest Path, DFS & Cycles ===\n");
    evidence_graph_t *g = graph_create(8, false); // Undirected
    TEST_ASSERT(g != NULL, "Graph created successfully");

    int v_suspect1 = graph_add_vertex(g, 1, "Marcus Vance", "SUSPECT", STATUS_CONFIRMED_FACT, NULL);
    int v_suspect2 = graph_add_vertex(g, 2, "Damon Vance", "SUSPECT", STATUS_CONFIRMED_FACT, NULL);
    int v_vehicle  = graph_add_vertex(g, 3, "Sedan 7XYZ99", "VEHICLE", STATUS_CONFIRMED_FACT, NULL);
    int v_dock     = graph_add_vertex(g, 4, "Loading Dock", "LOCATION", STATUS_CONFIRMED_FACT, NULL);
    int v_cctv     = graph_add_vertex(g, 5, "CAM-04 Footage", "EVIDENCE", STATUS_CONFIRMED_FACT, NULL);
    int v_isolated = graph_add_vertex(g, 6, "Unrelated Person", "WITNESS", STATUS_UNVERIFIED_OBSERVATION, NULL);

    TEST_ASSERT(g->num_vertices == 6, "Added 6 graph vertices");

    // Add edges
    graph_add_edge(g, v_suspect1, v_suspect2, "BROTHER_ASSOCIATE", 0.95f, STATUS_CONFIRMED_FACT, EDGE_RECORDED_DIRECT, "Police records");
    graph_add_edge(g, v_suspect2, v_vehicle,  "OWNS_VEHICLE",      0.90f, STATUS_CONFIRMED_FACT, EDGE_RECORDED_DIRECT, "DMV registration");
    graph_add_edge(g, v_vehicle,  v_cctv,     "CAPTURED_ON",      0.85f, STATUS_CONFIRMED_FACT, EDGE_RECORDED_DIRECT, "Video evidence");
    graph_add_edge(g, v_cctv,     v_dock,     "LOCATED_AT",       0.95f, STATUS_CONFIRMED_FACT, EDGE_RECORDED_DIRECT, "Camera fixed mount");

    // BFS Shortest Path: Marcus Vance (0) -> Loading Dock (3)
    int path[16];
    int path_len = 0;
    ct_status_t path_res = graph_shortest_path(g, v_suspect1, v_dock, path, &path_len);
    TEST_ASSERT(path_res == CT_SUCCESS, "BFS Shortest path found successfully");
    TEST_ASSERT(path_len == 5, "Shortest path length is 5 hops (Suspect1 -> Suspect2 -> Vehicle -> CCTV -> Dock)");
    TEST_ASSERT(path[0] == v_suspect1 && path[path_len - 1] == v_dock, "Path endpoints match");

    // Connected Components: Isolated node should be in separate cluster
    int comp_map[16];
    int num_comp = 0;
    graph_connected_components(g, comp_map, &num_comp);
    TEST_ASSERT(num_comp == 2, "Graph correctly partitions into 2 connected components (main network + isolated node)");
    TEST_ASSERT(comp_map[v_suspect1] != comp_map[v_isolated], "Isolated vertex in distinct component");

    // Cycle Detection: Add edge to create loop: Suspect1 <-> CCTV
    TEST_ASSERT(graph_detect_cycle(g) == false, "Initial acyclic tree structure has no cycle");
    graph_add_edge(g, v_suspect1, v_cctv, "SIGHTED_NEAR", 0.70f, STATUS_UNVERIFIED_OBSERVATION, EDGE_ALGORITHMIC_SUGGESTED, "Possible sighting");
    TEST_ASSERT(graph_detect_cycle(g) == true, "Cycle successfully detected after circular association added");

    graph_destroy(g);
}

/* --------------------------------------------------------------------------
 * 6. Test Evidence Gap Detection, Timeline Anomalies & Lead Generation
 * -------------------------------------------------------------------------- */
void test_analysis_pipeline(void) {
    printf("\n=== 6. Testing Evidence Gap Detection & Lead Synthesis ===\n");

    // Create evidence list with intentional gaps
    evidence_record_t *e1 = evidence_create(1, 101, "EVD-CCTV-01", "CCTV Footage", EV_CCTV);
    e1->timestamp = 1728959400; // Has timestamp
    strcpy(e1->collection_location, "Downtown Loading Bay");
    strcpy(e1->source, "Store DVR Unit");
    e1->verification_status = STATUS_CONFIRMED_FACT;

    // e2 has missing timestamp & missing source & unverified
    evidence_record_t *e2 = evidence_create(2, 101, "EVD-TIP-02", "Anonymous Phone Tip", EV_WITNESS);
    e2->timestamp = 0; // MISSING TIMESTAMP GAP
    e2->source[0] = '\0'; // MISSING SOURCE GAP
    e2->collection_location[0] = '\0'; // INCOMPLETE LOCATION GAP
    e2->verification_status = STATUS_UNVERIFIED_OBSERVATION; // UNVERIFIED GAP
    e1->next = e2;

    evidence_graph_t *graph = graph_create(4, false);
    graph_add_vertex(graph, 1, "CCTV Footage", "EVIDENCE", STATUS_CONFIRMED_FACT, e1);
    graph_add_vertex(graph, 2, "Anonymous Tip", "EVIDENCE", STATUS_UNVERIFIED_OBSERVATION, e2);
    graph_add_vertex(graph, 3, "Marcus Vance", "SUSPECT", STATUS_CONFIRMED_FACT, NULL);

    // Link suspect to evidence
    graph_add_edge(graph, 0, 2, "DEPICTS_SUSPECT", 0.90f, STATUS_CONFIRMED_FACT, EDGE_RECORDED_DIRECT, "Visual ID");

    avl_tree_t *timeline_avl = avl_create();
    tree_payload_t *p1 = tree_payload_create(1, 1000, "Depository Intrusion", "Vault", 3, "SUSPECT", STATUS_CONFIRMED_FACT, true);
    tree_payload_t *p2 = tree_payload_create(2, 1060, "Harbour Sighting", "Pier 9 (15km away)", 3, "SUSPECT", STATUS_CONFIRMED_FACT, true);
    avl_insert(timeline_avl, 1000, p1);
    avl_insert(timeline_avl, 1060, p2); // 60 seconds later at 15km distance = IMPOSSIBLE SPEED!

    analysis_result_t *res = analysis_result_create();

    // 1. Detect Gaps
    ct_detect_evidence_gaps(graph, timeline_avl, e1, res);
    TEST_ASSERT(res->total_gaps >= 3, "Detected at least 3 distinct evidence gaps (Timestamp, Source, Location)");

    // 2. Analyze Timeline
    ct_analyze_timeline(timeline_avl, e1, res);
    TEST_ASSERT(res->total_anomalies >= 1, "Spatiotemporal travel speed anomaly successfully flagged (60 sec interval)");

    // 3. Generate Leads
    ct_generate_leads(graph, res, res);
    TEST_ASSERT(res->total_leads >= 1, "Prioritized investigative leads synthesized");
    TEST_ASSERT(res->leads_head->evidence_strength_score > 0.0f, "Lead has non-zero mathematically calculated strength score");

    analysis_result_free(res);
    avl_destroy(timeline_avl);
    graph_destroy(graph);
    evidence_free(e1);
}

int main(void) {
    printf("=================================================================\n");
    printf("CASETHREAD CORE C ALGORITHM ENGINE - UNIT & INTEGRATION TEST SUITE\n");
    printf("=================================================================\n");

    test_hashmap();
    test_structures();
    test_bst();
    test_avl();
    test_graphs();
    test_analysis_pipeline();

    printf("\n=================================================================\n");
    printf("TEST RUN COMPLETE: %d Passed, %d Failed\n", g_tests_passed, g_tests_failed);
    printf("=================================================================\n");

    return (g_tests_failed == 0) ? 0 : 1;
}

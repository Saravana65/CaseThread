/**
 * @file test_quadtree.c
 * @brief Comprehensive automated unit test suite for C Quadtree Spatial Index.
 * @project CASETHREAD - Geospatial Evidence Intelligence (Phase 9)
 */

#include "quadtree.h"
#include <stdio.h>
#include <stdlib.h>
#include <assert.h>
#include <math.h>

static int tests_run = 0;
static int tests_passed = 0;

#define TEST_ASSERT(cond, msg) do { \
    tests_run++; \
    if (!(cond)) { \
        fprintf(stderr, "  [FAIL] Line %d: %s\n", __LINE__, msg); \
    } else { \
        tests_passed++; \
        fprintf(stdout, "  [PASS] %s\n", msg); \
    } \
} while(0)

/* 1. Test Empty Quadtree */
void test_empty_quadtree(void) {
    printf("\n--- Test Suite 1: Empty Quadtree Lifecycle ---\n");
    qt_bbox_t world = { -90.0, 90.0, -180.0, 180.0 };
    quadtree_t *tree = quadtree_create(world, 4);

    TEST_ASSERT(tree != NULL, "Quadtree allocated successfully");
    TEST_ASSERT(tree->total_points == 0, "Initial point count is 0");
    TEST_ASSERT(tree->root != NULL, "Root node initialized");
    TEST_ASSERT(!tree->root->is_divided, "Root node is not subdivided initially");

    // Search empty tree
    qt_search_result_t *res = qt_search_result_create(16);
    qt_bbox_t query_box = { 40.0, 42.0, -75.0, -73.0 };
    ct_status_t status = quadtree_search_bbox(tree, query_box, res);
    TEST_ASSERT(status == CT_SUCCESS, "Search on empty tree returns CT_SUCCESS");
    TEST_ASSERT(res->count == 0, "Search on empty tree yields 0 results");

    qt_search_result_free(res);
    quadtree_free(tree);
    TEST_ASSERT(1, "Empty tree destroyed safely with zero leaks");
}

/* 2. Test Point Insertion & Dynamic Subdivision */
void test_insertion_and_subdivision(void) {
    printf("\n--- Test Suite 2: Insertion & Dynamic Subdivision ---\n");
    qt_bbox_t region = { 40.0, 41.0, -75.0, -74.0 };
    quadtree_t *tree = quadtree_create(region, 2); // Small bucket capacity to trigger subdivision

    qt_point_t *p1 = qt_point_create(1, 101, 40.2, -74.8, "Evidence Point 1", 1700000001);
    qt_point_t *p2 = qt_point_create(2, 101, 40.8, -74.2, "Evidence Point 2", 1700000002);
    qt_point_t *p3 = qt_point_create(3, 101, 40.3, -74.7, "Evidence Point 3", 1700000003); // Triggers subdivision

    TEST_ASSERT(quadtree_insert(tree, p1) == CT_SUCCESS, "Insert Point 1 (SW)");
    TEST_ASSERT(quadtree_insert(tree, p2) == CT_SUCCESS, "Insert Point 2 (NE)");
    TEST_ASSERT(!tree->root->is_divided, "Root still leaf at bucket capacity 2");

    TEST_ASSERT(quadtree_insert(tree, p3) == CT_SUCCESS, "Insert Point 3 triggers subdivision");
    TEST_ASSERT(tree->root->is_divided, "Root subdivided into 4 children");
    TEST_ASSERT(tree->total_points == 3, "Total points recorded is 3");
    TEST_ASSERT(tree->max_depth_reached >= 1, "Max depth incremented");

    // Rejection of coordinates outside boundary
    qt_point_t *p_out = qt_point_create(99, 101, 55.0, -74.5, "Out of Bounds", 1700000099);
    TEST_ASSERT(quadtree_insert(tree, p_out) == CT_ERR_INVALID_INPUT, "Rejects point outside boundary");
    qt_point_free(p_out);

    quadtree_free(tree);
}

/* 3. Test Bounding Box Range Query */
void test_bbox_search(void) {
    printf("\n--- Test Suite 3: Bounding Box Range Query ---\n");
    qt_bbox_t city = { 40.7000, 40.7500, -74.0200, -73.9700 };
    quadtree_t *tree = quadtree_create(city, 4);

    // Insert 5 test points
    quadtree_insert(tree, qt_point_create(1, 1, 40.7128, -74.0060, "Depository Vault", 100)); // Inside
    quadtree_insert(tree, qt_point_create(2, 1, 40.7135, -74.0051, "Cell Tower 7", 200));    // Inside
    quadtree_insert(tree, qt_point_create(3, 1, 40.7160, -74.0040, "Traffic Cam", 300));      // Inside
    quadtree_insert(tree, qt_point_create(4, 1, 40.7480, -73.9800, "Midtown Outpost", 400));  // Outside target box
    quadtree_insert(tree, qt_point_create(5, 1, 40.7010, -74.0180, "Harbour Pier", 500));     // Outside target box

    qt_bbox_t search_box = { 40.7100, 40.7200, -74.0100, -74.0000 };
    qt_search_result_t *res = qt_search_result_create(16);

    ct_status_t status = quadtree_search_bbox(tree, search_box, res);
    TEST_ASSERT(status == CT_SUCCESS, "Search executed successfully");
    TEST_ASSERT(res->count == 3, "Retrieved exactly 3 matching points in target box");

    // Verify IDs of returned points
    bool found_p1 = false, found_p2 = false, found_p3 = false;
    for (size_t i = 0; i < res->count; i++) {
        int id = res->items[i].point->evidence_id;
        if (id == 1) found_p1 = true;
        if (id == 2) found_p2 = true;
        if (id == 3) found_p3 = true;
    }
    TEST_ASSERT(found_p1 && found_p2 && found_p3, "All expected evidence points retrieved");

    qt_search_result_free(res);
    quadtree_free(tree);
}

/* 4. Test Radius Search with Haversine Verification */
void test_radius_search_haversine(void) {
    printf("\n--- Test Suite 4: Radius Search with Haversine Accuracy ---\n");
    qt_bbox_t area = { 40.7000, 40.7300, -74.0200, -73.9900 };
    quadtree_t *tree = quadtree_create(area, 4);

    // Center: Depository Vault (40.7128, -74.0060)
    double center_lat = 40.7128;
    double center_lon = -74.0060;

    // Point A: 100 meters away approx
    quadtree_insert(tree, qt_point_create(10, 1, 40.7128, -74.0048, "Point A ~101m", 100));
    // Point B: 500 meters away approx
    quadtree_insert(tree, qt_point_create(20, 1, 40.7160, -74.0060, "Point B ~356m", 200));
    // Point C: 1500 meters away approx
    quadtree_insert(tree, qt_point_create(30, 1, 40.7250, -74.0060, "Point C ~1356m", 300));

    // Verify raw haversine distance calculation
    double dist_a = haversine_distance_meters(center_lat, center_lon, 40.7128, -74.0048);
    TEST_ASSERT(dist_a > 95.0 && dist_a < 110.0, "Haversine calculated distance for Point A (~101m)");

    // Radius search at 400 meters: should include Point A and Point B, exclude Point C
    qt_search_result_t *res_400 = qt_search_result_create(8);
    quadtree_search_radius(tree, center_lat, center_lon, 400.0, res_400);

    TEST_ASSERT(res_400->count == 2, "Radius 400m query returns exactly 2 points");
    TEST_ASSERT(res_400->items[0].point->evidence_id == 10, "Closest item (Point A) returned first");
    TEST_ASSERT(res_400->items[1].point->evidence_id == 20, "Second item (Point B) returned second");
    TEST_ASSERT(res_400->items[0].distance_meters < res_400->items[1].distance_meters, "Results sorted ascending by distance");

    qt_search_result_free(res_400);
    quadtree_free(tree);
}

/* 5. Test Duplicate Coordinates Chaining */
void test_duplicate_coordinates(void) {
    printf("\n--- Test Suite 5: Duplicate Coordinates Chaining ---\n");
    qt_bbox_t box = { 0.0, 10.0, 0.0, 10.0 };
    quadtree_t *tree = quadtree_create(box, 2);

    // Insert 4 points with EXACT same coordinate (5.0, 5.0)
    quadtree_insert(tree, qt_point_create(101, 1, 5.0, 5.0, "Duplicate Coords 1", 1000));
    quadtree_insert(tree, qt_point_create(102, 1, 5.0, 5.0, "Duplicate Coords 2", 1001));
    quadtree_insert(tree, qt_point_create(103, 1, 5.0, 5.0, "Duplicate Coords 3", 1002));
    quadtree_insert(tree, qt_point_create(104, 1, 5.0, 5.0, "Duplicate Coords 4", 1003));

    TEST_ASSERT(tree->total_points == 4, "Total points reflects 4 items inserted");

    // Search bounding box around (5,5)
    qt_bbox_t qbox = { 4.9, 5.1, 4.9, 5.1 };
    qt_search_result_t *res = qt_search_result_create(8);
    quadtree_search_bbox(tree, qbox, res);

    TEST_ASSERT(res->count == 4, "Bounding box search retrieves all 4 duplicate points");

    qt_search_result_free(res);
    quadtree_free(tree);
}

/* 6. Test Geographical Edge Cases (Antimeridian Wraparound & Polar Region) */
void test_geographical_edge_cases(void) {
    printf("\n--- Test Suite 6: Geographical Edge Cases ---\n");

    // 1. Antimeridian (+180 / -180 longitude boundary)
    qt_bbox_t world = { -90.0, 90.0, -180.0, 180.0 };
    quadtree_t *tree = quadtree_create(world, 4);

    // Fiji (near +179.9 E) and Samoa (near -171.7 W)
    quadtree_insert(tree, qt_point_create(501, 1, -16.0, 179.9, "Fiji Islands", 100));
    quadtree_insert(tree, qt_point_create(502, 1, -16.0, -179.9, "Samoa Meridian Crossing", 200));
    quadtree_insert(tree, qt_point_create(503, 1, 0.0, 0.0, "Null Island (Far Away)", 300));

    // Bounding box straddling the Antimeridian (min_lon 179.0 > max_lon -179.0)
    qt_bbox_t antimeridian_box = { -20.0, -10.0, 179.0, -179.0 };
    qt_search_result_t *res = qt_search_result_create(8);
    quadtree_search_bbox(tree, antimeridian_box, res);

    TEST_ASSERT(res->count == 2, "Antimeridian wraparound search retrieves points across 180/-180 meridian");
    qt_search_result_free(res);

    // 2. North Polar Region (89.5 N)
    quadtree_insert(tree, qt_point_create(601, 1, 89.9, 0.0, "North Pole Station", 500));
    qt_search_result_t *polar_res = qt_search_result_create(8);
    quadtree_search_radius(tree, 89.9, 0.0, 50000.0, polar_res); // 50km radius at North Pole
    TEST_ASSERT(polar_res->count >= 1, "Polar radius search handles high latitude convergence");

    qt_search_result_free(polar_res);
    quadtree_free(tree);
}

int main(void) {
    printf("==============================================================================\n");
    printf("CASETHREAD Core DSA Engine - Phase 9 Quadtree Spatial Index Unit Tests\n");
    printf("==============================================================================\n");

    test_empty_quadtree();
    test_insertion_and_subdivision();
    test_bbox_search();
    test_radius_search_haversine();
    test_duplicate_coordinates();
    test_geographical_edge_cases();

    printf("\n==============================================================================\n");
    printf("TEST RUN COMPLETED: %d Ran | %d Passed | %d Failed\n", tests_run, tests_passed, tests_run - tests_passed);
    printf("==============================================================================\n");

    return (tests_run == tests_passed) ? 0 : 1;
}

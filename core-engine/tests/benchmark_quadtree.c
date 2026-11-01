/**
 * @file benchmark_quadtree.c
 * @brief Algorithmic performance benchmarking suite for C Quadtree Spatial Index.
 * @project CASETHREAD - Geospatial Evidence Intelligence (Phase 9)
 * 
 * Evaluates performance across N = 100, 500, 1000, 5000, 10000 synthetic geospatial points:
 * 1. Quadtree Point Insertion
 * 2. Quadtree Bounding Box Search
 * 3. Quadtree Radius Query (Haversine Filtered)
 * 4. Linear Scan Radius Query (Baseline comparison)
 * 5. Correctness assertion: Quadtree vs Linear Scan result parity
 * 
 * Produces genuine empirical metrics saved to core-engine/benchmarks/quadtree_benchmark_results.csv.
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdbool.h>
#include <stdint.h>
#include <math.h>

#ifdef _WIN32
#include <windows.h>
static double get_time_sec(void) {
    LARGE_INTEGER freq, count;
    QueryPerformanceFrequency(&freq);
    QueryPerformanceCounter(&count);
    return (double)count.QuadPart / (double)freq.QuadPart;
}
#else
#include <time.h>
static double get_time_sec(void) {
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return (double)ts.tv_sec + (double)ts.tv_nsec * 1e-9;
}
#endif

#include "quadtree.h"

static const int SCALES[] = { 100, 500, 1000, 5000, 10000 };
static const int NUM_SCALES = 5;

static FILE *g_csv = NULL;

static void record_csv(const char *op, int n, double avg_us, double min_us, double max_us, double ops_sec, const char *complexity) {
    if (g_csv) {
        fprintf(g_csv, "\"%s\",%d,%.2f,%.2f,%.2f,%.2f,\"%s\"\n",
                op, n, avg_us, min_us, max_us, ops_sec, complexity);
        fflush(g_csv);
    }
}

/* Linear Scan Radius Query Implementation for Baseline Comparison */
static size_t linear_scan_radius(const qt_point_t **points, size_t count, double center_lat, double center_lon, double radius_meters) {
    size_t matches = 0;
    for (size_t i = 0; i < count; i++) {
        const qt_point_t *pt = points[i];
        while (pt) {
            double d = haversine_distance_meters(center_lat, center_lon, pt->latitude, pt->longitude);
            if (d <= radius_meters + 1e-3) {
                matches++;
            }
            pt = pt->next_duplicate;
        }
    }
    return matches;
}

static void run_benchmarks(void) {
    printf("\n======================================================================================\n");
    printf("CASETHREAD PHASE 9: C QUADTREE VS LINEAR SCAN SPATIAL BENCHMARK\n");
    printf("======================================================================================\n");
    printf("%-24s | %-6s | %-12s | %-10s | %-10s | %-12s | %-10s\n",
           "Operation", "N", "Avg (us)", "Min (us)", "Max (us)", "Throughput", "Complexity");
    printf("--------------------------------------------------------------------------------------\n");

    qt_bbox_t world_boundary = { -90.0, 90.0, -180.0, 180.0 };

    for (int s = 0; s < NUM_SCALES; s++) {
        int n = SCALES[s];

        // Seed random generator deterministically
        srand(42 + n);

        // Generate N synthetic geospatial coordinates (centered on urban area 40.71, -74.00)
        qt_point_t **raw_points = (qt_point_t **)malloc(n * sizeof(qt_point_t *));
        for (int i = 0; i < n; i++) {
            double lat = 40.60 + ((double)rand() / (double)RAND_MAX) * 0.25; // [40.60, 40.85]
            double lon = -74.15 + ((double)rand() / (double)RAND_MAX) * 0.30; // [-74.15, -73.85]
            raw_points[i] = qt_point_create(i + 1, 1, lat, lon, "Synthetic Point", 1700000000 + i);
        }

        // -------------------------------------------------------------
        // 1. Benchmark: Quadtree Build / Insertion
        // -------------------------------------------------------------
        const int REPEAT_BUILDS = (n <= 1000) ? 50 : 10;
        double min_build = 1e9, max_build = 0, sum_build = 0;

        quadtree_t *tree = NULL;
        for (int r = 0; r < REPEAT_BUILDS; r++) {
            if (tree) quadtree_free(tree);
            tree = quadtree_create(world_boundary, 8);

            double t0 = get_time_sec();
            for (int i = 0; i < n; i++) {
                // For repeated builds, re-use or clone points
                qt_point_t *pt = qt_point_create(raw_points[i]->evidence_id, 1,
                                                 raw_points[i]->latitude, raw_points[i]->longitude,
                                                 raw_points[i]->label, raw_points[i]->timestamp);
                quadtree_insert(tree, pt);
            }
            double t1 = get_time_sec();
            double el_us = (t1 - t0) * 1e6;
            if (el_us < min_build) min_build = el_us;
            if (el_us > max_build) max_build = el_us;
            sum_build += el_us;
        }
        double avg_build = sum_build / REPEAT_BUILDS;
        double ops_build = (double)n / (avg_build * 1e-6);
        printf("%-24s | %-6d | %-12.2f | %-10.2f | %-10.2f | %-12.0f | O(N log N)\n",
               "Quadtree Build (All)", n, avg_build, min_build, max_build, ops_build);
        record_csv("Quadtree Build", n, avg_build, min_build, max_build, ops_build, "O(N log N)");

        // -------------------------------------------------------------
        // 2. Benchmark: Bounding Box Range Search
        // -------------------------------------------------------------
        qt_bbox_t test_box = { 40.70, 40.75, -74.05, -73.95 };
        const int REPEAT_QUERIES = 200;
        double min_bbox = 1e9, max_bbox = 0, sum_bbox = 0;

        for (int r = 0; r < REPEAT_QUERIES; r++) {
            qt_search_result_t *res = qt_search_result_create(64);
            double t0 = get_time_sec();
            quadtree_search_bbox(tree, test_box, res);
            double t1 = get_time_sec();
            double el_us = (t1 - t0) * 1e6;
            if (el_us < min_bbox) min_bbox = el_us;
            if (el_us > max_bbox) max_bbox = el_us;
            sum_bbox += el_us;
            qt_search_result_free(res);
        }
        double avg_bbox = sum_bbox / REPEAT_QUERIES;
        double ops_bbox = 1.0 / (avg_bbox * 1e-6);
        printf("%-24s | %-6d | %-12.2f | %-10.2f | %-10.2f | %-12.0f | O(log N + K)\n",
               "Quadtree BBox Search", n, avg_bbox, min_bbox, max_bbox, ops_bbox);
        record_csv("Quadtree BBox Query", n, avg_bbox, min_bbox, max_bbox, ops_bbox, "O(log N + K)");

        // -------------------------------------------------------------
        // 3. Benchmark: Quadtree Radius Search (Haversine Filtered)
        // -------------------------------------------------------------
        double center_lat = 40.7128;
        double center_lon = -74.0060;
        double radius_m = 2500.0; // 2.5 km radius

        double min_rad = 1e9, max_rad = 0, sum_rad = 0;
        size_t qt_matches = 0;

        for (int r = 0; r < REPEAT_QUERIES; r++) {
            qt_search_result_t *res = qt_search_result_create(64);
            double t0 = get_time_sec();
            quadtree_search_radius(tree, center_lat, center_lon, radius_m, res);
            double t1 = get_time_sec();
            double el_us = (t1 - t0) * 1e6;
            if (el_us < min_rad) min_rad = el_us;
            if (el_us > max_rad) max_rad = el_us;
            sum_rad += el_us;
            if (r == 0) qt_matches = res->count;
            qt_search_result_free(res);
        }
        double avg_rad = sum_rad / REPEAT_QUERIES;
        double ops_rad = 1.0 / (avg_rad * 1e-6);
        printf("%-24s | %-6d | %-12.2f | %-10.2f | %-10.2f | %-12.0f | O(log N + K)\n",
               "Quadtree Radius Query", n, avg_rad, min_rad, max_rad, ops_rad);
        record_csv("Quadtree Radius Query", n, avg_rad, min_rad, max_rad, ops_rad, "O(log N + K)");

        // -------------------------------------------------------------
        // 4. Benchmark: Linear Scan Radius Query (Baseline)
        // -------------------------------------------------------------
        double min_lin = 1e9, max_lin = 0, sum_lin = 0;
        size_t lin_matches = 0;

        for (int r = 0; r < REPEAT_QUERIES; r++) {
            double t0 = get_time_sec();
            size_t m = linear_scan_radius((const qt_point_t **)raw_points, n, center_lat, center_lon, radius_m);
            double t1 = get_time_sec();
            double el_us = (t1 - t0) * 1e6;
            if (el_us < min_lin) min_lin = el_us;
            if (el_us > max_lin) max_lin = el_us;
            sum_lin += el_us;
            if (r == 0) lin_matches = m;
        }
        double avg_lin = sum_lin / REPEAT_QUERIES;
        double ops_lin = 1.0 / (avg_lin * 1e-6);
        printf("%-24s | %-6d | %-12.2f | %-10.2f | %-10.2f | %-12.0f | O(N)\n",
               "Linear Scan Radius Query", n, avg_lin, min_lin, max_lin, ops_lin);
        record_csv("Linear Scan Radius Query", n, avg_lin, min_lin, max_lin, ops_lin, "O(N)");

        // 5. Correctness Assertion & Speedup
        double speedup = (avg_rad > 0) ? (avg_lin / avg_rad) : 1.0;
        printf(">> [N=%-5d] Correctness: %s (QT: %zu, Lin: %zu) | Quadtree Speedup: %.2fx\n\n",
               n, (qt_matches == lin_matches) ? "VERIFIED MATCH" : "DISCREPANCY",
               qt_matches, lin_matches, speedup);

        // Cleanup scale
        for (int i = 0; i < n; i++) {
            qt_point_free(raw_points[i]);
        }
        free(raw_points);
        if (tree) quadtree_free(tree);
    }
}

int main(void) {
    const char *csv_path = "benchmarks/quadtree_benchmark_results.csv";
    g_csv = fopen(csv_path, "w");
    if (g_csv) {
        fprintf(g_csv, "\"operation\",\"n\",\"avg_latency_us\",\"min_latency_us\",\"max_latency_us\",\"ops_per_second\",\"complexity\"\n");
    }

    run_benchmarks();

    if (g_csv) {
        fclose(g_csv);
        printf("Benchmark results saved to: %s\n", csv_path);
    }

    return 0;
}

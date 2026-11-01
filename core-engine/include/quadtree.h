/**
 * @file quadtree.h
 * @brief High-performance 2D Quadtree Spatial Index with Geodesic Haversine Filtering.
 * @project CASETHREAD - Geospatial Evidence Intelligence & Investigation Mapping
 * 
 * Complexity Specifications:
 *   - Point Insertion: Average O(log N), Worst O(D) where D is maximum tree depth
 *   - Bounding-Box Range Query: Average O(log N + K), Worst O(N) where K is matching points
 *   - Spatial Radius Query: Average O(log N + K) candidates via BBox + O(K) Haversine filters
 *   - Space Complexity: O(N) points and tree nodes
 */

#ifndef CASETHREAD_QUADTREE_H
#define CASETHREAD_QUADTREE_H

#include "common.h"
#include <math.h>

#define EARTH_RADIUS_METERS 6371008.8
#define DEFAULT_QT_BUCKET_CAPACITY 8
#define MAX_QT_DEPTH 24

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

/* 2D Geographical Bounding Box (WGS84 Coordinates) */
typedef struct {
    double min_lat;
    double max_lat;
    double min_lon;
    double max_lon;
} qt_bbox_t;

/* Geospatial Evidence Point Record */
typedef struct qt_point {
    int evidence_id;
    int case_id;
    int entity_id;
    char entity_type[32];          /* "EVIDENCE", "SUSPECT", "CCTV", "VEHICLE" */
    char label[MAX_LABEL_LEN];     /* Location or evidence label */
    double latitude;               /* -90.0 to +90.0 */
    double longitude;              /* -180.0 to +180.0 */
    double altitude;               /* Elevation in meters */
    double accuracy_meters;        /* GPS precision radius */
    int64_t timestamp;             /* Unix epoch in seconds */
    char source[64];               /* "EXIF_GPS", "OFFICER_ENTERED", "CCTV_RECORD", etc. */
    char verification_status[32];  /* "CONFIRMED_FACT", "UNVERIFIED_OBSERVATION", "HYPOTHESIS" */
    struct qt_point *next_duplicate; /* Chained duplicate coordinates */
} qt_point_t;

/* Search Result Item (Point + Calculated Haversine Distance) */
typedef struct {
    const qt_point_t *point;
    double distance_meters;
} qt_result_item_t;

/* Dynamic Search Results Container */
typedef struct {
    qt_result_item_t *items;
    size_t count;
    size_t capacity;
} qt_search_result_t;

/* Quadtree Node */
typedef struct qt_node {
    qt_bbox_t boundary;
    qt_point_t **points;           /* Bucket array of pointers */
    size_t point_count;
    size_t bucket_capacity;
    size_t depth;
    bool is_divided;
    struct qt_node *nw;            /* Northwest: Lat >= mid, Lon < mid */
    struct qt_node *ne;            /* Northeast: Lat >= mid, Lon >= mid */
    struct qt_node *sw;            /* Southwest: Lat < mid, Lon < mid */
    struct qt_node *se;            /* Southeast: Lat < mid, Lon >= mid */
} qt_node_t;

/* Quadtree Master Container */
typedef struct {
    qt_node_t *root;
    size_t total_points;
    size_t bucket_capacity;
    size_t max_depth_reached;
} quadtree_t;

/* --- Geodesic Utilities --- */
double haversine_distance_meters(double lat1, double lon1, double lat2, double lon2);
bool qt_bbox_contains_point(const qt_bbox_t *box, double lat, double lon);
bool qt_bbox_intersects(const qt_bbox_t *a, const qt_bbox_t *b);
qt_bbox_t qt_bbox_from_radius(double center_lat, double center_lon, double radius_meters);

/* --- Lifecycle & Management --- */
quadtree_t* quadtree_create(qt_bbox_t boundary, size_t bucket_capacity);
qt_point_t* qt_point_create(int evidence_id, int case_id, double lat, double lon, const char *label, int64_t timestamp);
void qt_point_free(qt_point_t *point);

ct_status_t quadtree_insert(quadtree_t *tree, qt_point_t *point);
bool quadtree_remove(quadtree_t *tree, int evidence_id, double lat, double lon);
void quadtree_clear(quadtree_t *tree);
void quadtree_free(quadtree_t *tree);

/* --- Search Operations --- */
qt_search_result_t* qt_search_result_create(size_t initial_capacity);
void qt_search_result_free(qt_search_result_t *res);
ct_status_t qt_search_result_append(qt_search_result_t *res, const qt_point_t *pt, double distance_meters);

ct_status_t quadtree_search_bbox(const quadtree_t *tree, qt_bbox_t range, qt_search_result_t *out_result);
ct_status_t quadtree_search_radius(const quadtree_t *tree, double center_lat, double center_lon, double radius_meters, qt_search_result_t *out_result);

#endif /* CASETHREAD_QUADTREE_H */

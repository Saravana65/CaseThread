/**
 * @file quadtree.c
 * @brief Implementation of 2D Quadtree Spatial Index with Geodesic Haversine Distance.
 * @project CASETHREAD - Geospatial Evidence Intelligence & Investigation Mapping
 */

#include "quadtree.h"
#include <math.h>

#define DEG_TO_RAD(d) ((d) * (M_PI / 180.0))
#define RAD_TO_DEG(r) ((r) * (180.0 / M_PI))

/* --- Geodesic Utilities --- */

/**
 * Calculates great-circle Haversine distance in meters between two WGS84 coordinates.
 */
double haversine_distance_meters(double lat1, double lon1, double lat2, double lon2) {
    if (fabs(lat1 - lat2) < 1e-9 && fabs(lon1 - lon2) < 1e-9) {
        return 0.0;
    }

    double phi1 = DEG_TO_RAD(lat1);
    double phi2 = DEG_TO_RAD(lat2);
    double delta_phi = DEG_TO_RAD(lat2 - lat1);
    double delta_lambda = DEG_TO_RAD(lon2 - lon1);

    double sin_half_dphi = sin(delta_phi / 2.0);
    double sin_half_dlambda = sin(delta_lambda / 2.0);

    double a = sin_half_dphi * sin_half_dphi +
               cos(phi1) * cos(phi2) * (sin_half_dlambda * sin_half_dlambda);

    if (a < 0.0) a = 0.0;
    if (a > 1.0) a = 1.0;

    double c = 2.0 * atan2(sqrt(a), sqrt(1.0 - a));
    return EARTH_RADIUS_METERS * c;
}

/**
 * Checks if a bounding box contains a point (inclusive boundary).
 */
bool qt_bbox_contains_point(const qt_bbox_t *box, double lat, double lon) {
    if (!box) return false;
    return (lat >= box->min_lat - 1e-9 && lat <= box->max_lat + 1e-9 &&
            lon >= box->min_lon - 1e-9 && lon <= box->max_lon + 1e-9);
}

/**
 * Checks if two bounding boxes intersect.
 */
bool qt_bbox_intersects(const qt_bbox_t *a, const qt_bbox_t *b) {
    if (!a || !b) return false;
    if (a->max_lat < b->min_lat || a->min_lat > b->max_lat) return false;
    if (a->max_lon < b->min_lon || a->min_lon > b->max_lon) return false;
    return true;
}

/**
 * Derives a conservative bounding box from a center coordinate and radius in meters.
 * Handles polar convergence and latitude clamping.
 */
qt_bbox_t qt_bbox_from_radius(double center_lat, double center_lon, double radius_meters) {
    qt_bbox_t box;
    double delta_lat = RAD_TO_DEG(radius_meters / EARTH_RADIUS_METERS);
    box.min_lat = center_lat - delta_lat;
    box.max_lat = center_lat + delta_lat;

    if (box.min_lat < -90.0) box.min_lat = -90.0;
    if (box.max_lat > 90.0) box.max_lat = 90.0;

    double cos_lat = cos(DEG_TO_RAD(center_lat));
    if (fabs(cos_lat) < 0.001) {
        // Near North or South pole: span all longitudes
        box.min_lon = -180.0;
        box.max_lon = 180.0;
    } else {
        double delta_lon = RAD_TO_DEG(radius_meters / (EARTH_RADIUS_METERS * cos_lat));
        box.min_lon = center_lon - delta_lon;
        box.max_lon = center_lon + delta_lon;
        if (box.min_lon < -180.0) box.min_lon = -180.0;
        if (box.max_lon > 180.0) box.max_lon = 180.0;
    }

    return box;
}

/* --- Point Lifecycle --- */

qt_point_t* qt_point_create(int evidence_id, int case_id, double lat, double lon, const char *label, int64_t timestamp) {
    qt_point_t *pt = CT_ALLOC(qt_point_t);
    if (!pt) return NULL;

    pt->evidence_id = evidence_id;
    pt->case_id = case_id;
    pt->entity_id = 0;
    pt->latitude = lat;
    pt->longitude = lon;
    pt->altitude = 0.0;
    pt->accuracy_meters = 0.0;
    pt->timestamp = timestamp;
    pt->next_duplicate = NULL;

    strncpy(pt->entity_type, "EVIDENCE", sizeof(pt->entity_type) - 1);
    strncpy(pt->source, "OFFICER_ENTERED", sizeof(pt->source) - 1);
    strncpy(pt->verification_status, "CONFIRMED_FACT", sizeof(pt->verification_status) - 1);

    if (label) {
        strncpy(pt->label, label, sizeof(pt->label) - 1);
    }

    return pt;
}

void qt_point_free(qt_point_t *point) {
    while (point) {
        qt_point_t *next = point->next_duplicate;
        free(point);
        point = next;
    }
}

/* --- Node Management --- */

static qt_node_t* qt_node_create(qt_bbox_t boundary, size_t bucket_capacity, size_t depth) {
    qt_node_t *node = CT_ALLOC(qt_node_t);
    if (!node) return NULL;

    node->boundary = boundary;
    node->bucket_capacity = bucket_capacity;
    node->depth = depth;
    node->point_count = 0;
    node->is_divided = false;
    node->nw = node->ne = node->sw = node->se = NULL;

    node->points = (qt_point_t **)calloc(bucket_capacity, sizeof(qt_point_t *));
    if (!node->points) {
        free(node);
        return NULL;
    }

    return node;
}

static void qt_node_subdivide(qt_node_t *node) {
    if (!node || node->is_divided) return;

    double mid_lat = (node->boundary.min_lat + node->boundary.max_lat) / 2.0;
    double mid_lon = (node->boundary.min_lon + node->boundary.max_lon) / 2.0;
    size_t next_depth = node->depth + 1;
    size_t cap = node->bucket_capacity;

    qt_bbox_t nw_box = { mid_lat, node->boundary.max_lat, node->boundary.min_lon, mid_lon };
    qt_bbox_t ne_box = { mid_lat, node->boundary.max_lat, mid_lon, node->boundary.max_lon };
    qt_bbox_t sw_box = { node->boundary.min_lat, mid_lat, node->boundary.min_lon, mid_lon };
    qt_bbox_t se_box = { node->boundary.min_lat, mid_lat, mid_lon, node->boundary.max_lon };

    node->nw = qt_node_create(nw_box, cap, next_depth);
    node->ne = qt_node_create(ne_box, cap, next_depth);
    node->sw = qt_node_create(sw_box, cap, next_depth);
    node->se = qt_node_create(se_box, cap, next_depth);

    node->is_divided = true;
}

static qt_node_t* qt_get_child_quadrant(qt_node_t *node, double lat, double lon) {
    double mid_lat = (node->boundary.min_lat + node->boundary.max_lat) / 2.0;
    double mid_lon = (node->boundary.min_lon + node->boundary.max_lon) / 2.0;

    bool in_north = (lat >= mid_lat);
    bool in_east = (lon >= mid_lon);

    if (in_north && !in_east) return node->nw;
    if (in_north && in_east) return node->ne;
    if (!in_north && !in_east) return node->sw;
    return node->se;
}

static ct_status_t qt_node_insert(qt_node_t *node, qt_point_t *pt, size_t *max_depth) {
    if (!node || !pt) return CT_ERR_NULL_PTR;

    if (!qt_bbox_contains_point(&node->boundary, pt->latitude, pt->longitude)) {
        return CT_ERR_INVALID_INPUT;
    }

    if (node->depth > *max_depth) {
        *max_depth = node->depth;
    }

    if (!node->is_divided) {
        // 1. Check for duplicate coordinates with existing points in bucket
        for (size_t i = 0; i < node->point_count; i++) {
            qt_point_t *cur = node->points[i];
            if (fabs(cur->latitude - pt->latitude) < 1e-9 &&
                fabs(cur->longitude - pt->longitude) < 1e-9) {
                // Link into duplicate chain
                pt->next_duplicate = cur->next_duplicate;
                cur->next_duplicate = pt;
                return CT_SUCCESS;
            }
        }

        // 2. Insert into bucket if space remains or maximum depth reached
        if (node->point_count < node->bucket_capacity || node->depth >= MAX_QT_DEPTH) {
            node->points[node->point_count++] = pt;
            return CT_SUCCESS;
        }

        // 3. Bucket full: subdivide node and re-distribute existing points
        qt_node_subdivide(node);
        for (size_t i = 0; i < node->point_count; i++) {
            qt_point_t *p = node->points[i];
            qt_node_t *target = qt_get_child_quadrant(node, p->latitude, p->longitude);
            qt_node_insert(target, p, max_depth);
        }
        node->point_count = 0;
    }

    // Direct new point to appropriate quadrant child
    qt_node_t *target = qt_get_child_quadrant(node, pt->latitude, pt->longitude);
    return qt_node_insert(target, pt, max_depth);
}

static void qt_node_free(qt_node_t *node) {
    if (!node) return;

    if (node->is_divided) {
        qt_node_free(node->nw);
        qt_node_free(node->ne);
        qt_node_free(node->sw);
        qt_node_free(node->se);
    } else {
        for (size_t i = 0; i < node->point_count; i++) {
            qt_point_free(node->points[i]);
        }
    }

    if (node->points) {
        free(node->points);
    }
    free(node);
}

/* --- Quadtree Master Lifecycle --- */

quadtree_t* quadtree_create(qt_bbox_t boundary, size_t bucket_capacity) {
    quadtree_t *tree = CT_ALLOC(quadtree_t);
    if (!tree) return NULL;

    if (bucket_capacity == 0) {
        bucket_capacity = DEFAULT_QT_BUCKET_CAPACITY;
    }

    tree->bucket_capacity = bucket_capacity;
    tree->total_points = 0;
    tree->max_depth_reached = 0;
    tree->root = qt_node_create(boundary, bucket_capacity, 0);

    if (!tree->root) {
        free(tree);
        return NULL;
    }

    return tree;
}

ct_status_t quadtree_insert(quadtree_t *tree, qt_point_t *point) {
    if (!tree || !tree->root || !point) return CT_ERR_NULL_PTR;

    // Validate global coordinate bounds
    if (point->latitude < -90.0 || point->latitude > 90.0 ||
        point->longitude < -180.0 || point->longitude > 180.0) {
        return CT_ERR_INVALID_INPUT;
    }

    ct_status_t status = qt_node_insert(tree->root, point, &tree->max_depth_reached);
    if (status == CT_SUCCESS) {
        tree->total_points++;
    }
    return status;
}

void quadtree_clear(quadtree_t *tree) {
    if (!tree || !tree->root) return;
    qt_bbox_t b = tree->root->boundary;
    size_t cap = tree->bucket_capacity;

    qt_node_free(tree->root);
    tree->root = qt_node_create(b, cap, 0);
    tree->total_points = 0;
    tree->max_depth_reached = 0;
}

void quadtree_free(quadtree_t *tree) {
    if (!tree) return;
    if (tree->root) {
        qt_node_free(tree->root);
    }
    free(tree);
}

/* --- Search Operations --- */

qt_search_result_t* qt_search_result_create(size_t initial_capacity) {
    qt_search_result_t *res = CT_ALLOC(qt_search_result_t);
    if (!res) return NULL;

    if (initial_capacity == 0) initial_capacity = 16;
    res->items = (qt_result_item_t *)calloc(initial_capacity, sizeof(qt_result_item_t));
    if (!res->items) {
        free(res);
        return NULL;
    }

    res->count = 0;
    res->capacity = initial_capacity;
    return res;
}

void qt_search_result_free(qt_search_result_t *res) {
    if (!res) return;
    if (res->items) {
        free(res->items);
    }
    free(res);
}

ct_status_t qt_search_result_append(qt_search_result_t *res, const qt_point_t *pt, double distance_meters) {
    if (!res || !pt) return CT_ERR_NULL_PTR;

    if (res->count >= res->capacity) {
        size_t new_cap = res->capacity * 2;
        qt_result_item_t *expanded = (qt_result_item_t *)realloc(res->items, new_cap * sizeof(qt_result_item_t));
        if (!expanded) return CT_ERR_OUT_OF_MEMORY;
        res->items = expanded;
        res->capacity = new_cap;
    }

    res->items[res->count].point = pt;
    res->items[res->count].distance_meters = distance_meters;
    res->count++;
    return CT_SUCCESS;
}

static void qt_search_bbox_recursive(const qt_node_t *node, const qt_bbox_t *range, qt_search_result_t *out) {
    if (!node || !range || !out) return;

    if (!qt_bbox_intersects(&node->boundary, range)) {
        return;
    }

    if (node->is_divided) {
        qt_search_bbox_recursive(node->nw, range, out);
        qt_search_bbox_recursive(node->ne, range, out);
        qt_search_bbox_recursive(node->sw, range, out);
        qt_search_bbox_recursive(node->se, range, out);
    } else {
        for (size_t i = 0; i < node->point_count; i++) {
            const qt_point_t *cur = node->points[i];
            while (cur) {
                if (qt_bbox_contains_point(range, cur->latitude, cur->longitude)) {
                    qt_search_result_append(out, cur, 0.0);
                }
                cur = cur->next_duplicate;
            }
        }
    }
}

ct_status_t quadtree_search_bbox(const quadtree_t *tree, qt_bbox_t range, qt_search_result_t *out_result) {
    if (!tree || !tree->root || !out_result) return CT_ERR_NULL_PTR;

    // Handle Antimeridian Longitude Wraparound (min_lon > max_lon)
    if (range.min_lon > range.max_lon) {
        qt_bbox_t box_east = { range.min_lat, range.max_lat, range.min_lon, 180.0 };
        qt_bbox_t box_west = { range.min_lat, range.max_lat, -180.0, range.max_lon };
        qt_search_bbox_recursive(tree->root, &box_east, out_result);
        qt_search_bbox_recursive(tree->root, &box_west, out_result);
        return CT_SUCCESS;
    }

    qt_search_bbox_recursive(tree->root, &range, out_result);
    return CT_SUCCESS;
}

/**
 * Comparator to sort search results ascending by distance.
 */
static int compare_results_by_dist(const void *a, const void *b) {
    const qt_result_item_t *item_a = (const qt_result_item_t *)a;
    const qt_result_item_t *item_b = (const qt_result_item_t *)b;
    if (item_a->distance_meters < item_b->distance_meters) return -1;
    if (item_a->distance_meters > item_b->distance_meters) return 1;
    return 0;
}

ct_status_t quadtree_search_radius(const quadtree_t *tree, double center_lat, double center_lon, double radius_meters, qt_search_result_t *out_result) {
    if (!tree || !tree->root || !out_result) return CT_ERR_NULL_PTR;
    if (radius_meters < 0.0) return CT_ERR_INVALID_INPUT;

    // 1. Calculate conservative geographical bounding box for initial candidate pruning
    qt_bbox_t candidate_box = qt_bbox_from_radius(center_lat, center_lon, radius_meters);

    // 2. Retrieve coarse candidates via Quadtree bounding box traversal
    qt_search_result_t *candidates = qt_search_result_create(32);
    if (!candidates) return CT_ERR_OUT_OF_MEMORY;

    quadtree_search_bbox(tree, candidate_box, candidates);

    // 3. Filter candidates through exact geodesic Haversine distance
    for (size_t i = 0; i < candidates->count; i++) {
        const qt_point_t *pt = candidates->items[i].point;
        double dist = haversine_distance_meters(center_lat, center_lon, pt->latitude, pt->longitude);
        if (dist <= radius_meters + 1e-3) {
            qt_search_result_append(out_result, pt, dist);
        }
    }

    qt_search_result_free(candidates);

    // 4. Sort results ascending by calculated distance
    if (out_result->count > 1) {
        qsort(out_result->items, out_result->count, sizeof(qt_result_item_t), compare_results_by_dist);
    }

    return CT_SUCCESS;
}

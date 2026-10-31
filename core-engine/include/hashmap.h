/**
 * @file hashmap.h
 * @brief High-performance separate-chaining Hash Map for entity and evidence indexing.
 * @project CASETHREAD
 * 
 * TIME COMPLEXITY:
 *   - Insertion: O(1) average, O(n) worst case
 *   - Lookup:    O(1) average, O(n) worst case
 *   - Deletion:  O(1) average, O(n) worst case
 * SPACE COMPLEXITY:
 *   - O(n) where n is total indexed entries
 */

#ifndef CASETHREAD_HASHMAP_H
#define CASETHREAD_HASHMAP_H

#include "common.h"

typedef struct hash_entry {
    char *key;                 /* Null-terminated string key (e.g. "SUSPECT_1", "PLATE_7XYZ99") */
    void *value;               /* Generic pointer to entity or evidence data */
    struct hash_entry *next;   /* Next entry in separate chaining bucket */
} hash_entry_t;

typedef struct {
    hash_entry_t **buckets;    /* Array of bucket pointers */
    size_t capacity;           /* Current allocated capacity (power of 2) */
    size_t size;               /* Total entries stored */
    float load_factor_threshold; /* Default 0.75 for dynamic resize */
} hash_map_t;

/* Public API */
hash_map_t* hashmap_create(size_t initial_capacity);
ct_status_t hashmap_put(hash_map_t *map, const char *key, void *value);
void* hashmap_get(const hash_map_t *map, const char *key);
bool hashmap_contains(const hash_map_t *map, const char *key);
ct_status_t hashmap_remove(hash_map_t *map, const char *key);
size_t hashmap_size(const hash_map_t *map);
void hashmap_foreach(const hash_map_t *map, void (*callback)(const char *key, void *value, void *user_data), void *user_data);
void hashmap_destroy(hash_map_t *map, void (*free_value)(void *));
uint32_t hashmap_hash_djb2(const char *str);

#endif /* CASETHREAD_HASHMAP_H */

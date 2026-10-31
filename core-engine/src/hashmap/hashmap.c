/**
 * @file hashmap.c
 * @brief High-performance separate-chaining Hash Map implementation.
 * @project CASETHREAD - Evidence Gap Detection & Investigation Intelligence System
 *
 * TIME COMPLEXITY:
 *   - Insertion: O(1) average, O(N) worst case (all keys collide into single bucket)
 *   - Search:    O(1) average, O(N) worst case
 *   - Deletion:  O(1) average, O(N) worst case
 * SPACE COMPLEXITY:
 *   - O(capacity + N)
 */

#include "hashmap.h"

#define DEFAULT_CAPACITY 32
#define MAX_LOAD_FACTOR 0.75f

uint32_t hashmap_hash_djb2(const char *str) {
    if (!str) return 0;
    uint32_t hash = 5381;
    int c;
    while ((c = (unsigned char)*str++)) {
        hash = ((hash << 5) + hash) + c; /* hash * 33 + c */
    }
    return hash;
}

hash_map_t* hashmap_create(size_t initial_capacity) {
    size_t cap = initial_capacity ? initial_capacity : DEFAULT_CAPACITY;
    hash_map_t *map = (hash_map_t *)malloc(sizeof(hash_map_t));
    if (!map) return NULL;

    map->buckets = (hash_entry_t **)calloc(cap, sizeof(hash_entry_t *));
    if (!map->buckets) {
        free(map);
        return NULL;
    }

    map->capacity = cap;
    map->size = 0;
    map->load_factor_threshold = MAX_LOAD_FACTOR;
    return map;
}

static ct_status_t hashmap_resize(hash_map_t *map, size_t new_capacity) {
    hash_entry_t **new_buckets = (hash_entry_t **)calloc(new_capacity, sizeof(hash_entry_t *));
    if (!new_buckets) return CT_ERR_OUT_OF_MEMORY;

    for (size_t i = 0; i < map->capacity; i++) {
        hash_entry_t *entry = map->buckets[i];
        while (entry) {
            hash_entry_t *next = entry->next;
            uint32_t new_idx = hashmap_hash_djb2(entry->key) % new_capacity;

            entry->next = new_buckets[new_idx];
            new_buckets[new_idx] = entry;

            entry = next;
        }
    }

    free(map->buckets);
    map->buckets = new_buckets;
    map->capacity = new_capacity;
    return CT_SUCCESS;
}

ct_status_t hashmap_put(hash_map_t *map, const char *key, void *value) {
    if (!map || !key) return CT_ERR_NULL_PTR;

    // Check load factor and trigger resize if needed
    if ((float)(map->size + 1) / (float)map->capacity >= map->load_factor_threshold) {
        hashmap_resize(map, map->capacity * 2);
    }

    uint32_t idx = hashmap_hash_djb2(key) % map->capacity;
    hash_entry_t *curr = map->buckets[idx];

    // Check for existing key update
    while (curr) {
        if (strcmp(curr->key, key) == 0) {
            curr->value = value;
            return CT_SUCCESS;
        }
        curr = curr->next;
    }

    // Insert new bucket entry at chain head (O(1))
    hash_entry_t *new_entry = (hash_entry_t *)malloc(sizeof(hash_entry_t));
    if (!new_entry) return CT_ERR_OUT_OF_MEMORY;

    size_t key_len = strlen(key);
    new_entry->key = (char *)malloc(key_len + 1);
    if (!new_entry->key) {
        free(new_entry);
        return CT_ERR_OUT_OF_MEMORY;
    }
    memcpy(new_entry->key, key, key_len + 1);
    new_entry->value = value;
    new_entry->next = map->buckets[idx];
    map->buckets[idx] = new_entry;
    map->size++;

    return CT_SUCCESS;
}

void* hashmap_get(const hash_map_t *map, const char *key) {
    if (!map || !key || map->size == 0) return NULL;

    uint32_t idx = hashmap_hash_djb2(key) % map->capacity;
    hash_entry_t *curr = map->buckets[idx];

    while (curr) {
        if (strcmp(curr->key, key) == 0) {
            return curr->value;
        }
        curr = curr->next;
    }
    return NULL;
}

bool hashmap_contains(const hash_map_t *map, const char *key) {
    return hashmap_get(map, key) != NULL;
}

ct_status_t hashmap_remove(hash_map_t *map, const char *key) {
    if (!map || !key || map->size == 0) return CT_ERR_NOT_FOUND;

    uint32_t idx = hashmap_hash_djb2(key) % map->capacity;
    hash_entry_t *curr = map->buckets[idx];
    hash_entry_t *prev = NULL;

    while (curr) {
        if (strcmp(curr->key, key) == 0) {
            if (prev) {
                prev->next = curr->next;
            } else {
                map->buckets[idx] = curr->next;
            }
            free(curr->key);
            free(curr);
            map->size--;
            return CT_SUCCESS;
        }
        prev = curr;
        curr = curr->next;
    }
    return CT_ERR_NOT_FOUND;
}

size_t hashmap_size(const hash_map_t *map) {
    return map ? map->size : 0;
}

void hashmap_foreach(const hash_map_t *map, void (*callback)(const char *key, void *value, void *user_data), void *user_data) {
    if (!map || !callback) return;
    for (size_t i = 0; i < map->capacity; i++) {
        hash_entry_t *curr = map->buckets[i];
        while (curr) {
            callback(curr->key, curr->value, user_data);
            curr = curr->next;
        }
    }
}

void hashmap_destroy(hash_map_t *map, void (*free_value)(void *)) {
    if (!map) return;
    for (size_t i = 0; i < map->capacity; i++) {
        hash_entry_t *curr = map->buckets[i];
        while (curr) {
            hash_entry_t *next = curr->next;
            if (free_value && curr->value) {
                free_value(curr->value);
            }
            free(curr->key);
            free(curr);
            curr = next;
        }
    }
    free(map->buckets);
    free(map);
}

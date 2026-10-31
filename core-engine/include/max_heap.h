/**
 * @file max_heap.h
 * @brief Binary Max-Heap Priority Queue interface for investigative lead prioritization.
 * @project CASETHREAD - Evidence Gap Detection & Investigation Intelligence System
 *
 * TIME COMPLEXITY:
 *   - Insertion (heap_insert):        O(log N)
 *   - Extract Max (heap_extract_max): O(log N)
 *   - Peek Max (heap_peek_max):       O(1)
 *   - Heapify Up (heapify_up):        O(log N)
 *   - Heapify Down (heapify_down):    O(log N)
 *   - Creation / Destruction:         O(1) / O(N)
 * SPACE COMPLEXITY:
 *   - O(N) contiguous array storage
 *
 * MATHEMATICAL FOUNDATION:
 *   For an element at 0-based array index i:
 *     - Parent Index:       floor((i - 1) / 2)   (for i > 0)
 *     - Left Child Index:   2 * i + 1
 *     - Right Child Index:  2 * i + 2
 *   Max-Heap Invariant:
 *     priority(parent) >= priority(child) for every node.
 */

#ifndef CASETHREAD_MAX_HEAP_H
#define CASETHREAD_MAX_HEAP_H

#include "common.h"
#include <stdlib.h>
#include <stdbool.h>

#define HEAP_DEFAULT_CAPACITY 16

/* Element stored inside the Max-Heap */
typedef struct heap_element {
    float priority;             /* Priority score (higher value = higher priority) */
    void *data;                 /* Associated lead item or generic payload pointer */
} heap_element_t;

/* Array-based Binary Max-Heap */
typedef struct max_heap {
    heap_element_t *elements;   /* Contiguous dynamic array */
    size_t size;                /* Current number of elements in heap */
    size_t capacity;            /* Allocated element capacity */
} max_heap_t;

/* Max-Heap Lifecycle */
max_heap_t* heap_create(size_t initial_capacity);
void heap_destroy(max_heap_t *heap, void (*free_data_fn)(void *));

/* Core Heap Operations */
ct_status_t heap_insert(max_heap_t *heap, float priority, void *data);
void* heap_extract_max(max_heap_t *heap, float *out_priority);
void* heap_peek_max(const max_heap_t *heap, float *out_priority);

/* Sift Routines (Exposed for direct testing and modular usage) */
void heapify_up(max_heap_t *heap, size_t index);
void heapify_down(max_heap_t *heap, size_t index);

/* Heap Utility Queries */
size_t heap_size(const max_heap_t *heap);
bool heap_is_empty(const max_heap_t *heap);

#endif /* CASETHREAD_MAX_HEAP_H */

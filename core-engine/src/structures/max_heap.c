/**
 * @file max_heap.c
 * @brief Dynamic array-based Binary Max-Heap implementation for priority queue lead ranking.
 * @project CASETHREAD - Evidence Gap Detection & Investigation Intelligence System
 *
 * TIME COMPLEXITY:
 *   - Insertion (heap_insert):        O(log N)
 *   - Extract Max (heap_extract_max): O(log N)
 *   - Peek Max (heap_peek_max):       O(1)
 *   - Heapify Up / Down:              O(log N)
 * SPACE COMPLEXITY:
 *   - O(N) contiguous array storage
 */

#include "max_heap.h"

static inline void swap_elements(heap_element_t *a, heap_element_t *b) {
    heap_element_t temp = *a;
    *a = *b;
    *b = temp;
}

max_heap_t* heap_create(size_t initial_capacity) {
    size_t cap = (initial_capacity > 0) ? initial_capacity : HEAP_DEFAULT_CAPACITY;
    max_heap_t *heap = (max_heap_t *)malloc(sizeof(max_heap_t));
    if (!heap) {
        return NULL;
    }

    heap->elements = (heap_element_t *)malloc(cap * sizeof(heap_element_t));
    if (!heap->elements) {
        free(heap);
        return NULL;
    }

    heap->size = 0;
    heap->capacity = cap;
    return heap;
}

void heap_destroy(max_heap_t *heap, void (*free_data_fn)(void *)) {
    if (!heap) return;

    if (free_data_fn && heap->elements) {
        for (size_t i = 0; i < heap->size; i++) {
            if (heap->elements[i].data) {
                free_data_fn(heap->elements[i].data);
            }
        }
    }

    if (heap->elements) {
        free(heap->elements);
        heap->elements = NULL;
    }

    heap->size = 0;
    heap->capacity = 0;
    free(heap);
}

void heapify_up(max_heap_t *heap, size_t index) {
    if (!heap || index == 0 || index >= heap->size) return;

    size_t curr = index;
    while (curr > 0) {
        size_t parent = (curr - 1) / 2;
        if (heap->elements[curr].priority > heap->elements[parent].priority) {
            swap_elements(&heap->elements[curr], &heap->elements[parent]);
            curr = parent;
        } else {
            break;
        }
    }
}

void heapify_down(max_heap_t *heap, size_t index) {
    if (!heap || index >= heap->size) return;

    size_t curr = index;
    while (true) {
        size_t largest = curr;
        size_t left = 2 * curr + 1;
        size_t right = 2 * curr + 2;

        if (left < heap->size && heap->elements[left].priority > heap->elements[largest].priority) {
            largest = left;
        }
        if (right < heap->size && heap->elements[right].priority > heap->elements[largest].priority) {
            largest = right;
        }

        if (largest != curr) {
            swap_elements(&heap->elements[curr], &heap->elements[largest]);
            curr = largest;
        } else {
            break;
        }
    }
}

ct_status_t heap_insert(max_heap_t *heap, float priority, void *data) {
    if (!heap) return CT_ERR_INVALID_INPUT;

    // Dynamic capacity expansion
    if (heap->size >= heap->capacity) {
        size_t new_cap = (heap->capacity == 0) ? HEAP_DEFAULT_CAPACITY : heap->capacity * 2;
        heap_element_t *new_elements = (heap_element_t *)realloc(heap->elements, new_cap * sizeof(heap_element_t));
        if (!new_elements) {
            return CT_ERR_OUT_OF_MEMORY;
        }
        heap->elements = new_elements;
        heap->capacity = new_cap;
    }

    size_t insert_idx = heap->size;
    heap->elements[insert_idx].priority = priority;
    heap->elements[insert_idx].data = data;
    heap->size++;

    heapify_up(heap, insert_idx);
    return CT_SUCCESS;
}

void* heap_extract_max(max_heap_t *heap, float *out_priority) {
    if (!heap || heap->size == 0) {
        if (out_priority) *out_priority = 0.0f;
        return NULL;
    }

    void *max_data = heap->elements[0].data;
    if (out_priority) {
        *out_priority = heap->elements[0].priority;
    }

    // Move last element to root and sift down
    heap->size--;
    if (heap->size > 0) {
        heap->elements[0] = heap->elements[heap->size];
        heapify_down(heap, 0);
    }

    return max_data;
}

void* heap_peek_max(const max_heap_t *heap, float *out_priority) {
    if (!heap || heap->size == 0) {
        if (out_priority) *out_priority = 0.0f;
        return NULL;
    }

    if (out_priority) {
        *out_priority = heap->elements[0].priority;
    }
    return heap->elements[0].data;
}

size_t heap_size(const max_heap_t *heap) {
    return heap ? heap->size : 0;
}

bool heap_is_empty(const max_heap_t *heap) {
    return (!heap || heap->size == 0);
}

/**
 * @file queue.c
 * @brief Generic FIFO Queue implementation for Breadth-First Search (BFS) graph traversal.
 * @project CASETHREAD
 */

#include "queue.h"

queue_t* queue_create(void) {
    queue_t *q = (queue_t *)malloc(sizeof(queue_t));
    if (!q) return NULL;
    q->head = NULL;
    q->tail = NULL;
    q->size = 0;
    return q;
}

bool queue_enqueue(queue_t *q, void *data) {
    if (!q) return false;
    queue_node_t *node = (queue_node_t *)malloc(sizeof(queue_node_t));
    if (!node) return false;

    node->data = data;
    node->next = NULL;

    if (q->tail) {
        q->tail->next = node;
    } else {
        q->head = node;
    }
    q->tail = node;
    q->size++;
    return true;
}

void* queue_dequeue(queue_t *q) {
    if (!q || !q->head) return NULL;

    queue_node_t *node = q->head;
    void *data = node->data;

    q->head = node->next;
    if (!q->head) {
        q->tail = NULL;
    }
    free(node);
    q->size--;
    return data;
}

void* queue_peek(const queue_t *q) {
    if (!q || !q->head) return NULL;
    return q->head->data;
}

bool queue_is_empty(const queue_t *q) {
    return (!q || q->size == 0);
}

size_t queue_size(const queue_t *q) {
    return q ? q->size : 0;
}

void queue_destroy(queue_t *q, void (*free_fn)(void *)) {
    if (!q) return;
    queue_node_t *curr = q->head;
    while (curr) {
        queue_node_t *next = curr->next;
        if (free_fn && curr->data) {
            free_fn(curr->data);
        }
        free(curr);
        curr = next;
    }
    free(q);
}

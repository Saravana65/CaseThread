/**
 * @file queue.h
 * @brief Generic FIFO Queue implementation for Breadth-First Search (BFS) graph traversal.
 * @project CASETHREAD
 *
 * TIME COMPLEXITY:
 *   - Enqueue:  O(1)
 *   - Dequeue:  O(1)
 *   - Peek:     O(1)
 *   - IsEmpty:  O(1)
 * SPACE COMPLEXITY:
 *   - O(N) where N is number of queued elements
 */

#ifndef CASETHREAD_QUEUE_H
#define CASETHREAD_QUEUE_H

#include <stdbool.h>
#include <stdlib.h>

typedef struct queue_node {
    void *data;
    struct queue_node *next;
} queue_node_t;

typedef struct queue {
    queue_node_t *head;
    queue_node_t *tail;
    size_t size;
} queue_t;

queue_t* queue_create(void);
bool queue_enqueue(queue_t *q, void *data);
void* queue_dequeue(queue_t *q);
void* queue_peek(const queue_t *q);
bool queue_is_empty(const queue_t *q);
size_t queue_size(const queue_t *q);
void queue_destroy(queue_t *q, void (*free_fn)(void *));

#endif /* CASETHREAD_QUEUE_H */

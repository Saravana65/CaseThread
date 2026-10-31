/**
 * @file stack.h
 * @brief Generic LIFO Stack implementation for Depth-First Search (DFS) graph exploration.
 * @project CASETHREAD
 *
 * TIME COMPLEXITY:
 *   - Push:     O(1)
 *   - Pop:      O(1)
 *   - Peek:     O(1)
 *   - IsEmpty:  O(1)
 * SPACE COMPLEXITY:
 *   - O(N) where N is number of stacked elements
 */

#ifndef CASETHREAD_STACK_H
#define CASETHREAD_STACK_H

#include <stdbool.h>
#include <stdlib.h>

typedef struct stack_node {
    void *data;
    struct stack_node *next;
} stack_node_t;

typedef struct stack {
    stack_node_t *top;
    size_t size;
} stack_t;

stack_t* stack_create(void);
bool stack_push(stack_t *s, void *data);
void* stack_pop(stack_t *s);
void* stack_peek(const stack_t *s);
bool stack_is_empty(const stack_t *s);
size_t stack_size(const stack_t *s);
void stack_destroy(stack_t *s, void (*free_fn)(void *));

#endif /* CASETHREAD_STACK_H */

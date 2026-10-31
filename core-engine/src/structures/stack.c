/**
 * @file stack.c
 * @brief Generic LIFO Stack implementation for Depth-First Search (DFS) graph exploration.
 * @project CASETHREAD
 */

#include "stack.h"

stack_t* stack_create(void) {
    stack_t *s = (stack_t *)malloc(sizeof(stack_t));
    if (!s) return NULL;
    s->top = NULL;
    s->size = 0;
    return s;
}

bool stack_push(stack_t *s, void *data) {
    if (!s) return false;
    stack_node_t *node = (stack_node_t *)malloc(sizeof(stack_node_t));
    if (!node) return false;

    node->data = data;
    node->next = s->top;
    s->top = node;
    s->size++;
    return true;
}

void* stack_pop(stack_t *s) {
    if (!s || !s->top) return NULL;

    stack_node_t *node = s->top;
    void *data = node->data;
    s->top = node->next;
    free(node);
    s->size--;
    return data;
}

void* stack_peek(const stack_t *s) {
    if (!s || !s->top) return NULL;
    return s->top->data;
}

bool stack_is_empty(const stack_t *s) {
    return (!s || s->size == 0);
}

size_t stack_size(const stack_t *s) {
    return s ? s->size : 0;
}

void stack_destroy(stack_t *s, void (*free_fn)(void *)) {
    if (!s) return;
    stack_node_t *curr = s->top;
    while (curr) {
        stack_node_t *next = curr->next;
        if (free_fn && curr->data) {
            free_fn(curr->data);
        }
        free(curr);
        curr = next;
    }
    free(s);
}

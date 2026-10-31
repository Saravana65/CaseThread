/**
 * @file structures.h
 * @brief Common dynamic linked list interface used across CASETHREAD modules.
 * @project CASETHREAD
 */

#ifndef CASETHREAD_STRUCTURES_H
#define CASETHREAD_STRUCTURES_H

#include <stdlib.h>
#include <stdbool.h>

typedef struct list_node {
    void *data;
    struct list_node *next;
} list_node_t;

typedef struct list {
    list_node_t *head;
    list_node_t *tail;
    size_t size;
} list_t;

list_t* list_create(void);
bool list_append(list_t *list, void *data);
bool list_prepend(list_t *list, void *data);
void* list_get(const list_t *list, size_t index);
bool list_contains(const list_t *list, const void *data, bool (*equals)(const void *, const void *));
size_t list_size(const list_t *list);
void list_destroy(list_t *list, void (*free_fn)(void *));

#endif /* CASETHREAD_STRUCTURES_H */

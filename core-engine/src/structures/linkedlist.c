/**
 * @file linkedlist.c
 * @brief Generic dynamic singly-linked list implementation.
 * @project CASETHREAD
 */

#include "structures.h"

list_t* list_create(void) {
    list_t *list = (list_t *)malloc(sizeof(list_t));
    if (!list) return NULL;
    list->head = NULL;
    list->tail = NULL;
    list->size = 0;
    return list;
}

bool list_append(list_t *list, void *data) {
    if (!list) return false;
    list_node_t *node = (list_node_t *)malloc(sizeof(list_node_t));
    if (!node) return false;

    node->data = data;
    node->next = NULL;

    if (list->tail) {
        list->tail->next = node;
    } else {
        list->head = node;
    }
    list->tail = node;
    list->size++;
    return true;
}

bool list_prepend(list_t *list, void *data) {
    if (!list) return false;
    list_node_t *node = (list_node_t *)malloc(sizeof(list_node_t));
    if (!node) return false;

    node->data = data;
    node->next = list->head;
    list->head = node;
    if (!list->tail) {
        list->tail = node;
    }
    list->size++;
    return true;
}

void* list_get(const list_t *list, size_t index) {
    if (!list || index >= list->size) return NULL;
    list_node_t *curr = list->head;
    for (size_t i = 0; i < index && curr; i++) {
        curr = curr->next;
    }
    return curr ? curr->data : NULL;
}

bool list_contains(const list_t *list, const void *data, bool (*equals)(const void *, const void *)) {
    if (!list) return false;
    list_node_t *curr = list->head;
    while (curr) {
        if (equals) {
            if (equals(curr->data, data)) return true;
        } else {
            if (curr->data == data) return true;
        }
        curr = curr->next;
    }
    return false;
}

size_t list_size(const list_t *list) {
    return list ? list->size : 0;
}

void list_destroy(list_t *list, void (*free_fn)(void *)) {
    if (!list) return;
    list_node_t *curr = list->head;
    while (curr) {
        list_node_t *next = curr->next;
        if (free_fn && curr->data) {
            free_fn(curr->data);
        }
        free(curr);
        curr = next;
    }
    free(list);
}

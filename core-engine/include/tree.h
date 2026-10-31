/**
 * @file tree.h
 * @brief Binary Search Tree (BST) and Self-Balancing AVL Tree for chronological investigation analysis.
 * @project CASETHREAD
 * 
 * TIME & SPACE COMPLEXITIES:
 *   - BST Search/Insert/Delete: Average O(log N), Worst O(N) (skewed)
 *   - AVL Search/Insert/Delete: Guaranteed O(log N) due to strict balance factor [-1, 1]
 *   - Range Query [t1, t2]: O(log N + K) where K is matching items
 *   - Inorder Traversal: O(N) yielding chronologically sorted sequence
 *   - Space Complexity: O(N)
 */

#ifndef CASETHREAD_TREE_H
#define CASETHREAD_TREE_H

#include "common.h"
#include "evidence.h"

/* Common timeline payload attached to a tree node */
typedef struct tree_payload {
    int event_id;
    int64_t timestamp;             /* Unix epoch in seconds */
    char label[MAX_TITLE_LEN];
    char location[MAX_LOC_LEN];
    int entity_id;
    char entity_type[32];
    verification_status_t status;
    bool is_verified;
    void *custom_data;
    struct tree_payload *next;     /* Multi-event chaining for identical timestamps */
} tree_payload_t;

/* --------------------------------------------------------------------------
 * 1. Standard Binary Search Tree (BST)
 * -------------------------------------------------------------------------- */
typedef struct bst_node {
    int64_t timestamp;
    tree_payload_t *payload;
    struct bst_node *left;
    struct bst_node *right;
} bst_node_t;

typedef struct {
    bst_node_t *root;
    size_t count;
} bst_t;

/* BST API */
bst_t* bst_create(void);
ct_status_t bst_insert(bst_t *tree, int64_t timestamp, tree_payload_t *payload);
bst_node_t* bst_search(const bst_t *tree, int64_t timestamp);
int64_t bst_min(const bst_t *tree);
int64_t bst_max(const bst_t *tree);
void bst_inorder(const bst_t *tree, void (*callback)(const bst_node_t *node, void *user_data), void *user_data);
void bst_destroy(bst_t *tree);

/* --------------------------------------------------------------------------
 * 2. Self-Balancing AVL Tree
 * -------------------------------------------------------------------------- */
typedef struct avl_node {
    int64_t timestamp;
    tree_payload_t *payload;
    int height;                    /* Subtree height for balance factor maintenance */
    struct avl_node *left;
    struct avl_node *right;
} avl_node_t;

typedef struct {
    avl_node_t *root;
    size_t total_events;
} avl_tree_t;

/* AVL Tree API */
avl_tree_t* avl_create(void);
ct_status_t avl_insert(avl_tree_t *tree, int64_t timestamp, tree_payload_t *payload);
avl_node_t* avl_search(const avl_tree_t *tree, int64_t timestamp);
ct_status_t avl_range_query(const avl_tree_t *tree, int64_t start_time, int64_t end_time,
                            void (*callback)(const avl_node_t *node, void *user_data), void *user_data);
void avl_inorder(const avl_tree_t *tree, void (*callback)(const avl_node_t *node, void *user_data), void *user_data);
int64_t avl_min(const avl_tree_t *tree);
int64_t avl_max(const avl_tree_t *tree);
int avl_get_height(const avl_node_t *node);
int avl_get_balance(const avl_node_t *node);
void avl_destroy(avl_tree_t *tree);

/* Helper payload constructors */
tree_payload_t* tree_payload_create(int event_id, int64_t timestamp, const char *label, 
                                    const char *location, int entity_id, const char *entity_type,
                                    verification_status_t status, bool is_verified);
void tree_payload_free(tree_payload_t *payload);

#endif /* CASETHREAD_TREE_H */

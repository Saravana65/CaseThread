/**
 * @file bst.c
 * @brief Binary Search Tree (BST) implementation for chronological evidence ordering.
 * @project CASETHREAD
 *
 * TIME COMPLEXITY:
 *   - Search:  Average O(log N), Worst O(N) (unbalanced/skewed tree)
 *   - Insert:  Average O(log N), Worst O(N)
 *   - Min/Max: Average O(log N), Worst O(N)
 *   - Inorder: O(N) strictly sorted sequence
 * SPACE COMPLEXITY:
 *   - O(N)
 */

#include "tree.h"

bst_t* bst_create(void) {
    bst_t *tree = (bst_t *)malloc(sizeof(bst_t));
    if (!tree) return NULL;
    tree->root = NULL;
    tree->count = 0;
    return tree;
}

static bst_node_t* bst_create_node(int64_t timestamp, tree_payload_t *payload) {
    bst_node_t *node = (bst_node_t *)malloc(sizeof(bst_node_t));
    if (!node) return NULL;
    node->timestamp = timestamp;
    node->payload = payload;
    node->left = NULL;
    node->right = NULL;
    return node;
}

static bst_node_t* bst_insert_recursive(bst_node_t *root, int64_t timestamp, tree_payload_t *payload, bool *added) {
    if (!root) {
        *added = true;
        return bst_create_node(timestamp, payload);
    }

    if (timestamp < root->timestamp) {
        root->left = bst_insert_recursive(root->left, timestamp, payload, added);
    } else if (timestamp > root->timestamp) {
        root->right = bst_insert_recursive(root->right, timestamp, payload, added);
    } else {
        // Same timestamp: chain payload onto existing node linked list
        if (payload) {
            tree_payload_t *curr = root->payload;
            while (curr && curr->next) {
                curr = curr->next;
            }
            if (curr) {
                curr->next = payload;
            } else {
                root->payload = payload;
            }
            *added = true;
        }
    }
    return root;
}

ct_status_t bst_insert(bst_t *tree, int64_t timestamp, tree_payload_t *payload) {
    if (!tree) return CT_ERR_NULL_PTR;
    bool added = false;
    tree->root = bst_insert_recursive(tree->root, timestamp, payload, &added);
    if (added) {
        tree->count++;
        return CT_SUCCESS;
    }
    return CT_ERR_OUT_OF_MEMORY;
}

bst_node_t* bst_search(const bst_t *tree, int64_t timestamp) {
    if (!tree || !tree->root) return NULL;
    bst_node_t *curr = tree->root;
    while (curr) {
        if (timestamp == curr->timestamp) {
            return curr;
        } else if (timestamp < curr->timestamp) {
            curr = curr->left;
        } else {
            curr = curr->right;
        }
    }
    return NULL;
}

int64_t bst_min(const bst_t *tree) {
    if (!tree || !tree->root) return 0;
    bst_node_t *curr = tree->root;
    while (curr->left) {
        curr = curr->left;
    }
    return curr->timestamp;
}

int64_t bst_max(const bst_t *tree) {
    if (!tree || !tree->root) return 0;
    bst_node_t *curr = tree->root;
    while (curr->right) {
        curr = curr->right;
    }
    return curr->timestamp;
}

static void bst_inorder_recursive(const bst_node_t *root, void (*callback)(const bst_node_t *node, void *user_data), void *user_data) {
    if (!root) return;
    bst_inorder_recursive(root->left, callback, user_data);
    callback(root, user_data);
    bst_inorder_recursive(root->right, callback, user_data);
}

void bst_inorder(const bst_t *tree, void (*callback)(const bst_node_t *node, void *user_data), void *user_data) {
    if (!tree || !callback) return;
    bst_inorder_recursive(tree->root, callback, user_data);
}

static void bst_free_recursive(bst_node_t *root) {
    if (!root) return;
    bst_free_recursive(root->left);
    bst_free_recursive(root->right);
    tree_payload_free(root->payload);
    free(root);
}

void bst_destroy(bst_t *tree) {
    if (!tree) return;
    bst_free_recursive(tree->root);
    free(tree);
}

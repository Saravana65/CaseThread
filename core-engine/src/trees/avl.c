/**
 * @file avl.c
 * @brief Self-Balancing AVL Tree implementation with left/right rotations for strict O(log N) operations.
 * @project CASETHREAD
 *
 * TIME COMPLEXITY:
 *   - Search:      O(log N) guaranteed
 *   - Insertion:   O(log N) guaranteed (at most 2 rotations)
 *   - Range Query: O(log N + K) where K is number of incidents in interval
 *   - Inorder:     O(N) strictly sorted sequence
 * SPACE COMPLEXITY:
 *   - O(N)
 */

#include "tree.h"

static int max_val(int a, int b) {
    return (a > b) ? a : b;
}

int avl_get_height(const avl_node_t *node) {
    return node ? node->height : 0;
}

int avl_get_balance(const avl_node_t *node) {
    return node ? (avl_get_height(node->left) - avl_get_height(node->right)) : 0;
}

avl_tree_t* avl_create(void) {
    avl_tree_t *tree = (avl_tree_t *)malloc(sizeof(avl_tree_t));
    if (!tree) return NULL;
    tree->root = NULL;
    tree->total_events = 0;
    return tree;
}

static avl_node_t* avl_create_node(int64_t timestamp, tree_payload_t *payload) {
    avl_node_t *node = (avl_node_t *)malloc(sizeof(avl_node_t));
    if (!node) return NULL;
    node->timestamp = timestamp;
    node->payload = payload;
    node->height = 1;
    node->left = NULL;
    node->right = NULL;
    return node;
}

/* Right Rotation (LL Case) */
static avl_node_t* avl_rotate_right(avl_node_t *y) {
    avl_node_t *x = y->left;
    avl_node_t *T2 = x->right;

    x->right = y;
    y->left = T2;

    y->height = max_val(avl_get_height(y->left), avl_get_height(y->right)) + 1;
    x->height = max_val(avl_get_height(x->left), avl_get_height(x->right)) + 1;

    return x;
}

/* Left Rotation (RR Case) */
static avl_node_t* avl_rotate_left(avl_node_t *x) {
    avl_node_t *y = x->right;
    avl_node_t *T2 = y->left;

    y->left = x;
    x->right = T2;

    x->height = max_val(avl_get_height(x->left), avl_get_height(x->right)) + 1;
    y->height = max_val(avl_get_height(y->left), avl_get_height(y->right)) + 1;

    return y;
}

static avl_node_t* avl_insert_recursive(avl_node_t *node, int64_t timestamp, tree_payload_t *payload, bool *added) {
    if (!node) {
        *added = true;
        return avl_create_node(timestamp, payload);
    }

    if (timestamp < node->timestamp) {
        node->left = avl_insert_recursive(node->left, timestamp, payload, added);
    } else if (timestamp > node->timestamp) {
        node->right = avl_insert_recursive(node->right, timestamp, payload, added);
    } else {
        // Equal timestamps: chain multi-event payload onto existing node
        if (payload) {
            tree_payload_t *curr = node->payload;
            while (curr && curr->next) {
                curr = curr->next;
            }
            if (curr) {
                curr->next = payload;
            } else {
                node->payload = payload;
            }
            *added = true;
        }
        return node;
    }

    node->height = 1 + max_val(avl_get_height(node->left), avl_get_height(node->right));
    int balance = avl_get_balance(node);

    // Left-Left Case
    if (balance > 1 && timestamp < node->left->timestamp) {
        return avl_rotate_right(node);
    }

    // Right-Right Case
    if (balance < -1 && timestamp > node->right->timestamp) {
        return avl_rotate_left(node);
    }

    // Left-Right Case
    if (balance > 1 && timestamp > node->left->timestamp) {
        node->left = avl_rotate_left(node->left);
        return avl_rotate_right(node);
    }

    // Right-Left Case
    if (balance < -1 && timestamp < node->right->timestamp) {
        node->right = avl_rotate_right(node->right);
        return avl_rotate_left(node);
    }

    return node;
}

ct_status_t avl_insert(avl_tree_t *tree, int64_t timestamp, tree_payload_t *payload) {
    if (!tree) return CT_ERR_NULL_PTR;
    bool added = false;
    tree->root = avl_insert_recursive(tree->root, timestamp, payload, &added);
    if (added) {
        tree->total_events++;
        return CT_SUCCESS;
    }
    return CT_ERR_OUT_OF_MEMORY;
}

avl_node_t* avl_search(const avl_tree_t *tree, int64_t timestamp) {
    if (!tree || !tree->root) return NULL;
    avl_node_t *curr = tree->root;
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

static void avl_range_query_recursive(const avl_node_t *root, int64_t start_time, int64_t end_time,
                                      void (*callback)(const avl_node_t *node, void *user_data), void *user_data) {
    if (!root) return;

    if (start_time < root->timestamp) {
        avl_range_query_recursive(root->left, start_time, end_time, callback, user_data);
    }

    if (start_time <= root->timestamp && root->timestamp <= end_time) {
        callback(root, user_data);
    }

    if (end_time > root->timestamp) {
        avl_range_query_recursive(root->right, start_time, end_time, callback, user_data);
    }
}

ct_status_t avl_range_query(const avl_tree_t *tree, int64_t start_time, int64_t end_time,
                            void (*callback)(const avl_node_t *node, void *user_data), void *user_data) {
    if (!tree || !callback) return CT_ERR_NULL_PTR;
    avl_range_query_recursive(tree->root, start_time, end_time, callback, user_data);
    return CT_SUCCESS;
}

static void avl_inorder_recursive(const avl_node_t *root, void (*callback)(const avl_node_t *node, void *user_data), void *user_data) {
    if (!root) return;
    avl_inorder_recursive(root->left, callback, user_data);
    callback(root, user_data);
    avl_inorder_recursive(root->right, callback, user_data);
}

void avl_inorder(const avl_tree_t *tree, void (*callback)(const avl_node_t *node, void *user_data), void *user_data) {
    if (!tree || !callback) return;
    avl_inorder_recursive(tree->root, callback, user_data);
}

int64_t avl_min(const avl_tree_t *tree) {
    if (!tree || !tree->root) return 0;
    avl_node_t *curr = tree->root;
    while (curr->left) {
        curr = curr->left;
    }
    return curr->timestamp;
}

int64_t avl_max(const avl_tree_t *tree) {
    if (!tree || !tree->root) return 0;
    avl_node_t *curr = tree->root;
    while (curr->right) {
        curr = curr->right;
    }
    return curr->timestamp;
}

static void avl_free_recursive(avl_node_t *root) {
    if (!root) return;
    avl_free_recursive(root->left);
    avl_free_recursive(root->right);
    tree_payload_free(root->payload);
    free(root);
}

void avl_destroy(avl_tree_t *tree) {
    if (!tree) return;
    avl_free_recursive(tree->root);
    free(tree);
}

tree_payload_t* tree_payload_create(int event_id, int64_t timestamp, const char *label, 
                                    const char *location, int entity_id, const char *entity_type,
                                    verification_status_t status, bool is_verified) {
    tree_payload_t *p = (tree_payload_t *)calloc(1, sizeof(tree_payload_t));
    if (!p) return NULL;
    p->event_id = event_id;
    p->timestamp = timestamp;
    if (label) strncpy(p->label, label, sizeof(p->label) - 1);
    if (location) strncpy(p->location, location, sizeof(p->location) - 1);
    p->entity_id = entity_id;
    if (entity_type) strncpy(p->entity_type, entity_type, sizeof(p->entity_type) - 1);
    p->status = status;
    p->is_verified = is_verified;
    p->next = NULL;
    return p;
}

void tree_payload_free(tree_payload_t *payload) {
    while (payload) {
        tree_payload_t *next = payload->next;
        free(payload);
        payload = next;
    }
}

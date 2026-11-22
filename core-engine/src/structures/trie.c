/**
 * @file trie.c
 * @brief Implementation of Prefix Tree (Trie) for forensic indexing in CaseThread.
 * @project CASETHREAD
 */

#include "trie.h"

static trie_node_t* trie_create_node(char ch) {
    trie_node_t *node = (trie_node_t *)calloc(1, sizeof(trie_node_t));
    if (!node) return NULL;
    node->ch = ch;
    node->is_end_of_word = false;
    node->entity_id = -1;
    node->child_count = 0;
    return node;
}

trie_t* trie_create(void) {
    trie_t *trie = (trie_t *)malloc(sizeof(trie_t));
    if (!trie) return NULL;
    trie->root = trie_create_node('\0');
    if (!trie->root) {
        free(trie);
        return NULL;
    }
    trie->word_count = 0;
    trie->total_nodes = 1;
    return trie;
}

ct_status_t trie_insert(trie_t *trie, const char *word, int entity_id, const char *entity_type) {
    if (!trie || !trie->root || !word || word[0] == '\0') {
        return CT_ERR_INVALID_INPUT;
    }

    trie_node_t *curr = trie->root;
    size_t len = strlen(word);

    for (size_t i = 0; i < len; i++) {
        unsigned char idx = (unsigned char)word[i];
        if (idx >= TRIE_ASCII_SIZE) continue; // Skip non-ASCII

        if (!curr->children[idx]) {
            curr->children[idx] = trie_create_node((char)idx);
            if (!curr->children[idx]) {
                return CT_ERR_OUT_OF_MEMORY;
            }
            curr->child_count++;
            trie->total_nodes++;
        }
        curr = curr->children[idx];
    }

    if (!curr->is_end_of_word) {
        curr->is_end_of_word = true;
        strncpy(curr->full_word, word, sizeof(curr->full_word) - 1);
        curr->full_word[sizeof(curr->full_word) - 1] = '\0';
        curr->entity_id = entity_id;
        if (entity_type) {
            strncpy(curr->entity_type, entity_type, sizeof(curr->entity_type) - 1);
            curr->entity_type[sizeof(curr->entity_type) - 1] = '\0';
        }
        trie->word_count++;
    }

    return CT_SUCCESS;
}

bool trie_search(const trie_t *trie, const char *word) {
    if (!trie || !trie->root || !word) return false;

    const trie_node_t *curr = trie->root;
    size_t len = strlen(word);

    for (size_t i = 0; i < len; i++) {
        unsigned char idx = (unsigned char)word[i];
        if (idx >= TRIE_ASCII_SIZE || !curr->children[idx]) {
            return false;
        }
        curr = curr->children[idx];
    }

    return curr->is_end_of_word;
}

bool trie_starts_with(const trie_t *trie, const char *prefix) {
    if (!trie || !trie->root || !prefix) return false;

    const trie_node_t *curr = trie->root;
    size_t len = strlen(prefix);

    for (size_t i = 0; i < len; i++) {
        unsigned char idx = (unsigned char)prefix[i];
        if (idx >= TRIE_ASCII_SIZE || !curr->children[idx]) {
            return false;
        }
        curr = curr->children[idx];
    }

    return true;
}

static void collect_autocomplete_words(const trie_node_t *node, char matches[][TRIE_MAX_WORD_LEN], int max_matches, int *count) {
    if (!node || *count >= max_matches) return;

    if (node->is_end_of_word) {
        strncpy(matches[*count], node->full_word, TRIE_MAX_WORD_LEN - 1);
        matches[*count][TRIE_MAX_WORD_LEN - 1] = '\0';
        (*count)++;
    }

    for (int i = 0; i < TRIE_ASCII_SIZE && *count < max_matches; i++) {
        if (node->children[i]) {
            collect_autocomplete_words(node->children[i], matches, max_matches, count);
        }
    }
}

int trie_autocomplete(const trie_t *trie, const char *prefix, char matches[][TRIE_MAX_WORD_LEN], int max_matches) {
    if (!trie || !trie->root || !prefix || !matches || max_matches <= 0) {
        return 0;
    }

    const trie_node_t *curr = trie->root;
    size_t len = strlen(prefix);

    for (size_t i = 0; i < len; i++) {
        unsigned char idx = (unsigned char)prefix[i];
        if (idx >= TRIE_ASCII_SIZE || !curr->children[idx]) {
            return 0; // Prefix does not exist
        }
        curr = curr->children[idx];
    }

    int count = 0;
    collect_autocomplete_words(curr, matches, max_matches, &count);
    return count;
}

static void free_trie_node(trie_node_t *node) {
    if (!node) return;
    for (int i = 0; i < TRIE_ASCII_SIZE; i++) {
        if (node->children[i]) {
            free_trie_node(node->children[i]);
            node->children[i] = NULL;
        }
    }
    free(node);
}

void trie_destroy(trie_t *trie) {
    if (!trie) return;
    if (trie->root) {
        free_trie_node(trie->root);
        trie->root = NULL;
    }
    trie->word_count = 0;
    trie->total_nodes = 0;
    free(trie);
}

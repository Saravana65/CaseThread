/**
 * @file trie.h
 * @brief High-performance Prefix Tree (Trie) for forensic identifier lookup and autocomplete.
 * @project CASETHREAD - Evidence Gap Detection & Investigation Intelligence System
 *
 * TIME COMPLEXITY:
 *   - Insertion: O(L) where L is the string length
 *   - Search:    O(L)
 *   - Prefix:    O(P) where P is prefix length
 *   - Autocomplete: O(P + K) where K is number of matched descendants
 * SPACE COMPLEXITY:
 *   - O(ALPHABET_SIZE * L * N) in worst case, shared prefixes significantly compress memory.
 */

#ifndef CASETHREAD_TRIE_H
#define CASETHREAD_TRIE_H

#include "common.h"
#include <stdbool.h>
#include <stdlib.h>
#include <string.h>

#define TRIE_ASCII_SIZE 128
#define TRIE_MAX_WORD_LEN 128
#define TRIE_MAX_MATCHES 64

typedef struct trie_node {
    char ch;
    bool is_end_of_word;
    char full_word[TRIE_MAX_WORD_LEN];
    char entity_type[32];
    int entity_id;
    struct trie_node *children[TRIE_ASCII_SIZE];
    int child_count;
} trie_node_t;

typedef struct {
    trie_node_t *root;
    size_t word_count;
    size_t total_nodes;
} trie_t;

/* Public API */
trie_t* trie_create(void);
ct_status_t trie_insert(trie_t *trie, const char *word, int entity_id, const char *entity_type);
bool trie_search(const trie_t *trie, const char *word);
bool trie_starts_with(const trie_t *trie, const char *prefix);
int trie_autocomplete(const trie_t *trie, const char *prefix, char matches[][TRIE_MAX_WORD_LEN], int max_matches);
void trie_destroy(trie_t *trie);

#endif /* CASETHREAD_TRIE_H */

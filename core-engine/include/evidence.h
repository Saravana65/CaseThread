/**
 * @file evidence.h
 * @brief Evidence data model and lifecycle routines for CASETHREAD Core DSA Engine.
 * @project CASETHREAD - Evidence Gap Detection & Investigation Intelligence System
 */

#ifndef CASETHREAD_EVIDENCE_H
#define CASETHREAD_EVIDENCE_H

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <stdbool.h>
#include <time.h>

#ifndef MAX_CODE_LEN
#define MAX_CODE_LEN 64
#endif

#ifndef MAX_TITLE_LEN
#define MAX_TITLE_LEN 160
#endif

#ifndef MAX_DESC_LEN
#define MAX_DESC_LEN 1024
#endif

#ifndef MAX_LOC_LEN
#define MAX_LOC_LEN 256
#endif

#ifndef MAX_SOURCE_LEN
#define MAX_SOURCE_LEN 256
#endif

/* Evidence Categories */
typedef enum {
    EV_PHYSICAL = 1,
    EV_DIGITAL,
    EV_CCTV,
    EV_WITNESS,
    EV_PHONE,
    EV_VEHICLE,
    EV_LOCATION,
    EV_TIMELINE,
    EV_FORENSIC_BIO,
    EV_FINANCIAL,
    EV_WEAPON,
    EV_UNKNOWN
} evidence_category_t;

/* Fact vs. Observation Distinction */
typedef enum {
    STATUS_CONFIRMED_FACT = 1,      /* Verified by lab, cryptographic hash, or judicial cert */
    STATUS_UNVERIFIED_OBSERVATION,  /* Eyewitness statement, anonymous tip, uncorroborated */
    STATUS_HYPOTHESIS               /* Algorithmic conjecture or investigative theory */
} verification_status_t;

/* Reliability Rating */
typedef enum {
    RELIABILITY_HIGH = 1,
    RELIABILITY_MEDIUM,
    RELIABILITY_LOW,
    RELIABILITY_QUESTIONABLE,
    RELIABILITY_PENDING_LAB
} reliability_t;

/* Entity Association Node (Linked List of associated entity IDs) */
typedef struct entity_ref {
    int entity_id;
    char entity_type[32];           /* "SUSPECT", "VICTIM", "WITNESS", "LOCATION", "VEHICLE" */
    struct entity_ref *next;
} entity_ref_t;

/* Master Evidence Record */
typedef struct evidence_record {
    int evidence_id;
    int case_id;
    char tracking_code[MAX_CODE_LEN];
    char title[MAX_TITLE_LEN];
    evidence_category_t category;
    char description[MAX_DESC_LEN];
    char collection_location[MAX_LOC_LEN];
    int64_t timestamp;              /* Unix epoch timestamp in seconds (0 = missing timestamp) */
    char source[MAX_SOURCE_LEN];    /* Provenance: e.g. "CCTV Unit #4", "Witness Statement" */
    entity_ref_t *associated_entities;
    verification_status_t verification_status;
    reliability_t reliability;
    char file_reference[MAX_LOC_LEN];
    int entered_by_officer_id;
    struct evidence_record *next;   /* For chaining in collections */
} evidence_record_t;

/* Public API */
evidence_record_t* evidence_create(int id, int case_id, const char *tracking_code, const char *title, evidence_category_t category);
void evidence_free(evidence_record_t *ev);
void evidence_add_entity_ref(evidence_record_t *ev, int entity_id, const char *entity_type);
const char* evidence_category_to_str(evidence_category_t cat);
evidence_category_t evidence_category_from_str(const char *str);
const char* evidence_status_to_str(verification_status_t status);
verification_status_t evidence_status_from_str(const char *str);
const char* evidence_reliability_to_str(reliability_t rel);
reliability_t evidence_reliability_from_str(const char *str);

#endif /* CASETHREAD_EVIDENCE_H */

/**
 * @file common.h
 * @brief Common definitions, data models, error codes and logging utilities for CASETHREAD Core Engine.
 * @project CASETHREAD - Evidence Gap Detection & Investigation Intelligence System
 */

#ifndef CASETHREAD_COMMON_H
#define CASETHREAD_COMMON_H

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <stdbool.h>
#include <time.h>

#define ENGINE_VERSION "1.0.0-phase3-dsa"
#define MAX_LABEL_LEN 128
#define MAX_DESC_LEN 512
#define MAX_CODE_LEN 64

/* Status / Return Codes */
typedef enum {
    CT_SUCCESS = 0,
    CT_ERR_NULL_PTR = -1,
    CT_ERR_OUT_OF_MEMORY = -2,
    CT_ERR_NOT_FOUND = -3,
    CT_ERR_DUPLICATE = -4,
    CT_ERR_INVALID_INPUT = -5,
    CT_ERR_BUFFER_OVERFLOW = -6,
    CT_ERR_JSON_PARSE = -7
} ct_status_t;

/* Entity Categories in Investigation */
typedef enum {
    ENTITY_SUSPECT = 1,
    ENTITY_VICTIM,
    ENTITY_WITNESS,
    ENTITY_EVIDENCE_CCTV,
    ENTITY_EVIDENCE_PHONE,
    ENTITY_EVIDENCE_VEHICLE,
    ENTITY_EVIDENCE_PHYSICAL,
    ENTITY_EVIDENCE_DIGITAL,
    ENTITY_EVIDENCE_FORENSIC,
    ENTITY_LOCATION,
    ENTITY_UNKNOWN
} ct_entity_type_t;

/* Severity of Evidence Gaps */
typedef enum {
    GAP_SEVERITY_LOW = 1,
    GAP_SEVERITY_MEDIUM,
    GAP_SEVERITY_HIGH,
    GAP_SEVERITY_CRITICAL
} ct_gap_severity_t;

/* Safe memory allocation macros with error tracking */
#define CT_ALLOC(type) ((type *)calloc(1, sizeof(type)))
#define CT_ALLOC_ARRAY(type, count) ((type *)calloc((count), sizeof(type)))
#define CT_FREE(ptr) do { if ((ptr) != NULL) { free(ptr); (ptr) = NULL; } } while(0)

/* Forensic engine logging macros (directed to stderr to preserve clean stdout JSON) */
#define CT_LOG_INFO(fmt, ...) fprintf(stderr, "[CASETHREAD-INFO] " fmt "\n", ##__VA_ARGS__)
#define CT_LOG_WARN(fmt, ...) fprintf(stderr, "[CASETHREAD-WARN] " fmt "\n", ##__VA_ARGS__)
#define CT_LOG_ERROR(fmt, ...) fprintf(stderr, "[CASETHREAD-ERROR] " fmt "\n", ##__VA_ARGS__)

#endif /* CASETHREAD_COMMON_H */

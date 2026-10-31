/**
 * @file evidence.c
 * @brief Evidence entity management routines.
 * @project CASETHREAD
 */

#include "evidence.h"

evidence_record_t* evidence_create(int id, int case_id, const char *tracking_code, const char *title, evidence_category_t category) {
    evidence_record_t *ev = (evidence_record_t *)calloc(1, sizeof(evidence_record_t));
    if (!ev) return NULL;

    ev->evidence_id = id;
    ev->case_id = case_id;
    if (tracking_code) strncpy(ev->tracking_code, tracking_code, sizeof(ev->tracking_code) - 1);
    if (title) strncpy(ev->title, title, sizeof(ev->title) - 1);
    ev->category = category;
    ev->verification_status = STATUS_UNVERIFIED_OBSERVATION;
    ev->reliability = RELIABILITY_MEDIUM;
    ev->associated_entities = NULL;
    ev->next = NULL;

    return ev;
}

void evidence_add_entity_ref(evidence_record_t *ev, int entity_id, const char *entity_type) {
    if (!ev) return;
    entity_ref_t *ref = (entity_ref_t *)malloc(sizeof(entity_ref_t));
    if (!ref) return;

    ref->entity_id = entity_id;
    if (entity_type) {
        strncpy(ref->entity_type, entity_type, sizeof(ref->entity_type) - 1);
        ref->entity_type[sizeof(ref->entity_type) - 1] = '\0';
    } else {
        strcpy(ref->entity_type, "UNKNOWN");
    }
    ref->next = ev->associated_entities;
    ev->associated_entities = ref;
}

void evidence_free(evidence_record_t *ev) {
    while (ev) {
        evidence_record_t *next = ev->next;
        entity_ref_t *ref = ev->associated_entities;
        while (ref) {
            entity_ref_t *next_ref = ref->next;
            free(ref);
            ref = next_ref;
        }
        free(ev);
        ev = next;
    }
}

const char* evidence_category_to_str(evidence_category_t cat) {
    switch (cat) {
        case EV_PHYSICAL: return "PHYSICAL";
        case EV_DIGITAL: return "DIGITAL";
        case EV_CCTV: return "CCTV";
        case EV_WITNESS: return "WITNESS";
        case EV_PHONE: return "PHONE";
        case EV_VEHICLE: return "VEHICLE";
        case EV_LOCATION: return "LOCATION";
        case EV_TIMELINE: return "TIMELINE";
        case EV_FORENSIC_BIO: return "FORENSIC_BIO";
        case EV_FINANCIAL: return "FINANCIAL";
        case EV_WEAPON: return "WEAPON";
        default: return "UNKNOWN";
    }
}

evidence_category_t evidence_category_from_str(const char *str) {
    if (!str) return EV_UNKNOWN;
    if (strcmp(str, "PHYSICAL") == 0) return EV_PHYSICAL;
    if (strcmp(str, "DIGITAL") == 0) return EV_DIGITAL;
    if (strcmp(str, "CCTV") == 0) return EV_CCTV;
    if (strcmp(str, "WITNESS") == 0) return EV_WITNESS;
    if (strcmp(str, "PHONE") == 0 || strcmp(str, "PHONE_RECORD") == 0) return EV_PHONE;
    if (strcmp(str, "VEHICLE") == 0) return EV_VEHICLE;
    if (strcmp(str, "LOCATION") == 0) return EV_LOCATION;
    if (strcmp(str, "TIMELINE") == 0) return EV_TIMELINE;
    if (strcmp(str, "FORENSIC_BIO") == 0) return EV_FORENSIC_BIO;
    if (strcmp(str, "FINANCIAL") == 0) return EV_FINANCIAL;
    if (strcmp(str, "WEAPON") == 0) return EV_WEAPON;
    return EV_UNKNOWN;
}

const char* evidence_status_to_str(verification_status_t status) {
    switch (status) {
        case STATUS_CONFIRMED_FACT: return "CONFIRMED_FACT";
        case STATUS_UNVERIFIED_OBSERVATION: return "UNVERIFIED_OBSERVATION";
        case STATUS_HYPOTHESIS: return "HYPOTHESIS";
        default: return "UNVERIFIED_OBSERVATION";
    }
}

verification_status_t evidence_status_from_str(const char *str) {
    if (!str) return STATUS_UNVERIFIED_OBSERVATION;
    if (strcmp(str, "CONFIRMED_FACT") == 0) return STATUS_CONFIRMED_FACT;
    if (strcmp(str, "UNVERIFIED_OBSERVATION") == 0) return STATUS_UNVERIFIED_OBSERVATION;
    if (strcmp(str, "HYPOTHESIS") == 0) return STATUS_HYPOTHESIS;
    return STATUS_UNVERIFIED_OBSERVATION;
}

const char* evidence_reliability_to_str(reliability_t rel) {
    switch (rel) {
        case RELIABILITY_HIGH: return "HIGH";
        case RELIABILITY_MEDIUM: return "MEDIUM";
        case RELIABILITY_LOW: return "LOW";
        case RELIABILITY_QUESTIONABLE: return "QUESTIONABLE";
        case RELIABILITY_PENDING_LAB: return "PENDING_LAB";
        default: return "MEDIUM";
    }
}

reliability_t evidence_reliability_from_str(const char *str) {
    if (!str) return RELIABILITY_MEDIUM;
    if (strcmp(str, "HIGH") == 0) return RELIABILITY_HIGH;
    if (strcmp(str, "MEDIUM") == 0) return RELIABILITY_MEDIUM;
    if (strcmp(str, "LOW") == 0) return RELIABILITY_LOW;
    if (strcmp(str, "QUESTIONABLE") == 0) return RELIABILITY_QUESTIONABLE;
    if (strcmp(str, "PENDING_LAB") == 0) return RELIABILITY_PENDING_LAB;
    return RELIABILITY_MEDIUM;
}

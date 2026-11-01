-- ==============================================================================
-- CASETHREAD: Evidence Gap Detection & Investigation Intelligence System
-- Phase 2 Database Schema for MySQL 8.0+
-- Database: casethread_db
-- ==============================================================================

CREATE DATABASE IF NOT EXISTS casethread_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE casethread_db;

-- Disable foreign key checks during schema re-creation if needed
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS evidence_integrity_verifications;
DROP TABLE IF EXISTS evidence_custody_events;
DROP TABLE IF EXISTS evidence_versions;
DROP TABLE IF EXISTS evidence_audit_logs;
DROP TABLE IF EXISTS investigation_leads;
DROP TABLE IF EXISTS investigation_timelines;
DROP TABLE IF EXISTS timeline_events;
DROP TABLE IF EXISTS investigation_results;
DROP TABLE IF EXISTS evidence_relationships;
DROP TABLE IF EXISTS evidence;
DROP TABLE IF EXISTS evidence_items;
DROP TABLE IF EXISTS witnesses;
DROP TABLE IF EXISTS victims;
DROP TABLE IF EXISTS suspects;
DROP TABLE IF EXISTS cases;
DROP TABLE IF EXISTS officers;

SET FOREIGN_KEY_CHECKS = 1;

-- ------------------------------------------------------------------------------
-- 1. Table: officers (Authenticated Detectives & System Operators)
-- ------------------------------------------------------------------------------
CREATE TABLE officers (
    officer_id INT AUTO_INCREMENT PRIMARY KEY,
    badge_number VARCHAR(50) NOT NULL UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    department VARCHAR(100) NOT NULL,
    rank_designation VARCHAR(80) NOT NULL,
    role ENUM('INVESTIGATOR', 'SENIOR_DETECTIVE', 'LEAD_OFFICER', 'ADMIN') NOT NULL DEFAULT 'INVESTIGATOR',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_officer_badge (badge_number),
    INDEX idx_officer_email (email),
    INDEX idx_officer_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 2. Table: cases (Master Investigation Files)
-- ------------------------------------------------------------------------------
CREATE TABLE cases (
    case_id INT AUTO_INCREMENT PRIMARY KEY,
    case_number VARCHAR(50) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    incident_date DATETIME NOT NULL,
    incident_location VARCHAR(255) NOT NULL,
    lead_officer_id INT NOT NULL,
    priority ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'MEDIUM',
    status ENUM('OPEN', 'UNDER_INVESTIGATION', 'COLD_CASE', 'CLOSED', 'ARCHIVED') NOT NULL DEFAULT 'OPEN',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_case_lead_officer FOREIGN KEY (lead_officer_id) 
        REFERENCES officers(officer_id) ON DELETE RESTRICT,
    INDEX idx_case_number (case_number),
    INDEX idx_case_status (status),
    INDEX idx_case_priority (priority),
    INDEX idx_incident_date (incident_date),
    INDEX idx_lead_officer (lead_officer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 3. Table: suspects (Persons of Interest & Accused Profiles)
-- ------------------------------------------------------------------------------
CREATE TABLE suspects (
    suspect_id INT AUTO_INCREMENT PRIMARY KEY,
    case_id INT NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    alias VARCHAR(100),
    age INT,
    gender ENUM('MALE', 'FEMALE', 'OTHER', 'UNKNOWN') DEFAULT 'UNKNOWN',
    phone_number VARCHAR(30),
    identifying_features TEXT,
    last_known_address VARCHAR(255),
    status ENUM('PERSON_OF_INTEREST', 'PRIMARY_SUSPECT', 'EXONERATED', 'ARRESTED', 'FUGITIVE') DEFAULT 'PERSON_OF_INTEREST',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_suspect_case FOREIGN KEY (case_id) 
        REFERENCES cases(case_id) ON DELETE CASCADE,
    INDEX idx_suspect_case (case_id),
    INDEX idx_suspect_status (status),
    INDEX idx_suspect_name (full_name),
    INDEX idx_suspect_phone (phone_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 4. Table: victims (Victims Connected to Investigations)
-- ------------------------------------------------------------------------------
CREATE TABLE victims (
    victim_id INT AUTO_INCREMENT PRIMARY KEY,
    case_id INT NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    age INT,
    gender ENUM('MALE', 'FEMALE', 'OTHER', 'UNKNOWN') DEFAULT 'UNKNOWN',
    contact_info VARCHAR(255),
    residence_address VARCHAR(255),
    condition_status ENUM('DECEASED', 'INJURED', 'SAFE', 'MISSING', 'RECOVERED') DEFAULT 'SAFE',
    statement TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_victim_case FOREIGN KEY (case_id) 
        REFERENCES cases(case_id) ON DELETE CASCADE,
    INDEX idx_victim_case (case_id),
    INDEX idx_victim_name (full_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 5. Table: witnesses (Witness Testimonies & Credibility Index)
-- ------------------------------------------------------------------------------
CREATE TABLE witnesses (
    witness_id INT AUTO_INCREMENT PRIMARY KEY,
    case_id INT NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    contact_phone VARCHAR(30),
    statement TEXT NOT NULL,
    credibility_score DECIMAL(3, 2) DEFAULT 0.80 COMMENT 'Score 0.00 to 1.00 assessing witness reliability',
    statement_timestamp DATETIME,
    statement_location VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_witness_case FOREIGN KEY (case_id) 
        REFERENCES cases(case_id) ON DELETE CASCADE,
    INDEX idx_witness_case (case_id),
    INDEX idx_witness_name (full_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 6. Table: evidence (Evidence Records & Provenance Ledger)
-- ------------------------------------------------------------------------------
CREATE TABLE evidence (
    evidence_id INT AUTO_INCREMENT PRIMARY KEY,
    case_id INT NOT NULL,
    tracking_code VARCHAR(80) NOT NULL UNIQUE,
    title VARCHAR(200) NOT NULL,
    category ENUM(
        'CCTV', 
        'PHONE_RECORD', 
        'VEHICLE', 
        'PHYSICAL', 
        'DIGITAL', 
        'FORENSIC_BIO', 
        'DOCUMENT', 
        'LOCATION', 
        'FINANCIAL',
        'WEAPON',
        'TESTIMONY_TRANSCRIPT'
    ) NOT NULL,
    description TEXT NOT NULL,
    collection_location VARCHAR(255),
    collected_at DATETIME,
    source VARCHAR(255) NOT NULL COMMENT 'Origin/Provenance: e.g. Store DVR #4, Traffic Cam, Suspect Jacket',
    related_entity_ids JSON COMMENT 'Array of associated entity tags: [{"type":"SUSPECT","id":1}]',
    verification_status ENUM('CONFIRMED_FACT', 'UNVERIFIED_OBSERVATION', 'HYPOTHESIS') NOT NULL DEFAULT 'UNVERIFIED_OBSERVATION',
    reliability_assessment ENUM('HIGH', 'MEDIUM', 'LOW', 'QUESTIONABLE', 'PENDING_LAB') NOT NULL DEFAULT 'MEDIUM',
    file_reference VARCHAR(500) COMMENT 'File storage path or cryptographic hash of media',
    content_payload LONGTEXT COMMENT 'Original raw payload or representation used for bit-level integrity verification',
    sha256_fingerprint VARCHAR(64) COMMENT 'Cryptographic SHA-256 fingerprint digest (hex)',
    fingerprint_algorithm VARCHAR(32) NOT NULL DEFAULT 'SHA-256',
    fingerprint_type ENUM('ORIGINAL_FILE', 'METADATA_CANONICAL') NOT NULL DEFAULT 'METADATA_CANONICAL',
    fingerprinted_at DATETIME,
    last_verified_at DATETIME,
    integrity_status ENUM('PENDING_VERIFICATION', 'INTACT', 'TAMPERED_MISMATCH') NOT NULL DEFAULT 'PENDING_VERIFICATION',
    current_version INT NOT NULL DEFAULT 1,
    entered_by_officer_id INT NOT NULL,
    chain_of_custody_notes TEXT,
    metadata_json JSON COMMENT 'Structured properties (e.g. imei, plate_number, mac_address, coordinates)',
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_evidence_case FOREIGN KEY (case_id) 
        REFERENCES cases(case_id) ON DELETE CASCADE,
    CONSTRAINT fk_evidence_officer FOREIGN KEY (entered_by_officer_id) 
        REFERENCES officers(officer_id) ON DELETE RESTRICT,
    INDEX idx_evidence_case (case_id),
    INDEX idx_evidence_tracking (tracking_code),
    INDEX idx_evidence_category (category),
    INDEX idx_evidence_verification (verification_status),
    INDEX idx_evidence_source (source),
    INDEX idx_evidence_fingerprint (sha256_fingerprint),
    INDEX idx_evidence_integrity (integrity_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 6a. Table: evidence_versions (Historical Version Ledger for Evidence Records)
-- ------------------------------------------------------------------------------
CREATE TABLE evidence_versions (
    version_id INT AUTO_INCREMENT PRIMARY KEY,
    evidence_id INT NOT NULL,
    case_id INT NOT NULL,
    version_number INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    category VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    collection_location VARCHAR(255),
    collected_at DATETIME,
    source VARCHAR(255) NOT NULL,
    verification_status ENUM('CONFIRMED_FACT', 'UNVERIFIED_OBSERVATION', 'HYPOTHESIS') NOT NULL,
    reliability_assessment ENUM('HIGH', 'MEDIUM', 'LOW', 'QUESTIONABLE', 'PENDING_LAB') NOT NULL,
    content_payload LONGTEXT,
    metadata_json JSON,
    version_fingerprint VARCHAR(64) NOT NULL,
    fingerprint_type ENUM('ORIGINAL_FILE', 'METADATA_CANONICAL') NOT NULL DEFAULT 'METADATA_CANONICAL',
    modified_by_officer_id INT NOT NULL,
    reason_for_modification TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ver_evidence FOREIGN KEY (evidence_id) 
        REFERENCES evidence(evidence_id) ON DELETE CASCADE,
    CONSTRAINT fk_ver_case FOREIGN KEY (case_id) 
        REFERENCES cases(case_id) ON DELETE CASCADE,
    CONSTRAINT fk_ver_officer FOREIGN KEY (modified_by_officer_id) 
        REFERENCES officers(officer_id) ON DELETE RESTRICT,
    UNIQUE KEY uq_evidence_version (evidence_id, version_number),
    INDEX idx_ver_evidence (evidence_id),
    INDEX idx_ver_case (case_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 6b. Table: evidence_custody_events (Auditable Physical & Digital Chain of Custody)
-- ------------------------------------------------------------------------------
CREATE TABLE evidence_custody_events (
    custody_event_id INT AUTO_INCREMENT PRIMARY KEY,
    evidence_id INT NOT NULL,
    case_id INT NOT NULL,
    previous_custodian VARCHAR(150) NOT NULL,
    new_custodian VARCHAR(150) NOT NULL,
    transfer_timestamp DATETIME NOT NULL,
    transfer_reason VARCHAR(255) NOT NULL,
    transfer_location VARCHAR(255) NOT NULL,
    transfer_notes TEXT,
    transferring_officer_id INT NOT NULL,
    verification_status ENUM('VERIFIED', 'UNVERIFIED', 'REJECTED') NOT NULL DEFAULT 'VERIFIED',
    related_fingerprint VARCHAR(64),
    is_successful BOOLEAN NOT NULL DEFAULT TRUE,
    failure_reason VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_custody_evidence FOREIGN KEY (evidence_id) 
        REFERENCES evidence(evidence_id) ON DELETE CASCADE,
    CONSTRAINT fk_custody_case FOREIGN KEY (case_id) 
        REFERENCES cases(case_id) ON DELETE CASCADE,
    CONSTRAINT fk_custody_officer FOREIGN KEY (transferring_officer_id) 
        REFERENCES officers(officer_id) ON DELETE RESTRICT,
    INDEX idx_custody_evidence (evidence_id),
    INDEX idx_custody_case (case_id),
    INDEX idx_custody_time (transfer_timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 6c. Table: evidence_integrity_verifications (Cryptographic Verification History)
-- ------------------------------------------------------------------------------
CREATE TABLE evidence_integrity_verifications (
    verification_id INT AUTO_INCREMENT PRIMARY KEY,
    evidence_id INT NOT NULL,
    case_id INT NOT NULL,
    officer_id INT NOT NULL,
    recalculated_hash VARCHAR(64) NOT NULL,
    recorded_hash VARCHAR(64) NOT NULL,
    match_status ENUM('MATCH', 'MISMATCH') NOT NULL,
    fingerprint_type ENUM('ORIGINAL_FILE', 'METADATA_CANONICAL') NOT NULL,
    notes TEXT,
    ip_address VARCHAR(45),
    verified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_verify_evidence FOREIGN KEY (evidence_id) 
        REFERENCES evidence(evidence_id) ON DELETE CASCADE,
    CONSTRAINT fk_verify_case FOREIGN KEY (case_id) 
        REFERENCES cases(case_id) ON DELETE CASCADE,
    CONSTRAINT fk_verify_officer FOREIGN KEY (officer_id) 
        REFERENCES officers(officer_id) ON DELETE RESTRICT,
    INDEX idx_verify_evidence (evidence_id),
    INDEX idx_verify_case (case_id),
    INDEX idx_verify_status (match_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 7. Table: evidence_relationships (Graph Relational Edges & Associations)
-- ------------------------------------------------------------------------------
CREATE TABLE evidence_relationships (
    relationship_id INT AUTO_INCREMENT PRIMARY KEY,
    case_id INT NOT NULL,
    source_type ENUM('SUSPECT', 'VICTIM', 'WITNESS', 'EVIDENCE', 'LOCATION', 'VEHICLE') NOT NULL,
    source_id INT NOT NULL,
    target_type ENUM('SUSPECT', 'VICTIM', 'WITNESS', 'EVIDENCE', 'LOCATION', 'VEHICLE') NOT NULL,
    target_id INT NOT NULL,
    relation_type VARCHAR(100) NOT NULL COMMENT 'e.g. SIGHTED_NEAR, OWNS_VEHICLE, CALLED_NUMBER, CARRIES_WEAPON, CONTRADICTS',
    confidence_weight DECIMAL(3, 2) NOT NULL DEFAULT 0.50 COMMENT 'Normalized edge weight 0.00 to 1.00',
    relationship_nature ENUM('CONFIRMED_FACT', 'UNVERIFIED_OBSERVATION', 'HYPOTHESIS') NOT NULL DEFAULT 'UNVERIFIED_OBSERVATION',
    notes TEXT,
    discovered_by ENUM('OFFICER_MANUAL', 'C_ENGINE_DETECTED') DEFAULT 'OFFICER_MANUAL',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_rel_case FOREIGN KEY (case_id) 
        REFERENCES cases(case_id) ON DELETE CASCADE,
    INDEX idx_rel_case (case_id),
    INDEX idx_rel_source (source_type, source_id),
    INDEX idx_rel_target (target_type, target_id),
    INDEX idx_rel_nature (relationship_nature)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 8. Table: investigation_timelines (Chronological Event Ledger)
-- ------------------------------------------------------------------------------
CREATE TABLE investigation_timelines (
    timeline_id INT AUTO_INCREMENT PRIMARY KEY,
    case_id INT NOT NULL,
    event_timestamp DATETIME NOT NULL,
    event_title VARCHAR(200) NOT NULL,
    event_description TEXT,
    entity_type ENUM('SUSPECT', 'VICTIM', 'WITNESS', 'EVIDENCE', 'INCIDENT', 'OFFICER_ACTION') NOT NULL,
    entity_id INT NOT NULL,
    location VARCHAR(255),
    source_evidence_id INT,
    status ENUM('CONFIRMED_FACT', 'UNVERIFIED_OBSERVATION', 'HYPOTHESIS') NOT NULL DEFAULT 'UNVERIFIED_OBSERVATION',
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_timeline_case FOREIGN KEY (case_id) 
        REFERENCES cases(case_id) ON DELETE CASCADE,
    CONSTRAINT fk_timeline_source_evidence FOREIGN KEY (source_evidence_id) 
        REFERENCES evidence(evidence_id) ON DELETE SET NULL,
    INDEX idx_timeline_case (case_id),
    INDEX idx_timeline_time (event_timestamp),
    INDEX idx_timeline_entity (entity_type, entity_id),
    INDEX idx_timeline_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 9. Table: investigation_leads (Prioritized Detective Leads & Gap Action Items)
-- ------------------------------------------------------------------------------
CREATE TABLE investigation_leads (
    lead_id INT AUTO_INCREMENT PRIMARY KEY,
    case_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    hypothesis TEXT NOT NULL,
    recommended_action TEXT NOT NULL,
    lead_status ENUM('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'VERIFIED_LEAD', 'DISPROVED', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    priority_score DECIMAL(5, 2) NOT NULL DEFAULT 50.00 COMMENT 'Priority 0.00 - 100.00 computed or assigned',
    assigned_officer_id INT,
    source_gap_type ENUM(
        'MISSING_EVIDENCE',
        'TIMELINE_CONTRADICTION',
        'UNIDENTIFIED_ASSOCIATE',
        'ALIBI_GAP',
        'MANUAL_DETECTIVE_ENTRY'
    ) NOT NULL DEFAULT 'MANUAL_DETECTIVE_ENTRY',
    generated_by ENUM('OFFICER_MANUAL', 'C_ENGINE_DETECTED') DEFAULT 'OFFICER_MANUAL',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_lead_case FOREIGN KEY (case_id) 
        REFERENCES cases(case_id) ON DELETE CASCADE,
    CONSTRAINT fk_lead_officer FOREIGN KEY (assigned_officer_id) 
        REFERENCES officers(officer_id) ON DELETE SET NULL,
    INDEX idx_lead_case (case_id),
    INDEX idx_lead_status (lead_status),
    INDEX idx_lead_priority (priority_score)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 10. Table: evidence_audit_logs (Immutable Cryptographically Chained Audit Ledger)
-- ------------------------------------------------------------------------------
CREATE TABLE evidence_audit_logs (
    audit_id INT AUTO_INCREMENT PRIMARY KEY,
    evidence_id INT NOT NULL,
    case_id INT NOT NULL,
    officer_id INT NOT NULL,
    action_type ENUM(
        'CREATED',
        'METADATA_UPDATED',
        'STATUS_CHANGED',
        'VERIFICATION_CHANGED',
        'RELIABILITY_UPDATED',
        'RELATIONSHIP_LINKED',
        'CUSTODY_TRANSFERRED',
        'INTEGRITY_VERIFIED',
        'ARCHIVED',
        'FILE_UPLOADED',
        'METADATA_EXTRACTED',
        'ARTIFACT_GENERATED'
    ) NOT NULL,
    previous_state JSON COMMENT 'Snapshot before mutation',
    new_state JSON COMMENT 'Snapshot after mutation',
    previous_state_hash VARCHAR(64) COMMENT 'SHA-256 of canonical previous state',
    current_state_hash VARCHAR(64) COMMENT 'SHA-256 of canonical new state',
    previous_event_hash VARCHAR(64) NOT NULL DEFAULT 'GENESIS_0000000000000000000000000000000000000000000000000000000000000000' COMMENT 'Cryptographic link to prior event hash for tamper-evident chaining',
    current_event_hash VARCHAR(64) NOT NULL COMMENT 'SHA-256 of deterministic event payload including previous_event_hash',
    canonical_payload JSON COMMENT 'Deterministic canonical serialization of event fields',
    reason_for_change TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_evidence FOREIGN KEY (evidence_id) 
        REFERENCES evidence(evidence_id) ON DELETE CASCADE,
    CONSTRAINT fk_audit_case FOREIGN KEY (case_id) 
        REFERENCES cases(case_id) ON DELETE CASCADE,
    CONSTRAINT fk_audit_officer FOREIGN KEY (officer_id) 
        REFERENCES officers(officer_id) ON DELETE RESTRICT,
    INDEX idx_audit_evidence (evidence_id),
    INDEX idx_audit_case (case_id),
    INDEX idx_audit_officer (officer_id),
    INDEX idx_audit_event_hash (current_event_hash),
    INDEX idx_audit_prev_hash (previous_event_hash),
    INDEX idx_audit_timestamp (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 11. Table: evidence_files (Physical & Digital Evidence Files in Secure Vault)
-- ------------------------------------------------------------------------------
CREATE TABLE evidence_files (
    file_id INT AUTO_INCREMENT PRIMARY KEY,
    evidence_id INT NOT NULL,
    case_id INT NOT NULL,
    storage_key VARCHAR(120) NOT NULL UNIQUE,
    storage_path VARCHAR(500) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    sanitized_filename VARCHAR(255) NOT NULL,
    file_extension VARCHAR(20) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    detected_mime_type VARCHAR(100) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    sha256_hash VARCHAR(64) NOT NULL,
    hash_algorithm VARCHAR(32) NOT NULL DEFAULT 'SHA-256',
    is_primary BOOLEAN NOT NULL DEFAULT TRUE,
    uploaded_by_officer_id INT NOT NULL,
    upload_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    integrity_status ENUM('PENDING_VERIFICATION', 'INTACT', 'TAMPERED_MISMATCH', 'FILE_MISSING') NOT NULL DEFAULT 'INTACT',
    last_verified_at DATETIME,
    CONSTRAINT fk_file_evidence FOREIGN KEY (evidence_id) 
        REFERENCES evidence(evidence_id) ON DELETE CASCADE,
    CONSTRAINT fk_file_case FOREIGN KEY (case_id) 
        REFERENCES cases(case_id) ON DELETE CASCADE,
    CONSTRAINT fk_file_officer FOREIGN KEY (uploaded_by_officer_id) 
        REFERENCES officers(officer_id) ON DELETE RESTRICT,
    INDEX idx_files_evidence (evidence_id),
    INDEX idx_files_case (case_id),
    INDEX idx_files_hash (sha256_hash),
    INDEX idx_files_ext (file_extension)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 12. Table: evidence_metadata_extractions (Automated Forensic Metadata Extraction)
-- ------------------------------------------------------------------------------
CREATE TABLE evidence_metadata_extractions (
    extraction_id INT AUTO_INCREMENT PRIMARY KEY,
    file_id INT NOT NULL,
    evidence_id INT NOT NULL,
    case_id INT NOT NULL,
    file_format VARCHAR(50) NOT NULL,
    extractor_tool VARCHAR(100) NOT NULL,
    extractor_version VARCHAR(50) NOT NULL,
    extraction_status ENUM('SUCCESS', 'PARTIAL', 'FAILED', 'UNSUPPORTED_FORMAT') NOT NULL DEFAULT 'SUCCESS',
    extracted_metadata_json JSON NOT NULL,
    extracted_timestamp DATETIME,
    extracted_gps_lat DECIMAL(10, 8),
    extracted_gps_lon DECIMAL(11, 8),
    officer_reviewed BOOLEAN NOT NULL DEFAULT FALSE,
    review_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_extract_file FOREIGN KEY (file_id) 
        REFERENCES evidence_files(file_id) ON DELETE CASCADE,
    CONSTRAINT fk_extract_evidence FOREIGN KEY (evidence_id) 
        REFERENCES evidence(evidence_id) ON DELETE CASCADE,
    CONSTRAINT fk_extract_case FOREIGN KEY (case_id) 
        REFERENCES cases(case_id) ON DELETE CASCADE,
    INDEX idx_extract_file (file_id),
    INDEX idx_extract_case (case_id),
    INDEX idx_extract_status (extraction_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 13. Table: evidence_derived_artifacts (Controlled Derived Forensic Artifacts)
-- ------------------------------------------------------------------------------
CREATE TABLE evidence_derived_artifacts (
    artifact_id INT AUTO_INCREMENT PRIMARY KEY,
    parent_file_id INT NOT NULL,
    evidence_id INT NOT NULL,
    case_id INT NOT NULL,
    artifact_type ENUM('THUMBNAIL', 'PREVIEW_IMAGE', 'EXTRACTED_TEXT', 'NORMALIZED_DATA', 'WAVEFORM', 'DOCUMENT_METADATA') NOT NULL,
    storage_key VARCHAR(120) NOT NULL UNIQUE,
    storage_path VARCHAR(500) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    sha256_hash VARCHAR(64) NOT NULL,
    generator_tool VARCHAR(100) NOT NULL,
    generator_version VARCHAR(50) NOT NULL,
    transformation_summary TEXT,
    created_by_officer_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_artifact_parent FOREIGN KEY (parent_file_id) 
        REFERENCES evidence_files(file_id) ON DELETE CASCADE,
    CONSTRAINT fk_artifact_evidence FOREIGN KEY (evidence_id) 
        REFERENCES evidence(evidence_id) ON DELETE CASCADE,
    CONSTRAINT fk_artifact_case FOREIGN KEY (case_id) 
        REFERENCES cases(case_id) ON DELETE CASCADE,
    CONSTRAINT fk_artifact_officer FOREIGN KEY (created_by_officer_id) 
        REFERENCES officers(officer_id) ON DELETE RESTRICT,
    INDEX idx_artifact_parent (parent_file_id),
    INDEX idx_artifact_evidence (evidence_id),
    INDEX idx_artifact_type (artifact_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 14. Table: evidence_geospatial (Normalized Geographical Evidence Data Model)
-- ------------------------------------------------------------------------------
CREATE TABLE evidence_geospatial (
    geospatial_id INT AUTO_INCREMENT PRIMARY KEY,
    evidence_id INT NOT NULL,
    case_id INT NOT NULL,
    entity_type ENUM('EVIDENCE', 'SUSPECT', 'VICTIM', 'WITNESS', 'INCIDENT', 'CCTV', 'VEHICLE_SIGHTING') NOT NULL DEFAULT 'EVIDENCE',
    entity_id INT,
    latitude DECIMAL(10, 8) NOT NULL COMMENT 'WGS84 Latitude between -90.00000000 and +90.00000000',
    longitude DECIMAL(11, 8) NOT NULL COMMENT 'WGS84 Longitude between -180.00000000 and +180.00000000',
    altitude DECIMAL(8, 2) DEFAULT NULL COMMENT 'Meters above sea level',
    accuracy_meters DECIMAL(6, 2) DEFAULT NULL COMMENT 'Estimated accuracy radius in meters',
    coordinate_reference_system VARCHAR(30) NOT NULL DEFAULT 'WGS84',
    location_source ENUM('EXIF_GPS', 'OFFICER_ENTERED', 'EXTERNAL_DEVICE', 'CCTV_RECORD', 'CELL_TOWER', 'DMV_RECORD') NOT NULL,
    location_name VARCHAR(255),
    recorded_timestamp DATETIME,
    timezone_offset VARCHAR(10) DEFAULT '+00:00',
    extraction_source VARCHAR(150) COMMENT 'Tool or source provenance (e.g. EXIF metadata extraction, CAD GPS)',
    verification_status ENUM('CONFIRMED_FACT', 'UNVERIFIED_OBSERVATION', 'HYPOTHESIS') NOT NULL DEFAULT 'UNVERIFIED_OBSERVATION',
    officer_reviewed BOOLEAN NOT NULL DEFAULT FALSE,
    reviewed_by_officer_id INT DEFAULT NULL,
    review_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_geo_evidence FOREIGN KEY (evidence_id) 
        REFERENCES evidence(evidence_id) ON DELETE CASCADE,
    CONSTRAINT fk_geo_case FOREIGN KEY (case_id) 
        REFERENCES cases(case_id) ON DELETE CASCADE,
    CONSTRAINT fk_geo_officer FOREIGN KEY (reviewed_by_officer_id) 
        REFERENCES officers(officer_id) ON DELETE SET NULL,
    INDEX idx_geo_evidence (evidence_id),
    INDEX idx_geo_case (case_id),
    INDEX idx_geo_coords (latitude, longitude),
    INDEX idx_geo_source (location_source),
    INDEX idx_geo_timestamp (recorded_timestamp),
    INDEX idx_geo_verification (verification_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- INITIAL SEED DATA (For Verification & Development)
-- ==============================================================================

-- 1. Default Administrator / Lead Detective
-- Passwords:
-- DET-8841: Password123! (bcrypt: $2a$12$6sI5RfxU9p.9hN9jZqL7yepv3o28CeqT8lH.C2kZJk7t3gXF9H.pS)
-- DET-9912: Detective2026! (bcrypt: $2a$12$4e9L7mKjQzW1x.y9P8oN7eM6u5T4r3E2w1Q0z9X8y7W6v5U4t3S2r)
INSERT INTO officers (badge_number, full_name, email, password_hash, department, rank_designation, role)
VALUES 
('DET-8841', 'Det. Alexander Cross', 'a.cross@casethread.police.gov', '$2a$12$jg0EbxHjj7cfgQixKAZrZeGnjunrxPT//OvKMeLU5sIGinc7Bw8CO', 'Major Crimes Division', 'Senior Detective', 'LEAD_OFFICER'),
('DET-9912', 'Det. Sarah Lin', 's.lin@casethread.police.gov', '$2a$12$4e9L7mKjQzW1x.y9P8oN7eM6u5T4r3E2w1Q0z9X8y7W6v5U4t3S2r', 'Cyber & Forensic Telemetry Unit', 'Forensic Investigator', 'INVESTIGATOR')
ON DUPLICATE KEY UPDATE full_name=VALUES(full_name);

-- 2. Demo Investigation Case
INSERT INTO cases (case_number, title, description, incident_date, incident_location, lead_officer_id, priority, status)
VALUES 
('CASE-2026-0419', 'The Metro Vault Intrusion & Disappearance', 'Unauthorized breach of Metro National Depository Vault with suspicious cell signal anomalies and missing courier.', '2026-10-15 02:45:00', '450 Financial Boulevard, Downtown', 1, 'CRITICAL', 'UNDER_INVESTIGATION')
ON DUPLICATE KEY UPDATE title=VALUES(title);

-- 3. Seed Suspects (3 Persons of Interest)
INSERT INTO suspects (case_id, full_name, alias, age, gender, phone_number, identifying_features, last_known_address, status, notes)
VALUES 
(1, 'Marcus Vance', 'The Ghost', 38, 'MALE', '+1-555-0192', 'Scar across left eyebrow, dragon tattoo on right forearm', 'Industrial District Warehouse 4', 'PRIMARY_SUSPECT', 'Master safecracker and electronic bypass operative.'),
(1, 'Damon Vance', 'Specter', 34, 'MALE', '+1-555-0188', 'Limp on left leg', '12 Harbour St', 'PERSON_OF_INTEREST', 'Brother of Marcus Vance; registered owner of black matte sedan.'),
(1, 'Elena Rostova', 'Cipher', 31, 'FEMALE', '+1-555-0177', 'Platinum blonde hair, dark spectacles', '44 Skyline Executive Lofts', 'PERSON_OF_INTEREST', 'Depository security systems contractor with root encryption access keys.');

-- 4. Seed Victim
INSERT INTO victims (case_id, full_name, age, gender, contact_info, residence_address, condition_status, statement)
VALUES 
(1, 'Julian Mercer', 42, 'MALE', '+1-555-0111', '89 Parkview Heights', 'MISSING', 'Courier missing since 02:30 AM on night of vault breach.');

-- 5. Seed Witnesses (2 Witnesses)
INSERT INTO witnesses (case_id, full_name, contact_phone, statement, credibility_score, statement_timestamp, statement_location)
VALUES 
(1, 'Evelyn Shaw', '+1-555-0144', 'Observed a dark matte sedan speeding out of the loading dock at approximately 02:50 AM with headlights off.', 0.90, '2026-10-15 09:30:00', 'Corner of 4th & Pine St'),
(1, 'Arthur Pendelton', '+1-555-0166', 'Heard industrial drilling hum and metallic latch release sounds coming from Sub-level 2 while conducting night janitorial rounds at 02:35 AM.', 0.75, '2026-10-15 10:15:00', 'Depository Maintenance Basement');

-- 6. Seed Evidence (Distinguishing Fact vs Unverified Observation, Missing Timestamps, Disconnected Clusters & Isolated Record)
INSERT INTO evidence (case_id, tracking_code, title, category, description, collection_location, collected_at, source, related_entity_ids, verification_status, reliability_assessment, entered_by_officer_id, metadata_json, sha256_fingerprint, fingerprint_algorithm, fingerprint_type, fingerprinted_at, integrity_status, content_payload)
VALUES 
(1, 'EVD-CCTV-001', 'Loading Dock Camera Feed #4', 'CCTV', 'Timestamped footage showing black sedan leaving rear gate at 02:49:12 AM.', 'Metro Depository Loading Bay', '2026-10-15 04:00:00', 'Depository Security DVR Unit 2', '[{"type":"SUSPECT","id":2}]', 'CONFIRMED_FACT', 'HIGH', 1, '{"camera_id": "CAM-04", "resolution": "1080p", "direction": "Northbound"}', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'SHA-256', 'ORIGINAL_FILE', '2026-10-15 04:05:00', 'INTACT', 'RAW_MP4_HEADER_OFFSET_004912_FPS30_HASH_VERIFIED'),
(1, 'EVD-TEL-002', 'Cell Tower Dump Sector 7', 'PHONE_RECORD', 'Inbound call to Marcus Vance burner device originating near loading dock at 02:44:00 AM.', 'Sector 7 Cell Relay', '2026-10-15 06:15:00', 'Telecom Subpoena Tower 7 Log', '[{"type":"SUSPECT","id":1}]', 'CONFIRMED_FACT', 'HIGH', 2, '{"tower_id": "TOW-07", "duration_sec": 38, "cell_id": "402-99"}', '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a', 'SHA-256', 'METADATA_CANONICAL', '2026-10-15 06:20:00', 'INTACT', 'CELL_DUMP_TOWER07_CDR_402_99_38S'),
(1, 'EVD-VEH-003', 'Black Matte Sedan Registration', 'VEHICLE', 'Vehicle matching CCTV footage registered to Damon Vance.', 'DMV Database Registry', '2026-10-15 08:20:00', 'State DMV Central Database', '[{"type":"SUSPECT","id":2}]', 'CONFIRMED_FACT', 'HIGH', 1, '{"license_plate": "7XYZ99", "make": "Sedan", "color": "Matte Black"}', 'ef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe39d', 'SHA-256', 'METADATA_CANONICAL', '2026-10-15 08:25:00', 'INTACT', 'DMV_REG_7XYZ99_DAMON_VANCE_MATTE_BLACK'),
(1, 'EVD-OBS-004', 'Anonymous Tip: Sighting at Docks', 'TESTIMONY_TRANSCRIPT', 'Anonymous caller stated someone looking like Marcus Vance was loading metallic crates into a motorboat at 04:15 AM.', 'Harbour Pier 9', '2026-10-15 11:00:00', 'UNKNOWN', '[{"type":"SUSPECT","id":1}]', 'UNVERIFIED_OBSERVATION', 'QUESTIONABLE', 1, '{"tip_id": "TIP-8921", "audio_recorded": true}', '2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae', 'SHA-256', 'METADATA_CANONICAL', '2026-10-15 11:05:00', 'INTACT', 'AUDIO_TRANSCRIPT_TIP8921_PIER9_CRATES'),
(1, 'EVD-CCTV-005', 'Financial Blvd Street Camera #12', 'CCTV', 'High-definition traffic camera recording matte black sedan speeding north across Financial Blvd at 02:51:30 AM.', '4th & Financial Blvd Intersection', '2026-10-15 05:30:00', 'City Traffic Authority Archive', '[{"type":"SUSPECT","id":2}]', 'CONFIRMED_FACT', 'HIGH', 1, '{"camera_id": "TRAFFIC-12", "speed_est_mph": 58, "plate_partial": "7XY"}', 'a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e', 'SHA-256', 'ORIGINAL_FILE', '2026-10-15 05:35:00', 'INTACT', 'TRAFFIC_FEED_CAM12_FRAME_025130_HD'),
(1, 'EVD-DIG-006', 'Vault Server Access Log', 'DIGITAL_DEVICE', 'Digital logs showing root cryptographic vault door override executed at 02:38:15 AM using contractor encryption credential key.', 'Depository Server Room', '2026-10-15 07:45:00', 'Vault Core Server Audit Journal', '[{"type":"SUSPECT","id":3}]', 'CONFIRMED_FACT', 'HIGH', 2, '{"auth_user": "CONTRACTOR_ROOT", "ip": "10.0.4.15", "key_id": "ENC-ROSTOVA-88"}', '4355a46b19d348dc2f57c046f8ef63d4538ebb936000f3c9ee954a27460dd865', 'SHA-256', 'ORIGINAL_FILE', '2026-10-15 07:50:00', 'INTACT', 'SYSLOG_VAULT_ROOT_AUTH_10.0.4.15_ENC-ROSTOVA-88'),
(1, 'EVD-BIO-007', 'Synthetic Glove Fiber Sample', 'BIOMETRIC', 'Rare nitrile-neoprene fiber strand recovered from vault door keypad frame with no logged timestamp.', 'Vault Door Keypad', NULL, 'Forensic Crime Scene Team Unit 1', '[]', 'CONFIRMED_FACT', 'PENDING_LAB', 1, '{"lab_ref": "BIO-LAB-2026-09"}', '53c234e5e8472b6ac51c1ae1cab3fe06fad053beb8ebfd8977b010655bfdd3c3', 'SHA-256', 'METADATA_CANONICAL', '2026-10-15 08:00:00', 'INTACT', 'LAB_SAMPLE_BIO2026_09_NITRILE_NEOPRENE'),
(1, 'EVD-TEL-008', 'Encrypted VoIP Call Relay', 'PHONE_RECORD', 'VoIP encrypted burst data packet between Elena Rostova terminal and offshore proxy at 02:40:00 AM.', 'Sub-gateway Router 9', '2026-10-15 09:10:00', 'Cyber Telemetry Sniffer Log', '[{"type":"SUSPECT","id":3}]', 'CONFIRMED_FACT', 'HIGH', 2, '{"protocol": "TLSv1.3", "packet_size_bytes": 1024}', 'd28a9b3a324392eb13812738ea0b91d6402377b2ca0ce8108c5054ea4f9c5ff5', 'SHA-256', 'ORIGINAL_FILE', '2026-10-15 09:15:00', 'INTACT', 'PCAP_BURST_ROUTEPACKET_1024B_TLS13'),
(1, 'EVD-ISO-009', 'Abandoned Mountain Bicycle', 'PHYSICAL', 'Blue mountain bicycle found discarded in alleyway 6 miles from crime scene. No fingerprint or camera links.', 'Alleyway behind 1400 Industrial Way', '2026-10-15 14:00:00', 'Patrol Officer Beat 14', '[]', 'UNVERIFIED_OBSERVATION', 'LOW', 1, '{"serial_number": "MN-4820", "condition": "rusted_chain"}', '6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b', 'SHA-256', 'METADATA_CANONICAL', '2026-10-15 14:05:00', 'INTACT', 'PHYSICAL_PROPERTY_TAG_MN4820_BICYCLE');

-- 7. Seed Direct Evidence Relationships (Creates 2 Disconnected Clusters + 1 Isolated Node)
INSERT INTO evidence_relationships (case_id, source_type, source_id, target_type, target_id, relation_type, confidence_weight, relationship_nature, notes, discovered_by)
VALUES 
-- Cluster 1: Main Depository Heist Network
(1, 'SUSPECT', 1, 'SUSPECT', 2, 'BROTHER_ASSOCIATE', 0.95, 'CONFIRMED_FACT', 'Marcus and Damon Vance have shared banking accounts and past records.', 'OFFICER_MANUAL'),
(1, 'SUSPECT', 2, 'EVIDENCE', 3, 'OWNS_VEHICLE', 0.90, 'CONFIRMED_FACT', 'Damon Vance is legal registered owner of black sedan 7XYZ99.', 'OFFICER_MANUAL'),
(1, 'EVIDENCE', 1, 'EVIDENCE', 3, 'VEHICLE_MATCH', 0.85, 'UNVERIFIED_OBSERVATION', 'CCTV footage visual profile matches registered vehicle.', 'OFFICER_MANUAL'),
(1, 'EVIDENCE', 1, 'EVIDENCE', 5, 'VEHICLE_TRANSIT', 0.90, 'CONFIRMED_FACT', 'Sedan tracked traveling north along Financial Blvd route.', 'OFFICER_MANUAL'),
(1, 'SUSPECT', 1, 'EVIDENCE', 2, 'PHONE_CALL_ROUTING', 0.88, 'CONFIRMED_FACT', 'Burner phone registered to Marcus Vance pinged Sector 7 tower.', 'OFFICER_MANUAL'),
(1, 'WITNESS', 1, 'EVIDENCE', 1, 'CORROBORATES_DEPARTURE', 0.80, 'CONFIRMED_FACT', 'Witness Evelyn Shaw observed vehicle departure matching CCTV timestamp.', 'OFFICER_MANUAL'),
-- Cluster 2: Depository Security Contractor Sub-network (Disconnected from Cluster 1)
(1, 'SUSPECT', 3, 'EVIDENCE', 6, 'CONTRACTOR_CREDENTIAL_MATCH', 0.92, 'CONFIRMED_FACT', 'Cryptographic access key ENC-ROSTOVA-88 assigned exclusively to Elena Rostova.', 'OFFICER_MANUAL'),
(1, 'SUSPECT', 3, 'EVIDENCE', 8, 'TERMINAL_OWNER', 0.85, 'CONFIRMED_FACT', 'Elena Rostova laptop initiated encrypted proxy connection during breach.', 'OFFICER_MANUAL'),
(1, 'WITNESS', 2, 'EVIDENCE', 6, 'CORROBORATES_AUDITORY_TIMING', 0.75, 'CONFIRMED_FACT', 'Arthur Pendelton janitorial hearing aligns with electronic override log.', 'OFFICER_MANUAL');

-- 8. Seed Timeline Events (Chronological with Spatiotemporal Contradictions)
INSERT INTO investigation_timelines (case_id, event_timestamp, event_title, event_description, entity_type, entity_id, location, source_evidence_id, status, is_verified)
VALUES 
(1, '2026-10-15 02:30:00', 'Courier Julian Mercer Last Contact', 'Courier checked in with dispatch before entering vault access corridor.', 'VICTIM', 1, 'Depository Access Corridor', NULL, 'CONFIRMED_FACT', TRUE),
(1, '2026-10-15 02:35:00', 'Custodian Reports Drilling Sounds', 'Janitor Arthur Pendelton heard high-speed drilling from Sub-level 2.', 'WITNESS', 2, 'Depository Maintenance Basement', NULL, 'CONFIRMED_FACT', TRUE),
(1, '2026-10-15 02:38:15', 'Vault Electronic Security Bypass', 'Digital root authorization executed via contractor key ENC-ROSTOVA-88.', 'EVIDENCE', 6, 'Depository Server Room', 6, 'CONFIRMED_FACT', TRUE),
(1, '2026-10-15 02:44:00', 'Sector 7 Cell Relay Hit', 'Burner phone associated with Marcus Vance triggered Sector 7 tower near loading dock.', 'SUSPECT', 1, 'Depository Loading Dock Perimeter', 2, 'CONFIRMED_FACT', TRUE),
(1, '2026-10-15 02:45:00', 'Marcus Vance False Alibi Claim', 'Suspect claimed he was drinking coffee at Westside Diner (15 km away) at 02:45 AM.', 'SUSPECT', 1, 'Westside 24hr Diner', NULL, 'HYPOTHESIS', FALSE),
(1, '2026-10-15 02:49:12', 'Black Sedan Departure', 'Sedan exits loading dock heading north with headlights off.', 'EVIDENCE', 1, 'Loading Bay Rear Gate', 1, 'CONFIRMED_FACT', TRUE),
(1, '2026-10-15 02:51:30', 'Black Sedan Financial Blvd Sighting', 'Sedan recorded speeding north past Financial Blvd intersection.', 'EVIDENCE', 5, '4th & Financial Blvd Intersection', 5, 'CONFIRMED_FACT', TRUE),
(1, '2026-10-15 03:01:00', 'Elena Rostova Depository Exit', 'Security badge swipe recorded at depository main lobby security turnstile.', 'SUSPECT', 3, 'Depository Main Plaza', NULL, 'CONFIRMED_FACT', TRUE),
(1, '2026-10-15 03:02:30', 'Elena Rostova Airport Check-in Claim', 'Suspect claimed to be boarding flight at Metro East Airport (18 km away in 90 seconds - impossible speed violation).', 'SUSPECT', 3, 'Metro East Airport Terminal', NULL, 'HYPOTHESIS', FALSE),
(1, '2026-10-15 04:15:00', 'Uncorroborated Pier Sighting', 'Tipster claims Marcus Vance was spotted loading crates into a vessel.', 'SUSPECT', 1, 'Harbour Pier 9', 4, 'UNVERIFIED_OBSERVATION', FALSE);

-- 9. Seed Investigation Leads
INSERT INTO investigation_leads (case_id, title, hypothesis, recommended_action, lead_status, priority_score, assigned_officer_id, source_gap_type, generated_by)
VALUES 
(1, 'Interrogate Damon Vance Regarding Vehicle 7XYZ99', 'Vehicle registered to Damon Vance was captured fleeing the vault loading dock 4 minutes after the breach.', 'Issue subpoena for vehicle location data and bring Damon Vance for formal questioning.', 'ASSIGNED', 92.50, 1, 'TIMELINE_CONTRADICTION', 'OFFICER_MANUAL'),
(1, 'Subpoena Pier 9 Maritime Surveillance Footage', 'Verify whether anonymous tip regarding Pier 9 vessel departure corresponds to physical CCTV footage.', 'Contact Port Authority to retrieve 03:30 - 05:00 AM Pier 9 camera recordings.', 'OPEN', 78.00, 2, 'MISSING_EVIDENCE', 'OFFICER_MANUAL');

-- 10. Seed Initial Evidence Versions (Stage 4)
INSERT INTO evidence_versions (evidence_id, case_id, version_number, title, category, description, collection_location, collected_at, source, verification_status, reliability_assessment, content_payload, metadata_json, version_fingerprint, fingerprint_type, modified_by_officer_id, reason_for_modification)
VALUES 
(1, 1, 1, 'Loading Dock Camera Feed #4', 'CCTV', 'Timestamped footage showing black sedan leaving rear gate at 02:49:12 AM.', 'Metro Depository Loading Bay', '2026-10-15 04:00:00', 'Depository Security DVR Unit 2', 'CONFIRMED_FACT', 'HIGH', 'RAW_MP4_HEADER_OFFSET_004912_FPS30_HASH_VERIFIED', '{"camera_id": "CAM-04", "resolution": "1080p", "direction": "Northbound"}', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'ORIGINAL_FILE', 1, 'Initial evidence ingestion and baseline version creation.'),
(2, 1, 1, 'Cell Tower Dump Sector 7', 'PHONE_RECORD', 'Inbound call to Marcus Vance burner device originating near loading dock at 02:44:00 AM.', 'Sector 7 Cell Relay', '2026-10-15 06:15:00', 'Telecom Subpoena Tower 7 Log', 'CONFIRMED_FACT', 'HIGH', 'CELL_DUMP_TOWER07_CDR_402_99_38S', '{"tower_id": "TOW-07", "duration_sec": 38, "cell_id": "402-99"}', '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a', 'METADATA_CANONICAL', 2, 'Initial evidence ingestion and baseline version creation.'),
(3, 1, 1, 'Black Matte Sedan Registration', 'VEHICLE', 'Vehicle matching CCTV footage registered to Damon Vance.', 'DMV Database Registry', '2026-10-15 08:20:00', 'State DMV Central Database', 'CONFIRMED_FACT', 'HIGH', 'DMV_REG_7XYZ99_DAMON_VANCE_MATTE_BLACK', '{"license_plate": "7XYZ99", "make": "Sedan", "color": "Matte Black"}', 'ef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe39d', 'METADATA_CANONICAL', 1, 'Initial evidence ingestion and baseline version creation.');

-- 11. Seed Chain-of-Custody Events (Stage 2)
INSERT INTO evidence_custody_events (evidence_id, case_id, previous_custodian, new_custodian, transfer_timestamp, transfer_reason, transfer_location, transfer_notes, transferring_officer_id, verification_status, related_fingerprint, is_successful)
VALUES 
(1, 1, 'Depository Security Lead Martinez', 'Det. Alexander Cross (Badge DET-8841)', '2026-10-15 04:30:00', 'Initial Evidence Seizure from DVR Unit', 'Metro Depository Security Office', 'DVR hard drive clone exported to encrypted forensic drive.', 1, 'VERIFIED', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', TRUE),
(1, 1, 'Det. Alexander Cross (Badge DET-8841)', 'Digital Forensics Lab Technician Miller', '2026-10-15 06:00:00', 'Forensic Video Enhancement and Plate Extraction', 'Central Forensics Laboratory Room 302', 'Transferred with tamper-evident seal #7741.', 1, 'VERIFIED', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', TRUE),
(2, 1, 'Telecom Carrier Subpoena Compliance Dept', 'Det. Sarah Lin (Badge DET-9912)', '2026-10-15 07:00:00', 'Court Order Subpoena Fulfillment', 'Major Crimes Telemetry Office', 'Digitally signed CSV packet received via secure SFTP.', 2, 'VERIFIED', '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a', TRUE),
(3, 1, 'State DMV Liaison Agent', 'Det. Alexander Cross (Badge DET-8841)', '2026-10-15 08:45:00', 'Official DMV Record Requisition', 'Police Headquarters Records Bureau', 'Certified vehicle registration record acquired.', 1, 'VERIFIED', 'ef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe39d', TRUE);

-- 12. Seed Cryptographically Chained Audit Events (Stage 3)
INSERT INTO evidence_audit_logs (audit_id, evidence_id, case_id, officer_id, action_type, previous_state, new_state, previous_state_hash, current_state_hash, previous_event_hash, current_event_hash, canonical_payload, reason_for_change, ip_address, created_at)
VALUES 
(1, 1, 1, 1, 'CREATED', NULL, '{"tracking_code":"EVD-CCTV-001","title":"Loading Dock Camera Feed #4","category":"CCTV","verification":"CONFIRMED_FACT"}', NULL, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'GENESIS_0000000000000000000000000000000000000000000000000000000000000000', 'f1a238479e0811e5f84d284792a5436d8594b29c91b10a4e76c3746682bc85c1', '{"evidence_id":1,"action_type":"CREATED","officer_id":1,"prev_hash":"GENESIS_0000000000000000000000000000000000000000000000000000000000000000"}', 'Initial forensic evidence ingestion', '127.0.0.1', '2026-10-15 04:00:00'),
(2, 1, 1, 1, 'CUSTODY_TRANSFERRED', '{"custodian":"Depository Security Lead Martinez"}', '{"custodian":"Det. Alexander Cross (Badge DET-8841)"}', 'a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0', 'b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef01', 'f1a238479e0811e5f84d284792a5436d8594b29c91b10a4e76c3746682bc85c1', '7b4e9f31c828d098a54627198e3b5a76c8d192e4578b9a023f6e871239c4d5e6', '{"evidence_id":1,"action_type":"CUSTODY_TRANSFERRED","officer_id":1,"prev_hash":"f1a238479e0811e5f84d284792a5436d8594b29c91b10a4e76c3746682bc85c1"}', 'Initial evidence transfer from scene', '127.0.0.1', '2026-10-15 04:30:00');

-- 13. Seed Geospatial Evidence Coordinates (Stage 1)
INSERT INTO evidence_geospatial (geospatial_id, evidence_id, case_id, entity_type, entity_id, latitude, longitude, altitude, accuracy_meters, coordinate_reference_system, location_source, location_name, recorded_timestamp, timezone_offset, extraction_source, verification_status, officer_reviewed)
VALUES 
(1, 1, 1, 'CCTV', NULL, 40.71280000, -74.00600000, 12.50, 3.00, 'WGS84', 'CCTV_RECORD', 'Metro Depository Rear Loading Bay Gate', '2026-10-15 02:49:12', '+00:00', 'Fixed Surveillance Camera Spec Registry', 'CONFIRMED_FACT', TRUE),
(2, 2, 1, 'EVIDENCE', 1, 40.71350000, -74.00510000, 35.00, 25.00, 'WGS84', 'CELL_TOWER', 'Sector 7 Cell Relay Antenna Tower', '2026-10-15 02:44:00', '+00:00', 'Cellular Carrier Tower Subpoena Packet', 'CONFIRMED_FACT', TRUE),
(3, 5, 1, 'VEHICLE_SIGHTING', 3, 40.71600000, -74.00400000, 10.00, 5.00, 'WGS84', 'CCTV_RECORD', '4th & Financial Boulevard Intersection', '2026-10-15 02:51:30', '+00:00', 'Municipal Traffic Camera System', 'CONFIRMED_FACT', TRUE),
(4, 6, 1, 'EVIDENCE', NULL, 40.71295000, -74.00615000, -5.00, 1.50, 'WGS84', 'OFFICER_ENTERED', 'Depository Sub-level 2 Server Corridor', '2026-10-15 02:38:15', '+00:00', 'Crime Scene Technician Architectural Mapping', 'CONFIRMED_FACT', TRUE),
(5, 4, 1, 'EVIDENCE', NULL, 40.70500000, -74.01800000, 2.00, 50.00, 'WGS84', 'OFFICER_ENTERED', 'Harbour Pier 9 Cargo Terminal Berth 4', '2026-10-15 04:15:00', '+00:00', 'Witness Tip Location Estimation', 'UNVERIFIED_OBSERVATION', FALSE),
(6, 1, 1, 'EVIDENCE', NULL, 40.71285000, -74.00595000, 11.00, 4.20, 'WGS84', 'EXIF_GPS', 'Depository Alleyway Approach', '2026-10-15 02:48:00', '+00:00', 'EXIF metadata extraction from patrol photo', 'UNVERIFIED_OBSERVATION', FALSE);


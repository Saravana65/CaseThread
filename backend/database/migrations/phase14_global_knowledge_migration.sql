-- ==============================================================================
-- PHASE 14 MIGRATION: GLOBAL CRIME RECORD SCHEMA EXTENSIONS
-- Expands Private Knowledge Base to support worldwide jurisdictions,
-- crime subtypes, incident timestamps, stolen property, recovery, and multilingual records.
-- ==============================================================================

-- 1. Extend knowledge_sources
ALTER TABLE knowledge_sources
ADD COLUMN IF NOT EXISTS country VARCHAR(100) NOT NULL DEFAULT 'Global' AFTER jurisdiction,
ADD COLUMN IF NOT EXISTS source_reliability ENUM('OFFICIAL_GOVERNMENT', 'JUDICIAL_RECORD', 'POLICE_DEPARTMENT', 'OPEN_DATA_PORTAL', 'AUTHORIZED_ARCHIVE', 'UNVERIFIED') NOT NULL DEFAULT 'OFFICIAL_GOVERNMENT' AFTER license_terms,
ADD COLUMN IF NOT EXISTS update_frequency VARCHAR(50) DEFAULT 'MONTHLY' AFTER access_restrictions,
ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMP NULL AFTER update_frequency;

-- 2. Extend knowledge_documents
ALTER TABLE knowledge_documents
ADD COLUMN IF NOT EXISTS country VARCHAR(100) NOT NULL DEFAULT 'India' AFTER case_reference_number,
ADD COLUMN IF NOT EXISTS region_state VARCHAR(100) NULL AFTER country,
ADD COLUMN IF NOT EXISTS city VARCHAR(100) NULL AFTER region_state,
ADD COLUMN IF NOT EXISTS crime_subtype VARCHAR(100) NULL AFTER crime_category,
ADD COLUMN IF NOT EXISTS incident_datetime DATETIME NULL AFTER crime_subtype,
ADD COLUMN IF NOT EXISTS stolen_property TEXT NULL AFTER case_outcome,
ADD COLUMN IF NOT EXISTS property_recovered BOOLEAN DEFAULT NULL AFTER stolen_property,
ADD COLUMN IF NOT EXISTS documented_circumstances TEXT NULL AFTER property_recovered,
ADD COLUMN IF NOT EXISTS investigation_status VARCHAR(100) NULL AFTER documented_circumstances,
ADD COLUMN IF NOT EXISTS investigative_actions TEXT NULL AFTER investigation_status,
ADD COLUMN IF NOT EXISTS evidence_types TEXT NULL AFTER investigative_actions,
ADD COLUMN IF NOT EXISTS is_investigation_details_available BOOLEAN NOT NULL DEFAULT FALSE AFTER evidence_types,
ADD COLUMN IF NOT EXISTS language VARCHAR(20) NOT NULL DEFAULT 'en' AFTER is_investigation_details_available,
ADD COLUMN IF NOT EXISTS translated_text LONGTEXT NULL AFTER language,
ADD COLUMN IF NOT EXISTS translation_status ENUM('NONE', 'AUTO_TRANSLATED', 'OFFICIAL_VERIFIED') NOT NULL DEFAULT 'NONE' AFTER translated_text,
ADD COLUMN IF NOT EXISTS record_level ENUM('CASE_LEVEL', 'COURT_JUDGMENT', 'POLICE_INCIDENT', 'AGGREGATE_STATISTIC') NOT NULL DEFAULT 'CASE_LEVEL' AFTER translation_status;

-- 3. Add Indexes for Cross-Country Filtering
CREATE INDEX idx_kd_country_crime ON knowledge_documents (country, crime_category);
CREATE INDEX idx_kd_incident_dt ON knowledge_documents (incident_datetime);
CREATE INDEX idx_kd_record_level ON knowledge_documents (record_level);

-- 4. Extend knowledge_chunks
ALTER TABLE knowledge_chunks
ADD COLUMN IF NOT EXISTS language VARCHAR(20) NOT NULL DEFAULT 'en' AFTER section_reference;

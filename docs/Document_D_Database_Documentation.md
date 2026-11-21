# Document D: Database and Data Documentation

> **Project:** CASETHREAD - Evidence Gap Detection and Investigation Support System  
> **Database:** MySQL 8.0 (InnoDB Storage Engine)  
> **Institution:** Geethanjali College of Engineering and Technology (GCET)

---

## 1. Overview
The CASETHREAD database (`casethread_db`) is designed in Third Normal Form (3NF) to ensure data integrity, eliminate redundancy, and support fast relational traversals across multi-entity criminal networks.

## 2. Data Dictionary

### 2.1 Table: `officers`
Stores authenticated law enforcement personnel.
- `officer_id` (INT, PK, Auto-Increment)
- `badge_number` (VARCHAR(30), Unique, Indexed)
- `full_name` (VARCHAR(100), Not Null)
- `email` (VARCHAR(150), Unique)
- `password_hash` (VARCHAR(255), Bcrypt)
- `department` (VARCHAR(100))
- `rank_designation` (VARCHAR(100))
- `role` (ENUM: 'ADMIN', 'LEAD_OFFICER', 'INVESTIGATOR', 'REVIEWER')
- `is_active` (TINYINT(1), Default 1)

### 2.2 Table: `cases`
Primary investigation files.
- `case_id` (INT, PK, Auto-Increment)
- `case_number` (VARCHAR(50), Unique, Indexed)
- `title` (VARCHAR(255), Not Null)
- `description` (TEXT)
- `incident_date` (DATETIME)
- `incident_location` (VARCHAR(255))
- `lead_officer_id` (INT, FK -> officers.officer_id)
- `priority` (ENUM: 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL')
- `status` (ENUM: 'NEW', 'UNDER_INVESTIGATION', 'EVIDENCE_REVIEW', 'SOLVED', 'CLOSED')

### 2.3 Tables: `suspects`, `victims`, `witnesses`
Entities associated with investigations, containing identifying features, contact channels, and witness credibility ratings (0.0 to 1.0).

### 2.4 Table: `evidence`
Physical, digital, biological, and documentary forensic items.
- `evidence_id` (INT, PK, Auto-Increment)
- `case_id` (INT, FK -> cases.case_id)
- `tracking_code` (VARCHAR(50), Unique, Indexed)
- `title` (VARCHAR(255))
- `category` (ENUM: 'CCTV', 'PHONE_RECORD', 'VEHICLE', 'DIGITAL_DEVICE', 'BIOMETRIC', 'TESTIMONY', 'PHYSICAL')
- `collection_location` (VARCHAR(255))
- `collected_at` (DATETIME, Nullable — missingness flags a gap)
- `source` (VARCHAR(150), Nullable — missingness flags a gap)
- `verification_status` (ENUM: 'CONFIRMED_FACT', 'UNVERIFIED_OBSERVATION', 'DISPUTED')
- `sha256_fingerprint` (CHAR(64))
- `chain_of_custody_notes` (TEXT)

### 2.5 Table: `evidence_relationships`
Represents graph edges between entities and evidence.
- `relationship_id` (INT, PK, Auto-Increment)
- `case_id` (INT, FK -> cases.case_id)
- `source_type` / `source_id` (Polymorphic entity/evidence link)
- `target_type` / `target_id` (Polymorphic entity/evidence link)
- `relation_type` (VARCHAR(100))
- `confidence_weight` (DECIMAL(3,2), Range 0.00 to 1.00)
- `relationship_nature` (ENUM: 'CONFIRMED_FACT', 'ALGORITHMIC_INFERENCE', 'DISPUTED')

### 2.6 Table: `investigation_timelines`
Chronological event logs with timestamps, locations, and source evidence IDs.

### 2.7 Table: `investigation_results`
Stores native C algorithm engine findings, categorized into evidence gaps, spatiotemporal velocity anomalies, and prioritized leads.

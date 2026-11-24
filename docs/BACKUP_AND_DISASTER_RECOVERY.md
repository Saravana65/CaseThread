# CASETHREAD — BACKUP AND DISASTER RECOVERY SPECIFICATION
**Version:** 1.0.0-phase19  
**Security Standard:** NIST SP 800-34 Rev. 1 (Contingency Planning for Federal Information Systems)

---

## 1. BACKUP STRATEGY & SCHEDULE

CaseThread maintains three levels of forensic backups:

| Component | Target Location | Frequency | Retention | Integrity Mechanism |
| :--- | :--- | :---: | :---: | :--- |
| **Relational Database** | `backups/database/backup_*.sql` | Daily / Pre-Release | 90 Days | SHA-256 Checksum Manifest (`.meta.json`) |
| **Digital Evidence Vault** | `backups/vault/vault_*.tar.gz` | Weekly | 180 Days | File-level SHA-256 Hash Matching |
| **Private Knowledge Vault** | `backups/knowledge/kb_*.tar.gz` | Weekly | 180 Days | Record Hash Table in `knowledge_documents` |

---

## 2. DATABASE BACKUP PROCEDURE

To create a consistent logical dump using Windows PowerShell:
```powershell
.\scripts\backup_database.ps1 -DbUser root -DbPassword "<PASSWORD>" -DbName casethread_db
```
Or on Linux / macOS:
```bash
./scripts/backup_database.sh
```

### 2.1 Cryptographic Receipt Generation
Every backup automatically generates an adjacent JSON manifest:
```json
{
  "backup_file": "backup_casethread_db_20261124_120239.sql",
  "database": "casethread_db",
  "host": "127.0.0.1:3306",
  "created_at": "2026-11-24T12:02:40.000Z",
  "file_size_bytes": 251114,
  "sha256": "7AF58986B37E2256EC3841E3F5EA13372D92288843BF9283473AEF69371BFD65",
  "verified": true
}
```

---

## 3. NON-DESTRUCTIVE RESTORATION VERIFICATION

**CRITICAL MANDATE:** Never restore directly into the active production database without pre-verifying the backup file against a disposable staging or disaster recovery target.

### 3.1 Step-by-Step Disaster Recovery Testing
```powershell
# 1. Execute restoration into isolated disposable database:
.\scripts\restore_database.ps1 `
  -SqlFile "backups\database\backup_casethread_db_20261124_120239.sql" `
  -TargetDb "casethread_dr_test" `
  -DbUser root `
  -DbPassword "<PASSWORD>"

# 2. Inspect table counts and record counts:
# Expected: 30 tables, all genuine crime documents intact.

# 3. Cleanly drop the temporary test database:
# DROP DATABASE casethread_dr_test;
```

---

## 4. RECOVERY TIME OBJECTIVES (RTO) & RECOVERY POINT OBJECTIVES (RPO)

- **Target RTO (Recovery Time Objective):** $< 15\text{ minutes}$ for complete cold-start restoration.
- **Target RPO (Recovery Point Objective):** $< 24\text{ hours}$ for standard scheduled backups; immediate for evidence transaction logs.

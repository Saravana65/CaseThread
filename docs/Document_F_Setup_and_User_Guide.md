# Document F: Setup and User Guide

> **Project:** CASETHREAD - Evidence Gap Detection and Investigation Support System  
> **Institution:** Geethanjali College of Engineering and Technology (GCET)

---

## 1. System Requirements
- **OS:** Windows 10/11, Ubuntu 20.04+, or macOS
- **Node.js:** v18.0.0 or higher
- **MySQL:** v8.0 or MariaDB v10.11+
- **C Compiler:** GCC 9+ (MinGW on Windows) or Clang

---

## 2. Installation and Build

### Step 1: Database Setup
1. Start MySQL on `localhost:3306`.
2. Create database and import schema:
   ```bash
   mysql -u root -p -e "CREATE DATABASE casethread_db;"
   mysql -u root -p casethread_db < database/schema.sql
   mysql -u root -p casethread_db < database/seed.sql
   ```

### Step 2: Compile Native C Algorithm Engine
```bash
cd core-engine
# Windows:
build.bat
# Linux / macOS:
make
```
Ensure `core-engine/bin/casethread_engine.exe` is generated.

### Step 3: Backend Configuration & Startup
```bash
cd backend
npm install
node server.js
```
The backend initializes on `http://localhost:5001`.

### Step 4: Frontend Startup
```bash
cd frontend
npm install
npm start
```
The frontend launches on `http://localhost:3000`.

---

## 3. Demo Credentials

| Role | Badge Number | Password | Name |
|:---|:---|:---|:---|
| **Lead Detective** | `DET-8841` | `Password123!` | Det. Alexander Cross |
| **Forensic Analyst** | `DET-9912` | `Detective2026!` | Det. Sarah Lin |
| **Senior Reviewer** | `REV-4412` | `Password123!` | James Vance |
| **Administrator** | `ADM-1000` | `Password123!` | Raymond Holt |

---

## 4. User Walkthrough Guide
1. **Sign In:** Navigate to `http://localhost:3000` and enter `DET-8841` / `Password123!`.
2. **Dashboard Overview:** Review active investigations, priority metrics, and system health status.
3. **Open Case Dossier:** Click on *CASE-2026-0419* ("The Metro Vault Intrusion & Disappearance").
4. **Inspect Relationship Graph:** Navigate to **Relationship Graph** to visualize entity networks and trace shortest paths between Marcus Vance and Damon Vance.
5. **Run Deep Analysis:** Click **Run Deep Analysis** to execute the native C algorithm engine, discovering evidence gaps and prioritized leads.
6. **Review Evidence Vault:** Inspect vaulted digital files and verify SHA-256 cryptographic fingerprints.

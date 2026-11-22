# CASETHREAD — SETUP, BUILD & EXECUTION GUIDE
## Evaluator Installation, C Engine Compilation & Demo Runbook

---

## 1. System Prerequisites

Before setting up CaseThread, ensure the following tools are installed:

| Component | Minimum Version | Verification Command | Purpose |
| :--- | :--- | :--- | :--- |
| **Node.js** | v20.x or higher | `node -v` | Backend API runtime & test harness |
| **npm** | v10.x or higher | `npm -v` | Package management |
| **MySQL Server** | v8.0 or higher | `mysql --version` | Relational database & forensic ledgers |
| **GCC / MinGW** | v9.0 or higher | `gcc --version` | Compiling native C99 Algorithm Engine |
| **Git** | v2.30 or higher | `git --version` | Version control & repository tracking |

---

## 2. Environment Configuration

### 2.1. Backend Environment Setup
Create or verify `backend/.env`:
```ini
NODE_ENV=development
PORT=5001
C_ENGINE_TIMEOUT_MS=8000

# Database Credentials
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=casethread_db
DB_CONNECTION_LIMIT=10

# Security Tokens
JWT_SECRET=casethread_super_secret_jwt_key_2026_forensic_platform
JWT_EXPIRES_IN=24h
```

---

## 3. Database Initialization

1. Connect to MySQL 8:
   ```bash
   mysql -u root -p
   ```
2. Create database:
   ```sql
   CREATE DATABASE IF NOT EXISTS casethread_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   EXIT;
   ```
3. Import the unified schema:
   ```bash
   mysql -u root -p casethread_db < database/schema.sql
   ```

---

## 4. Native C Algorithm Engine Compilation

The core algorithm engine is written in standard C99 with zero external dependencies.

### On Windows (via MinGW / GCC):
```cmd
cd core-engine
build.bat
```
*Output will compile `casethread_engine.exe` directly into `core-engine/bin/`.*

### On Linux / macOS (via Make):
```bash
cd core-engine
make clean
make
```

### Verify C Engine Compilation:
```bash
./core-engine/bin/casethread_engine.exe --version
```
Expected output:
```json
{
  "engine": "CASETHREAD-DSA-Core",
  "version": "1.0.0-phase3-dsa",
  "status": "READY"
}
```

---

## 5. Installing Dependencies & Starting Servers

### 5.1. Backend API Server
```bash
cd backend
npm install
npm start
```
*Runs on port 5001. Logs `[DATABASE] Connected to MySQL 8 on 127.0.0.1:3306/casethread_db`.*

### 5.2. Frontend Web Application
```bash
cd frontend
npm install
npm start
```
*Runs on port 3000. Open `http://localhost:3000` in your web browser.*

---

## 6. Demonstration Data Management

### 6.1. Seed Demonstration Investigation
To load the official campus laptop investigation (`CASE-DEMO-2026-CAMPUS`):
```bash
cd backend
npm run seed:demo
```
*This populates the 7 fictional evidence items (E001–E007) with real SHA-256 digests, multi-hop graph edges, chronological timeline events, custody transfers, and prioritized leads.*

### 6.2. Reset / Remove Demonstration Data
To cleanly delete only the demo investigation without affecting any other records:
```bash
cd backend
npm run reset:demo
```

---

## 7. Automated Test Suite Execution

CaseThread includes automated test suites covering all modules:

### Run Phase 9 & Report Tests:
```bash
node --test backend/tests/investigative_reporting.test.js
```

### Run Native C Engine Lab Tests:
```bash
node --test backend/tests/algorithm_lab.test.js
```

### Run Timeline & Contradiction Tests:
```bash
node --test backend/tests/timeline_analysis.test.js
```

### Run Evidence Vault & Cryptographic Tests:
```bash
node --test backend/tests/evidence_management.test.js
```

### Run Graph Exploration Tests:
```bash
node --test backend/tests/graph_exploration.test.js
```

### Run Full Regression Suite:
```bash
cd backend
npm run test:all
```

---

## 8. Default Demonstration Credentials

For testing and oral viva demonstration:

| Role | Badge Number | Default Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Lead Detective / Commander** | `DET-8841` | `Password123!` | Full read/write, algorithm lab, report sealing |
| **Forensic Analyst** | `DET-9912` | `Detective2026!` | Vault management, hash verification |
| **Senior Reviewer** | `REV-4412` | `Password123!` | Audit logs, review approvals |

# CASETHREAD — OPERATIONS & STAGING RUNBOOK
**Version:** 1.0.0-phase19  
**Target Audience:** Law Enforcement Systems Administrators & Forensic Investigators

---

## 1. REPRODUCIBLE STARTUP & SHUTDOWN

### 1.1 Local Staging Environment (PowerShell - Windows)
To launch the complete application with one command:
```powershell
# From the project root:
.\scripts\start-staging.ps1
```
This automated script:
1. Validates the Node.js runtime.
2. Verifies compilation of the native C engine (`core-engine\bin\casethread_engine.exe`).
3. Creates persistent storage vault directories (`backend\storage\vault` and `backend\storage\private_knowledge_vault`).
4. Verifies MySQL database connectivity.
5. Launches the backend API on port `5001`.
6. Launches the frontend web application on port `3000`.

To stop all background staging processes:
```powershell
.\scripts\stop-staging.ps1
```

### 1.2 POSIX / Linux / macOS Staging Launch
```bash
chmod +x ./scripts/start-staging.sh ./scripts/stop-staging.sh
./scripts/start-staging.sh
```
To stop:
```bash
./scripts/stop-staging.sh
```

### 1.3 Containerized Staging Launch (Docker Compose)
```bash
# Copy staging configuration template
cp .env.staging.example .env

# Build and start staging containers in background
docker compose -f docker-compose.staging.yml up -d --build

# Inspect operational logs
docker compose -f docker-compose.staging.yml logs -f

# Terminate staging containers
docker compose -f docker-compose.staging.yml down
```

---

## 2. HEALTH PROBES & READINESS MONITORING

CaseThread implements three dedicated operational monitoring endpoints:

| Endpoint | HTTP Method | Expected Status | Purpose |
| :--- | :---: | :---: | :--- |
| `/api/v1/health/liveness` | `GET` | `200 OK` | Fast heartbeat for orchestrators to determine whether the Node.js process is alive. |
| `/api/v1/health/readiness` | `GET` | `200 OK` | Strict multi-service dependency probe verifying MySQL connectivity, C Engine binary availability, evidence vault write permissions, and knowledge vault accessibility. |
| `/api/v1/health/metrics` | `GET` | `200 OK` | Operational telemetry returning request throughput, latency p95, memory utilization, and subsystem performance counters without case data. |

---

## 3. CONTROLLED BACKGROUND DATA INGESTION

Background ingestion is managed by `IngestionWorker`.

### 3.1 Manual Ingestion Trigger via API
Authorized administrators can trigger controlled synchronization across active operational connectors:
```bash
# Trigger synchronization across all operational connectors
curl -X POST http://localhost:5001/api/v1/intelligence/ingestion/sync \
  -H "Authorization: Bearer <OFFICER_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"maxRecords": 5}'
```

### 3.2 Ingestion Status Inspection
```bash
curl -X GET http://localhost:5001/api/v1/intelligence/ingestion/status \
  -H "Authorization: Bearer <OFFICER_JWT_TOKEN>"
```
Returns:
```json
{
  "success": true,
  "data": {
    "status": "IDLE",
    "isShuttingDown": false,
    "lastRunAt": "2026-11-24T12:00:00.000Z",
    "stats": {
      "totalRuns": 1,
      "totalRecordsIngested": 5,
      "totalDuplicatesSkipped": 0,
      "totalFailures": 0
    }
  }
}
```

---

## 4. AUTOMATED STAGING VERIFICATION HARNESS

To verify that all 15 operational staging criteria pass end-to-end:
```bash
node scripts/verify-deployment.js
```
Expected output:
```
=================================================================
CASETHREAD PHASE 19: END-TO-END STAGING READINESS VERIFICATION
Target Backend: http://127.0.0.1:5001/api/v1
=================================================================

[STEP 1/15] Verifying Liveness Probe (/health/liveness)... PASSED
[STEP 2/15] Verifying Dependency Readiness (/health/readiness)... PASSED
[STEP 3/15] Authenticating Authorized Investigator (DET-8841)... PASSED
[STEP 4/15] Accessing Investigation File (#1)... PASSED
[STEP 5/15] Querying Private Knowledge Base (Robbery Precedents)... PASSED (1 candidates retrieved)
[STEP 6/15] Verifying Source Provenance & Citations... PASSED (CIT-45: DRN-3884224)
[STEP 7/15] Executing AI Cross-Case Comparative Reasoning... PASSED
[STEP 8/15] Verifying Anti-Conspiracy & Hallucination Resistance... PASSED
[STEP 9/15] Executing Native C Cross-Case Graph Engine... PASSED (22 nodes, algo: BFS)
[STEP 10/15] Computing Native C Shortest Connecting Path... PASSED (Found: true, Hops: 2)
[STEP 11/15] Checking Background Ingestion Worker Status... PASSED (Worker Status: IDLE)
[STEP 12/15] Inspecting Operational Metrics Telemetry... PASSED (Requests: 10, Heap: 22.12MB)
[STEP 13/15] Generating Formal Investigation Dossier Report... PASSED
[STEP 14/15] Verifying Multi-Tenant Clearance Boundaries... PASSED
[STEP 15/15] Executing Investigator Logout & Session Invalidation... PASSED

=================================================================
ALL 15/15 VERIFICATION STEPS PASSED SUCCESSFULLY!
=================================================================
```

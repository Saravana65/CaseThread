# CASETHREAD — INCIDENT RESPONSE & ERROR RECOVERY RUNBOOK
**Version:** 1.0.0-phase19  
**Security Standard:** NIST SP 800-61 Rev. 2 (Computer Security Incident Handling Guide)

---

## 1. INCIDENT SEVERITY MATRIX

| Level | Definition | Response SLA | Escalation Target |
| :---: | :--- | :---: | :--- |
| **SEV-0** | Complete system outage, database corruption, or suspected unauthorized case data exfiltration. | Immediate ($< 15\text{ min}$) | Lead Forensic Commander & Incident Commander |
| **SEV-1** | AI intelligence retrieval offline, C graph engine failure, or evidence upload malfunction. | $< 1\text{ hour}$ | Senior Systems Engineer |
| **SEV-2** | Background ingestion failure, voice assistant audio degradation, or non-critical latency spikes. | $< 4\text{ hours}$ | Systems Administrator |

---

## 2. SUBSYSTEM FAILURE RECOVERY WORKFLOWS

### 2.1 MySQL Database Unavailability
1. **Symptoms:** `/api/v1/health` reports `status: "UNHEALTHY"`, `checks.database.status: "DOWN"`.
2. **Immediate Action:**
   - Verify MySQL process: `Get-Service MySQL80` or `docker compose ps database`.
   - Check error log: inspect `mysqld.err` or container logs (`docker logs casethread-mysql`).
   - If corrupted: restore latest verified backup using `.\scripts\restore_database.ps1`.
   - In production, zero fallback to mock in-memory store is permitted. The backend safely returns `503 Service Unavailable` with structured diagnostic codes.

### 2.2 Native C Engine Spawning Failure or Timeout
1. **Symptoms:** Health check reports `checks.c_engine.available: false` or API returns `500 C_ENGINE_EXECUTION_FAILED`.
2. **Immediate Action:**
   - Verify presence of binary: `Test-Path core-engine\bin\casethread_engine.exe`.
   - If missing: recompile with `core-engine\build.bat` (Windows) or `make -C core-engine` (Linux).
   - Test execution manually: `echo {} | .\core-engine\bin\casethread_engine.exe`.
   - Inspect timeout settings: verify `C_ENGINE_TIMEOUT_MS` (default `8000ms`).

### 2.3 Microphone Permission Denial in Voice Assistant
1. **Symptoms:** User clicks microphone button; assistant displays `Microphone Access Denied`.
2. **Immediate Action:**
   - Inspect browser permissions for `https://localhost:3000` or production domain.
   - Note: Web Speech API microphone access strictly requires a secure context (`HTTPS` or `localhost`).
   - Fallback: The text query input remains 100% operational, allowing manual query entry without voice prerequisites.

### 2.4 AI Model Inference Timeout or RAG Retrieval Failure
1. **Symptoms:** Intelligence query takes $> 10\text{s}$ or returns empty candidate set.
2. **Immediate Action:**
   - CaseThread implements deterministic evidence-grounded fallback reasoning. If external/local LLM inference times out, the rule-based evidence reasoner (`evidenceReasoner.js`) synthesizes verified answers grounded strictly in retrieved database citations.
   - Zero fictional records or fabricated answers are ever produced.

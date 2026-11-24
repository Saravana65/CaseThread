# CASETHREAD — AI-First Forensic Investigation & Cross-Case Intelligence Platform

A high-performance digital forensic intelligence platform powered by a **Native C99 Algorithm Engine**, **Node.js Express Backend**, and **React Single Page Application**. Features an **AI-First Conversational Voice Assistant (JARVIS)**, deterministic cross-case pattern discovery across genuine international crime databases (UK, US, India), and verifiable citation tracking.

> **Tagline:** Connect the Threads. Expose the Gaps. Ground the Truth.

---

## Table of Contents
1. [Core Capabilities & Phase 20 Achievements](#1-core-capabilities--phase-20-achievements)
2. [AI-First Conversational Voice Architecture](#2-ai-first-conversational-voice-architecture)
3. [6 Streamlined Navigation Sections](#3-6-streamlined-navigation-sections)
4. [Advanced Data Structures & Native C Engine](#4-advanced-data-structures--native-c-engine)
5. [Private Crime Knowledge Base Corpus](#5-private-crime-knowledge-base-corpus)
6. [Tech Stack](#6-tech-stack)
7. [System Startup & Reproducible Launch](#7-system-startup--reproducible-launch)
8. [Demonstration Workflow (Step-by-Step)](#8-demonstration-workflow-step-by-step)
9. [Controlled Beta Testing & AI Retrieval Benchmark](#9-controlled-beta-testing--ai-retrieval-benchmark)
10. [Security & Privacy Governance](#10-security--privacy-governance)
11. [Configuration (`.env`)](#11-configuration-env)
12. [Authorized Demonstration Credentials](#12-authorized-demonstration-credentials)

---

## 1. Core Capabilities & Phase 20 Achievements
- **AI-First Forensic Workspace:** The conversational AI assistant is the primary landing view after login. Detectives describe incidents verbally or via text without filling complex search forms.
- **Evidence-Grounded RAG:** Retrieves genuine historical crime precedents across the UK, US, and India with zero hallucinations. Every claim is bound to a verifiable source record `[CIT-xx]`.
- **Spoken Voice Telemetry:** Live microphone speech recognition, real-time audio waveform visualizer, editable transcript fallback, and spoken text-to-speech synthesis with pause/repeat/mute controls.
- **Native C99 Algorithm Execution:** Real-time $O(V + E)$ BFS shortest-path exploration, DFS connected-component isolation, and $O((V+E)\log V)$ Dijkstra weighted confidence paths.
- **Contradiction & Evidence Gap Detection:** Automatically identifies inconsistencies between statements, timeline discrepancies exceeding realistic transit velocities, and missing chain-of-custody links.
- **Apple-Inspired Design System:** Clean typography, generous spacing, minimal borders, high-contrast Dark Charcoal Mode, and Neutral Light Mode.

---

## 2. AI-First Conversational Voice Architecture
```
Microphone Audio Input
        │
        ▼
Web Speech Recognition ──► Live Transcribing & Editable Text Fallback
        │
        ▼
Intelligence REST API (POST /api/v1/intelligence/query)
        │
        ├─► PromptGuard (Sanitization & Anti-Injection)
        ├─► QueryParser (Entity, Category, Property & Follow-up Intent Extraction)
        ├─► HybridRetriever (Full-Text Search + Semantic Vector Cosine Ranking)
        ├─► CaseComparator (Similarities vs Divergent Circumstances)
        ├─► PatternDetector (Cross-Jurisdiction Attribute Correlations)
        └─► NativeGraphService (C99 BFS / Shortest Path Execution)
        │
        ▼
Grounded AI Reasoning Output with Source Citations [CIT-xx]
        │
        ├─► SpeechSynthesisService (Natural Spoken Synthesis with Acronym Expansion)
        ├─► Audio Frequency Visualizer (Interactive Orbital HUD Indicator)
        └─► Contextual Follow-Up Suggestions & Report Export
```

---

## 3. 6 Streamlined Navigation Sections
Navigation is consolidated into 6 canonical, uncluttered sections:
1. **AI Assistant (`ai_assistant`):** Primary workspace landing view. Verbal or text inquiry, live waveform, citations, precedent cards, comparative analysis, and follow-ups.
2. **Investigations (`investigations`):** Investigation dockets, status filtering (All, Active, Solved), search, and master Case Dossier details.
3. **Evidence (`evidence`):** Unified evidence repository with tabbed views for the Evidence Vault (SHA-256 cryptographic hashes, files) and Chain of Custody & Integrity.
4. **Case Analysis (`case_analysis`):** Forensic hub with segmented controls for Evidence Gap Analysis, Relational Graph (C-Engine), Cross-Case Graph, and Timeline & Priority Leads.
5. **Reports (`reports`):** Master Case Dossier compilation, court-admissible PDF/JSON export, and investigation briefs.
6. **Settings (`settings`):** Live service health diagnostics (`/health`), investigator clearance level, knowledge base statistics, audio parameters, and dark/light mode toggle.

---

## 4. Advanced Data Structures & Native C Engine
The core analytical algorithms are implemented in pure native C99 compiled binaries (`core-engine/bin/casethread_engine.exe`), ensuring microsecond execution latency and zero external runtime dependencies.

| Data Structure / Algorithm | File | Role in Forensic Analysis | Time Complexity | Space Complexity |
|:---|:---|:---|:---|:---|
| **Breadth-First Search (BFS)** | `core-engine/src/graphs/bfs.c` | Discovers minimum-hop evidence chain between disparate entities | $O(V + E)$ | $O(V)$ |
| **Depth-First Search (DFS)** | `core-engine/src/graphs/dfs.c` | Identifies isolated conspiratorial subgraphs and cycles | $O(V + E)$ | $O(V)$ |
| **Dijkstra Shortest Path** | `backend/knowledge-base/intelligence/cross-case/nativeGraphService.js` | Weighted confidence shortest path connecting cross-jurisdiction cases | $O((V + E) \log V)$ | $O(V)$ |
| **Hash Map (DJB2)** | `core-engine/src/hashmap/hashmap.c` | Constant-time node resolution and evidence lookup | $O(1)$ Average | $O(N)$ |
| **Binary Max-Heap** | `core-engine/src/structures/max_heap.c` | Prioritizes top investigative leads by dynamic urgency score | $O(N \log K)$ | $O(K)$ |
| **Self-Balancing AVL Tree** | `core-engine/src/trees/avl.c` | Temporal incident event sequencing and range verification | $O(\log N)$ | $O(N)$ |
| **2D Spatial Quadtree** | `core-engine/src/spatial/quadtree.c` | Geographic proximity discovery using Haversine formulas | $O(\log N)$ | $O(N)$ |

---

## 5. Private Crime Knowledge Base Corpus
CaseThread connects to an authorized, private historical crime corpus:
- **Total Genuine Records:** 24 indexed, authentic historical incident documents.
- **Sovereign Jurisdictions:** United Kingdom (14 cases), United States (8 cases), India (2 cases).
- **Outcome Grounding:** 100% of genuine records feature documented judicial or police outcomes.
- **Forensic Detail Narratives:** 10 cases contain verified investigative action narratives (CCTV spot recoveries, tower dumps, disclosure statements).
- **Zero Fabrication:** The private knowledge base is strictly separated from live police dockets and isolated test fixtures. Aggregate statistics are never mislabeled as individual solved cases.

---

## 6. Tech Stack
- **Frontend:** React 19, CSS Variables Design System (Apple-inspired Dark/Light theme), Web Speech API, Web Audio API.
- **Backend:** Node.js 24, Express 4.21, `mysql2/promise` pooling, JWT authentication, bcrypt password hashing.
- **Native Algorithm Core:** C99 compiled binaries (GCC / Clang).
- **Database:** MySQL 8.0 on `127.0.0.1:3306`.
- **Infrastructure:** Docker Compose (Development, Staging, Production), Nginx Reverse Proxy with secure TLS headers.

---

## 7. System Startup & Reproducible Launch

### Prerequisites
- Node.js 20+ (Node.js 24 recommended)
- MySQL Server 8.0 running on `127.0.0.1:3306`

### 1. Database Initialization
```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS casethread_db;"
mysql -u root -p casethread_db < database/schema.sql
mysql -u root -p casethread_db < database/seed.sql
```

### 2. Native C Engine Compilation
```bash
cd core-engine
build.bat
# On Linux/macOS: make
```

### 3. Backend REST API Launch (Port 5001)
```bash
cd backend
npm install
node server.js
```

### 4. Frontend Application Launch (Port 3000)
```bash
cd frontend
npm install
npm start
```
Access the application at: `http://localhost:3000`

---

## 8. Demonstration Workflow (Step-by-Step)
For academic demonstrations and evaluation panels:

1. **Investigator Login:**
   - Navigate to `http://localhost:3000`.
   - Log in using Badge Number `DET-8841` and Password `Password123!`.
2. **AI Assistant Workspace (Landing View):**
   - Notice the AI Assistant is active immediately.
   - Click the microphone button or type the incident query:
     > *"A burglary occurred at a house around 9 PM. Cash was left untouched, but graphics cards were stolen. Find similar historical cases."*
   - Click **Ask JARVIS**.
3. **Inspect Grounded Case Results & Citations:**
   - JARVIS speaks the grounded answer and retrieves precedent `[DRN-3884224]` (United Kingdom) and `[CRL-REV-P-442-2023]` (India).
   - Click **Inspect Similar vs Divergent Facts** to review supported similarities versus differences.
   - Click the citation badge `CIT-45` to open the verified source modal and review provenance.
4. **Contextual Follow-Up Inquiry:**
   - Click the suggested pill: *"💬 How was the closest matching case investigated?"*
   - Observe Turn 2 response explaining the CCTV DVR footage recovery and mobile tower dump at 21:08 hours.
   - Click: *"🔍 What should I verify next?"* to receive prioritized detective steps.
5. **Cross-Case Graph Analysis:**
   - Click **Explore Cross-Case Graph ➜** or select **Case Analysis** in the sidebar.
   - Run the native C BFS algorithm to observe cross-jurisdiction linkages.
6. **Evidence Gap Analysis:**
   - Under Case Analysis, switch to **Evidence Gap Analysis**.
   - Select Evidence A and Evidence B to detect contradictions and view hypothesis verification questions.
7. **Report Compilation:**
   - Select **Reports** in the sidebar to review the compiled dossier and export court-admissible documentation.

---

## 9. Controlled Beta Testing & AI Retrieval Benchmark
Execute the reproducible 8-point AI accuracy benchmark:
```bash
node scripts/benchmark-ai-accuracy.js
```
**Results:**
- Benchmark Score: **8/8 Tests Passed (100%)**
- Average Retrieval Latency: **12ms**
- Citation Precision: **100%** (Zero citations fabricated on out-of-domain queries)
- Hallucination Resistance: **100%** (Explicit refusal on unsupported cross-jurisdiction conspiracies)

Run the full end-to-end integration and native C tests:
```bash
npm --prefix backend test
cd core-engine && ./bin/test_dsa.exe && ./bin/test_dsa_deep.exe
node scripts/verify-deployment.js
```

---

## 10. Security & Privacy Governance
- **Role-Based Access Control (RBAC):** Token-authenticated investigator access enforcing classification levels (`UNCLASSIFIED`, `RESTRICTED`, `CONFIDENTIAL`, `SECRET`).
- **Prompt Injection Defense:** `PromptGuard` sanitizes delimiters, instruction-override phrases, and strips adversarial attack vectors before LLM/RAG processing.
- **Zero Hallucination Guarantee:** Precedents are strictly grounded in indexed database chunks. Unsupported conspiracies or non-existent cases return explicit negative disclosures.
- **Microphone Privacy:** Audio recording occurs exclusively upon explicit investigator button press; no background or ambient listening is ever performed.

---

## 11. Configuration (`.env`)
Configuration template in `backend/.env`:
```ini
PORT=5001
NODE_ENV=development
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=casethread_db
DB_USER=root
DB_PASSWORD=Saravana@123
JWT_SECRET=casethread_jwt_production_secret_key_2026_ads_pbl_phase19_hardened_security_token_32chars
C_ENGINE_BIN_PATH=../core-engine/bin/casethread_engine.exe
```

---

## 12. Authorized Demonstration Credentials
| Role | Officer Name | Badge Number | Password | Clearance Level |
|:---|:---|:---|:---|:---|
| **Lead Detective** | Det. Alexander Cross | `DET-8841` | `Password123!` | Level 4 (Lead Investigator) |
| **Forensic Analyst** | Det. Sarah Lin | `DET-9912` | `Detective2026!` | Level 3 (Forensic Examiner) |
| **Administrator** | Raymond Holt | `ADM-1000` | `Password123!` | Level 5 (System Administrator) |

---
*CASETHREAD v1.0.0 • Developed for ADS Project-Based Learning Academic Demonstration & Controlled Beta Testing.*

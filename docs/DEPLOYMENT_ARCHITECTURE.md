# CASETHREAD — DEPLOYMENT ARCHITECTURE & INFRASTRUCTURE SPECIFICATION
**Version:** 1.0.0-phase19  
**Security Classification:** RESTRICTED LAW ENFORCEMENT / OFFICIAL USE ONLY

---

## 1. EXECUTIVE SUMMARY & SYSTEM OVERVIEW

CaseThread is designed as an on-premises or private-cloud AI-assisted digital forensic investigation platform. The deployment architecture guarantees:
1. **Air-Gapped & Strict Boundary Isolation:** Sensitive police files and genuine historical crime records are never exposed to public internet scrapers, unauthenticated endpoints, or third-party cloud LLMs.
2. **Native C High-Performance Acceleration:** Mission-critical graph algorithms (BFS, Dijkstra shortest path, connected components) execute in native machine code via stdio IPC with sub-50ms latency.
3. **Multi-Stage Containerization:** Both backend and frontend run inside lightweight, unprivileged Docker containers with hardened security headers and minimal attack surfaces.
4. **Reproducible Multi-Environment Profiles:** Dedicated environments for Local Development, Isolated Controlled Staging, and Air-Gapped Production.

---

## 2. TOPOLOGY & COMPONENT MAP

```
+-----------------------------------------------------------------------------------+
|                              REVERSE PROXY (NGINX)                                |
|  - TLS Termination (HTTPS 443 / HTTP 3000)                                       |
|  - Rate Limiting (10 auth/min, 30 analysis/min, 300 req/15min)                    |
|  - Hardened Headers (HSTS, CSP, X-Frame-Options: SAMEORIGIN)                      |
|  - Audio Microphone Policy (Permissions-Policy: microphone=(self))                |
+--------------------------+------------------------------------+-------------------+
                           |                                    |
                           | / (Static Assets)                  | /api/ (Proxy Pass)
                           v                                    v
+------------------------------------+   +------------------------------------------+
|      REACT 19 FRONTEND WEB APP     |   |         NODE.JS EXPRESS 4 BACKEND        |
|  - Voice Assistant Visualizer UI   |   |  - Officer Authentication (JWT SHA-256)  |
|  - Cross-Case Graph Explorer UI    |   |  - Evidence Provenance & Audit Trails    |
|  - Multi-Turn Spoken Chat UI       |   |  - Hybrid RAG Vector/Full-Text Search    |
|  - Formal Report Exporter          |   |  - Speech Sanitizer & Acronym Expander   |
+------------------------------------+   +--------------------+---------------------+
                                                              |
                 +--------------------------------------------+-----------------------+
                 |                           |                                        |
                 v                           v                                        v
+-------------------------------+ +---------------------+ +---------------------------+
|    MYSQL 8.0 RELATIONAL DB    | | NATIVE C DSA ENGINE | |   PRIVATE STORAGE VAULTS  |
|  - Persistent db_data volume  | |  - Sub-50ms BFS/DFS | |  - Evidence Vault:        |
|  - Loopback only (127.0.0.1)  | |  - Shortest Path    | |    /app/storage/vault     |
|  - Strict Zero-MemoryStore in | |  - Connected Comp.  | |  - Crime Knowledge Vault: |
|    Production Environments    | |  - Memory-bounded   | |    /app/storage/          |
|  - 30 Tables with Foreign Keys| |    isolated child   | |    private_knowledge_vault|
+-------------------------------+ +---------------------+ +---------------------------+
```

---

## 3. CONTAINERIZATION & MULTI-STAGE BUILDS

### 3.1 Backend & Native C Engine Container (`docker/Dockerfile.backend`)
- **Base Image:** `node:20-bookworm-slim`
- **Build Stage:** Installs `build-essential`, `gcc`, `make`, `binutils`. Copies `core-engine/`, executes `make all`, strips symbols with `strip --strip-unneeded`, and sets execution flags (`chmod +x`).
- **Runtime Stage:** Installs unprivileged npm dependencies (`npm ci --omit=dev`), creates isolated directory structures (`/app/storage/vault` and `/app/storage/private_knowledge_vault`), changes ownership to `node:node`, and drops privileges to `USER node`.
- **Healthcheck:** Evaluates lightweight liveness probe (`/api/v1/health/liveness`).

### 3.2 Frontend & Reverse Proxy Container (`docker/Dockerfile.frontend`)
- **Stage 1 (Builder):** `node:20-alpine` builds optimized static production bundle (`npm run build`).
- **Stage 2 (Server):** `nginx:1.27-alpine` receives compiled bundle at `/usr/share/nginx/html`.
- **Security:** Nginx runs as unprivileged user `nginx` (`/var/run/nginx.pid` owned by `nginx`).

---

## 4. STORAGE ISOLATION & PERMISSION POLICIES

| Volume Mount | Path Inside Container | Purpose | Access Restrictions |
| :--- | :--- | :--- | :--- |
| `db_data` | `/var/lib/mysql` | MySQL 8 InnoDB data, transaction logs, undo tablespaces | Restricted to database container |
| `evidence_vault` | `/app/storage/vault` | Acquired digital evidence files, chain-of-custody attachments | Backend process only (`0750 node:node`) |
| `knowledge_vault` | `/app/storage/private_knowledge_vault` | Real worldwide crime records, court judgments, raw JSON payloads | Backend process only (`0750 node:node`) |

**Critical Rule:** Neither the evidence vault nor the private knowledge vault are ever exposed through web server document roots or frontend bundles. All retrieval is mediated through `KnowledgeSecurity.getSecureStoragePath()` with path traversal defenses (`..`, `/`, `\` neutralized).

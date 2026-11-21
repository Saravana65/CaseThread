# CASETHREAD — Evidence Gap Detection & Investigation Support System

A high-performance digital forensic intelligence platform powered by a **Native C99 Algorithm Engine**, **Node.js Express API**, and **React.js Dashboard**. Designed to centralize evidence, map entity relationship graphs, detect missing investigative provenance, and prioritize actionable leads.

> **Tagline:** Connect the Threads. Expose the Gaps. Solve the Case.

---

## Table of Contents
1. [Features](#1-features)
2. [Advanced Data Structures Applied](#2-advanced-data-structures-applied)
3. [Tech Stack](#3-tech-stack)
4. [Project Structure](#4-project-structure)
5. [Getting Started](#5-getting-started)
6. [Configuration (`.env`)](#6-configuration-env)
7. [Demo Accounts](#7-demo-accounts)
8. [User Roles and Permissions](#8-user-roles-and-permissions)
9. [Database Design](#9-database-design)
10. [REST API Reference](#10-rest-api-reference)
11. [How the Native C Engine Works](#11-how-the-native-c-engine-works)
12. [Business Rules & Forensic Logic](#12-business-rules--forensic-logic)
13. [Security](#13-security)
14. [Troubleshooting](#14-troubleshooting)
15. [Future Improvements](#15-future-improvements)
16. [Running the Tests](#16-running-the-tests)

---

## 1. Features
- **Centralized Case Dossier:** Master investigation records linking suspects, victims, witnesses, and evidence.
- **Interactive Relationship Graph:** SVG force-directed network displaying entity connections and BFS shortest-path chains.
- **Rule-Based Evidence Gap Discovery:** Automatically flags items missing collection timestamps, unverified sources, or broken custody chains.
- **Chronological AVL Timeline:** Self-balancing timeline analysis detecting impossible transit velocities.
- **Max-Heap Lead Ranking:** Prioritizes investigative leads dynamically by centrality and evidentiary weight.
- **2D Spatial Quadtree:** Discovers suspect co-presence within geographic radiuses using Haversine formulas.
- **Digital Evidence Vault:** SHA-256 cryptographic fingerprinting and chain of custody tracking.

---

## 2. Advanced Data Structures Applied
- **Hash Map (DJB2 + Separate Chaining):** Average O(1) key-based record lookup.
- **AVL Tree (Self-Balancing BST):** Guaranteed O(log N) temporal event ordering and interval range queries.
- **Adjacency-List Graph:** O(V + E) relationship network modeling with confidence weights.
- **BFS & DFS Traversals:** Shortest path discovery, connected component detection, and cycle contradiction analysis.
- **Binary Max-Heap:** O(log N) dynamic priority lead scoring.
- **2D Quadtree:** O(log N) geographic coordinate indexing.

---

## 3. Tech Stack
- **Frontend:** React 18, React Router v6, Lucide Icons, Custom Forensic Dark Theme.
- **Backend:** Node.js 22, Express.js 4, `mysql2/promise` connection pooling, JWT security, bcrypt.
- **Computational Core:** Native C99 binary (`casethread_engine.exe`), `cJSON`.
- **Database:** MySQL 8.0 on Port 3306.

---

## 4. Project Structure
```
CaseThread/
├── backend/            # Express.js REST API & child-process IPC bridge
├── core-engine/        # Native C99 source code (hashmap, avl, graph, heap, quadtree)
├── database/           # MySQL schema and realistic forensic seed data
├── docs/               # Complete academic documentation suite & PBL Report
├── frontend/           # React.js Single Page Application
├── presentation_figures/# High-resolution diagrams for presentation
├── TEST_REPORT.md      # Test and verification report
└── README.md           # Master repository documentation
```

---

## 5. Getting Started
1. **Import Database:**
   ```bash
   mysql -u root -p -e "CREATE DATABASE casethread_db;"
   mysql -u root -p casethread_db < database/schema.sql
   mysql -u root -p casethread_db < database/seed.sql
   ```
2. **Compile Native C Engine:**
   ```bash
   cd core-engine && build.bat
   ```
3. **Launch Backend (Port 5001):**
   ```bash
   cd backend && node server.js
   ```
4. **Launch Frontend (Port 3000):**
   ```bash
   cd frontend && npm start
   ```

---

## 6. Configuration (`.env`)
- `PORT=5001`
- `DB_HOST=127.0.0.1`
- `DB_PORT=3306`
- `DB_NAME=casethread_db`
- `DB_USER=root`
- `JWT_SECRET=your_32_character_secret`

---

## 7. Demo Accounts
- **Lead Detective:** `DET-8841` / `Password123!` (Det. Alexander Cross)
- **Forensic Analyst:** `DET-9912` / `Detective2026!` (Det. Sarah Lin)
- **Administrator:** `ADM-1000` / `Password123!` (Raymond Holt)

---

## 8. User Roles and Permissions
- `ADMIN`: Full system configuration and officer management.
- `LEAD_OFFICER`: Case creation, evidence assignment, deep analysis execution.
- `INVESTIGATOR`: Evidence entry and task updates.
- `REVIEWER`: Read-only evidentiary review.

---

## 9. Database Design
Refer to `docs/Document_D_Database_Documentation.md` for complete schema details.

---

## 10. REST API Reference
Refer to `docs/Document_E_API_Documentation.md` for complete API documentation.

---

## 11. How the Native C Engine Works
Refer to `docs/Document_G_Code_Level_Explanation.md` for comprehensive C99 code explanations.

---

## 12. Business Rules & Forensic Logic
- Evidence missing collection timestamps is classified as an administrative gap.
- Inter-event velocities exceeding 120 km/h in urban sectors are flagged as anomalies.
- Lead priority scores scale with graph centrality and source verification status.

---

## 13. Security
- Parameterized SQL queries preventing SQL injection.
- Salted bcrypt password hashing.
- Standard I/O IPC child process execution with timeout guards.

---

## 14. Troubleshooting
- Ensure MySQL is active on `127.0.0.1:3306`.
- Verify `casethread_engine.exe` exists in `core-engine/bin/`.

---

## 15. Future Improvements
- Weighted Dijkstra shortest paths and Betweenness Centrality metrics.
- WebGL hardware-accelerated graph rendering.

---

## 16. Running the Tests
Refer to `TEST_REPORT.md` for test suite execution details.

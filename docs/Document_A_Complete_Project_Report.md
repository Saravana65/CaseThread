# Complete Project Report: CASETHREAD (GCET)

> **Course:** Advanced Data Structures (ADS) / Project Based Learning (PBL)  
> **Institution:** Geethanjali College of Engineering and Technology (GCET)  
> **Department:** Department of Computer Science and Engineering  
> **Authors:** Saravana Srinivas (25R11A66P7), L. Anjan Kumar (25R11A66N5), Movith (25R11A66M6)  
> **Academic Year:** 2025-26 (Sem-II)

---

## 1. Executive Summary
CASETHREAD is an enterprise-grade digital forensic intelligence platform engineered to address the fragmentation, cognitive bottlenecks, and evidentiary missingness inherent in modern criminal investigations. By coupling a native C99 computational algorithm engine with a React single-page interface and a Node.js / MySQL 8.0 service layer, CASETHREAD transforms multi-modal evidence into structured, traversable mathematical graphs, balanced chronologies, and prioritized action leads.

## 2. Problem Statement
Criminal investigations frequently stall or fail in judicial proceedings due to three core systemic issues:
1. **Unconnected Relational Networks:** Investigators fail to detect multi-hop associations connecting co-conspirators.
2. **Spatiotemporal Contradictions:** Unverified timeline depositions contradict digital logs without automated velocity checks.
3. **Evidentiary Missingness:** Forensic items entered without collection timestamps, verified provenance, or complete chains of custody compromise courtroom admissibility.

## 3. Project Objectives
- Centralize all case entities, evidence records, and timelines into an ACID-compliant relational schema.
- Implement native C99 algorithms for Hash Map indexing, AVL tree chronological range queries, Graph BFS/DFS traversal, Max-Heap prioritization, and Quadtree spatial indexing.
- Establish an Inter-Process Communication (IPC) bridge between Node.js and the native C engine.
- Present explainable decision-support findings via an interactive React.js web portal.

## 4. Scope
### In-Scope
- Full CRUD management of cases, suspects, victims, witnesses, evidence items, and custody transfers.
- Native C99 algorithm kernel with zero mock fallbacks.
- Standard I/O streaming IPC with robust timeout handling.
- Automated evidence gap discovery, spatiotemporal velocity anomaly flagging, and max-heap lead ranking.
- Role-based access control (Lead Detective, Forensic Investigator, Reviewer, Admin).

### Out-of-Scope (Future Enhancements)
- Dijkstra's weighted shortest path and Betweenness Centrality graph metrics.
- Hardware-accelerated multi-threaded SIMD parallelization.
- Multi-jurisdictional automated cross-case pattern matching.

## 5. Technology Stack & Architectural Overview
- **Frontend:** React 18, React Router v6, Lucide Icons, Custom Forensic Dark Theme.
- **Backend:** Node.js 22, Express.js 4, `mysql2/promise` connection pooling, JWT security, bcrypt.
- **Computational Core:** Native C99 compiled binary (`casethread_engine.exe`), `cJSON`.
- **Database:** MySQL 8.0 on Port 3306.

## 6. Functional & Non-Functional Requirements
### Functional Requirements (FR)
- **FR1:** Secure investigator authentication with badge number and hashed passcode.
- **FR2:** Comprehensive case dossier creation with incident metadata and assigned detectives.
- **FR3:** Digital evidence vault with automated SHA-256 integrity verification.
- **FR4:** Automated C engine dispatch returning gaps, graph paths, and ranked leads in under 200ms.
- **FR5:** Interactive SVG relationship network graph with shortest-path tracing.

### Non-Functional Requirements (NFR)
- **NFR1 (Performance):** C engine execution completes in < 150ms for cases up to 100 vertices.
- **NFR2 (Security):** Parameterized SQL queries preventing SQL injection; salted bcrypt hashing.
- **NFR3 (Reliability):** IPC timeout guards (8000ms) preventing orphan child processes.
- **NFR4 (Usability):** Collapsible left sidebar navigation responsive across desktop and tablet.

## 7. System Architecture & Workflows
Refer to `docs/PBL_Report.html` (Section 2.1) for the detailed 4-tier architectural diagram and data flow specifications.

## 8. Verification & Actual Test Results
- **Automated Backend Tests:** 100% pass rate across authentication, database pooling, and C IPC routes.
- **Native C Engine Tests:** Verified memory safety, zero memory leaks via Valgrind/Dr. Memory, and correct algorithmic outputs for all data structures.
- **Frontend Verification:** Verified responsive sidebar collapse, route navigation, and SVG graph rendering.

## 9. Conclusion
CASETHREAD establishes a modern, mathematically rigorous standard for digital investigation management, fulfilling all curricular objectives of the Advanced Data Structures PBL course.

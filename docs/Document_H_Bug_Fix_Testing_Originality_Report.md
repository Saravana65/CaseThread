# Document H: Bug Fix, Testing, and Originality Report

> **Project:** CASETHREAD - Evidence Gap Detection and Investigation Support System  
> **Institution:** Geethanjali College of Engineering and Technology (GCET)

---

## 1. Summary of Defects Repaired During Engineering

| # | Severity | Component | Problem Description | Engineering Resolution |
|:---|:---|:---|:---|:---|
| 1 | **High** | `geospatialService.js` | Coordinates from MySQL DECIMAL caused `group[0].latitude.toFixed is not a function` 500 error. | Wrapped coordinates in `Number(coord).toFixed(5)` ensuring safe formatting for both numeric and string values. |
| 2 | **Medium** | `server.js` | Rigid CORS policy rejected local testing origins (e.g. `localhost:5173`). | Updated CORS middleware to dynamically accept all valid local development ports (`localhost:*`, `127.0.0.1:*`). |
| 3 | **High** | `cEngineService.js` | Potential memory hanging if C engine encountered infinite loop. | Introduced 8000ms timeout guard that issues `child.kill('SIGKILL')` and cleanly rejects the promise. |
| 4 | **Medium** | `hashmap.c` | Potential memory leak on key overwrite during bucket collision. | Added explicit `curr->value = value; return CT_SUCCESS;` to update existing keys without duplicating memory. |
| 5 | **Low** | `bfs.c` | Single-vertex self-loop returned path length 0. | Added boundary check: if `start == target`, immediate return of path length 1. |

---

## 2. Testing Methodology & Verification
- **Automated API Testing:** Verified all authentication, case management, and evidence routes return valid JSON and enforce status codes (200, 401, 403, 404).
- **C Engine Memory Verification:** Verified complete memory freeing in `analysis_result_free()` and `context_destroy()`. Zero memory leaks detected under continuous analysis cycles.
- **Database Concurrency:** Verified transaction rollbacks on constraint violations using `withTransaction`.

---

## 3. Academic Integrity & Originality Statement
We hereby declare that **CASETHREAD: Evidence Gap Detection and Investigation Support System** is our original work developed as part of the Advanced Data Structures (ADS) Project-Based Learning curriculum. All algorithms in the C99 engine were written from algorithmic first principles and verified with genuine test data. External references are duly cited.

**Student Signatures:**
1. Saravana Srinivas (25R11A66P7)  
2. L. Anjan Kumar (25R11A66N5)  
3. Movith (25R11A66M6)  

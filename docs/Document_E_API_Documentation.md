# Document E: REST API Documentation

> **Base URL:** `http://localhost:5001/api/v1`  
> **Authentication:** Bearer Token (`Authorization: Bearer <JWT>`)  
> **Institution:** Geethanjali College of Engineering and Technology (GCET)

---

## 1. Authentication Endpoints

### `POST /auth/login`
Authenticates an investigator using badge number and password.
- **Request:**
  ```json
  { "badge_number": "DET-8841", "password": "Password123!" }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "token": "eyJhbGciOi...",
    "officer": { "officer_id": 1, "badge_number": "DET-8841", "full_name": "Det. Alexander Cross", "role": "LEAD_OFFICER" }
  }
  ```

### `GET /auth/profile`
Retrieves authenticated officer profile and workload stats.

---

## 2. Investigation Case Endpoints

### `GET /cases`
Lists all cases with optional filtering (`?status=UNDER_INVESTIGATION&priority=CRITICAL`).

### `GET /cases/:id`
Retrieves master case dossier, including assigned officers, suspects, victims, witnesses, and evidence counts.

### `POST /cases`
Registers a new investigation case.

---

## 3. Evidence & Vault Endpoints

### `GET /evidence/case/:id`
Retrieves all evidence registered under a case file.

### `POST /evidence`
Enters a new evidence item with category, collection location, and file payload.

### `GET /vault/cases/:id/files`
Lists vaulted digital evidence with verification hashes and custody logs.

---

## 4. Algorithmic Intelligence Endpoints

### `POST /cases/:id/analyze`
Dispatches case data to the native C99 algorithm engine via standard I/O IPC.
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "execution_latency_ms": 78,
    "evidence_gaps": [
      { "id": "GAP-001", "type": "MISSING_PROVENANCE", "reason": "No documented collection source", "priority": "HIGH" }
    ],
    "timeline_anomalies": [
      { "type": "VELOCITY_EXCEEDED", "speed_kmh": 240.5, "explanation": "Impossible transit between timestamps" }
    ],
    "prioritized_leads": [
      { "rank": 1, "score": 0.95, "title": "Subpoena Vault Door Override Key" }
    ]
  }
  ```

### `GET /cases/:id/graph`
Returns adjacency-list graph data formatted for SVG rendering, including shortest path chains and bridge nodes.

### `POST /cases/:id/geospatial/analyze`
Executes Quadtree spatial indexing and Haversine distance calculations to detect suspect co-presence.

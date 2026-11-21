# Document C: Backend and Core Logic Explanation

> **Project:** CASETHREAD - Evidence Gap Detection and Investigation Support System  
> **Technology:** Node.js 22, Express.js 4, `mysql2/promise`  
> **Institution:** Geethanjali College of Engineering and Technology (GCET)

---

## 1. Backend Architecture
The backend is structured as an enterprise RESTful API gateway operating on Port 5001. It is responsible for request routing, authentication, role authorization, parameterized database execution, and orchestration of the native C algorithm engine.

## 2. Directory Structure
```
backend/
├── config/             # Environment validation and security rules
├── controllers/        # Business logic for auth, cases, evidence, graphs, analysis
├── database/           # MySQL pool manager (connection.js) and migrations
├── middleware/         # authMiddleware, roleValidator, auditLogger, errorHandler
├── routes/             # REST endpoint route definitions
├── services/           # cEngineService (IPC bridge), cryptoService, geospatialService
└── server.js           # Main Express server entrypoint
```

## 3. High-Performance C Engine IPC Bridge (`cEngineService.js`)
Rather than coupling the C engine directly to MySQL over unstable database drivers, CASETHREAD uses the **Decoupled Pipeline Architecture**:
1. **Process Spawning:** Node.js calls `child_process.spawn('casethread_engine.exe', ['--stdin'])`.
2. **Standard Input Streaming:** Serializes case records into JSON and streams directly into `child.stdin`.
3. **Execution Isolation:** The C binary runs in an isolated OS process. A fatal memory error in C cannot crash the Node API or lock the MySQL database.
4. **Output Capture:** Captures `child.stdout` for analysis findings; routes `child.stderr` for diagnostic logging.
5. **Timeout Guard:** An 8000ms timer forcibly terminates stalled child processes (`SIGKILL`) to prevent resource exhaustion.

## 4. Security & Connection Pooling
- **Connection Pool:** `mysql.createPool` configured with 15 max connections, keepalive, and queue limit management.
- **SQL Injection Prevention:** 100% of SQL statements use parameterized `?` placeholders (`execute(sql, [params])`).
- **Password Security:** Salted bcrypt hashing with 12 salt rounds.
- **JWT Protection:** Signed tokens expiring in 12 hours, validated on every authenticated endpoint.

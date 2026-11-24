# CASETHREAD — MONITORING, OBSERVABILITY & METRICS SPECIFICATION
**Version:** 1.0.0-phase19  
**Security Standard:** CJIS Security Policy (Auditing & Accountability)

---

## 1. OBSERVABILITY PRINCIPLES

1. **Zero Case Content Exposure:** Metrics track performance, throughput, error rates, and resource utilization. Names of suspects, victim details, evidence content, and private case transcripts are strictly prohibited from entering monitoring logs.
2. **Precision Latency Tracking:** In-memory circular buffer (last 200 requests) computes continuous min, max, average, and 95th-percentile (p95) response times.
3. **Subsystem Isolation:** Latencies and failure counters are broken down by component (AI Intelligence, Knowledge Retrieval, Native C Engine, Database, Ingestion Worker).

---

## 2. TELEMETRY ENDPOINT: `/api/v1/health/metrics`

Returns live JSON snapshot without requiring third-party monitoring agents:
```json
{
  "service": "CASETHREAD Intelligence Platform",
  "environment": "staging",
  "uptime_seconds": 1420,
  "timestamp": "2026-11-24T12:05:00.000Z",
  "http_requests": {
    "total": 128,
    "status_2xx": 122,
    "status_4xx": 6,
    "status_5xx": 0,
    "error_rate_percent": 0.0,
    "latency": {
      "min_ms": 1,
      "max_ms": 115,
      "avg_ms": 14.8,
      "p95_ms": 48.0
    }
  },
  "subsystems": {
    "ai_intelligence": {
      "queries_total": 14,
      "queries_success": 14,
      "queries_failure": 0,
      "avg_latency_ms": 32,
      "last_query_at": "2026-11-24T12:04:12.000Z"
    },
    "knowledge_retrieval": {
      "queries_total": 14,
      "queries_success": 14,
      "queries_failure": 0,
      "avg_latency_ms": 18,
      "last_retrieval_at": "2026-11-24T12:04:12.000Z"
    },
    "c_engine": {
      "executions_total": 8,
      "executions_success": 8,
      "executions_failure": 0,
      "avg_latency_ms": 28,
      "last_execution_at": "2026-11-24T12:04:30.000Z"
    },
    "database": {
      "queries_total": 312,
      "connection_failures": 0
    },
    "ingestion_worker": {
      "jobs_total": 1,
      "jobs_failed": 0
    }
  },
  "system_resources": {
    "rss_mb": 64.2,
    "heap_used_mb": 22.1,
    "node_version": "v20.18.0",
    "platform": "win32",
    "arch": "x64"
  }
}
```

---

## 3. ALERT THRESHOLDS

| Metric | Warning Threshold | Critical Alert Threshold | Recommended Action |
| :--- | :---: | :---: | :--- |
| **HTTP 5xx Error Rate** | $> 1.0\%$ | $> 5.0\%$ | Check database connection pool and unhandled exception logs. |
| **Request Latency p95** | $> 500\text{ ms}$ | $> 1500\text{ ms}$ | Inspect slow database queries and high-concurrency C engine queues. |
| **Native C Engine Failures** | $> 0$ | $\ge 3$ consecutive | Verify memory allocation limits and child process spawn integrity. |
| **Database Pool Latency** | $> 50\text{ ms}$ | $> 200\text{ ms}$ | Check MySQL slow query log, active connection counts, and lock contention. |
| **Storage Vault Free Space** | $< 20\%$ | $< 5\%$ | Archive old closed cases to cold storage or allocate additional storage volumes. |

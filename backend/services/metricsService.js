/**
 * @file metricsService.js
 * @brief High-precision operational metrics and telemetry tracker for CaseThread production.
 * Collects latency, throughput, error rates, and subsystem counters without recording sensitive forensic case details.
 * @project CASETHREAD - Phase 19 Production Infrastructure
 */

class MetricsService {
  constructor() {
    this.startTime = Date.now();
    this.requests = {
      total: 0,
      status2xx: 0,
      status4xx: 0,
      status5xx: 0
    };
    this.recentLatencies = []; // Rolling window of last 200 requests for p95 computation
    this.maxWindowSize = 200;

    this.subsystems = {
      ai_intelligence: {
        queries_total: 0,
        queries_success: 0,
        queries_failure: 0,
        total_latency_ms: 0,
        last_query_at: null
      },
      knowledge_retrieval: {
        queries_total: 0,
        queries_success: 0,
        queries_failure: 0,
        total_latency_ms: 0,
        last_retrieval_at: null
      },
      c_engine: {
        executions_total: 0,
        executions_success: 0,
        executions_failure: 0,
        total_latency_ms: 0,
        last_execution_at: null
      },
      database: {
        queries_total: 0,
        connection_failures: 0
      },
      ingestion_worker: {
        jobs_total: 0,
        jobs_failed: 0
      }
    };
  }

  /**
   * Records an incoming HTTP request completion.
   * @param {number} statusCode
   * @param {number} latencyMs
   */
  recordHttpRequest(statusCode, latencyMs) {
    this.requests.total++;
    if (statusCode >= 200 && statusCode < 300) {
      this.requests.status2xx++;
    } else if (statusCode >= 400 && statusCode < 500) {
      this.requests.status4xx++;
    } else if (statusCode >= 500) {
      this.requests.status5xx++;
    }

    if (this.recentLatencies.length >= this.maxWindowSize) {
      this.recentLatencies.shift();
    }
    this.recentLatencies.push(latencyMs);
  }

  /**
   * Records an AI inference operation.
   */
  recordAiQuery(success, latencyMs) {
    this.subsystems.ai_intelligence.queries_total++;
    if (success) {
      this.subsystems.ai_intelligence.queries_success++;
    } else {
      this.subsystems.ai_intelligence.queries_failure++;
    }
    this.subsystems.ai_intelligence.total_latency_ms += latencyMs;
    this.subsystems.ai_intelligence.last_query_at = new Date().toISOString();
  }

  /**
   * Records a Knowledge Base retrieval operation.
   */
  recordRetrieval(success, latencyMs) {
    this.subsystems.knowledge_retrieval.queries_total++;
    if (success) {
      this.subsystems.knowledge_retrieval.queries_success++;
    } else {
      this.subsystems.knowledge_retrieval.queries_failure++;
    }
    this.subsystems.knowledge_retrieval.total_latency_ms += latencyMs;
    this.subsystems.knowledge_retrieval.last_retrieval_at = new Date().toISOString();
  }

  /**
   * Records a Native C engine execution.
   */
  recordCEngineRun(success, latencyMs) {
    this.subsystems.c_engine.executions_total++;
    if (success) {
      this.subsystems.c_engine.executions_success++;
    } else {
      this.subsystems.c_engine.executions_failure++;
    }
    this.subsystems.c_engine.total_latency_ms += latencyMs;
    this.subsystems.c_engine.last_execution_at = new Date().toISOString();
  }

  /**
   * Computes latency statistics over rolling sample window.
   */
  computeLatencyStats() {
    if (this.recentLatencies.length === 0) {
      return { min_ms: 0, max_ms: 0, avg_ms: 0, p95_ms: 0 };
    }

    const sorted = [...this.recentLatencies].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const sum = sorted.reduce((acc, val) => acc + val, 0);
    const avg = Math.round((sum / sorted.length) * 100) / 100;
    const p95Idx = Math.floor(sorted.length * 0.95);
    const p95 = sorted[p95Idx] || max;

    return { min_ms: min, max_ms: max, avg_ms: avg, p95_ms: p95 };
  }

  /**
   * Returns complete metrics snapshot.
   */
  getSnapshot() {
    const memory = process.memoryUsage();
    const uptimeSec = Math.floor((Date.now() - this.startTime) / 1000);
    const latencyStats = this.computeLatencyStats();
    const errorRatePct = this.requests.total > 0
      ? Math.round(((this.requests.status5xx / this.requests.total) * 100) * 100) / 100
      : 0;

    return {
      service: 'CASETHREAD Intelligence Platform',
      environment: process.env.NODE_ENV || 'development',
      uptime_seconds: uptimeSec,
      timestamp: new Date().toISOString(),
      http_requests: {
        total: this.requests.total,
        status_2xx: this.requests.status2xx,
        status_4xx: this.requests.status4xx,
        status_5xx: this.requests.status5xx,
        error_rate_percent: errorRatePct,
        latency: latencyStats
      },
      subsystems: {
        ai_intelligence: {
          ...this.subsystems.ai_intelligence,
          avg_latency_ms: this.subsystems.ai_intelligence.queries_total > 0
            ? Math.round(this.subsystems.ai_intelligence.total_latency_ms / this.subsystems.ai_intelligence.queries_total)
            : 0
        },
        knowledge_retrieval: {
          ...this.subsystems.knowledge_retrieval,
          avg_latency_ms: this.subsystems.knowledge_retrieval.queries_total > 0
            ? Math.round(this.subsystems.knowledge_retrieval.total_latency_ms / this.subsystems.knowledge_retrieval.queries_total)
            : 0
        },
        c_engine: {
          ...this.subsystems.c_engine,
          avg_latency_ms: this.subsystems.c_engine.executions_total > 0
            ? Math.round(this.subsystems.c_engine.total_latency_ms / this.subsystems.c_engine.executions_total)
            : 0
        },
        database: this.subsystems.database,
        ingestion_worker: this.subsystems.ingestion_worker
      },
      system_resources: {
        rss_bytes: memory.rss,
        heap_used_bytes: memory.heapUsed,
        heap_total_bytes: memory.heapTotal,
        rss_mb: Math.round((memory.rss / (1024 * 1024)) * 100) / 100,
        heap_used_mb: Math.round((memory.heapUsed / (1024 * 1024)) * 100) / 100,
        node_version: process.version,
        platform: process.platform,
        arch: process.arch
      }
    };
  }
}

// Singleton instance
const metricsService = new MetricsService();

module.exports = metricsService;

/**
 * @file ingestionWorker.js
 * @brief Controlled background ingestion worker, scheduler, and operational sync manager.
 * Supports scheduled synchronization, rate limits, duplicate suppression, checkpoints, and graceful shutdown.
 * @project CASETHREAD - Phase 19 Production Infrastructure
 */

const ConnectorManager = require('../sources/connectors/connectorManager');
const RecordAdapter = require('../sources/adapters/recordAdapter');
const IngestPipeline = require('./ingestPipeline');
const { execute } = require('../../database/connection');

class IngestionWorker {
  constructor() {
    this.status = 'IDLE'; // IDLE | SYNCING | STOPPED
    this.timer = null;
    this.isShuttingDown = false;
    this.lastRunAt = null;
    this.lastRunSummary = null;
    this.activeJobId = null;
    this.syncStats = {
      totalRuns: 0,
      totalRecordsIngested: 0,
      totalDuplicatesSkipped: 0,
      totalFailures: 0
    };
  }

  /**
   * Returns current operational worker telemetry.
   */
  getStatus() {
    return {
      status: this.status,
      isShuttingDown: this.isShuttingDown,
      scheduled: this.timer !== null,
      lastRunAt: this.lastRunAt,
      lastRunSummary: this.lastRunSummary,
      activeJobId: this.activeJobId,
      stats: { ...this.syncStats }
    };
  }

  /**
   * Initializes background scheduler if enabled by environment configuration.
   * @param {number} [intervalMs]
   */
  startScheduler(intervalMs) {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    const enabled = process.env.INGESTION_WORKER_ENABLED === 'true';
    if (!enabled && !intervalMs) {
      this.status = 'IDLE';
      return { enabled: false, message: 'Background ingestion scheduler disabled via INGESTION_WORKER_ENABLED.' };
    }

    const interval = intervalMs || parseInt(process.env.INGESTION_INTERVAL_MS, 10) || (3600 * 1000); // Default 1 hour
    this.timer = setInterval(() => {
      if (!this.isShuttingDown && this.status === 'IDLE') {
        this.syncAllOperational({ trigger: 'SCHEDULED' }).catch(err => {
          console.error('[INGESTION WORKER] Scheduled synchronization error:', err.message);
        });
      }
    }, interval);

    this.timer.unref(); // Do not hold Node process open in test runners
    console.log(`[INGESTION WORKER] Scheduled background sync initialized (interval: ${Math.round(interval / 1000)}s).`);
    return { enabled: true, intervalSeconds: Math.round(interval / 1000) };
  }

  /**
   * Stops the background worker and clears scheduled timers.
   */
  stop() {
    this.isShuttingDown = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.status = 'STOPPED';
    console.log('[INGESTION WORKER] Ingestion worker successfully stopped.');
  }

  /**
   * Synchronizes records from all active operational connectors.
   * @param {object} [options]
   */
  async syncAllOperational(options = {}) {
    if (this.status === 'SYNCING') {
      return {
        status: 'BUSY',
        message: 'An ingestion synchronization job is already running.',
        activeJobId: this.activeJobId
      };
    }

    if (this.isShuttingDown) {
      return { status: 'ABORTED', message: 'Worker is shutting down.' };
    }

    this.status = 'SYNCING';
    const startedAt = new Date();
    const trigger = options.trigger || 'MANUAL';
    const operationalSources = ConnectorManager.getOperationalSourceIds();
    const sourceResults = [];

    let totalFetched = 0;
    let totalIngested = 0;
    let totalSkipped = 0;
    let totalFailed = 0;

    // Log job record in database
    let jobId = null;
    try {
      const [jobInsert] = await execute(
        `INSERT INTO knowledge_ingestion_jobs 
         (job_type, source_name, status, records_fetched, records_ingested, duplicates_skipped, rejected_count, created_at)
         VALUES (?, ?, 'RUNNING', 0, 0, 0, 0, NOW())`,
        [`SYNC_ALL_${trigger}`, `Operational Sources (${operationalSources.length})`]
      );
      jobId = jobInsert.insertId;
      this.activeJobId = jobId;
    } catch (e) {
      // In-memory or non-blocking
    }

    try {
      for (const sourceId of operationalSources) {
        if (this.isShuttingDown) break;
        const res = await this.syncSource(sourceId, { maxRecords: options.maxRecords || 5 });
        sourceResults.push(res);

        totalFetched += (res.recordsFetched || 0);
        totalIngested += (res.recordsIngested || 0);
        totalSkipped += (res.duplicatesSkipped || 0);
        totalFailed += (res.failures || 0);
      }

      this.lastRunAt = new Date().toISOString();
      this.lastRunSummary = {
        jobId,
        trigger,
        durationMs: Date.now() - startedAt.getTime(),
        sourcesProcessed: sourceResults.length,
        totalFetched,
        totalIngested,
        totalSkipped,
        totalFailed,
        sources: sourceResults
      };

      this.syncStats.totalRuns++;
      this.syncStats.totalRecordsIngested += totalIngested;
      this.syncStats.totalDuplicatesSkipped += totalSkipped;
      this.syncStats.totalFailures += totalFailed;

      if (jobId) {
        await execute(
          `UPDATE knowledge_ingestion_jobs 
           SET status = 'COMPLETED', records_fetched = ?, records_ingested = ?, duplicates_skipped = ?, rejected_count = ?, completed_at = NOW()
           WHERE job_id = ?`,
          [totalFetched, totalIngested, totalSkipped, totalFailed, jobId]
        );
      }

      return {
        success: true,
        summary: this.lastRunSummary
      };
    } catch (err) {
      this.syncStats.totalFailures++;
      if (jobId) {
        try {
          await execute(
            `UPDATE knowledge_ingestion_jobs 
             SET status = 'FAILED', error_log = ?, completed_at = NOW()
             WHERE job_id = ?`,
            [err.message, jobId]
          );
        } catch (e) {}
      }
      throw err;
    } finally {
      this.status = this.isShuttingDown ? 'STOPPED' : 'IDLE';
      this.activeJobId = null;
    }
  }

  /**
   * Synchronizes an individual source connector by ID.
   * @param {string} sourceId
   * @param {object} [options]
   */
  async syncSource(sourceId, options = {}) {
    const started = Date.now();
    try {
      const connector = ConnectorManager.getConnector(sourceId);
      const maxRecords = options.maxRecords || 5;

      // Safe fetch records using connector
      let rawRecords = [];
      try {
        rawRecords = await connector.fetchRecentRecords({ limit: maxRecords });
      } catch (err) {
        console.warn(`[INGESTION WORKER] Connector ${sourceId} fetch failed: ${err.message}`);
        return {
          sourceId,
          status: 'FETCH_ERROR',
          error: err.message,
          recordsFetched: 0,
          recordsIngested: 0,
          duplicatesSkipped: 0,
          failures: 1
        };
      }

      let ingested = 0;
      let skipped = 0;
      let rejected = 0;

      for (const raw of rawRecords) {
        try {
          const adapted = RecordAdapter.adapt(sourceId, raw);
          const ingestResult = await IngestPipeline.ingestGlobalRecord(adapted);

          if (ingestResult.status === 'SUCCESS') {
            ingested++;
          } else if (ingestResult.status === 'DUPLICATE_SKIPPED') {
            skipped++;
          } else {
            rejected++;
          }
        } catch (recordErr) {
          rejected++;
        }
      }

      return {
        sourceId,
        status: 'SUCCESS',
        durationMs: Date.now() - started,
        recordsFetched: rawRecords.length,
        recordsIngested: ingested,
        duplicatesSkipped: skipped,
        failures: rejected
      };
    } catch (err) {
      return {
        sourceId,
        status: 'ERROR',
        error: err.message,
        recordsFetched: 0,
        recordsIngested: 0,
        duplicatesSkipped: 0,
        failures: 1
      };
    }
  }
}

// Export singleton instance
const ingestionWorker = new IngestionWorker();

module.exports = {
  ingestionWorker,
  IngestionWorker
};

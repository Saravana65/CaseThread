/**
 * @file baseConnector.js
 * @brief Abstract base class for worldwide crime record source connectors.
 * Standardizes rate limiting, exponential backoff, checkpointing, pagination, and error isolation.
 * @project CASETHREAD
 */

const fs = require('fs');
const path = require('path');
const { execute } = require('../../../database/connection');

class BaseConnector {
  /**
   * @param {object} sourceConfig - Registered source descriptor from sourceRegistry
   * @param {object} runtimeOptions - Options such as checkpointDir, maxRetries, baseDelayMs, etc.
   */
  constructor(sourceConfig, runtimeOptions = {}) {
    if (!sourceConfig || !sourceConfig.id) {
      throw new Error('BaseConnector requires a valid sourceConfig with an id property.');
    }
    this.source = sourceConfig;
    this.options = {
      maxRetries: runtimeOptions.maxRetries || 3,
      baseDelayMs: runtimeOptions.baseDelayMs || 500,
      rateLimitDelayMs: runtimeOptions.rateLimitDelayMs || 200,
      batchSize: runtimeOptions.batchSize || 50,
      checkpointDir: runtimeOptions.checkpointDir || path.resolve(__dirname, '../../../storage/private_knowledge_vault/checkpoints'),
      ...runtimeOptions
    };

    this.stats = {
      recordsDiscovered: 0,
      recordsImported: 0,
      recordsSkipped: 0,
      recordsFailed: 0,
      startTime: null,
      endTime: null,
      errors: []
    };

    this.isAborted = false;
  }

  /**
   * Validates network connectivity and authentication to the source.
   * @returns {Promise<{ ok: boolean, message: string }>}
   */
  async validateConnection() {
    throw new Error('validateConnection() must be implemented by subclass.');
  }

  /**
   * Discovers and retrieves records with pagination and checkpoint resumption.
   * @param {object} params
   * @param {number} params.limit
   * @param {string} params.checkpointState
   * @returns {Promise<Array<object>>}
   */
  async fetchBatch(params = {}) {
    throw new Error('fetchBatch() must be implemented by subclass.');
  }

  /**
   * Executes a fetch request with automatic rate limiting and exponential backoff retry.
   */
  async safeFetch(url, fetchOptions = {}) {
    let attempt = 0;
    let delay = this.options.baseDelayMs;

    while (attempt <= this.options.maxRetries) {
      if (this.isAborted) {
        throw new Error(`[ABORTED] Ingestion job aborted by operator.`);
      }

      try {
        // Enforce polite rate limiting delay
        if (this.options.rateLimitDelayMs > 0) {
          await new Promise(r => setTimeout(r, this.options.rateLimitDelayMs));
        }

        const res = await fetch(url, {
          ...fetchOptions,
          headers: {
            'User-Agent': 'CaseThread-Research-Agent/1.0 (Authorized Legal & Forensic Archive Indexer)',
            ...(fetchOptions.headers || {})
          }
        });

        if (res.status === 429) {
          // Rate limited by remote server — honor Retry-After if present
          const retryAfterSec = parseInt(res.headers.get('retry-after')) || (delay / 1000) * 2;
          console.warn(`[RATE LIMIT 429] ${this.source.name} throttled request. Backing off for ${retryAfterSec}s...`);
          await new Promise(r => setTimeout(r, retryAfterSec * 1000));
          attempt++;
          delay *= 2;
          continue;
        }

        if (!res.ok) {
          const bodyPreview = (await res.text()).slice(0, 200);
          throw new Error(`HTTP ${res.status} from ${this.source.id}: ${bodyPreview}`);
        }

        return await res.json();
      } catch (err) {
        attempt++;
        if (attempt > this.options.maxRetries) {
          throw err;
        }
        console.warn(`[RETRY] Attempt ${attempt}/${this.options.maxRetries} failed for ${url}: ${err.message}. Retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        delay *= 2;
      }
    }
  }

  /**
   * Loads checkpoint from disk.
   */
  loadCheckpoint() {
    try {
      const checkpointFile = path.join(this.options.checkpointDir, `${this.source.id}_checkpoint.json`);
      if (fs.existsSync(checkpointFile)) {
        const raw = fs.readFileSync(checkpointFile, 'utf8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.warn(`[CHECKPOINT] Could not read checkpoint for ${this.source.id}: ${err.message}`);
    }
    return null;
  }

  /**
   * Saves checkpoint state to disk.
   */
  saveCheckpoint(state) {
    try {
      if (!fs.existsSync(this.options.checkpointDir)) {
        fs.mkdirSync(this.options.checkpointDir, { recursive: true });
      }
      const checkpointFile = path.join(this.options.checkpointDir, `${this.source.id}_checkpoint.json`);
      fs.writeFileSync(checkpointFile, JSON.stringify({
        sourceId: this.source.id,
        savedAt: new Date().toISOString(),
        state
      }, null, 2), 'utf8');
    } catch (err) {
      console.warn(`[CHECKPOINT] Could not write checkpoint for ${this.source.id}: ${err.message}`);
    }
  }

  /**
   * Signals connector to safely stop at the next iteration.
   */
  abort() {
    this.isAborted = true;
  }

  /**
   * Returns connector operational metrics.
   */
  getStats() {
    return {
      ...this.stats,
      durationMs: (this.stats.endTime || Date.now()) - (this.stats.startTime || Date.now())
    };
  }
}

module.exports = BaseConnector;

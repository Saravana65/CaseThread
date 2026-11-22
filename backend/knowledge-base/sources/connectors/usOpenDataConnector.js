/**
 * @file usOpenDataConnector.js
 * @brief Operational source connector for US Open Crime Data (City of Chicago / Data.gov SODA API).
 * Ingests genuine case-level police incident records with case numbers, arrest statuses, and FBI codes.
 * @project CASETHREAD
 */

const BaseConnector = require('./baseConnector');
const RecordAdapter = require('../adapters/recordAdapter');

class UsOpenDataConnector extends BaseConnector {
  constructor(sourceConfig, options = {}) {
    super(sourceConfig, {
      baseDelayMs: 250,
      rateLimitDelayMs: 100,
      ...options
    });
    this.endpointUrl = 'https://data.cityofchicago.org/resource/ijzp-q8t2.json';
  }

  /**
   * Validates API connectivity by fetching a single record probe.
   */
  async validateConnection() {
    try {
      const probeUrl = `${this.endpointUrl}?%24limit=1`;
      const res = await this.safeFetch(probeUrl);
      if (Array.isArray(res)) {
        return {
          ok: true,
          message: 'Successfully connected to US Open Crime Data portal (Chicago SODA API).'
        };
      }
      return { ok: false, message: 'Invalid response structure from SODA API endpoint.' };
    } catch (err) {
      return { ok: false, message: `US Open Data connection failed: ${err.message}` };
    }
  }

  /**
   * Fetches genuine US police incident records with pagination and checkpointing.
   * @param {object} params
   * @param {number} params.limit - Records to retrieve (default 50)
   * @param {number} params.offset - Pagination offset (default 0)
   * @param {string} params.primaryType - Optional filter, e.g. 'ROBBERY', 'BURGLARY', 'HOMICIDE', 'THEFT'
   */
  async fetchBatch(params = {}) {
    const limit = params.limit || 50;
    const offset = params.offset || 0;
    const primaryType = params.primaryType;

    let queryUrl = `${this.endpointUrl}?%24limit=${limit}&%24offset=${offset}&%24order=date%20DESC`;
    if (primaryType) {
      queryUrl += `&primary_type=${encodeURIComponent(primaryType.toUpperCase())}`;
    }

    console.log(`[US CONNECTOR] Querying US Open Crime SODA API: ${queryUrl}`);

    this.stats.startTime = Date.now();
    const rawIncidents = await this.safeFetch(queryUrl);

    if (!Array.isArray(rawIncidents)) {
      throw new Error(`Expected array of incidents from US Open Data, received: ${typeof rawIncidents}`);
    }

    this.stats.recordsDiscovered += rawIncidents.length;
    const adaptedRecords = [];

    for (const raw of rawIncidents) {
      try {
        const adapted = RecordAdapter.adaptUsOpenRecord(raw, this.source);
        adaptedRecords.push(adapted);
      } catch (err) {
        this.stats.recordsFailed++;
        this.stats.errors.push({ rawId: raw.id || raw.case_number, error: err.message });
      }
    }

    // Save checkpoint of last offset
    this.saveCheckpoint({ lastOffset: offset + adaptedRecords.length, lastFetchedAt: new Date().toISOString() });

    this.stats.endTime = Date.now();
    return adaptedRecords;
  }
}

module.exports = UsOpenDataConnector;

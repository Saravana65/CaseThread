/**
 * @file ukPoliceConnector.js
 * @brief Operational source connector for UK Police Open Crime Data API.
 * Retrieves genuine case-level street crimes and outcomes under Open Government Licence v3.0.
 * @project CASETHREAD
 */

const BaseConnector = require('./baseConnector');
const RecordAdapter = require('../adapters/recordAdapter');

class UkPoliceConnector extends BaseConnector {
  constructor(sourceConfig, options = {}) {
    super(sourceConfig, {
      baseDelayMs: 300,
      rateLimitDelayMs: 150,
      ...options
    });
    this.baseUrl = 'https://data.police.uk/api';
  }

  /**
   * Validates API availability by requesting crime categories.
   */
  async validateConnection() {
    try {
      const categories = await this.safeFetch(`${this.baseUrl}/crime-categories`);
      if (Array.isArray(categories) && categories.length > 0) {
        return {
          ok: true,
          message: `Successfully connected to Police.uk API. Discovered ${categories.length} crime categories.`
        };
      }
      return { ok: false, message: 'Received unexpected response format from Police.uk API.' };
    } catch (err) {
      return { ok: false, message: `Police.uk API connection failed: ${err.message}` };
    }
  }

  /**
   * Fetches genuine street crime records for a designated jurisdiction zone and month.
   * @param {object} params
   * @param {number} params.limit - Max records to return
   * @param {string} params.date - Year and month (YYYY-MM), e.g. '2024-01'
   * @param {number} params.lat - Latitude (default London: 51.5074)
   * @param {number} params.lng - Longitude (default London: -0.1278)
   */
  async fetchBatch(params = {}) {
    const lat = params.lat || 51.5074;
    const lng = params.lng || -0.1278;
    const date = params.date || '2024-01';
    const limit = params.limit || 50;
    const targetCategory = params.category;

    const url = `${this.baseUrl}/crimes-street/all-crime?lat=${lat}&lng=${lng}&date=${date}`;
    console.log(`[UK CONNECTOR] Fetching genuine street crime data from: ${url}`);

    this.stats.startTime = Date.now();
    const rawCrimes = await this.safeFetch(url);

    if (!Array.isArray(rawCrimes)) {
      throw new Error(`Expected array of crime records from Police.uk, received: ${typeof rawCrimes}`);
    }

    this.stats.recordsDiscovered += rawCrimes.length;
    
    // Filter by target category if specified
    const filteredCrimes = targetCategory 
      ? rawCrimes.filter(c => c.category === targetCategory)
      : rawCrimes;

    console.log(`[UK CONNECTOR] Discovered ${rawCrimes.length} records (${filteredCrimes.length} matching category '${targetCategory || 'all'}'). Slicing to batch limit of ${limit}...`);

    const selectedSlice = filteredCrimes.slice(0, limit);
    const adaptedRecords = [];

    for (const raw of selectedSlice) {
      try {
        const adapted = RecordAdapter.adaptUkPoliceRecord(raw, this.source);
        adaptedRecords.push(adapted);
      } catch (err) {
        this.stats.recordsFailed++;
        this.stats.errors.push({ rawId: raw.id, error: err.message });
      }
    }

    this.stats.endTime = Date.now();
    return adaptedRecords;
  }
}

module.exports = UkPoliceConnector;

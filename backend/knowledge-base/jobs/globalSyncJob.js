/**
 * @file globalSyncJob.js
 * @brief Automated worldwide crime record collection and synchronization job runner.
 * Connects to operational source connectors, ingests genuine records, and handles rate limiting.
 * Usage: npm run knowledge:global-sync -- [--connector <id>] [--country <name>] [--limit <n>] [--dry-run]
 * @project CASETHREAD
 */

const { execute, testConnection } = require('../../database/connection');
const { SourceRegistry } = require('../sources/registry/sourceRegistry');
const ConnectorManager = require('../sources/connectors/connectorManager');
const IngestPipeline = require('../ingestion/ingestPipeline');

function parseArgs(args) {
  const options = {
    connectorId: null,
    country: null,
    limit: 20,
    dryRun: false,
    force: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--connector' && args[i + 1]) options.connectorId = args[++i];
    else if (arg.startsWith('--connector=')) options.connectorId = arg.split('=')[1];
    else if (arg === '--country' && args[i + 1]) options.country = args[++i];
    else if (arg.startsWith('--country=')) options.country = arg.split('=')[1];
    else if (arg === '--limit' && args[i + 1]) options.limit = parseInt(args[++i], 10);
    else if (arg.startsWith('--limit=')) options.limit = parseInt(arg.split('=')[1], 10);
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--force') options.force = true;
  }

  return options;
}

async function run() {
  const options = parseArgs(process.argv.slice(2));

  console.log('=================================================================');
  console.log('  CASETHREAD — GLOBAL CRIME DATA INGESTION & SYNC RUNNER');
  console.log('=================================================================');
  console.log(`Mode:       ${options.dryRun ? 'DRY-RUN (Discovery & Validation Only)' : 'ACTIVE INGESTION'}`);
  console.log(`Per-Source Limit: ${options.limit}`);
  if (options.connectorId) console.log(`Target Connector: ${options.connectorId}`);
  if (options.country) console.log(`Target Country:   ${options.country}`);
  console.log('-----------------------------------------------------------------');

  if (!options.dryRun) {
    await testConnection();
  }

  // Determine target sources
  let targetSourceIds = [];
  if (options.connectorId) {
    const src = SourceRegistry.getSource(options.connectorId);
    if (!src) {
      console.error(`[ERROR] Unknown connector: ${options.connectorId}`);
      process.exit(1);
    }
    targetSourceIds.push(src.id);
  } else if (options.country) {
    const sources = SourceRegistry.getSourcesByCountry(options.country);
    targetSourceIds = sources.filter(s => s.status === 'OPERATIONAL').map(s => s.id);
  } else {
    // Default to all operational sources
    targetSourceIds = ConnectorManager.getOperationalSourceIds();
  }

  console.log(`Selected ${targetSourceIds.length} operational source(s) for synchronization:\n- ` + targetSourceIds.join('\n- '));
  console.log('-----------------------------------------------------------------\n');

  let totalDiscovered = 0;
  let totalImported = 0;
  let totalSkipped = 0;
  let totalFailed = 0;
  const overallStartTime = Date.now();

  for (const srcId of targetSourceIds) {
    const sourceMeta = SourceRegistry.getSource(srcId);
    console.log(`>>> Starting sync for: [${sourceMeta.country}] ${sourceMeta.name} (${srcId})`);

    let connector;
    try {
      connector = ConnectorManager.getConnector(srcId);
    } catch (err) {
      console.error(`[-] Connector initialization failed for ${srcId}: ${err.message}`);
      totalFailed++;
      continue;
    }

    // Validate connectivity
    console.log(`    Validating API / repository connection...`);
    const validation = await connector.validateConnection();
    if (!validation.ok) {
      console.warn(`    [-] Connection validation failed: ${validation.message}`);
      totalFailed++;
      continue;
    }
    console.log(`    [+] ${validation.message}`);

    if (options.dryRun) {
      console.log(`    [DRY-RUN] Connection verified. Skipping active record retrieval.\n`);
      continue;
    }

    // Active synchronization
    let jobId = null;
    try {
      const [jobRes] = await execute(`
        INSERT INTO knowledge_ingestion_jobs (source_identifier, job_type, status)
        VALUES (?, 'GLOBAL_API_SYNC', 'RUNNING')
      `, [srcId]);
      jobId = jobRes.insertId;
    } catch (err) {
      // Continue even if job table insert fails
    }

    let records = [];
    try {
      records = await connector.fetchBatch({ limit: options.limit });
      console.log(`    Retrieved ${records.length} adapted record(s) from ${srcId}.`);
      totalDiscovered += records.length;
    } catch (err) {
      console.error(`    [-] Error during fetchBatch for ${srcId}: ${err.message}`);
      totalFailed++;
      if (jobId) {
        await execute(`UPDATE knowledge_ingestion_jobs SET status = 'FAILED', error_log = ? WHERE job_id = ?`, [JSON.stringify([{ error: err.message }]), jobId]);
      }
      continue;
    }

    let importedForSource = 0;
    let skippedForSource = 0;
    const errorsForSource = [];

    for (let i = 0; i < records.length; i++) {
      const rec = records[i];
      try {
        const ingestRes = await IngestPipeline.ingestGlobalRecord(rec, {
          sourceName: sourceMeta.name,
          sourceType: sourceMeta.recordLevel === 'COURT_JUDGMENT' ? 'COURT_JUDGMENT' : 'GOVERNMENT_OPEN_DATA',
          classification: 'OFFICIAL_USE_ONLY',
          force: options.force
        });

        if (ingestRes.status === 'SUCCESS') {
          importedForSource++;
        } else if (ingestRes.status === 'DUPLICATE_SKIPPED') {
          skippedForSource++;
        } else {
          errorsForSource.push({ caseRef: rec.case_reference_number, reason: ingestRes.issues || ingestRes.reason });
        }
      } catch (err) {
        errorsForSource.push({ caseRef: rec.case_reference_number, error: err.message });
      }
    }

    totalImported += importedForSource;
    totalSkipped += skippedForSource;
    totalFailed += errorsForSource.length;

    console.log(`    Imported: ${importedForSource} | Skipped (Duplicates): ${skippedForSource} | Failed: ${errorsForSource.length}`);

    if (jobId) {
      const finalStatus = errorsForSource.length > 0 ? (importedForSource > 0 ? 'PARTIALLY_COMPLETED' : 'FAILED') : 'COMPLETED';
      await execute(`
        UPDATE knowledge_ingestion_jobs
        SET status = ?, documents_processed = ?, documents_rejected = ?, error_log = ?, completed_at = NOW()
        WHERE job_id = ?
      `, [finalStatus, importedForSource, skippedForSource + errorsForSource.length, JSON.stringify(errorsForSource), jobId]);
    }

    console.log(`    Completed sync for ${srcId}.\n`);
  }

  const durationSec = ((Date.now() - overallStartTime) / 1000).toFixed(2);
  console.log('=================================================================');
  console.log('  GLOBAL SYNCHRONIZATION SUMMARY');
  console.log('=================================================================');
  console.log(`Total Duration:       ${durationSec}s`);
  console.log(`Sources Contacted:    ${targetSourceIds.length}`);
  console.log(`Records Discovered:   ${totalDiscovered}`);
  console.log(`Successfully Stored:  ${totalImported}`);
  console.log(`Duplicates Skipped:   ${totalSkipped}`);
  console.log(`Errors / Rejected:    ${totalFailed}`);
  console.log('=================================================================\n');

  process.exit(0);
}

if (require.main === module) {
  run().catch(err => {
    console.error('Fatal global sync error:', err);
    process.exit(1);
  });
}

module.exports = { parseArgs, run };

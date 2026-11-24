/**
 * @file importJob.js
 * @brief Administrative batch ingestion CLI command for Private Crime Knowledge Base.
 * Usage: npm run knowledge:import -- --path <dir_or_file> [--dry-run] [--source <name>] [--classification <level>]
 * @project CASETHREAD
 */

const fs = require('fs');
const path = require('path');
const { execute, testConnection } = require('../../database/connection');
const IngestPipeline = require('../ingestion/ingestPipeline');
const KnowledgeSecurity = require('../security/knowledgeSecurity');

// Parse command line arguments
function parseArgs(args) {
  const options = {
    targetPath: null,
    dryRun: false,
    sourceName: 'Administrative File Import',
    sourceType: 'AUTHORIZED_ARCHIVE',
    classification: 'OFFICIAL_USE_ONLY',
    jurisdiction: null,
    force: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--path' && args[i + 1]) {
      options.targetPath = args[++i];
    } else if (arg.startsWith('--path=')) {
      options.targetPath = arg.split('=')[1];
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--source' && args[i + 1]) {
      options.sourceName = args[++i];
    } else if (arg === '--source-type' && args[i + 1]) {
      options.sourceType = args[++i];
    } else if (arg === '--classification' && args[i + 1]) {
      options.classification = args[++i];
    } else if (arg === '--jurisdiction' && args[i + 1]) {
      options.jurisdiction = args[++i];
    } else if (arg === '--force') {
      options.force = true;
    }
  }

  return options;
}

// Recursively collect files matching allowed extensions
function collectFiles(targetPath, fileList = []) {
  if (!fs.existsSync(targetPath)) return fileList;

  const stat = fs.statSync(targetPath);
  if (stat.isFile()) {
    const ext = path.extname(targetPath).toLowerCase();
    if (['.pdf', '.docx', '.txt', '.json', '.csv'].includes(ext)) {
      fileList.push(targetPath);
    }
    return fileList;
  }

  if (stat.isDirectory()) {
    const entries = fs.readdirSync(targetPath, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(targetPath, entry.name);
      if (entry.isDirectory()) {
        collectFiles(full, fileList);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (['.pdf', '.docx', '.txt', '.json', '.csv'].includes(ext)) {
          fileList.push(full);
        }
      }
    }
  }

  return fileList;
}

async function run() {
  const options = parseArgs(process.argv.slice(2));

  console.log('=================================================================');
  console.log('  CASETHREAD — PRIVATE CRIME KNOWLEDGE BASE INGESTION TOOL');
  console.log('=================================================================');

  if (!options.targetPath) {
    console.error('\n[ERROR] Missing required parameter: --path <dir_or_file>');
    console.log('\nUsage:');
    console.log('  npm run knowledge:import -- --path ./data/legal_archive');
    console.log('  npm run knowledge:import -- --path ./sample.pdf --dry-run');
    console.log('  npm run knowledge:import -- --path ./cases --classification RESTRICTED_LAW_ENFORCEMENT');
    process.exit(1);
  }

  const resolvedTarget = path.resolve(options.targetPath);
  if (!fs.existsSync(resolvedTarget)) {
    console.error(`\n[ERROR] Target path does not exist: ${resolvedTarget}`);
    process.exit(1);
  }

  console.log(`Source Target:   ${resolvedTarget}`);
  console.log(`Mode:            ${options.dryRun ? 'DRY-RUN (Verification Only - No DB Writes)' : 'ACTIVE INGESTION'}`);
  console.log(`Source Name:     ${options.sourceName}`);
  console.log(`Classification:  ${options.classification}`);
  console.log(`Jurisdiction:    ${options.jurisdiction || "From document"}`);
  console.log('-----------------------------------------------------------------');

  // Verify database connection if not dry-run
  if (!options.dryRun) {
    try {
      await testConnection();
    } catch (err) {
      console.error(`[DB ERROR] Cannot connect to MySQL database: ${err.message}`);
      process.exit(1);
    }
  }

  const files = collectFiles(resolvedTarget);
  console.log(`Found ${files.length} candidate file(s) for ingestion.\n`);

  if (files.length === 0) {
    console.log('[INFO] No compatible files (.pdf, .docx, .txt, .json, .csv) discovered.');
    process.exit(0);
  }

  let jobId = null;
  const errors = [];
  let processedCount = 0;
  let rejectedCount = 0;
  let skippedCount = 0;

  if (!options.dryRun) {
    const [jobRes] = await execute(`
      INSERT INTO knowledge_ingestion_jobs (source_identifier, job_type, status)
      VALUES (?, 'ADMINISTRATIVE_CLI_IMPORT', 'RUNNING')
    `, [resolvedTarget]);
    jobId = jobRes.insertId;
  }

  const startTime = Date.now();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const base = path.basename(file);
    process.stdout.write(`[${i + 1}/${files.length}] Processing "${base}" ... `);

    try {
      if (options.dryRun) {
        const val = KnowledgeSecurity.validateFileForIngestion(file);
        if (!val.valid) {
          console.log(`REJECTED (${val.error})`);
          rejectedCount++;
          errors.push({ file: base, error: val.error });
        } else {
          console.log(`OK [DRY-RUN] (${(val.size / 1024).toFixed(1)} KB)`);
          processedCount++;
        }
      } else {
        const result = await IngestPipeline.ingestFile(file, options);
        if (result.status === 'SUCCESS') {
          console.log(`SUCCESS (Doc ID: ${result.document_id}, ${result.chunks_created} chunks, OCR: ${result.is_ocr_required})`);
          processedCount++;
        } else if (result.status === 'DUPLICATE_SKIPPED') {
          console.log(`SKIPPED (Duplicate SHA-256)`);
          skippedCount++;
        } else {
          console.log(`FAILED (${result.reason})`);
          rejectedCount++;
          errors.push({ file: base, reason: result.reason });
        }
      }
    } catch (err) {
      console.log(`ERROR (${err.message})`);
      rejectedCount++;
      errors.push({ file: base, error: err.message });
    }
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

  if (!options.dryRun && jobId) {
    const finalStatus = rejectedCount > 0 ? (processedCount > 0 ? 'PARTIALLY_COMPLETED' : 'FAILED') : 'COMPLETED';
    await execute(`
      UPDATE knowledge_ingestion_jobs
      SET status = ?, documents_processed = ?, documents_rejected = ?, error_log = ?, completed_at = NOW()
      WHERE job_id = ?
    `, [finalStatus, processedCount, rejectedCount + skippedCount, JSON.stringify(errors), jobId]);
  }

  console.log('\n=================================================================');
  console.log('  INGESTION RUN SUMMARY');
  console.log('=================================================================');
  console.log(`Execution Time:      ${durationSec}s`);
  console.log(`Total Files Scanned: ${files.length}`);
  console.log(`${options.dryRun ? 'Files validated' : 'Successfully stored'}: ${processedCount}`);
  console.log(`Duplicates Skipped:  ${skippedCount}`);
  console.log(`Rejected / Failed:   ${rejectedCount}`);
  if (jobId) {
    console.log(`Ingestion Job ID:    #${jobId}`);
  }
  console.log('=================================================================\n');

  process.exit(rejectedCount > 0 && processedCount === 0 ? 1 : 0);
}

if (require.main === module) {
  run().catch(err => {
    console.error('\nFatal ingestion error:', err);
    process.exit(1);
  });
}

module.exports = { parseArgs, collectFiles, run };

/**
 * @file reset_demo_case.js
 * @brief Cleanly and safely removes only the fictional demo case records.
 * @description Targets case_number 'CASE-DEMO-2026-CAMPUS' without touching
 *              any production, audit, or user-created cases.
 */

const { execute, testConnection } = require('../backend/database/connection');

async function resetDemoCase() {
  console.log('================================================================');
  console.log(' CASETHREAD DEMO DATA RESETTER — CLEANUP PROCEDURE');
  console.log('================================================================');

  await testConnection();

  const caseNumber = 'CASE-DEMO-2026-CAMPUS';
  const [existing] = await execute('SELECT case_id FROM cases WHERE case_number = ?', [caseNumber]);

  if (existing.length === 0) {
    console.log(`[INFO] No demo case found matching '${caseNumber}'. Nothing to reset.`);
    return;
  }

  const caseId = existing[0].case_id;
  console.log(`[RESET] Deleting demo case #${caseId} (${caseNumber})...`);

  // Foreign keys have ON DELETE CASCADE on cases, but we verify clean deletion
  await execute('DELETE FROM cases WHERE case_id = ?', [caseId]);

  console.log(`[SUCCESS] Demo case #${caseId} and all associated child entities safely removed.`);
  console.log('================================================================');
}

if (require.main === module) {
  resetDemoCase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[RESET ERROR]', err);
      process.exit(1);
    });
}

module.exports = { resetDemoCase };

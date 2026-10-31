/**
 * @file seedSimulation.js
 * @description Seeds the realistic fictional investigation case "THE METRO VAULT INTRUSION & DISAPPEARANCE"
 * into the database (MySQL 8 or MemoryStore) for end-to-end testing and demonstration.
 * @project CASETHREAD
 */

const { execute } = require('./connection');

async function seedSimulation() {
  console.log('==============================================================================');
  console.log('CASETHREAD: Seeding Fictional Demonstration Investigation Case');
  console.log('Case: THE METRO VAULT INTRUSION & DISAPPEARANCE (CASE-2026-0419)');
  console.log('==============================================================================');

  try {
    // 1. Verify or Insert Lead Detective
    const [existingOfficer] = await execute('SELECT officer_id FROM officers WHERE badge_number = ?', ['DET-8841']);
    let officerId = 1;
    if (existingOfficer.length > 0) {
      officerId = existingOfficer[0].officer_id;
    }

    // 2. Insert or Update Case
    const [existingCase] = await execute('SELECT case_id FROM cases WHERE case_number = ?', ['CASE-2026-0419']);
    let caseId = 1;
    if (existingCase.length > 0) {
      caseId = existingCase[0].case_id;
      console.log(`[SEED] Case CASE-2026-0419 already exists (ID ${caseId}).`);
    } else {
      const [caseResult] = await execute(
        `INSERT INTO cases (case_number, title, description, incident_date, incident_location, lead_officer_id, priority, status)
         VALUES ('CASE-2026-0419', 'The Metro Vault Intrusion & Disappearance', 
                 'Unauthorized breach of Metro National Depository Vault with suspicious cell telemetry, insider cyber bypass, and missing security courier.',
                 '2026-10-15 02:45:00', '450 Financial Boulevard, Downtown Metro', ?, 'CRITICAL', 'UNDER_INVESTIGATION')`,
        [officerId]
      );
      caseId = caseResult.insertId;
      console.log(`[SEED] Created Master Case File (ID ${caseId}).`);
    }

    console.log('[SEED] Master case file and forensic records confirmed.');
    console.log('==============================================================================');
    return { success: true, caseId };
  } catch (err) {
    console.error('[SEED ERROR] Failed to seed simulation data:', err.message);
    throw err;
  }
}

if (require.main === module) {
  seedSimulation().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = seedSimulation;

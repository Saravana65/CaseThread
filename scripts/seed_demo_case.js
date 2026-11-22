/**
 * @file seed_demo_case.js
 * @brief Idempotent and isolated demonstration data seeder for CaseThread Phase 11.
 * @description Creates the "[FICTIONAL / DEMO DATA] Missing Research Laptop — Campus Investigation"
 *              dataset for university PBL technical evaluation, ADS viva, and presentation walkthrough.
 * 
 * SAFETY ASSURANCES:
 * - Strictly isolated to case_number 'CASE-DEMO-2026-CAMPUS'.
 * - Never touches or resets real investigative records.
 * - Computes genuine SHA-256 hashes for all evidence payloads.
 * - Creates a verified connected component and an intentional isolated node (E007)
 *   to demonstrate Evidence Gap Analysis and BFS/DFS traversal.
 */

const crypto = require('crypto');
const { execute, testConnection } = require('../backend/database/connection');

function computeHash(payload) {
  return crypto.createHash('sha256').update(typeof payload === 'string' ? payload : JSON.stringify(payload)).digest('hex');
}

async function seedDemoCase() {
  console.log('================================================================');
  console.log(' CASETHREAD DEMO DATA SEEDER — CAMPUS LAPTOP INVESTIGATION');
  console.log('================================================================');

  await testConnection();

  const caseNumber = 'CASE-DEMO-2026-CAMPUS';

  // 1. Clean up existing demo case if present (idempotent)
  const [existing] = await execute('SELECT case_id FROM cases WHERE case_number = ?', [caseNumber]);
  if (existing.length > 0) {
    const oldCaseId = existing[0].case_id;
    console.log(`[CLEANUP] Removing previous demo case #${oldCaseId} (${caseNumber})...`);
    await execute('DELETE FROM cases WHERE case_id = ?', [oldCaseId]);
  }

  // 2. Fetch lead officer (Det. Alexander Cross DET-8841 or first officer)
  const [officers] = await execute("SELECT officer_id, badge_number FROM officers WHERE badge_number = 'DET-8841' LIMIT 1");
  const officerId = officers.length > 0 ? officers[0].officer_id : 1;

  // 3. Insert Investigation Case Record
  console.log('[1/7] Creating Fictional Demo Case...');
  const [caseInsert] = await execute(
    `INSERT INTO cases (
      case_number, title, description, incident_date, incident_location, 
      lead_officer_id, priority, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      caseNumber,
      '[FICTIONAL / DEMO DATA] Missing Research Laptop — Campus Investigation',
      '[FICTIONAL / DEMO DATA] Fictional university campus incident for ADS algorithm evaluation and technical viva. A high-performance AI research laptop containing experimental quantum-simulation models vanished from Turing Hall Room 402 between 21:00 and 22:30. Digital, physical, and sensory records have been collected to reconstruct incident timeline, evaluate relational connections, and identify investigative gaps.',
      '2026-11-20 21:15:00',
      'Turing Hall, Room 402, Quantum & AI Lab',
      officerId,
      'HIGH',
      'OPEN'
    ]
  );
  const caseId = caseInsert.insertId;
  console.log(`  -> Demo Case registered with case_id: ${caseId}`);

  // 4. Insert Persons of Interest (Suspects, Victims, Witnesses)
  console.log('[2/7] Registering Persons of Interest...');
  // Suspects
  await execute(
    `INSERT INTO suspects (case_id, full_name, alias, age, gender, phone_number, status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [caseId, 'Devon Kross', 'Contractor-D', 34, 'MALE', '555-019-4821', 'PRIMARY_SUSPECT', 'External network maintenance contractor present on 4th floor during incident window. Failed to record exit timestamp.']
  );
  await execute(
    `INSERT INTO suspects (case_id, full_name, alias, age, gender, phone_number, status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [caseId, 'Dr. Julian Vance', 'Research Fellow', 38, 'MALE', '555-014-9902', 'PERSON_OF_INTEREST', 'Postdoctoral fellow with active badge access to Lab 402. Disputed research ownership with Prof. Reynolds.']
  );
  // Victim
  await execute(
    `INSERT INTO victims (case_id, full_name, age, gender, contact_info, residence_address, condition_status, statement)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [caseId, 'Prof. Marcus Reynolds', 52, 'MALE', 'm.reynolds@university.edu', 'Faculty Residences #12', 'SAFE', 'Reported laptop missing upon arriving at laboratory on morning of Nov 21. Laptop was docked at workstation desk.']
  );
  // Witness
  await execute(
    `INSERT INTO witnesses (case_id, full_name, contact_phone, statement, credibility_score, statement_timestamp, statement_location)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [caseId, 'Elena Rostova', '555-018-3321', 'Heard laboratory security chime and abrupt hurried footsteps down the rear emergency stairwell at approx 21:40 while working in neighboring Lab 405.', 0.90, '2026-11-21 09:15:00', 'Turing Hall Room 405']
  );
  console.log('  -> 2 Suspects, 1 Victim, 1 Witness registered.');

  // 5. Register Evidence Vault Items (E001 - E007)
  console.log('[3/7] Registering 7 Fictional Evidence Items with Genuine SHA-256 Hashes...');

  const evidenceDefinitions = [
    {
      code: 'EVD-CAMPUS-001',
      title: 'Laboratory Access Log (RFID NFC Scanner)',
      cat: 'DIGITAL',
      desc: 'Card reader logs for Turing Hall Lab 402 door lock between 20:00 and 23:00. Shows Badge #4491 (Dr. Vance) scanned at 21:14 and Badge #8812 (Contractor Devon Kross) scanned at 21:42.',
      loc: 'Turing Hall 4th Floor Access Gateway',
      time: '2026-11-20 21:14:00',
      status: 'CONFIRMED_FACT',
      source: 'RFID_DOOR_CONTROLLER',
      payload: 'RFID_LOG: 2026-11-20T21:14:00Z BADGE#4491 GRANTED; 2026-11-20T21:42:00Z BADGE#8812 GRANTED'
    },
    {
      code: 'EVD-CAMPUS-002',
      title: 'Corridor CCTV Metadata (East Wing 4th Floor)',
      cat: 'CCTV',
      desc: 'Camera 4E video metadata and motion trigger index showing a hooded individual carrying a black backpack exiting Lab 402 toward the fire stairs at 21:48.',
      loc: 'Campus Security Video Archive Server',
      time: '2026-11-20 21:48:00',
      status: 'CONFIRMED_FACT',
      source: 'CAMPUS_CCTV_NETWORK',
      payload: 'CCTV_INDEX_CAM4E_20261120_214800_MOTION_TRIGGER_DOOR402_EXITS_STAIRWELL'
    },
    {
      code: 'EVD-CAMPUS-003',
      title: 'Witness Statement of Elena Rostova',
      cat: 'DOCUMENT',
      desc: 'Formally recorded interview audio transcription. Witness reports door chime around 21:40 followed by rapid footsteps down rear stairwell. Noticed faint smell of industrial tobacco smoke.',
      loc: 'Campus Investigation Bureau Room 102',
      time: '2026-11-21 09:15:00',
      status: 'UNVERIFIED_OBSERVATION',
      source: 'WITNESS_INTERVIEW',
      payload: 'STATEMENT: Elena Rostova witnessed door chime 21:40 and rapid steps in fire stairwell. Tobacco aroma.'
    },
    {
      code: 'EVD-CAMPUS-004',
      title: 'Laptop Inventory & Asset Record',
      cat: 'DOCUMENT',
      desc: 'University property asset registry: MacBook Pro 16 M3 Max, Asset Tag #UNIV-AI-8849, Serial #C02G99XYZ001. Hardware MAC address: 3C:06:30:4A:BC:11.',
      loc: 'University Asset Management DB',
      time: '2026-11-15 10:00:00',
      status: 'CONFIRMED_FACT',
      source: 'CAMPUS_ERP_INVENTORY',
      payload: 'ASSET_RECORD: TAG#UNIV-AI-8849 SN#C02G99XYZ001 MAC#3C:06:30:4A:BC:11 OWNER#REYNOLDS'
    },
    {
      code: 'EVD-CAMPUS-005',
      title: 'Security Desk Entry Register (Ground Floor South)',
      cat: 'DOCUMENT',
      desc: 'Physical visitor sign-in ledger logged by officer on duty. Devon Kross signed in at 20:45 citing scheduled network cabinet servicing; no sign-out time recorded.',
      loc: 'Campus South Security Desk',
      time: '2026-11-20 20:45:00',
      status: 'CONFIRMED_FACT',
      source: 'PHYSICAL_LOGBOOK',
      payload: 'LEDGER_ENTRY: 2026-11-20 20:45 DEVON KROSS - IT NETWORK SERVICE - EXIT: [BLANK]'
    },
    {
      code: 'EVD-CAMPUS-006',
      title: 'Device Network Connection Record (Campus Wi-Fi AP-402)',
      cat: 'DIGITAL',
      desc: 'RADIUS authentication log showing MAC 3C:06:30:4A:BC:11 disconnected abruptly from 5GHz BSSID Turing-4E at 21:44:12.',
      loc: 'Campus Network Operations Center (NOC)',
      time: '2026-11-20 21:44:12',
      status: 'CONFIRMED_FACT',
      source: 'CISCO_RADIUS_AUTH_SERVER',
      payload: 'RADIUS_AUTH_LOG: MAC 3C:06:30:4A:BC:11 DISCONNECT REASON_CODE=8 (INACTIVITY/DROPPED_SIGNAL) AT 21:44:12'
    },
    {
      code: 'EVD-CAMPUS-007',
      title: 'Laboratory Key-Access Emergency Override Record (EVIDENCE GAP / DISCONNECTED NODE)',
      cat: 'PHYSICAL',
      desc: 'Physical key cabinet inspection log indicating emergency mechanical override key for Room 402 is unaccounted for. Discovered hanging in custodian closet #2 with no checkout signature.',
      loc: 'Turing Hall Custodian Storage #2',
      time: '2026-11-21 11:30:00',
      status: 'CONFIRMED_FACT',
      source: 'CUSTODIAN_LOCK_BOX',
      payload: 'KEY_OVERRIDE_RECORD: MECH_KEY_402 DISPLACED TO CUSTODIAN_CLOSET_2 UNRECORDED'
    }
  ];

  const evidenceMap = {};

  for (const item of evidenceDefinitions) {
    const sha = computeHash(item.payload);
    const [res] = await execute(
      `INSERT INTO evidence (
        case_id, tracking_code, title, category, description, collection_location, 
        collected_at, source, verification_status, content_payload, 
        sha256_fingerprint, fingerprint_algorithm, fingerprint_type, 
        integrity_status, entered_by_officer_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SHA-256', 'ORIGINAL_FILE', 'INTACT', ?)`,
      [
        caseId,
        item.code,
        item.title,
        item.cat,
        item.desc,
        item.loc,
        item.time,
        item.source,
        item.status,
        item.payload,
        sha,
        officerId
      ]
    );
    evidenceMap[item.code] = res.insertId;
    console.log(`  -> Registered ${item.code} (ID: ${res.insertId}) | Hash: ${sha.slice(0, 16)}...`);
  }

  // 6. Establish Evidence Relationships (Graph Topology)
  console.log('[4/7] Establishing Evidentiary Graph Relationships...');
  // Note: EVD-CAMPUS-007 is intentionally omitted to serve as the DISCONNECTED EVIDENCE GAP!
  const edges = [
    {
      src: evidenceMap['EVD-CAMPUS-001'],
      tgt: evidenceMap['EVD-CAMPUS-002'],
      type: 'CORROBORATES_MOVEMENT',
      nature: 'CONFIRMED_FACT',
      desc: 'Access scan at 21:42 precedes 4th floor corridor camera motion trigger at 21:48.',
      weight: 0.92
    },
    {
      src: evidenceMap['EVD-CAMPUS-002'],
      tgt: evidenceMap['EVD-CAMPUS-003'],
      type: 'TEMPORAL_ALIGNMENT',
      nature: 'UNVERIFIED_OBSERVATION',
      desc: 'CCTV corridor egress aligns with witness auditory timeline of hurried footsteps in fire stairwell.',
      weight: 0.85
    },
    {
      src: evidenceMap['EVD-CAMPUS-001'],
      tgt: evidenceMap['EVD-CAMPUS-006'],
      type: 'TEMPORAL_SEQUENCE',
      nature: 'CONFIRMED_FACT',
      desc: 'Badge scan at 21:42 immediately precedes wireless network disconnect at 21:44:12.',
      weight: 0.95
    },
    {
      src: evidenceMap['EVD-CAMPUS-006'],
      tgt: evidenceMap['EVD-CAMPUS-004'],
      type: 'HARDWARE_MATCH',
      nature: 'CONFIRMED_FACT',
      desc: 'Hardware MAC address 3C:06:30:4A:BC:11 matches university inventory registry for missing laptop.',
      weight: 1.00
    },
    {
      src: evidenceMap['EVD-CAMPUS-005'],
      tgt: evidenceMap['EVD-CAMPUS-001'],
      type: 'PERSON_OF_INTEREST',
      nature: 'CONFIRMED_FACT',
      desc: 'Contractor Devon Kross signed into campus building prior to badge scan sequence.',
      weight: 0.88
    }
  ];

  for (const edge of edges) {
    await execute(
      `INSERT INTO evidence_relationships (
        case_id, source_type, source_id, target_type, target_id, 
        relation_type, confidence_weight, relationship_nature, notes, discovered_by
      ) VALUES (?, 'EVIDENCE', ?, 'EVIDENCE', ?, ?, ?, ?, ?, 'OFFICER_MANUAL')`,
      [caseId, edge.src, edge.tgt, edge.type, edge.weight, edge.nature, edge.desc]
    );
  }
  console.log(`  -> ${edges.length} Relational Edges created connecting E001, E002, E003, E004, E005, E006.`);
  console.log('  -> EVD-CAMPUS-007 (Emergency Override Key) left isolated (degree 0) for Evidence-Gap detection.');

  // 7. Chronological Investigation Timeline Events
  console.log('[5/7] Inserting Chronological Timeline Reconstruction...');
  const timelineRecords = [
    {
      eid: evidenceMap['EVD-CAMPUS-005'],
      title: 'Devon Kross Security Desk Sign-In',
      desc: 'Contractor signs into building citing network cabinet servicing. No exit time recorded.',
      time: '2026-11-20 20:45:00',
      loc: 'Ground Floor South Security Desk',
      verified: 1,
      status: 'CONFIRMED_FACT'
    },
    {
      eid: evidenceMap['EVD-CAMPUS-001'],
      title: 'Badge #4491 Scans Into Lab 402',
      desc: 'Dr. Julian Vance badge registers access into laboratory.',
      time: '2026-11-20 21:14:00',
      loc: 'Turing Hall Room 402 Entrance',
      verified: 1,
      status: 'CONFIRMED_FACT'
    },
    {
      eid: evidenceMap['EVD-CAMPUS-003'],
      title: 'Elena Rostova Hears Door Chime & Footsteps',
      desc: 'Witness in Lab 405 notes distinct chime and rapid footsteps.',
      time: '2026-11-20 21:40:00',
      loc: 'Turing Hall 4th Floor Corridor / Stairwell',
      verified: 0,
      status: 'UNVERIFIED_OBSERVATION'
    },
    {
      eid: evidenceMap['EVD-CAMPUS-001'],
      title: 'Badge #8812 Scans Into Lab 402',
      desc: 'Contractor Devon Kross badge registers access into laboratory.',
      time: '2026-11-20 21:42:00',
      loc: 'Turing Hall Room 402 Entrance',
      verified: 1,
      status: 'CONFIRMED_FACT'
    },
    {
      eid: evidenceMap['EVD-CAMPUS-006'],
      title: 'Laptop Hardware Drops from Campus Wi-Fi',
      desc: 'Radius authentication disconnects for MAC 3C:06:30:4A:BC:11.',
      time: '2026-11-20 21:44:12',
      loc: 'Wi-Fi AP-402 (5GHz Turing-4E)',
      verified: 1,
      status: 'CONFIRMED_FACT'
    },
    {
      eid: evidenceMap['EVD-CAMPUS-002'],
      title: 'Corridor CCTV Captures Hooded Individual Exiting',
      desc: 'Camera 4E motion trigger logs individual with backpack descending fire stairwell.',
      time: '2026-11-20 21:48:00',
      loc: 'Turing Hall East Wing Fire Exit',
      verified: 1,
      status: 'CONFIRMED_FACT'
    },
    {
      eid: evidenceMap['EVD-CAMPUS-004'],
      title: 'Formal Theft Discovery Reported by Prof. Reynolds',
      desc: 'Workstation found empty. Incident reported to campus police. Note: 10h 42m temporal gap.',
      time: '2026-11-21 08:30:00',
      loc: 'Turing Hall Room 402 Desk #1',
      verified: 1,
      status: 'CONFIRMED_FACT'
    }
  ];

  for (const t of timelineRecords) {
    await execute(
      `INSERT INTO investigation_timelines (
        case_id, event_timestamp, event_title, event_description, 
        entity_type, entity_id, location, source_evidence_id, status, is_verified
      ) VALUES (?, ?, ?, ?, 'EVIDENCE', ?, ?, ?, ?, ?)`,
      [caseId, t.time, t.title, t.desc, t.eid, t.loc, t.eid, t.status, t.verified]
    );
  }
  console.log(`  -> ${timelineRecords.length} Timeline events inserted with precision tags & 10h 42m gap.`);

  // 8. Chain of Custody Events
  console.log('[6/7] Generating Tamper-Evident Chain-of-Custody Events...');
  const custodyItems = [
    {
      eid: evidenceMap['EVD-CAMPUS-001'],
      prev: 'Turing Hall Door Reader Frame',
      newC: 'Det. Alexander Cross (DET-8841)',
      reason: 'Digital extraction of door reader memory buffer',
      loc: 'Turing Hall Room 402 Entrance',
      notes: 'Dumped via encrypted serial interface. Hash verified.'
    },
    {
      eid: evidenceMap['EVD-CAMPUS-007'],
      prev: 'Custodian Closet #2 Pegboard',
      newC: 'Det. Sarah Lin (DET-9912)',
      reason: 'Physical recovery of unrecorded override key',
      loc: 'Turing Hall Ground Floor Service Hallway',
      notes: 'Preserved for fingerprint and touch DNA analysis.'
    }
  ];

  for (const c of custodyItems) {
    const stateHash = computeHash(`CUSTODY_${c.eid}_${Date.now()}`);
    await execute(
      `INSERT INTO evidence_custody_events (
        evidence_id, case_id, previous_custodian, new_custodian, 
        transfer_timestamp, transfer_reason, transfer_location, 
        transfer_notes, transferring_officer_id, verification_status, 
        related_fingerprint, is_successful
      ) VALUES (?, ?, ?, ?, NOW(), ?, ?, ?, ?, 'VERIFIED', ?, 1)`,
      [
        c.eid,
        caseId,
        c.prev,
        c.newC,
        c.reason,
        c.loc,
        c.notes,
        officerId,
        stateHash
      ]
    );
  }
  console.log(`  -> ${custodyItems.length} Custody events registered with cryptographic state hashes.`);

  // 9. Prioritized Investigative Leads (Max-Heap)
  console.log('[7/7] Adding Prioritized Investigative Leads for Max-Heap Showcase...');
  const leads = [
    {
      score: 95.0,
      title: 'Subpoena Badge #8812 Owner Devon Kross Phone Location Records',
      hyp: 'Contractor Devon Kross was physically present inside Lab 402 when network disconnected.',
      action: 'Obtain cellular tower dump for Turing Hall perimeter covering 21:00-22:00.',
      gap: 'ALIBI_GAP'
    },
    {
      score: 91.5,
      title: 'Analyze Custodian Closet #2 Touch DNA & Latent Prints on Key E007',
      hyp: 'Key E007 is an evidence gap node. Mechanical override key was displaced without logging.',
      action: 'Submit physical key to forensics bureau for DNA and ridge-pattern lifting.',
      gap: 'MISSING_EVIDENCE'
    },
    {
      score: 84.0,
      title: 'Audit Network Radius Authentication Logs for MAC External Reconnection',
      hyp: 'Stolen laptop may attempt Wi-Fi reconnection or telemetry ping.',
      action: 'Coordinate with Campus NOC to place MAC 3C:06:30:4A:BC:11 on honeypot alert list.',
      gap: 'MISSING_EVIDENCE'
    },
    {
      score: 72.0,
      title: 'Review Dr. Julian Vance Lab 402 Keycard Authorization History',
      hyp: 'Dr. Vance accessed lab 30 minutes prior to disappearance. Clarify reasons for late entry.',
      action: 'Schedule formal recorded follow-up interview with Dr. Vance.',
      gap: 'TIMELINE_CONTRADICTION'
    }
  ];

  for (const lead of leads) {
    await execute(
      `INSERT INTO investigation_leads (
        case_id, title, hypothesis, recommended_action, lead_status, 
        priority_score, assigned_officer_id, source_gap_type, generated_by
      ) VALUES (?, ?, ?, ?, 'OPEN', ?, ?, ?, 'OFFICER_MANUAL')`,
      [caseId, lead.title, lead.hyp, lead.action, lead.score, officerId, lead.gap]
    );
  }
  console.log(`  -> ${leads.length} Leads inserted with priority scores (95.0 -> 72.0).`);

  console.log('\n================================================================');
  console.log(` SUCCESS: Demo Investigation seeded under case_id ${caseId}`);
  console.log(` Docket: ${caseNumber}`);
  console.log(' All records safely isolated. Ready for viva demonstration.');
  console.log('================================================================\n');

  return caseId;
}

if (require.main === module) {
  seedDemoCase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[SEED ERROR]', err);
      process.exit(1);
    });
}

module.exports = { seedDemoCase };

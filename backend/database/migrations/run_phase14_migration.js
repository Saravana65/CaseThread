/**
 * @file run_phase14_migration.js
 * @brief Executes Phase 14 database schema extensions cleanly against MySQL.
 */

const { execute, testConnection } = require('../connection');

async function migrate() {
  await testConnection();
  console.log('[MIGRATION] Checking Phase 14 schema columns...');

  const dbName = process.env.DB_NAME || 'casethread_db';

  async function columnExists(table, column) {
    const [rows] = await execute(`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?
    `, [dbName, table, column]);
    return rows.length > 0;
  }

  // 1. Columns for knowledge_sources
  const sourceCols = [
    { name: 'country', def: 'VARCHAR(100) NOT NULL DEFAULT "Global" AFTER jurisdiction' },
    { name: 'source_reliability', def: 'ENUM("OFFICIAL_GOVERNMENT", "JUDICIAL_RECORD", "POLICE_DEPARTMENT", "OPEN_DATA_PORTAL", "AUTHORIZED_ARCHIVE", "UNVERIFIED") NOT NULL DEFAULT "OFFICIAL_GOVERNMENT" AFTER license_terms' },
    { name: 'update_frequency', def: 'VARCHAR(50) DEFAULT "MONTHLY" AFTER access_restrictions' },
    { name: 'last_sync_at', def: 'TIMESTAMP NULL AFTER update_frequency' }
  ];

  for (const col of sourceCols) {
    const exists = await columnExists('knowledge_sources', col.name);
    if (!exists) {
      await execute(`ALTER TABLE knowledge_sources ADD COLUMN ${col.name} ${col.def}`);
      console.log(`[OK] knowledge_sources.${col.name} added.`);
    } else {
      console.log(`[-] knowledge_sources.${col.name} already exists.`);
    }
  }

  // 2. Columns for knowledge_documents
  const docCols = [
    { name: 'country', def: 'VARCHAR(100) NOT NULL DEFAULT "India" AFTER case_reference_number' },
    { name: 'region_state', def: 'VARCHAR(100) NULL AFTER country' },
    { name: 'city', def: 'VARCHAR(100) NULL AFTER region_state' },
    { name: 'crime_subtype', def: 'VARCHAR(100) NULL AFTER crime_category' },
    { name: 'incident_datetime', def: 'DATETIME NULL AFTER crime_subtype' },
    { name: 'stolen_property', def: 'TEXT NULL AFTER case_outcome' },
    { name: 'property_recovered', def: 'BOOLEAN DEFAULT NULL AFTER stolen_property' },
    { name: 'documented_circumstances', def: 'TEXT NULL AFTER property_recovered' },
    { name: 'investigation_status', def: 'VARCHAR(100) NULL AFTER documented_circumstances' },
    { name: 'investigative_actions', def: 'TEXT NULL AFTER investigation_status' },
    { name: 'evidence_types', def: 'TEXT NULL AFTER investigative_actions' },
    { name: 'is_investigation_details_available', def: 'BOOLEAN NOT NULL DEFAULT FALSE AFTER evidence_types' },
    { name: 'language', def: 'VARCHAR(20) NOT NULL DEFAULT "en" AFTER is_investigation_details_available' },
    { name: 'translated_text', def: 'LONGTEXT NULL AFTER language' },
    { name: 'translation_status', def: 'ENUM("NONE", "AUTO_TRANSLATED", "OFFICIAL_VERIFIED") NOT NULL DEFAULT "NONE" AFTER translated_text' },
    { name: 'record_level', def: 'ENUM("CASE_LEVEL", "COURT_JUDGMENT", "POLICE_INCIDENT", "AGGREGATE_STATISTIC") NOT NULL DEFAULT "CASE_LEVEL" AFTER translation_status' }
  ];

  for (const col of docCols) {
    const exists = await columnExists('knowledge_documents', col.name);
    if (!exists) {
      await execute(`ALTER TABLE knowledge_documents ADD COLUMN ${col.name} ${col.def}`);
      console.log(`[OK] knowledge_documents.${col.name} added.`);
    } else {
      console.log(`[-] knowledge_documents.${col.name} already exists.`);
    }
  }

  // 3. Columns for knowledge_chunks
  const chunkCols = [
    { name: 'language', def: 'VARCHAR(20) NOT NULL DEFAULT "en" AFTER section_reference' }
  ];

  for (const col of chunkCols) {
    const exists = await columnExists('knowledge_chunks', col.name);
    if (!exists) {
      await execute(`ALTER TABLE knowledge_chunks ADD COLUMN ${col.name} ${col.def}`);
      console.log(`[OK] knowledge_chunks.${col.name} added.`);
    } else {
      console.log(`[-] knowledge_chunks.${col.name} already exists.`);
    }
  }

  // 4. Indexes
  try {
    await execute('CREATE INDEX idx_kd_country_crime ON knowledge_documents (country, crime_category)');
    console.log('[OK] Index idx_kd_country_crime created.');
  } catch (err) {
    if (!err.message.includes('Duplicate key name')) console.warn(err.message);
  }

  try {
    await execute('CREATE INDEX idx_kd_incident_dt ON knowledge_documents (incident_datetime)');
    console.log('[OK] Index idx_kd_incident_dt created.');
  } catch (err) {
    if (!err.message.includes('Duplicate key name')) console.warn(err.message);
  }

  try {
    await execute('CREATE INDEX idx_kd_record_level ON knowledge_documents (record_level)');
    console.log('[OK] Index idx_kd_record_level created.');
  } catch (err) {
    if (!err.message.includes('Duplicate key name')) console.warn(err.message);
  }

  console.log('[MIGRATION] Phase 14 schema migration completed successfully.');
}

if (require.main === module) {
  migrate().catch(err => {
    console.error('Fatal migration error:', err);
    process.exit(1);
  });
}

module.exports = migrate;

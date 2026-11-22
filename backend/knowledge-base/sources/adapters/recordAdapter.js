/**
 * @file recordAdapter.js
 * @brief Normalizes raw heterogeneous payloads from international data sources into the
 * CaseThread Global Crime Record Schema.
 * @project CASETHREAD
 */

class RecordAdapter {
  /**
   * Adapts a Police.uk raw JSON record.
   */
  static adaptUkPoliceRecord(raw, sourceMeta = {}) {
    const categoryRaw = raw.category || 'other-theft';
    // Map UK categories to standard CaseThread crime categories
    const categoryMapping = {
      'burglary': 'BURGLARY',
      'robbery': 'ROBBERY',
      'theft-from-the-person': 'THEFT',
      'other-theft': 'THEFT',
      'bicycle-theft': 'THEFT',
      'shoplifting': 'THEFT',
      'vehicle-crime': 'VEHICLE_THEFT',
      'violent-crime': 'HOMICIDE_AND_VIOLENT_CRIME',
      'possession-of-weapons': 'ORGANIZED_CRIME',
      'drugs': 'DRUG_OFFENSES',
      'criminal-damage-arson': 'PROPERTY_CRIME',
      'anti-social-behaviour': 'PUBLIC_ORDER'
    };

    const stdCategory = categoryMapping[categoryRaw] || 'GENERAL_CRIME';
    const month = raw.month || '2024-01';
    const incidentDate = new Date(`${month}-01T00:00:00Z`);

    const locationName = raw.location?.street?.name || 'Street Record';
    const outcomeCategory = raw.outcome_status?.category || 'Under investigation / Status not published';
    const outcomeDate = raw.outcome_status?.date || null;

    const caseRef = raw.persistent_id || `UK-POLICE-${raw.id || Math.random().toString(36).slice(2, 10)}`;

    const circumstances = [
      `UK Street Crime Incident Record: ${categoryRaw.toUpperCase().replace(/-/g, ' ')}.`,
      `Reported Month: ${month}.`,
      `Street Location: ${locationName}.`,
      raw.location?.latitude ? `Coordinates: ${raw.location.latitude}, ${raw.location.longitude}.` : null,
      `Outcome Status: ${outcomeCategory} (as of ${outcomeDate || month}).`
    ].filter(Boolean).join('\n');

    return {
      country: 'United Kingdom',
      region_state: 'England and Wales',
      city: 'London / Metropolitan Police Service',
      jurisdiction: 'United Kingdom Police Service',
      case_reference_number: caseRef,
      document_title: `UK Police Crime Record: ${caseRef} (${categoryRaw})`,
      document_type: 'JSON',
      source_url: 'https://data.police.uk/api/',
      publication_date: new Date(month + '-01'),
      incident_datetime: incidentDate,
      crime_category: stdCategory,
      crime_subtype: categoryRaw.replace(/-/g, ' '),
      case_outcome: outcomeCategory,
      stolen_property: categoryRaw.includes('theft') || categoryRaw.includes('burglary') ? 'Personal property / vehicles (detailed inventory restricted)' : null,
      property_recovered: outcomeCategory.toLowerCase().includes('recovered') ? true : null,
      documented_circumstances: circumstances,
      investigation_status: outcomeCategory.toLowerCase().includes('investigation') ? 'UNDER_INVESTIGATION' : 'RESOLVED',
      investigative_actions: null, // Police narrative notes restricted under UK GDPR/Data Protection Act 2018
      evidence_types: 'STREET_LOG, LOCATION_GEODATA',
      is_investigation_details_available: false,
      language: 'en',
      record_level: 'CASE_LEVEL',
      source_reliability: 'OFFICIAL_GOVERNMENT',
      raw_payload: raw
    };
  }

  /**
   * Adapts a US Chicago / Socrata Open Crime Data raw record.
   */
  static adaptUsOpenRecord(raw, sourceMeta = {}) {
    const primaryType = raw.primary_type || 'THEFT';
    const description = raw.description || '';
    const caseNumber = raw.case_number || `US-SOCRATA-${raw.id || Math.random().toString(36).slice(2, 10)}`;
    const dateStr = raw.date || new Date().toISOString();
    const incidentDate = new Date(dateStr);

    const arrest = raw.arrest === true || raw.arrest === 'true';
    const domestic = raw.domestic === true || raw.domestic === 'true';
    const block = raw.block || 'Anonymized Block Location';
    const locDesc = raw.location_description || 'COMMERCIAL / RESIDENTIAL';

    let category = 'GENERAL_CRIME';
    if (primaryType.includes('ROBBERY')) category = 'ROBBERY';
    else if (primaryType.includes('BURGLARY')) category = 'BURGLARY';
    else if (primaryType.includes('HOMICIDE')) category = 'HOMICIDE';
    else if (primaryType.includes('THEFT') || primaryType.includes('LARCENY')) category = 'THEFT';
    else if (primaryType.includes('MOTOR VEHICLE')) category = 'VEHICLE_THEFT';
    else if (primaryType.includes('KIDNAPPING')) category = 'KIDNAPPING';
    else if (primaryType.includes('FRAUD') || primaryType.includes('DECEPTIVE')) category = 'FINANCIAL_FRAUD';
    else if (primaryType.includes('WEAPONS')) category = 'ORGANIZED_CRIME';
    else if (primaryType.includes('NARCOTICS')) category = 'DRUG_OFFENSES';

    // Infer stolen property details from description if available
    let stolenProperty = null;
    if (description.includes('$500') || description.includes('OVER') || primaryType.includes('THEFT') || primaryType.includes('BURGLARY')) {
      stolenProperty = `Documented stolen items: ${description} at ${locDesc}`;
    }

    const outcome = arrest ? 'ARREST_EFFECTED' : 'UNRESOLVED_NO_ARREST';
    const circumstances = [
      `US Open Data Crime Record: ${primaryType} - ${description}.`,
      `Case Number: ${caseNumber}.`,
      `Incident Timestamp: ${dateStr}.`,
      `Premises / Location Type: ${locDesc}.`,
      `Block Address: ${block}.`,
      `Arrest Made: ${arrest ? 'YES' : 'NO'}.`,
      `Domestic Incident: ${domestic ? 'YES' : 'NO'}.`,
      raw.fbi_code ? `FBI Uniform Crime Reporting Code: ${raw.fbi_code}.` : null
    ].filter(Boolean).join('\n');

    return {
      country: 'United States',
      region_state: 'Illinois',
      city: 'Chicago',
      jurisdiction: 'Cook County / Chicago Police Department',
      case_reference_number: caseNumber,
      document_title: `US Police Incident Record: ${caseNumber} (${primaryType})`,
      document_type: 'JSON',
      source_url: 'https://data.cityofchicago.org/resource/ijzp-q8t2.json',
      publication_date: incidentDate,
      incident_datetime: incidentDate,
      crime_category: category,
      crime_subtype: `${primaryType}: ${description}`.trim(),
      case_outcome: outcome,
      stolen_property: stolenProperty,
      property_recovered: null, // Recovery details not separated in public SODA stream
      documented_circumstances: circumstances,
      investigation_status: arrest ? 'CLOSED_BY_ARREST' : 'OPEN_PENDING_LEADS',
      investigative_actions: arrest ? 'Police officer dispatched to scene; suspect apprehended and processed under municipal booking.' : 'Patrol unit responded; preliminary offense report filed.',
      evidence_types: 'POLICE_INCIDENT_REPORT, PREMISES_SURVEY',
      is_investigation_details_available: true,
      language: 'en',
      record_level: 'CASE_LEVEL',
      source_reliability: 'OFFICIAL_GOVERNMENT',
      raw_payload: raw
    };
  }

  /**
   * Adapts an Indian Judicial Court Judgment record.
   */
  static adaptIndiaJudicialRecord(raw, sourceMeta = {}) {
    const caseRef = raw.case_number || raw.case_reference_number || `IND-JUD-${Date.now()}`;
    const jurisdiction = raw.jurisdiction || 'High Court of Judicature';
    const category = raw.crime_category || 'CYBERCRIME_AND_FRAUD';
    const incidentDate = raw.incident_datetime ? new Date(raw.incident_datetime) : (raw.incident_date ? new Date(raw.incident_date) : null);
    const pubDate = raw.publication_date ? new Date(raw.publication_date) : new Date();

    return {
      country: 'India',
      region_state: raw.region_state || 'Delhi / National Capital Territory',
      city: raw.city || 'New Delhi',
      jurisdiction: jurisdiction,
      case_reference_number: caseRef,
      document_title: raw.document_title || `State vs. Accused (${caseRef})`,
      document_type: raw.document_type || 'JSON',
      source_url: raw.source_url || 'https://ecourts.gov.in',
      publication_date: pubDate,
      incident_datetime: incidentDate,
      crime_category: category,
      crime_subtype: raw.crime_subtype || 'Section 420 IPC / Section 66 IT Act',
      case_outcome: raw.case_outcome || raw.verdict || 'CONVICTION',
      stolen_property: raw.stolen_property || 'Digital assets, compromised financial accounts, cash proceeds',
      property_recovered: raw.property_recovered !== undefined ? raw.property_recovered : true,
      documented_circumstances: raw.documented_circumstances || raw.facts || 'Judicial trial evaluating circumstantial and forensic digital trail.',
      investigation_status: 'JUDICIAL_DISPOSED',
      investigative_actions: raw.investigative_actions || 'Seizure of hard drives, analysis of hash values, witness testimony examination, recovery of proceeds under Section 27 Evidence Act.',
      evidence_types: raw.evidence_types || 'DIGITAL_FORENSICS, WITNESS_STATEMENTS, BANK_RECORDS',
      is_investigation_details_available: true,
      language: raw.language || 'en',
      record_level: 'COURT_JUDGMENT',
      source_reliability: 'JUDICIAL_RECORD',
      raw_payload: raw
    };
  }

  /**
   * Generic adapter for custom or international records.
   */
  static adaptGenericRecord(raw, defaults = {}) {
    return {
      country: raw.country || defaults.country || 'Global',
      region_state: raw.region_state || defaults.region_state || null,
      city: raw.city || defaults.city || null,
      jurisdiction: raw.jurisdiction || defaults.jurisdiction || 'International Jurisdiction',
      case_reference_number: raw.case_reference_number || raw.case_number || `REC-${Date.now()}`,
      document_title: raw.document_title || raw.title || 'International Crime Record',
      document_type: raw.document_type || 'JSON',
      source_url: raw.source_url || defaults.source_url || null,
      publication_date: raw.publication_date ? new Date(raw.publication_date) : new Date(),
      incident_datetime: raw.incident_datetime ? new Date(raw.incident_datetime) : null,
      crime_category: raw.crime_category || 'GENERAL_CRIME',
      crime_subtype: raw.crime_subtype || null,
      case_outcome: raw.case_outcome || raw.verdict || null,
      stolen_property: raw.stolen_property || null,
      property_recovered: raw.property_recovered !== undefined ? raw.property_recovered : null,
      documented_circumstances: raw.documented_circumstances || raw.summary || '',
      investigation_status: raw.investigation_status || 'UNKNOWN',
      investigative_actions: raw.investigative_actions || null,
      evidence_types: raw.evidence_types || null,
      is_investigation_details_available: !!raw.investigative_actions,
      language: raw.language || 'en',
      record_level: raw.record_level || defaults.record_level || 'CASE_LEVEL',
      source_reliability: raw.source_reliability || defaults.source_reliability || 'OPEN_DATA_PORTAL',
      raw_payload: raw
    };
  }
}

module.exports = RecordAdapter;

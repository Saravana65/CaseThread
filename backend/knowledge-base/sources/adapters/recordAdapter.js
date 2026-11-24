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
    const categoryRaw = raw.category || 'unknown';
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
    const month = raw.month;


    const locationName = raw.location?.street?.name || 'Street Record';
    const outcomeCategory = raw.outcome_status?.category || 'Under investigation / Status not published';
    const outcomeDate = raw.outcome_status?.date || null;

    const caseRef = raw.persistent_id || (raw.id ? `UK-POLICE-${raw.id}` : null);

    if (!caseRef) throw new Error('Police.uk record has no source identifier');
    const circumstances = [
      `UK Street Crime Incident Record: ${categoryRaw.toUpperCase().replace(/-/g, ' ')}.`,
      `Reported Month: ${month}.`,
      `Street Location: ${locationName}.`,
      raw.location?.latitude ? `Coordinates: ${raw.location.latitude}, ${raw.location.longitude}.` : null,
      `Outcome Status: ${outcomeCategory} (as of ${outcomeDate || month}).`
    ].filter(Boolean).join('\n');

    return {
      country: 'United Kingdom',
      region_state: null,
      city: null,
      jurisdiction: 'United Kingdom Police Service',
      case_reference_number: caseRef,
      document_title: `UK Police Crime Record: ${caseRef} (${categoryRaw})`,
      document_type: 'JSON',
      source_url: 'https://data.police.uk/api/',
      publication_date: month ? new Date(month + '-01') : null,
      incident_datetime: null,
      crime_category: stdCategory,
      crime_subtype: categoryRaw.replace(/-/g, ' '),
      case_outcome: outcomeCategory,
      stolen_property: null,
      property_recovered: outcomeCategory.toLowerCase().includes('recovered') ? true : null,
      documented_circumstances: circumstances,
      investigation_status: raw.outcome_status?.category || null,
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
    const primaryType = raw.primary_type || '';
    const description = raw.description || '';
    const caseNumber = raw.case_number || (raw.id ? `US-SOCRATA-${raw.id}` : null);
    if (!caseNumber) throw new Error('Chicago record has no source identifier');
    const dateStr = raw.date || null;
    const incidentDate = dateStr ? new Date(dateStr) : null;

    const arrest = raw.arrest === true || raw.arrest === 'true';
    const domestic = raw.domestic === true || raw.domestic === 'true';
    const block = raw.block || 'Anonymized Block Location';
    const locDesc = raw.location_description || 'Not recorded';

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

    const outcome = arrest ? 'ARREST_EFFECTED' : (raw.arrest === false || raw.arrest === 'false' ? 'NO_ARREST_RECORDED' : null);
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
      investigation_status: null,
      investigative_actions: null,
      evidence_types: 'POLICE_INCIDENT_REPORT',
      is_investigation_details_available: false,
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
    const caseRef = raw.case_number || raw.case_reference_number;
    if (!caseRef) throw new Error('Judicial archive entry has no case reference');
    return {
      ...this.adaptGenericRecord(raw, { country: 'India' }),
      case_reference_number: caseRef,
      document_title: raw.document_title || raw.title || caseRef,
      documented_circumstances: raw.documented_circumstances || raw.facts || null,
      incident_datetime: raw.incident_datetime || raw.incident_date || null,
      publication_date: raw.publication_date || null,
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

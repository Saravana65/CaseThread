/**
 * @file sourceRegistry.js
 * @brief Comprehensive worldwide crime record source registry.
 * Catalogs legal licenses, endpoints, data categories, rate limits, and operational statuses.
 * @project CASETHREAD
 */

const SOURCE_REGISTRY = {
  'uk_police_open_data': {
    id: 'uk_police_open_data',
    name: 'Police.uk Open Crime Data API',
    officialUrl: 'https://data.police.uk/api/',
    publisher: 'United Kingdom Home Office & National Police Chiefs\' Council (NPCC)',
    country: 'United Kingdom',
    jurisdiction: 'England, Wales & Northern Ireland',
    dataCategories: ['burglary', 'robbery', 'violent-crime', 'vehicle-crime', 'theft', 'drugs', 'criminal-damage-arson', 'other-theft'],
    availableFormats: ['JSON', 'CSV'],
    accessMethod: 'REST API & Monthly Bulk Download',
    authRequirements: 'None (Publicly Accessible Open API)',
    license: 'Open Government Licence v3.0 (OGL v3.0)',
    permittedStorageAndProcessing: 'Permitted for internal search, data normalization, AI indexing, non-commercial and commercial analytical use.',
    redistributionRestrictions: 'Requires attribution to Crown copyright and Open Government Licence v3.0.',
    rateLimits: '15 requests per second per client IP with standard 429 response handling.',
    updateFrequency: 'Monthly publication cycle',
    recordLevel: 'CASE_LEVEL',
    hasOutcomes: true,
    hasInvestigationDetails: false, // Location and police outcome category available, investigative notes not disclosed to protect victims
    status: 'OPERATIONAL',
    connectorClass: 'UkPoliceConnector'
  },

  'us_open_crime_portal': {
    id: 'us_open_crime_portal',
    name: 'US Open Data Portal — City of Chicago Police Incident Records',
    officialUrl: 'https://data.cityofchicago.org/resource/ijzp-q8t2.json',
    publisher: 'City of Chicago Department of Police / Data.gov',
    country: 'United States',
    jurisdiction: 'Cook County, Illinois, United States',
    dataCategories: ['HOMICIDE', 'ROBBERY', 'BURGLARY', 'THEFT', 'MOTOR VEHICLE THEFT', 'ASSAULT', 'NARCOTICS', 'KIDNAPPING', 'CRIMINAL DAMAGE'],
    availableFormats: ['JSON', 'CSV', 'SODA API'],
    accessMethod: 'SODA REST API ($limit, $offset, $where)',
    authRequirements: 'None for public reading (optional Socrata App Token for high throughput)',
    license: 'US Public Domain / City of Chicago Open Data Terms of Use',
    permittedStorageAndProcessing: 'Permitted for internal analytical ingestion, research, AI retrieval indexing.',
    redistributionRestrictions: 'No warranty; data provided as-is; addresses anonymized to block level for privacy.',
    rateLimits: '1,000 requests per rolling hour without token, 50,000 requests with free app token.',
    updateFrequency: 'Daily updates',
    recordLevel: 'CASE_LEVEL',
    hasOutcomes: true, // Includes Arrest (true/false) and Domestic flags
    hasInvestigationDetails: false, // Narrative reports restricted under FOIA exemptions
    status: 'OPERATIONAL',
    connectorClass: 'UsOpenDataConnector'
  },

  'india_judicial_archive': {
    id: 'india_judicial_archive',
    name: 'India Public Judicial & Court Judgments Repository',
    officialUrl: 'https://ecourts.gov.in / https://data.gov.in',
    publisher: 'eCourts Services / High Courts of India / Open Government Data Platform India',
    country: 'India',
    jurisdiction: 'Union of India / State High Courts & Sessions Courts',
    dataCategories: ['Murder (IPC 302/BNS 103)', 'Robbery (IPC 392/BNS 309)', 'Cheating & Fraud (IPC 420/BNS 318)', 'Cybercrime (IT Act)', 'Kidnapping', 'Arms Act'],
    availableFormats: ['PDF', 'HTML', 'TXT', 'JSON'],
    accessMethod: 'Public Judicial Case Search / OGD Datasets / Digital Judgment Archives',
    authRequirements: 'None for published public judicial verdicts (CAPTCHA may exist on live eCourts portals)',
    license: 'Government Open Data License - India (GODL-India) & Public Judicial Records Doctrine',
    permittedStorageAndProcessing: 'Legal research, judicial precedent indexing, forensic case analysis, academic evaluation.',
    redistributionRestrictions: 'Redaction of victim identities mandated by Section 228A IPC/POCSO/Rape shields.',
    rateLimits: 'Varies by court web gateway; offline batch imports recommended.',
    updateFrequency: 'Continuous upon delivery of court verdicts',
    recordLevel: 'COURT_JUDGMENT',
    hasOutcomes: true, // Acquittal, Conviction, Restitution, Sentence length
    hasInvestigationDetails: true, // Judgments document police investigation steps, recovery of weapons, witness corroboration
    status: 'OPERATIONAL',
    connectorClass: 'IndiaJudicialConnector'
  },

  'canada_open_police_data': {
    id: 'canada_open_police_data',
    name: 'Toronto Police Service Open Data (MCI — Major Crime Indicators)',
    officialUrl: 'https://data.torontopolice.on.ca/pages/open-data',
    publisher: 'Toronto Police Service Analytics & Innovation Unit / Open Canada',
    country: 'Canada',
    jurisdiction: 'Toronto, Ontario, Canada',
    dataCategories: ['Assault', 'Auto Theft', 'Break and Enter', 'Robbery', 'Theft Over'],
    availableFormats: ['GeoJSON', 'CSV', 'REST FeatureService'],
    accessMethod: 'Esri REST API & CKAN Open Data',
    authRequirements: 'None (Open Municipal Police Portal)',
    license: 'Open Data Licence - City of Toronto v1.0',
    permittedStorageAndProcessing: 'Permitted for crime pattern analysis and automated indexing.',
    redistributionRestrictions: 'Attribution required; geocoded to intersection level for privacy.',
    rateLimits: 'Standard municipal web service limits (approx. 60 req/min).',
    updateFrequency: 'Annual and quarterly data updates',
    recordLevel: 'POLICE_INCIDENT',
    hasOutcomes: false, // Preliminary incident report without final court disposition
    hasInvestigationDetails: false,
    status: 'CONFIGURED',
    connectorClass: 'CanadaCrimeConnector'
  },

  'australia_nsw_bocsar': {
    id: 'australia_nsw_bocsar',
    name: 'NSW Bureau of Crime Statistics and Research (BOCSAR) Open Data',
    officialUrl: 'https://www.bocsar.nsw.gov.au/Pages/bocsar_datasets/Datasets.aspx',
    publisher: 'New South Wales Department of Communities and Justice / Data.gov.au',
    country: 'Australia',
    jurisdiction: 'New South Wales, Australia',
    dataCategories: ['Homicide', 'Assault', 'Sexual Offenses', 'Robbery', 'Burglary (Break and Enter)', 'Theft', 'Fraud', 'Drug Offenses'],
    availableFormats: ['CSV', 'XLSX'],
    accessMethod: 'Open Data Portal Direct Download',
    authRequirements: 'None',
    license: 'Creative Commons Attribution 4.0 International (CC BY 4.0)',
    permittedStorageAndProcessing: 'Permitted for storage, analysis, transformation, and AI retrieval.',
    redistributionRestrictions: 'Attribution to NSW BOCSAR required.',
    rateLimits: 'Static dataset download, no active rate restrictions.',
    updateFrequency: 'Quarterly',
    recordLevel: 'AGGREGATE_STATISTIC', // Aggregated at Local Government Area (LGA) level
    hasOutcomes: true, // Court appearance statistics available in separate judicial stream
    hasInvestigationDetails: false,
    status: 'CONFIGURED',
    connectorClass: 'AustraliaCrimeConnector'
  },

  'fbi_cde_united_states': {
    id: 'fbi_cde_united_states',
    name: 'FBI Crime Data Explorer (NIBRS / UCR)',
    officialUrl: 'https://cde.ucr.cjis.gov/',
    publisher: 'Federal Bureau of Investigation Criminal Justice Information Services (CJIS)',
    country: 'United States',
    jurisdiction: 'Federal / National US Jurisdictions',
    dataCategories: ['National Incident-Based Reporting System (NIBRS)', 'Homicide', 'Human Trafficking', 'Arson', 'Hate Crime', 'Law Enforcement Officers Killed and Assaulted (LEOKA)'],
    availableFormats: ['REST API (api.data.gov)', 'Bulk CSV Downloads'],
    accessMethod: 'REST API via Data.gov API Umbrella',
    authRequirements: 'Requires free Data.gov API Key for direct programmatic queries',
    license: 'US Federal Public Domain',
    permittedStorageAndProcessing: 'Open government data, permitted for analytics and AI retrieval.',
    redistributionRestrictions: 'None (US Government Work)',
    rateLimits: '1,000 requests per hour per API Key.',
    updateFrequency: 'Annual / Semi-Annual Release',
    recordLevel: 'CASE_LEVEL', // NIBRS incident level
    hasOutcomes: true, // Clearance by arrest / exceptional means
    hasInvestigationDetails: false,
    status: 'REQUIRES_APPROVAL', // Needs user-registered Data.gov API key
    connectorClass: 'FbiCdeConnector'
  },

  'unodc_global_crime_data': {
    id: 'unodc_global_crime_data',
    name: 'United Nations Office on Drugs and Crime (UNODC) Data Portal',
    officialUrl: 'https://dataunodc.un.org/',
    publisher: 'United Nations Office on Drugs and Crime',
    country: 'Global / Multi-National',
    jurisdiction: 'Over 190 UN Member States',
    dataCategories: ['Intentional Homicide', 'Kidnapping', 'Human Trafficking', 'Firearms Trafficking', 'Organized Crime', 'Corruption'],
    availableFormats: ['CSV', 'SDMX', 'REST API'],
    accessMethod: 'Open Data Web Download & API',
    authRequirements: 'None',
    license: 'United Nations Open Access / Data Terms',
    permittedStorageAndProcessing: 'Permitted for comparative international crime research.',
    redistributionRestrictions: 'Attribution to UNODC required.',
    rateLimits: 'Not publicly rate limited for reasonable research traffic.',
    updateFrequency: 'Annual',
    recordLevel: 'AGGREGATE_STATISTIC',
    hasOutcomes: false,
    hasInvestigationDetails: false,
    status: 'CONFIGURED',
    connectorClass: 'UnodcCrimeConnector'
  }
};

class SourceRegistry {
  /**
   * Retrieves all registered sources in the system.
   */
  static getAllSources() {
    return Object.values(SOURCE_REGISTRY);
  }

  /**
   * Retrieves a single source descriptor by ID.
   */
  static getSource(sourceId) {
    return SOURCE_REGISTRY[sourceId] || null;
  }

  /**
   * Retrieves sources filtered by operational status.
   */
  static getSourcesByStatus(status) {
    return Object.values(SOURCE_REGISTRY).filter(s => s.status === status);
  }

  /**
   * Retrieves sources filtered by country.
   */
  static getSourcesByCountry(country) {
    return Object.values(SOURCE_REGISTRY).filter(s => 
      s.country.toLowerCase().includes(country.toLowerCase())
    );
  }
}

module.exports = {
  SOURCE_REGISTRY,
  SourceRegistry
};

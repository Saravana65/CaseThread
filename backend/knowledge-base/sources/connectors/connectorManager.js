/**
 * @file connectorManager.js
 * @brief Factory and lifecycle manager for worldwide source connectors.
 * @project CASETHREAD
 */

const { SOURCE_REGISTRY } = require('../registry/sourceRegistry');
const UkPoliceConnector = require('./ukPoliceConnector');
const UsOpenDataConnector = require('./usOpenDataConnector');
const IndiaJudicialConnector = require('./indiaJudicialConnector');
const CanadaCrimeConnector = require('./canadaCrimeConnector');
const AustraliaCrimeConnector = require('./australiaCrimeConnector');

const CONNECTOR_CLASSES = {
  'uk_police_open_data': UkPoliceConnector,
  'us_open_crime_portal': UsOpenDataConnector,
  'india_judicial_archive': IndiaJudicialConnector,
  'canada_open_police_data': CanadaCrimeConnector,
  'australia_nsw_bocsar': AustraliaCrimeConnector
};

class ConnectorManager {
  /**
   * Instantiates a connector for a given source ID.
   */
  static getConnector(sourceId, options = {}) {
    const config = SOURCE_REGISTRY[sourceId];
    if (!config) {
      throw new Error(`Unknown source ID: ${sourceId}`);
    }

    const ConnectorClass = CONNECTOR_CLASSES[sourceId];
    if (!ConnectorClass) {
      throw new Error(`No connector implementation found for source: ${sourceId}`);
    }

    return new ConnectorClass(config, options);
  }

  /**
   * Returns list of all operational source IDs ready for active synchronization.
   */
  static getOperationalSourceIds() {
    return Object.values(SOURCE_REGISTRY)
      .filter(s => s.status === 'OPERATIONAL')
      .map(s => s.id);
  }
}

module.exports = ConnectorManager;

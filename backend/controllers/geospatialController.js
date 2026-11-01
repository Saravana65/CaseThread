/**
 * @file geospatialController.js
 * @brief REST controller for CaseThread Geospatial Investigation & Mapping Subsystem.
 * @project CASETHREAD - Phase 9 Geospatial Intelligence
 */

const db = require('../database/connection');
const geoService = require('../services/geospatialService');

/**
 * Helper to verify authenticated officer case access (Case Isolation).
 */
async function verifyCaseAccess(caseId, officer) {
  const [cases] = await db.execute(
    'SELECT case_id, title, case_number, lead_officer_id FROM cases WHERE case_id = ?',
    [caseId]
  );
  if (!cases || cases.length === 0) {
    return { authorized: false, status: 404, message: `Case #${caseId} does not exist.` };
  }

  // Admin and Lead Officer always authorized; other officers must match lead_officer_id
  const officerRole = officer ? officer.role : '';
  const officerId = officer ? officer.officer_id : null;
  if (officerRole !== 'ADMIN' && cases[0].lead_officer_id !== officerId) {
    return { authorized: false, status: 403, message: `Access denied. Officer is not assigned to Case #${caseId}.` };
  }

  return { authorized: true, caseData: cases[0] };
}

/**
 * GET /api/v1/cases/:caseId/geospatial
 * Retrieves all geographical evidence records for a case.
 */
async function getCaseGeospatialPoints(req, res, next) {
  try {
    const caseId = parseInt(req.params.caseId, 10);
    if (isNaN(caseId)) {
      return res.status(400).json({ success: false, error: 'Invalid case ID parameter.' });
    }

    const access = await verifyCaseAccess(caseId, req.officer || req.user);
    if (!access.authorized) {
      return res.status(access.status).json({ success: false, error: access.message });
    }

    const sql = `
      SELECT g.*, 
             e.title AS evidence_title, 
             e.tracking_code AS evidence_tracking_code, 
             e.category AS evidence_category,
             e.integrity_status,
             e.verification_status AS evidence_verification_status
      FROM evidence_geospatial g
      JOIN evidence e ON g.evidence_id = e.evidence_id
      WHERE g.case_id = ?
      ORDER BY g.recorded_timestamp ASC, g.geospatial_id ASC
    `;

    const [rows] = await db.execute(sql, [caseId]);

    return res.status(200).json({
      success: true,
      case_id: caseId,
      total_points: rows.length,
      data: rows
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/cases/:caseId/geospatial/search
 * Executes geographical bounding-box or radius search with filters.
 */
async function searchGeospatialPoints(req, res, next) {
  try {
    const caseId = parseInt(req.params.caseId, 10);
    if (isNaN(caseId)) {
      return res.status(400).json({ success: false, error: 'Invalid case ID parameter.' });
    }

    const access = await verifyCaseAccess(caseId, req.officer || req.user);
    if (!access.authorized) {
      return res.status(access.status).json({ success: false, error: access.message });
    }

    const { type, center_lat, center_lon, radius_meters, unit, min_lat, max_lat, min_lon, max_lon, category, source, verification_status } = req.body;

    // Retrieve all points for the case first
    const sql = `
      SELECT g.*, 
             e.title AS evidence_title, 
             e.tracking_code AS evidence_tracking_code, 
             e.category AS evidence_category,
             e.integrity_status
      FROM evidence_geospatial g
      JOIN evidence e ON g.evidence_id = e.evidence_id
      WHERE g.case_id = ?
    `;
    const [allPoints] = await db.execute(sql, [caseId]);

    let results = [];

    if (type === 'RADIUS') {
      if (!geoService.isValidWgs84(center_lat, center_lon)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid center coordinates. Latitude must be between -90 and 90, Longitude between -180 and 180.'
        });
      }

      const rMeters = parseFloat(radius_meters);
      if (isNaN(rMeters) || rMeters <= 0 || rMeters > 500000) {
        return res.status(400).json({
          success: false,
          error: 'Invalid radius_meters. Must be a positive number up to 500,000 meters (500 km).'
        });
      }

      for (const pt of allPoints) {
        const dist = geoService.haversineDistanceMeters(center_lat, center_lon, pt.latitude, pt.longitude);
        if (dist <= rMeters) {
          const converted = geoService.convertDistance(dist, unit || 'meters');
          results.push({
            ...pt,
            distance_meters: Number(dist.toFixed(1)),
            formatted_distance: `${converted.value} ${converted.unit}`
          });
        }
      }

      // Sort ascending by distance from center
      results.sort((a, b) => a.distance_meters - b.distance_meters);

    } else if (type === 'BBOX') {
      const mnLat = parseFloat(min_lat);
      const mxLat = parseFloat(max_lat);
      const mnLon = parseFloat(min_lon);
      const mxLon = parseFloat(max_lon);

      if (isNaN(mnLat) || isNaN(mxLat) || isNaN(mnLon) || isNaN(mxLon)) {
        return res.status(400).json({
          success: false,
          error: 'Bounding box requires numeric min_lat, max_lat, min_lon, max_lon.'
        });
      }

      if (mnLat < -90 || mxLat > 90 || mnLat > mxLat) {
        return res.status(400).json({
          success: false,
          error: 'Invalid latitude range. min_lat must be <= max_lat and within [-90, 90].'
        });
      }

      for (const pt of allPoints) {
        // Handle normal vs antimeridian crossing
        let withinLon = false;
        if (mnLon <= mxLon) {
          withinLon = (pt.longitude >= mnLon && pt.longitude <= mxLon);
        } else {
          // Antimeridian wraparound
          withinLon = (pt.longitude >= mnLon || pt.longitude <= mxLon);
        }

        if (pt.latitude >= mnLat && pt.latitude <= mxLat && withinLon) {
          results.push(pt);
        }
      }
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid search type. Supported types: RADIUS, BBOX.'
      });
    }

    // Apply metadata filters
    if (category) {
      results = results.filter(r => r.evidence_category === category || r.entity_type === category);
    }
    if (source) {
      results = results.filter(r => r.location_source === source);
    }
    if (verification_status) {
      results = results.filter(r => r.verification_status === verification_status);
    }

    return res.status(200).json({
      success: true,
      case_id: caseId,
      search_type: type,
      total_matches: results.length,
      data: results
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/cases/:caseId/geospatial/clusters
 * Discovers spatial clusters and isolated evidence items.
 */
async function getGeospatialClusters(req, res, next) {
  try {
    const caseId = parseInt(req.params.caseId, 10);
    if (isNaN(caseId)) {
      return res.status(400).json({ success: false, error: 'Invalid case ID parameter.' });
    }

    const access = await verifyCaseAccess(caseId, req.officer || req.user);
    if (!access.authorized) {
      return res.status(access.status).json({ success: false, error: access.message });
    }

    const radiusMeters = parseFloat(req.query.cluster_radius_meters) || 200.0;
    if (radiusMeters <= 0 || radiusMeters > 50000) {
      return res.status(400).json({ success: false, error: 'cluster_radius_meters must be between 1 and 50,000 meters.' });
    }

    const sql = `
      SELECT g.*, e.title AS evidence_title, e.category AS evidence_category
      FROM evidence_geospatial g
      JOIN evidence e ON g.evidence_id = e.evidence_id
      WHERE g.case_id = ?
    `;
    const [points] = await db.execute(sql, [caseId]);

    const { clusters, isolated_points } = geoService.clusterGeospatialPoints(points, radiusMeters);

    return res.status(200).json({
      success: true,
      case_id: caseId,
      clustering_threshold_meters: radiusMeters,
      total_clusters: clusters.length,
      total_isolated_points: isolated_points.length,
      clusters,
      isolated_points
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/cases/:caseId/geospatial/analyze
 * Executes spatiotemporal correlation analysis and shared location detection.
 */
async function analyzeGeospatialCase(req, res, next) {
  try {
    const caseId = parseInt(req.params.caseId, 10);
    if (isNaN(caseId)) {
      return res.status(400).json({ success: false, error: 'Invalid case ID parameter.' });
    }

    const access = await verifyCaseAccess(caseId, req.officer || req.user);
    if (!access.authorized) {
      return res.status(access.status).json({ success: false, error: access.message });
    }

    const sql = `
      SELECT g.*, 
             e.title AS evidence_title, 
             e.tracking_code AS evidence_tracking_code,
             e.category AS evidence_category
      FROM evidence_geospatial g
      JOIN evidence e ON g.evidence_id = e.evidence_id
      WHERE g.case_id = ?
    `;
    const [points] = await db.execute(sql, [caseId]);

    // 1. Spatiotemporal Correlations & Speed Anomalies
    const spatiotemporalFindings = geoService.analyzeSpatiotemporalCorrelations(points);

    // 2. Shared Location Clusters
    const sharedLocations = geoService.detectSharedLocations(points, 25.0);

    return res.status(200).json({
      success: true,
      case_id: caseId,
      total_points_analyzed: points.length,
      spatiotemporal_findings: spatiotemporalFindings,
      shared_locations: sharedLocations,
      disclaimer: 'Geospatial and spatiotemporal correlations are decision-support indications only. Co-presence or proximity does NOT prove guilt or direct conspiratorial association.'
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/cases/:caseId/geospatial/points
 * Manually records or associates coordinates with an evidence item.
 */
async function createGeospatialPoint(req, res, next) {
  try {
    const caseId = parseInt(req.params.caseId, 10);
    if (isNaN(caseId)) {
      return res.status(400).json({ success: false, error: 'Invalid case ID parameter.' });
    }

    const access = await verifyCaseAccess(caseId, req.officer || req.user);
    if (!access.authorized) {
      return res.status(access.status).json({ success: false, error: access.message });
    }

    const {
      evidence_id,
      entity_type,
      entity_id,
      latitude,
      longitude,
      altitude,
      accuracy_meters,
      location_source,
      location_name,
      recorded_timestamp,
      verification_status,
      review_notes
    } = req.body;

    if (!evidence_id || isNaN(parseInt(evidence_id, 10))) {
      return res.status(400).json({ success: false, error: 'evidence_id is required.' });
    }

    if (!geoService.isValidWgs84(latitude, longitude)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid coordinates. Latitude must be in [-90, 90] and Longitude in [-180, 180].'
      });
    }

    // Verify evidence exists and belongs to case
    const [evRows] = await db.execute(
      'SELECT evidence_id, case_id, title FROM evidence WHERE evidence_id = ? AND case_id = ?',
      [evidence_id, caseId]
    );
    if (!evRows || evRows.length === 0) {
      return res.status(404).json({ success: false, error: `Evidence #${evidence_id} not found in Case #${caseId}.` });
    }

    const insertSql = `
      INSERT INTO evidence_geospatial (
        evidence_id, case_id, entity_type, entity_id, latitude, longitude,
        altitude, accuracy_meters, coordinate_reference_system, location_source,
        location_name, recorded_timestamp, timezone_offset, extraction_source,
        verification_status, officer_reviewed, reviewed_by_officer_id, review_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      evidence_id,
      caseId,
      entity_type || 'EVIDENCE',
      entity_id || null,
      parseFloat(latitude),
      parseFloat(longitude),
      altitude !== undefined ? parseFloat(altitude) : null,
      accuracy_meters !== undefined ? parseFloat(accuracy_meters) : null,
      'WGS84',
      location_source || 'OFFICER_ENTERED',
      location_name || null,
      recorded_timestamp || new Date().toISOString().slice(0, 19).replace('T', ' '),
      '+00:00',
      'Officer Manual Entry',
      verification_status || 'UNVERIFIED_OBSERVATION',
      1,
      (req.officer || req.user)?.officer_id || 1,
      review_notes || 'Manual entry by case investigator.'
    ];

    const [result] = await db.execute(insertSql, params);

    return res.status(201).json({
      success: true,
      message: 'Geospatial coordinates recorded successfully.',
      geospatial_id: result.insertId,
      data: {
        geospatial_id: result.insertId,
        evidence_id,
        case_id: caseId,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        location_source: location_source || 'OFFICER_ENTERED',
        location_name
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/evidence/:evidenceId/location
 * Retrieves coordinate records for a single evidence item.
 */
async function getEvidenceLocation(req, res, next) {
  try {
    const evidenceId = parseInt(req.params.evidenceId, 10);
    if (isNaN(evidenceId)) {
      return res.status(400).json({ success: false, error: 'Invalid evidence ID.' });
    }

    const [ev] = await db.execute('SELECT evidence_id, case_id, title FROM evidence WHERE evidence_id = ?', [evidenceId]);
    if (!ev || ev.length === 0) {
      return res.status(404).json({ success: false, error: `Evidence #${evidenceId} not found.` });
    }

    const access = await verifyCaseAccess(ev[0].case_id, req.officer || req.user);
    if (!access.authorized) {
      return res.status(access.status).json({ success: false, error: access.message });
    }

    const [locations] = await db.execute(
      'SELECT * FROM evidence_geospatial WHERE evidence_id = ? ORDER BY recorded_timestamp DESC',
      [evidenceId]
    );

    const [extractions] = await db.execute(
      'SELECT extraction_id, file_id, file_format, extracted_gps_lat, extracted_gps_lon, extracted_timestamp, officer_reviewed FROM evidence_metadata_extractions WHERE evidence_id = ? AND extracted_gps_lat IS NOT NULL',
      [evidenceId]
    );

    return res.status(200).json({
      success: true,
      evidence_id: evidenceId,
      case_id: ev[0].case_id,
      evidence_title: ev[0].title,
      locations,
      exif_gps_extractions: extractions
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/cases/:caseId/geospatial/points/:id/review
 * Officer review sign-off on recorded geospatial coordinates.
 */
async function reviewGeospatialPoint(req, res, next) {
  try {
    const caseId = parseInt(req.params.caseId, 10);
    const pointId = parseInt(req.params.id, 10);
    if (isNaN(caseId) || isNaN(pointId)) {
      return res.status(400).json({ success: false, error: 'Invalid case or point ID.' });
    }

    const access = await verifyCaseAccess(caseId, req.officer || req.user);
    if (!access.authorized) {
      return res.status(access.status).json({ success: false, error: access.message });
    }

    const { verification_status, review_notes } = req.body;

    const [updateResult] = await db.execute(
      'UPDATE evidence_geospatial SET officer_reviewed = ?, reviewed_by_officer_id = ?, review_notes = ?, verification_status = ? WHERE geospatial_id = ?',
      [1, (req.officer || req.user)?.officer_id || 1, review_notes || 'Reviewed by officer', verification_status || 'CONFIRMED_FACT', pointId]
    );

    if (updateResult.affectedRows === 0) {
      return res.status(404).json({ success: false, error: `Geospatial record #${pointId} not found.` });
    }

    return res.status(200).json({
      success: true,
      message: `Geospatial point #${pointId} reviewed and confirmed.`
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getCaseGeospatialPoints,
  searchGeospatialPoints,
  getGeospatialClusters,
  analyzeGeospatialCase,
  createGeospatialPoint,
  getEvidenceLocation,
  reviewGeospatialPoint
};

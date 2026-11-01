/**
 * @file geospatialService.js
 * @brief High-performance geospatial reasoning, Haversine clustering, and spatiotemporal analysis.
 * @project CASETHREAD - Geospatial Evidence Intelligence (Phase 9)
 */

const EARTH_RADIUS_METERS = 6371008.8;

/**
 * Validates coordinate pair according to WGS84 standards.
 * @param {number} lat Latitude between -90 and 90
 * @param {number} lon Longitude between -180 and 180
 * @returns {boolean} True if valid
 */
function isValidWgs84(lat, lon) {
  if (lat === null || lat === undefined || lon === null || lon === undefined) return false;
  const numLat = Number(lat);
  const numLon = Number(lon);
  if (!Number.isFinite(numLat) || !Number.isFinite(numLon)) return false;
  return (numLat >= -90.0 && numLat <= 90.0 && numLon >= -180.0 && numLon <= 180.0);
}

/**
 * Calculates great-circle Haversine distance in meters between two WGS84 points.
 * @param {number} lat1 Latitude of point 1
 * @param {number} lon1 Longitude of point 1
 * @param {number} lat2 Latitude of point 2
 * @param {number} lon2 Longitude of point 2
 * @returns {number} Geodesic distance in meters
 */
function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const l1 = Number(lat1);
  const ln1 = Number(lon1);
  const l2 = Number(lat2);
  const ln2 = Number(lon2);

  if (Math.abs(l1 - l2) < 1e-9 && Math.abs(ln1 - ln2) < 1e-9) {
    return 0.0;
  }

  const deg2rad = Math.PI / 180.0;
  const phi1 = l1 * deg2rad;
  const phi2 = l2 * deg2rad;
  const deltaPhi = (l2 - l1) * deg2rad;
  const deltaLambda = (ln2 - ln1) * deg2rad;

  const sinHalfDphi = Math.sin(deltaPhi / 2.0);
  const sinHalfDlam = Math.sin(deltaLambda / 2.0);

  const a = sinHalfDphi * sinHalfDphi +
            Math.cos(phi1) * Math.cos(phi2) * (sinHalfDlam * sinHalfDlam);

  const c = 2.0 * Math.atan2(Math.sqrt(Math.max(0, Math.min(1, a))), Math.sqrt(Math.max(0, 1 - a)));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Derives a conservative bounding box from a center coordinate and radius.
 */
function bboxFromRadiusMeters(centerLat, centerLon, radiusMeters) {
  const deg2rad = Math.PI / 180.0;
  const rad2deg = 180.0 / Math.PI;

  const deltaLat = (radiusMeters / EARTH_RADIUS_METERS) * rad2deg;
  let minLat = Math.max(-90.0, centerLat - deltaLat);
  let maxLat = Math.min(90.0, centerLat + deltaLat);

  const cosLat = Math.cos(centerLat * deg2rad);
  let minLon, maxLon;

  if (Math.abs(cosLat) < 0.001) {
    minLon = -180.0;
    maxLon = 180.0;
  } else {
    const deltaLon = (radiusMeters / (EARTH_RADIUS_METERS * cosLat)) * rad2deg;
    minLon = Math.max(-180.0, centerLon - deltaLon);
    maxLon = Math.min(180.0, centerLon + deltaLon);
  }

  return {
    min_lat: Number(minLat.toFixed(8)),
    max_lat: Number(maxLat.toFixed(8)),
    min_lon: Number(minLon.toFixed(8)),
    max_lon: Number(maxLon.toFixed(8))
  };
}

/**
 * Converts meters into specified distance unit.
 */
function convertDistance(meters, unit = 'meters') {
  switch (unit.toLowerCase()) {
    case 'km':
    case 'kilometers':
      return { value: Number((meters / 1000.0).toFixed(3)), unit: 'km' };
    case 'miles':
    case 'mi':
      return { value: Number((meters / 1609.344).toFixed(3)), unit: 'miles' };
    case 'feet':
    case 'ft':
      return { value: Number((meters * 3.28084).toFixed(1)), unit: 'feet' };
    case 'meters':
    default:
      return { value: Number(meters.toFixed(1)), unit: 'meters' };
  }
}

/**
 * Performs spatial clustering over evidence records using geodesic distance threshold.
 * Identifies high-density spatial groups and isolated records.
 * 
 * @param {Array} points Array of geospatial points with latitude & longitude
 * @param {number} thresholdMeters Maximum distance between points to belong to same cluster
 * @returns {Object} Clusters and isolated records
 */
function clusterGeospatialPoints(points, thresholdMeters = 200.0) {
  if (!points || points.length === 0) {
    return { clusters: [], isolated_points: [] };
  }

  const n = points.length;
  const adj = Array.from({ length: n }, () => []);

  // 1. Build adjacency list for points within distance threshold
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dist = haversineDistanceMeters(
        points[i].latitude, points[i].longitude,
        points[j].latitude, points[j].longitude
      );
      if (dist <= thresholdMeters) {
        adj[i].push({ index: j, distance: dist });
        adj[j].push({ index: i, distance: dist });
      }
    }
  }

  // 2. Discover connected components (Breadth-First Search)
  const visited = new Array(n).fill(false);
  const clusters = [];
  const isolatedPoints = [];
  let clusterCounter = 1;

  for (let i = 0; i < n; i++) {
    if (visited[i]) continue;

    const componentIndices = [];
    const queue = [i];
    visited[i] = true;

    while (queue.length > 0) {
      const u = queue.shift();
      componentIndices.push(u);

      for (const neighbor of adj[u]) {
        if (!visited[neighbor.index]) {
          visited[neighbor.index] = true;
          queue.push(neighbor.index);
        }
      }
    }

    if (componentIndices.length > 1) {
      // Cluster detected
      const clusterMembers = componentIndices.map(idx => points[idx]);
      
      // Calculate centroid and radius
      let sumLat = 0;
      let sumLon = 0;
      for (const pt of clusterMembers) {
        sumLat += pt.latitude;
        sumLon += pt.longitude;
      }
      const centroidLat = Number((sumLat / clusterMembers.length).toFixed(8));
      const centroidLon = Number((sumLon / clusterMembers.length).toFixed(8));

      let maxDistFromCentroid = 0;
      for (const pt of clusterMembers) {
        const d = haversineDistanceMeters(centroidLat, centroidLon, pt.latitude, pt.longitude);
        if (d > maxDistFromCentroid) maxDistFromCentroid = d;
      }

      clusters.push({
        cluster_id: `CLUSTER-GEO-${String(clusterCounter++).padStart(3, '0')}`,
        cluster_name: `Spatial Cluster (${clusterMembers.length} records near ${clusterMembers[0].location_name || 'Coordinates'})`,
        member_count: clusterMembers.length,
        centroid: {
          latitude: centroidLat,
          longitude: centroidLon
        },
        cluster_radius_meters: Number(maxDistFromCentroid.toFixed(1)),
        evidence_ids: clusterMembers.map(m => m.evidence_id),
        points: clusterMembers,
        explanation: `Identified ${clusterMembers.length} evidence items located within ${thresholdMeters}m spatial proximity.`
      });
    } else {
      // Isolated point
      isolatedPoints.push({
        ...points[componentIndices[0]],
        isolation_reason: `No other case evidence recorded within ${thresholdMeters}m geographical radius.`
      });
    }
  }

  return { clusters, isolated_points: isolatedPoints };
}

/**
 * Detects co-located or nearly co-located records (<= 25m).
 */
function detectSharedLocations(points, toleranceMeters = 25.0) {
  const sharedGroups = [];
  const handled = new Set();

  for (let i = 0; i < points.length; i++) {
    if (handled.has(i)) continue;

    const group = [points[i]];
    for (let j = i + 1; j < points.length; j++) {
      if (handled.has(j)) continue;
      const d = haversineDistanceMeters(
        points[i].latitude, points[i].longitude,
        points[j].latitude, points[j].longitude
      );
      if (d <= toleranceMeters) {
        group.push({ ...points[j], distance_to_anchor_meters: Number(d.toFixed(1)) });
        handled.add(j);
      }
    }

    if (group.length > 1) {
      handled.add(i);
      sharedGroups.push({
        location_signature: `${group[0].latitude.toFixed(5)},${group[0].longitude.toFixed(5)}`,
        record_count: group.length,
        anchor_location_name: group[0].location_name || 'Unlabeled Point',
        evidence_ids: group.map(g => g.evidence_id),
        records: group,
        matching_tolerance_meters: toleranceMeters,
        explanation: `${group.length} evidence observations share exact or near-identical coordinates (within ${toleranceMeters}m).`
      });
    }
  }

  return sharedGroups;
}

/**
 * Analyzes spatiotemporal correlations, identifying impossibly high transit velocities
 * and temporal-spatial co-presence events.
 * 
 * @param {Array} points Array of geospatial records with timestamps
 * @returns {Array} Structured explainable findings
 */
function analyzeSpatiotemporalCorrelations(points) {
  const findings = [];
  let findingId = 1;

  // Filter points with valid timestamps and sort chronologically
  const timestamped = points
    .filter(p => p.recorded_timestamp)
    .map(p => ({
      ...p,
      epoch_ms: new Date(p.recorded_timestamp).getTime()
    }))
    .filter(p => !isNaN(p.epoch_ms))
    .sort((a, b) => a.epoch_ms - b.epoch_ms);

  // 1. Spatiotemporal Travel Speed Anomaly Detection
  // Check pairs associated with the same entity or related suspect/vehicle
  for (let i = 0; i < timestamped.length; i++) {
    for (let j = i + 1; j < timestamped.length; j++) {
      const p1 = timestamped[i];
      const p2 = timestamped[j];

      const sameEntity = (p1.entity_id && p2.entity_id && p1.entity_id === p2.entity_id);
      const isSuspectOrVehicle = (p1.entity_type === 'SUSPECT' || p1.entity_type === 'VEHICLE_SIGHTING' ||
                                  p2.entity_type === 'SUSPECT' || p2.entity_type === 'VEHICLE_SIGHTING');

      // Analyze consecutive or closely timed observations
      const deltaSeconds = (p2.epoch_ms - p1.epoch_ms) / 1000.0;
      if (deltaSeconds <= 0) continue;

      // Evaluate within reasonable operational window (up to 4 hours)
      if (deltaSeconds > 14400) continue;

      const distMeters = haversineDistanceMeters(p1.latitude, p1.longitude, p2.latitude, p2.longitude);
      const speedKmh = (distMeters / deltaSeconds) * 3.6;

      // Ground travel threshold: speed > 180 km/h is highly suspicious or physically impossible
      if ((sameEntity || isSuspectOrVehicle) && speedKmh > 180.0 && distMeters > 500.0) {
        findings.push({
          finding_id: `GEO-SPEED-${String(findingId++).padStart(3, '0')}`,
          category: 'SPATIOTEMPORAL_SPEED_ANOMALY',
          title: `Impossible or Excessive Transit Velocity (${Math.round(speedKmh)} km/h)`,
          severity: speedKmh > 300.0 ? 'CRITICAL' : 'HIGH',
          supporting_evidence_ids: [p1.evidence_id, p2.evidence_id].filter(Boolean),
          observation_1: {
            evidence_id: p1.evidence_id,
            location: p1.location_name || `${p1.latitude}, ${p1.longitude}`,
            timestamp: p1.recorded_timestamp,
            source: p1.location_source
          },
          observation_2: {
            evidence_id: p2.evidence_id,
            location: p2.location_name || `${p2.latitude}, ${p2.longitude}`,
            timestamp: p2.recorded_timestamp,
            source: p2.location_source
          },
          calculated_straight_line_distance_meters: Number(distMeters.toFixed(1)),
          elapsed_seconds: Math.round(deltaSeconds),
          calculated_minimum_velocity_kmh: Number(speedKmh.toFixed(1)),
          detection_rule: 'Velocity V = (Great-Circle Distance / Elapsed Time) * 3.6. Flags transitions exceeding 180 km/h.',
          limitations: 'Calculated using straight-line geodesic distance; actual road transit distance would be greater. Does not establish deliberate deception; potential clock skew, cell tower triangulation lag, or false alibi statement must be corroborated.',
          suggested_action: 'Subpoena cell tower timing advances and cross-reference traffic camera feeds along transit corridor to verify whether alibi claims or timestamps are fraudulent.'
        });
      }

      // 2. Co-Presence / Temporal-Spatial Overlap (different entities at same place within 15 mins)
      if (p1.evidence_id !== p2.evidence_id && deltaSeconds <= 900 && distMeters <= 100.0) {
        findings.push({
          finding_id: `GEO-COPRESENCE-${String(findingId++).padStart(3, '0')}`,
          category: 'SPATIAL_TEMPORAL_CO_PRESENCE',
          title: `Potential Co-Presence / Spatial Overlap (~${Math.round(distMeters)}m, Δt: ${Math.round(deltaSeconds / 60)} mins)`,
          severity: 'MEDIUM',
          supporting_evidence_ids: [p1.evidence_id, p2.evidence_id].filter(Boolean),
          observation_1: {
            evidence_id: p1.evidence_id,
            label: p1.location_name || 'Observation 1',
            timestamp: p1.recorded_timestamp
          },
          observation_2: {
            evidence_id: p2.evidence_id,
            label: p2.location_name || 'Observation 2',
            timestamp: p2.recorded_timestamp
          },
          calculated_distance_meters: Number(distMeters.toFixed(1)),
          elapsed_minutes: Number((deltaSeconds / 60.0).toFixed(1)),
          detection_rule: 'Distance <= 100 meters and Elapsed Time <= 15 minutes between distinct evidence observations.',
          limitations: 'Spatial overlap does NOT prove physical contact, mutual awareness, or criminal association. Co-presence can occur by coincidence in public urban centers.',
          suggested_action: 'Inspect local CCTV footage for visual verification of mutual contact during the 15-minute window.'
        });
      }
    }
  }

  return findings;
}

module.exports = {
  isValidWgs84,
  haversineDistanceMeters,
  bboxFromRadiusMeters,
  convertDistance,
  clusterGeospatialPoints,
  detectSharedLocations,
  analyzeSpatiotemporalCorrelations
};

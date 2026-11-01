/**
 * @file geospatial.test.js
 * @brief Comprehensive automated test suite for Phase 9:
 * Geospatial Evidence Intelligence, Proximity Queries, Clustering, and Spatiotemporal Velocity Analysis.
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
process.env.USE_MEMORY_STORE = 'true';
process.env.JWT_SECRET = 'casethread_super_secure_geo_test_jwt_secret_key_2026!';

const app = require('../server');

let server;
let baseUrl;
let leadToken;
let unauthorizedOfficerToken;

before(async () => {
  // Issue test tokens
  leadToken = jwt.sign(
    { officer_id: 1, badge_number: 'DET-8841', role: 'LEAD_OFFICER', full_name: 'Det. Alexander Cross' },
    process.env.JWT_SECRET,
    { expiresIn: '2h' }
  );

  unauthorizedOfficerToken = jwt.sign(
    { officer_id: 99, badge_number: 'DET-0099', role: 'UNASSIGNED', full_name: 'Officer Imposter' },
    process.env.JWT_SECRET,
    { expiresIn: '2h' }
  );

  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}/api/v1`;
      resolve();
    });
  });
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

describe('CASETHREAD Phase 9 - Geospatial Evidence Intelligence & Mapping', () => {

  test('1. Retrieves all cataloged geospatial points for a case with joined evidence metadata', async () => {
    const res = await fetch(`${baseUrl}/cases/1/geospatial`, {
      headers: { 'Authorization': `Bearer ${leadToken}` }
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.case_id, 1);
    assert.ok(body.total_points >= 6, 'Should retrieve at least 6 seed geospatial points');

    const first = body.data[0];
    assert.ok(first.latitude !== undefined, 'Has latitude');
    assert.ok(first.longitude !== undefined, 'Has longitude');
    assert.ok(first.evidence_title, 'Includes joined evidence title');
    assert.ok(first.evidence_category, 'Includes joined evidence category');
  });

  test('2. Executes geographical radius search and returns points within specified distance', async () => {
    const res = await fetch(`${baseUrl}/cases/1/geospatial/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${leadToken}`
      },
      body: JSON.stringify({
        type: 'RADIUS',
        center_lat: 40.7128,
        center_lon: -74.0060,
        radius_meters: 200.0,
        unit: 'meters'
      })
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.total_matches >= 2, 'Should find points within 200m of Depository Vault');

    // Verify distance is attached and sorted ascending
    for (let i = 0; i < body.data.length - 1; i++) {
      assert.ok(body.data[i].distance_meters <= body.data[i + 1].distance_meters, 'Results must be sorted ascending by distance');
    }
  });

  test('3. Converts radius search distance into requested measurement units (km)', async () => {
    const res = await fetch(`${baseUrl}/cases/1/geospatial/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${leadToken}`
      },
      body: JSON.stringify({
        type: 'RADIUS',
        center_lat: 40.7128,
        center_lon: -74.0060,
        radius_meters: 1000.0,
        unit: 'km'
      })
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(body.data.length > 0);
    assert.ok(body.data[0].formatted_distance.includes('km'), 'Distance formatted in kilometers');
  });

  test('4. Rejects invalid coordinates outside WGS84 bounds with 400', async () => {
    const res = await fetch(`${baseUrl}/cases/1/geospatial/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${leadToken}`
      },
      body: JSON.stringify({
        type: 'RADIUS',
        center_lat: 95.0, // Invalid latitude > 90
        center_lon: -74.0060,
        radius_meters: 100.0
      })
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.match(body.error, /Invalid center coordinates/);
  });

  test('5. Rejects invalid or negative radius values with 400', async () => {
    const res = await fetch(`${baseUrl}/cases/1/geospatial/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${leadToken}`
      },
      body: JSON.stringify({
        type: 'RADIUS',
        center_lat: 40.7128,
        center_lon: -74.0060,
        radius_meters: -50.0 // Negative radius
      })
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.match(body.error, /Invalid radius_meters/);
  });

  test('6. Executes geographical bounding-box search and applies category filter', async () => {
    const res = await fetch(`${baseUrl}/cases/1/geospatial/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${leadToken}`
      },
      body: JSON.stringify({
        type: 'BBOX',
        min_lat: 40.7100,
        max_lat: 40.7200,
        min_lon: -74.0100,
        max_lon: -74.0000,
        category: 'CCTV'
      })
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.total_matches >= 1);
    body.data.forEach(item => {
      assert.ok(item.evidence_category === 'CCTV' || item.entity_type === 'CCTV');
    });
  });

  test('7. Rejects invalid bounding box with inverted latitudes with 400', async () => {
    const res = await fetch(`${baseUrl}/cases/1/geospatial/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${leadToken}`
      },
      body: JSON.stringify({
        type: 'BBOX',
        min_lat: 45.0,
        max_lat: 40.0, // min_lat > max_lat
        min_lon: -74.0,
        max_lon: -73.0
      })
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.match(body.error, /Invalid latitude range/);
  });

  test('8. Identifies spatial clusters and isolated evidence records', async () => {
    const res = await fetch(`${baseUrl}/cases/1/geospatial/clusters?cluster_radius_meters=300`, {
      headers: { 'Authorization': `Bearer ${leadToken}` }
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.total_clusters >= 1, 'Should find at least 1 cluster in downtown core');
    assert.ok(body.total_isolated_points >= 1, 'Should identify Pier 9 as isolated point');

    const firstCluster = body.clusters[0];
    assert.ok(firstCluster.centroid.latitude);
    assert.ok(firstCluster.centroid.longitude);
    assert.ok(firstCluster.member_count >= 2);
    assert.ok(firstCluster.explanation);
  });

  test('9. Analyzes spatiotemporal correlations and shared locations with explainable findings', async () => {
    const res = await fetch(`${baseUrl}/cases/1/geospatial/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${leadToken}`
      }
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.disclaimer, 'Response must include judicial admissibility disclaimer');
    assert.ok(Array.isArray(body.shared_locations), 'Has shared locations list');
    assert.ok(Array.isArray(body.spatiotemporal_findings), 'Has spatiotemporal findings list');
  });

  test('10. Records new geospatial coordinate point with WGS84 validation', async () => {
    const res = await fetch(`${baseUrl}/cases/1/geospatial/points`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${leadToken}`
      },
      body: JSON.stringify({
        evidence_id: 1,
        entity_type: 'CCTV',
        latitude: 40.713100,
        longitude: -74.005800,
        altitude: 14.0,
        accuracy_meters: 2.0,
        location_source: 'CCTV_RECORD',
        location_name: 'Secondary Perimeter Gate Camera',
        verification_status: 'CONFIRMED_FACT',
        review_notes: 'Verified against architectural blueprint.'
      })
    });
    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.geospatial_id);
    assert.strictEqual(body.data.latitude, 40.713100);
  });

  test('11. Rejects geospatial insertion with invalid out-of-bounds latitude (-95.0) with 400', async () => {
    const res = await fetch(`${baseUrl}/cases/1/geospatial/points`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${leadToken}`
      },
      body: JSON.stringify({
        evidence_id: 1,
        latitude: -95.0, // Out of bounds
        longitude: -74.005800
      })
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.match(body.error, /Invalid coordinates/);
  });

  test('12. Retrieves location history and EXIF extractions for single evidence item', async () => {
    const res = await fetch(`${baseUrl}/evidence/1/location`, {
      headers: { 'Authorization': `Bearer ${leadToken}` }
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.evidence_id, 1);
    assert.ok(Array.isArray(body.locations));
  });

  test('13. Performs officer review and sign-off on geospatial coordinates', async () => {
    const res = await fetch(`${baseUrl}/cases/1/geospatial/points/5/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${leadToken}`
      },
      body: JSON.stringify({
        verification_status: 'CONFIRMED_FACT',
        review_notes: 'Reviewed and corroborated with port security logs.'
      })
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.match(body.message, /reviewed and confirmed/);
  });

  test('14. Rejects unauthenticated request with 401', async () => {
    const res = await fetch(`${baseUrl}/cases/1/geospatial`);
    assert.strictEqual(res.status, 401);
  });

  test('15. Rejects cross-case access by unauthorized officer with 403 (Case Isolation)', async () => {
    const res = await fetch(`${baseUrl}/cases/1/geospatial`, {
      headers: { 'Authorization': `Bearer ${unauthorizedOfficerToken}` }
    });
    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.match(body.error, /Access denied/);
  });

});

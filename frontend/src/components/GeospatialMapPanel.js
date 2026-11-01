/**
 * @file GeospatialMapPanel.js
 * @brief Interactive Forensic Investigation Mapping & Spatiotemporal Analysis Workspace.
 * @project CASETHREAD - Phase 9 Geospatial Intelligence
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import api from '../services/api';

// Supported tile basemap styles with privacy classifications
const BASEMAP_PROVIDERS = [
  { id: 'tactical', name: 'Tactical Grid (Offline / Air-Gapped)', privacy: 'STRICT_LOCAL' },
  { id: 'carto-dark', name: 'CartoDB Dark Matter (Online Web Map)', privacy: 'EXTERNAL_TILES', url: 'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png' },
  { id: 'osm', name: 'OpenStreetMap Standard (Online Basemap)', privacy: 'EXTERNAL_TILES', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' }
];

export default function GeospatialMapPanel({ selectedCaseId, officer }) {
  // Data State
  const [points, setPoints] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [findings, setFindings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Map Navigation & Interaction State
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [selectedForMeasure, setSelectedForMeasure] = useState([]);
  const [activeTab, setActiveTab] = useState('details'); // 'details' | 'findings' | 'clusters' | 'add'
  const [basemapStyle, setBasemapStyle] = useState('tactical');

  // Filters
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [showClusters, setShowClusters] = useState(true);
  const [showObservationLines, setShowObservationLines] = useState(true);
  const [radiusFilterMeters, setRadiusFilterMeters] = useState(0); // 0 = disabled

  // Timeline Scrubber State
  const [timelineIndex, setTimelineIndex] = useState(100); // 0 to 100 percent
  const [isPlaying, setIsPlaying] = useState(false);

  // New Coordinate Modal Form
  const [newPointForm, setNewPointForm] = useState({
    evidence_id: '',
    latitude: '',
    longitude: '',
    location_name: '',
    location_source: 'OFFICER_ENTERED',
    verification_status: 'CONFIRMED_FACT',
    accuracy_meters: '5.0',
    review_notes: ''
  });
  const [submittingPoint, setSubmittingPoint] = useState(false);

  // Canvas Viewport Transform State (pan & zoom)
  const [viewTransform, setViewTransform] = useState({ zoom: 1, panX: 0, panY: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const canvasRef = useRef(null);

  // Load geospatial case data
  const loadCaseGeospatialData = useCallback(async () => {
    if (!selectedCaseId) return;
    setLoading(true);
    setError(null);
    try {
      const [ptsRes, clustersRes, analysisRes] = await Promise.all([
        api.getCaseGeospatial(selectedCaseId),
        api.getCaseGeospatialClusters(selectedCaseId, 250),
        api.analyzeCaseGeospatial(selectedCaseId)
      ]);

      if (ptsRes && ptsRes.success) {
        setPoints(ptsRes.data || []);
      }
      if (clustersRes && clustersRes.success) {
        setClusters(clustersRes.clusters || []);
      }
      if (analysisRes && analysisRes.success) {
        setFindings(analysisRes.spatiotemporal_findings || []);
      }
    } catch (err) {
      console.error('Failed to load geospatial case intelligence:', err);
      setError(err.message || 'Failed to retrieve case coordinates.');
    } finally {
      setLoading(false);
    }
  }, [selectedCaseId]);

  useEffect(() => {
    loadCaseGeospatialData();
  }, [loadCaseGeospatialData]);

  // Compute bounding box for auto-centering
  const geoBounds = useMemo(() => {
    if (!points || points.length === 0) {
      return { minLat: 40.70, maxLat: 40.73, minLon: -74.02, maxLon: -74.00, centerLat: 40.715, centerLon: -74.01 };
    }
    let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
    points.forEach(p => {
      if (p.latitude < minLat) minLat = p.latitude;
      if (p.latitude > maxLat) maxLat = p.latitude;
      if (p.longitude < minLon) minLon = p.longitude;
      if (p.longitude > maxLon) maxLon = p.longitude;
    });
    // Add small margin
    const latSpan = Math.max(0.005, maxLat - minLat);
    const lonSpan = Math.max(0.005, maxLon - minLon);
    return {
      minLat: minLat - latSpan * 0.15,
      maxLat: maxLat + latSpan * 0.15,
      minLon: minLon - lonSpan * 0.15,
      maxLon: maxLon + lonSpan * 0.15,
      centerLat: (minLat + maxLat) / 2,
      centerLon: (minLon + maxLon) / 2
    };
  }, [points]);

  // Filtered Points based on category, source, status, and timeline scrubber
  const filteredPoints = useMemo(() => {
    let result = [...points];

    if (categoryFilter !== 'ALL') {
      result = result.filter(p => p.evidence_category === categoryFilter || p.entity_type === categoryFilter);
    }
    if (sourceFilter !== 'ALL') {
      result = result.filter(p => p.location_source === sourceFilter);
    }
    if (statusFilter !== 'ALL') {
      result = result.filter(p => p.verification_status === statusFilter);
    }

    // Timeline Scrubber Filtering
    if (timelineIndex < 100 && result.length > 0) {
      const timestamps = points
        .map(p => p.recorded_timestamp ? new Date(p.recorded_timestamp).getTime() : 0)
        .filter(t => t > 0)
        .sort((a, b) => a - b);

      if (timestamps.length >= 2) {
        const minT = timestamps[0];
        const maxT = timestamps[timestamps.length - 1];
        const cutoffTime = minT + (maxT - minT) * (timelineIndex / 100.0);
        result = result.filter(p => {
          if (!p.recorded_timestamp) return true;
          return new Date(p.recorded_timestamp).getTime() <= cutoffTime;
        });
      }
    }

    return result;
  }, [points, categoryFilter, sourceFilter, statusFilter, timelineIndex]);

  // Animated Timeline Playback Loop
  useEffect(() => {
    let interval = null;
    if (isPlaying) {
      interval = setInterval(() => {
        setTimelineIndex(prev => {
          if (prev >= 100) {
            setIsPlaying(false);
            return 100;
          }
          return prev + 2;
        });
      }, 300);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying]);

  // Project geographic coordinate to canvas pixel coordinate (Mercator-like equidistant)
  const projectToPixel = useCallback((lat, lon, width, height) => {
    const latSpan = geoBounds.maxLat - geoBounds.minLat;
    const lonSpan = geoBounds.maxLon - geoBounds.minLon;

    // Normalizing 0..1
    const nx = (lon - geoBounds.minLon) / (lonSpan || 1);
    const ny = (geoBounds.maxLat - lat) / (latSpan || 1); // Inverted Y

    const padding = 60;
    const drawW = width - padding * 2;
    const drawH = height - padding * 2;

    const basePx = padding + nx * drawW;
    const basePy = padding + ny * drawH;

    // Apply viewport zoom & pan
    const cx = width / 2;
    const cy = height / 2;
    const px = cx + (basePx - cx) * viewTransform.zoom + viewTransform.panX;
    const py = cy + (basePy - cy) * viewTransform.zoom + viewTransform.panY;

    return { x: px, y: py };
  }, [geoBounds, viewTransform]);

  // Canvas Rendering Effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // 1. Clear background
    ctx.fillStyle = '#0a0d14';
    ctx.fillRect(0, 0, width, height);

    // 2. Draw Tactical Radar / Grid Lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    const gridSize = 40 * viewTransform.zoom;
    const offsetX = (viewTransform.panX % gridSize + gridSize) % gridSize;
    const offsetY = (viewTransform.panY % gridSize + gridSize) % gridSize;

    for (let x = offsetX; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = offsetY; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // 3. Draw Tactical Circular Radar Rings around center
    const centerPt = projectToPixel(geoBounds.centerLat, geoBounds.centerLon, width, height);
    ctx.strokeStyle = 'rgba(0, 209, 255, 0.07)';
    for (let r = 80; r < Math.max(width, height); r += 120 * viewTransform.zoom) {
      ctx.beginPath();
      ctx.arc(centerPt.x, centerPt.y, r, 0, 2 * Math.PI);
      ctx.stroke();
    }

    // 4. Draw Cluster Areas if enabled
    if (showClusters && clusters.length > 0) {
      clusters.forEach((cl, idx) => {
        const cpos = projectToPixel(cl.centroid.latitude, cl.centroid.longitude, width, height);
        const radiusPx = Math.max(25, (cl.cluster_radius_meters / 10.0) * viewTransform.zoom);

        ctx.fillStyle = 'rgba(255, 149, 0, 0.08)';
        ctx.strokeStyle = 'rgba(255, 149, 0, 0.4)';
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1.5;

        ctx.beginPath();
        ctx.arc(cpos.x, cpos.y, radiusPx, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);

        // Label
        ctx.fillStyle = 'rgba(255, 149, 0, 0.9)';
        ctx.font = '10px var(--font-mono, monospace)';
        ctx.fillText(`${cl.cluster_id} (${cl.member_count} pts)`, cpos.x - 30, cpos.y - radiusPx - 6);
      });
    }

    // 5. Draw Observation Movement Links (Chronological lines between sightings)
    if (showObservationLines && filteredPoints.length > 1) {
      const sortedByTime = [...filteredPoints]
        .filter(p => p.recorded_timestamp)
        .sort((a, b) => new Date(a.recorded_timestamp) - new Date(b.recorded_timestamp));

      for (let i = 0; i < sortedByTime.length - 1; i++) {
        const p1 = sortedByTime[i];
        const p2 = sortedByTime[i + 1];

        const pt1 = projectToPixel(p1.latitude, p1.longitude, width, height);
        const pt2 = projectToPixel(p2.latitude, p2.longitude, width, height);

        ctx.strokeStyle = 'rgba(0, 209, 255, 0.4)';
        ctx.setLineDash([6, 4]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(pt1.x, pt1.y);
        ctx.lineTo(pt2.x, pt2.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Arrowhead in direction of chronological observation
        const angle = Math.atan2(pt2.y - pt1.y, pt2.x - pt1.x);
        const midX = (pt1.x + pt2.x) / 2;
        const midY = (pt1.y + pt2.y) / 2;
        const arrowLen = 8;
        ctx.fillStyle = 'rgba(0, 209, 255, 0.8)';
        ctx.beginPath();
        ctx.moveTo(midX, midY);
        ctx.lineTo(midX - arrowLen * Math.cos(angle - Math.PI / 6), midY - arrowLen * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(midX - arrowLen * Math.cos(angle + Math.PI / 6), midY - arrowLen * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
      }
    }

    // 6. Draw Radius Search Circle if active
    if (selectedPoint && radiusFilterMeters > 0) {
      const ppos = projectToPixel(selectedPoint.latitude, selectedPoint.longitude, width, height);
      const radPx = (radiusFilterMeters / 12.0) * viewTransform.zoom;

      ctx.fillStyle = 'rgba(0, 255, 136, 0.08)';
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ppos.x, ppos.y, radPx, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#00ff88';
      ctx.font = 'bold 11px var(--font-mono, monospace)';
      ctx.fillText(`Radius: ${radiusFilterMeters}m`, ppos.x + radPx + 6, ppos.y);
    }

    // 7. Draw Caliper Distance Line between two measured points
    if (selectedForMeasure.length === 2) {
      const m1 = projectToPixel(selectedForMeasure[0].latitude, selectedForMeasure[0].longitude, width, height);
      const m2 = projectToPixel(selectedForMeasure[1].latitude, selectedForMeasure[1].longitude, width, height);

      ctx.strokeStyle = '#ff0055';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(m1.x, m1.y);
      ctx.lineTo(m2.x, m2.y);
      ctx.stroke();

      // Midpoint measurement tag
      const midX = (m1.x + m2.x) / 2;
      const midY = (m1.y + m2.y) / 2;
      const dist = apiCalcDistance(selectedForMeasure[0], selectedForMeasure[1]);

      ctx.fillStyle = '#161b22';
      ctx.fillRect(midX - 45, midY - 14, 90, 22);
      ctx.strokeStyle = '#ff0055';
      ctx.strokeRect(midX - 45, midY - 14, 90, 22);

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px var(--font-mono, monospace)';
      ctx.fillText(`${dist}m`, midX - 25, midY + 1);
    }

    // 8. Draw Evidence Markers
    filteredPoints.forEach(p => {
      const pos = projectToPixel(p.latitude, p.longitude, width, height);
      const isSelected = selectedPoint && selectedPoint.geospatial_id === p.geospatial_id;
      const isMeasured = selectedForMeasure.some(m => m.geospatial_id === p.geospatial_id);

      // Category-based colors
      let markerColor = '#00d1ff'; // Cyan default
      let iconSymbol = '📍';
      if (p.location_source === 'CCTV_RECORD' || p.entity_type === 'CCTV') {
        markerColor = '#00e5ff';
        iconSymbol = '📹';
      } else if (p.location_source === 'CELL_TOWER') {
        markerColor = '#a855f7';
        iconSymbol = '📡';
      } else if (p.entity_type === 'VEHICLE_SIGHTING') {
        markerColor = '#ff9500';
        iconSymbol = '🚗';
      } else if (p.location_source === 'EXIF_GPS') {
        markerColor = '#00ff88';
        iconSymbol = '📷';
      } else if (p.verification_status === 'UNVERIFIED_OBSERVATION') {
        markerColor = '#eab308';
        iconSymbol = '❓';
      }

      // Outer Selection Ring
      if (isSelected || isMeasured) {
        ctx.strokeStyle = isMeasured ? '#ff0055' : '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 16, 0, 2 * Math.PI);
        ctx.stroke();
      }

      // Marker Badge Circle
      ctx.fillStyle = markerColor;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 10, 0, 2 * Math.PI);
      ctx.fill();

      ctx.strokeStyle = '#0a0d14';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Center dot
      ctx.fillStyle = '#0a0d14';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 3, 0, 2 * Math.PI);
      ctx.fill();

      // Label
      ctx.fillStyle = '#e6edf3';
      ctx.font = '10px var(--font-sans, sans-serif)';
      const labelText = p.location_name || p.evidence_title || `EVD #${p.evidence_id}`;
      ctx.fillText(labelText.slice(0, 24), pos.x + 13, pos.y + 4);
    });

  }, [filteredPoints, selectedPoint, selectedForMeasure, radiusFilterMeters, showClusters, showObservationLines, clusters, viewTransform, geoBounds, projectToPixel]);

  // Distance helper
  function apiCalcDistance(p1, p2) {
    const deg2rad = Math.PI / 180.0;
    const phi1 = p1.latitude * deg2rad;
    const phi2 = p2.latitude * deg2rad;
    const deltaPhi = (p2.latitude - p1.latitude) * deg2rad;
    const deltaLambda = (p2.longitude - p1.longitude) * deg2rad;
    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(6371008.8 * c);
  }

  // Click handler to select marker on canvas
  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Hit test markers
    let clickedPoint = null;
    for (const p of filteredPoints) {
      const pos = projectToPixel(p.latitude, p.longitude, canvas.width, canvas.height);
      const dx = clickX - pos.x;
      const dy = clickY - pos.y;
      if (Math.sqrt(dx * dx + dy * dy) <= 15) {
        clickedPoint = p;
        break;
      }
    }

    if (clickedPoint) {
      setSelectedPoint(clickedPoint);
      if (selectedForMeasure.length === 1 && selectedForMeasure[0].geospatial_id !== clickedPoint.geospatial_id) {
        setSelectedForMeasure([selectedForMeasure[0], clickedPoint]);
      }
    }
  };

  // Mouse Drag to Pan
  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - viewTransform.panX, y: e.clientY - viewTransform.panY });
  };
  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setViewTransform(prev => ({
      ...prev,
      panX: e.clientX - dragStart.x,
      panY: e.clientY - dragStart.y
    }));
  };
  const handleMouseUp = () => setIsDragging(false);

  // Wheel Zoom
  const handleWheel = (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    setViewTransform(prev => ({
      ...prev,
      zoom: Math.max(0.4, Math.min(8.0, prev.zoom * zoomFactor))
    }));
  };

  // Reset Zoom
  const handleResetZoom = () => {
    setViewTransform({ zoom: 1, panX: 0, panY: 0 });
    setSelectedPoint(null);
    setSelectedForMeasure([]);
  };

  // Handle Coordinate Creation Submission
  const handleCreatePointSubmit = async (e) => {
    e.preventDefault();
    if (!newPointForm.evidence_id || !newPointForm.latitude || !newPointForm.longitude) {
      alert('Evidence ID, Latitude, and Longitude are mandatory.');
      return;
    }

    setSubmittingPoint(true);
    try {
      const res = await api.recordGeospatialPoint(selectedCaseId, {
        evidence_id: parseInt(newPointForm.evidence_id, 10),
        latitude: parseFloat(newPointForm.latitude),
        longitude: parseFloat(newPointForm.longitude),
        accuracy_meters: parseFloat(newPointForm.accuracy_meters) || 5.0,
        location_source: newPointForm.location_source,
        location_name: newPointForm.location_name,
        verification_status: newPointForm.verification_status,
        review_notes: newPointForm.review_notes
      });

      if (res && res.success) {
        alert('Geospatial coordinate recorded successfully!');
        setNewPointForm({
          evidence_id: '',
          latitude: '',
          longitude: '',
          location_name: '',
          location_source: 'OFFICER_ENTERED',
          verification_status: 'CONFIRMED_FACT',
          accuracy_meters: '5.0',
          review_notes: ''
        });
        setActiveTab('details');
        loadCaseGeospatialData();
      } else {
        alert(res?.error || 'Failed to record coordinate.');
      }
    } catch (err) {
      alert(`Error recording coordinate: ${err.message}`);
    } finally {
      setSubmittingPoint(false);
    }
  };

  // Handle Review Sign-off
  const handleReviewPoint = async (pointId) => {
    try {
      const res = await api.reviewGeospatialPoint(selectedCaseId, pointId, {
        verification_status: 'CONFIRMED_FACT',
        review_notes: `Confirmed by Officer #${officer?.badge_number || 'DET-8841'}`
      });
      if (res && res.success) {
        alert('Coordinates reviewed and confirmed as factual.');
        loadCaseGeospatialData();
      }
    } catch (err) {
      alert(`Review failed: ${err.message}`);
    }
  };

  return (
    <div style={{ padding: '0 1rem', maxWidth: '1600px', margin: '0 auto', color: '#e6edf3' }}>
      
      {/* 1. Header Banner & Security Classification */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        padding: '1rem 0',
        borderBottom: '1px solid var(--border-default, #30363d)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.4rem' }}>🗺️</span>
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Geospatial Evidence Intelligence
            </h2>
            <span style={{
              fontSize: '0.65rem',
              backgroundColor: 'rgba(0, 209, 255, 0.15)',
              color: '#00d1ff',
              padding: '0.2rem 0.5rem',
              borderRadius: '4px',
              fontFamily: 'var(--font-mono, monospace)',
              fontWeight: 700
            }}>
              C-QUADTREE SPATIAL ENGINE
            </span>
          </div>
          <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.8rem', color: '#8b949e' }}>
            Geodesic proximity search, multi-hop cluster correlation, and explainable spatiotemporal travel velocity analysis.
          </p>
        </div>

        {/* Tactical Privacy Badge */}
        <div style={{
          backgroundColor: '#161b22',
          border: '1px solid #30363d',
          padding: '0.5rem 0.85rem',
          borderRadius: '6px',
          fontSize: '0.72rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span>🛡️</span>
          <div>
            <strong style={{ color: '#00ff88' }}>Privacy Guard Active:</strong>
            <span style={{ color: '#8b949e', marginLeft: '0.3rem' }}>Zero external geocoding of investigative coordinates.</span>
          </div>
        </div>
      </div>

      {/* 2. Key Forensic Overview Metrics */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
        gap: '0.75rem',
        margin: '1rem 0'
      }}>
        <div style={{ backgroundColor: '#161b22', border: '1px solid #30363d', padding: '0.75rem 1rem', borderRadius: '6px' }}>
          <div style={{ fontSize: '0.68rem', color: '#8b949e', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>Total GPS Coordinates</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#00d1ff', marginTop: '0.2rem' }}>{points.length}</div>
        </div>

        <div style={{ backgroundColor: '#161b22', border: '1px solid #30363d', padding: '0.75rem 1rem', borderRadius: '6px' }}>
          <div style={{ fontSize: '0.68rem', color: '#8b949e', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>Confirmed Locations</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#00ff88', marginTop: '0.2rem' }}>
            {points.filter(p => p.verification_status === 'CONFIRMED_FACT').length}
          </div>
        </div>

        <div style={{ backgroundColor: '#161b22', border: '1px solid #30363d', padding: '0.75rem 1rem', borderRadius: '6px' }}>
          <div style={{ fontSize: '0.68rem', color: '#8b949e', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>Spatial Clusters</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ff9500', marginTop: '0.2rem' }}>{clusters.length}</div>
        </div>

        <div style={{ backgroundColor: '#161b22', border: '1px solid #30363d', padding: '0.75rem 1rem', borderRadius: '6px' }}>
          <div style={{ fontSize: '0.68rem', color: '#8b949e', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>Velocity Anomalies</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: findings.length > 0 ? '#ff0055' : '#8b949e', marginTop: '0.2rem' }}>
            {findings.length}
          </div>
        </div>
      </div>

      {/* 3. Toolbar & Filters */}
      <div style={{
        backgroundColor: '#161b22',
        border: '1px solid #30363d',
        padding: '0.65rem 1rem',
        borderRadius: '6px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem',
        marginBottom: '1rem'
      }}>
        {/* Left Filter Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '0.75rem', color: '#8b949e' }}>Category:</label>
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            style={{ backgroundColor: '#0d1117', border: '1px solid #30363d', color: '#e6edf3', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem' }}
          >
            <option value="ALL">All Categories</option>
            <option value="CCTV">CCTV Surveillance</option>
            <option value="EVIDENCE">Physical Evidence</option>
            <option value="VEHICLE_SIGHTING">Vehicle Sighting</option>
          </select>

          <label style={{ fontSize: '0.75rem', color: '#8b949e', marginLeft: '0.4rem' }}>Source:</label>
          <select
            value={sourceFilter}
            onChange={e => setSourceFilter(e.target.value)}
            style={{ backgroundColor: '#0d1117', border: '1px solid #30363d', color: '#e6edf3', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem' }}
          >
            <option value="ALL">All Sources</option>
            <option value="EXIF_GPS">EXIF GPS Metadata</option>
            <option value="CCTV_RECORD">Fixed CCTV Record</option>
            <option value="CELL_TOWER">Cell Tower Dump</option>
            <option value="OFFICER_ENTERED">Officer Manual Entry</option>
          </select>

          <label style={{ fontSize: '0.75rem', color: '#8b949e', marginLeft: '0.4rem' }}>Status:</label>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ backgroundColor: '#0d1117', border: '1px solid #30363d', color: '#e6edf3', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem' }}
          >
            <option value="ALL">All Statuses</option>
            <option value="CONFIRMED_FACT">Confirmed Fact</option>
            <option value="UNVERIFIED_OBSERVATION">Unverified Observation</option>
          </select>
        </div>

        {/* Right Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowClusters(!showClusters)}
            className={showClusters ? 'btn-primary' : 'btn-secondary'}
            style={{ fontSize: '0.72rem', padding: '0.3rem 0.6rem' }}
          >
            {showClusters ? '✓ Clusters' : 'Clusters Off'}
          </button>

          <button
            onClick={() => setShowObservationLines(!showObservationLines)}
            className={showObservationLines ? 'btn-primary' : 'btn-secondary'}
            style={{ fontSize: '0.72rem', padding: '0.3rem 0.6rem' }}
          >
            {showObservationLines ? '✓ Timeline Links' : 'Links Off'}
          </button>

          <button
            onClick={handleResetZoom}
            className="btn-secondary"
            style={{ fontSize: '0.72rem', padding: '0.3rem 0.6rem' }}
            title="Reset Pan & Zoom"
          >
            ⤾ Reset View
          </button>
        </div>
      </div>

      {/* 4. Main Map Viewport & Side Inspection Drawer */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '1rem', minHeight: '620px' }}>
        
        {/* Left Interactive Canvas Viewport */}
        <div style={{
          position: 'relative',
          backgroundColor: '#0a0d14',
          border: '1px solid #30363d',
          borderRadius: '8px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Tactical Map Canvas */}
          <canvas
            ref={canvasRef}
            width={960}
            height={560}
            onClick={handleCanvasClick}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onWheel={handleWheel}
            style={{
              width: '100%',
              height: '560px',
              cursor: isDragging ? 'grabbing' : 'crosshair',
              display: 'block'
            }}
          />

          {/* Canvas Floating Overlay Controls */}
          <div style={{
            position: 'absolute',
            top: '12px',
            left: '12px',
            backgroundColor: 'rgba(10, 13, 20, 0.85)',
            backdropFilter: 'blur(4px)',
            border: '1px solid #30363d',
            padding: '0.35rem 0.65rem',
            borderRadius: '4px',
            fontSize: '0.7rem',
            fontFamily: 'var(--font-mono, monospace)',
            color: '#8b949e',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem'
          }}>
            <span>ZOOM: {(viewTransform.zoom * 100).toFixed(0)}%</span>
            <span>•</span>
            <span>SHOWING: {filteredPoints.length} / {points.length} POINTS</span>
            <span>•</span>
            <span style={{ color: '#00d1ff' }}>DRAG: PAN • WHEEL: ZOOM</span>
          </div>

          {/* Floating Radius Filter Tool */}
          <div style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            backgroundColor: 'rgba(10, 13, 20, 0.9)',
            border: '1px solid #30363d',
            padding: '0.4rem 0.75rem',
            borderRadius: '4px',
            fontSize: '0.72rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem'
          }}>
            <span style={{ color: '#00ff88', fontWeight: 600 }}>⭕ Radius Filter:</span>
            <select
              value={radiusFilterMeters}
              onChange={e => setRadiusFilterMeters(parseInt(e.target.value, 10))}
              style={{ backgroundColor: '#0d1117', border: '1px solid #30363d', color: '#e6edf3', padding: '0.2rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem' }}
            >
              <option value="0">Off (Show All)</option>
              <option value="100">100 Meters</option>
              <option value="250">250 Meters</option>
              <option value="500">500 Meters</option>
              <option value="1000">1,000 Meters</option>
            </select>
          </div>

          {/* Spatiotemporal Timeline Scrubber Bar at Bottom of Canvas */}
          <div style={{
            backgroundColor: '#161b22',
            borderTop: '1px solid #30363d',
            padding: '0.6rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="btn-primary"
              style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
              title="Play / Pause Chronological Timeline Replay"
            >
              {isPlaying ? '⏸ Pause' : '▶ Replay'}
            </button>

            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.72rem', color: '#8b949e', fontFamily: 'var(--font-mono)' }}>CHRONOLOGICAL SLIDER:</span>
              <input
                type="range"
                min="0"
                max="100"
                value={timelineIndex}
                onChange={e => {
                  setTimelineIndex(parseInt(e.target.value, 10));
                  setIsPlaying(false);
                }}
                style={{ flex: 1, accentColor: '#00d1ff', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.75rem', fontWeight: 700, fontFamily: 'var(--font-mono)', minWidth: '40px', color: '#00d1ff' }}>
                {timelineIndex}%
              </span>
            </div>

            {/* Strict Movement Disclaimer Notice */}
            <div style={{ fontSize: '0.65rem', color: '#8b949e', maxWidth: '320px', lineHeight: 1.2 }}>
              ⚠️ <strong style={{ color: '#e6edf3' }}>Notice:</strong> Lines connect separate chronological observations. They do <em>not</em> represent verified travel routes or road paths.
            </div>
          </div>
        </div>

        {/* Right Inspection & Analysis Drawer */}
        <div style={{
          backgroundColor: '#161b22',
          border: '1px solid #30363d',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '630px',
          overflow: 'hidden'
        }}>
          {/* Drawer Navigation Tabs */}
          <div style={{
            display: 'flex',
            borderBottom: '1px solid #30363d',
            backgroundColor: '#0d1117'
          }}>
            <button
              onClick={() => setActiveTab('details')}
              style={{
                flex: 1,
                padding: '0.6rem 0.4rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                border: 'none',
                borderBottom: activeTab === 'details' ? '2px solid #00d1ff' : 'none',
                backgroundColor: activeTab === 'details' ? '#161b22' : 'transparent',
                color: activeTab === 'details' ? '#00d1ff' : '#8b949e',
                cursor: 'pointer'
              }}
            >
              📍 Point Info
            </button>

            <button
              onClick={() => setActiveTab('findings')}
              style={{
                flex: 1,
                padding: '0.6rem 0.4rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                border: 'none',
                borderBottom: activeTab === 'findings' ? '2px solid #ff0055' : 'none',
                backgroundColor: activeTab === 'findings' ? '#161b22' : 'transparent',
                color: activeTab === 'findings' ? '#ff0055' : '#8b949e',
                cursor: 'pointer'
              }}
            >
              ⚡ Speed Alerts ({findings.length})
            </button>

            <button
              onClick={() => setActiveTab('clusters')}
              style={{
                flex: 1,
                padding: '0.6rem 0.4rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                border: 'none',
                borderBottom: activeTab === 'clusters' ? '2px solid #ff9500' : 'none',
                backgroundColor: activeTab === 'clusters' ? '#161b22' : 'transparent',
                color: activeTab === 'clusters' ? '#ff9500' : '#8b949e',
                cursor: 'pointer'
              }}
            >
              🕸️ Clusters ({clusters.length})
            </button>

            <button
              onClick={() => setActiveTab('add')}
              style={{
                flex: 1,
                padding: '0.6rem 0.4rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                border: 'none',
                borderBottom: activeTab === 'add' ? '2px solid #00ff88' : 'none',
                backgroundColor: activeTab === 'add' ? '#161b22' : 'transparent',
                color: activeTab === 'add' ? '#00ff88' : '#8b949e',
                cursor: 'pointer'
              }}
            >
              + Record
            </button>
          </div>

          {/* Drawer Content Body */}
          <div style={{ flex: 1, padding: '1rem', overflowY: 'auto' }}>
            
            {/* TAB 1: Selected Point Details */}
            {activeTab === 'details' && (
              <div>
                {selectedPoint ? (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.72rem', color: '#00d1ff', fontFamily: 'var(--font-mono)' }}>
                        POINT ID: #{selectedPoint.geospatial_id}
                      </span>
                      <span style={{
                        fontSize: '0.65rem',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        backgroundColor: selectedPoint.verification_status === 'CONFIRMED_FACT' ? 'rgba(0, 255, 136, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                        color: selectedPoint.verification_status === 'CONFIRMED_FACT' ? '#00ff88' : '#eab308',
                        fontWeight: 700
                      }}>
                        {selectedPoint.verification_status}
                      </span>
                    </div>

                    <h3 style={{ margin: '0.5rem 0 0.2rem 0', fontSize: '1rem', color: '#fff' }}>
                      {selectedPoint.location_name || selectedPoint.evidence_title}
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#8b949e' }}>
                      Linked Evidence: <strong>{selectedPoint.evidence_title || `#${selectedPoint.evidence_id}`}</strong>
                    </p>

                    {/* Coordinates Box */}
                    <div style={{
                      backgroundColor: '#0d1117',
                      border: '1px solid #30363d',
                      padding: '0.75rem',
                      borderRadius: '6px',
                      margin: '0.75rem 0'
                    }}>
                      <div style={{ fontSize: '0.68rem', color: '#8b949e', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                        WGS84 Geographical Coordinates
                      </div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#00d1ff', fontFamily: 'var(--font-mono)', marginTop: '0.2rem' }}>
                        {selectedPoint.latitude.toFixed(6)}°, {selectedPoint.longitude.toFixed(6)}°
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#8b949e', marginTop: '0.35rem' }}>
                        Elevation: <strong>{selectedPoint.altitude ? `${selectedPoint.altitude}m` : 'Sea level / N/A'}</strong> • 
                        Precision Radius: <strong>±{selectedPoint.accuracy_meters || '5'}m</strong>
                      </div>
                    </div>

                    {/* Metadata Table */}
                    <div style={{ fontSize: '0.75rem', lineHeight: 1.6, borderTop: '1px solid #30363d', paddingTop: '0.5rem' }}>
                      <div><span style={{ color: '#8b949e' }}>Recorded Timestamp:</span> {selectedPoint.recorded_timestamp || 'No timestamp recorded'}</div>
                      <div><span style={{ color: '#8b949e' }}>Coordinate Source:</span> <strong>{selectedPoint.location_source}</strong></div>
                      <div><span style={{ color: '#8b949e' }}>Provenance Extraction:</span> {selectedPoint.extraction_source || 'Manual Officer Mapping'}</div>
                      <div><span style={{ color: '#8b949e' }}>Officer Review Status:</span> {selectedPoint.officer_reviewed ? '✓ Reviewed' : 'Pending Formal Sign-off'}</div>
                      {selectedPoint.review_notes && (
                        <div style={{ marginTop: '0.4rem', padding: '0.4rem', backgroundColor: '#0d1117', borderRadius: '4px', fontStyle: 'italic', color: '#cbd5e1' }}>
                          "{selectedPoint.review_notes}"
                        </div>
                      )}
                    </div>

                    {/* Caliper Measurement Selection */}
                    <div style={{ marginTop: '1rem', borderTop: '1px solid #30363d', paddingTop: '0.75rem' }}>
                      <button
                        onClick={() => {
                          if (selectedForMeasure.some(m => m.geospatial_id === selectedPoint.geospatial_id)) {
                            setSelectedForMeasure([]);
                          } else if (selectedForMeasure.length === 0) {
                            setSelectedForMeasure([selectedPoint]);
                          } else {
                            setSelectedForMeasure([selectedForMeasure[0], selectedPoint]);
                          }
                        }}
                        className="btn-secondary"
                        style={{ width: '100%', fontSize: '0.72rem', padding: '0.4rem' }}
                      >
                        {selectedForMeasure.some(m => m.geospatial_id === selectedPoint.geospatial_id)
                          ? '✖ Clear Measurement Caliper'
                          : selectedForMeasure.length === 1
                            ? '📏 Set as Second Point for Distance'
                            : '📏 Start Distance Measurement from Here'}
                      </button>
                    </div>

                    {/* Officer Sign-off Button */}
                    {!selectedPoint.officer_reviewed && (
                      <div style={{ marginTop: '0.5rem' }}>
                        <button
                          onClick={() => handleReviewPoint(selectedPoint.geospatial_id)}
                          className="btn-primary"
                          style={{ width: '100%', fontSize: '0.72rem', padding: '0.4rem' }}
                        >
                          ✓ Confirm & Sign Off Coordinates
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#8b949e' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎯</div>
                    <p style={{ fontSize: '0.82rem', margin: 0 }}>Click any marker on the map to inspect coordinates, accuracy radii, and forensic provenance.</p>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: Spatiotemporal Findings */}
            {activeTab === 'findings' && (
              <div>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#ff0055', textTransform: 'uppercase' }}>
                  Spatiotemporal Correlation & Velocity Anomalies
                </h4>
                {findings.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#8b949e' }}>
                    <p style={{ fontSize: '0.8rem' }}>No spatiotemporal velocity violations detected in current case observations.</p>
                  </div>
                ) : (
                  findings.map(f => (
                    <div
                      key={f.finding_id}
                      style={{
                        backgroundColor: '#0d1117',
                        border: '1px solid rgba(255, 0, 85, 0.4)',
                        padding: '0.75rem',
                        borderRadius: '6px',
                        marginBottom: '0.75rem'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.65rem', color: '#ff0055', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                          {f.finding_id}
                        </span>
                        <span style={{ fontSize: '0.65rem', backgroundColor: 'rgba(255, 0, 85, 0.2)', color: '#ff0055', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                          {f.severity}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', marginTop: '0.2rem' }}>
                        {f.title}
                      </div>

                      <div style={{ fontSize: '0.72rem', color: '#cbd5e1', margin: '0.4rem 0' }}>
                        Between <strong>{f.observation_1.location}</strong> ({f.observation_1.timestamp}) and <strong>{f.observation_2.location}</strong> ({f.observation_2.timestamp}):
                      </div>

                      <div style={{
                        backgroundColor: '#161b22',
                        padding: '0.4rem 0.6rem',
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                        fontFamily: 'var(--font-mono)',
                        color: '#ff9500'
                      }}>
                        Displacement: {f.calculated_straight_line_distance_meters}m • Elapsed: {f.elapsed_seconds}s • Speed: ≥{f.calculated_minimum_velocity_kmh} km/h
                      </div>

                      <div style={{ fontSize: '0.68rem', color: '#8b949e', marginTop: '0.4rem' }}>
                        <em>Rule:</em> {f.detection_rule}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#8b949e', marginTop: '0.2rem' }}>
                        <em>Limitation:</em> {f.limitations}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB 3: Geographical Clusters */}
            {activeTab === 'clusters' && (
              <div>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#ff9500', textTransform: 'uppercase' }}>
                  Spatial Density Clusters (250m Radius)
                </h4>
                {clusters.length === 0 ? (
                  <p style={{ fontSize: '0.8rem', color: '#8b949e' }}>No spatial clusters detected in this case.</p>
                ) : (
                  clusters.map(cl => (
                    <div
                      key={cl.cluster_id}
                      style={{
                        backgroundColor: '#0d1117',
                        border: '1px solid rgba(255, 149, 0, 0.3)',
                        padding: '0.75rem',
                        borderRadius: '6px',
                        marginBottom: '0.75rem'
                      }}
                    >
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#ff9500' }}>
                        {cl.cluster_name}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#8b949e', marginTop: '0.2rem' }}>
                        Centroid: {cl.centroid.latitude.toFixed(5)}°, {cl.centroid.longitude.toFixed(5)}° • Spread Radius: ~{cl.cluster_radius_meters}m
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#cbd5e1', marginTop: '0.35rem' }}>
                        {cl.explanation}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB 4: Record New Coordinates */}
            {activeTab === 'add' && (
              <form onSubmit={handleCreatePointSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <h4 style={{ margin: '0 0 0.3rem 0', fontSize: '0.85rem', color: '#00ff88', textTransform: 'uppercase' }}>
                  Record Geospatial Observation
                </h4>

                <div>
                  <label style={{ fontSize: '0.72rem', color: '#8b949e' }}>Target Evidence ID *</label>
                  <input
                    type="number"
                    value={newPointForm.evidence_id}
                    onChange={e => setNewPointForm({ ...newPointForm, evidence_id: e.target.value })}
                    placeholder="e.g. 1"
                    required
                    style={{ width: '100%', backgroundColor: '#0d1117', border: '1px solid #30363d', color: '#fff', padding: '0.35rem', borderRadius: '4px', fontSize: '0.75rem' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: '#8b949e' }}>Latitude * (-90 to 90)</label>
                    <input
                      type="number"
                      step="any"
                      value={newPointForm.latitude}
                      onChange={e => setNewPointForm({ ...newPointForm, latitude: e.target.value })}
                      placeholder="40.7128"
                      required
                      style={{ width: '100%', backgroundColor: '#0d1117', border: '1px solid #30363d', color: '#fff', padding: '0.35rem', borderRadius: '4px', fontSize: '0.75rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: '#8b949e' }}>Longitude * (-180 to 180)</label>
                    <input
                      type="number"
                      step="any"
                      value={newPointForm.longitude}
                      onChange={e => setNewPointForm({ ...newPointForm, longitude: e.target.value })}
                      placeholder="-74.0060"
                      required
                      style={{ width: '100%', backgroundColor: '#0d1117', border: '1px solid #30363d', color: '#fff', padding: '0.35rem', borderRadius: '4px', fontSize: '0.75rem' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', color: '#8b949e' }}>Location Name / Description</label>
                  <input
                    type="text"
                    value={newPointForm.location_name}
                    onChange={e => setNewPointForm({ ...newPointForm, location_name: e.target.value })}
                    placeholder="e.g. South Alleyway Exterior"
                    style={{ width: '100%', backgroundColor: '#0d1117', border: '1px solid #30363d', color: '#fff', padding: '0.35rem', borderRadius: '4px', fontSize: '0.75rem' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', color: '#8b949e' }}>Coordinate Source</label>
                  <select
                    value={newPointForm.location_source}
                    onChange={e => setNewPointForm({ ...newPointForm, location_source: e.target.value })}
                    style={{ width: '100%', backgroundColor: '#0d1117', border: '1px solid #30363d', color: '#fff', padding: '0.35rem', borderRadius: '4px', fontSize: '0.75rem' }}
                  >
                    <option value="OFFICER_ENTERED">Officer Manual Entry</option>
                    <option value="EXIF_GPS">EXIF GPS Metadata</option>
                    <option value="CCTV_RECORD">CCTV Surveillance Record</option>
                    <option value="CELL_TOWER">Cell Tower Dump</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', color: '#8b949e' }}>Estimated Precision Radius (Meters)</label>
                  <input
                    type="number"
                    value={newPointForm.accuracy_meters}
                    onChange={e => setNewPointForm({ ...newPointForm, accuracy_meters: e.target.value })}
                    placeholder="5.0"
                    style={{ width: '100%', backgroundColor: '#0d1117', border: '1px solid #30363d', color: '#fff', padding: '0.35rem', borderRadius: '4px', fontSize: '0.75rem' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', color: '#8b949e' }}>Investigative Notes</label>
                  <textarea
                    rows={2}
                    value={newPointForm.review_notes}
                    onChange={e => setNewPointForm({ ...newPointForm, review_notes: e.target.value })}
                    placeholder="Rationale for coordinates and mapping method..."
                    style={{ width: '100%', backgroundColor: '#0d1117', border: '1px solid #30363d', color: '#fff', padding: '0.35rem', borderRadius: '4px', fontSize: '0.75rem' }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingPoint}
                  className="btn-primary"
                  style={{ marginTop: '0.5rem', padding: '0.45rem', fontSize: '0.75rem' }}
                >
                  {submittingPoint ? 'Recording...' : '💾 Save Coordinate Record'}
                </button>
              </form>
            )}

          </div>
        </div>

      </div>

    </div>
  );
}

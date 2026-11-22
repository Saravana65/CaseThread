/**
 * @file TimelinePanel.js
 * @brief Investigative Timeline & Explainable Contradiction Analysis Command Center.
 * @project CASETHREAD — Phase 8 Investigative Timeline
 * @inspiration Chronicle multi-lane investigative UI, Apple minimal clarity & precision.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import api from '../services/api';

// Category color mappings & lane definitions
const CATEGORY_CONFIG = {
  INCIDENT: { label: 'Incident / Sighting', lane: 'INCIDENTS', color: '#EF4444', icon: '🚨' },
  SUSPECT_SIGHTING: { label: 'Suspect Sighting', lane: 'INCIDENTS', color: '#F97316', icon: '👤' },
  WITNESS_STATEMENT: { label: 'Witness Statement', lane: 'INCIDENTS', color: '#EAB308', icon: '🗣️' },
  EVIDENCE_COLLECTION: { label: 'Evidence Recovery', lane: 'EVIDENCE', color: '#3B82F6', icon: '📦' },
  DIGITAL_RECORD: { label: 'Digital Record', lane: 'EVIDENCE', color: '#06B6D4', icon: '💾' },
  CUSTODY_TRANSFER: { label: 'Custody Transfer', lane: 'CUSTODY', color: '#8B5CF6', icon: '🔐' },
  OFFICER_ACTION: { label: 'Procedural Milestone', lane: 'PROCEDURAL', color: '#10B981', icon: '📋' },
  UNKNOWN: { label: 'Uncategorized', lane: 'PROCEDURAL', color: '#71717A', icon: '📌' }
};

const LANES = [
  { id: 'INCIDENTS', label: 'Incidents & Sightings', description: 'Suspect movements, alibi claims & observations', color: '#EF4444' },
  { id: 'EVIDENCE', label: 'Evidence Recovery', description: 'Physical item seizures & digital records', color: '#3B82F6' },
  { id: 'CUSTODY', label: 'Chain of Custody', description: 'Custodial transfers, lab intake & transfers', color: '#8B5CF6' },
  { id: 'PROCEDURAL', label: 'Procedural Milestones', description: 'Docket assignments, warrants & status logs', color: '#10B981' }
];

export default function TimelinePanel({ caseId = 1, caseData, onSelectCase, onRefreshCase }) {
  // State: Data loading
  const [events, setEvents] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // State: Filters and display controls
  const [viewMode, setViewMode] = useState('CHRONICLE'); // 'CHRONICLE' (Multi-lane visual) | 'LEDGER' (Audit list)
  const [selectedLane, setSelectedLane] = useState('ALL');
  const [precisionFilter, setPrecisionFilter] = useState('ALL'); // 'ALL' | 'EXACT' | 'DATE_ONLY' | 'APPROXIMATE' | 'UNKNOWN'
  const [gapThresholdHours, setGapThresholdHours] = useState(6);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('ASC'); // 'ASC' | 'DESC'
  const [groupBy, setGroupBy] = useState('NONE'); // 'NONE' | 'DAY' | 'LANE'

  // State: Visual Timeline Navigation & Zoom
  const [zoomLevel, setZoomLevel] = useState(1);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [activeScrubIndex, setActiveScrubIndex] = useState(0);
  const [activeTabSection, setActiveTabSection] = useState('ALL'); // 'ALL' | 'CONTRADICTIONS' | 'GAPS' | 'QUESTIONS'

  // State: Add Event Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventTimestamp, setNewEventTimestamp] = useState('');
  const [newEventCategory, setNewEventCategory] = useState('SUSPECT_SIGHTING');
  const [newEventLocation, setNewEventLocation] = useState('');
  const [newEventDescription, setNewEventDescription] = useState('');
  const [newEventVerified, setNewEventVerified] = useState(false);
  const [submittingEvent, setSubmittingEvent] = useState(false);

  const chronicleContainerRef = useRef(null);

  // Load consolidated events and deep contradiction analysis
  const fetchTimelineData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [eventsRes, analysisRes] = await Promise.all([
        api.getTimeline(caseId, { sort: sortOrder }),
        api.getTimelineAnalysis(caseId, { gap_threshold_hours: gapThresholdHours })
      ]);

      if (eventsRes.data && eventsRes.data.events) {
        setEvents(eventsRes.data.events);
        if (eventsRes.data.events.length > 0 && !selectedEvent) {
          setSelectedEvent(eventsRes.data.events[0]);
        }
      }
      if (analysisRes.data) {
        setAnalysis(analysisRes.data);
      }
    } catch (err) {
      console.error('Failed to load investigative timeline data:', err);
      setError(err.message || 'Error fetching timeline intelligence records.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTimelineData();
  }, [caseId, gapThresholdHours, sortOrder]);

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      // Lane filter
      if (selectedLane !== 'ALL') {
        const lane = (CATEGORY_CONFIG[e.category] || CATEGORY_CONFIG.UNKNOWN).lane;
        if (lane !== selectedLane) return false;
      }
      // Precision filter
      if (precisionFilter !== 'ALL' && e.precision !== precisionFilter) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = e.title && e.title.toLowerCase().includes(q);
        const matchDesc = e.description && e.description.toLowerCase().includes(q);
        const matchLoc = e.location && e.location.toLowerCase().includes(q);
        const matchEntity = e.entity_label && e.entity_label.toLowerCase().includes(q);
        const matchCode = e.associated_evidence_code && e.associated_evidence_code.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchLoc && !matchEntity && !matchCode) return false;
      }
      return true;
    });
  }, [events, selectedLane, precisionFilter, searchQuery]);

  // Grouped events for ledger view
  const groupedEvents = useMemo(() => {
    if (groupBy === 'NONE') return { 'All Records': filteredEvents };

    if (groupBy === 'DAY') {
      const groups = {};
      filteredEvents.forEach(e => {
        const key = e.display_date || 'Undated Records';
        if (!groups[key]) groups[key] = [];
        groups[key].push(e);
      });
      return groups;
    }

    if (groupBy === 'LANE') {
      const groups = {};
      filteredEvents.forEach(e => {
        const lane = (CATEGORY_CONFIG[e.category] || CATEGORY_CONFIG.UNKNOWN).lane;
        if (!groups[lane]) groups[lane] = [];
        groups[lane].push(e);
      });
      return groups;
    }

    return { 'All Records': filteredEvents };
  }, [filteredEvents, groupBy]);

  // Time bounding box for chronicle ruler
  const timelineBounds = useMemo(() => {
    const dated = filteredEvents.filter(e => e.timestamp_epoch !== null);
    if (dated.length === 0) return { min: 0, max: 0, span: 0 };
    const min = Math.min(...dated.map(e => e.timestamp_epoch));
    const max = Math.max(...dated.map(e => e.timestamp_epoch));
    const span = Math.max(max - min, 3600); // minimum 1 hour span
    return { min, max, span };
  }, [filteredEvents]);

  // Handle Event Add Submission
  const handleAddEvent = async (e) => {
    e.preventDefault();
    if (!newEventTitle.trim()) return;

    try {
      setSubmittingEvent(true);
      await api.addTimelineEvent(caseId, {
        event_title: newEventTitle.trim(),
        event_timestamp: newEventTimestamp ? new Date(newEventTimestamp).toISOString() : null,
        entity_type: newEventCategory === 'SUSPECT_SIGHTING' ? 'SUSPECT' : 'INCIDENT',
        location: newEventLocation.trim() || null,
        event_description: newEventDescription.trim() || null,
        is_verified: newEventVerified ? 1 : 0
      });

      setIsAddModalOpen(false);
      setNewEventTitle('');
      setNewEventTimestamp('');
      setNewEventLocation('');
      setNewEventDescription('');
      setNewEventVerified(false);

      await fetchTimelineData();
      if (onRefreshCase) onRefreshCase();
    } catch (err) {
      alert('Failed to log event: ' + err.message);
    } finally {
      setSubmittingEvent(false);
    }
  };

  // Keyboard navigation through timeline
  const handleStep = (direction) => {
    if (filteredEvents.length === 0) return;
    let nextIdx = activeScrubIndex + direction;
    if (nextIdx < 0) nextIdx = 0;
    if (nextIdx >= filteredEvents.length) nextIdx = filteredEvents.length - 1;
    setActiveScrubIndex(nextIdx);
    setSelectedEvent(filteredEvents[nextIdx]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%', paddingBottom: '3rem' }}>

      {/* ========================================================================= */}
      {/* 1. TOP HEADER & WORKSPACE BANNER                                          */}
      {/* ========================================================================= */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: '1rem',
        padding: '1.25rem 1.5rem',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-default)',
        borderRadius: '12px'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={{ fontSize: '1.25rem' }}>⏱️</span>
            <h1 style={{
              fontSize: '1.35rem',
              fontWeight: '700',
              letterSpacing: '-0.02em',
              color: 'var(--text-primary)',
              margin: 0
            }}>
              Investigative Timeline & Chronology Engine
            </h1>
            <span style={{
              fontSize: '0.72rem',
              fontWeight: '600',
              padding: '0.2rem 0.6rem',
              borderRadius: '20px',
              backgroundColor: 'var(--accent-primary-dim)',
              color: 'var(--accent-primary)',
              border: '1px solid var(--border-highlight)'
            }}>
              CASE #{caseData?.case_number || caseId}
            </span>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
            Chronological reconstruction, transparent rule-based contradiction detection & time-gap analysis backed by native C AVL algorithms.
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.82rem',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              backgroundColor: 'var(--accent-primary)',
              color: '#FFF',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            <span>+</span> Log Timeline Event
          </button>

          <button
            onClick={() => { setRefreshing(true); fetchTimelineData(); }}
            disabled={refreshing || loading}
            className="btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.82rem',
              padding: '0.5rem 0.9rem',
              borderRadius: '8px',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-default)',
              cursor: 'pointer'
            }}
          >
            <span style={{ display: 'inline-block', transform: refreshing ? 'rotate(180deg)' : 'none', transition: 'transform 0.4s ease' }}>🔄</span>
            {refreshing ? 'Re-analyzing...' : 'Re-analyze'}
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. EXECUTIVE METRIC RIBBON (Phase 8 Summary Metrics)                       */}
      {/* ========================================================================= */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '0.85rem'
      }}>
        {/* Metric 1: Total Events */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          borderRadius: '10px',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem'
        }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: '600' }}>
            Consolidated Events
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.6rem', fontWeight: '700', color: 'var(--text-primary)' }}>
              {analysis?.summary?.total_events || events.length}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>across 4 tables</span>
          </div>
        </div>

        {/* Metric 2: Complete Timestamps */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          borderRadius: '10px',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem'
        }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: '600' }}>
            Complete Timestamps
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.6rem', fontWeight: '700', color: 'var(--status-success)' }}>
              {analysis?.summary?.complete_timestamps || events.filter(e => e.precision === 'EXACT').length}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>second precision</span>
          </div>
        </div>

        {/* Metric 3: Undated / Missing */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          borderRadius: '10px',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem'
        }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: '600' }}>
            Missing / Undated (Rule E)
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.6rem', fontWeight: '700', color: (analysis?.summary?.missing_timestamps || 0) > 0 ? 'var(--status-warning)' : 'var(--text-primary)' }}>
              {analysis?.summary?.missing_timestamps || events.filter(e => e.timestamp_epoch === null).length}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>requires intake date</span>
          </div>
        </div>

        {/* Metric 4: Contradictions */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: (analysis?.contradictions?.length || 0) > 0 ? '1px solid var(--border-accent-red)' : '1px solid var(--border-default)',
          borderRadius: '10px',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem',
          cursor: 'pointer',
          transition: 'background 0.2s'
        }}
        onClick={() => setActiveTabSection('CONTRADICTIONS')}
        >
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: '600' }}>
            Contradictions Flagged
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.6rem', fontWeight: '700', color: (analysis?.contradictions?.length || 0) > 0 ? 'var(--accent-red)' : 'var(--status-success)' }}>
              {analysis?.contradictions?.length || 0}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Rules A–F active</span>
          </div>
        </div>

        {/* Metric 5: Gaps Exceeding Threshold */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: (analysis?.gaps?.length || 0) > 0 ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid var(--border-default)',
          borderRadius: '10px',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem',
          cursor: 'pointer'
        }}
        onClick={() => setActiveTabSection('GAPS')}
        >
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: '600' }}>
            Time Gaps ({gapThresholdHours}h+)
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.6rem', fontWeight: '700', color: (analysis?.gaps?.length || 0) > 0 ? 'var(--status-warning)' : 'var(--text-primary)' }}>
              {analysis?.gaps?.length || 0}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>threshold intervals</span>
          </div>
        </div>

        {/* Metric 6: C-Engine Latency */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          borderRadius: '10px',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem'
        }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: '600' }}>
            C99 AVL-Tree Latency
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.6rem', fontWeight: '700', color: 'var(--accent-primary)' }}>
              {(analysis?.summary?.c_execution_latency_ms || 0.05).toFixed(2)} ms
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>O(log N) balance</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. CONTROLS BAR: VIEW MODE, LANES, PRECISION, GAPS, SEARCH                */}
      {/* ========================================================================= */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.85rem',
        padding: '0.85rem 1.25rem',
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-default)',
        borderRadius: '10px'
      }}>
        {/* Left: View Mode Toggle */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: 'var(--bg-input)',
          borderRadius: '8px',
          padding: '2px',
          border: '1px solid var(--border-default)'
        }}>
          <button
            onClick={() => setViewMode('CHRONICLE')}
            style={{
              padding: '0.4rem 0.85rem',
              fontSize: '0.78rem',
              fontWeight: '600',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: viewMode === 'CHRONICLE' ? 'var(--accent-primary)' : 'transparent',
              color: viewMode === 'CHRONICLE' ? '#FFF' : 'var(--text-secondary)',
              transition: 'all 0.2s'
            }}
          >
            Chronicle Multi-Lane
          </button>
          <button
            onClick={() => setViewMode('LEDGER')}
            style={{
              padding: '0.4rem 0.85rem',
              fontSize: '0.78rem',
              fontWeight: '600',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: viewMode === 'LEDGER' ? 'var(--accent-primary)' : 'transparent',
              color: viewMode === 'LEDGER' ? '#FFF' : 'var(--text-secondary)',
              transition: 'all 0.2s'
            }}
          >
            Audit Ledger ({filteredEvents.length})
          </button>
        </div>

        {/* Center: Lane and Precision Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          {/* Lane Selector */}
          <select
            value={selectedLane}
            onChange={(e) => setSelectedLane(e.target.value)}
            style={{
              backgroundColor: 'var(--bg-input)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-default)',
              borderRadius: '6px',
              padding: '0.4rem 0.75rem',
              fontSize: '0.78rem',
              outline: 'none'
            }}
          >
            <option value="ALL">All Categories & Lanes</option>
            <option value="INCIDENTS">🚨 Incidents & Sightings</option>
            <option value="EVIDENCE">📦 Evidence Recovery</option>
            <option value="CUSTODY">🔐 Custody Transfers</option>
            <option value="PROCEDURAL">📋 Procedural Milestones</option>
          </select>

          {/* Precision Selector */}
          <select
            value={precisionFilter}
            onChange={(e) => setPrecisionFilter(e.target.value)}
            style={{
              backgroundColor: 'var(--bg-input)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-default)',
              borderRadius: '6px',
              padding: '0.4rem 0.75rem',
              fontSize: '0.78rem',
              outline: 'none'
            }}
          >
            <option value="ALL">All Precisions</option>
            <option value="EXACT">Exact (HH:MM:SS)</option>
            <option value="DATE_ONLY">Date Only (00:00)</option>
            <option value="APPROXIMATE">Approximate</option>
            <option value="UNKNOWN">Missing / Undated</option>
          </select>

          {/* Gap Threshold Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Gap:</span>
            <select
              value={gapThresholdHours}
              onChange={(e) => setGapThresholdHours(parseFloat(e.target.value))}
              style={{
                backgroundColor: 'var(--bg-input)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-default)',
                borderRadius: '6px',
                padding: '0.4rem 0.6rem',
                fontSize: '0.78rem',
                outline: 'none'
              }}
            >
              <option value="2">2 Hours</option>
              <option value="6">6 Hours</option>
              <option value="12">12 Hours</option>
              <option value="24">24 Hours</option>
              <option value="48">48 Hours</option>
              <option value="168">7 Days</option>
            </select>
          </div>

          {/* Grouping for ledger */}
          {viewMode === 'LEDGER' && (
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
              style={{
                backgroundColor: 'var(--bg-input)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-default)',
                borderRadius: '6px',
                padding: '0.4rem 0.6rem',
                fontSize: '0.78rem',
                outline: 'none'
              }}
            >
              <option value="NONE">No Grouping</option>
              <option value="DAY">Group by Day</option>
              <option value="LANE">Group by Lane</option>
            </select>
          )}

          {/* Sort order */}
          <button
            onClick={() => setSortOrder(prev => prev === 'ASC' ? 'DESC' : 'ASC')}
            title="Toggle chronological sorting"
            style={{
              backgroundColor: 'var(--bg-input)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-default)',
              borderRadius: '6px',
              padding: '0.4rem 0.65rem',
              fontSize: '0.78rem',
              cursor: 'pointer'
            }}
          >
            {sortOrder === 'ASC' ? '⬆ Oldest First' : '⬇ Newest First'}
          </button>
        </div>

        {/* Right: Search Input */}
        <div style={{ position: 'relative', minWidth: '220px' }}>
          <input
            type="text"
            placeholder="Search records, entities, locations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              backgroundColor: 'var(--bg-input)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-default)',
              borderRadius: '6px',
              padding: '0.4rem 0.75rem 0.4rem 2rem',
              fontSize: '0.78rem',
              outline: 'none'
            }}
          />
          <span style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            🔍
          </span>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '0.5rem',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '0.75rem'
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. MAIN WORKSPACE: TIMELINE VIEW + INSPECTOR DRAWER                       */}
      {/* ========================================================================= */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: selectedEvent ? '1fr 340px' : '1fr',
        gap: '1.25rem',
        alignItems: 'start'
      }}>
        {/* Left Primary View Container */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', minWidth: 0 }}>

          {/* VIEW MODE 1: CHRONICLE MULTI-LANE VISUAL TIMELINE */}
          {viewMode === 'CHRONICLE' && (
            <div style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              borderRadius: '12px',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}>
              {/* Chronicle Header & Zoom Controls */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Multi-Lane Spatiotemporal Axis
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    • Zoom: {zoomLevel}x
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <button
                    onClick={() => setZoomLevel(prev => Math.max(0.75, prev - 0.25))}
                    style={{
                      padding: '0.3rem 0.6rem',
                      borderRadius: '5px',
                      backgroundColor: 'var(--bg-input)',
                      border: '1px solid var(--border-default)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      fontSize: '0.78rem'
                    }}
                    title="Zoom Out"
                  >
                    -
                  </button>
                  <button
                    onClick={() => setZoomLevel(1)}
                    style={{
                      padding: '0.3rem 0.6rem',
                      borderRadius: '5px',
                      backgroundColor: 'var(--bg-input)',
                      border: '1px solid var(--border-default)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      fontSize: '0.74rem'
                    }}
                    title="Reset Zoom"
                  >
                    Reset
                  </button>
                  <button
                    onClick={() => setZoomLevel(prev => Math.min(3, prev + 0.25))}
                    style={{
                      padding: '0.3rem 0.6rem',
                      borderRadius: '5px',
                      backgroundColor: 'var(--bg-input)',
                      border: '1px solid var(--border-default)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      fontSize: '0.78rem'
                    }}
                    title="Zoom In"
                  >
                    +
                  </button>

                  <div style={{ width: '1px', height: '18px', backgroundColor: 'var(--border-default)', margin: '0 0.3rem' }} />

                  {/* Step Scrubbers */}
                  <button
                    onClick={() => handleStep(-1)}
                    style={{
                      padding: '0.3rem 0.6rem',
                      borderRadius: '5px',
                      backgroundColor: 'var(--bg-input)',
                      border: '1px solid var(--border-default)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      fontSize: '0.78rem'
                    }}
                    title="Previous Chronological Event"
                  >
                    ◀ Prev
                  </button>
                  <button
                    onClick={() => handleStep(1)}
                    style={{
                      padding: '0.3rem 0.6rem',
                      borderRadius: '5px',
                      backgroundColor: 'var(--bg-input)',
                      border: '1px solid var(--border-default)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      fontSize: '0.78rem'
                    }}
                    title="Next Chronological Event"
                  >
                    Next ▶
                  </button>
                </div>
              </div>

              {/* Chronicle Multi-Lane Canvas */}
              <div
                ref={chronicleContainerRef}
                style={{
                  position: 'relative',
                  overflowX: 'auto',
                  border: '1px solid var(--border-default)',
                  borderRadius: '8px',
                  backgroundColor: '#0c0d10',
                  padding: '1.25rem 1rem',
                  minHeight: '380px'
                }}
              >
                {/* Horizontal Lane Rows */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  minWidth: `${Math.max(800, 1000 * zoomLevel)}px`
                }}>
                  {LANES.map(lane => {
                    const laneEvents = filteredEvents.filter(e => {
                      const l = (CATEGORY_CONFIG[e.category] || CATEGORY_CONFIG.UNKNOWN).lane;
                      return l === lane.id;
                    });

                    return (
                      <div
                        key={lane.id}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '180px 1fr',
                          gap: '1rem',
                          alignItems: 'center',
                          backgroundColor: 'rgba(255, 255, 255, 0.015)',
                          borderRadius: '8px',
                          padding: '0.6rem 0.8rem',
                          border: '1px solid rgba(255, 255, 255, 0.04)'
                        }}
                      >
                        {/* Lane Label */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: lane.color }} />
                            <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                              {lane.label}
                            </span>
                          </div>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: 1.2 }}>
                            {lane.description} ({laneEvents.length})
                          </span>
                        </div>

                        {/* Lane Track & Event Nodes */}
                        <div style={{
                          position: 'relative',
                          height: '52px',
                          backgroundColor: 'rgba(255, 255, 255, 0.02)',
                          borderRadius: '6px',
                          border: '1px solid var(--border-subtle)',
                          display: 'flex',
                          alignItems: 'center'
                        }}>
                          {/* Track Baseline Ruler */}
                          <div style={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            top: '50%',
                            height: '1px',
                            backgroundColor: 'rgba(255, 255, 255, 0.08)'
                          }} />

                          {/* Render Events as Interactive Nodes */}
                          {laneEvents.map((e, idx) => {
                            let leftPct = 5;
                            if (e.timestamp_epoch !== null && timelineBounds.span > 0) {
                              leftPct = 5 + ((e.timestamp_epoch - timelineBounds.min) / timelineBounds.span) * 88;
                            } else {
                              leftPct = 92 + (idx * 2); // Put undated events at the far right
                            }

                            const isSelected = selectedEvent && selectedEvent.event_id === e.event_id;
                            const isMissing = e.precision === 'UNKNOWN';

                            return (
                              <div
                                key={e.event_id}
                                onClick={() => setSelectedEvent(e)}
                                title={`${e.title} • ${e.display_time || 'Undated'} (${e.location || 'Location Unknown'})`}
                                style={{
                                  position: 'absolute',
                                  left: `${leftPct}%`,
                                  transform: 'translateX(-50%)',
                                  cursor: 'pointer',
                                  zIndex: isSelected ? 10 : 2
                                }}
                              >
                                <div style={{
                                  width: isSelected ? '34px' : '26px',
                                  height: isSelected ? '34px' : '26px',
                                  borderRadius: '50%',
                                  backgroundColor: isSelected ? lane.color : 'var(--bg-elevated)',
                                  border: isSelected
                                    ? '2px solid #FFF'
                                    : isMissing
                                    ? '2px dashed var(--status-warning)'
                                    : `2px solid ${lane.color}`,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: isSelected ? '0.85rem' : '0.72rem',
                                  boxShadow: isSelected ? `0 0 12px ${lane.color}` : 'none',
                                  transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                                }}>
                                  {(CATEGORY_CONFIG[e.category] || CATEGORY_CONFIG.UNKNOWN).icon}
                                </div>

                                {/* Mini time pill on selected */}
                                {isSelected && (
                                  <div style={{
                                    position: 'absolute',
                                    top: '38px',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    backgroundColor: 'var(--bg-higher)',
                                    color: '#FFF',
                                    fontSize: '0.65rem',
                                    fontWeight: '600',
                                    padding: '0.15rem 0.45rem',
                                    borderRadius: '4px',
                                    whiteSpace: 'nowrap',
                                    border: '1px solid var(--border-highlight)',
                                    boxShadow: '0 4px 8px rgba(0,0,0,0.5)'
                                  }}>
                                    {e.display_time}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Detected Gap Indicators Ribbon below Lanes */}
                {analysis?.gaps && analysis.gaps.length > 0 && (
                  <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--border-default)', paddingTop: '0.85rem' }}>
                    <div style={{ fontSize: '0.74rem', color: 'var(--status-warning)', fontWeight: '600', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span>⚠️</span> Time Gaps Exceeding {gapThresholdHours} Hours ({analysis.gaps.length} detected)
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '0.4rem' }}>
                      {analysis.gaps.map(gap => (
                        <div
                          key={gap.gap_id}
                          style={{
                            backgroundColor: 'rgba(245, 158, 11, 0.08)',
                            border: '1px solid rgba(245, 158, 11, 0.25)',
                            borderRadius: '6px',
                            padding: '0.5rem 0.75rem',
                            fontSize: '0.72rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.2rem',
                            minWidth: '260px'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--status-warning)', fontWeight: '700' }}>
                            <span>{gap.duration_formatted} Interval</span>
                            <span>{gap.threshold_hours}h Threshold</span>
                          </div>
                          <span style={{ color: 'var(--text-secondary)' }}>
                            Between: '{gap.start_event.title}' and '{gap.end_event.title}'
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VIEW MODE 2: DETAILED AUDIT LEDGER */}
          {viewMode === 'LEDGER' && (
            <div style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              borderRadius: '12px',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                  Forensic Chronological Ledger ({filteredEvents.length} Records)
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  UTC normalized • Grouped by {groupBy}
                </span>
              </div>

              {/* Grouped Event Tables */}
              {Object.entries(groupedEvents).map(([groupTitle, groupItems]) => (
                <div key={groupTitle} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {groupBy !== 'NONE' && (
                    <div style={{
                      fontSize: '0.76rem',
                      fontWeight: '700',
                      color: 'var(--text-secondary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      borderBottom: '1px solid var(--border-default)',
                      paddingBottom: '0.35rem',
                      marginTop: '0.5rem'
                    }}>
                      {groupTitle} ({groupItems.length})
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {groupItems.map(e => {
                      const isSelected = selectedEvent && selectedEvent.event_id === e.event_id;
                      const catConfig = CATEGORY_CONFIG[e.category] || CATEGORY_CONFIG.UNKNOWN;

                      return (
                        <div
                          key={e.event_id}
                          onClick={() => setSelectedEvent(e)}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '130px 1fr 180px 100px',
                            gap: '0.75rem',
                            alignItems: 'center',
                            padding: '0.65rem 0.85rem',
                            borderRadius: '6px',
                            backgroundColor: isSelected ? 'var(--bg-elevated)' : 'var(--bg-input)',
                            border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                          }}
                        >
                          {/* Time & Precision Badge */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                            <span style={{ fontSize: '0.76rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                              {e.display_time}
                            </span>
                            <span style={{
                              fontSize: '0.65rem',
                              color: e.precision === 'EXACT' ? 'var(--status-success)' : e.precision === 'UNKNOWN' ? 'var(--status-warning)' : 'var(--text-muted)'
                            }}>
                              {e.precision}
                            </span>
                          </div>

                          {/* Event Title & Location */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span>{catConfig.icon}</span>
                              <span style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                                {e.title}
                              </span>
                            </div>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                              📍 {e.location || 'Location Not Recorded'}
                            </span>
                          </div>

                          {/* Entity & Source */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-primary)' }}>
                              {e.entity_label || 'Case Record'}
                            </span>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                              Source: {e.source_table}
                            </span>
                          </div>

                          {/* Status Badge */}
                          <div style={{ textAlign: 'right' }}>
                            <span style={{
                              fontSize: '0.65rem',
                              padding: '0.2rem 0.45rem',
                              borderRadius: '4px',
                              backgroundColor: e.is_verified ? 'var(--status-success-dim)' : 'rgba(255, 255, 255, 0.05)',
                              color: e.is_verified ? 'var(--status-success)' : 'var(--text-muted)',
                              border: e.is_verified ? '1px solid var(--status-success-border)' : '1px solid var(--border-subtle)',
                              fontWeight: '600'
                            }}>
                              {e.is_verified ? 'VERIFIED' : 'UNVERIFIED'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ========================================================================= */}
          {/* 5. CONTRADICTIONS & INCONSISTENCIES SECTION (Rules A - F)                 */}
          {/* ========================================================================= */}
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            borderRadius: '12px',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontSize: '1.1rem' }}>⚠️</span>
                <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                  Explainable Contradictions & Temporal Inconsistencies ({analysis?.contradictions?.length || 0})
                </h3>
              </div>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                Evaluated against forensic rules A through F
              </span>
            </div>

            {/* Contradiction Cards */}
            {(!analysis?.contradictions || analysis.contradictions.length === 0) ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--status-success)' }}>
                ✓ No temporal contradictions or sequence anomalies detected under current threshold rules.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {analysis.contradictions.map((c, idx) => (
                  <div
                    key={c.id || idx}
                    style={{
                      backgroundColor: 'var(--bg-input)',
                      border: c.severity === 'CRITICAL' ? '1px solid var(--border-accent-red)' : '1px solid rgba(245, 158, 11, 0.3)',
                      borderRadius: '8px',
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.6rem'
                    }}
                  >
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{
                          fontSize: '0.68rem',
                          fontWeight: '700',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '4px',
                          backgroundColor: c.severity === 'CRITICAL' ? 'var(--accent-red-glow)' : 'rgba(245, 158, 11, 0.15)',
                          color: c.severity === 'CRITICAL' ? 'var(--accent-red)' : 'var(--status-warning)',
                          border: c.severity === 'CRITICAL' ? '1px solid var(--border-accent-red)' : '1px solid rgba(245, 158, 11, 0.3)'
                        }}>
                          {c.severity}
                        </span>
                        <span style={{ fontSize: '0.84rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                          {c.rule_name || c.rule_code}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        {c.rule_code}
                      </span>
                    </div>

                    {/* Explanation */}
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                      {c.explanation}
                    </p>

                    {/* Why this needs review */}
                    {c.why_needs_review && (
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', backgroundColor: 'rgba(255, 255, 255, 0.02)', padding: '0.4rem 0.6rem', borderRadius: '4px' }}>
                        <strong style={{ color: 'var(--text-secondary)' }}>Forensic Review Rationale:</strong> {c.why_needs_review}
                      </div>
                    )}

                    {/* Suggested Questions */}
                    {c.suggested_questions && c.suggested_questions.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.2rem' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--accent-primary)', fontWeight: '600' }}>
                          Targeted Investigator Questions:
                        </span>
                        {c.suggested_questions.map((q, qIdx) => (
                          <div key={qIdx} style={{ fontSize: '0.74rem', color: 'var(--text-primary)', display: 'flex', gap: '0.35rem' }}>
                            <span>•</span>
                            <span>{q}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* 6. INVESTIGATION QUESTIONS DERIVED FROM GAPS & ANOMALIES                  */}
          {/* ========================================================================= */}
          {analysis?.investigation_questions && analysis.investigation_questions.length > 0 && (
            <div style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              borderRadius: '12px',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.1rem' }}>💡</span>
                <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                  Automated Investigative Inquiries ({analysis.investigation_questions.length})
                </h3>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                Synthesized lines of questioning derived directly from chronological gaps and spatiotemporal contradictions.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {analysis.investigation_questions.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      backgroundColor: 'var(--bg-input)',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '6px',
                      border: '1px solid var(--border-subtle)'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                        {item.question}
                      </span>
                      {item.context && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          Context: {item.context}
                        </span>
                      )}
                    </div>
                    <span style={{
                      fontSize: '0.65rem',
                      fontWeight: '700',
                      padding: '0.15rem 0.4rem',
                      borderRadius: '4px',
                      backgroundColor: item.priority === 'CRITICAL' ? 'var(--accent-red-glow)' : 'var(--accent-primary-dim)',
                      color: item.priority === 'CRITICAL' ? 'var(--accent-red)' : 'var(--accent-primary)'
                    }}>
                      {item.priority}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* ========================================================================= */}
        {/* RIGHT DRAWER: EVENT INSPECTOR (Chronicle-style detail sidebar)             */}
        {/* ========================================================================= */}
        {selectedEvent && (
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            borderRadius: '12px',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            position: 'sticky',
            top: '1rem'
          }}>
            {/* Header with Close */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: '700' }}>
                  Event Inspector
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--accent-primary)', fontFamily: 'monospace' }}>
                  {selectedEvent.event_id}
                </span>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                ✕
              </button>
            </div>

            {/* Event Title & Category */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                {selectedEvent.title}
              </h4>
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <span style={{
                  fontSize: '0.68rem',
                  padding: '0.15rem 0.45rem',
                  borderRadius: '4px',
                  backgroundColor: 'var(--accent-primary-dim)',
                  color: 'var(--accent-primary)',
                  fontWeight: '600'
                }}>
                  {selectedEvent.category}
                </span>
                <span style={{
                  fontSize: '0.68rem',
                  padding: '0.15rem 0.45rem',
                  borderRadius: '4px',
                  backgroundColor: selectedEvent.is_verified ? 'var(--status-success-dim)' : 'rgba(255,255,255,0.05)',
                  color: selectedEvent.is_verified ? 'var(--status-success)' : 'var(--text-muted)',
                  fontWeight: '600'
                }}>
                  {selectedEvent.is_verified ? 'VERIFIED RECORD' : 'UNVERIFIED OBSERVATION'}
                </span>
              </div>
            </div>

            {/* Description */}
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4, backgroundColor: 'var(--bg-input)', padding: '0.65rem', borderRadius: '6px' }}>
              {selectedEvent.description || 'No additional narrative description recorded.'}
            </div>

            {/* Forensic Metadata Specs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', borderTop: '1px solid var(--border-default)', paddingTop: '0.85rem' }}>
              <div>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>RECORDED TIMESTAMP</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: '600' }}>
                  {selectedEvent.timestamp || selectedEvent.display_time || 'Undated'}
                </span>
              </div>

              <div>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>TEMPORAL PRECISION</span>
                <span style={{ fontSize: '0.75rem', color: selectedEvent.precision === 'EXACT' ? 'var(--status-success)' : 'var(--status-warning)', fontWeight: '600' }}>
                  {selectedEvent.precision}
                </span>
              </div>

              <div>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>GEOGRAPHICAL LOCATION</span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)' }}>
                  📍 {selectedEvent.location || 'Unknown / Not Logged'}
                </span>
              </div>

              <div>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>ASSOCIATED ENTITY</span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)' }}>
                  👤 {selectedEvent.entity_label || 'Case Level Record'}
                </span>
              </div>

              <div>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>DATABASE SOURCE TABLE</span>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                  {selectedEvent.source_table} (ID: {selectedEvent.raw_id})
                </span>
              </div>

              {selectedEvent.associated_evidence_code && (
                <div>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>LINKED EVIDENCE RECORD</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: '600' }}>
                    📦 {selectedEvent.associated_evidence_code}
                  </span>
                </div>
              )}
            </div>

            {/* Action Buttons in Drawer */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(selectedEvent.timestamp || selectedEvent.display_time);
                  alert('Timestamp copied to clipboard!');
                }}
                className="btn-secondary"
                style={{
                  padding: '0.45rem',
                  fontSize: '0.75rem',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-default)',
                  cursor: 'pointer'
                }}
              >
                📋 Copy Timestamp (UTC)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 7. ADD TIMELINE EVENT MODAL                                               */}
      {/* ========================================================================= */}
      {isAddModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-default)',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '520px',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            boxShadow: '0 20px 40px rgba(0,0,0,0.6)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                Log Investigation Timeline Event
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.1rem' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddEvent} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>
                  Event Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sighting of Suspect Vehicle at West Gate"
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-default)',
                    borderRadius: '6px',
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.82rem',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>
                    Event Date & Time (UTC)
                  </label>
                  <input
                    type="datetime-local"
                    value={newEventTimestamp}
                    onChange={(e) => setNewEventTimestamp(e.target.value)}
                    style={{
                      width: '100%',
                      backgroundColor: 'var(--bg-input)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-default)',
                      borderRadius: '6px',
                      padding: '0.5rem 0.75rem',
                      fontSize: '0.82rem',
                      outline: 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>
                    Category
                  </label>
                  <select
                    value={newEventCategory}
                    onChange={(e) => setNewEventCategory(e.target.value)}
                    style={{
                      width: '100%',
                      backgroundColor: 'var(--bg-input)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-default)',
                      borderRadius: '6px',
                      padding: '0.5rem 0.75rem',
                      fontSize: '0.82rem',
                      outline: 'none'
                    }}
                  >
                    <option value="SUSPECT_SIGHTING">Suspect Sighting</option>
                    <option value="INCIDENT">Incident / Milestone</option>
                    <option value="WITNESS_STATEMENT">Witness Statement</option>
                    <option value="DIGITAL_RECORD">Digital Sighting / Geo-hit</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>
                  Location
                </label>
                <input
                  type="text"
                  placeholder="e.g. 142 Financial Blvd, Sector 7"
                  value={newEventLocation}
                  onChange={(e) => setNewEventLocation(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-default)',
                    borderRadius: '6px',
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.82rem',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>
                  Narrative Details / Investigative Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="Enter detailed alibi, sighting corroboration or forensic details..."
                  value={newEventDescription}
                  onChange={(e) => setNewEventDescription(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-default)',
                    borderRadius: '6px',
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.82rem',
                    outline: 'none',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  id="event-verified-check"
                  checked={newEventVerified}
                  onChange={(e) => setNewEventVerified(e.target.checked)}
                />
                <label htmlFor="event-verified-check" style={{ fontSize: '0.78rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                  Mark record as officially verified (Confirmed Fact)
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  style={{
                    padding: '0.5rem 1rem',
                    fontSize: '0.82rem',
                    borderRadius: '6px',
                    backgroundColor: 'transparent',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-default)',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEvent}
                  className="btn-primary"
                  style={{
                    padding: '0.5rem 1.25rem',
                    fontSize: '0.82rem',
                    borderRadius: '6px',
                    backgroundColor: 'var(--accent-primary)',
                    color: '#FFF',
                    border: 'none',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  {submittingEvent ? 'Saving...' : 'Save Timeline Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

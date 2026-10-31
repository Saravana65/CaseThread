import React, { useState } from 'react';

export default function TimelinePanel({ timeline = [], anomalies = [] }) {
  const [filterEntity, setFilterEntity] = useState('ALL');
  const [filterVerifiedOnly, setFilterVerifiedOnly] = useState(false);

  const filteredEvents = timeline.filter(event => {
    if (filterEntity !== 'ALL' && event.entity_type !== filterEntity) return false;
    if (filterVerifiedOnly && !event.is_verified) return false;
    return true;
  });

  const getStatusBadgeClass = (status, isVerified) => {
    if (isVerified || status === 'CONFIRMED_FACT') return 'badge-verified';
    if (status === 'UNVERIFIED_OBSERVATION') return 'badge-unverified';
    if (status === 'HYPOTHESIS') return 'badge-hypothesis';
    return 'badge-medium';
  };

  const getEntityColor = (type) => {
    switch (type) {
      case 'SUSPECT': return 'var(--accent-red)';
      case 'VICTIM': return '#29b6f6';
      case 'WITNESS': return 'var(--status-high)';
      case 'EVIDENCE': return 'var(--accent-orange)';
      case 'INCIDENT': return '#ff5252';
      default: return 'var(--text-secondary)';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Banner: Anomaly Alert Ribbon */}
      {anomalies && anomalies.length > 0 && (
        <div className="forensic-card accent-red-border" style={{ backgroundColor: 'rgba(211, 47, 47, 0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '1.3rem' }}>⚠️</span>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--accent-red)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Spatiotemporal Contradictions Detected ({anomalies.length})
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Identified via AVL-Tree inorder range analysis of consecutive sightings and travel velocities.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {anomalies.map((anom, idx) => (
              <div
                key={anom.anomaly_id || idx}
                style={{
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-accent-red)',
                  borderRadius: '4px',
                  padding: '0.85rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span className="badge badge-critical" style={{ fontSize: '0.7rem' }}>
                      {anom.anomaly_type || 'IMPOSSIBLE_TRAVEL_SPEED'}
                    </span>
                    <span style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                      Target: {anom.entity_label || 'Entity'}
                    </span>
                  </div>
                  <span className="mono" style={{ fontSize: '0.7rem', color: 'var(--accent-orange)' }}>
                    CONTRADICTION #{idx + 1}
                  </span>
                </div>

                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: '0.5rem' }}>
                  {anom.explanation}
                </div>

                {anom.suggested_check && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--accent-orange)', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <strong>Recommended Forensic Check:</strong> {anom.suggested_check}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Chronological Timeline Header & Filters */}
      <div className="forensic-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.2rem' }}>⏱️</span>
            <h2 style={{ fontSize: '1.1rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Chronological Incident & Alibi Ledger
            </h2>
            <span className="badge badge-open">{timeline.length} Recorded Events</span>
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Events sorted chronologically via AVL tree temporal indexing with physical corroboration checks.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div>
            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>
              Entity Filter
            </label>
            <select
              value={filterEntity}
              onChange={(e) => setFilterEntity(e.target.value)}
              style={{
                backgroundColor: 'var(--bg-input)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-default)',
                padding: '0.35rem 0.6rem',
                borderRadius: '4px',
                fontSize: '0.75rem'
              }}
            >
              <option value="ALL">All Entity Types</option>
              <option value="SUSPECT">Suspect Events</option>
              <option value="VICTIM">Victim Events</option>
              <option value="WITNESS">Witness Testimonies</option>
              <option value="EVIDENCE">Evidence Discoveries</option>
            </select>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-secondary)', cursor: 'pointer', marginTop: '1rem' }}>
            <input
              type="checkbox"
              checked={filterVerifiedOnly}
              onChange={(e) => setFilterVerifiedOnly(e.target.checked)}
            />
            Verified Facts Only
          </label>
        </div>
      </div>

      {/* Chronological Event Flow */}
      {filteredEvents.length === 0 ? (
        <div className="forensic-card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          No timeline events match the active criteria.
        </div>
      ) : (
        <div style={{ position: 'relative', paddingLeft: '2rem' }}>
          {/* Vertical connecting line */}
          <div style={{
            position: 'absolute',
            left: '11px',
            top: '12px',
            bottom: '12px',
            width: '2px',
            backgroundColor: 'var(--border-default)'
          }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {filteredEvents.map((evt, idx) => {
              const entityColor = getEntityColor(evt.entity_type);
              const isFact = evt.is_verified || evt.status === 'CONFIRMED_FACT';

              return (
                <div key={evt.timeline_id || idx} style={{ position: 'relative' }}>
                  {/* Timeline Node Bullet */}
                  <div style={{
                    position: 'absolute',
                    left: '-2rem',
                    top: '1.2rem',
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    backgroundColor: isFact ? 'var(--status-verified)' : 'var(--status-high)',
                    border: '2px solid var(--bg-primary)',
                    boxShadow: `0 0 6px ${isFact ? 'var(--status-verified)' : 'var(--status-high)'}`
                  }} />

                  {/* Event Card */}
                  <div className="forensic-card" style={{ marginLeft: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.4rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span className="mono" style={{ fontSize: '0.85rem', color: 'var(--accent-orange)', fontWeight: '700' }}>
                          {evt.event_timestamp ? new Date(evt.event_timestamp).toLocaleTimeString() : 'TIME UNLOGGED'}
                        </span>
                        <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {evt.event_timestamp ? new Date(evt.event_timestamp).toLocaleDateString() : ''}
                        </span>
                        <span style={{
                          fontSize: '0.68rem',
                          fontFamily: 'var(--font-mono)',
                          padding: '0.15rem 0.45rem',
                          borderRadius: '3px',
                          border: `1px solid ${entityColor}`,
                          color: entityColor,
                          backgroundColor: 'rgba(255, 255, 255, 0.03)'
                        }}>
                          {evt.entity_type} #{evt.entity_id}
                        </span>
                      </div>

                      <span className={`badge ${getStatusBadgeClass(evt.status, evt.is_verified)}`}>
                        {evt.status ? evt.status.replace(/_/g, ' ') : 'OBSERVATION'}
                      </span>
                    </div>

                    <h4 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.3rem' }}>
                      {evt.event_title}
                    </h4>

                    <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.6rem' }}>
                      {evt.event_description}
                    </p>

                    <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.5rem' }}>
                      {evt.location && (
                        <div>
                          <strong>📍 Location: </strong>
                          <span style={{ color: 'var(--text-secondary)' }}>{evt.location}</span>
                        </div>
                      )}
                      {evt.source_evidence_id && (
                        <div>
                          <strong>🔗 Corroborating Evidence: </strong>
                          <span className="mono" style={{ color: 'var(--accent-orange)' }}>EVD-REF #{evt.source_evidence_id}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

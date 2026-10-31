import React, { useState } from 'react';
import AddEvidenceModal from './AddEvidenceModal';

/**
 * @component CaseDetailsPanel
 * @description Master forensic case dossier displaying suspects, victims, witnesses, evidence items, and timelines.
 * Provides controls for running C-Engine DSA analysis, opening the graph canvas, and ingesting evidence.
 */
export default function CaseDetailsPanel({ caseData, onTriggerAnalysis, analyzing, onExploreGraph, onRefreshCase }) {
  const [activeSubTab, setActiveSubTab] = useState('overview');
  const [isAddEvidenceOpen, setIsAddEvidenceOpen] = useState(false);

  if (!caseData) {
    return (
      <div className="forensic-card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
        No case selected. Please choose an active case file.
      </div>
    );
  }

  const {
    case_number, title, description, incident_date, incident_location, priority, status,
    lead_officer_name, lead_officer_badge,
    suspects = [], victims = [], witnesses = [], evidence = [], timelines = []
  } = caseData;

  const handleEvidenceAdded = () => {
    if (onRefreshCase && caseData?.case_id) {
      onRefreshCase(caseData.case_id);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Master Case Header Banner */}
      <div className="forensic-card accent-red-border">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem' }}>
              <span className="mono" style={{ fontSize: '0.85rem', color: 'var(--accent-orange)', fontWeight: '700' }}>
                CASE FILE #{case_number}
              </span>
              <span className={`badge ${priority === 'CRITICAL' ? 'badge-critical' : 'badge-high'}`}>
                {priority} PRIORITY
              </span>
              <span className="badge badge-open">
                {status}
              </span>
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--text-primary)' }}>
              {title}
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.4rem', maxWidth: '800px' }}>
              {description}
            </p>
          </div>

          {/* Action Triggers */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => setIsAddEvidenceOpen(true)}
              className="btn-secondary"
              style={{ minWidth: '150px' }}
            >
              📦 Ingest Evidence
            </button>
            <button
              onClick={() => onTriggerAnalysis && onTriggerAnalysis(caseData.case_id)}
              disabled={analyzing}
              className="btn-primary"
              style={{ minWidth: '180px' }}
            >
              {analyzing ? '⚡ Executing C Engine...' : '⚡ Run C DSA Analysis'}
            </button>
            {onExploreGraph && (
              <button
                onClick={onExploreGraph}
                className="btn-secondary"
                style={{ minWidth: '160px' }}
              >
                🕸️ Open Graph Canvas
              </button>
            )}
          </div>
        </div>

        {/* Master Case Metadata Ribbon */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
          marginTop: '1.25rem',
          paddingTop: '1rem',
          borderTop: '1px solid var(--border-default)',
          fontSize: '0.8rem'
        }}>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Incident Timestamp</div>
            <div style={{ color: 'var(--text-primary)', fontWeight: '600' }}>
              {incident_date ? new Date(incident_date).toLocaleString() : 'N/A'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Primary Location</div>
            <div style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{incident_location}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Lead Detective</div>
            <div style={{ color: 'var(--text-primary)', fontWeight: '600' }}>
              {lead_officer_name || 'Assigned Detective'} ({lead_officer_badge || 'BADGE'})
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Entity Summary</div>
            <div style={{ color: 'var(--accent-orange)', fontFamily: 'var(--font-mono)' }}>
              {suspects.length} Suspects • {victims.length} Victims • {evidence.length} Evidence
            </div>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-default)', paddingBottom: '0.5rem', flexWrap: 'wrap' }}>
        {[
          { key: 'overview', label: `📋 Overview (${suspects.length + victims.length + witnesses.length + evidence.length})` },
          { key: 'suspects', label: `👤 Persons of Interest (${suspects.length})` },
          { key: 'victims', label: `🎯 Victims (${victims.length})` },
          { key: 'witnesses', label: `👁️ Witnesses (${witnesses.length})` },
          { key: 'evidence', label: `📦 Evidence Items (${evidence.length})` },
          { key: 'timeline', label: `⏱️ Incident Timelines (${timelines.length})` }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveSubTab(tab.key)}
            className={activeSubTab === tab.key ? 'btn-primary' : 'btn-secondary'}
            style={{ fontSize: '0.75rem', padding: '0.35rem 0.8rem' }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Overview Summary */}
      {activeSubTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
          {/* Suspects Brief */}
          <div className="forensic-card">
            <h3 style={{ fontSize: '0.9rem', color: 'var(--accent-red)', textTransform: 'uppercase', marginBottom: '0.75rem', fontWeight: '700' }}>
              👤 Persons of Interest ({suspects.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {suspects.map(s => (
                <div key={s.suspect_id} style={{ backgroundColor: 'var(--bg-input)', padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: '700', fontSize: '0.85rem' }}>{s.full_name}</span>
                    <span className="badge badge-critical" style={{ fontSize: '0.65rem' }}>{s.status}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Alias: &ldquo;{s.alias || 'None'}&rdquo; • Phone: {s.phone_number || 'Unknown'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Victims & Witnesses Brief */}
          <div className="forensic-card">
            <h3 style={{ fontSize: '0.9rem', color: '#29b6f6', textTransform: 'uppercase', marginBottom: '0.75rem', fontWeight: '700' }}>
              🎯 Victims & Witnesses ({victims.length + witnesses.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {victims.map(v => (
                <div key={v.victim_id} style={{ backgroundColor: 'var(--bg-input)', padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: '700', fontSize: '0.85rem' }}>{v.full_name} (Victim)</span>
                    <span className="badge badge-critical" style={{ fontSize: '0.65rem' }}>{v.condition_status}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{v.statement}</div>
                </div>
              ))}
              {witnesses.map(w => (
                <div key={w.witness_id} style={{ backgroundColor: 'var(--bg-input)', padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: '700', fontSize: '0.85rem' }}>{w.full_name} (Witness)</span>
                    <span className="badge badge-verified" style={{ fontSize: '0.65rem' }}>Credibility: {Math.round(w.credibility_score * 100)}%</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{w.statement}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Evidence Highlight Brief */}
          <div className="forensic-card">
            <h3 style={{ fontSize: '0.9rem', color: 'var(--accent-orange)', textTransform: 'uppercase', marginBottom: '0.75rem', fontWeight: '700' }}>
              📦 Primary Evidence Records ({evidence.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {evidence.slice(0, 4).map(e => (
                <div key={e.evidence_id} style={{ backgroundColor: 'var(--bg-input)', padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--accent-orange)' }}>{e.tracking_code}</span>
                    <span className={`badge ${e.verification_status === 'CONFIRMED_FACT' ? 'badge-verified' : 'badge-unverified'}`} style={{ fontSize: '0.65rem' }}>
                      {e.verification_status}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.82rem', fontWeight: '600' }}>{e.title}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Suspects Complete */}
      {activeSubTab === 'suspects' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1rem' }}>
          {suspects.map(s => (
            <div key={s.suspect_id} className="forensic-card accent-red-border">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-primary)' }}>{s.full_name}</h3>
                  <div style={{ fontSize: '0.78rem', color: 'var(--accent-orange)', fontFamily: 'var(--font-mono)' }}>
                    ALIAS: &ldquo;{s.alias || 'N/A'}&rdquo; • ID #{s.suspect_id}
                  </div>
                </div>
                <span className="badge badge-critical">{s.status}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.78rem', marginTop: '0.75rem', color: 'var(--text-secondary)' }}>
                <div><strong>Age/Gender:</strong> {s.age || 'N/A'} / {s.gender}</div>
                <div><strong>Phone:</strong> {s.phone_number || 'Unlisted'}</div>
                <div style={{ gridColumn: 'span 2' }}><strong>Address:</strong> {s.last_known_address || 'Unknown'}</div>
                <div style={{ gridColumn: 'span 2' }}><strong>Identifying Features:</strong> {s.identifying_features || 'None documented'}</div>
              </div>

              {s.notes && (
                <div style={{ backgroundColor: 'var(--bg-input)', padding: '0.6rem', borderRadius: '4px', marginTop: '0.75rem', fontSize: '0.78rem', border: '1px solid var(--border-default)' }}>
                  <strong>Investigator Intelligence: </strong>{s.notes}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tab 3: Victims Complete */}
      {activeSubTab === 'victims' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1rem' }}>
          {victims.map(v => (
            <div key={v.victim_id} className="forensic-card" style={{ borderLeft: '4px solid #29b6f6' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-primary)' }}>{v.full_name}</h3>
                <span className="badge badge-critical">{v.condition_status}</span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div><strong>Age/Gender:</strong> {v.age} / {v.gender}</div>
                <div><strong>Contact:</strong> {v.contact_info}</div>
                <div style={{ gridColumn: 'span 2' }}><strong>Residence:</strong> {v.residence_address}</div>
              </div>
              {v.statement && (
                <div style={{ backgroundColor: 'var(--bg-input)', padding: '0.6rem', borderRadius: '4px', marginTop: '0.75rem', fontSize: '0.78rem', border: '1px solid var(--border-default)' }}>
                  <strong>Reported Statement: </strong>{v.statement}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tab 4: Witnesses Complete */}
      {activeSubTab === 'witnesses' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1rem' }}>
          {witnesses.map(w => (
            <div key={w.witness_id} className="forensic-card" style={{ borderLeft: '4px solid var(--status-high)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-primary)' }}>{w.full_name}</h3>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{w.contact_phone}</div>
                </div>
                <span className="badge badge-verified">
                  Credibility: {Math.round(w.credibility_score * 100)}%
                </span>
              </div>

              <div style={{ backgroundColor: 'var(--bg-input)', padding: '0.75rem', borderRadius: '4px', fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem', lineHeight: 1.4 }}>
                &ldquo;{w.statement}&rdquo;
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
                <span>📍 Location: {w.statement_location || 'Not logged'}</span>
                <span>⏱️ {w.statement_timestamp ? new Date(w.statement_timestamp).toLocaleString() : 'N/A'}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 5: Evidence Catalog Complete */}
      {activeSubTab === 'evidence' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--bg-input)',
            padding: '0.75rem 1rem',
            borderRadius: '4px',
            border: '1px solid var(--border-default)',
            flexWrap: 'wrap',
            gap: '0.5rem'
          }}>
            <div>
              <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                Forensic Evidence Repository
              </span>
              <span className="badge badge-high" style={{ marginLeft: '0.6rem' }}>
                {evidence.length} Registered Items
              </span>
            </div>
            <button
              onClick={() => setIsAddEvidenceOpen(true)}
              className="btn-primary"
              style={{
                fontSize: '0.75rem',
                padding: '0.4rem 0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                backgroundColor: 'var(--accent-orange)',
                borderColor: '#e65100'
              }}
            >
              <span>➕</span>
              <span>Ingest Evidence Record</span>
            </button>
          </div>

          {evidence.length === 0 ? (
            <div className="forensic-card" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
              No evidence items registered yet for this case. Click &ldquo;Ingest Evidence Record&rdquo; above to add forensic artifacts.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '1rem' }}>
              {evidence.map(e => {
                const isFact = e.verification_status === 'CONFIRMED_FACT';
                return (
                  <div key={e.evidence_id} className="forensic-card" style={{ borderLeft: `4px solid ${isFact ? 'var(--status-verified)' : 'var(--status-high)'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                      <div>
                        <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--accent-orange)', fontWeight: '700' }}>
                          {e.tracking_code}
                        </span>
                        <h4 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)', marginTop: '0.1rem' }}>
                          {e.title}
                        </h4>
                      </div>
                      <span className={`badge ${isFact ? 'badge-verified' : 'badge-unverified'}`}>
                        {e.verification_status ? e.verification_status.replace(/_/g, ' ') : 'UNVERIFIED'}
                      </span>
                    </div>

                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.6rem' }}>
                      {e.description}
                    </p>

                    <div style={{
                      backgroundColor: 'var(--bg-input)',
                      padding: '0.6rem',
                      borderRadius: '4px',
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '0.4rem',
                      fontSize: '0.72rem',
                      color: 'var(--text-muted)',
                      border: '1px solid var(--border-subtle)'
                    }}>
                      <div><strong>Category:</strong> <span style={{ color: 'var(--text-primary)' }}>{e.category}</span></div>
                      <div><strong>Reliability:</strong> <span style={{ color: 'var(--text-primary)' }}>{e.reliability_assessment || 'N/A'}</span></div>
                      <div><strong>Source:</strong> <span style={{ color: e.source === 'UNKNOWN' ? 'var(--accent-red)' : 'var(--text-primary)' }}>{e.source || 'UNKNOWN'}</span></div>
                      <div><strong>Collected:</strong> <span style={{ color: !e.collected_at ? 'var(--accent-red)' : 'var(--text-primary)' }}>{e.collected_at ? new Date(e.collected_at).toLocaleDateString() : 'MISSING'}</span></div>
                      <div style={{ gridColumn: 'span 2' }}><strong>Location:</strong> <span style={{ color: 'var(--text-primary)' }}>{e.collection_location || 'Not logged'}</span></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 6: Timelines Complete */}
      {activeSubTab === 'timeline' && (
        <div className="forensic-card">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-default)', textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: '0.5rem' }}>Timestamp</th>
                <th style={{ padding: '0.5rem' }}>Entity</th>
                <th style={{ padding: '0.5rem' }}>Title & Description</th>
                <th style={{ padding: '0.5rem' }}>Location</th>
                <th style={{ padding: '0.5rem' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {timelines.map(t => (
                <tr key={t.timeline_id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td className="mono" style={{ padding: '0.6rem 0.5rem', color: 'var(--accent-orange)' }}>
                    {t.event_timestamp ? new Date(t.event_timestamp).toLocaleTimeString() : 'N/A'}
                  </td>
                  <td style={{ padding: '0.6rem 0.5rem' }}>
                    <span className="mono" style={{ fontSize: '0.7rem' }}>{t.entity_type} #{t.entity_id}</span>
                  </td>
                  <td style={{ padding: '0.6rem 0.5rem' }}>
                    <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{t.event_title}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t.event_description}</div>
                  </td>
                  <td style={{ padding: '0.6rem 0.5rem', color: 'var(--text-secondary)' }}>{t.location || 'N/A'}</td>
                  <td style={{ padding: '0.6rem 0.5rem' }}>
                    <span className={`badge ${t.is_verified || t.status === 'CONFIRMED_FACT' ? 'badge-verified' : 'badge-unverified'}`} style={{ fontSize: '0.65rem' }}>
                      {t.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Evidence Modal */}
      <AddEvidenceModal
        isOpen={isAddEvidenceOpen}
        onClose={() => setIsAddEvidenceOpen(false)}
        caseId={caseData.case_id}
        caseNumber={case_number}
        onEvidenceAdded={handleEvidenceAdded}
      />
    </div>
  );
}

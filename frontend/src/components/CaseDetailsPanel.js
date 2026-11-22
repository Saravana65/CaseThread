import React, { useState } from 'react';
import api from '../services/api';
import AddEvidenceModal from './AddEvidenceModal';
import EditCaseModal from './EditCaseModal';
import {
  CasesIcon,
  ChevronLeft,
  PlusIcon,
  GraphIcon,
  ReportIcon
} from './icons/Icons';

/**
 * @component CaseDetailsPanel
 * @description Master forensic case dossier displaying suspects, victims, witnesses, evidence items, and timelines.
 * Provides controls for running C-Engine DSA analysis, opening the graph canvas, editing case parameters, and ingesting evidence.
 */
export default function CaseDetailsPanel({
  caseData,
  onTriggerAnalysis,
  analyzing,
  onExploreGraph,
  onRefreshCase,
  onOpenReport,
  onBack,
  onNavigateTab
}) {
  const [activeSubTab, setActiveSubTab] = useState('overview');
  const [isAddEvidenceOpen, setIsAddEvidenceOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isArchivingConfirmOpen, setIsArchivingConfirmOpen] = useState(false);
  const [archivingInProgress, setArchivingInProgress] = useState(false);

  if (!caseData) {
    return (
      <div className="forensic-card" style={{ textAlign: 'center', padding: '3.5rem', color: 'var(--text-muted)' }}>
        <CasesIcon size={32} color="var(--border-highlight)" />
        <div style={{ marginTop: '0.75rem', fontSize: '0.9rem', fontWeight: '500' }}>
          No case selected. Please choose an active case file.
        </div>
        {onBack && (
          <button onClick={onBack} className="btn-secondary" style={{ marginTop: '1rem' }}>
            ← Back to Investigations
          </button>
        )}
      </div>
    );
  }

  const {
    case_number, title, description, incident_date, incident_location, priority, status,
    created_at, updated_at,
    lead_officer_name, lead_officer_badge,
    suspects = [], victims = [], witnesses = [], evidence = [], timelines = []
  } = caseData;

  const handleEvidenceAdded = () => {
    if (onRefreshCase && caseData?.case_id) {
      onRefreshCase(caseData.case_id);
    }
  };

  const handleCaseUpdated = (updated) => {
    if (onRefreshCase && caseData?.case_id) {
      onRefreshCase(caseData.case_id);
    }
  };

  const handleArchiveCase = async () => {
    try {
      setArchivingInProgress(true);
      await api.archiveCase(caseData.case_id);
      setIsArchivingConfirmOpen(false);
      if (onRefreshCase) {
        onRefreshCase(caseData.case_id);
      }
    } catch (err) {
      console.error('Failed to archive case:', err);
      alert('Archival error: ' + err.message);
    } finally {
      setArchivingInProgress(false);
    }
  };

  const handleRestoreCase = async () => {
    try {
      await api.updateCase(caseData.case_id, {
        title: caseData.title,
        incident_location: caseData.incident_location,
        priority: caseData.priority,
        status: 'OPEN'
      });
      if (onRefreshCase) {
        onRefreshCase(caseData.case_id);
      }
    } catch (err) {
      console.error('Failed to restore case:', err);
      alert('Restore error: ' + err.message);
    }
  };

  const isArchived = status === 'ARCHIVED';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Navigation & Context Top Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.75rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {(onBack || onNavigateTab) && (
            <button
              onClick={() => onBack ? onBack() : onNavigateTab('investigations')}
              className="btn-ghost"
              style={{ padding: '0.35rem 0.65rem', height: '32px' }}
            >
              <ChevronLeft size={16} />
              <span>Back to Directory</span>
            </button>
          )}
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Investigation Dossier Workspace
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Last modified: {updated_at ? new Date(updated_at).toLocaleString() : 'Recently'}
          </span>
        </div>
      </div>

      {/* Master Case Header Banner */}
      <div className="forensic-card" style={{
        borderLeft: priority === 'CRITICAL' ? '3px solid var(--status-danger)' :
                    priority === 'HIGH' ? '3px solid var(--status-warning)' :
                    '3px solid var(--accent-primary)',
        padding: '1.5rem 1.75rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.25rem' }}>
          <div style={{ flex: '1 1 340px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <span className="mono" style={{ fontSize: '0.82rem', color: 'var(--accent-primary)', fontWeight: '700' }}>
                CASE FILE #{case_number}
              </span>
              <span className={`badge ${priority === 'CRITICAL' ? 'badge-critical' : 'badge-high'}`}>
                {priority} PRIORITY
              </span>
              <span className={`badge ${isArchived ? 'badge-medium' : status === 'CLOSED' ? 'badge-verified' : 'badge-open'}`}>
                {status}
              </span>
            </div>
            <h2 style={{
              fontSize: '1.45rem',
              fontWeight: '700',
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
              margin: '0 0 0.45rem 0'
            }}>
              {title}
            </h2>
            <p style={{
              fontSize: '0.85rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
              maxWidth: '840px',
              margin: 0
            }}>
              {description || 'No detailed docket description provided.'}
            </p>
          </div>

          {/* Action Triggers */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="btn-secondary"
              style={{ height: '34px', fontSize: '0.78rem' }}
              title="Edit investigation details and status"
            >
              <span>Edit Details</span>
            </button>

            {isArchived ? (
              <button
                onClick={handleRestoreCase}
                className="btn-outline"
                style={{ height: '34px', fontSize: '0.78rem' }}
                title="Restore case to active status"
              >
                <span>Restore Case</span>
              </button>
            ) : (
              <button
                onClick={() => setIsArchivingConfirmOpen(true)}
                className="btn-outline"
                style={{ height: '34px', fontSize: '0.78rem' }}
                title="Archive case safely"
              >
                <span>Archive</span>
              </button>
            )}

            <button
              onClick={() => setIsAddEvidenceOpen(true)}
              className="btn-primary"
              style={{ height: '34px', fontSize: '0.78rem' }}
              title="Add Evidence to this Investigation"
            >
              <PlusIcon size={14} />
              <span>Add Evidence</span>
            </button>

            {onExploreGraph && (
              <button
                onClick={onExploreGraph}
                className="btn-secondary"
                style={{ height: '34px', fontSize: '0.78rem' }}
              >
                <GraphIcon size={14} />
                <span>Graph Analysis</span>
              </button>
            )}

            {onOpenReport && (
              <button
                onClick={onOpenReport}
                className="btn-secondary"
                style={{ height: '34px', fontSize: '0.78rem' }}
              >
                <ReportIcon size={14} />
                <span>Export Dossier</span>
              </button>
            )}
          </div>
        </div>

        {/* Master Case Metadata Ribbon */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: '1rem',
          marginTop: '1.25rem',
          paddingTop: '1rem',
          borderTop: '1px solid var(--border-subtle)',
          fontSize: '0.78rem'
        }}>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
              Incident Timestamp
            </div>
            <div style={{ color: 'var(--text-primary)', fontWeight: '500' }}>
              {incident_date ? new Date(incident_date).toLocaleString() : 'N/A'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
              Primary Location
            </div>
            <div style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{incident_location || 'Jurisdiction Core'}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
              Lead Detective
            </div>
            <div style={{ color: 'var(--text-primary)', fontWeight: '500' }}>
              {lead_officer_name || 'Assigned Detective'} ({lead_officer_badge || 'DET-8841'})
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
              Dossier Ingestion
            </div>
            <div className="mono" style={{ color: 'var(--accent-primary)', fontWeight: '600' }}>
              {suspects.length} Suspects • {victims.length} Victims • {evidence.length} Evidence
            </div>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div style={{
        display: 'flex',
        gap: '0.35rem',
        borderBottom: '1px solid var(--border-default)',
        paddingBottom: '0.5rem',
        flexWrap: 'wrap'
      }}>
        {[
          { key: 'overview', label: `Overview (${suspects.length + victims.length + witnesses.length + evidence.length})` },
          { key: 'suspects', label: `Persons of Interest (${suspects.length})` },
          { key: 'victims', label: `Victims (${victims.length})` },
          { key: 'witnesses', label: `Witnesses (${witnesses.length})` },
          { key: 'evidence', label: `Evidence Items (${evidence.length})` },
          { key: 'timeline', label: `Incident Timelines (${timelines.length})` }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveSubTab(tab.key)}
            className={activeSubTab === tab.key ? 'btn-primary' : 'btn-secondary'}
            style={{ fontSize: '0.75rem', height: '30px', padding: '0 0.75rem' }}
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
            <h3 style={{ fontSize: '0.85rem', color: 'var(--status-danger)', textTransform: 'uppercase', marginBottom: '0.75rem', fontWeight: '700' }}>
              👤 Persons of Interest ({suspects.length})
            </h3>
            {suspects.length === 0 ? (
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '0.5rem' }}>
                No suspects logged yet for this investigation.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {suspects.map(s => (
                  <div key={s.suspect_id} style={{ backgroundColor: 'var(--bg-input)', padding: '0.6rem 0.75rem', borderRadius: 'var(--radius-control)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: '600', fontSize: '0.82rem', color: 'var(--text-primary)' }}>{s.full_name}</span>
                      <span className="badge badge-critical" style={{ fontSize: '0.62rem' }}>{s.status}</span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                      Alias: &ldquo;{s.alias || 'None'}&rdquo; • Phone: {s.phone_number || 'Unknown'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Victims & Witnesses Brief */}
          <div className="forensic-card">
            <h3 style={{ fontSize: '0.85rem', color: 'var(--accent-primary)', textTransform: 'uppercase', marginBottom: '0.75rem', fontWeight: '700' }}>
              🎯 Victims & Witnesses ({victims.length + witnesses.length})
            </h3>
            {victims.length === 0 && witnesses.length === 0 ? (
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '0.5rem' }}>
                No victims or witnesses recorded yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {victims.map(v => (
                  <div key={v.victim_id} style={{ backgroundColor: 'var(--bg-input)', padding: '0.6rem 0.75rem', borderRadius: 'var(--radius-control)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: '600', fontSize: '0.82rem', color: 'var(--text-primary)' }}>{v.full_name} (Victim)</span>
                      <span className="badge badge-critical" style={{ fontSize: '0.62rem' }}>{v.condition_status}</span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{v.statement}</div>
                  </div>
                ))}
                {witnesses.map(w => (
                  <div key={w.witness_id} style={{ backgroundColor: 'var(--bg-input)', padding: '0.6rem 0.75rem', borderRadius: 'var(--radius-control)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: '600', fontSize: '0.82rem', color: 'var(--text-primary)' }}>{w.full_name} (Witness)</span>
                      <span className="badge badge-verified" style={{ fontSize: '0.62rem' }}>Credibility: {Math.round((w.credibility_score || 0.8) * 100)}%</span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{w.statement}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Evidence Highlight Brief */}
          <div className="forensic-card">
            <h3 style={{ fontSize: '0.85rem', color: 'var(--status-warning)', textTransform: 'uppercase', marginBottom: '0.75rem', fontWeight: '700' }}>
              📦 Registered Evidence ({evidence.length})
            </h3>
            {evidence.length === 0 ? (
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '0.5rem' }}>
                No forensic evidence logged yet. Click &ldquo;Add Evidence&rdquo; to begin ingestion.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {evidence.slice(0, 4).map(e => (
                  <div key={e.evidence_id} style={{ backgroundColor: 'var(--bg-input)', padding: '0.6rem 0.75rem', borderRadius: 'var(--radius-control)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--status-warning)', fontWeight: '700' }}>{e.tracking_code}</span>
                      <span className={`badge ${e.verification_status === 'CONFIRMED_FACT' ? 'badge-verified' : 'badge-unverified'}`} style={{ fontSize: '0.62rem' }}>
                        {e.verification_status}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-primary)', marginTop: '0.2rem' }}>{e.title}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Suspects Complete */}
      {activeSubTab === 'suspects' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
          {suspects.length === 0 ? (
            <div className="forensic-card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              No suspects logged for this case file.
            </div>
          ) : (
            suspects.map(s => (
              <div key={s.suspect_id} className="forensic-card" style={{ borderLeft: '3px solid var(--status-danger)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>{s.full_name}</h3>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '0.15rem' }}>
                      ALIAS: &ldquo;{s.alias || 'N/A'}&rdquo; • ID #{s.suspect_id}
                    </div>
                  </div>
                  <span className="badge badge-critical">{s.status}</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem', fontSize: '0.75rem', marginTop: '0.65rem', color: 'var(--text-secondary)' }}>
                  <div><strong>Age/Gender:</strong> {s.age || 'N/A'} / {s.gender}</div>
                  <div><strong>Phone:</strong> {s.phone_number || 'Unlisted'}</div>
                  <div style={{ gridColumn: 'span 2' }}><strong>Address:</strong> {s.last_known_address || 'Unknown'}</div>
                  <div style={{ gridColumn: 'span 2' }}><strong>Identifying Features:</strong> {s.identifying_features || 'None documented'}</div>
                </div>

                {s.notes && (
                  <div style={{ backgroundColor: 'var(--bg-input)', padding: '0.6rem', borderRadius: 'var(--radius-control)', marginTop: '0.65rem', fontSize: '0.75rem', border: '1px solid var(--border-default)' }}>
                    <strong>Investigator Intelligence: </strong>{s.notes}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 3: Victims Complete */}
      {activeSubTab === 'victims' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
          {victims.length === 0 ? (
            <div className="forensic-card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              No victim records cataloged for this case file.
            </div>
          ) : (
            victims.map(v => (
              <div key={v.victim_id} className="forensic-card" style={{ borderLeft: '3px solid var(--accent-primary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>{v.full_name}</h3>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '0.15rem' }}>
                      VICTIM RECORD #{v.victim_id}
                    </div>
                  </div>
                  <span className="badge badge-critical">{v.condition_status}</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem', lineHeight: 1.45 }}>
                  <strong>Victim Statement / Condition: </strong>{v.statement || 'No statement taken.'}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 4: Witnesses Complete */}
      {activeSubTab === 'witnesses' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
          {witnesses.length === 0 ? (
            <div className="forensic-card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              No witness records logged for this case file.
            </div>
          ) : (
            witnesses.map(w => (
              <div key={w.witness_id} className="forensic-card" style={{ borderLeft: '3px solid var(--status-success)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>{w.full_name}</h3>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '0.15rem' }}>
                      WITNESS ID #{w.witness_id} • Phone: {w.phone_number || 'N/A'}
                    </div>
                  </div>
                  <span className="badge badge-verified">
                    Credibility: {Math.round((w.credibility_score || 0.8) * 100)}%
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem', lineHeight: 1.45 }}>
                  <strong>Deposition Statement: </strong>{w.statement || 'No statement recorded.'}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 5: Evidence Items Complete */}
      {activeSubTab === 'evidence' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>
              Master Forensic Evidence Log ({evidence.length} Records)
            </span>
            <button
              onClick={() => setIsAddEvidenceOpen(true)}
              className="btn-primary"
              style={{ fontSize: '0.75rem', height: '32px' }}
            >
              <PlusIcon size={14} />
              <span>Add Evidence</span>
            </button>
          </div>

          {evidence.length === 0 ? (
            <div className="forensic-card" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
              No forensic evidence items logged yet for this investigation.
            </div>
          ) : (
            <div className="forensic-card" style={{ padding: '0.5rem 0' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-default)', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase' }}>
                    <th style={{ padding: '0.65rem 1rem' }}>Tracking Code</th>
                    <th style={{ padding: '0.65rem 1rem' }}>Title & Description</th>
                    <th style={{ padding: '0.65rem 1rem' }}>Category</th>
                    <th style={{ padding: '0.65rem 1rem' }}>Source Provenance</th>
                    <th style={{ padding: '0.65rem 1rem' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {evidence.map(e => (
                    <tr key={e.evidence_id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td className="mono" style={{ padding: '0.75rem 1rem', color: 'var(--accent-primary)', fontWeight: '600' }}>
                        {e.tracking_code}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{e.title}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{e.description}</div>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>
                        {e.category}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>
                        {e.source || 'UNKNOWN'}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span className={`badge ${e.verification_status === 'CONFIRMED_FACT' ? 'badge-verified' : 'badge-unverified'}`} style={{ fontSize: '0.62rem' }}>
                          {e.verification_status ? e.verification_status.replace(/_/g, ' ') : 'OBSERVATION'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 6: Timelines Complete */}
      {activeSubTab === 'timeline' && (
        <div className="forensic-card" style={{ padding: '0.5rem 0' }}>
          {timelines.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
              No chronological timeline incidents recorded for this case.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-default)', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '0.65rem 1rem' }}>Timestamp</th>
                  <th style={{ padding: '0.65rem 1rem' }}>Entity</th>
                  <th style={{ padding: '0.65rem 1rem' }}>Incident Details</th>
                  <th style={{ padding: '0.65rem 1rem' }}>Location</th>
                  <th style={{ padding: '0.65rem 1rem' }}>Verification</th>
                </tr>
              </thead>
              <tbody>
                {timelines.map(t => (
                  <tr key={t.timeline_id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td className="mono" style={{ padding: '0.75rem 1rem', color: 'var(--accent-primary)' }}>
                      {t.event_timestamp ? new Date(t.event_timestamp).toLocaleString() : 'N/A'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span className="mono" style={{ fontSize: '0.72rem' }}>{t.entity_type} #{t.entity_id}</span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{t.event_title}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t.event_description}</div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>{t.location || 'N/A'}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span className={`badge ${t.is_verified || t.status === 'CONFIRMED_FACT' ? 'badge-verified' : 'badge-unverified'}`} style={{ fontSize: '0.62rem' }}>
                        {t.status || 'LOGGED'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
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

      {/* Edit Case Modal */}
      <EditCaseModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        caseData={caseData}
        onCaseUpdated={handleCaseUpdated}
      />

      {/* Archival Safety Confirmation Dialog */}
      {isArchivingConfirmOpen && (
        <div
          className="modal-backdrop"
          onClick={() => !archivingInProgress && setIsArchivingConfirmOpen(false)}
        >
          <div
            className="modal-sheet"
            role="dialog"
            style={{ maxWidth: '480px', padding: '1.75rem' }}
          >
            <h2 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 0.5rem 0' }}>
              Archive Case #{case_number}?
            </h2>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 1rem 0' }}>
              Archiving transfers <strong>{title}</strong> to bureau cold storage. All forensic evidence, audit logs, and timelines will be safely preserved, and the case can be restored at any time.
            </p>
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.65rem',
              paddingTop: '1rem',
              borderTop: '1px solid var(--border-subtle)'
            }}>
              <button
                type="button"
                onClick={() => setIsArchivingConfirmOpen(false)}
                disabled={archivingInProgress}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleArchiveCase}
                disabled={archivingInProgress}
                className="btn-danger"
              >
                {archivingInProgress ? 'Archiving...' : 'Confirm Archival'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

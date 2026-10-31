import React, { useState } from 'react';

export default function InvestigativeLeadsPanel({ leads = [], onUpdateStatus }) {
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [localStatuses, setLocalStatuses] = useState({});

  const handleStatusChange = (leadId, newStatus) => {
    setLocalStatuses(prev => ({ ...prev, [leadId]: newStatus }));
    if (onUpdateStatus) {
      onUpdateStatus(leadId, newStatus);
    }
  };

  const filteredLeads = leads.filter(lead => {
    const current = localStatuses[lead.lead_id] || lead.lead_status || 'OPEN';
    if (statusFilter !== 'ALL' && current !== statusFilter) return false;
    return true;
  });

  const getScoreColor = (score) => {
    if (score >= 85) return 'var(--accent-red)';
    if (score >= 70) return 'var(--accent-orange)';
    if (score >= 50) return 'var(--status-medium)';
    return 'var(--status-low)';
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'OPEN': return 'badge-open';
      case 'ASSIGNED': return 'badge-medium';
      case 'IN_PROGRESS': return 'badge-high';
      case 'VERIFIED_LEAD': return 'badge-verified';
      case 'CLOSED': return 'badge-low';
      default: return 'badge-open';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header and Filter Controls */}
      <div className="forensic-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.2rem' }}>🎯</span>
            <h2 style={{ fontSize: '1.1rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Investigative Leads & Action Hypotheses
            </h2>
            <span className="badge badge-high">{leads.length} Actionable Leads</span>
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Ranked by composite evidentiary strength: (0.40 × Confidence) + (0.30 × Centrality) + (0.30 × Gap Criticality).
          </p>
        </div>

        <div>
          <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>
            Workflow Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              backgroundColor: 'var(--bg-input)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-default)',
              padding: '0.35rem 0.6rem',
              borderRadius: '4px',
              fontSize: '0.75rem'
            }}
          >
            <option value="ALL">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="VERIFIED_LEAD">Verified Lead</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
      </div>

      {/* Leads Grid */}
      {filteredLeads.length === 0 ? (
        <div className="forensic-card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          No investigative leads match the active filter.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredLeads.map((lead, idx) => {
            const rawScore = lead.score || lead.priority_score || 70.0;
            const scoreNum = parseFloat(rawScore);
            const scoreColor = getScoreColor(scoreNum);
            const status = localStatuses[lead.lead_id] || lead.lead_status || 'OPEN';

            return (
              <div
                key={lead.lead_id || idx}
                className="forensic-card"
                style={{
                  borderLeft: `4px solid ${scoreColor}`
                }}
              >
                {/* Top Row: Title, Priority Score & Status */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                      <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--accent-orange)' }}>
                        LEAD #{lead.lead_id || (idx + 1)}
                      </span>
                      <span className={`badge ${getStatusBadge(status)}`}>
                        {status.replace(/_/g, ' ')}
                      </span>
                      {lead.strength && (
                        <span style={{
                          fontSize: '0.68rem',
                          fontFamily: 'var(--font-mono)',
                          padding: '0.1rem 0.4rem',
                          borderRadius: '3px',
                          border: `1px solid ${scoreColor}`,
                          color: scoreColor
                        }}>
                          {lead.strength}
                        </span>
                      )}
                    </div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                      {lead.title}
                    </h3>
                  </div>

                  {/* Score Meter */}
                  <div style={{ minWidth: '130px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'baseline', gap: '0.3rem' }}>
                      <span style={{ fontSize: '1.25rem', fontWeight: '700', color: scoreColor, fontFamily: 'var(--font-mono)' }}>
                        {scoreNum.toFixed(1)}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>/ 100</span>
                    </div>
                    {/* Visual Progress Bar */}
                    <div style={{
                      width: '100%',
                      height: '5px',
                      backgroundColor: 'var(--bg-input)',
                      borderRadius: '3px',
                      overflow: 'hidden',
                      marginTop: '0.2rem'
                    }}>
                      <div style={{
                        width: `${Math.min(scoreNum, 100)}%`,
                        height: '100%',
                        backgroundColor: scoreColor,
                        borderRadius: '3px'
                      }} />
                    </div>
                  </div>
                </div>

                {/* Explanation / Hypothesis */}
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', lineHeight: 1.45 }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Reasoning / Hypothesis: </strong>
                  {lead.explanation || lead.hypothesis}
                </div>

                {/* Relational & Gap Context Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '0.75rem',
                  backgroundColor: 'var(--bg-input)',
                  padding: '0.75rem',
                  borderRadius: '4px',
                  border: '1px solid var(--border-default)',
                  fontSize: '0.78rem',
                  marginBottom: '0.85rem'
                }}>
                  {lead.supporting_relationships && (
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase' }}>
                        🔗 Supporting Relational Proof
                      </div>
                      <div style={{ color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                        {lead.supporting_relationships}
                      </div>
                    </div>
                  )}

                  {lead.missing_information && (
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase' }}>
                        🧩 Evidence Gap Addressed
                      </div>
                      <div style={{ color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                        {lead.missing_information}
                      </div>
                    </div>
                  )}
                </div>

                {/* Recommended Next Action & Workflow Transition */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.6rem' }}>
                  <div style={{ flex: 1, minWidth: '260px' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--accent-orange)', fontWeight: '700' }}>
                      Suggested Next Investigative Action:
                    </span>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', marginTop: '0.1rem' }}>
                      {lead.suggested_step || lead.recommended_action}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Update:</span>
                    <select
                      value={status}
                      onChange={(e) => handleStatusChange(lead.lead_id, e.target.value)}
                      style={{
                        backgroundColor: 'var(--bg-card)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-default)',
                        padding: '0.3rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.72rem'
                      }}
                    >
                      <option value="OPEN">OPEN</option>
                      <option value="ASSIGNED">ASSIGNED</option>
                      <option value="IN_PROGRESS">IN PROGRESS</option>
                      <option value="VERIFIED_LEAD">VERIFIED LEAD</option>
                      <option value="CLOSED">CLOSED</option>
                    </select>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

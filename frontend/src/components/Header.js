import React from 'react';

/**
 * @component Header
 * @description Top header bar positioned at the top of the main content area.
 * Contains breadcrumbs, active case context badge, quick action buttons, and mobile menu trigger.
 * Does NOT contain the horizontal navigation tabs (now housed in the Left Sidebar).
 */
export default function Header({
  officer,
  activeTab,
  selectedCaseId,
  caseData,
  onOpenCreateCase,
  onOpenReport,
  onOpenNotifications,
  unreadCount = 0,
  onToggleMobileSidebar,
  isMobile
}) {
  const currentOfficer = officer?.officer || officer?.data || officer;
  const isAuthenticated = Boolean(
    currentOfficer &&
    (currentOfficer.badge_number || currentOfficer.officer_id || currentOfficer.full_name)
  );

  // Map active tab to a readable breadcrumb label
  const tabBreadcrumbMap = {
    dashboard: { section: 'CASETHREAD', title: 'Investigation Dashboard' },
    dossier: { section: 'INVESTIGATIONS', title: 'Case Dossier & Entities' },
    collaboration: { section: 'OPERATIONS', title: 'Multi-Officer Collaboration' },
    vault: { section: 'INTELLIGENCE', title: 'Digital Evidence Vault' },
    geospatial: { section: 'INTELLIGENCE', title: 'Geospatial Intelligence Map' },
    integrity: { section: 'OPERATIONS', title: 'Evidence Integrity & Custody' },
    graph: { section: 'INTELLIGENCE', title: 'Evidence Relationship Graph' },
    gaps: { section: 'INTELLIGENCE', title: 'Evidence Gap Analysis' },
    timeline: { section: 'INTELLIGENCE', title: 'Chronological Timeline' },
    leads: { section: 'INTELLIGENCE', title: 'Investigative Leads Ranking' },
    validation: { section: 'SYSTEM', title: 'Forensic Validation Benchmarks' }
  };

  const breadcrumb = tabBreadcrumbMap[activeTab] || { section: 'CASETHREAD', title: 'Forensic Workspace' };

  return (
    <header
      style={{
        backgroundColor: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-default)',
        padding: '0.75rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem',
        position: 'sticky',
        top: 0,
        zIndex: 90
      }}
      aria-label="Main Application Header"
    >
      {/* Left: Mobile Drawer Trigger & Current Section Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
        {/* Mobile Hamburger Trigger */}
        {isMobile && (
          <button
            onClick={onToggleMobileSidebar}
            className="btn-secondary"
            style={{
              padding: '0.35rem 0.55rem',
              fontSize: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            aria-label="Open navigation sidebar"
            title="Open navigation menu"
          >
            ☰
          </button>
        )}

        {/* Section & Page Title Breadcrumb */}
        <div>
          <div
            style={{
              fontSize: '0.65rem',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <span>{breadcrumb.section}</span>
            <span style={{ color: 'var(--border-highlight)' }}>/</span>
            <span style={{ color: 'var(--accent-orange)' }}>{breadcrumb.title}</span>
          </div>
          <h2
            style={{
              fontSize: '1.05rem',
              fontWeight: '800',
              color: 'var(--text-primary)',
              lineHeight: 1.2,
              marginTop: '0.1rem'
            }}
          >
            {breadcrumb.title}
          </h2>
        </div>
      </div>

      {/* Center / Right: Active Case Context Badge & Quick Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        {isAuthenticated ? (
          <>
            {/* Active Case Context Chip */}
            {caseData?.case_number && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-subtle)',
                  padding: '0.3rem 0.65rem',
                  borderRadius: '4px',
                  fontSize: '0.75rem'
                }}
                title={`Active Case: ${caseData.title}`}
              >
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--status-verified)',
                    boxShadow: '0 0 6px var(--status-verified)'
                  }}
                />
                <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>CASE:</span>
                <span className="mono" style={{ color: 'var(--accent-orange)', fontWeight: '700' }}>
                  {caseData.case_number}
                </span>
                <span className={`badge ${caseData.priority === 'CRITICAL' ? 'badge-critical' : 'badge-high'}`} style={{ fontSize: '0.62rem', padding: '0.1rem 0.35rem' }}>
                  {caseData.priority || 'MEDIUM'}
                </span>
              </div>
            )}

            {/* Quick Action: New Case */}
            {onOpenCreateCase && (
              <button
                onClick={onOpenCreateCase}
                className="btn-primary"
                style={{
                  fontSize: '0.72rem',
                  padding: '0.35rem 0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  fontWeight: '700'
                }}
                title="Create a new criminal investigation case"
              >
                <span>➕</span>
                <span>NEW CASE</span>
              </button>
            )}

            {/* Quick Action: Export Dossier Report */}
            {onOpenReport && (
              <button
                onClick={onOpenReport}
                className="btn-secondary"
                style={{
                  fontSize: '0.72rem',
                  padding: '0.35rem 0.7rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem'
                }}
                title="Export comprehensive case dossier report (HTML / JSON)"
              >
                <span>📄</span>
                <span>REPORT</span>
              </button>
            )}

            {/* Notifications Bell */}
            {onOpenNotifications && (
              <button
                onClick={onOpenNotifications}
                className="btn-secondary"
                style={{
                  fontSize: '0.72rem',
                  padding: '0.35rem 0.65rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  position: 'relative'
                }}
                title="Investigation Notifications & Alerts"
                aria-label="Investigation Notifications"
              >
                <span>🔔</span>
                {unreadCount > 0 && (
                  <span
                    style={{
                      backgroundColor: 'var(--accent-red)',
                      color: '#ffffff',
                      fontSize: '0.6rem',
                      fontWeight: '800',
                      borderRadius: '10px',
                      padding: '0.1rem 0.35rem',
                      lineHeight: 1
                    }}
                  >
                    {unreadCount}
                  </span>
                )}
              </button>
            )}
          </>
        ) : (
          <span className="badge badge-critical" style={{ letterSpacing: '0.5px' }}>
            AUTHENTICATION REQUIRED
          </span>
        )}
      </div>
    </header>
  );
}

import React from 'react';
import { MenuIcon, PlusIcon, ReportIcon, BellIcon, JarvisIcon } from './icons/Icons';

/**
 * @component Header
 * @description Apple-inspired minimalist top header bar for CASETHREAD.
 * Features: Clean typographic breadcrumb, active case context chip,
 * vector action triggers, and responsive mobile drawer toggle.
 */
export default function Header({
  officer,
  activeTab,
  selectedCaseId,
  caseData,
  onOpenCreateCase,
  onOpenReport,
  onOpenNotifications,
  onOpenVoiceAssistant,
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
    dashboard: { section: 'Platform', title: 'Dashboard' },
    investigations: { section: 'Investigations', title: 'Investigations Directory' },
    dossier: { section: 'Investigations', title: 'Case Dossier & Entities' },
    collaboration: { section: 'Operations', title: 'Multi-Officer Collaboration' },
    vault: { section: 'Intelligence', title: 'Evidence Vault & Files' },
    geospatial: { section: 'Intelligence', title: 'Geospatial Intelligence Map' },
    integrity: { section: 'Operations', title: 'Evidence Integrity & Custody' },
    graph: { section: 'Intelligence', title: 'Evidence Relationship Graph' },
    gaps: { section: 'Intelligence', title: 'Evidence Gap Analysis' },
    timeline: { section: 'Intelligence', title: 'Chronological Timeline' },
    intelligence: { section: 'Intelligence', title: 'AI Investigation Intelligence' },
    voice_assistant: { section: 'Intelligence', title: 'JARVIS Conversational Voice AI' },
    cross_case_graph: { section: 'Intelligence', title: 'Cross-Case Graph & Pattern Discovery' },
    leads: { section: 'Intelligence', title: 'Investigative Leads Ranking' },
    lab: { section: 'System', title: 'Investigation Algorithm Lab' },
    validation: { section: 'System', title: 'Forensic Validation Benchmarks' }
  };

  const breadcrumb = tabBreadcrumbMap[activeTab] || { section: 'Platform', title: 'Forensic Workspace' };

  return (
    <header
      style={{
        backgroundColor: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-default)',
        padding: '0 1.5rem',
        height: '56px',
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {/* Mobile Hamburger Trigger */}
        {isMobile && (
          <button
            onClick={onToggleMobileSidebar}
            className="btn-secondary"
            style={{
              width: '32px',
              height: '32px',
              padding: 0,
              borderRadius: 'var(--radius-control)'
            }}
            aria-label="Open navigation sidebar"
            title="Open navigation menu"
          >
            <MenuIcon size={16} />
          </button>
        )}

        {/* Section & Page Title Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              fontWeight: '500'
            }}
          >
            {breadcrumb.section}
          </span>
          <span style={{ color: 'var(--border-highlight)', fontSize: '0.8rem' }}>/</span>
          <h2
            style={{
              fontSize: '0.875rem',
              fontWeight: '600',
              color: 'var(--text-primary)',
              lineHeight: 1
            }}
          >
            {breadcrumb.title}
          </h2>
        </div>
      </div>

      {/* Center / Right: Active Case Context Badge & Quick Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
        {isAuthenticated ? (
          <>
            {/* Active Case Context Chip */}
            {caseData?.case_number && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)',
                  padding: '0.3rem 0.65rem',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '0.75rem',
                  height: '32px'
                }}
                title={`Active Case: ${caseData.title}`}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--status-success)'
                  }}
                />
                <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: '500' }}>CASE</span>
                <span className="mono" style={{ color: 'var(--text-primary)', fontWeight: '600', fontSize: '0.75rem' }}>
                  {caseData.case_number}
                </span>
                <span
                  className={`badge ${caseData.priority === 'CRITICAL' ? 'badge-critical' : 'badge-high'}`}
                  style={{ fontSize: '0.625rem', padding: '0.1rem 0.45rem' }}
                >
                  {caseData.priority || 'MEDIUM'}
                </span>
              </div>
            )}

            {/* Quick Action: New Case */}
            {onOpenCreateCase && (
              <button
                onClick={onOpenCreateCase}
                className="btn-primary"
                style={{ height: '32px', fontSize: '0.78rem', padding: '0 0.75rem' }}
                title="Create a new criminal investigation case"
              >
                <PlusIcon size={14} />
                <span>New Case</span>
              </button>
            )}

            {/* Quick Action: Export Dossier Report */}
            {onOpenReport && (
              <button
                onClick={onOpenReport}
                className="btn-secondary"
                style={{ height: '32px', fontSize: '0.78rem', padding: '0 0.75rem' }}
                title="Export comprehensive case dossier report (HTML / JSON)"
              >
                <ReportIcon size={14} />
                <span>Dossier</span>
              </button>
            )}

            {/* Quick Action: JARVIS Voice Assistant Launcher */}
            {onOpenVoiceAssistant && (
              <button
                onClick={onOpenVoiceAssistant}
                className="btn-secondary"
                style={{
                  height: '32px',
                  fontSize: '0.78rem',
                  padding: '0 0.75rem',
                  backgroundColor: 'rgba(56, 189, 248, 0.1)',
                  borderColor: 'rgba(56, 189, 248, 0.35)',
                  color: '#38BDF8',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                title="Launch JARVIS Conversational AI Voice Assistant"
              >
                <JarvisIcon size={14} color="#38BDF8" />
                <span>JARVIS AI</span>
              </button>
            )}

            {/* Notifications Bell */}
            {onOpenNotifications && (
              <button
                onClick={onOpenNotifications}
                className="btn-secondary"
                style={{
                  width: '32px',
                  height: '32px',
                  padding: 0,
                  position: 'relative'
                }}
                title="Investigation Notifications & Alerts"
                aria-label="Investigation Notifications"
              >
                <BellIcon size={15} color="var(--text-secondary)" />
                {unreadCount > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '-2px',
                      right: '-2px',
                      backgroundColor: 'var(--status-danger)',
                      color: '#FFFFFF',
                      fontSize: '0.58rem',
                      fontWeight: '700',
                      borderRadius: 'var(--radius-pill)',
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
          <span className="badge badge-critical">
            Authentication Required
          </span>
        )}
      </div>
    </header>
  );
}

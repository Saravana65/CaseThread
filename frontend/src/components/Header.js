import React from 'react';
import { MenuIcon, PlusIcon, ReportIcon, BellIcon, JarvisIcon } from './icons/Icons';

/**
 * @component Header
 * @description Apple-inspired minimalist top header bar for CASETHREAD.
 * Features: Clean typographic breadcrumb, active case context chip,
 * theme toggle, vector action triggers, and responsive mobile drawer toggle.
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
  isMobile,
  theme = 'dark',
  onToggleTheme = null
}) {
  const currentOfficer = officer?.officer || officer?.data || officer;
  const isAuthenticated = Boolean(
    currentOfficer &&
    (currentOfficer.badge_number || currentOfficer.officer_id || currentOfficer.full_name)
  );

  // Map active tab to a readable breadcrumb label matching the 6 canonical sections
  const tabBreadcrumbMap = {
    ai_assistant: { section: 'Workspace', title: 'AI Investigation Assistant' },
    voice_assistant: { section: 'Workspace', title: 'AI Investigation Assistant' },
    investigations: { section: 'Cases', title: 'Investigations Directory' },
    dossier: { section: 'Cases', title: 'Case Master Dossier' },
    dashboard: { section: 'Cases', title: 'Investigations' },
    evidence: { section: 'Forensics', title: 'Evidence Management & Custody' },
    vault: { section: 'Forensics', title: 'Evidence Vault & Files' },
    integrity: { section: 'Forensics', title: 'Evidence Integrity & Hash Verification' },
    case_analysis: { section: 'Intelligence', title: 'Forensic Case Analysis & Graphs' },
    gaps: { section: 'Intelligence', title: 'Evidence Gap Analysis' },
    graph: { section: 'Intelligence', title: 'Native C Relational Graph' },
    cross_case_graph: { section: 'Intelligence', title: 'Cross-Case Pattern Discovery' },
    timeline: { section: 'Intelligence', title: 'Chronological Timeline' },
    leads: { section: 'Intelligence', title: 'Investigative Leads Ranking' },
    reports: { section: 'Documentation', title: 'Investigation Dossiers & Reports' },
    settings: { section: 'System', title: 'System Settings & Diagnostics' }
  };

  const breadcrumb = tabBreadcrumbMap[activeTab] || { section: 'Workspace', title: 'Forensic Workspace' };

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
                title={`Active Investigation: ${caseData.title}`}
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

            {/* Theme Toggle Button */}
            {onToggleTheme && (
              <button
                onClick={onToggleTheme}
                className="btn-secondary"
                style={{
                  height: '32px',
                  padding: '0 0.65rem',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
                aria-label="Toggle Theme"
              >
                <span>{theme === 'light' ? '🌙 Dark' : '☀️ Light'}</span>
              </button>
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

            {/* Quick Action: JARVIS Voice Assistant Overlay Launcher */}
            {onOpenVoiceAssistant && activeTab !== 'ai_assistant' && activeTab !== 'voice_assistant' && (
              <button
                onClick={onOpenVoiceAssistant}
                className="btn-secondary"
                style={{
                  height: '32px',
                  fontSize: '0.78rem',
                  padding: '0 0.75rem',
                  backgroundColor: 'rgba(56, 189, 248, 0.1)',
                  borderColor: 'rgba(56, 189, 248, 0.35)',
                  color: 'var(--accent-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                title="Open JARVIS AI Voice Overlay"
              >
                <JarvisIcon size={14} color="var(--accent-primary)" />
                <span>Voice AI</span>
              </button>
            )}
          </>
        ) : (
          <div
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)'
            }}
          >
            RESTRICTED ACCESS • OFFICIAL USE ONLY
          </div>
        )}
      </div>
    </header>
  );
}

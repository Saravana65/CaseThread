import React from 'react';
import {
  LogoMark,
  CasesIcon,
  NewCaseIcon,
  VaultIcon,
  GraphIcon,
  JarvisIcon,
  ReportIcon,
  SettingsIcon,
  ChevronLeft,
  ChevronRight,
  CloseIcon,
  SignOutIcon
} from './icons/Icons';

/**
 * @component Sidebar
 * @description Apple-inspired minimalist navigation sidebar for CASETHREAD (Phase 20).
 * Features: 6 canonical sections (AI Assistant, Investigations, Evidence, Case Analysis, Reports, Settings),
 * responsive desktop collapse (240px / 68px), mobile drawer overlay, theme toggle, and officer status.
 */
export default function Sidebar({
  isCollapsed,
  onToggleCollapse,
  activeTab,
  caseFilter = 'ALL',
  onSelectNav,
  officer,
  onLogout,
  isMobile,
  mobileOpen,
  onCloseMobile,
  theme = 'dark',
  onToggleTheme = null
}) {
  const currentOfficer = officer?.officer || officer?.data || officer || {};
  const officerName = currentOfficer.full_name || 'Alexander Cross';
  const officerBadge = currentOfficer.badge_number || 'DET-8841';
  const officerRole = (currentOfficer.role || currentOfficer.rank_designation || 'LEAD_OFFICER').replace(/_/g, ' ');

  // The 6 canonical navigation sections for CaseThread
  const navigationItems = [
    {
      id: 'ai_assistant',
      tab: 'ai_assistant',
      label: 'AI Assistant',
      IconComponent: JarvisIcon,
      badge: 'VOICE & AI',
      tooltip: 'Conversational Voice & Intelligence Assistant'
    },
    {
      id: 'investigations',
      tab: 'investigations',
      label: 'Investigations',
      IconComponent: CasesIcon,
      tooltip: 'Investigation Dockets, Dossiers & Incident Roster'
    },
    {
      id: 'evidence',
      tab: 'evidence',
      label: 'Evidence',
      IconComponent: VaultIcon,
      tooltip: 'Evidence Vault, Cryptographic Hashes & Chain of Custody'
    },
    {
      id: 'case_analysis',
      tab: 'case_analysis',
      label: 'Case Analysis',
      IconComponent: GraphIcon,
      tooltip: 'Evidence Gap Analysis & Native C Graph Traversal'
    },
    {
      id: 'reports',
      tab: 'reports',
      label: 'Reports',
      IconComponent: ReportIcon,
      tooltip: 'Master Investigation Dossiers & Court Exports'
    },
    {
      id: 'settings',
      tab: 'settings',
      label: 'Settings',
      IconComponent: SettingsIcon,
      tooltip: 'System Configuration, Diagnostics & Appearance'
    }
  ];

  // Helper to determine if an item is currently selected
  const isItemActive = (item) => {
    if (item.tab === 'ai_assistant') {
      return activeTab === 'ai_assistant' || activeTab === 'voice_assistant';
    }
    if (item.tab === 'investigations') {
      return activeTab === 'investigations' || activeTab === 'dossier' || activeTab === 'dashboard';
    }
    if (item.tab === 'evidence') {
      return activeTab === 'evidence' || activeTab === 'vault' || activeTab === 'integrity';
    }
    if (item.tab === 'case_analysis') {
      return (
        activeTab === 'case_analysis' ||
        activeTab === 'gaps' ||
        activeTab === 'graph' ||
        activeTab === 'cross_case_graph' ||
        activeTab === 'timeline' ||
        activeTab === 'leads'
      );
    }
    if (item.tab === 'reports') {
      return activeTab === 'reports';
    }
    if (item.tab === 'settings') {
      return activeTab === 'settings';
    }
    return activeTab === item.tab;
  };

  const handleItemClick = (item) => {
    if (onSelectNav) {
      onSelectNav(item.tab, {
        subTab: item.subTab,
        caseFilter: item.caseFilter,
        action: item.action
      });
    }
    if (isMobile && onCloseMobile) {
      onCloseMobile();
    }
  };

  const sidebarWidth = isCollapsed ? '68px' : '240px';

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobile && mobileOpen && (
        <div
          onClick={onCloseMobile}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.72)',
            zIndex: 998,
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            transition: 'opacity 0.2s ease'
          }}
          aria-label="Close navigation drawer"
        />
      )}

      {/* Main Sidebar Container */}
      <aside
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: isMobile ? '260px' : sidebarWidth,
          backgroundColor: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border-default)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: isMobile ? 999 : 100,
          transition: 'width var(--transition-normal), transform var(--transition-normal)',
          transform: isMobile ? (mobileOpen ? 'translateX(0)' : 'translateX(-100%)') : 'none',
          boxShadow: isMobile && mobileOpen ? 'var(--shadow-elevated)' : 'none',
          overflow: 'hidden'
        }}
        aria-label="Investigation Navigation Sidebar"
      >
        {/* 1. Sidebar Brand Header */}
        <div
          style={{
            height: '56px',
            padding: isCollapsed ? '0 0.5rem' : '0 1rem',
            borderBottom: '1px solid var(--border-default)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'space-between',
            flexShrink: 0
          }}
        >
          {/* Logo & Brand Name */}
          <div
            onClick={() => handleItemClick({ tab: 'ai_assistant' })}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              cursor: 'pointer',
              userSelect: 'none',
              overflow: 'hidden',
              whiteSpace: 'nowrap'
            }}
            title="CaseThread AI Intelligence Platform"
          >
            <LogoMark size={22} color="var(--accent-primary)" />
            {!isCollapsed && (
              <div>
                <h1
                  style={{
                    fontSize: '0.95rem',
                    fontWeight: '700',
                    letterSpacing: '-0.02em',
                    color: 'var(--text-primary)',
                    lineHeight: 1.15
                  }}
                >
                  CaseThread
                </h1>
                <p
                  style={{
                    fontSize: '0.65rem',
                    color: 'var(--text-muted)',
                    letterSpacing: '0.02em',
                    fontWeight: '500'
                  }}
                >
                  Forensic Intelligence
                </p>
              </div>
            )}
          </div>

          {/* Desktop Collapse / Expand Toggle Button */}
          {!isMobile && (
            <button
              onClick={onToggleCollapse}
              className="btn-ghost"
              style={{
                width: '28px',
                height: '28px',
                padding: 0,
                borderRadius: 'var(--radius-control)',
                color: 'var(--text-secondary)',
                marginLeft: isCollapsed ? '0' : '0.5rem'
              }}
              title={isCollapsed ? 'Expand sidebar (Ctrl+[)' : 'Collapse sidebar (Ctrl+[)'}
              aria-label={isCollapsed ? 'Expand navigation sidebar' : 'Collapse navigation sidebar'}
            >
              {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>
          )}

          {/* Mobile Close Button */}
          {isMobile && (
            <button
              onClick={onCloseMobile}
              className="btn-ghost"
              style={{ width: '28px', height: '28px', padding: 0 }}
              aria-label="Close navigation drawer"
            >
              <CloseIcon size={16} />
            </button>
          )}
        </div>

        {/* 2. Primary Navigation Sections (6 canonical items) */}
        <nav
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: isCollapsed ? '0.75rem 0.35rem' : '0.85rem 0.65rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem'
          }}
        >
          {navigationItems.map((item) => {
            const active = isItemActive(item);
            const Icon = item.IconComponent;

            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item)}
                className={`sidebar-nav-item ${active ? 'active' : ''}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: isCollapsed ? '0.65rem' : '0.65rem 0.85rem',
                  borderRadius: 'var(--radius-control)',
                  border: active ? '1px solid var(--border-highlight)' : '1px solid transparent',
                  backgroundColor: active ? 'var(--bg-active)' : 'transparent',
                  color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'left',
                  transition: 'all var(--transition-fast)',
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                  position: 'relative'
                }}
                title={isCollapsed ? `${item.label} — ${item.tooltip}` : item.tooltip}
              >
                <span
                  style={{
                    color: active ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <Icon size={18} />
                </span>

                {!isCollapsed && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        fontSize: '0.82rem',
                        fontWeight: active ? '600' : '500',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {item.label}
                    </span>
                    {item.badge && (
                      <span
                        style={{
                          fontSize: '0.6rem',
                          padding: '1px 6px',
                          borderRadius: 'var(--radius-pill)',
                          backgroundColor: 'var(--accent-primary-dim)',
                          color: 'var(--accent-primary)',
                          fontWeight: '700',
                          letterSpacing: '0.04em'
                        }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}

          {/* Quick Action: New Investigation */}
          <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)' }}>
            <button
              onClick={() => handleItemClick({ action: 'create_case' })}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                padding: isCollapsed ? '0.65rem' : '0.55rem 0.75rem',
                borderRadius: 'var(--radius-control)',
                border: '1px solid var(--border-default)',
                backgroundColor: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                width: '100%',
                fontSize: '0.75rem',
                fontWeight: '600',
                justifyContent: isCollapsed ? 'center' : 'flex-start',
                transition: 'background-color var(--transition-fast)'
              }}
              title="Create New Investigation Docket"
            >
              <span style={{ color: 'var(--accent-primary)', display: 'flex' }}>
                <NewCaseIcon size={16} />
              </span>
              {!isCollapsed && <span>New Investigation</span>}
            </button>
          </div>
        </nav>

        {/* 3. Footer: Theme Toggle & Investigator Profile */}
        <div
          style={{
            padding: isCollapsed ? '0.65rem 0.35rem' : '0.75rem 0.85rem',
            borderTop: '1px solid var(--border-default)',
            backgroundColor: 'var(--bg-secondary)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            flexShrink: 0
          }}
        >
          {/* Theme Quick Toggle */}
          {onToggleTheme && !isCollapsed && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.35rem 0.5rem',
                borderRadius: 'var(--radius-control)',
                backgroundColor: 'var(--bg-elevated)',
                fontSize: '0.72rem',
                color: 'var(--text-secondary)'
              }}
            >
              <span>Appearance:</span>
              <button
                onClick={onToggleTheme}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--accent-primary)',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '0.72rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                {theme === 'light' ? '☀️ Light Mode' : '🌙 Dark Mode'}
              </button>
            </div>
          )}

          {/* Officer Details & Sign Out */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: isCollapsed ? 'center' : 'space-between',
              gap: '0.5rem'
            }}
          >
            {!isCollapsed ? (
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: '600',
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {officerName}
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: '0.68rem',
                    color: 'var(--text-muted)'
                  }}
                >
                  {officerBadge} • {officerRole}
                </div>
              </div>
            ) : (
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--bg-elevated)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.7rem',
                  fontWeight: '700',
                  color: 'var(--text-primary)'
                }}
                title={`${officerName} (${officerBadge})`}
              >
                {officerName.charAt(0)}
              </div>
            )}

            <button
              onClick={onLogout}
              className="btn-ghost"
              style={{
                width: '28px',
                height: '28px',
                padding: 0,
                borderRadius: 'var(--radius-control)',
                color: 'var(--status-danger)',
                flexShrink: 0
              }}
              title="Sign Out of Session"
              aria-label="Sign Out"
            >
              <SignOutIcon size={14} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

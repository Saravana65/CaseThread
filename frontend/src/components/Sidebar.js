import React from 'react';
import {
  LogoMark,
  DashboardIcon,
  CasesIcon,
  NewCaseIcon,
  ActiveIcon,
  SolvedIcon,
  VaultIcon,
  GraphIcon,
  TimelineIcon,
  GapsIcon,
  LeadsIcon,
  GeospatialIcon,
  OfficersIcon,
  TasksIcon,
  ReviewsIcon,
  ActivityIcon,
  ValidationIcon,
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
 * @description Apple-inspired minimalist navigation sidebar for CASETHREAD.
 * Features: Restrained color tokens, crisp vector SVG iconography, smooth transitions,
 * desktop collapsible drawer (240px / 68px), and mobile sheet overlay.
 */
export default function Sidebar({
  isCollapsed,
  onToggleCollapse,
  activeTab,
  activeSubTab = 'tasks',
  caseFilter = 'ALL',
  onSelectNav,
  officer,
  onLogout,
  isMobile,
  mobileOpen,
  onCloseMobile
}) {
  const currentOfficer = officer?.officer || officer?.data || officer || {};
  const officerName = currentOfficer.full_name || 'Alexander Cross';
  const officerBadge = currentOfficer.badge_number || 'DET-8841';
  const officerRole = (currentOfficer.role || currentOfficer.rank_designation || 'LEAD_OFFICER').replace(/_/g, ' ');

  // Navigation hierarchy structure with vector icons
  const navigationSections = [
    {
      heading: 'Platform',
      items: [
        {
          id: 'dashboard',
          tab: 'dashboard',
          caseFilter: 'ALL',
          label: 'Dashboard',
          IconComponent: DashboardIcon,
          tooltip: 'Dashboard & Incident Case Roster'
        }
      ]
    },
    {
      heading: 'Investigations',
      items: [
        {
          id: 'investigations',
          tab: 'investigations',
          label: 'Investigations',
          IconComponent: CasesIcon,
          tooltip: 'All Investigation Dockets & Archives'
        },
        {
          id: 'all_cases',
          tab: 'dossier',
          label: 'Case Dossier',
          IconComponent: ReportIcon,
          tooltip: 'Master Case Files & Entities'
        },
        {
          id: 'new_case',
          action: 'create_case',
          label: 'New Investigation',
          IconComponent: NewCaseIcon,
          tooltip: 'Initiate New Investigation File'
        },
        {
          id: 'active_cases',
          tab: 'investigations',
          caseFilter: 'ACTIVE',
          label: 'Active Cases',
          IconComponent: ActiveIcon,
          tooltip: 'Filter Active & Ongoing Investigations'
        },
        {
          id: 'solved_cases',
          tab: 'investigations',
          caseFilter: 'SOLVED',
          label: 'Solved Cases',
          IconComponent: SolvedIcon,
          tooltip: 'Filter Closed & Archived Investigations'
        }
      ]
    },
    {
      heading: 'Intelligence',
      items: [
        {
          id: 'vault',
          tab: 'vault',
          label: 'Evidence Vault',
          IconComponent: VaultIcon,
          tooltip: 'Secure Evidence Vault & Metadata Extraction'
        },
        {
          id: 'graph',
          tab: 'graph',
          label: 'Relationship Graph',
          IconComponent: GraphIcon,
          tooltip: 'C-Engine Dynamic Relational Graph & Traversals'
        },
        {
          id: 'timeline',
          tab: 'timeline',
          label: 'Timeline Analysis',
          IconComponent: TimelineIcon,
          tooltip: 'Chronological Events & Spatiotemporal Anomaly Detection'
        },
        {
          id: 'gaps',
          tab: 'gaps',
          label: 'Gap Intelligence',
          IconComponent: GapsIcon,
          tooltip: 'Phase 12 Evidence Gap Intelligence & Explainable Assistant'
        },
        {
          id: 'intelligence',
          tab: 'intelligence',
          label: 'AI Case Intelligence',
          IconComponent: ValidationIcon,
          tooltip: 'AI Precedent Search & Evidence-Grounded Reasoning'
        },
        {
          id: 'voice_assistant',
          tab: 'voice_assistant',
          label: 'JARVIS Voice AI',
          IconComponent: JarvisIcon,
          tooltip: 'Conversational Voice AI Assistant (Speech Recognition & Synthesis)'
        },
        {
          id: 'cross_case_graph',
          tab: 'cross_case_graph',
          label: 'Cross-Case Graph',
          IconComponent: GraphIcon,
          tooltip: 'Phase 17 Native C Multi-Jurisdiction Graph & Pattern Detection'
        },
        {
          id: 'leads',
          tab: 'leads',
          label: 'Investigative Leads',
          IconComponent: LeadsIcon,
          tooltip: 'Max-Heap Ranked Detective Action Items'
        },
        {
          id: 'geospatial',
          tab: 'geospatial',
          label: 'Geospatial Map',
          IconComponent: GeospatialIcon,
          tooltip: 'C Quadtree Spatial Index & Forensic Proximity Mapping'
        }
      ]
    },
    {
      heading: 'Operations',
      items: [
        {
          id: 'officers',
          tab: 'collaboration',
          subTab: 'team',
          label: 'Case Team',
          IconComponent: OfficersIcon,
          tooltip: 'Case Access Roster & Detective Workload'
        },
        {
          id: 'tasks',
          tab: 'collaboration',
          subTab: 'tasks',
          label: 'Investigation Tasks',
          IconComponent: TasksIcon,
          tooltip: 'Investigation Task Lifecycle & Dependencies DAG'
        },
        {
          id: 'reviews',
          tab: 'collaboration',
          subTab: 'reviews',
          label: 'Evidence Reviews',
          IconComponent: ReviewsIcon,
          tooltip: 'Forensic Review Queue & Hash Verifications'
        },
        {
          id: 'activity',
          tab: 'collaboration',
          subTab: 'activity',
          label: 'Activity Stream',
          IconComponent: ActivityIcon,
          tooltip: 'Cryptographic Event Stream & Audit Trail'
        }
      ]
    },
    {
      heading: 'System',
      items: [
        {
          id: 'lab',
          tab: 'lab',
          label: 'Investigation Lab',
          IconComponent: ValidationIcon,
          tooltip: 'Native C Algorithm Investigation Lab & ADS Showcase'
        },
        {
          id: 'validation',
          tab: 'validation',
          label: 'Algorithm Validation',
          IconComponent: ValidationIcon,
          tooltip: 'Academic Forensic Ground-Truth Benchmarks'
        },
        {
          id: 'reports',
          tab: 'reports',
          label: 'Report Center',
          IconComponent: ReportIcon,
          tooltip: 'Report Center & Multi-Format Document Export'
        },
        {
          id: 'settings',
          action: 'open_settings',
          label: 'System Diagnostics',
          IconComponent: SettingsIcon,
          tooltip: 'System Configuration, Diagnostics & Theme'
        }
      ]
    }
  ];

  // Helper to determine if an item is currently selected
  const isItemActive = (item) => {
    if (item.action) return false;

    if (item.tab === 'dashboard') {
      if (activeTab === 'dashboard') {
        if (item.caseFilter === 'ACTIVE') return caseFilter === 'ACTIVE';
        if (item.caseFilter === 'SOLVED') return caseFilter === 'SOLVED';
        return caseFilter === 'ALL' || !caseFilter;
      }
      return false;
    }

    if (item.tab === 'collaboration') {
      if (activeTab === 'collaboration') {
        return activeSubTab === item.subTab;
      }
      return false;
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
            onClick={() => handleItemClick({ tab: 'dashboard', caseFilter: 'ALL' })}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              cursor: 'pointer',
              userSelect: 'none',
              overflow: 'hidden',
              whiteSpace: 'nowrap'
            }}
            title="CASETHREAD Platform"
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
                    fontWeight: '400'
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

        {/* 2. Scrollable Navigation Menu Groups */}
        <nav
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: isCollapsed ? '0.5rem 0.35rem' : '0.65rem 0.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem'
          }}
        >
          {navigationSections.map((section, sIdx) => (
            <div key={section.heading || sIdx} style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
              {/* Section Heading */}
              {!isCollapsed ? (
                <div
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: '600',
                    color: 'var(--text-muted)',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    padding: '0.35rem 0.65rem 0.2rem',
                    userSelect: 'none'
                  }}
                >
                  {section.heading}
                </div>
              ) : (
                <div
                  style={{
                    height: '1px',
                    backgroundColor: 'var(--border-subtle)',
                    margin: '0.35rem 0.25rem'
                  }}
                />
              )}

              {/* Navigation Items */}
              {section.items.map((item) => {
                const active = isItemActive(item);
                const Icon = item.IconComponent;

                return (
                  <button
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: isCollapsed ? '0' : '0.65rem',
                      justifyContent: isCollapsed ? 'center' : 'flex-start',
                      width: '100%',
                      height: '34px',
                      padding: isCollapsed ? '0' : '0 0.65rem',
                      borderRadius: 'var(--radius-control)',
                      border: 'none',
                      backgroundColor: active ? 'var(--bg-elevated)' : 'transparent',
                      color: active ? '#FFFFFF' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: '0.8125rem',
                      fontWeight: active ? '600' : '400',
                      transition: 'background var(--transition-fast), color var(--transition-fast)',
                      position: 'relative'
                    }}
                    onMouseEnter={(e) => {
                      if (!active) {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                        e.currentTarget.style.color = 'var(--text-primary)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = 'var(--text-secondary)';
                      }
                    }}
                    title={isCollapsed ? `${item.label} — ${item.tooltip}` : item.tooltip}
                    aria-label={item.label}
                  >
                    {/* Active Accent Indicator Bar on Left */}
                    {active && (
                      <span
                        style={{
                          position: 'absolute',
                          left: '2px',
                          top: '7px',
                          bottom: '7px',
                          width: '3px',
                          borderRadius: '2px',
                          backgroundColor: 'var(--accent-primary)'
                        }}
                      />
                    )}

                    {/* Vector Icon */}
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: active ? 'var(--accent-primary)' : 'var(--text-secondary)',
                        transition: 'color var(--transition-fast)'
                      }}
                    >
                      <Icon size={16} />
                    </span>

                    {/* Label */}
                    {!isCollapsed && (
                      <span
                        style={{
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          flex: 1
                        }}
                      >
                        {item.label}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* 3. Bottom User Profile & Session Section */}
        <div
          style={{
            borderTop: '1px solid var(--border-default)',
            backgroundColor: 'var(--bg-secondary)',
            padding: isCollapsed ? '0.5rem 0.25rem' : '0.65rem 0.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.45rem',
            flexShrink: 0
          }}
        >
          {/* User Profile Summary */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: isCollapsed ? '0' : '0.6rem',
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              padding: isCollapsed ? '0.2rem 0' : '0.3rem 0.4rem',
              borderRadius: 'var(--radius-control)',
              backgroundColor: isCollapsed ? 'transparent' : 'rgba(255, 255, 255, 0.02)',
              border: isCollapsed ? 'none' : '1px solid var(--border-subtle)',
              overflow: 'hidden'
            }}
            title={isCollapsed ? `${officerName} (${officerBadge}) • ${officerRole}` : 'Active Detective Session'}
          >
            {/* Initials Avatar */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.72rem',
                  fontWeight: '600',
                  color: 'var(--text-primary)'
                }}
              >
                {officerName
                  .split(' ')
                  .map((n) => n[0])
                  .filter(Boolean)
                  .slice(0, 2)
                  .join('')
                  .toUpperCase() || 'CT'}
              </div>
              {/* Online Green Status Dot */}
              <span
                style={{
                  position: 'absolute',
                  bottom: '-1px',
                  right: '-1px',
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--status-success)',
                  border: '1.5px solid var(--bg-secondary)'
                }}
                title="Active Session"
              />
            </div>

            {/* Officer Details (Expanded) */}
            {!isCollapsed && (
              <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', flex: 1 }}>
                <div
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: '600',
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {officerName}
                </div>
                <div
                  style={{
                    fontSize: '0.67rem',
                    color: 'var(--text-muted)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {officerBadge} • {officerRole}
                </div>
              </div>
            )}
          </div>

          {/* Logout Action Button */}
          <button
            onClick={onLogout}
            className="btn-ghost"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              gap: isCollapsed ? '0' : '0.5rem',
              width: '100%',
              height: '32px',
              padding: isCollapsed ? '0' : '0 0.5rem',
              borderRadius: 'var(--radius-control)',
              color: 'var(--text-muted)',
              fontSize: '0.75rem',
              fontWeight: '500'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--status-danger)';
              e.currentTarget.style.backgroundColor = 'var(--status-danger-dim)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-muted)';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            title={isCollapsed ? 'Sign out of investigation session' : ''}
            aria-label="Sign out of investigation session"
          >
            <SignOutIcon size={14} />
            {!isCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>
    </>
  );
}

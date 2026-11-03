import React from 'react';

/**
 * @component Sidebar
 * @description Professional collapsible forensic navigation sidebar for CASETHREAD.
 * Supports desktop collapsible mode (250px / 72px) and mobile slide-out drawer mode.
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
  const officerRole = currentOfficer.role || currentOfficer.rank_designation || 'LEAD_OFFICER';

  // Navigation hierarchy structure
  const navigationSections = [
    {
      heading: 'CASETHREAD',
      items: [
        {
          id: 'dashboard',
          tab: 'dashboard',
          caseFilter: 'ALL',
          label: 'Dashboard',
          icon: '📊',
          tooltip: 'Dashboard & Incident Case Roster'
        }
      ]
    },
    {
      heading: 'INVESTIGATIONS',
      items: [
        {
          id: 'all_cases',
          tab: 'dossier',
          label: 'All Cases',
          icon: '📂',
          tooltip: 'Master Case Files & Entities'
        },
        {
          id: 'new_case',
          action: 'create_case',
          label: 'New Case',
          icon: '➕',
          tooltip: 'Initiate New Investigation File'
        },
        {
          id: 'active_cases',
          tab: 'dashboard',
          caseFilter: 'ACTIVE',
          label: 'Active Cases',
          icon: '⚡',
          tooltip: 'Filter Active & Ongoing Investigations'
        },
        {
          id: 'solved_cases',
          tab: 'dashboard',
          caseFilter: 'SOLVED',
          label: 'Solved Cases',
          icon: '📁',
          tooltip: 'Filter Closed & Archived Investigations'
        }
      ]
    },
    {
      heading: 'INTELLIGENCE',
      items: [
        {
          id: 'vault',
          tab: 'vault',
          label: 'Evidence Management',
          icon: '🗄️',
          tooltip: 'Secure Evidence Vault & Metadata Extraction'
        },
        {
          id: 'graph',
          tab: 'graph',
          label: 'Relationship Graph',
          icon: '🕸️',
          tooltip: 'C-Engine Dynamic Relational Graph & Traversals'
        },
        {
          id: 'timeline',
          tab: 'timeline',
          label: 'Timeline Analysis',
          icon: '⏱️',
          tooltip: 'Chronological Events & Spatiotemporal Anomaly Detection'
        },
        {
          id: 'gaps',
          tab: 'gaps',
          label: 'Evidence Gaps',
          icon: '🔍',
          tooltip: 'Algorithmic Detection of Missing Evidentiary Links'
        },
        {
          id: 'leads',
          tab: 'leads',
          label: 'Investigative Leads',
          icon: '🎯',
          tooltip: 'Max-Heap Ranked Detective Action Items'
        },
        {
          id: 'geospatial',
          tab: 'geospatial',
          label: 'Geospatial Analysis',
          icon: '🗺️',
          tooltip: 'C Quadtree Spatial Index & Forensic Proximity Mapping'
        }
      ]
    },
    {
      heading: 'OPERATIONS',
      items: [
        {
          id: 'officers',
          tab: 'collaboration',
          subTab: 'team',
          label: 'Investigation Officers',
          icon: '👥',
          tooltip: 'Case Access Roster & Detective Workload'
        },
        {
          id: 'tasks',
          tab: 'collaboration',
          subTab: 'tasks',
          label: 'Task Management',
          icon: '📋',
          tooltip: 'Investigation Task Lifecycle & Dependencies DAG'
        },
        {
          id: 'reviews',
          tab: 'collaboration',
          subTab: 'reviews',
          label: 'Evidence Review',
          icon: '🛡️',
          tooltip: 'Forensic Review Queue & Hash Verifications'
        },
        {
          id: 'activity',
          tab: 'collaboration',
          subTab: 'activity',
          label: 'Activity & Audit Log',
          icon: '📜',
          tooltip: 'Cryptographic Event Stream & Audit Trail'
        }
      ]
    },
    {
      heading: 'SYSTEM',
      items: [
        {
          id: 'validation',
          tab: 'validation',
          label: 'Validation Dashboard',
          icon: '🔬',
          tooltip: 'Phase 12 Academic Forensic Ground-Truth Benchmarks'
        },
        {
          id: 'reports',
          action: 'open_reports',
          label: 'Reports',
          icon: '📄',
          tooltip: 'Export Comprehensive Forensic Dossier'
        },
        {
          id: 'settings',
          action: 'open_settings',
          label: 'Settings',
          icon: '⚙️',
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

  const sidebarWidth = isCollapsed ? '72px' : '250px';

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobile && mobileOpen && (
        <div
          onClick={onCloseMobile}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            zIndex: 998,
            backdropFilter: 'blur(3px)',
            transition: 'opacity 0.25s ease'
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
          transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: isMobile ? (mobileOpen ? 'translateX(0)' : 'translateX(-100%)') : 'none',
          boxShadow: isMobile && mobileOpen ? '4px 0 24px rgba(0, 0, 0, 0.75)' : 'none',
          overflow: 'hidden'
        }}
        aria-label="Investigation Navigation Sidebar"
      >
        {/* 1. Sidebar Brand Header */}
        <div
          style={{
            height: '62px',
            padding: isCollapsed ? '0.75rem 0.5rem' : '0.75rem 1rem',
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
            title="CASETHREAD Home"
          >
            {/* Glowing Tactical Indicator Dot */}
            <div
              style={{
                width: '12px',
                height: '12px',
                backgroundColor: 'var(--accent-red)',
                borderRadius: '50%',
                boxShadow: '0 0 10px var(--accent-red)',
                flexShrink: 0
              }}
            />
            {!isCollapsed && (
              <div>
                <h1
                  style={{
                    fontSize: '1.05rem',
                    fontWeight: '800',
                    letterSpacing: '1px',
                    textTransform: 'uppercase',
                    color: 'var(--text-primary)',
                    lineHeight: 1.1
                  }}
                >
                  CASE<span style={{ color: 'var(--accent-red)' }}>THREAD</span>
                </h1>
                <p
                  style={{
                    fontSize: '0.58rem',
                    color: 'var(--text-muted)',
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                    fontFamily: 'var(--font-mono)'
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
              className="btn-secondary"
              style={{
                padding: '0.3rem 0.45rem',
                fontSize: '0.75rem',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                marginLeft: isCollapsed ? '0' : '0.5rem'
              }}
              title={isCollapsed ? 'Expand sidebar (Ctrl+[)' : 'Collapse sidebar (Ctrl+[)'}
              aria-label={isCollapsed ? 'Expand navigation sidebar' : 'Collapse navigation sidebar'}
            >
              {isCollapsed ? '▶' : '◀'}
            </button>
          )}

          {/* Mobile Close Button */}
          {isMobile && (
            <button
              onClick={onCloseMobile}
              className="btn-secondary"
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
              aria-label="Close navigation drawer"
            >
              ✕
            </button>
          )}
        </div>

        {/* 2. Scrollable Navigation Menu Groups */}
        <nav
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: isCollapsed ? '0.5rem 0.35rem' : '0.75rem 0.65rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}
        >
          {navigationSections.map((section, sIdx) => (
            <div key={section.heading || sIdx} style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
              {/* Section Heading (Visible only when expanded) */}
              {!isCollapsed ? (
                <div
                  style={{
                    fontSize: '0.62rem',
                    fontWeight: '800',
                    color: 'var(--text-muted)',
                    letterSpacing: '1.2px',
                    textTransform: 'uppercase',
                    fontFamily: 'var(--font-mono)',
                    padding: '0.4rem 0.6rem 0.2rem',
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
                      padding: isCollapsed ? '0.55rem 0' : '0.5rem 0.75rem',
                      borderRadius: '5px',
                      border: 'none',
                      borderLeft: active ? '3px solid var(--accent-red)' : '3px solid transparent',
                      backgroundColor: active
                        ? 'rgba(211, 47, 47, 0.16)'
                        : 'transparent',
                      color: active ? '#ffffff' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: '0.8rem',
                      fontWeight: active ? '700' : '500',
                      letterSpacing: '0.3px',
                      transition: 'all 0.18s ease',
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
                    {/* Item Icon */}
                    <span
                      style={{
                        fontSize: isCollapsed ? '1.15rem' : '1rem',
                        lineHeight: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: isCollapsed ? '100%' : 'auto',
                        filter: active ? 'drop-shadow(0 0 6px rgba(211, 47, 47, 0.6))' : 'none'
                      }}
                    >
                      {item.icon}
                    </span>

                    {/* Item Label (Visible when expanded) */}
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

                    {/* Subtle active pill for expanded view */}
                    {!isCollapsed && active && (
                      <span
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--accent-red)',
                          boxShadow: '0 0 8px var(--accent-red)',
                          flexShrink: 0
                        }}
                      />
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
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
            padding: isCollapsed ? '0.65rem 0.35rem' : '0.75rem 0.85rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            flexShrink: 0
          }}
        >
          {/* User Profile Card */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: isCollapsed ? '0' : '0.65rem',
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              padding: isCollapsed ? '0.25rem 0' : '0.35rem 0.4rem',
              borderRadius: '4px',
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-subtle)',
              overflow: 'hidden'
            }}
            title={isCollapsed ? `${officerName} (${officerBadge}) • ${officerRole}` : 'Investigator Profile'}
          >
            {/* Officer Avatar / Status Circle */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-highlight)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.8rem',
                  fontWeight: '700',
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
              {/* Online Green Pulsing Indicator */}
              <span
                style={{
                  position: 'absolute',
                  bottom: '-1px',
                  right: '-1px',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--status-verified)',
                  border: '2px solid var(--bg-secondary)',
                  boxShadow: '0 0 6px var(--status-verified)'
                }}
                title="Active Forensic Session"
              />
            </div>

            {/* Officer Details (When expanded) */}
            {!isCollapsed && (
              <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', flex: 1 }}>
                <div
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: '700',
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {officerName}
                </div>
                <div
                  style={{
                    fontSize: '0.66rem',
                    color: 'var(--accent-orange)',
                    fontFamily: 'var(--font-mono)',
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
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              gap: isCollapsed ? '0' : '0.6rem',
              width: '100%',
              padding: isCollapsed ? '0.45rem 0' : '0.45rem 0.6rem',
              borderRadius: '4px',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'rgba(211, 47, 47, 0.08)',
              color: '#ff6b6b',
              cursor: 'pointer',
              fontSize: '0.76rem',
              fontWeight: '600',
              transition: 'all 0.18s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--accent-red)';
              e.currentTarget.style.color = '#ffffff';
              e.currentTarget.style.borderColor = 'var(--accent-red-deep)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(211, 47, 47, 0.08)';
              e.currentTarget.style.color = '#ff6b6b';
              e.currentTarget.style.borderColor = 'var(--border-subtle)';
            }}
            title={isCollapsed ? 'Sign out of investigation session' : ''}
            aria-label="Sign out of investigation session"
          >
            <span style={{ fontSize: '0.95rem', lineHeight: 1 }}>🚪</span>
            {!isCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>
    </>
  );
}

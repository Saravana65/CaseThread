import React from 'react';

export default function Navbar({ officer, onLogout, activeTab, onTabChange, onOpenReport, unreadCount = 0 }) {
  const currentOfficer = officer?.officer || officer?.data || officer;
  const isAuthenticated = Boolean(
    currentOfficer &&
    (currentOfficer.badge_number || currentOfficer.officer_id || currentOfficer.full_name)
  );

  const navItems = [
    { id: 'dashboard', label: '📊 Dashboard', icon: '📊' },
    { id: 'dossier', label: '📂 Case Dossier', icon: '📂' },
    { id: 'collaboration', label: '🤝 Collaboration', icon: '🤝' },
    { id: 'vault', label: '🗄️ Evidence Vault', icon: '🗄️' },
    { id: 'geospatial', label: '🗺️ Geo Intelligence', icon: '🗺️' },
    { id: 'integrity', label: '🛡️ Evidence Integrity', icon: '🛡️' },
    { id: 'graph', label: '🕸️ Evidence Graph', icon: '🕸️' },
    { id: 'gaps', label: '🔍 Evidence Gaps', icon: '🔍' },
    { id: 'timeline', label: '⏱️ Timelines', icon: '⏱️' },
    { id: 'leads', label: '🎯 Leads', icon: '🎯' },
    { id: 'validation', label: '🔬 Validation', icon: '🔬' }
  ];

  const handleTabClick = (tabId) => {
    if (!isAuthenticated && tabId !== 'dashboard') {
      return;
    }
    if (onTabChange) {
      onTabChange(tabId);
    }
  };

  return (
    <header style={{
      backgroundColor: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border-default)',
      padding: '0.75rem 2rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '1rem',
      position: 'sticky',
      top: 0,
      zIndex: 100
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
        {/* Brand */}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', cursor: 'pointer' }}
          onClick={() => handleTabClick('dashboard')}
          title="CASETHREAD Home"
        >
          <div style={{
            width: '12px',
            height: '12px',
            backgroundColor: 'var(--accent-red)',
            borderRadius: '50%',
            boxShadow: '0 0 10px var(--accent-red)'
          }} />
          <div>
            <h1 style={{
              fontSize: '1.2rem',
              fontWeight: '800',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              color: 'var(--text-primary)',
              lineHeight: 1.1
            }}>
              CASE<span style={{ color: 'var(--accent-red)' }}>THREAD</span>
            </h1>
            <p style={{
              fontSize: '0.62rem',
              color: 'var(--text-muted)',
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              fontFamily: 'var(--font-mono)'
            }}>
              Evidence Gap Detection & Investigation Intelligence
            </p>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <nav style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => handleTabClick(item.id)}
              className={activeTab === item.id ? 'btn-primary' : 'btn-secondary'}
              style={{
                fontSize: '0.75rem',
                padding: '0.35rem 0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                cursor: isAuthenticated ? 'pointer' : 'default',
                opacity: isAuthenticated ? 1 : 0.75
              }}
              title={!isAuthenticated ? 'Sign in to access module' : item.label}
            >
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Officer Profile & Session */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        {isAuthenticated ? (
          <>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-subtle)',
              padding: '0.35rem 0.75rem',
              borderRadius: '4px'
            }}>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: 'var(--status-verified)',
                boxShadow: '0 0 8px var(--status-verified)',
                flexShrink: 0
              }} title="Session Authenticated & Active" />
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                  {currentOfficer.full_name || 'Alexander Cross'}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--accent-orange)', fontFamily: 'var(--font-mono)' }}>
                  BADGE: {currentOfficer.badge_number || 'DET-8841'} • {currentOfficer.role || currentOfficer.rank_designation || 'LEAD_OFFICER'}
                </div>
              </div>
            </div>
            {onOpenReport && (
              <button
                onClick={onOpenReport}
                className="btn-primary"
                style={{ fontSize: '0.7rem', padding: '0.35rem 0.7rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                title="Export complete forensic intelligence report"
              >
                <span>📄</span> Export Report
              </button>
            )}
            <button
              onClick={() => handleTabClick('collaboration')}
              className="btn-secondary"
              style={{
                fontSize: '0.7rem',
                padding: '0.35rem 0.7rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
              title="Open Investigation Notifications"
            >
              <span>🔔</span>
              {unreadCount > 0 && (
                <span style={{
                  backgroundColor: 'var(--accent-red)',
                  color: '#fff',
                  fontSize: '0.6rem',
                  fontWeight: '800',
                  borderRadius: '10px',
                  padding: '0.1rem 0.4rem',
                  lineHeight: 1
                }}>
                  {unreadCount}
                </span>
              )}
            </button>
            <button 
              onClick={onLogout}
              className="btn-secondary"
              style={{ fontSize: '0.7rem', padding: '0.35rem 0.7rem' }}
              title="Sign out of investigation session"
            >
              Sign Out
            </button>
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

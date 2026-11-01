import React from 'react';

export default function Navbar({ officer, onLogout, activeTab, onTabChange, onOpenReport }) {
  const navItems = [
    { id: 'dashboard', label: '📊 Dashboard', icon: '📊' },
    { id: 'dossier', label: '📂 Case Dossier', icon: '📂' },
    { id: 'integrity', label: '🛡️ Evidence Integrity', icon: '🛡️' },
    { id: 'graph', label: '🕸️ Evidence Graph', icon: '🕸️' },
    { id: 'gaps', label: '🔍 Evidence Gaps', icon: '🔍' },
    { id: 'timeline', label: '⏱️ Timelines', icon: '⏱️' },
    { id: 'leads', label: '🎯 Leads', icon: '🎯' }
  ];

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', cursor: 'pointer' }} onClick={() => onTabChange && onTabChange('dashboard')}>
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
              onClick={() => onTabChange && onTabChange(item.id)}
              className={activeTab === item.id ? 'btn-primary' : 'btn-secondary'}
              style={{
                fontSize: '0.75rem',
                padding: '0.35rem 0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem'
              }}
            >
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Officer Profile & Session */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        {officer ? (
          <>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                {officer.full_name || 'Det. Alexander Cross'}
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--accent-orange)', fontFamily: 'var(--font-mono)' }}>
                BADGE: {officer.badge_number || 'DET-8841'} • {officer.role || 'LEAD_OFFICER'}
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
              onClick={onLogout}
              className="btn-secondary"
              style={{ fontSize: '0.7rem', padding: '0.35rem 0.7rem' }}
            >
              Sign Out
            </button>
          </>
        ) : (
          <span className="badge badge-critical">AUTHENTICATION REQUIRED</span>
        )}
      </div>
    </header>
  );
}

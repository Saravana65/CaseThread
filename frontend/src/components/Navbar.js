import React from 'react';

export default function Navbar({ officer, onLogout, activeTab, onTabChange }) {
  return (
    <header style={{
      backgroundColor: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border-default)',
      padding: '0.8rem 2rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '12px',
            height: '12px',
            backgroundColor: 'var(--accent-red)',
            borderRadius: '50%',
            boxShadow: '0 0 8px var(--accent-red)'
          }} />
          <div>
            <h1 style={{
              fontSize: '1.25rem',
              fontWeight: '700',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              color: 'var(--text-primary)'
            }}>
              CASE<span style={{ color: 'var(--accent-red)' }}>THREAD</span>
            </h1>
            <p style={{
              fontSize: '0.68rem',
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
        <nav style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => onTabChange && onTabChange('dashboard')}
            className={activeTab === 'dashboard' ? 'btn-primary' : 'btn-secondary'}
            style={{ fontSize: '0.75rem', padding: '0.35rem 0.8rem' }}
          >
            📋 Case Overview
          </button>
          <button
            onClick={() => onTabChange && onTabChange('graph')}
            className={activeTab === 'graph' ? 'btn-primary' : 'btn-secondary'}
            style={{ fontSize: '0.75rem', padding: '0.35rem 0.8rem' }}
          >
            🕸️ Evidence Graph Analysis
          </button>
        </nav>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        {officer ? (
          <>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                {officer.full_name || 'Investigator'}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--accent-orange)', fontFamily: 'var(--font-mono)' }}>
                BADGE: {officer.badge_number || 'DET-8841'} | {officer.department || 'Major Crimes'}
              </div>
            </div>
            <button 
              onClick={onLogout}
              className="btn-secondary"
              style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem' }}
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

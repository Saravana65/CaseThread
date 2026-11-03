import React, { useState, useEffect } from 'react';
import api from '../services/api';

/**
 * @component SettingsModal
 * @description System configuration, session details, and live service health diagnostics.
 */
export default function SettingsModal({ isOpen, onClose, officer, selectedCaseId }) {
  const [healthData, setHealthData] = useState(null);
  const [loadingHealth, setLoadingHealth] = useState(false);

  useEffect(() => {
    if (isOpen) {
      checkHealth();
    }
  }, [isOpen]);

  const checkHealth = async () => {
    setLoadingHealth(true);
    try {
      const res = await fetch('http://localhost:5000/api/v1/health');
      const data = await res.json();
      setHealthData(data);
    } catch (e) {
      setHealthData({ status: 'UNHEALTHY', error: e.message });
    } finally {
      setLoadingHealth(false);
    }
  };

  if (!isOpen) return null;

  const currentOfficer = officer?.officer || officer?.data || officer || {};

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1100,
      backdropFilter: 'blur(4px)'
    }}>
      <div className="forensic-card" style={{
        maxWidth: '560px',
        width: '90%',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-highlight)',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.8)',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-default)', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.2rem' }}>⚙️</span>
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: '800', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                System Configuration & Session
              </h2>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                CASETHREAD v1.0.0 Forensic Intelligence Subsystem
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn-secondary"
            style={{ padding: '0.25rem 0.6rem', fontSize: '0.8rem' }}
          >
            ✕
          </button>
        </div>

        {/* Section 1: Active Officer Profile */}
        <div style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.6rem', fontFamily: 'var(--font-mono)' }}>
            Authenticated Investigator Session
          </h3>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            borderRadius: '4px',
            padding: '0.85rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Officer Name:</span>
              <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                {currentOfficer.full_name || 'Det. Alexander Cross'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Badge Number:</span>
              <span className="mono" style={{ fontSize: '0.85rem', color: 'var(--accent-orange)' }}>
                {currentOfficer.badge_number || 'DET-8841'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>System Authorization Role:</span>
              <span className="badge badge-high" style={{ fontSize: '0.7rem' }}>
                {currentOfficer.role || 'LEAD_OFFICER'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Department:</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {currentOfficer.department || 'Major Crimes Division'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Active Case Scope:</span>
              <span className="mono" style={{ fontSize: '0.8rem', color: 'var(--status-verified)' }}>
                Case ID #{selectedCaseId || 1}
              </span>
            </div>
          </div>
        </div>

        {/* Section 2: Core Subsystem Diagnostics */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
            <h3 style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontFamily: 'var(--font-mono)' }}>
              Subsystem Live Diagnostics
            </h3>
            <button
              onClick={checkHealth}
              disabled={loadingHealth}
              className="btn-secondary"
              style={{ fontSize: '0.68rem', padding: '0.2rem 0.5rem' }}
            >
              {loadingHealth ? 'Probing...' : 'Refresh'}
            </button>
          </div>

          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            borderRadius: '4px',
            padding: '0.85rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>MySQL 8 Database:</span>
              <span className={`badge ${healthData?.checks?.database?.status === 'UP' ? 'badge-open' : 'badge-critical'}`}>
                {healthData?.checks?.database?.status || 'UNKNOWN'} ({healthData?.checks?.database?.latency_ms || 0}ms)
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Native C Algorithm Engine:</span>
              <span className={`badge ${healthData?.checks?.c_engine?.available ? 'badge-open' : 'badge-critical'}`}>
                {healthData?.checks?.c_engine?.available ? 'ACTIVE (JSON IPC)' : 'INACTIVE'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Evidence File Vault:</span>
              <span className={`badge ${healthData?.checks?.storage_vault?.writable ? 'badge-open' : 'badge-critical'}`}>
                {healthData?.checks?.storage_vault?.writable ? 'WRITABLE (SHA-256)' : 'READ ONLY / DOWN'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>API Gateway:</span>
              <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                http://localhost:5000/api/v1
              </span>
            </div>
          </div>
        </div>

        {/* Section 3: Interface Environment */}
        <div style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.6rem', fontFamily: 'var(--font-mono)' }}>
            Display & Security Theme
          </h3>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            borderRadius: '4px',
            padding: '0.85rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                Dark Forensic Carbon
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                High-contrast tactical theme optimized for evidence analysis
              </div>
            </div>
            <span className="badge badge-high">ACTIVE</span>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid var(--border-default)', paddingTop: '0.75rem' }}>
          <button
            onClick={onClose}
            className="btn-primary"
            style={{ fontSize: '0.8rem', padding: '0.45rem 1rem' }}
          >
            Close Settings
          </button>
        </div>
      </div>
    </div>
  );
}

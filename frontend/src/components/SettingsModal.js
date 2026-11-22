import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { SettingsIcon, CloseIcon } from './icons/Icons';

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
      const data = await api.request('/health');
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
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="modal-sheet"
        style={{
          maxWidth: '540px',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-default)', paddingBottom: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={{ color: 'var(--accent-primary)', display: 'flex' }}>
              <SettingsIcon size={20} />
            </span>
            <div>
              <h2 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)', lineHeight: 1.2 }}>
                System Configuration & Session
              </h2>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                CaseThread v1.0.0 Forensic Intelligence Platform
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn-ghost"
            style={{ width: '28px', height: '28px', padding: 0 }}
            aria-label="Close settings dialog"
          >
            <CloseIcon size={16} />
          </button>
        </div>

        {/* Section 1: Active Officer Profile */}
        <div>
          <h3 style={{ fontSize: '0.72rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
            Authenticated Investigator Session
          </h3>
          <div style={{
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-control)',
            padding: '0.85rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.45rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Officer Name</span>
              <span style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                {currentOfficer.full_name || 'Det. Alexander Cross'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Badge Number</span>
              <span className="mono" style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', fontWeight: '600' }}>
                {currentOfficer.badge_number || 'DET-8841'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Authorization Role</span>
              <span className="badge badge-high" style={{ fontSize: '0.65rem' }}>
                {currentOfficer.role || 'LEAD_OFFICER'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Department</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                {currentOfficer.department || 'Major Crimes Division'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Active Case Scope</span>
              <span className="mono" style={{ fontSize: '0.78rem', color: 'var(--status-success)' }}>
                Case ID #{selectedCaseId || 1}
              </span>
            </div>
          </div>
        </div>

        {/* Section 2: Core Subsystem Diagnostics */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h3 style={{ fontSize: '0.72rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Subsystem Live Diagnostics
            </h3>
            <button
              onClick={checkHealth}
              disabled={loadingHealth}
              className="btn-ghost"
              style={{ fontSize: '0.72rem', height: '24px', padding: '0 0.5rem' }}
            >
              {loadingHealth ? 'Probing...' : 'Refresh'}
            </button>
          </div>

          <div style={{
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-control)',
            padding: '0.85rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.45rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>MySQL 8 Database</span>
              <span className={`badge ${healthData?.checks?.database?.status === 'UP' ? 'badge-open' : 'badge-critical'}`}>
                {healthData?.checks?.database?.status || 'UNKNOWN'} ({healthData?.checks?.database?.latency_ms || 0}ms)
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Native C Algorithm Engine</span>
              <span className={`badge ${healthData?.checks?.c_engine?.available ? 'badge-open' : 'badge-critical'}`}>
                {healthData?.checks?.c_engine?.available ? 'ACTIVE (JSON IPC)' : 'INACTIVE'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Evidence File Vault</span>
              <span className={`badge ${healthData?.checks?.storage_vault?.writable ? 'badge-open' : 'badge-critical'}`}>
                {healthData?.checks?.storage_vault?.writable ? 'WRITABLE (SHA-256)' : 'READ ONLY / DOWN'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>API Gateway Service</span>
              <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                ONLINE (PORT 5001)
              </span>
            </div>
          </div>
        </div>

        {/* Section 3: Interface Environment */}
        <div>
          <h3 style={{ fontSize: '0.72rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
            Display Theme
          </h3>
          <div style={{
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-control)',
            padding: '0.85rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                Apple-Inspired Dark
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Subdued charcoal surfaces (#101114 / #19191E) with restrained blue accent
              </div>
            </div>
            <span className="badge badge-open">ACTIVE</span>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-default)', paddingTop: '0.85rem' }}>
          <button
            onClick={onClose}
            className="btn-primary"
            style={{ height: '34px', fontSize: '0.8rem', padding: '0 1rem' }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import api from '../services/api';

/**
 * @component CreateCaseModal
 * @description Modal dialog for initiating a new forensic criminal investigation case file.
 */
export default function CreateCaseModal({ isOpen, onClose, onCaseCreated }) {
  const defaultCaseNumber = `CASE-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const [formData, setFormData] = useState({
    case_number: defaultCaseNumber,
    title: '',
    description: '',
    incident_location: '',
    incident_date: new Date().toISOString().slice(0, 16),
    priority: 'HIGH',
    status: 'OPEN'
  });

  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    // Validation
    if (!formData.case_number.trim()) {
      setError('Case file reference number is required.');
      return;
    }
    if (!formData.title.trim()) {
      setError('Investigation case title is required.');
      return;
    }
    if (!formData.incident_location.trim()) {
      setError('Primary incident location is required.');
      return;
    }
    if (!formData.incident_date) {
      setError('Incident timestamp is required.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.createCase({
        case_number: formData.case_number.trim(),
        title: formData.title.trim(),
        description: formData.description.trim(),
        incident_location: formData.incident_location.trim(),
        incident_date: formData.incident_date,
        priority: formData.priority,
        status: formData.status
      });

      if (res && res.success) {
        setSuccessMsg(`Case file #${res.data.case_number} registered successfully!`);
        setTimeout(() => {
          if (onCaseCreated) {
            onCaseCreated(res.data);
          }
          if (onClose) {
            onClose();
          }
        }, 600);
      } else {
        throw new Error(res.error?.message || 'Case creation request rejected by server.');
      }
    } catch (err) {
      console.error('Failed to create case:', err);
      setError(err.message || 'An error occurred while creating case.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(4, 7, 11, 0.85)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem'
    }}>
      <div className="forensic-card accent-red-border" style={{
        maxWidth: '580px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-default)',
        borderRadius: '8px',
        boxShadow: '0 12px 48px rgba(0, 0, 0, 0.8)',
        padding: '2rem'
      }}>
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
              <span style={{ fontSize: '1.1rem' }}>📂</span>
              <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--accent-orange)', fontWeight: '700' }}>
                INCIDENT DOSSIER INTAKE
              </span>
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-primary)' }}>
              Open New <span style={{ color: 'var(--accent-red)' }}>Case Investigation</span>
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '1.4rem',
              cursor: 'pointer',
              lineHeight: 1
            }}
          >
            ✕
          </button>
        </div>

        {/* Notices */}
        {error && (
          <div style={{
            backgroundColor: 'rgba(211, 47, 47, 0.15)',
            border: '1px solid var(--accent-red)',
            borderRadius: '4px',
            padding: '0.75rem 1rem',
            marginBottom: '1.25rem',
            fontSize: '0.8rem',
            color: '#ff5252',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem'
          }}>
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div style={{
            backgroundColor: 'rgba(0, 230, 118, 0.15)',
            border: '1px solid var(--status-verified)',
            borderRadius: '4px',
            padding: '0.75rem 1rem',
            marginBottom: '1.25rem',
            fontSize: '0.8rem',
            color: '#00e676',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem'
          }}>
            <span>✓</span>
            <span>{successMsg}</span>
          </div>
        )}

        {/* Intake Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Case File Reference Number *
              </label>
              <input
                type="text"
                name="case_number"
                value={formData.case_number}
                onChange={handleChange}
                placeholder="e.g. CASE-2026-0419"
                className="mono"
                style={{
                  width: '100%',
                  padding: '0.65rem 0.8rem',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '4px',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Investigative Priority *
              </label>
              <select
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.8rem',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '4px',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem'
                }}
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              Incident Title / Operation Codename *
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g. The Harbour Depot Armory Heist"
              style={{
                width: '100%',
                padding: '0.65rem 0.8rem',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-default)',
                borderRadius: '4px',
                color: 'var(--text-primary)',
                fontSize: '0.85rem'
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Primary Incident Location *
              </label>
              <input
                type="text"
                name="incident_location"
                value={formData.incident_location}
                onChange={handleChange}
                placeholder="e.g. Pier 9, South Industrial Docks"
                style={{
                  width: '100%',
                  padding: '0.65rem 0.8rem',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '4px',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Incident Date & Time *
              </label>
              <input
                type="datetime-local"
                name="incident_date"
                value={formData.incident_date}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.8rem',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '4px',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem'
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              Forensic Case Description & Circumstances
            </label>
            <textarea
              name="description"
              rows={3}
              value={formData.description}
              onChange={handleChange}
              placeholder="Provide a comprehensive summary of initial crime scene observations, suspicious indicators, and scope of investigation..."
              style={{
                width: '100%',
                padding: '0.65rem 0.8rem',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-default)',
                borderRadius: '4px',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
            />
          </div>

          {/* Form Action Controls */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="btn-secondary"
              style={{ fontSize: '0.85rem', padding: '0.6rem 1.2rem' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary"
              style={{
                fontSize: '0.85rem',
                padding: '0.6rem 1.4rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                opacity: submitting ? 0.7 : 1
              }}
            >
              {submitting ? 'Creating Case File...' : '📁 Register Case Dossier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

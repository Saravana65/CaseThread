import React, { useState, useEffect } from 'react';
import api from '../services/api';

/**
 * @component CreateCaseModal
 * @description Modal dialog for initiating a new forensic criminal investigation case file.
 * Submits to POST /api/v1/cases with authenticated officer context populated server-side.
 */
export default function CreateCaseModal({ isOpen, onClose, onCaseCreated }) {
  const [formData, setFormData] = useState({
    case_number: '',
    title: '',
    description: '',
    incident_location: '',
    incident_date: '',
    priority: 'MEDIUM'
  });

  const [fieldErrors, setFieldErrors] = useState({});
  const [generalError, setGeneralError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Reset form whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        case_number: '',
        title: '',
        description: '',
        incident_location: '',
        incident_date: new Date().toISOString().slice(0, 16),
        priority: 'MEDIUM'
      });
      setFieldErrors({});
      setGeneralError(null);
      setSuccessMsg(null);
      setSubmitting(false);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !submitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, submitting, onClose]);

  if (!isOpen) return null;

  const validate = () => {
    const errors = {};
    if (!formData.case_number.trim()) {
      errors.case_number = 'Case file reference number is required (e.g. CASE-2026-0419).';
    }
    if (!formData.title.trim()) {
      errors.title = 'Investigation incident title is required.';
    }
    if (!formData.incident_location.trim()) {
      errors.incident_location = 'Primary incident location is required.';
    }
    if (!formData.incident_date) {
      errors.incident_date = 'Incident date and time are required.';
    }
    if (!['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(formData.priority)) {
      errors.priority = 'Priority must be LOW, MEDIUM, HIGH, or CRITICAL.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGeneralError(null);
    setSuccessMsg(null);

    if (!validate()) {
      return;
    }

    try {
      setSubmitting(true);
      // Payload contains only backend supported fields. Lead officer ID is assigned via JWT token context.
      const payload = {
        case_number: formData.case_number.trim(),
        title: formData.title.trim(),
        description: formData.description.trim(),
        incident_location: formData.incident_location.trim(),
        incident_date: formData.incident_date.replace('T', ' '),
        priority: formData.priority
      };

      const res = await api.createCase(payload);

      if (res && res.success) {
        setSuccessMsg(`Case file #${res.data.case_number} registered successfully!`);
        setTimeout(() => {
          if (onCaseCreated) {
            onCaseCreated(res.data);
          }
          if (onClose) {
            onClose();
          }
        }, 500);
      } else {
        throw new Error(res.error?.message || 'Case creation request rejected by server.');
      }
    } catch (err) {
      console.error('Failed to create case:', err);
      const msg = err.message || '';
      if (msg.includes('already exists') || msg.includes('DUPLICATE_CASE_NUMBER')) {
        setFieldErrors(prev => ({
          ...prev,
          case_number: `Case reference "${formData.case_number}" is already registered. Please specify a unique file number.`
        }));
      } else {
        setGeneralError(msg || 'An unexpected error occurred while registering case file.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
      style={{
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
      }}
    >
      <div
        className="forensic-card accent-red-border"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-case-title"
        style={{
          maxWidth: '580px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-default)',
          borderRadius: '8px',
          boxShadow: '0 12px 48px rgba(0, 0, 0, 0.8)',
          padding: '2rem'
        }}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
              <span style={{ fontSize: '1.1rem' }}>📂</span>
              <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--accent-orange)', fontWeight: '700' }}>
                CASE INTAKE DOSSIER
              </span>
            </div>
            <h2 id="create-case-title" style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-primary)' }}>
              Open New <span style={{ color: 'var(--accent-red)' }}>Investigation Case</span>
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '1.4rem',
              cursor: submitting ? 'not-allowed' : 'pointer',
              lineHeight: 1
            }}
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        {/* Global Error Banner */}
        {generalError && (
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
            <span>{generalError}</span>
          </div>
        )}

        {/* Success Confirmation */}
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

        {/* Case Creation Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label htmlFor="case_number" style={{
                display: 'block',
                fontSize: '0.72rem',
                fontWeight: '700',
                textTransform: 'uppercase',
                color: fieldErrors.case_number ? '#ff5252' : 'var(--text-secondary)',
                marginBottom: '0.35rem'
              }}>
                Case Reference Number *
              </label>
              <input
                id="case_number"
                type="text"
                name="case_number"
                value={formData.case_number}
                onChange={handleChange}
                placeholder="e.g. CASE-2026-0420"
                className="mono"
                style={{
                  width: '100%',
                  padding: '0.65rem 0.8rem',
                  backgroundColor: 'var(--bg-input)',
                  border: `1px solid ${fieldErrors.case_number ? '#ff5252' : 'var(--border-default)'}`,
                  borderRadius: '4px',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              />
              {fieldErrors.case_number && (
                <div style={{ fontSize: '0.7rem', color: '#ff5252', marginTop: '0.25rem', fontFamily: 'var(--font-mono)' }}>
                  {fieldErrors.case_number}
                </div>
              )}
            </div>

            <div>
              <label htmlFor="priority" style={{
                display: 'block',
                fontSize: '0.72rem',
                fontWeight: '700',
                textTransform: 'uppercase',
                color: 'var(--text-secondary)',
                marginBottom: '0.35rem'
              }}>
                Investigative Priority *
              </label>
              <select
                id="priority"
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
                  fontSize: '0.85rem',
                  outline: 'none'
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
            <label htmlFor="title" style={{
              display: 'block',
              fontSize: '0.72rem',
              fontWeight: '700',
              textTransform: 'uppercase',
              color: fieldErrors.title ? '#ff5252' : 'var(--text-secondary)',
              marginBottom: '0.35rem'
            }}>
              Case Incident Title *
            </label>
            <input
              id="title"
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g. North Terminal Cargo Disappearance"
              style={{
                width: '100%',
                padding: '0.65rem 0.8rem',
                backgroundColor: 'var(--bg-input)',
                border: `1px solid ${fieldErrors.title ? '#ff5252' : 'var(--border-default)'}`,
                borderRadius: '4px',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                outline: 'none'
              }}
            />
            {fieldErrors.title && (
              <div style={{ fontSize: '0.7rem', color: '#ff5252', marginTop: '0.25rem', fontFamily: 'var(--font-mono)' }}>
                {fieldErrors.title}
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label htmlFor="incident_location" style={{
                display: 'block',
                fontSize: '0.72rem',
                fontWeight: '700',
                textTransform: 'uppercase',
                color: fieldErrors.incident_location ? '#ff5252' : 'var(--text-secondary)',
                marginBottom: '0.35rem'
              }}>
                Primary Incident Location *
              </label>
              <input
                id="incident_location"
                type="text"
                name="incident_location"
                value={formData.incident_location}
                onChange={handleChange}
                placeholder="e.g. Pier 9, South Industrial Basin"
                style={{
                  width: '100%',
                  padding: '0.65rem 0.8rem',
                  backgroundColor: 'var(--bg-input)',
                  border: `1px solid ${fieldErrors.incident_location ? '#ff5252' : 'var(--border-default)'}`,
                  borderRadius: '4px',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              />
              {fieldErrors.incident_location && (
                <div style={{ fontSize: '0.7rem', color: '#ff5252', marginTop: '0.25rem', fontFamily: 'var(--font-mono)' }}>
                  {fieldErrors.incident_location}
                </div>
              )}
            </div>

            <div>
              <label htmlFor="incident_date" style={{
                display: 'block',
                fontSize: '0.72rem',
                fontWeight: '700',
                textTransform: 'uppercase',
                color: fieldErrors.incident_date ? '#ff5252' : 'var(--text-secondary)',
                marginBottom: '0.35rem'
              }}>
                Incident Date & Time *
              </label>
              <input
                id="incident_date"
                type="datetime-local"
                name="incident_date"
                value={formData.incident_date}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.8rem',
                  backgroundColor: 'var(--bg-input)',
                  border: `1px solid ${fieldErrors.incident_date ? '#ff5252' : 'var(--border-default)'}`,
                  borderRadius: '4px',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              />
              {fieldErrors.incident_date && (
                <div style={{ fontSize: '0.7rem', color: '#ff5252', marginTop: '0.25rem', fontFamily: 'var(--font-mono)' }}>
                  {fieldErrors.incident_date}
                </div>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="description" style={{
              display: 'block',
              fontSize: '0.72rem',
              fontWeight: '700',
              textTransform: 'uppercase',
              color: 'var(--text-secondary)',
              marginBottom: '0.35rem'
            }}>
              Forensic Case Description & Circumstances
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              value={formData.description}
              onChange={handleChange}
              placeholder="Summary of initial incident reports, preliminary findings, and investigative scope..."
              style={{
                width: '100%',
                padding: '0.65rem 0.8rem',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-default)',
                borderRadius: '4px',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                fontFamily: 'inherit',
                resize: 'vertical',
                outline: 'none'
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

import React, { useState, useEffect } from 'react';
import api from '../services/api';

/**
 * @component EditEvidenceModal
 * @description Apple-inspired modal dialog for amending forensic evidence records.
 * Enforces mandatory Reason for Modification to maintain immutable cryptographically chained audit trails.
 */
export default function EditEvidenceModal({ isOpen, onClose, evidenceItem, onEvidenceUpdated }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    verification_status: 'CONFIRMED_FACT',
    reliability_assessment: 'HIGH',
    modification_reason: ''
  });

  const [fieldErrors, setFieldErrors] = useState({});
  const [generalError, setGeneralError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && evidenceItem) {
      setFormData({
        title: evidenceItem.title || '',
        description: evidenceItem.description || '',
        verification_status: evidenceItem.verification_status || 'CONFIRMED_FACT',
        reliability_assessment: evidenceItem.reliability_assessment || 'HIGH',
        modification_reason: ''
      });
      setFieldErrors({});
      setGeneralError(null);
      setSubmitting(false);
    }
  }, [isOpen, evidenceItem]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !submitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, submitting, onClose]);

  if (!isOpen || !evidenceItem) return null;

  const validate = () => {
    const errors = {};
    if (!formData.title.trim()) {
      errors.title = 'Evidence item title is required.';
    }
    if (!formData.description.trim()) {
      errors.description = 'Detailed forensic description is required.';
    }
    if (!formData.modification_reason.trim()) {
      errors.modification_reason = 'Forensic audit requirement: Specify the reason for this record amendment.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      setSubmitting(true);
      setGeneralError(null);

      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        verification_status: formData.verification_status,
        reliability_assessment: formData.reliability_assessment,
        modification_reason: formData.modification_reason.trim()
      };

      const res = await api.updateEvidence(evidenceItem.evidence_id, payload);
      if (res && res.success) {
        if (onEvidenceUpdated) {
          onEvidenceUpdated(res.data);
        }
        onClose();
      } else {
        setGeneralError(res?.error?.message || 'Failed to update evidence record.');
      }
    } catch (err) {
      setGeneralError(err.message || 'An unexpected error occurred while updating evidence.');
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
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1.5rem',
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <div style={{
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-default)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '640px',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 24px 48px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.5rem 1.75rem',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0) 100%)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '1.2rem' }}>✏️</span>
              <h2 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                Edit Evidence Record
              </h2>
              <span className="badge badge-info" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
                {evidenceItem.tracking_code}
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.3rem 0 0 0' }}>
              Amend forensic attributes. Modifications create a new version and an immutable audit entry.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '1.4rem',
              cursor: 'pointer',
              padding: '0.2rem 0.5rem',
              borderRadius: '6px',
              transition: 'color 0.15s ease'
            }}
            title="Close dialog (Esc)"
          >
            ×
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {generalError && (
            <div style={{
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid var(--accent-red)',
              borderRadius: '8px',
              padding: '0.85rem 1rem',
              color: '#fca5a5',
              fontSize: '0.85rem'
            }}>
              ⚠️ {generalError}
            </div>
          )}

          {/* Title */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
              Evidence Title <span style={{ color: 'var(--accent-red)' }}>*</span>
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g. Traffic Camera Video Feed - Intersection North"
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-tertiary)',
                border: `1px solid ${fieldErrors.title ? 'var(--accent-red)' : 'var(--border-default)'}`,
                borderRadius: '8px',
                padding: '0.65rem 0.85rem',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
                outline: 'none'
              }}
            />
            {fieldErrors.title && (
              <span style={{ fontSize: '0.75rem', color: 'var(--accent-red)', marginTop: '0.25rem', display: 'block' }}>
                {fieldErrors.title}
              </span>
            )}
          </div>

          {/* Verification Status & Reliability in 2 Columns */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                Ground Truth Status <span style={{ color: 'var(--accent-red)' }}>*</span>
              </label>
              <select
                name="verification_status"
                value={formData.verification_status}
                onChange={handleChange}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '8px',
                  padding: '0.65rem 0.85rem',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              >
                <option value="CONFIRMED_FACT">Confirmed Fact (Direct Ground Truth)</option>
                <option value="UNVERIFIED_OBSERVATION">Unverified Observation (Needs Verification)</option>
                <option value="HYPOTHESIS">Hypothesis / Theory</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                Reliability Assessment <span style={{ color: 'var(--accent-red)' }}>*</span>
              </label>
              <select
                name="reliability_assessment"
                value={formData.reliability_assessment}
                onChange={handleChange}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '8px',
                  padding: '0.65rem 0.85rem',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              >
                <option value="HIGH">High (Indisputable / Validated)</option>
                <option value="MEDIUM">Medium (Corroborated)</option>
                <option value="LOW">Low (Speculative / Partial)</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
              Forensic Description <span style={{ color: 'var(--accent-red)' }}>*</span>
            </label>
            <textarea
              name="description"
              rows={4}
              value={formData.description}
              onChange={handleChange}
              placeholder="Detailed description of the evidence item, collection context, and physical characteristics..."
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-tertiary)',
                border: `1px solid ${fieldErrors.description ? 'var(--accent-red)' : 'var(--border-default)'}`,
                borderRadius: '8px',
                padding: '0.65rem 0.85rem',
                color: 'var(--text-primary)',
                fontSize: '0.88rem',
                lineHeight: 1.5,
                outline: 'none',
                resize: 'vertical'
              }}
            />
            {fieldErrors.description && (
              <span style={{ fontSize: '0.75rem', color: 'var(--accent-red)', marginTop: '0.25rem', display: 'block' }}>
                {fieldErrors.description}
              </span>
            )}
          </div>

          {/* Reason for Modification (Mandatory for Chain-of-Custody) */}
          <div style={{
            backgroundColor: 'rgba(59, 130, 246, 0.05)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            borderRadius: '10px',
            padding: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.9rem' }}>🛡️</span>
              <label style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--accent-blue)' }}>
                Reason for Modification <span style={{ color: 'var(--accent-red)' }}>*</span>
              </label>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              Every amendment is sealed in the cryptographic audit trail with your officer ID and timestamp.
            </p>
            <input
              type="text"
              name="modification_reason"
              value={formData.modification_reason}
              onChange={handleChange}
              placeholder="e.g. Lab analysis confirmed camera serial number and timestamp alignment"
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-primary)',
                border: `1px solid ${fieldErrors.modification_reason ? 'var(--accent-red)' : 'var(--border-subtle)'}`,
                borderRadius: '6px',
                padding: '0.6rem 0.75rem',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                outline: 'none'
              }}
            />
            {fieldErrors.modification_reason && (
              <span style={{ fontSize: '0.75rem', color: 'var(--accent-red)', marginTop: '0.25rem', display: 'block' }}>
                {fieldErrors.modification_reason}
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '0.75rem',
            paddingTop: '0.75rem',
            borderTop: '1px solid var(--border-subtle)'
          }}>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="btn-secondary"
              style={{ padding: '0.6rem 1.25rem', borderRadius: '8px', fontSize: '0.85rem' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary"
              style={{
                padding: '0.6rem 1.5rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              {submitting ? 'Sealing Version...' : 'Save & Seal Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

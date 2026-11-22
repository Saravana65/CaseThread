import React, { useState, useEffect } from 'react';
import api from '../services/api';

/**
 * @component TransferCustodyModal
 * @description Apple-inspired modal dialog for executing an auditable chain-of-custody transfer.
 * Persists transfer event, updates evidence location, and records cryptographically chained audit log.
 */
export default function TransferCustodyModal({ isOpen, onClose, evidenceItem, officer, onCustodyTransferred }) {
  const [formData, setFormData] = useState({
    previous_custodian: '',
    new_custodian: '',
    transfer_reason: '',
    transfer_location: '',
    transfer_notes: ''
  });

  const [fieldErrors, setFieldErrors] = useState({});
  const [generalError, setGeneralError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && evidenceItem) {
      const currentCust = evidenceItem.current_custodian ||
        (officer ? `${officer.full_name || 'Officer'} (${officer.badge_number || 'DET-8841'})` : 'Det. Alexander Cross');

      setFormData({
        previous_custodian: currentCust,
        new_custodian: '',
        transfer_reason: 'Forensic Laboratory Analysis',
        transfer_location: 'Central Forensic Lab - Sector B',
        transfer_notes: ''
      });
      setFieldErrors({});
      setGeneralError(null);
      setSubmitting(false);
    }
  }, [isOpen, evidenceItem, officer]);

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
    if (!formData.previous_custodian.trim()) {
      errors.previous_custodian = 'Releasing custodian is required.';
    }
    if (!formData.new_custodian.trim()) {
      errors.new_custodian = 'Receiving custodian name / agency is required.';
    }
    if (!formData.transfer_reason.trim()) {
      errors.transfer_reason = 'Official transfer reason is required.';
    }
    if (!formData.transfer_location.trim()) {
      errors.transfer_location = 'Secure destination location is required.';
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
        evidence_id: evidenceItem.evidence_id,
        case_id: evidenceItem.case_id,
        previous_custodian: formData.previous_custodian.trim(),
        new_custodian: formData.new_custodian.trim(),
        transfer_timestamp: new Date().toISOString().slice(0, 19).replace('T', ' '),
        transfer_reason: formData.transfer_reason.trim(),
        transfer_location: formData.transfer_location.trim(),
        transfer_notes: formData.transfer_notes.trim() || undefined,
        verification_status: evidenceItem.verification_status || 'CONFIRMED_FACT'
      };

      const res = await api.transferCustody(payload);
      if (res && res.success) {
        if (onCustodyTransferred) {
          onCustodyTransferred(res.data);
        }
        onClose();
      } else {
        setGeneralError(res?.error?.message || 'Failed to record chain of custody transfer.');
      }
    } catch (err) {
      setGeneralError(err.message || 'An unexpected error occurred during custody transfer.');
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
              <span style={{ fontSize: '1.2rem' }}>🤝</span>
              <h2 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                Transfer Chain of Custody
              </h2>
              <span className="badge badge-info" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
                {evidenceItem.tracking_code}
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.3rem 0 0 0' }}>
              Record physical/digital custody handover with cryptographic event signature.
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
              borderRadius: '6px'
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

          {/* Previous Custodian & New Custodian */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                Releasing Custodian <span style={{ color: 'var(--accent-red)' }}>*</span>
              </label>
              <input
                type="text"
                name="previous_custodian"
                value={formData.previous_custodian}
                onChange={handleChange}
                placeholder="Current officer / custodian"
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-tertiary)',
                  border: `1px solid ${fieldErrors.previous_custodian ? 'var(--accent-red)' : 'var(--border-default)'}`,
                  borderRadius: '8px',
                  padding: '0.65rem 0.85rem',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              />
              {fieldErrors.previous_custodian && (
                <span style={{ fontSize: '0.75rem', color: 'var(--accent-red)', marginTop: '0.25rem', display: 'block' }}>
                  {fieldErrors.previous_custodian}
                </span>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                Receiving Custodian <span style={{ color: 'var(--accent-red)' }}>*</span>
              </label>
              <input
                type="text"
                name="new_custodian"
                value={formData.new_custodian}
                onChange={handleChange}
                placeholder="e.g. Dr. Emily Vance (Forensics Lab)"
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-tertiary)',
                  border: `1px solid ${fieldErrors.new_custodian ? 'var(--accent-red)' : 'var(--border-default)'}`,
                  borderRadius: '8px',
                  padding: '0.65rem 0.85rem',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              />
              {fieldErrors.new_custodian && (
                <span style={{ fontSize: '0.75rem', color: 'var(--accent-red)', marginTop: '0.25rem', display: 'block' }}>
                  {fieldErrors.new_custodian}
                </span>
              )}
            </div>
          </div>

          {/* Reason & Location */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                Transfer Purpose / Reason <span style={{ color: 'var(--accent-red)' }}>*</span>
              </label>
              <input
                type="text"
                name="transfer_reason"
                value={formData.transfer_reason}
                onChange={handleChange}
                placeholder="e.g. Ballistics Testing & Chemical Analysis"
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-tertiary)',
                  border: `1px solid ${fieldErrors.transfer_reason ? 'var(--accent-red)' : 'var(--border-default)'}`,
                  borderRadius: '8px',
                  padding: '0.65rem 0.85rem',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              />
              {fieldErrors.transfer_reason && (
                <span style={{ fontSize: '0.75rem', color: 'var(--accent-red)', marginTop: '0.25rem', display: 'block' }}>
                  {fieldErrors.transfer_reason}
                </span>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                New Secure Location <span style={{ color: 'var(--accent-red)' }}>*</span>
              </label>
              <input
                type="text"
                name="transfer_location"
                value={formData.transfer_location}
                onChange={handleChange}
                placeholder="e.g. Forensics Vault Locker #14"
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-tertiary)',
                  border: `1px solid ${fieldErrors.transfer_location ? 'var(--accent-red)' : 'var(--border-default)'}`,
                  borderRadius: '8px',
                  padding: '0.65rem 0.85rem',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              />
              {fieldErrors.transfer_location && (
                <span style={{ fontSize: '0.75rem', color: 'var(--accent-red)', marginTop: '0.25rem', display: 'block' }}>
                  {fieldErrors.transfer_location}
                </span>
              )}
            </div>
          </div>

          {/* Transfer Notes */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
              Custody Transfer Notes (Optional)
            </label>
            <textarea
              name="transfer_notes"
              rows={3}
              value={formData.transfer_notes}
              onChange={handleChange}
              placeholder="Seal integrity verified, tamper-evident bag barcode scanned..."
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-default)',
                borderRadius: '8px',
                padding: '0.65rem 0.85rem',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                outline: 'none',
                resize: 'vertical'
              }}
            />
          </div>

          {/* Security Notice */}
          <div style={{
            backgroundColor: 'rgba(16, 185, 129, 0.05)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            borderRadius: '10px',
            padding: '0.85rem 1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem'
          }}>
            <span style={{ fontSize: '1.2rem' }}>🔒</span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              Executing this custody transfer computes an SHA-256 event hash chained to previous logs, fulfilling forensic chain-of-custody requirements.
            </span>
          </div>

          {/* Actions */}
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
              {submitting ? 'Recording Custody Event...' : 'Authorize Custody Transfer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { CloseIcon } from './icons/Icons';

/**
 * @component EditCaseModal
 * @description Modal dialog for updating investigation parameters, priority, location, description, and status.
 * Persists modifications via PUT /api/v1/cases/:id with automated audit trail logging.
 */
export default function EditCaseModal({ isOpen, onClose, caseData, onCaseUpdated }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    incident_location: '',
    priority: 'MEDIUM',
    status: 'OPEN'
  });

  const [fieldErrors, setFieldErrors] = useState({});
  const [generalError, setGeneralError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && caseData) {
      setFormData({
        title: caseData.title || '',
        description: caseData.description || '',
        incident_location: caseData.incident_location || '',
        priority: caseData.priority || 'MEDIUM',
        status: caseData.status || 'OPEN'
      });
      setFieldErrors({});
      setGeneralError(null);
      setSuccessMsg(null);
      setSubmitting(false);
    }
  }, [isOpen, caseData]);

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

  if (!isOpen || !caseData) return null;

  const validate = () => {
    const errors = {};
    if (!formData.title.trim()) {
      errors.title = 'Investigation title is required.';
    }
    if (!formData.incident_location.trim()) {
      errors.incident_location = 'Incident location is required.';
    }
    if (!['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(formData.priority)) {
      errors.priority = 'Priority must be LOW, MEDIUM, HIGH, or CRITICAL.';
    }
    if (!['OPEN', 'UNDER_INVESTIGATION', 'CLOSED', 'ARCHIVED'].includes(formData.status)) {
      errors.status = 'Invalid case status.';
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
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        incident_location: formData.incident_location.trim(),
        priority: formData.priority,
        status: formData.status
      };

      const res = await api.updateCase(caseData.case_id, payload);

      if (res && res.success) {
        setSuccessMsg(`Case #${caseData.case_number} updated successfully.`);
        setTimeout(() => {
          if (onCaseUpdated) {
            onCaseUpdated(res.data);
          }
          if (onClose) {
            onClose();
          }
        }, 500);
      } else {
        throw new Error(res.error?.message || 'Update request rejected by server.');
      }
    } catch (err) {
      console.error('Failed to update case:', err);
      setGeneralError(err.message || 'An unexpected error occurred while updating the investigation.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div
        className="modal-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-case-title"
        style={{
          maxWidth: '580px',
          padding: '1.75rem'
        }}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '1.25rem',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '0.85rem'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: '700' }}>
                {caseData.case_number}
              </span>
              <span className="badge badge-medium" style={{ fontSize: '0.62rem' }}>
                ID #{caseData.case_id}
              </span>
            </div>
            <h2 id="edit-case-title" style={{
              fontSize: '1.15rem',
              fontWeight: '700',
              color: 'var(--text-primary)',
              letterSpacing: '-0.01em',
              margin: 0
            }}>
              Edit Investigation Details
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="btn-ghost"
            style={{ padding: '0.35rem', height: 'auto' }}
            aria-label="Close dialog"
          >
            <CloseIcon size={16} />
          </button>
        </div>

        {generalError && (
          <div style={{
            padding: '0.65rem 0.85rem',
            backgroundColor: 'var(--status-danger-dim)',
            border: '1px solid var(--status-danger-border)',
            borderRadius: 'var(--radius-control)',
            color: 'var(--status-danger)',
            fontSize: '0.78rem',
            marginBottom: '1rem'
          }}>
            {generalError}
          </div>
        )}

        {successMsg && (
          <div style={{
            padding: '0.65rem 0.85rem',
            backgroundColor: 'var(--status-success-dim)',
            border: '1px solid var(--status-success-border)',
            borderRadius: 'var(--radius-control)',
            color: 'var(--status-success)',
            fontSize: '0.78rem',
            marginBottom: '1rem'
          }}>
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label htmlFor="edit_title">Investigation Title *</label>
            <input
              id="edit_title"
              name="title"
              type="text"
              value={formData.title}
              onChange={handleChange}
              disabled={submitting}
              placeholder="e.g. Metro Vault Intrusion"
              style={{ borderColor: fieldErrors.title ? 'var(--status-danger)' : undefined }}
            />
            {fieldErrors.title && (
              <span style={{ fontSize: '0.7rem', color: 'var(--status-danger)', marginTop: '0.2rem', display: 'block' }}>
                {fieldErrors.title}
              </span>
            )}
          </div>

          <div>
            <label htmlFor="edit_incident_location">Primary Incident Location *</label>
            <input
              id="edit_incident_location"
              name="incident_location"
              type="text"
              value={formData.incident_location}
              onChange={handleChange}
              disabled={submitting}
              placeholder="e.g. 450 Financial Boulevard, Downtown"
              style={{ borderColor: fieldErrors.incident_location ? 'var(--status-danger)' : undefined }}
            />
            {fieldErrors.incident_location && (
              <span style={{ fontSize: '0.7rem', color: 'var(--status-danger)', marginTop: '0.2rem', display: 'block' }}>
                {fieldErrors.incident_location}
              </span>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label htmlFor="edit_priority">Investigation Priority</label>
              <select
                id="edit_priority"
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                disabled={submitting}
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </div>

            <div>
              <label htmlFor="edit_status">Investigation Status</label>
              <select
                id="edit_status"
                name="status"
                value={formData.status}
                onChange={handleChange}
                disabled={submitting}
              >
                <option value="OPEN">OPEN</option>
                <option value="UNDER_INVESTIGATION">UNDER INVESTIGATION</option>
                <option value="CLOSED">CLOSED</option>
                <option value="ARCHIVED">ARCHIVED</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="edit_description">Investigation Scope & Summary</label>
            <textarea
              id="edit_description"
              name="description"
              rows={4}
              value={formData.description}
              onChange={handleChange}
              disabled={submitting}
              placeholder="Detailed summary of forensic facts, breach indicators, or investigative objectives..."
            />
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.65rem',
            marginTop: '0.5rem',
            paddingTop: '1rem',
            borderTop: '1px solid var(--border-subtle)'
          }}>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary"
              style={{ minWidth: '120px' }}
            >
              {submitting ? 'Saving Changes...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

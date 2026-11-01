import React, { useState, useEffect } from 'react';
import api from '../services/api';

/**
 * @component AddEvidenceModal
 * @description Modal dialog for ingesting forensic evidence records into a case file.
 * Preserves chain-of-custody tracking, handles server duplicate tracking code errors,
 * and maintains forensic ground-truth partitions (CONFIRMED_FACT vs UNVERIFIED_OBSERVATION vs HYPOTHESIS).
 */
export default function AddEvidenceModal({ isOpen, onClose, caseId, caseNumber, cases = [], onEvidenceAdded }) {
  const [formData, setFormData] = useState({
    case_id: caseId || '',
    tracking_code: '',
    title: '',
    category: 'CCTV',
    description: '',
    source: '',
    collection_location: '',
    collected_at: '',
    verification_status: 'CONFIRMED_FACT',
    reliability_assessment: 'HIGH',
    file_reference: '',
    chain_of_custody_notes: '',
    metadata_json: ''
  });

  const [fieldErrors, setFieldErrors] = useState({});
  const [generalError, setGeneralError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Sync caseId and reset whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        case_id: caseId || (cases.length > 0 ? cases[0].case_id : ''),
        tracking_code: '',
        title: '',
        category: 'CCTV',
        description: '',
        source: '',
        collection_location: '',
        collected_at: new Date().toISOString().slice(0, 16),
        verification_status: 'CONFIRMED_FACT',
        reliability_assessment: 'HIGH',
        file_reference: '',
        chain_of_custody_notes: '',
        metadata_json: ''
      });
      setFieldErrors({});
      setGeneralError(null);
      setSuccessMsg(null);
      setSubmitting(false);
    }
  }, [isOpen, caseId, cases]);

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
    if (!formData.case_id) {
      errors.case_id = 'Associated investigation case is required.';
    }
    if (!formData.tracking_code.trim()) {
      errors.tracking_code = 'Evidence tracking code / barcode is required (e.g. EVD-2026-0042).';
    }
    if (!formData.title.trim()) {
      errors.title = 'Evidence item title is required.';
    }
    if (!formData.category) {
      errors.category = 'Evidence category classification is required.';
    }
    if (!formData.description.trim()) {
      errors.description = 'Detailed forensic description is required.';
    }
    if (!formData.source.trim()) {
      errors.source = 'Evidence chain-of-custody source / provenance origin is required.';
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

      let parsedMetadata = undefined;
      if (formData.metadata_json && formData.metadata_json.trim()) {
        try {
          parsedMetadata = JSON.parse(formData.metadata_json.trim());
        } catch (jErr) {
          setFieldErrors(prev => ({
            ...prev,
            metadata_json: 'Invalid JSON syntax. Enter valid JSON (e.g. {"device_model": "Axis P3245"}).'
          }));
          setSubmitting(false);
          return;
        }
      }

      const payload = {
        case_id: parseInt(formData.case_id, 10),
        tracking_code: formData.tracking_code.trim(),
        title: formData.title.trim(),
        category: formData.category,
        description: formData.description.trim(),
        source: formData.source.trim(),
        collection_location: formData.collection_location.trim() || undefined,
        collected_at: formData.collected_at ? formData.collected_at.replace('T', ' ') : undefined,
        verification_status: formData.verification_status,
        reliability_assessment: formData.reliability_assessment,
        file_reference: formData.file_reference.trim() || undefined,
        chain_of_custody_notes: formData.chain_of_custody_notes.trim() || undefined,
        metadata_json: parsedMetadata
      };

      const res = await api.addEvidence(payload);

      if (res && res.success) {
        setSuccessMsg(`Evidence record [${formData.tracking_code}] committed to case dossier successfully.`);
        setTimeout(() => {
          if (onEvidenceAdded) {
            onEvidenceAdded(res.data);
          }
          if (onClose) {
            onClose();
          }
        }, 500);
      } else {
        throw new Error(res.error?.message || 'Evidence intake request rejected by server.');
      }
    } catch (err) {
      console.error('Evidence submission failed:', err);
      const msg = err.message || '';
      if (msg.includes('already registered') || msg.includes('DUPLICATE_TRACKING_CODE')) {
        setFieldErrors(prev => ({
          ...prev,
          tracking_code: `Tracking code "${formData.tracking_code}" is already in use. Each evidence item must have a unique identifier.`
        }));
      } else {
        setGeneralError(msg || 'An error occurred during evidence intake submission.');
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
        className="forensic-card accent-orange-border"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-evidence-title"
        style={{
          maxWidth: '660px',
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
              <span style={{ fontSize: '1.1rem' }}>📦</span>
              <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--accent-orange)', fontWeight: '700' }}>
                FORENSIC CHAIN OF CUSTODY INTAKE
              </span>
            </div>
            <h2 id="add-evidence-title" style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-primary)' }}>
              Ingest <span style={{ color: 'var(--accent-orange)' }}>Forensic Evidence</span>
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

        {/* Ingestion Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Associated Case Selector */}
          <div>
            <label htmlFor="evidence_case_id" style={{
              display: 'block',
              fontSize: '0.72rem',
              fontWeight: '700',
              textTransform: 'uppercase',
              color: fieldErrors.case_id ? '#ff5252' : 'var(--text-secondary)',
              marginBottom: '0.35rem'
            }}>
              Associated Investigation Case *
            </label>
            {cases.length > 0 ? (
              <select
                id="evidence_case_id"
                name="case_id"
                value={formData.case_id}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.8rem',
                  backgroundColor: 'var(--bg-input)',
                  border: `1px solid ${fieldErrors.case_id ? '#ff5252' : 'var(--border-default)'}`,
                  borderRadius: '4px',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              >
                {cases.map(c => (
                  <option key={c.case_id} value={c.case_id}>
                    #{c.case_number} — {c.title}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="evidence_case_id"
                type="text"
                readOnly
                value={caseNumber ? `Case #${caseNumber} (ID: ${formData.case_id})` : `Case ID: ${formData.case_id}`}
                className="mono"
                style={{
                  width: '100%',
                  padding: '0.65rem 0.8rem',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '4px',
                  color: 'var(--accent-orange)',
                  fontSize: '0.85rem'
                }}
              />
            )}
            {fieldErrors.case_id && (
              <div style={{ fontSize: '0.7rem', color: '#ff5252', marginTop: '0.25rem', fontFamily: 'var(--font-mono)' }}>
                {fieldErrors.case_id}
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label htmlFor="tracking_code" style={{
                display: 'block',
                fontSize: '0.72rem',
                fontWeight: '700',
                textTransform: 'uppercase',
                color: fieldErrors.tracking_code ? '#ff5252' : 'var(--text-secondary)',
                marginBottom: '0.35rem'
              }}>
                Tracking Code / Barcode *
              </label>
              <input
                id="tracking_code"
                type="text"
                name="tracking_code"
                value={formData.tracking_code}
                onChange={handleChange}
                placeholder="e.g. EVD-2026-0099"
                className="mono"
                style={{
                  width: '100%',
                  padding: '0.65rem 0.8rem',
                  backgroundColor: 'var(--bg-input)',
                  border: `1px solid ${fieldErrors.tracking_code ? '#ff5252' : 'var(--border-default)'}`,
                  borderRadius: '4px',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              />
              {fieldErrors.tracking_code && (
                <div style={{ fontSize: '0.7rem', color: '#ff5252', marginTop: '0.25rem', fontFamily: 'var(--font-mono)' }}>
                  {fieldErrors.tracking_code}
                </div>
              )}
            </div>

            <div>
              <label htmlFor="category" style={{
                display: 'block',
                fontSize: '0.72rem',
                fontWeight: '700',
                textTransform: 'uppercase',
                color: 'var(--text-secondary)',
                marginBottom: '0.35rem'
              }}>
                Evidence Category *
              </label>
              <select
                id="category"
                name="category"
                value={formData.category}
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
                <option value="CCTV">CCTV Surveillance Footage</option>
                <option value="PHONE_RECORD">Telephony / Call Record</option>
                <option value="VEHICLE">Vehicle / Automotive Record</option>
                <option value="PHYSICAL">Physical Ballistics / Trace Marker</option>
                <option value="DIGITAL">Digital Storage / Encrypted Files</option>
                <option value="FORENSIC_BIO">Biological DNA / Fingerprint</option>
                <option value="DOCUMENT">Documentary Evidence / Ledger</option>
                <option value="LOCATION">GPS Fix / Perimeter Beacon</option>
                <option value="FINANCIAL">Financial Transaction Record</option>
                <option value="WEAPON">Weapon / Tool Mark</option>
                <option value="TESTIMONY_TRANSCRIPT">Witness / Informant Transcript</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="evidence_title" style={{
              display: 'block',
              fontSize: '0.72rem',
              fontWeight: '700',
              textTransform: 'uppercase',
              color: fieldErrors.title ? '#ff5252' : 'var(--text-secondary)',
              marginBottom: '0.35rem'
            }}>
              Evidence Item Title *
            </label>
            <input
              id="evidence_title"
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g. Depository Security Cam 4 - Loading Dock Sighting"
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

          {/* Classification & Verification Ground Truth Distinction */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label htmlFor="verification_status" style={{
                display: 'block',
                fontSize: '0.72rem',
                fontWeight: '700',
                textTransform: 'uppercase',
                color: 'var(--text-secondary)',
                marginBottom: '0.35rem'
              }}>
                Forensic Classification *
              </label>
              <select
                id="verification_status"
                name="verification_status"
                value={formData.verification_status}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.8rem',
                  backgroundColor: 'var(--bg-input)',
                  border: formData.verification_status === 'CONFIRMED_FACT'
                    ? '1px solid var(--status-verified)'
                    : '1px solid var(--status-high)',
                  borderRadius: '4px',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  outline: 'none'
                }}
              >
                <option value="CONFIRMED_FACT">CONFIRMED_FACT (Forensic Ground Truth)</option>
                <option value="UNVERIFIED_OBSERVATION">UNVERIFIED_OBSERVATION (Tip / Claim)</option>
                <option value="HYPOTHESIS">HYPOTHESIS (Investigator Working Theory)</option>
              </select>
            </div>

            <div>
              <label htmlFor="reliability_assessment" style={{
                display: 'block',
                fontSize: '0.72rem',
                fontWeight: '700',
                textTransform: 'uppercase',
                color: 'var(--text-secondary)',
                marginBottom: '0.35rem'
              }}>
                Reliability Assessment *
              </label>
              <select
                id="reliability_assessment"
                name="reliability_assessment"
                value={formData.reliability_assessment}
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
                <option value="HIGH">HIGH (Multi-sensor / Lab Verified)</option>
                <option value="MEDIUM">MEDIUM (Standard Corroboration)</option>
                <option value="LOW">LOW (Single Source / Anonymous)</option>
                <option value="QUESTIONABLE">QUESTIONABLE (Contradicted Data)</option>
                <option value="PENDING_LAB">PENDING_LAB (Under Forensic Processing)</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label htmlFor="source" style={{
                display: 'block',
                fontSize: '0.72rem',
                fontWeight: '700',
                textTransform: 'uppercase',
                color: fieldErrors.source ? '#ff5252' : 'var(--text-secondary)',
                marginBottom: '0.35rem'
              }}>
                Source / Provenance *
              </label>
              <input
                id="source"
                type="text"
                name="source"
                value={formData.source}
                onChange={handleChange}
                placeholder="e.g. Metro Transit Optical Server 4"
                style={{
                  width: '100%',
                  padding: '0.65rem 0.8rem',
                  backgroundColor: 'var(--bg-input)',
                  border: `1px solid ${fieldErrors.source ? '#ff5252' : 'var(--border-default)'}`,
                  borderRadius: '4px',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              />
              {fieldErrors.source && (
                <div style={{ fontSize: '0.7rem', color: '#ff5252', marginTop: '0.25rem', fontFamily: 'var(--font-mono)' }}>
                  {fieldErrors.source}
                </div>
              )}
            </div>

            <div>
              <label htmlFor="collection_location" style={{
                display: 'block',
                fontSize: '0.72rem',
                fontWeight: '700',
                textTransform: 'uppercase',
                color: 'var(--text-secondary)',
                marginBottom: '0.35rem'
              }}>
                Collection Location
              </label>
              <input
                id="collection_location"
                type="text"
                name="collection_location"
                value={formData.collection_location}
                onChange={handleChange}
                placeholder="e.g. 450 Financial Blvd, Dock Gate 4"
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
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label htmlFor="collected_at" style={{
                display: 'block',
                fontSize: '0.72rem',
                fontWeight: '700',
                textTransform: 'uppercase',
                color: 'var(--text-secondary)',
                marginBottom: '0.35rem'
              }}>
                Collection / Event Timestamp
              </label>
              <input
                id="collected_at"
                type="datetime-local"
                name="collected_at"
                value={formData.collected_at}
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
              />
            </div>

            <div>
              <label htmlFor="file_reference" style={{
                display: 'block',
                fontSize: '0.72rem',
                fontWeight: '700',
                textTransform: 'uppercase',
                color: 'var(--text-secondary)',
                marginBottom: '0.35rem'
              }}>
                File Reference / Cryptographic Hash
              </label>
              <input
                id="file_reference"
                type="text"
                name="file_reference"
                value={formData.file_reference}
                onChange={handleChange}
                placeholder="e.g. sha256:7f83b1657ff1... or /vault/cctv_04.mp4"
                className="mono"
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
              />
            </div>
          </div>

          <div>
            <label htmlFor="evidence_description" style={{
              display: 'block',
              fontSize: '0.72rem',
              fontWeight: '700',
              textTransform: 'uppercase',
              color: fieldErrors.description ? '#ff5252' : 'var(--text-secondary)',
              marginBottom: '0.35rem'
            }}>
              Forensic Description & Physical Attributes *
            </label>
            <textarea
              id="evidence_description"
              name="description"
              rows={3}
              value={formData.description}
              onChange={handleChange}
              placeholder="Record forensic details, model numbers, ballistic calibre, recovered condition, or telemetry payload..."
              style={{
                width: '100%',
                padding: '0.65rem 0.8rem',
                backgroundColor: 'var(--bg-input)',
                border: `1px solid ${fieldErrors.description ? '#ff5252' : 'var(--border-default)'}`,
                borderRadius: '4px',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                fontFamily: 'inherit',
                resize: 'vertical',
                outline: 'none'
              }}
            />
            {fieldErrors.description && (
              <div style={{ fontSize: '0.7rem', color: '#ff5252', marginTop: '0.25rem', fontFamily: 'var(--font-mono)' }}>
                {fieldErrors.description}
              </div>
            )}
          </div>

          <div>
            <label htmlFor="chain_of_custody_notes" style={{
              display: 'block',
              fontSize: '0.72rem',
              fontWeight: '700',
              textTransform: 'uppercase',
              color: 'var(--text-secondary)',
              marginBottom: '0.35rem'
            }}>
              Chain of Custody Notes
            </label>
            <input
              id="chain_of_custody_notes"
              type="text"
              name="chain_of_custody_notes"
              value={formData.chain_of_custody_notes}
              onChange={handleChange}
              placeholder="e.g. Tamper-evident evidence pouch #TEP-4402 sealed by CSI Detective"
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
            />
          </div>

          <div>
            <label htmlFor="metadata_json" style={{
              display: 'block',
              fontSize: '0.72rem',
              fontWeight: '700',
              textTransform: 'uppercase',
              color: fieldErrors.metadata_json ? '#ff5252' : 'var(--text-secondary)',
              marginBottom: '0.35rem'
            }}>
              Structured Forensic Metadata / Telemetry (Optional JSON)
            </label>
            <input
              id="metadata_json"
              type="text"
              name="metadata_json"
              value={formData.metadata_json}
              onChange={handleChange}
              placeholder='e.g. {"license_plate": "7XYZ99", "imei": "358921094821034"}'
              className="mono"
              style={{
                width: '100%',
                padding: '0.65rem 0.8rem',
                backgroundColor: 'var(--bg-input)',
                border: `1px solid ${fieldErrors.metadata_json ? '#ff5252' : 'var(--border-default)'}`,
                borderRadius: '4px',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                outline: 'none'
              }}
            />
            {fieldErrors.metadata_json && (
              <div style={{ fontSize: '0.7rem', color: '#ff5252', marginTop: '0.25rem', fontFamily: 'var(--font-mono)' }}>
                {fieldErrors.metadata_json}
              </div>
            )}
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
                backgroundColor: 'var(--accent-orange)',
                borderColor: '#e65100',
                opacity: submitting ? 0.7 : 1
              }}
            >
              {submitting ? 'Ingesting Evidence...' : '📦 Commit Evidence to Dossier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

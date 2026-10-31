import React, { useState } from 'react';
import api from '../services/api';

/**
 * @component AddEvidenceModal
 * @description Modal dialog for ingesting forensic evidence records into a case file.
 * Preserves chain-of-custody tracking and partitions confirmed facts from unverified observations.
 */
export default function AddEvidenceModal({ isOpen, onClose, caseId, caseNumber, onEvidenceAdded }) {
  const defaultTrackingCode = `EVD-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const [formData, setFormData] = useState({
    tracking_code: defaultTrackingCode,
    title: '',
    category: 'CCTV',
    description: '',
    source: '',
    collection_location: '',
    collected_at: new Date().toISOString().slice(0, 16),
    verification_status: 'CONFIRMED_FACT',
    reliability_assessment: 'HIGH',
    chain_of_custody_notes: ''
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

    // Form Validations
    if (!formData.tracking_code.trim()) {
      setError('Evidence tracking code is required.');
      return;
    }
    if (!formData.title.trim()) {
      setError('Evidence title is required.');
      return;
    }
    if (!formData.description.trim()) {
      setError('Forensic description is required.');
      return;
    }
    if (!formData.source.trim()) {
      setError('Source / Chain-of-custody origin is required.');
      return;
    }
    if (!caseId) {
      setError('No active case target specified.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        case_id: parseInt(caseId, 10),
        tracking_code: formData.tracking_code.trim(),
        title: formData.title.trim(),
        category: formData.category,
        description: formData.description.trim(),
        source: formData.source.trim(),
        collection_location: formData.collection_location.trim() || undefined,
        collected_at: formData.collected_at ? formData.collected_at.replace('T', ' ') + ':00' : undefined,
        verification_status: formData.verification_status,
        reliability_assessment: formData.reliability_assessment,
        chain_of_custody_notes: formData.chain_of_custody_notes.trim() || undefined
      };

      const res = await api.addEvidence(payload);

      if (res && res.success) {
        setSuccessMsg(`Evidence item [${formData.tracking_code}] ingested successfully.`);
        setTimeout(() => {
          if (onEvidenceAdded) {
            onEvidenceAdded(res.data);
          }
          if (onClose) {
            onClose();
          }
        }, 600);
      } else {
        throw new Error(res.error?.message || 'Evidence intake rejected by server.');
      }
    } catch (err) {
      console.error('Evidence submission failed:', err);
      setError(err.message || 'An error occurred during evidence ingestion.');
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
      <div className="forensic-card accent-orange-border" style={{
        maxWidth: '640px',
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
              <span style={{ fontSize: '1.1rem' }}>📦</span>
              <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--accent-orange)', fontWeight: '700' }}>
                FORENSIC CHAIN OF CUSTODY INGESTION
              </span>
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-primary)' }}>
              Ingest <span style={{ color: 'var(--accent-orange)' }}>Forensic Evidence</span>
            </h2>
            {caseNumber && (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem', fontFamily: 'var(--font-mono)' }}>
                Target File: #{caseNumber} (ID: {caseId})
              </p>
            )}
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

        {/* Ingestion Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Tracking Barcode / Code *
              </label>
              <input
                type="text"
                name="tracking_code"
                value={formData.tracking_code}
                onChange={handleChange}
                placeholder="e.g. EVD-2026-0042"
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
                Evidence Category *
              </label>
              <select
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
                  fontSize: '0.85rem'
                }}
              >
                <option value="CCTV">CCTV Surveillance Footage</option>
                <option value="PHONE_RECORD">Telephony / Cell Telemetry</option>
                <option value="VEHICLE">Automotive / Vehicle Record</option>
                <option value="PHYSICAL">Physical Ballistic / Trace Marker</option>
                <option value="DIGITAL">Digital Storage / Encrypted Files</option>
                <option value="FORENSIC_BIO">Biological DNA / Latent Fingerprint</option>
                <option value="DOCUMENT">Official Document / Flight Manifest</option>
                <option value="LOCATION">GPS Geographic Fix / Perimeter Beacon</option>
                <option value="FINANCIAL">Financial Transaction / Ledger</option>
                <option value="WEAPON">Weapon / Tool Mark</option>
                <option value="TESTIMONY_TRANSCRIPT">Witness / Informant Transcript</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              Evidence Item Title *
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g. CCTV Camera 4 - Depository North Loading Bay"
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

          {/* Classification & Verification Status Partition */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Forensic Classification *
              </label>
              <select
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
                  fontWeight: '600'
                }}
              >
                <option value="CONFIRMED_FACT">CONFIRMED_FACT (Forensic Ground Truth)</option>
                <option value="UNVERIFIED_OBSERVATION">UNVERIFIED_OBSERVATION (Tip / Claim)</option>
                <option value="HYPOTHESIS">HYPOTHESIS (Investigator Working Theory)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Reliability Assessment *
              </label>
              <select
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
                  fontSize: '0.85rem'
                }}
              >
                <option value="HIGH">HIGH (Multi-sensor / Lab Verified)</option>
                <option value="MEDIUM">MEDIUM (Standard Corroboration)</option>
                <option value="LOW">LOW (Single Source / Anonymous)</option>
                <option value="QUESTIONABLE">QUESTIONABLE (Conflicting Details)</option>
                <option value="PENDING_LAB">PENDING_LAB (Under Forensic Processing)</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Chain of Custody Source / Provenance *
              </label>
              <input
                type="text"
                name="source"
                value={formData.source}
                onChange={handleChange}
                placeholder="e.g. Metro Security Ops Center Server 2"
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
                Collection Location
              </label>
              <input
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
                  fontSize: '0.85rem'
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              Collection / Incident Timestamp
            </label>
            <input
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
                fontSize: '0.85rem'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              Forensic Item Description & Detailed Notes *
            </label>
            <textarea
              name="description"
              rows={3}
              value={formData.description}
              onChange={handleChange}
              placeholder="Record forensic markings, condition upon recovery, technical metadata, resolution, or recovery context..."
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

          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              Chain of Custody Notes
            </label>
            <input
              type="text"
              name="chain_of_custody_notes"
              value={formData.chain_of_custody_notes}
              onChange={handleChange}
              placeholder="e.g. Secured in tamper-evident bag #TEB-991, sealed by Forensic Tech Ortiz"
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

import React, { useState, useEffect } from 'react';
import api from '../services/api';

/**
 * @component AddRelationshipModal
 * @description Apple-inspired modal dialog for recording an official or explainable relationship
 * between two investigation nodes (evidence, suspect, victim, witness, location, etc.).
 */
export default function AddRelationshipModal({ isOpen, onClose, caseId, nodes = [], onRelationshipAdded }) {
  const [formData, setFormData] = useState({
    source_node_id: '',
    target_node_id: '',
    relation_type: 'DEPICTED_IN',
    relationship_nature: 'CONFIRMED_FACT',
    confidence_weight: 0.85,
    notes: ''
  });

  const [fieldErrors, setFieldErrors] = useState({});
  const [generalError, setGeneralError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        source_node_id: nodes.length > 0 ? String(nodes[0].node_id) : '',
        target_node_id: nodes.length > 1 ? String(nodes[1].node_id) : (nodes.length > 0 ? String(nodes[0].node_id) : ''),
        relation_type: 'DEPICTED_IN',
        relationship_nature: 'CONFIRMED_FACT',
        confidence_weight: 0.85,
        notes: ''
      });
      setFieldErrors({});
      setGeneralError(null);
      setSubmitting(false);
    }
  }, [isOpen, nodes]);

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
    if (formData.source_node_id === '') {
      errors.source_node_id = 'Source entity/evidence node is required.';
    }
    if (formData.target_node_id === '') {
      errors.target_node_id = 'Target entity/evidence node is required.';
    }
    if (formData.source_node_id === formData.target_node_id) {
      errors.target_node_id = 'Source and target must be distinct nodes.';
    }
    if (!formData.relation_type.trim()) {
      errors.relation_type = 'Relationship classification type is required.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'confidence_weight' ? parseFloat(value) : value
    }));
    if (fieldErrors[name]) {
      setFieldErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const sourceNode = nodes.find(n => String(n.node_id) === String(formData.source_node_id));
    const targetNode = nodes.find(n => String(n.node_id) === String(formData.target_node_id));

    if (!sourceNode || !targetNode) {
      setGeneralError('Selected nodes could not be found in active graph topology.');
      return;
    }

    try {
      setSubmitting(true);
      setGeneralError(null);

      const payload = {
        source_type: sourceNode.entity_type,
        source_id: sourceNode.db_id || sourceNode.node_id,
        target_type: targetNode.entity_type,
        target_id: targetNode.db_id || targetNode.node_id,
        relation_type: formData.relation_type.trim().toUpperCase(),
        confidence_weight: formData.confidence_weight,
        relationship_nature: formData.relationship_nature,
        notes: formData.notes.trim() || undefined
      };

      const res = await api.createRelationship(caseId, payload);
      if (res && res.success) {
        if (onRelationshipAdded) {
          onRelationshipAdded(res.data);
        }
        onClose();
      } else {
        setGeneralError(res?.error?.message || 'Failed to record relationship.');
      }
    } catch (err) {
      setGeneralError(err.message || 'An error occurred while linking nodes.');
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
        maxWidth: '580px',
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
              <span style={{ fontSize: '1.2rem' }}>🔗</span>
              <h2 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                Establish Relational Connection
              </h2>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.3rem 0 0 0' }}>
              Link entities, evidence, and events. Grounded in investigative evidence with confidence weighting.
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

          {/* Source Node */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
              Source Entity / Evidence <span style={{ color: 'var(--accent-red)' }}>*</span>
            </label>
            <select
              name="source_node_id"
              value={formData.source_node_id}
              onChange={handleChange}
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-tertiary)',
                border: `1px solid ${fieldErrors.source_node_id ? 'var(--accent-red)' : 'var(--border-default)'}`,
                borderRadius: '8px',
                padding: '0.65rem 0.85rem',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                outline: 'none'
              }}
            >
              <option value="">Select source node...</option>
              {nodes.map(n => (
                <option key={n.node_id} value={String(n.node_id)}>
                  [{n.entity_type}] {n.label}
                </option>
              ))}
            </select>
            {fieldErrors.source_node_id && (
              <span style={{ fontSize: '0.75rem', color: 'var(--accent-red)', marginTop: '0.25rem', display: 'block' }}>
                {fieldErrors.source_node_id}
              </span>
            )}
          </div>

          {/* Target Node */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
              Target Entity / Evidence <span style={{ color: 'var(--accent-red)' }}>*</span>
            </label>
            <select
              name="target_node_id"
              value={formData.target_node_id}
              onChange={handleChange}
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-tertiary)',
                border: `1px solid ${fieldErrors.target_node_id ? 'var(--accent-red)' : 'var(--border-default)'}`,
                borderRadius: '8px',
                padding: '0.65rem 0.85rem',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                outline: 'none'
              }}
            >
              <option value="">Select target node...</option>
              {nodes.map(n => (
                <option key={n.node_id} value={String(n.node_id)}>
                  [{n.entity_type}] {n.label}
                </option>
              ))}
            </select>
            {fieldErrors.target_node_id && (
              <span style={{ fontSize: '0.75rem', color: 'var(--accent-red)', marginTop: '0.25rem', display: 'block' }}>
                {fieldErrors.target_node_id}
              </span>
            )}
          </div>

          {/* Relationship Type & Nature in 2 Columns */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                Relationship Type <span style={{ color: 'var(--accent-red)' }}>*</span>
              </label>
              <select
                name="relation_type"
                value={formData.relation_type}
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
                <option value="DEPICTED_IN">DEPICTED_IN (Visual Corroboration)</option>
                <option value="OWNS_VEHICLE">OWNS_VEHICLE (Registered Ownership)</option>
                <option value="PHONE_CALL_ROUTING">PHONE_CALL_ROUTING (Telecom Traffic)</option>
                <option value="BROTHER_ASSOCIATE">BROTHER_ASSOCIATE (Known Associate)</option>
                <option value="PRESENT_AT">PRESENT_AT (Physical Co-location)</option>
                <option value="CONTRACTOR_CREDENTIAL_MATCH">CONTRACTOR_CREDENTIAL_MATCH</option>
                <option value="CORROBORATES_DEPARTURE">CORROBORATES_DEPARTURE</option>
                <option value="TERMINAL_OWNER">TERMINAL_OWNER (Digital Device)</option>
                <option value="FINANCIAL_TRANSFER">FINANCIAL_TRANSFER (Monetary Flow)</option>
                <option value="SUSPECT_LINK">SUSPECT_LINK (Direct Link)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                Relational Ground Truth <span style={{ color: 'var(--accent-red)' }}>*</span>
              </label>
              <select
                name="relationship_nature"
                value={formData.relationship_nature}
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
                <option value="CONFIRMED_FACT">Confirmed Fact (Directly Documented)</option>
                <option value="UNVERIFIED_OBSERVATION">Unverified Observation</option>
                <option value="HYPOTHESIS">Hypothesis (Investigative Theory)</option>
              </select>
            </div>
          </div>

          {/* Confidence Weight Slider */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                Confidence Weight
              </label>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--accent-blue)', fontWeight: '700' }}>
                {Math.round(formData.confidence_weight * 100)}%
              </span>
            </div>
            <input
              type="range"
              name="confidence_weight"
              min="0.10"
              max="1.00"
              step="0.05"
              value={formData.confidence_weight}
              onChange={handleChange}
              style={{ width: '100%', cursor: 'pointer' }}
            />
          </div>

          {/* Notes / Supporting Evidence */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
              Forensic Justification / Supporting Record Notes
            </label>
            <textarea
              name="notes"
              rows={3}
              value={formData.notes}
              onChange={handleChange}
              placeholder="e.g. Subpoenaed tower logs and eyewitness statement confirm timing..."
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
              {submitting ? 'Linking in C Engine...' : 'Save & Link Records'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

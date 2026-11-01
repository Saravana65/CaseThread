import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

/**
 * @component EvidenceIntegrityPanel
 * @description Forensic Evidence Integrity Dashboard providing SHA-256 fingerprint verification,
 * tamper-evident audit hash chain inspection, version history tracking, and chain-of-custody transfers.
 */
export default function EvidenceIntegrityPanel({ selectedCaseId, officer, onOpenReport }) {
  const [evidenceList, setEvidenceList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successNotice, setSuccessNotice] = useState(null);

  // Active item modals
  const [verifyingId, setVerifyingId] = useState(null);
  const [activeItem, setActiveItem] = useState(null);

  // Modals state
  const [auditChainModalOpen, setAuditChainModalOpen] = useState(false);
  const [auditChainData, setAuditChainData] = useState(null);
  const [auditLoading, setAuditLoading] = useState(false);

  const [versionModalOpen, setVersionModalOpen] = useState(false);
  const [versionData, setVersionData] = useState(null);
  const [versionLoading, setVersionLoading] = useState(false);

  const [custodyDrawerOpen, setCustodyDrawerOpen] = useState(false);
  const [custodyData, setCustodyData] = useState(null);
  const [custodyLoading, setCustodyLoading] = useState(false);
  const [transferFormData, setTransferFormData] = useState({
    to_officer_id: '',
    purpose_of_transfer: '',
    transfer_reason: '',
    custody_action: 'TRANSFERRED_FOR_ANALYSIS',
    location: ''
  });
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const [transferError, setTransferError] = useState(null);

  const [copiedHash, setCopiedHash] = useState(null);

  // Fetch evidence for active case
  const fetchCaseEvidence = useCallback(async () => {
    if (!selectedCaseId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await api.getEvidenceByCase(selectedCaseId);
      setEvidenceList(res.data || []);
    } catch (err) {
      setError(err.message || 'Failed to retrieve evidence items');
    } finally {
      setLoading(false);
    }
  }, [selectedCaseId]);

  useEffect(() => {
    fetchCaseEvidence();
  }, [fetchCaseEvidence]);

  // Compute metrics
  const totalCount = evidenceList.length;
  const fingerprintedCount = evidenceList.filter(e => e.sha256_fingerprint).length;
  const verifiedIntactCount = evidenceList.filter(e => e.integrity_status === 'INTACT').length;
  const mismatchCount = evidenceList.filter(e => e.integrity_status === 'TAMPERED_MISMATCH').length;
  const pendingCount = evidenceList.filter(e => !e.integrity_status || e.integrity_status === 'PENDING').length;

  // 1. Verify Evidence Integrity Action
  const handleVerifyIntegrity = async (evidenceItem) => {
    try {
      setVerifyingId(evidenceItem.evidence_id);
      setError(null);
      setSuccessNotice(null);

      const res = await api.verifyEvidenceIntegrity(evidenceItem.evidence_id);
      const result = res.data;

      // Update local item
      setEvidenceList(prev => prev.map(item => {
        if (item.evidence_id === evidenceItem.evidence_id) {
          return {
            ...item,
            integrity_status: result.integrity_status,
            last_verified_at: result.verified_at
          };
        }
        return item;
      }));

      if (result.integrity_status === 'INTACT') {
        setSuccessNotice(`✓ Evidence [${evidenceItem.tracking_code}] verified INTACT against SHA-256 fingerprint.`);
      } else {
        setError(`⚠ INTEGRITY MISMATCH DETECTED for [${evidenceItem.tracking_code}]! ${result.message}`);
      }
    } catch (err) {
      setError(`Integrity check failed: ${err.message}`);
    } finally {
      setVerifyingId(null);
    }
  };

  // 2. Open Audit Chain Modal
  const handleOpenAuditChain = async (item) => {
    setActiveItem(item);
    setAuditChainModalOpen(true);
    setAuditLoading(true);
    try {
      const res = await api.getEvidenceAuditChain(item.evidence_id);
      setAuditChainData(res.data);
    } catch (err) {
      setAuditChainData({ error: err.message });
    } finally {
      setAuditLoading(false);
    }
  };

  // 3. Open Version History Modal
  const handleOpenVersions = async (item) => {
    setActiveItem(item);
    setVersionModalOpen(true);
    setVersionLoading(true);
    try {
      const res = await api.getEvidenceVersions(item.evidence_id);
      setVersionData(res.data);
    } catch (err) {
      setVersionData({ error: err.message });
    } finally {
      setVersionLoading(false);
    }
  };

  // 4. Open Custody Drawer
  const handleOpenCustody = async (item) => {
    setActiveItem(item);
    setCustodyDrawerOpen(true);
    setCustodyLoading(true);
    setTransferError(null);
    setTransferFormData({
      to_officer_id: '',
      purpose_of_transfer: '',
      transfer_reason: '',
      custody_action: 'TRANSFERRED_FOR_ANALYSIS',
      location: item.collection_location || 'Forensics Crime Lab'
    });
    try {
      const res = await api.getCustodyHistory(item.evidence_id);
      setCustodyData(res.data);
    } catch (err) {
      setCustodyData({ error: err.message });
    } finally {
      setCustodyLoading(false);
    }
  };

  // Submit Custody Transfer
  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    if (!transferFormData.to_officer_id || !transferFormData.purpose_of_transfer) {
      setTransferError('Receiving officer ID and transfer purpose are required.');
      return;
    }

    try {
      setTransferSubmitting(true);
      setTransferError(null);

      await api.transferCustody({
        evidence_id: activeItem.evidence_id,
        to_officer_id: parseInt(transferFormData.to_officer_id, 10),
        purpose_of_transfer: transferFormData.purpose_of_transfer,
        transfer_reason: transferFormData.transfer_reason || transferFormData.purpose_of_transfer,
        custody_action: transferFormData.custody_action,
        location: transferFormData.location
      });

      // Reload custody data
      const res = await api.getCustodyHistory(activeItem.evidence_id);
      setCustodyData(res.data);
      setSuccessNotice(`Custody transfer recorded for [${activeItem.tracking_code}].`);

      // Reset form
      setTransferFormData(prev => ({
        ...prev,
        to_officer_id: '',
        purpose_of_transfer: '',
        transfer_reason: ''
      }));
    } catch (err) {
      setTransferError(err.message || 'Failed to submit custody transfer');
    } finally {
      setTransferSubmitting(false);
    }
  };

  // Copy hash helper
  const handleCopyHash = (hash, id) => {
    if (!hash) return;
    navigator.clipboard.writeText(hash);
    setCopiedHash(id);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '0 2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header and Controls */}
      <div className="forensic-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.4rem' }}>🛡️</span>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-primary)' }}>
                Forensic Evidence Integrity & Custody Management
              </h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '0.15rem' }}>
                CRYPTOGRAPHIC SHA-256 FINGERPRINTS • IMMUTABLE AUDIT HASH CHAINING • PROVENANCE TRACEABILITY
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            onClick={fetchCaseEvidence}
            className="btn-secondary"
            disabled={loading}
            style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <span>🔄</span> Refresh
          </button>
          {onOpenReport && (
            <button
              onClick={onOpenReport}
              className="btn-primary"
              style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <span>📄</span> Export Case Dossier
            </button>
          )}
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div style={{
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid var(--accent-red)',
          color: 'var(--accent-red)',
          padding: '0.75rem 1rem',
          borderRadius: '6px',
          fontSize: '0.82rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div><strong>Notice:</strong> {error}</div>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
        </div>
      )}

      {successNotice && (
        <div style={{
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid var(--accent-green)',
          color: 'var(--accent-green)',
          padding: '0.75rem 1rem',
          borderRadius: '6px',
          fontSize: '0.82rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>{successNotice}</div>
          <button onClick={() => setSuccessNotice(null)} style={{ background: 'none', border: 'none', color: 'var(--accent-green)', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
        </div>
      )}

      {/* Metrics Banner */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '1rem'
      }}>
        <div className="forensic-card" style={{ borderLeft: '4px solid var(--border-default)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
            Total Evidence Records
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--text-primary)', marginTop: '0.2rem' }}>
            {totalCount}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            Ingested into Case #{selectedCaseId}
          </div>
        </div>

        <div className="forensic-card" style={{ borderLeft: '4px solid var(--accent-orange)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
            SHA-256 Fingerprinted
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--accent-orange)', marginTop: '0.2rem' }}>
            {fingerprintedCount}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            {totalCount ? Math.round((fingerprintedCount / totalCount) * 100) : 0}% Cryptographically Sealed
          </div>
        </div>

        <div className="forensic-card" style={{ borderLeft: '4px solid var(--accent-green)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
            Verified Intact
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--accent-green)', marginTop: '0.2rem' }}>
            {verifiedIntactCount}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            Zero Hash Mismatches
          </div>
        </div>

        <div className="forensic-card" style={{ borderLeft: `4px solid ${mismatchCount > 0 ? 'var(--accent-red)' : 'var(--border-default)'}` }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
            Integrity Alerts
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: '800', color: mismatchCount > 0 ? 'var(--accent-red)' : 'var(--text-muted)', marginTop: '0.2rem' }}>
            {mismatchCount}
          </div>
          <div style={{ fontSize: '0.7rem', color: mismatchCount > 0 ? 'var(--accent-red)' : 'var(--text-secondary)', marginTop: '0.2rem' }}>
            {mismatchCount > 0 ? 'TAMPERED / MISMATCHED' : 'No Tampering Detected'}
          </div>
        </div>

        <div className="forensic-card" style={{ borderLeft: '4px solid #b388ff' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
            Awaiting Verification
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#b388ff', marginTop: '0.2rem' }}>
            {pendingCount}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            Pending Investigator Signature
          </div>
        </div>
      </div>

      {/* Evidence Table */}
      <div className="forensic-card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Case Evidence Inventory & Integrity Ledger
          </h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {evidenceList.length} ITEMS CATALOGED
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-input)', borderBottom: '1px solid var(--border-default)', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>
                <th style={{ padding: '0.75rem 1rem' }}>Tracking Code & Title</th>
                <th style={{ padding: '0.75rem 1rem' }}>Category & Type</th>
                <th style={{ padding: '0.75rem 1rem' }}>Version</th>
                <th style={{ padding: '0.75rem 1rem' }}>SHA-256 Fingerprint</th>
                <th style={{ padding: '0.75rem 1rem' }}>Integrity Status</th>
                <th style={{ padding: '0.75rem 1rem' }}>Last Verification</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Forensic Operations</th>
              </tr>
            </thead>
            <tbody>
              {evidenceList.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    {loading ? 'Retrieving case evidence catalog...' : 'No evidence records cataloged for this case file.'}
                  </td>
                </tr>
              ) : (
                evidenceList.map((item) => {
                  const isTampered = item.integrity_status === 'TAMPERED_MISMATCH';
                  const isIntact = item.integrity_status === 'INTACT';
                  const isVerifying = verifyingId === item.evidence_id;

                  return (
                    <tr
                      key={item.evidence_id}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        backgroundColor: isTampered ? 'rgba(239, 68, 68, 0.05)' : 'transparent',
                        transition: 'background-color 0.15s ease'
                      }}
                    >
                      {/* Tracking Code & Title */}
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', color: 'var(--accent-orange)' }}>
                          {item.tracking_code}
                        </div>
                        <div style={{ fontWeight: '600', color: 'var(--text-primary)', marginTop: '0.15rem' }}>
                          {item.title}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                          Source: {item.source || 'Scene Collection'}
                        </div>
                      </td>

                      {/* Category & Type */}
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <span style={{
                          fontSize: '0.68rem',
                          fontFamily: 'var(--font-mono)',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '3px',
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--text-primary)'
                        }}>
                          {item.category}
                        </span>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.3rem', fontFamily: 'var(--font-mono)' }}>
                          {item.fingerprint_type || 'METADATA_CANONICAL'}
                        </div>
                      </td>

                      {/* Version */}
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <span
                          onClick={() => handleOpenVersions(item)}
                          style={{
                            cursor: 'pointer',
                            display: 'inline-block',
                            padding: '0.15rem 0.45rem',
                            borderRadius: '3px',
                            fontSize: '0.72rem',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: '700',
                            backgroundColor: 'rgba(96, 165, 250, 0.15)',
                            color: '#60a5fa',
                            border: '1px solid rgba(96, 165, 250, 0.3)'
                          }}
                          title="Click to view version history diff"
                        >
                          V{item.current_version || 1} 🔍
                        </span>
                      </td>

                      {/* SHA-256 Fingerprint */}
                      <td style={{ padding: '0.85rem 1rem' }}>
                        {item.sha256_fingerprint ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <code
                              style={{
                                fontSize: '0.72rem',
                                padding: '0.2rem 0.4rem',
                                backgroundColor: 'var(--bg-card)',
                                border: '1px solid var(--border-default)',
                                borderRadius: '3px',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer'
                              }}
                              onClick={() => handleCopyHash(item.sha256_fingerprint, item.evidence_id)}
                              title={item.sha256_fingerprint}
                            >
                              {item.sha256_fingerprint.substring(0, 10)}...{item.sha256_fingerprint.substring(58)}
                            </code>
                            <button
                              onClick={() => handleCopyHash(item.sha256_fingerprint, item.evidence_id)}
                              className="btn-secondary"
                              style={{ fontSize: '0.65rem', padding: '0.15rem 0.35rem' }}
                              title="Copy full SHA-256 hash"
                            >
                              {copiedHash === item.evidence_id ? '✓' : '📋'}
                            </button>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>UNSEALED</span>
                        )}
                      </td>

                      {/* Integrity Status */}
                      <td style={{ padding: '0.85rem 1rem' }}>
                        {isIntact && (
                          <span className="badge badge-verified" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                            ✓ INTACT
                          </span>
                        )}
                        {isTampered && (
                          <span className="badge badge-critical" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', animation: 'pulse 1.5s infinite' }}>
                            ⚠ TAMPERED
                          </span>
                        )}
                        {!isIntact && !isTampered && (
                          <span className="badge badge-medium" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                            ● PENDING
                          </span>
                        )}
                      </td>

                      {/* Last Verification */}
                      <td style={{ padding: '0.85rem 1rem', fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {item.last_verified_at ? (
                          <div>{new Date(item.last_verified_at).toLocaleString()}</div>
                        ) : (
                          <span>Never verified</span>
                        )}
                      </td>

                      {/* Operations */}
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                          <button
                            onClick={() => handleVerifyIntegrity(item)}
                            disabled={isVerifying}
                            className="btn-primary"
                            style={{ fontSize: '0.7rem', padding: '0.3rem 0.55rem' }}
                            title="Recalculate SHA-256 and verify against original fingerprint"
                          >
                            {isVerifying ? 'Verifying...' : '🛡️ Verify'}
                          </button>
                          <button
                            onClick={() => handleOpenAuditChain(item)}
                            className="btn-secondary"
                            style={{ fontSize: '0.7rem', padding: '0.3rem 0.55rem' }}
                            title="Inspect cryptographic audit hash chain"
                          >
                            🔗 Chain
                          </button>
                          <button
                            onClick={() => handleOpenCustody(item)}
                            className="btn-secondary"
                            style={{ fontSize: '0.7rem', padding: '0.3rem 0.55rem' }}
                            title="Chain of custody provenance log and transfers"
                          >
                            🤝 Custody
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Academic Disclaimer Footer */}
      <div style={{
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-default)',
        borderRadius: '6px',
        padding: '1rem 1.25rem',
        fontSize: '0.75rem',
        color: 'var(--text-secondary)',
        lineHeight: 1.5
      }}>
        <div style={{ color: 'var(--accent-orange)', fontWeight: '700', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span>⚖️</span> ACADEMIC FORENSIC DECISION SUPPORT DISCLAIMER
        </div>
        <p>
          Cryptographic SHA-256 evidence fingerprinting, metadata canonicalization, and backward-linking audit hash chains provide rigorous bit-level tamper-evidence within the application database context. This system is designed as an academic decision-support framework to demonstrate cryptographic provenance architecture. It does NOT claim statutory forensic admissibility, compliance certification, or legal evidentiary guarantee without independent verification by sworn forensic personnel and court-recognized chain-of-custody protocols.
        </p>
      </div>

      {/* ========================================================================= */}
      {/* 1. AUDIT CHAIN VERIFICATION MODAL */}
      {/* ========================================================================= */}
      {auditChainModalOpen && (
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
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div className="forensic-card" style={{ maxWidth: '840px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-default)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                  Tamper-Evident Audit Hash Chain
                </h3>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  EVIDENCE: {activeItem?.tracking_code} • {activeItem?.title}
                </div>
              </div>
              <button
                onClick={() => setAuditChainModalOpen(false)}
                className="btn-secondary"
                style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}
              >
                ✕
              </button>
            </div>

            {auditLoading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                Validating cryptographic audit chain...
              </div>
            ) : auditChainData?.error ? (
              <div style={{ padding: '1rem', color: 'var(--accent-red)' }}>
                {auditChainData.error}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Status Seal */}
                <div style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '6px',
                  backgroundColor: auditChainData?.verification?.is_valid ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  border: `1px solid ${auditChainData?.verification?.is_valid ? 'var(--accent-green)' : 'var(--accent-red)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem'
                }}>
                  <span style={{ fontSize: '1.3rem' }}>{auditChainData?.verification?.is_valid ? '🛡️' : '⚠'}</span>
                  <div>
                    <div style={{ fontWeight: '700', color: auditChainData?.verification?.is_valid ? 'var(--accent-green)' : 'var(--accent-red)', fontSize: '0.85rem' }}>
                      {auditChainData?.verification?.is_valid ? 'CRYPTOGRAPHIC AUDIT CHAIN VALID & INTACT' : 'CHAIN LINKAGE VIOLATION / TAMPERING DETECTED'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {auditChainData?.verification?.message} ({auditChainData?.events_count || 0} events inspected from GENESIS_HASH)
                    </div>
                  </div>
                </div>

                {/* Head Hash Banner */}
                <div style={{
                  backgroundColor: 'var(--bg-input)',
                  padding: '0.6rem 0.8rem',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span>HEAD EVENT HASH:</span>
                  <span style={{ color: 'var(--accent-orange)' }}>
                    {auditChainData?.head_event_hash || 'GENESIS'}
                  </span>
                </div>

                {/* Chronological Event Tree */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {(auditChainData?.audit_chain || []).map((ev, idx) => (
                    <div
                      key={ev.audit_id || idx}
                      style={{
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border-default)',
                        borderRadius: '6px',
                        padding: '0.75rem',
                        fontSize: '0.78rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{
                            fontSize: '0.68rem',
                            fontFamily: 'var(--font-mono)',
                            padding: '0.15rem 0.45rem',
                            borderRadius: '3px',
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            color: 'var(--accent-orange)',
                            fontWeight: '700'
                          }}>
                            EVENT #{idx + 1}
                          </span>
                          <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
                            {ev.action_type}
                          </span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                            by Officer #{ev.officer_id}
                          </span>
                        </div>
                        <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>
                          {new Date(ev.created_at).toLocaleString()}
                        </span>
                      </div>

                      <div style={{ color: 'var(--text-secondary)', marginBottom: '0.4rem', fontSize: '0.75rem' }}>
                        <strong>Reason:</strong> {ev.reason_for_change || 'Standard forensic registration'}
                      </div>

                      {/* Hash Linkage Details */}
                      <div style={{
                        backgroundColor: 'var(--bg-card)',
                        padding: '0.4rem 0.6rem',
                        borderRadius: '4px',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.68rem',
                        color: 'var(--text-muted)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.2rem'
                      }}>
                        <div>
                          PREV HASH: <span style={{ color: 'var(--text-secondary)' }}>{ev.previous_event_hash || 'GENESIS'}</span>
                        </div>
                        <div>
                          THIS HASH: <span style={{ color: 'var(--accent-green)' }}>{ev.current_event_hash}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. VERSION HISTORY MODAL */}
      {/* ========================================================================= */}
      {versionModalOpen && (
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
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div className="forensic-card" style={{ maxWidth: '800px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-default)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                  Evidence Version History & Modification Log
                </h3>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  EVIDENCE: {activeItem?.tracking_code} • CURRENT ACTIVE VERSION: V{versionData?.current_version || 1}
                </div>
              </div>
              <button
                onClick={() => setVersionModalOpen(false)}
                className="btn-secondary"
                style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}
              >
                ✕
              </button>
            </div>

            {versionLoading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                Retrieving version history...
              </div>
            ) : versionData?.error ? (
              <div style={{ padding: '1rem', color: 'var(--accent-red)' }}>
                {versionData.error}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {(versionData?.versions || []).map((ver) => (
                  <div
                    key={ver.version_id}
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-default)',
                      borderRadius: '6px',
                      padding: '0.85rem',
                      fontSize: '0.8rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{
                          backgroundColor: 'rgba(96, 165, 250, 0.2)',
                          color: '#60a5fa',
                          fontWeight: '800',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '4px',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.75rem'
                        }}>
                          VERSION {ver.version_number}
                        </span>
                        <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
                          {ver.title}
                        </span>
                      </div>
                      <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>
                        {new Date(ver.created_at).toLocaleString()}
                      </span>
                    </div>

                    <div style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem', fontSize: '0.75rem' }}>
                      <strong>Reason for change:</strong> {ver.change_reason || 'Initial creation'} • Modified by: {ver.modified_by_officer_name || `Officer #${ver.modified_by_officer_id}`}
                    </div>

                    <div style={{
                      backgroundColor: 'var(--bg-input)',
                      padding: '0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)',
                      marginBottom: '0.5rem'
                    }}>
                      {ver.description}
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      <div>STATUS: <strong style={{ color: 'var(--text-primary)' }}>{ver.verification_status}</strong></div>
                      <div>RELIABILITY: <strong style={{ color: 'var(--text-primary)' }}>{ver.reliability_assessment}</strong></div>
                      <div>FINGERPRINT: <code style={{ color: 'var(--accent-orange)' }}>{ver.sha256_fingerprint ? ver.sha256_fingerprint.substring(0, 16) + '...' : 'NONE'}</code></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. CHAIN OF CUSTODY DRAWER */}
      {/* ========================================================================= */}
      {custodyDrawerOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          justifyContent: 'flex-end',
          zIndex: 1000
        }}>
          <div style={{
            maxWidth: '540px',
            width: '100%',
            height: '100%',
            backgroundColor: 'var(--bg-card)',
            borderLeft: '1px solid var(--border-default)',
            padding: '1.5rem',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-default)', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                  Chain of Custody Provenance
                </h3>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  EVIDENCE: {activeItem?.tracking_code}
                </div>
              </div>
              <button
                onClick={() => setCustodyDrawerOpen(false)}
                className="btn-secondary"
                style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}
              >
                ✕
              </button>
            </div>

            {/* Transfer Custody Form */}
            <form onSubmit={handleTransferSubmit} style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-default)',
              borderRadius: '6px',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}>
              <div style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--accent-orange)' }}>
                Transfer Custody / Change Location
              </div>

              {transferError && (
                <div style={{ color: 'var(--accent-red)', fontSize: '0.75rem' }}>
                  {transferError}
                </div>
              )}

              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>
                  Receiving Officer ID *
                </label>
                <input
                  type="number"
                  value={transferFormData.to_officer_id}
                  onChange={(e) => setTransferFormData({ ...transferFormData, to_officer_id: e.target.value })}
                  placeholder="e.g. 2"
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-default)',
                    color: 'var(--text-primary)',
                    padding: '0.4rem 0.6rem',
                    borderRadius: '4px',
                    fontSize: '0.8rem'
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>
                  Custody Action
                </label>
                <select
                  value={transferFormData.custody_action}
                  onChange={(e) => setTransferFormData({ ...transferFormData, custody_action: e.target.value })}
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-default)',
                    color: 'var(--text-primary)',
                    padding: '0.4rem 0.6rem',
                    borderRadius: '4px',
                    fontSize: '0.8rem'
                  }}
                >
                  <option value="TRANSFERRED_FOR_ANALYSIS">Transferred for Analysis</option>
                  <option value="CHECKED_OUT_FOR_COURT">Checked Out for Court</option>
                  <option value="RETURNED_TO_SECURE_STORAGE">Returned to Secure Storage</option>
                  <option value="RELEASED_TO_AGENCY">Released to External Agency</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>
                  Purpose of Transfer *
                </label>
                <input
                  type="text"
                  value={transferFormData.purpose_of_transfer}
                  onChange={(e) => setTransferFormData({ ...transferFormData, purpose_of_transfer: e.target.value })}
                  placeholder="e.g. Ballistics striation and comparative analysis"
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-default)',
                    color: 'var(--text-primary)',
                    padding: '0.4rem 0.6rem',
                    borderRadius: '4px',
                    fontSize: '0.8rem'
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>
                  Destination Location
                </label>
                <input
                  type="text"
                  value={transferFormData.location}
                  onChange={(e) => setTransferFormData({ ...transferFormData, location: e.target.value })}
                  placeholder="e.g. State Forensics Ballistics Unit"
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-default)',
                    color: 'var(--text-primary)',
                    padding: '0.4rem 0.6rem',
                    borderRadius: '4px',
                    fontSize: '0.8rem'
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={transferSubmitting}
                className="btn-primary"
                style={{ fontSize: '0.78rem', padding: '0.4rem 0.8rem', marginTop: '0.3rem' }}
              >
                {transferSubmitting ? 'Recording Transfer...' : 'Sign & Submit Custody Transfer'}
              </button>
            </form>

            {/* Custody Event Log */}
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                Chronological Custody Timeline
              </div>

              {custodyLoading ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Loading custody events...</div>
              ) : (custodyData?.custody_events || []).length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No custody transfers recorded yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {(custodyData?.custody_events || []).map((c, idx) => (
                    <div
                      key={c.custody_id || idx}
                      style={{
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border-default)',
                        borderRadius: '6px',
                        padding: '0.75rem',
                        fontSize: '0.78rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                        <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
                          {c.custody_action || 'TRANSFERRED'}
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.68rem' }}>
                          {new Date(c.event_timestamp || c.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div style={{ color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>
                        From: <strong>{c.from_officer_name || `Officer #${c.from_officer_id}`}</strong> → To: <strong>{c.to_officer_name || `Officer #${c.to_officer_id}`}</strong>
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                        Purpose: {c.purpose_of_transfer}
                      </div>
                      {c.location && (
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                          Location: {c.location}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

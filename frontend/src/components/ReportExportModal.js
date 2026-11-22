import React, { useState } from 'react';
import api from '../services/api';
import { ReportIcon, CloseIcon } from './icons/Icons';

/**
 * @component ReportExportModal
 * @description Modal dialog for exporting comprehensive forensic investigation dossiers
 * in structured JSON format or official printable HTML/PDF format.
 */
export default function ReportExportModal({ isOpen, onClose, caseId, caseNumber, caseTitle }) {
  const [downloadingJson, setDownloadingJson] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleDownloadJson = async () => {
    try {
      setDownloadingJson(true);
      setError(null);
      const res = await api.getCaseReportJson(caseId);
      const jsonBlob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(jsonBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CASETHREAD_REPORT_${caseNumber || caseId}_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || 'Failed to download JSON report');
    } finally {
      setDownloadingJson(false);
    }
  };

  const handleOpenPrintableHtml = () => {
    const reportUrl = api.getCaseReportHtmlUrl(caseId);
    window.open(reportUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="modal-sheet"
        style={{
          maxWidth: '560px',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-default)', paddingBottom: '0.85rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ color: 'var(--accent-primary)', display: 'flex' }}>
                <ReportIcon size={20} />
              </span>
              <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                Export Forensic Case Dossier
              </h3>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '0.2rem' }}>
              CASE #{caseNumber || caseId}: {caseTitle || 'The Metro Vault Intrusion'}
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn-ghost"
            style={{ width: '28px', height: '28px', padding: 0 }}
            aria-label="Close export dialog"
          >
            <CloseIcon size={16} />
          </button>
        </div>

        {error && (
          <div style={{
            backgroundColor: 'var(--status-danger-dim)',
            border: '1px solid var(--status-danger-border)',
            color: '#F87171',
            padding: '0.65rem 0.85rem',
            borderRadius: 'var(--radius-control)',
            fontSize: '0.78rem'
          }}>
            {error}
          </div>
        )}

        <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Generate a standardized, tamper-evident forensic intelligence report containing the complete evidentiary inventory, cryptographic SHA-256 fingerprints, chronological chain of custody logs, relational network linkages, and heuristic algorithmic lead prioritizations.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          {/* Printable HTML / PDF */}
          <div style={{
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-card)',
            padding: '1.15rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '1rem'
          }}>
            <div>
              <div style={{ fontWeight: '600', fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                Printable HTML / PDF Dossier
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.35rem', lineHeight: 1.4 }}>
                Formatted with law enforcement styling, print pagination controls, audit seal, and evidence verification tables.
              </div>
            </div>
            <button
              onClick={handleOpenPrintableHtml}
              className="btn-primary"
              style={{ fontSize: '0.78rem', height: '34px', width: '100%' }}
            >
              Open Printable Report ↗
            </button>
          </div>

          {/* Structured JSON */}
          <div style={{
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-card)',
            padding: '1.15rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '1rem'
          }}>
            <div>
              <div style={{ fontWeight: '600', fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                Machine-Readable JSON
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.35rem', lineHeight: 1.4 }}>
                Structured raw dataset export containing all entities, hash chains, and canonical algorithms for ingestion into external tools.
              </div>
            </div>
            <button
              onClick={handleDownloadJson}
              disabled={downloadingJson}
              className="btn-secondary"
              style={{ fontSize: '0.78rem', height: '34px', width: '100%' }}
            >
              {downloadingJson ? 'Generating JSON...' : 'Download JSON Dossier ↓'}
            </button>
          </div>
        </div>

        {/* Academic Notice */}
        <div style={{
          backgroundColor: 'var(--bg-input)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-control)',
          padding: '0.65rem 0.85rem',
          fontSize: '0.7rem',
          color: 'var(--text-muted)',
          lineHeight: 1.4
        }}>
          <strong>Notice:</strong> This automated report is produced by an academic decision-support framework. Algorithmic inferences and priority scores do not constitute certified legal evidence or court-admissible findings without independent sworn verification.
        </div>
      </div>
    </div>
  );
}

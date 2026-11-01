import React, { useState } from 'react';
import api from '../services/api';

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
      <div className="forensic-card" style={{ maxWidth: '600px', width: '100%', padding: '1.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-default)', paddingBottom: '0.85rem', marginBottom: '1.25rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.3rem' }}>📄</span>
              <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-primary)', textTransform: 'uppercase' }}>
                Export Forensic Case Dossier
              </h3>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '0.2rem' }}>
              CASE #{caseNumber || caseId}: {caseTitle || 'The Metro Vault Intrusion'}
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn-secondary"
            style={{ fontSize: '0.8rem', padding: '0.25rem 0.55rem' }}
          >
            ✕
          </button>
        </div>

        {error && (
          <div style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid var(--accent-red)',
            color: 'var(--accent-red)',
            padding: '0.65rem 0.85rem',
            borderRadius: '4px',
            fontSize: '0.8rem',
            marginBottom: '1rem'
          }}>
            {error}
          </div>
        )}

        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '1.5rem' }}>
          Generate a standardized, tamper-evident forensic intelligence report containing the complete evidentiary inventory, cryptographic SHA-256 fingerprints, chronological chain of custody logs, relational network linkages, and heuristic algorithmic lead prioritizations.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
          {/* Printable HTML / PDF */}
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-default)',
            borderRadius: '6px',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '1rem'
          }}>
            <div>
              <div style={{ fontSize: '1.1rem', marginBottom: '0.3rem' }}>🖨️</div>
              <div style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                Printable HTML / PDF Dossier
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.35rem', lineHeight: 1.4 }}>
                Formatted with law enforcement styling, print pagination controls, audit seal, and evidence verification tables.
              </div>
            </div>
            <button
              onClick={handleOpenPrintableHtml}
              className="btn-primary"
              style={{ fontSize: '0.78rem', padding: '0.45rem', width: '100%' }}
            >
              Open Printable Report ↗
            </button>
          </div>

          {/* Structured JSON */}
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-default)',
            borderRadius: '6px',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '1rem'
          }}>
            <div>
              <div style={{ fontSize: '1.1rem', marginBottom: '0.3rem' }}>💾</div>
              <div style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
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
              style={{ fontSize: '0.78rem', padding: '0.45rem', width: '100%' }}
            >
              {downloadingJson ? 'Generating JSON...' : 'Download JSON Dossier ↓'}
            </button>
          </div>
        </div>

        {/* Academic Notice */}
        <div style={{
          backgroundColor: 'var(--bg-input)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '4px',
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

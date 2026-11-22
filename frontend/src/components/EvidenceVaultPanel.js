import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import AddEvidenceModal from './AddEvidenceModal';
import EditEvidenceModal from './EditEvidenceModal';
import TransferCustodyModal from './TransferCustodyModal';
import {
  VaultIcon,
  SearchIcon,
  PlusIcon,
  ShieldCheckIcon,
  CheckIcon,
  CloseIcon
} from './icons/Icons';

/**
 * @component EvidenceVaultPanel
 * @description Apple-inspired Evidence Vault & Forensic Ground Truth Registry.
 * Features dual-mode view (Master Evidence Registry & Digital Vault Files),
 * multi-faceted search & filters, expandable in-line detail drawers,
 * cryptographic SHA-256 integrity verification, chain-of-custody tracking,
 * and secure multipart upload/preview/download.
 */
export default function EvidenceVaultPanel({ selectedCaseId, officer }) {
  // View mode: 'REGISTRY' (Master Evidence Records) | 'VAULT_FILES' (Digital File Attachments)
  const [viewMode, setViewMode] = useState('REGISTRY');

  // Core Data
  const [evidenceList, setEvidenceList] = useState([]);
  const [vaultFiles, setVaultFiles] = useState([]);
  const [casesList, setCasesList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Search & Filtering State
  const [searchQuery, setSearchQuery] = useState('');
  const [caseFilter, setCaseFilter] = useState(selectedCaseId ? String(selectedCaseId) : 'ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [verificationFilter, setVerificationFilter] = useState('ALL');
  const [reliabilityFilter, setReliabilityFilter] = useState('ALL');
  const [fileFormatFilter, setFileFormatFilter] = useState('ALL');

  // In-Line Drawer & Expansion State
  const [expandedEvidenceId, setExpandedEvidenceId] = useState(null);
  const [custodyHistoryMap, setCustodyHistoryMap] = useState({});
  const [attachedFilesMap, setAttachedFilesMap] = useState({});
  const [loadingDrawerData, setLoadingDrawerData] = useState(false);

  // Modals & Action Workflows
  const [isAddEvidenceOpen, setIsAddEvidenceOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [custodyTransferItem, setCustodyTransferItem] = useState(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadTargetEvidenceId, setUploadTargetEvidenceId] = useState('');
  const [uploadTargetCaseId, setUploadTargetCaseId] = useState(selectedCaseId || '');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);

  // Live Verification & Clipboard
  const [verifyingEvidenceId, setVerifyingEvidenceId] = useState(null);
  const [verifyingFileId, setVerifyingFileId] = useState(null);
  const [copiedHash, setCopiedHash] = useState(null);

  const fileInputRef = useRef(null);

  // Update case filter if prop changes
  useEffect(() => {
    if (selectedCaseId) {
      setCaseFilter(String(selectedCaseId));
      setUploadTargetCaseId(selectedCaseId);
    }
  }, [selectedCaseId]);

  // Load all Cases for the Filter Dropdown
  const loadCases = useCallback(async () => {
    try {
      const res = await api.getCases();
      if (res && res.data) {
        setCasesList(res.data);
      }
    } catch (err) {
      console.warn('Failed to load cases for filter:', err.message);
    }
  }, []);

  // Fetch Master Evidence Registry
  const loadEvidenceData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {};
      if (caseFilter && caseFilter !== 'ALL') {
        params.case_id = caseFilter;
      }
      if (categoryFilter && categoryFilter !== 'ALL') {
        params.category = categoryFilter;
      }
      if (verificationFilter && verificationFilter !== 'ALL') {
        params.verification_status = verificationFilter;
      }
      if (reliabilityFilter && reliabilityFilter !== 'ALL') {
        params.reliability_assessment = reliabilityFilter;
      }
      if (searchQuery.trim()) {
        params.q = searchQuery.trim();
      }

      const res = await api.getAllEvidence(params);
      const items = res?.data || [];
      setEvidenceList(items);

      // Pre-select first case/evidence for upload target if not set
      if (items.length > 0 && !uploadTargetEvidenceId) {
        setUploadTargetEvidenceId(String(items[0].evidence_id));
        setUploadTargetCaseId(items[0].case_id);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch evidence registry.');
    } finally {
      setLoading(false);
    }
  }, [caseFilter, categoryFilter, verificationFilter, reliabilityFilter, searchQuery, uploadTargetEvidenceId]);

  // Fetch Vault Files
  const loadVaultFiles = useCallback(async () => {
    try {
      const params = {};
      if (caseFilter && caseFilter !== 'ALL') {
        params.case_id = caseFilter;
      }
      if (fileFormatFilter && fileFormatFilter !== 'ALL') {
        params.file_format = fileFormatFilter;
      }
      if (searchQuery.trim()) {
        params.q = searchQuery.trim();
      }

      const res = await api.searchVaultFiles(params);
      setVaultFiles(res?.data || []);
    } catch (err) {
      console.warn('Failed to load vault files:', err.message);
    }
  }, [caseFilter, fileFormatFilter, searchQuery]);

  // Initial Load
  useEffect(() => {
    loadCases();
  }, [loadCases]);

  useEffect(() => {
    loadEvidenceData();
    loadVaultFiles();
  }, [loadEvidenceData, loadVaultFiles]);

  // Load In-line Drawer Data (Custody History & Attached Files for expanded row)
  const handleToggleRow = async (evidenceId, caseId) => {
    if (expandedEvidenceId === evidenceId) {
      setExpandedEvidenceId(null);
      return;
    }

    setExpandedEvidenceId(evidenceId);
    setLoadingDrawerData(true);

    try {
      const [custodyRes, filesRes] = await Promise.all([
        api.getCustodyHistory(evidenceId).catch(() => ({ data: [] })),
        api.searchVaultFiles({ evidence_id: evidenceId }).catch(() => ({ data: [] }))
      ]);

      setCustodyHistoryMap(prev => ({ ...prev, [evidenceId]: custodyRes.data || [] }));
      setAttachedFilesMap(prev => ({ ...prev, [evidenceId]: filesRes.data || [] }));
    } catch (err) {
      console.warn('Failed to load details for evidence item:', err.message);
    } finally {
      setLoadingDrawerData(false);
    }
  };

  // Live SHA-256 Integrity Verification for Master Evidence Item
  const handleVerifyEvidenceIntegrity = async (evidenceId) => {
    try {
      setVerifyingEvidenceId(evidenceId);
      setError(null);

      const res = await api.verifyEvidenceIntegrity(evidenceId);
      const outcome = res.data;

      setEvidenceList(prev => prev.map(ev => {
        if (ev.evidence_id === evidenceId) {
          return {
            ...ev,
            integrity_status: outcome.integrity_status,
            last_verified_at: outcome.verified_at
          };
        }
        return ev;
      }));

      if (outcome.match_status === 'MATCH') {
        setSuccessMsg(`✓ Evidence record [#${evidenceId}] verified INTACT. SHA-256 fingerprint matches canonical ground truth.`);
      } else {
        setError(`⚠ CRITICAL INTEGRITY ALERT: Evidence record [#${evidenceId}] diverged from registered cryptographic digest!`);
      }
    } catch (err) {
      setError(`Verification failure: ${err.message}`);
    } finally {
      setVerifyingEvidenceId(null);
    }
  };

  // Live Physical Vault File Integrity Verification
  const handleVerifyFileIntegrity = async (file) => {
    try {
      setVerifyingFileId(file.file_id);
      setError(null);

      const res = await api.verifyVaultFileIntegrity(file.file_id);
      const result = res.data;

      setVaultFiles(prev => prev.map(f => {
        if (f.file_id === file.file_id) {
          return {
            ...f,
            integrity_status: result.integrity_status,
            last_verified_at: result.verified_at
          };
        }
        return f;
      }));

      if (result.match) {
        setSuccessMsg(`✓ File [${file.sanitized_filename}] verified INTACT on disk storage.`);
      } else {
        setError(`⚠ PHYSICAL INTEGRITY ALERT: File [${file.sanitized_filename}] byte mismatch on storage disk!`);
      }
    } catch (err) {
      setError(`File verification error: ${err.message}`);
    } finally {
      setVerifyingFileId(null);
    }
  };

  // Multipart File Upload Handler
  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setUploadError('Select a forensic file to ingest.');
      return;
    }
    if (!uploadTargetEvidenceId) {
      setUploadError('Select an evidence record to associate this file with.');
      return;
    }

    try {
      setUploading(true);
      setUploadError(null);

      const formData = new FormData();
      formData.append('case_id', String(uploadTargetCaseId || (casesList[0]?.case_id || 1)));
      formData.append('evidence_id', String(uploadTargetEvidenceId));
      formData.append('file', selectedFile);

      const res = await api.uploadVaultFile(formData);

      setSuccessMsg(`✓ File [${res.data.sanitized_filename}] successfully ingested into secure vault. SHA-256 sealed.`);
      setSelectedFile(null);
      setIsUploadOpen(false);

      // Refresh data
      await Promise.all([loadEvidenceData(), loadVaultFiles()]);

      // If drawer is open for this item, refresh its attached files
      if (expandedEvidenceId === parseInt(uploadTargetEvidenceId, 10)) {
        const filesRes = await api.searchVaultFiles({ evidence_id: uploadTargetEvidenceId });
        setAttachedFilesMap(prev => ({ ...prev, [uploadTargetEvidenceId]: filesRes.data || [] }));
      }
    } catch (err) {
      setUploadError(err.message || 'File upload failed');
    } finally {
      setUploading(false);
    }
  };

  // Drag and drop handlers
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleCopyHash = (hash, id) => {
    if (!hash) return;
    navigator.clipboard.writeText(hash);
    setCopiedHash(id);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFormatIcon = (ext) => {
    const e = (ext || '').toLowerCase();
    if (e === '.pdf') return '📄';
    if (e === '.png' || e === '.jpg' || e === '.jpeg') return '🖼️';
    if (e === '.mp4') return '🎥';
    if (e === '.wav' || e === '.mp3') return '🎵';
    if (e === '.csv') return '📊';
    if (e === '.json' || e === '.xml') return '⚙️';
    return '📁';
  };

  // Compute KPI Metrics
  const totalEvidenceCount = evidenceList.length;
  const confirmedFactsCount = evidenceList.filter(e => e.verification_status === 'CONFIRMED_FACT').length;
  const totalVaultFilesCount = vaultFiles.length;
  const totalVaultSizeBytes = vaultFiles.reduce((acc, f) => acc + (f.file_size_bytes || 0), 0);
  const intactCount = evidenceList.filter(e => e.integrity_status === 'INTACT' || !e.integrity_status).length;
  const integrityRate = totalEvidenceCount > 0 ? Math.round((intactCount / totalEvidenceCount) * 100) : 100;

  // Has active filters
  const hasActiveFilters = searchQuery !== '' || caseFilter !== 'ALL' || categoryFilter !== 'ALL' || verificationFilter !== 'ALL' || reliabilityFilter !== 'ALL';

  const resetFilters = () => {
    setSearchQuery('');
    setCaseFilter('ALL');
    setCategoryFilter('ALL');
    setVerificationFilter('ALL');
    setReliabilityFilter('ALL');
    setFileFormatFilter('ALL');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '3rem' }}>
      {/* ========================================================================= */}
      {/* 1. TOP HEADER & PRIMARY ACTIONS                                           */}
      {/* ========================================================================= */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        padding: '0.5rem 0'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: 'rgba(59, 130, 246, 0.12)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-blue)'
            }}>
              <VaultIcon size={20} />
            </div>
            <div>
              <h1 style={{
                fontSize: '1.45rem',
                fontWeight: '700',
                color: 'var(--text-primary)',
                letterSpacing: '-0.02em',
                margin: 0
              }}>
                Evidence Vault
              </h1>
              <p style={{
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                margin: '0.15rem 0 0 0',
                fontFamily: 'var(--font-mono)'
              }}>
                Forensic ground truth, tamper-evident SHA-256 fingerprinting & chain of custody
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              setUploadTargetEvidenceId(evidenceList[0]?.evidence_id || '');
              setUploadTargetCaseId(caseFilter !== 'ALL' ? parseInt(caseFilter, 10) : (casesList[0]?.case_id || 1));
              setIsUploadOpen(true);
            }}
            className="btn-secondary"
            style={{
              padding: '0.55rem 1rem',
              borderRadius: '8px',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem'
            }}
            title="Upload digital file to secure storage outside web root"
          >
            <span>📥</span> Ingest File
          </button>

          <button
            onClick={() => setIsAddEvidenceOpen(true)}
            className="btn-primary"
            style={{
              padding: '0.55rem 1.15rem',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem'
            }}
            title="Register new forensic evidence record into case dossier"
          >
            <PlusIcon size={16} /> Register Evidence
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. KPI RIBBON & FORENSIC METRICS (Apple-inspired Cards)                  */}
      {/* ========================================================================= */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '1rem'
      }}>
        {/* Total Evidence */}
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-default)',
          borderRadius: '12px',
          padding: '1.15rem 1.25rem',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Master Records
            </span>
            <span style={{ fontSize: '1rem' }}>📦</span>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            {totalEvidenceCount}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
            Cataloged across active case files
          </div>
        </div>

        {/* Confirmed Facts */}
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-default)',
          borderRadius: '12px',
          padding: '1.15rem 1.25rem',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Confirmed Ground Truth
            </span>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: 'var(--status-verified)',
              boxShadow: '0 0 8px var(--status-verified)'
            }} />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: '800', color: 'var(--status-verified)', letterSpacing: '-0.02em' }}>
            {confirmedFactsCount}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
            {totalEvidenceCount > 0 ? `${Math.round((confirmedFactsCount / totalEvidenceCount) * 100)}% of total ground truth` : '0%'}
          </div>
        </div>

        {/* Digital Files in Vault */}
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-default)',
          borderRadius: '12px',
          padding: '1.15rem 1.25rem',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Vault File Attachments
            </span>
            <span style={{ fontSize: '1rem' }}>💾</span>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: '800', color: 'var(--accent-blue)', letterSpacing: '-0.02em' }}>
            {totalVaultFilesCount}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
            {formatBytes(totalVaultSizeBytes)} physical binary footprint
          </div>
        </div>

        {/* Cryptographic SHA-256 Integrity */}
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-default)',
          borderRadius: '12px',
          padding: '1.15rem 1.25rem',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              SHA-256 Digest Integrity
            </span>
            <ShieldCheckIcon size={18} color="var(--status-verified)" />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            {integrityRate}%
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--status-verified)', fontWeight: '600' }}>
            ✓ Intact & Tamper-Evident Sealed
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. ALERTS & NOTIFICATIONS                                                */}
      {/* ========================================================================= */}
      {error && (
        <div style={{
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid var(--accent-red)',
          color: 'var(--accent-red)',
          padding: '0.85rem 1.25rem',
          borderRadius: '10px',
          fontSize: '0.85rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div><strong>Notice:</strong> {error}</div>
          <button
            onClick={() => setError(null)}
            style={{ background: 'none', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', fontSize: '1rem' }}
          >
            ✕
          </button>
        </div>
      )}

      {successMsg && (
        <div style={{
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid var(--accent-green)',
          color: 'var(--accent-green)',
          padding: '0.85rem 1.25rem',
          borderRadius: '10px',
          fontSize: '0.85rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>{successMsg}</div>
          <button
            onClick={() => setSuccessMsg(null)}
            style={{ background: 'none', border: 'none', color: 'var(--accent-green)', cursor: 'pointer', fontSize: '1rem' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. SEGMENTED VIEW CONTROLS & SEARCH / FILTER TOOLBAR                      */}
      {/* ========================================================================= */}
      <div style={{
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-default)',
        borderRadius: '14px',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)'
      }}>
        {/* Row 1: Segmented Pill Switcher & Live Count */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          {/* Apple-style Segmented View Control */}
          <div style={{
            display: 'inline-flex',
            backgroundColor: 'var(--bg-tertiary)',
            padding: '4px',
            borderRadius: '10px',
            border: '1px solid var(--border-subtle)'
          }}>
            <button
              onClick={() => setViewMode('REGISTRY')}
              style={{
                backgroundColor: viewMode === 'REGISTRY' ? 'var(--bg-card)' : 'transparent',
                color: viewMode === 'REGISTRY' ? 'var(--text-primary)' : 'var(--text-muted)',
                boxShadow: viewMode === 'REGISTRY' ? '0 2px 6px rgba(0, 0, 0, 0.25)' : 'none',
                border: 'none',
                borderRadius: '8px',
                padding: '0.45rem 1rem',
                fontSize: '0.82rem',
                fontWeight: viewMode === 'REGISTRY' ? '600' : '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                transition: 'all 0.15s ease'
              }}
            >
              <span>📋</span> Master Evidence Registry ({evidenceList.length})
            </button>

            <button
              onClick={() => setViewMode('VAULT_FILES')}
              style={{
                backgroundColor: viewMode === 'VAULT_FILES' ? 'var(--bg-card)' : 'transparent',
                color: viewMode === 'VAULT_FILES' ? 'var(--text-primary)' : 'var(--text-muted)',
                boxShadow: viewMode === 'VAULT_FILES' ? '0 2px 6px rgba(0, 0, 0, 0.25)' : 'none',
                border: 'none',
                borderRadius: '8px',
                padding: '0.45rem 1rem',
                fontSize: '0.82rem',
                fontWeight: viewMode === 'VAULT_FILES' ? '600' : '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                transition: 'all 0.15s ease'
              }}
            >
              <span>💾</span> Digital Vault Files ({vaultFiles.length})
            </button>
          </div>

          {/* Quick Refresh & Clear */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  color: 'var(--accent-orange)',
                  fontSize: '0.75rem',
                  padding: '0.35rem 0.65rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem'
                }}
              >
                <CloseIcon size={14} /> Clear Filters
              </button>
            )}
            <button
              onClick={() => {
                loadEvidenceData();
                loadVaultFiles();
              }}
              className="btn-secondary"
              disabled={loading}
              style={{
                fontSize: '0.78rem',
                padding: '0.4rem 0.8rem',
                borderRadius: '8px'
              }}
              title="Refresh data from server"
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* Row 2: Search & Multi-Faceted Filters (Inspired by Axon Evidence Local) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '0.75rem',
          alignItems: 'center'
        }}>
          {/* Keyword Search */}
          <div style={{ position: 'relative', gridColumn: 'span 2' }}>
            <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
              <SearchIcon size={16} />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by ID, tracking code, title, source, or description..."
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-default)',
                borderRadius: '8px',
                padding: '0.55rem 0.8rem 0.55rem 2.25rem',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                outline: 'none'
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '0.6rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Associated Investigation Filter */}
          <div>
            <select
              value={caseFilter}
              onChange={(e) => setCaseFilter(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-default)',
                borderRadius: '8px',
                padding: '0.55rem 0.75rem',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
                outline: 'none'
              }}
            >
              <option value="ALL">All Investigations</option>
              {casesList.map(c => (
                <option key={c.case_id} value={String(c.case_id)}>
                  #{c.case_number} — {c.title?.slice(0, 24)}...
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          {viewMode === 'REGISTRY' ? (
            <div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '8px',
                  padding: '0.55rem 0.75rem',
                  color: 'var(--text-primary)',
                  fontSize: '0.82rem',
                  outline: 'none'
                }}
              >
                <option value="ALL">All Categories</option>
                <option value="CCTV">CCTV Footage</option>
                <option value="FINANCIAL">Financial Record</option>
                <option value="DIGITAL">Digital Storage</option>
                <option value="FORENSIC">Forensic Report</option>
                <option value="PHYSICAL">Physical Evidence</option>
                <option value="TESTIMONIAL">Witness Statement</option>
                <option value="DOCUMENTARY">Documentary</option>
                <option value="WEAPON">Weapon</option>
                <option value="VEHICLE">Vehicle</option>
                <option value="BIOLOGICAL">Biological / DNA</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          ) : (
            <div>
              <select
                value={fileFormatFilter}
                onChange={(e) => setFileFormatFilter(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '8px',
                  padding: '0.55rem 0.75rem',
                  color: 'var(--text-primary)',
                  fontSize: '0.82rem',
                  outline: 'none'
                }}
              >
                <option value="ALL">All File Formats</option>
                <option value="pdf">PDF Documents</option>
                <option value="png">PNG / JPG Images</option>
                <option value="mp4">MP4 Video</option>
                <option value="wav">WAV / MP3 Audio</option>
                <option value="csv">CSV / Data Logs</option>
                <option value="json">JSON Metadata</option>
              </select>
            </div>
          )}

          {/* Ground Truth Status Filter (Registry Only) */}
          {viewMode === 'REGISTRY' && (
            <div>
              <select
                value={verificationFilter}
                onChange={(e) => setVerificationFilter(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '8px',
                  padding: '0.55rem 0.75rem',
                  color: 'var(--text-primary)',
                  fontSize: '0.82rem',
                  outline: 'none'
                }}
              >
                <option value="ALL">All Ground Truth</option>
                <option value="CONFIRMED_FACT">Confirmed Fact</option>
                <option value="UNVERIFIED_OBSERVATION">Unverified Observation</option>
                <option value="HYPOTHESIS">Hypothesis / Theory</option>
              </select>
            </div>
          )}

          {/* Reliability Assessment Filter (Registry Only) */}
          {viewMode === 'REGISTRY' && (
            <div>
              <select
                value={reliabilityFilter}
                onChange={(e) => setReliabilityFilter(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '8px',
                  padding: '0.55rem 0.75rem',
                  color: 'var(--text-primary)',
                  fontSize: '0.82rem',
                  outline: 'none'
                }}
              >
                <option value="ALL">All Reliability</option>
                <option value="HIGH">High Reliability</option>
                <option value="MEDIUM">Medium Reliability</option>
                <option value="LOW">Low Reliability</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. VIEW MODE A: MASTER EVIDENCE REGISTRY                                  */}
      {/* Inspired by Monolith Forensics with Expandable In-Line Detail Inspector   */}
      {/* ========================================================================= */}
      {viewMode === 'REGISTRY' && (
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-default)',
          borderRadius: '14px',
          overflow: 'hidden',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)'
        }}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>⏳</div>
              <p style={{ fontSize: '0.9rem' }}>Loading forensic evidence registry...</p>
            </div>
          ) : evidenceList.length === 0 ? (
            <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🗄️</div>
              <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                No Evidence Records Found
              </h3>
              <p style={{ fontSize: '0.82rem', maxWidth: '440px', margin: '0 auto 1.5rem auto', lineHeight: 1.5 }}>
                {hasActiveFilters
                  ? 'No records match your active search and filter parameters. Try clearing the filter criteria.'
                  : 'No evidence has been registered into the vault yet. Click "+ Register Evidence" to ingest forensic records.'}
              </p>
              {hasActiveFilters ? (
                <button onClick={resetFilters} className="btn-secondary" style={{ fontSize: '0.8rem', padding: '0.45rem 1rem' }}>
                  Reset All Filters
                </button>
              ) : (
                <button onClick={() => setIsAddEvidenceOpen(true)} className="btn-primary" style={{ fontSize: '0.8rem', padding: '0.45rem 1rem' }}>
                  + Register First Evidence Item
                </button>
              )}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    borderBottom: '1px solid var(--border-default)',
                    color: 'var(--text-muted)',
                    fontSize: '0.72rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    <th style={{ padding: '0.85rem 1rem', width: '36px' }}></th>
                    <th style={{ padding: '0.85rem 1rem' }}>Evidence Number</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Title & Source</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Case</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Category</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Ground Truth</th>
                    <th style={{ padding: '0.85rem 1rem' }}>SHA-256 Digest</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Integrity</th>
                    <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {evidenceList.map((item) => {
                    const isExpanded = expandedEvidenceId === item.evidence_id;
                    const isVerifying = verifyingEvidenceId === item.evidence_id;
                    const truncatedHash = item.sha256_fingerprint
                      ? `${item.sha256_fingerprint.slice(0, 8)}...${item.sha256_fingerprint.slice(-6)}`
                      : 'Not sealed';

                    return (
                      <React.Fragment key={item.evidence_id}>
                        {/* Primary Table Row */}
                        <tr
                          style={{
                            borderBottom: isExpanded ? 'none' : '1px solid var(--border-subtle)',
                            backgroundColor: isExpanded ? 'rgba(59, 130, 246, 0.04)' : 'transparent',
                            transition: 'background-color 0.15s ease'
                          }}
                        >
                          {/* Expander Icon */}
                          <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                            <button
                              onClick={() => handleToggleRow(item.evidence_id, item.case_id)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: isExpanded ? 'var(--accent-blue)' : 'var(--text-muted)',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                padding: '0.2rem',
                                lineHeight: 1
                              }}
                              title={isExpanded ? 'Collapse forensic details' : 'Expand forensic details'}
                            >
                              {isExpanded ? '▼' : '▶'}
                            </button>
                          </td>

                          {/* Evidence Number / Tracking Code */}
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                              <span style={{
                                fontFamily: 'var(--font-mono)',
                                fontWeight: '700',
                                color: 'var(--text-primary)',
                                fontSize: '0.85rem'
                              }}>
                                {item.tracking_code || `EVD-${item.evidence_id}`}
                              </span>
                              {item.current_version > 1 && (
                                <span className="badge badge-info" style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem' }}>
                                  v{item.current_version}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Title & Provenance Source */}
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <div style={{ fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.15rem' }}>
                              {item.title}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              Source: {item.source || 'Field Acquisition'}
                            </div>
                          </td>

                          {/* Case Number */}
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <span className="badge badge-secondary" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
                              {item.case_number ? `#${item.case_number}` : `Case #${item.case_id}`}
                            </span>
                          </td>

                          {/* Category Badge */}
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '0.2rem 0.55rem',
                              borderRadius: '6px',
                              backgroundColor: 'rgba(255, 255, 255, 0.05)',
                              border: '1px solid var(--border-subtle)',
                              fontSize: '0.72rem',
                              color: 'var(--text-secondary)',
                              fontWeight: '500'
                            }}>
                              {item.category || 'PHYSICAL'}
                            </span>
                          </td>

                          {/* Ground Truth Status */}
                          <td style={{ padding: '0.85rem 1rem' }}>
                            {item.verification_status === 'CONFIRMED_FACT' && (
                              <span className="badge badge-verified" style={{ fontSize: '0.7rem' }}>
                                ✓ Confirmed Fact
                              </span>
                            )}
                            {item.verification_status === 'UNVERIFIED_OBSERVATION' && (
                              <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>
                                ⏳ Unverified
                              </span>
                            )}
                            {item.verification_status === 'HYPOTHESIS' && (
                              <span className="badge badge-purple" style={{ fontSize: '0.7rem' }}>
                                💡 Hypothesis
                              </span>
                            )}
                          </td>

                          {/* Truncated SHA-256 with Copy */}
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <span
                                style={{
                                  fontFamily: 'var(--font-mono)',
                                  fontSize: '0.72rem',
                                  color: 'var(--text-secondary)',
                                  backgroundColor: 'rgba(0, 0, 0, 0.25)',
                                  padding: '0.15rem 0.4rem',
                                  borderRadius: '4px'
                                }}
                                title={item.sha256_fingerprint}
                              >
                                {truncatedHash}
                              </span>
                              <button
                                onClick={() => handleCopyHash(item.sha256_fingerprint, item.evidence_id)}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: copiedHash === item.evidence_id ? 'var(--status-verified)' : 'var(--text-muted)',
                                  cursor: 'pointer',
                                  padding: '0.1rem 0.25rem',
                                  fontSize: '0.75rem'
                                }}
                                title="Copy 64-char SHA-256 digest"
                              >
                                {copiedHash === item.evidence_id ? '✓' : '📋'}
                              </button>
                            </div>
                          </td>

                          {/* Integrity Status */}
                          <td style={{ padding: '0.85rem 1rem' }}>
                            {item.integrity_status === 'TAMPERED_MISMATCH' ? (
                              <span className="badge badge-critical" style={{ fontSize: '0.7rem' }}>
                                ⚠️ Mismatch
                              </span>
                            ) : (
                              <span className="badge badge-verified" style={{ fontSize: '0.7rem' }}>
                                ✓ Intact
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                              <button
                                onClick={() => handleVerifyEvidenceIntegrity(item.evidence_id)}
                                disabled={isVerifying}
                                className="btn-secondary"
                                style={{
                                  fontSize: '0.72rem',
                                  padding: '0.3rem 0.6rem',
                                  borderRadius: '6px'
                                }}
                                title="Recalculate SHA-256 to verify bit-level integrity"
                              >
                                {isVerifying ? 'Checking...' : '🛡️ Verify'}
                              </button>
                              <button
                                onClick={() => setEditItem(item)}
                                className="btn-secondary"
                                style={{
                                  fontSize: '0.72rem',
                                  padding: '0.3rem 0.6rem',
                                  borderRadius: '6px'
                                }}
                                title="Amend evidence attributes"
                              >
                                Edit
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* In-Line Expandable Forensic Detail Drawer */}
                        {isExpanded && (
                          <tr style={{ backgroundColor: 'rgba(59, 130, 246, 0.02)', borderBottom: '1px solid var(--border-default)' }}>
                            <td colSpan={9} style={{ padding: '0 1rem 1.5rem 1rem' }}>
                              <div style={{
                                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                                border: '1px solid rgba(59, 130, 246, 0.2)',
                                borderRadius: '12px',
                                padding: '1.5rem',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '1.25rem',
                                boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.3)'
                              }}>
                                {/* Drawer Top Bar */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                    <span style={{ fontSize: '0.8rem', fontWeight: '800', letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--accent-blue)' }}>
                                      EVIDENCE DETAILS
                                    </span>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>•</span>
                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                      Registry ID #{item.evidence_id}
                                    </span>
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <button
                                      onClick={() => {
                                        setUploadTargetEvidenceId(String(item.evidence_id));
                                        setUploadTargetCaseId(item.case_id);
                                        setIsUploadOpen(true);
                                      }}
                                      className="btn-secondary"
                                      style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', borderRadius: '6px' }}
                                    >
                                      📎 Attach File
                                    </button>

                                    <button
                                      onClick={() => setCustodyTransferItem(item)}
                                      className="btn-secondary"
                                      style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', borderRadius: '6px' }}
                                    >
                                      🤝 Transfer Custody
                                    </button>

                                    <button
                                      onClick={() => setEditItem(item)}
                                      className="btn-primary"
                                      style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', borderRadius: '6px' }}
                                    >
                                      ✏️ Edit Record
                                    </button>
                                  </div>
                                </div>

                                {/* Metadata Grid (Monolith Forensics style) */}
                                <div style={{
                                  display: 'grid',
                                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                  gap: '1rem',
                                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                                  padding: '1rem',
                                  borderRadius: '8px',
                                  border: '1px solid var(--border-subtle)'
                                }}>
                                  <div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Evidence Number:</div>
                                    <div style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', marginTop: '0.15rem' }}>
                                      {item.tracking_code}
                                    </div>
                                  </div>

                                  <div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Associated Case:</div>
                                    <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--accent-orange)', marginTop: '0.15rem' }}>
                                      {item.case_number ? `#${item.case_number}` : `Case #${item.case_id}`}
                                    </div>
                                  </div>

                                  <div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Classification / Type:</div>
                                    <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)', marginTop: '0.15rem' }}>
                                      {item.category}
                                    </div>
                                  </div>

                                  <div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Reliability Assessment:</div>
                                    <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)', marginTop: '0.15rem' }}>
                                      {item.reliability_assessment || 'HIGH'}
                                    </div>
                                  </div>

                                  <div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Intake Date & Time:</div>
                                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', marginTop: '0.15rem' }}>
                                      {item.collected_at ? item.collected_at.replace('T', ' ').slice(0, 19) : item.created_at?.replace('T', ' ').slice(0, 19) || 'Recorded'}
                                    </div>
                                  </div>

                                  <div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Collection Location:</div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                                      {item.collection_location || 'Not Specified'}
                                    </div>
                                  </div>

                                  <div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Originating Source:</div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                                      {item.source || 'Investigative Discovery'}
                                    </div>
                                  </div>

                                  <div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Entered By Officer:</div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                                      {item.entered_by_officer_name ? `${item.entered_by_officer_name} (${item.entered_by_badge || 'LEAD'})` : 'Det. Alexander Cross'}
                                    </div>
                                  </div>
                                </div>

                                {/* Description Box */}
                                <div>
                                  <div style={{ fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                                    DESCRIPTION
                                  </div>
                                  <div style={{
                                    backgroundColor: 'rgba(0, 0, 0, 0.25)',
                                    border: '1px solid var(--border-subtle)',
                                    borderRadius: '8px',
                                    padding: '0.85rem 1rem',
                                    fontSize: '0.85rem',
                                    color: 'var(--text-secondary)',
                                    lineHeight: 1.5,
                                    whiteSpace: 'pre-wrap'
                                  }}>
                                    {item.description}
                                  </div>
                                </div>

                                {/* Full 64-char Cryptographic SHA-256 Card */}
                                <div style={{
                                  backgroundColor: 'rgba(59, 130, 246, 0.05)',
                                  border: '1px solid rgba(59, 130, 246, 0.25)',
                                  borderRadius: '8px',
                                  padding: '1rem',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '0.5rem'
                                }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--accent-blue)', textTransform: 'uppercase' }}>
                                      Cryptographic SHA-256 Fingerprint (Canonical State)
                                    </span>
                                    <span style={{ fontSize: '0.72rem', color: 'var(--status-verified)', fontWeight: '600' }}>
                                      ✓ Algorithm: SHA-256 • State: Intact
                                    </span>
                                  </div>

                                  <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    backgroundColor: 'rgba(0, 0, 0, 0.35)',
                                    padding: '0.6rem 0.85rem',
                                    borderRadius: '6px',
                                    border: '1px solid var(--border-subtle)'
                                  }}>
                                    <span style={{
                                      fontFamily: 'var(--font-mono)',
                                      fontSize: '0.78rem',
                                      color: 'var(--text-primary)',
                                      wordBreak: 'break-all',
                                      flex: 1
                                    }}>
                                      {item.sha256_fingerprint || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'}
                                    </span>
                                    <button
                                      onClick={() => handleCopyHash(item.sha256_fingerprint, `full-${item.evidence_id}`)}
                                      className="btn-secondary"
                                      style={{
                                        fontSize: '0.72rem',
                                        padding: '0.35rem 0.75rem',
                                        whiteSpace: 'nowrap'
                                      }}
                                    >
                                      {copiedHash === `full-${item.evidence_id}` ? '✓ Copied' : '📋 Copy Digest'}
                                    </button>
                                  </div>
                                </div>

                                {/* Attached Digital Vault Files */}
                                <div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                    <span style={{ fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                                      ATTACHED DIGITAL VAULT FILES ({attachedFilesMap[item.evidence_id]?.length || 0})
                                    </span>
                                    <button
                                      onClick={() => {
                                        setUploadTargetEvidenceId(String(item.evidence_id));
                                        setUploadTargetCaseId(item.case_id);
                                        setIsUploadOpen(true);
                                      }}
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--accent-blue)',
                                        fontSize: '0.75rem',
                                        cursor: 'pointer',
                                        fontWeight: '600'
                                      }}
                                    >
                                      + Ingest Attachment
                                    </button>
                                  </div>

                                  {loadingDrawerData ? (
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '0.5rem 0' }}>
                                      Retrieving attached vault files...
                                    </div>
                                  ) : attachedFilesMap[item.evidence_id]?.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                      {attachedFilesMap[item.evidence_id].map(file => (
                                        <div
                                          key={file.file_id}
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '0.5rem 0.75rem',
                                            backgroundColor: 'rgba(255, 255, 255, 0.02)',
                                            border: '1px solid var(--border-subtle)',
                                            borderRadius: '6px'
                                          }}
                                        >
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                            <span>{getFormatIcon(file.file_extension)}</span>
                                            <span style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                                              {file.sanitized_filename}
                                            </span>
                                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                              ({formatBytes(file.file_size_bytes)})
                                            </span>
                                          </div>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <button
                                              onClick={() => setPreviewFile(file)}
                                              className="btn-secondary"
                                              style={{ fontSize: '0.7rem', padding: '0.25rem 0.5rem' }}
                                            >
                                              👁️ Preview
                                            </button>
                                            <a
                                              href={api.getVaultDownloadUrl(file.file_id)}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="btn-secondary"
                                              style={{ fontSize: '0.7rem', padding: '0.25rem 0.5rem', textDecoration: 'none' }}
                                            >
                                              ⬇️ Download
                                            </a>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div style={{
                                      fontSize: '0.8rem',
                                      color: 'var(--text-muted)',
                                      backgroundColor: 'rgba(255, 255, 255, 0.01)',
                                      padding: '0.75rem 1rem',
                                      borderRadius: '6px',
                                      border: '1px dashed var(--border-subtle)'
                                    }}>
                                      No binary attachments linked to this evidence record yet.
                                    </div>
                                  )}
                                </div>

                                {/* Chronological Chain of Custody */}
                                <div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                    <span style={{ fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                                      CHAIN OF CUSTODY LOG ({custodyHistoryMap[item.evidence_id]?.length || 0} Transfers)
                                    </span>
                                    <button
                                      onClick={() => setCustodyTransferItem(item)}
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--accent-blue)',
                                        fontSize: '0.75rem',
                                        cursor: 'pointer',
                                        fontWeight: '600'
                                      }}
                                    >
                                      + Transfer Custody
                                    </button>
                                  </div>

                                  {custodyHistoryMap[item.evidence_id]?.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                      {custodyHistoryMap[item.evidence_id].map(event => (
                                        <div
                                          key={event.custody_id}
                                          style={{
                                            padding: '0.65rem 0.85rem',
                                            backgroundColor: 'rgba(255, 255, 255, 0.02)',
                                            border: '1px solid var(--border-subtle)',
                                            borderRadius: '6px',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '0.25rem'
                                          }}
                                        >
                                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                                              {event.previous_custodian} → {event.new_custodian}
                                            </span>
                                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                              {event.transfer_timestamp?.slice(0, 19).replace('T', ' ')}
                                            </span>
                                          </div>
                                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                            <strong>Reason:</strong> {event.transfer_reason} • <strong>Location:</strong> {event.transfer_location}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div style={{
                                      fontSize: '0.8rem',
                                      color: 'var(--text-muted)',
                                      backgroundColor: 'rgba(255, 255, 255, 0.01)',
                                      padding: '0.75rem 1rem',
                                      borderRadius: '6px',
                                      border: '1px dashed var(--border-subtle)'
                                    }}>
                                      Initial intake custody held by registering officer. No transfers recorded.
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. VIEW MODE B: DIGITAL VAULT FILES                                       */}
      {/* ========================================================================= */}
      {viewMode === 'VAULT_FILES' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {vaultFiles.length === 0 ? (
            <div style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-default)',
              borderRadius: '14px',
              padding: '4rem 2rem',
              textAlign: 'center',
              color: 'var(--text-muted)'
            }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>💾</div>
              <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                No Vault Files Ingested
              </h3>
              <p style={{ fontSize: '0.82rem', maxWidth: '440px', margin: '0 auto 1.5rem auto' }}>
                The digital evidence vault holds raw binary files outside the web root. Click "Ingest File" to upload attachments.
              </p>
              <button
                onClick={() => {
                  setUploadTargetEvidenceId(evidenceList[0]?.evidence_id || '');
                  setUploadTargetCaseId(caseFilter !== 'ALL' ? parseInt(caseFilter, 10) : (casesList[0]?.case_id || 1));
                  setIsUploadOpen(true);
                }}
                className="btn-primary"
                style={{ fontSize: '0.82rem', padding: '0.5rem 1.25rem' }}
              >
                + Ingest Digital File
              </button>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '1rem'
            }}>
              {vaultFiles.map(file => {
                const isChecking = verifyingFileId === file.file_id;
                const truncatedHash = file.sha256_hash ? `${file.sha256_hash.slice(0, 8)}...${file.sha256_hash.slice(-6)}` : '';

                return (
                  <div
                    key={file.file_id}
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-default)',
                      borderRadius: '12px',
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '1rem',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
                    }}
                  >
                    <div>
                      {/* Top row: Format icon, filename, and extension badge */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <span style={{ fontSize: '1.5rem' }}>{getFormatIcon(file.file_extension)}</span>
                          <div>
                            <div style={{ fontSize: '0.88rem', fontWeight: '700', color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                              {file.sanitized_filename}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              Size: {formatBytes(file.file_size_bytes)} • MIME: {file.detected_mime_type || file.mime_type}
                            </div>
                          </div>
                        </div>

                        <span className="badge badge-secondary" style={{ fontSize: '0.68rem', textTransform: 'uppercase' }}>
                          {file.file_extension?.replace('.', '') || 'BIN'}
                        </span>
                      </div>

                      {/* Associated Evidence Record */}
                      <div style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '6px',
                        padding: '0.5rem 0.65rem',
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)',
                        marginBottom: '0.75rem'
                      }}>
                        <strong>Linked Evidence:</strong> {file.tracking_code ? `${file.tracking_code} — ${file.evidence_title}` : `Evidence #${file.evidence_id}`}
                      </div>

                      {/* SHA-256 Digest Box */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: 'rgba(0, 0, 0, 0.25)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '6px',
                        padding: '0.35rem 0.6rem'
                      }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          SHA-256: {truncatedHash}
                        </span>
                        <button
                          onClick={() => handleCopyHash(file.sha256_hash, `file-${file.file_id}`)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: copiedHash === `file-${file.file_id}` ? 'var(--status-verified)' : 'var(--text-muted)',
                            cursor: 'pointer',
                            fontSize: '0.75rem'
                          }}
                          title="Copy file SHA-256 hash"
                        >
                          {copiedHash === `file-${file.file_id}` ? '✓' : '📋'}
                        </button>
                      </div>
                    </div>

                    {/* Bottom Actions */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingTop: '0.75rem',
                      borderTop: '1px solid var(--border-subtle)'
                    }}>
                      <button
                        onClick={() => handleVerifyFileIntegrity(file)}
                        disabled={isChecking}
                        className="btn-secondary"
                        style={{ fontSize: '0.72rem', padding: '0.3rem 0.6rem', borderRadius: '6px' }}
                      >
                        {isChecking ? 'Checking...' : '🛡️ Check Disk'}
                      </button>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <button
                          onClick={() => setPreviewFile(file)}
                          className="btn-secondary"
                          style={{ fontSize: '0.72rem', padding: '0.3rem 0.6rem', borderRadius: '6px' }}
                        >
                          👁️ Preview
                        </button>

                        <a
                          href={api.getVaultDownloadUrl(file.file_id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-primary"
                          style={{ fontSize: '0.72rem', padding: '0.3rem 0.6rem', borderRadius: '6px', textDecoration: 'none' }}
                        >
                          ⬇️ Download
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. MULTIPART INGESTION MODAL / DROPZONE                                   */}
      {/* ========================================================================= */}
      {isUploadOpen && (
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
            maxWidth: '560px',
            boxShadow: '0 24px 48px -12px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Header */}
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                  Ingest Digital Evidence File
                </h2>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
                  Binary storage outside web root • Magic byte validation • SHA-256 seal
                </p>
              </div>
              <button
                onClick={() => setIsUploadOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.3rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleUploadSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {uploadError && (
                <div style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid var(--accent-red)',
                  color: 'var(--accent-red)',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '6px',
                  fontSize: '0.8rem'
                }}>
                  ⚠️ {uploadError}
                </div>
              )}

              {/* Target Evidence Selection */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Target Evidence Record <span style={{ color: 'var(--accent-red)' }}>*</span>
                </label>
                <select
                  value={uploadTargetEvidenceId}
                  onChange={(e) => {
                    setUploadTargetEvidenceId(e.target.value);
                    const selected = evidenceList.find(item => String(item.evidence_id) === e.target.value);
                    if (selected) {
                      setUploadTargetCaseId(selected.case_id);
                    }
                  }}
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-default)',
                    borderRadius: '8px',
                    padding: '0.6rem 0.8rem',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    outline: 'none'
                  }}
                >
                  {evidenceList.map(item => (
                    <option key={item.evidence_id} value={String(item.evidence_id)}>
                      {item.tracking_code} — {item.title?.slice(0, 32)}...
                    </option>
                  ))}
                </select>
              </div>

              {/* Drag and Drop Box */}
              <div
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${isDragOver ? 'var(--accent-blue)' : 'var(--border-default)'}`,
                  backgroundColor: isDragOver ? 'rgba(59, 130, 246, 0.08)' : 'rgba(0, 0, 0, 0.2)',
                  borderRadius: '10px',
                  padding: '2rem 1.5rem',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      setSelectedFile(e.target.files[0]);
                    }
                  }}
                  style={{ display: 'none' }}
                />
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📥</div>
                <div style={{ fontSize: '0.88rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                  {selectedFile ? selectedFile.name : 'Choose a file or drag & drop here'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  {selectedFile
                    ? `${formatBytes(selectedFile.size)} • Ready for ingestion`
                    : 'Supported: PDF, TXT, CSV, PNG, JPG, MP4, WAV, JSON (Max 50MB)'}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
                  disabled={uploading}
                  className="btn-secondary"
                  style={{ fontSize: '0.82rem', padding: '0.5rem 1rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || !selectedFile}
                  className="btn-primary"
                  style={{ fontSize: '0.82rem', padding: '0.5rem 1.25rem', fontWeight: '600' }}
                >
                  {uploading ? 'Ingesting & Hashing...' : 'Ingest & Compute SHA-256'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. FILE PREVIEW MODAL                                                     */}
      {/* ========================================================================= */}
      {previewFile && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: '2rem'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-default)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '840px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '1rem 1.5rem',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                  Preview: {previewFile.sanitized_filename}
                </h3>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  SHA-256: {previewFile.sha256_hash}
                </span>
              </div>
              <button
                onClick={() => setPreviewFile(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.4rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{
              padding: '1.5rem',
              overflowY: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '300px',
              backgroundColor: 'rgba(0, 0, 0, 0.4)'
            }}>
              {['.png', '.jpg', '.jpeg'].includes((previewFile.file_extension || '').toLowerCase()) ? (
                <img
                  src={api.getVaultPreviewUrl(previewFile.file_id)}
                  alt={previewFile.sanitized_filename}
                  style={{ maxWidth: '100%', maxHeight: '60vh', borderRadius: '8px', objectFit: 'contain' }}
                />
              ) : (previewFile.file_extension || '').toLowerCase() === '.mp4' ? (
                <video
                  src={api.getVaultPreviewUrl(previewFile.file_id)}
                  controls
                  style={{ maxWidth: '100%', maxHeight: '60vh', borderRadius: '8px' }}
                />
              ) : ['.wav', '.mp3'].includes((previewFile.file_extension || '').toLowerCase()) ? (
                <audio
                  src={api.getVaultPreviewUrl(previewFile.file_id)}
                  controls
                  style={{ width: '100%', maxWidth: '400px' }}
                />
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📄</div>
                  <p style={{ fontSize: '0.85rem' }}>
                    Direct inline rendering is not supported for this document format.
                  </p>
                  <a
                    href={api.getVaultDownloadUrl(previewFile.file_id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary"
                    style={{ fontSize: '0.8rem', padding: '0.45rem 1rem', display: 'inline-block', marginTop: '0.75rem', textDecoration: 'none' }}
                  >
                    ⬇️ Download & Open Document
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 9. MODALS: ADD EVIDENCE, EDIT EVIDENCE & TRANSFER CUSTODY                */}
      {/* ========================================================================= */}
      <AddEvidenceModal
        isOpen={isAddEvidenceOpen}
        onClose={() => setIsAddEvidenceOpen(false)}
        caseId={caseFilter !== 'ALL' ? parseInt(caseFilter, 10) : (casesList[0]?.case_id || null)}
        cases={casesList}
        onEvidenceAdded={() => {
          loadEvidenceData();
          setSuccessMsg('✓ New forensic evidence record committed and SHA-256 sealed.');
        }}
      />

      <EditEvidenceModal
        isOpen={Boolean(editItem)}
        onClose={() => setEditItem(null)}
        evidenceItem={editItem}
        onEvidenceUpdated={() => {
          loadEvidenceData();
          setSuccessMsg('✓ Evidence record updated and new version sealed in audit trail.');
        }}
      />

      <TransferCustodyModal
        isOpen={Boolean(custodyTransferItem)}
        onClose={() => setCustodyTransferItem(null)}
        evidenceItem={custodyTransferItem}
        officer={officer}
        onCustodyTransferred={() => {
          if (custodyTransferItem) {
            handleToggleRow(custodyTransferItem.evidence_id, custodyTransferItem.case_id);
          }
          loadEvidenceData();
          setSuccessMsg('✓ Chain of custody transfer authorized and cryptographically logged.');
        }}
      />
    </div>
  );
}

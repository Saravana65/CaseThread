import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';

/**
 * @component EvidenceVaultPanel
 * @description Secure digital evidence file vault interface supporting multi-format
 * multipart uploads, format-aware metadata visualization, physical SHA-256 integrity checks,
 * inline previews, and controlled derived artifact generation.
 */
export default function EvidenceVaultPanel({ selectedCaseId, officer }) {
  const [vaultFiles, setVaultFiles] = useState([]);
  const [evidenceItems, setEvidenceItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Search & Filter state
  const [filterFormat, setFilterFormat] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Upload Form state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadEvidenceId, setUploadEvidenceId] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // Inspector Drawer & Preview state
  const [activeFile, setActiveFile] = useState(null);
  const [fileDetails, setFileDetails] = useState(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);

  // Derived Artifact generation state
  const [artifactType, setArtifactType] = useState('EXTRACTED_TEXT');
  const [generatingArtifact, setGeneratingArtifact] = useState(false);

  // Officer Metadata Review state
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  // Verifying state
  const [verifyingId, setVerifyingId] = useState(null);
  const [copiedHash, setCopiedHash] = useState(null);

  // 1. Fetch Vault Files & Case Evidence Items
  const loadVaultData = useCallback(async () => {
    if (!selectedCaseId) return;
    try {
      setLoading(true);
      setError(null);

      const [filesRes, evRes] = await Promise.all([
        api.getVaultFiles(selectedCaseId).catch(() => ({ data: [] })),
        api.getEvidenceByCase(selectedCaseId).catch(() => ({ data: [] }))
      ]);

      setVaultFiles(filesRes.data || []);
      setEvidenceItems(evRes.data || []);

      if (evRes.data && evRes.data.length > 0 && !uploadEvidenceId) {
        setUploadEvidenceId(String(evRes.data[0].evidence_id));
      }
    } catch (err) {
      setError(err.message || 'Failed to load vault files');
    } finally {
      setLoading(false);
    }
  }, [selectedCaseId, uploadEvidenceId]);

  useEffect(() => {
    loadVaultData();
  }, [loadVaultData]);

  // 2. Handle File Selection & Drag-and-Drop
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  // 3. Upload File Handler
  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setUploadError('Please select a file to ingest into the vault.');
      return;
    }
    if (!uploadEvidenceId) {
      setUploadError('Please associate the file with an evidence record.');
      return;
    }

    try {
      setUploading(true);
      setUploadError(null);

      const formData = new FormData();
      formData.append('case_id', String(selectedCaseId));
      formData.append('evidence_id', String(uploadEvidenceId));
      formData.append('file', selectedFile);

      const res = await api.uploadVaultFile(formData);

      setSuccessMsg(`✓ File [${res.data.sanitized_filename}] successfully ingested into secure vault. SHA-256 sealed.`);
      setSelectedFile(null);
      setIsUploadOpen(false);
      await loadVaultData();
    } catch (err) {
      setUploadError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // 4. Verify Physical File Integrity
  const handleVerifyIntegrity = async (file) => {
    try {
      setVerifyingId(file.file_id);
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
        setSuccessMsg(`✓ Physical file [${file.sanitized_filename}] verified INTACT on disk.`);
      } else {
        setError(`⚠ INTEGRITY ALERT: File [${file.sanitized_filename}] failed byte-level hash verification! Status: ${result.integrity_status}`);
      }
    } catch (err) {
      setError(`Integrity check error: ${err.message}`);
    } finally {
      setVerifyingId(null);
    }
  };

  // 5. Open File Details & Metadata Drawer
  const handleOpenFileDrawer = async (file) => {
    setActiveFile(file);
    setDrawerLoading(true);
    setReviewNotes('');
    try {
      const res = await api.getVaultFileDetails(file.file_id);
      setFileDetails(res.data);
    } catch (err) {
      setFileDetails(null);
      setError(`Failed to retrieve file details: ${err.message}`);
    } finally {
      setDrawerLoading(false);
    }
  };

  // 6. Generate Derived Artifact
  const handleGenerateArtifact = async () => {
    if (!activeFile) return;
    try {
      setGeneratingArtifact(true);
      setError(null);

      await api.createDerivedArtifact(activeFile.file_id, artifactType, 'Generated from forensic vault dashboard');
      const detailsRes = await api.getVaultFileDetails(activeFile.file_id);
      setFileDetails(detailsRes.data);
      setSuccessMsg(`✓ Derived artifact (${artifactType}) generated and hashed.`);
    } catch (err) {
      setError(`Artifact generation failed: ${err.message}`);
    } finally {
      setGeneratingArtifact(false);
    }
  };

  // 7. Submit Officer Metadata Review
  const handleReviewMetadata = async (extractionId) => {
    try {
      setReviewSubmitting(true);
      setError(null);
      await api.reviewMetadataExtraction(extractionId, true, reviewNotes || 'Officer verified metadata authenticity.');
      const detailsRes = await api.getVaultFileDetails(activeFile.file_id);
      setFileDetails(detailsRes.data);
      setSuccessMsg('✓ Officer sign-off recorded for automated extraction metadata.');
    } catch (err) {
      setError(`Review recording failed: ${err.message}`);
    } finally {
      setReviewSubmitting(false);
    }
  };

  // Copy hash helper
  const handleCopyHash = (hash, id) => {
    if (!hash) return;
    navigator.clipboard.writeText(hash);
    setCopiedHash(id);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  // Format bytes
  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Get Format Icon
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

  // Filtered files
  const filteredFiles = vaultFiles.filter(f => {
    if (filterFormat !== 'ALL') {
      const ext = (f.file_extension || '').toLowerCase();
      if (filterFormat === 'PDF' && ext !== '.pdf') return false;
      if (filterFormat === 'IMAGE' && !['.png', '.jpg', '.jpeg'].includes(ext)) return false;
      if (filterFormat === 'VIDEO' && ext !== '.mp4') return false;
      if (filterFormat === 'AUDIO' && !['.wav', '.mp3'].includes(ext)) return false;
      if (filterFormat === 'DATA' && !['.csv', '.json', '.xml'].includes(ext)) return false;
    }
    if (filterStatus !== 'ALL' && f.integrity_status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = (f.sanitized_filename || '').toLowerCase().includes(q);
      const matchTrack = (f.tracking_code || '').toLowerCase().includes(q);
      const matchTitle = (f.evidence_title || '').toLowerCase().includes(q);
      if (!matchName && !matchTrack && !matchTitle) return false;
    }
    return true;
  });

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '0 2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header and Controls */}
      <div className="forensic-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.4rem' }}>🗄️</span>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-primary)' }}>
                Secure Evidence Vault & Multi-Format Ingestion
              </h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '0.15rem' }}>
                IMMUTABLE BINARY STORAGE • MAGIC-BYTE VALIDATION • AUTOMATED METADATA EXTRACTION • DERIVED ARTIFACTS
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            onClick={() => setIsUploadOpen(!isUploadOpen)}
            className="btn-primary"
            style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <span>{isUploadOpen ? '✕ Close Form' : '📥 Ingest Evidence File'}</span>
          </button>
          <button
            onClick={loadVaultData}
            className="btn-secondary"
            disabled={loading}
            style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem' }}
          >
            🔄 Refresh Vault
          </button>
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

      {successMsg && (
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
          <div>{successMsg}</div>
          <button onClick={() => setSuccessMsg(null)} style={{ background: 'none', border: 'none', color: 'var(--accent-green)', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* UPLOAD / INGESTION DROPZONE (Collapsible) */}
      {/* ========================================================================= */}
      {isUploadOpen && (
        <form onSubmit={handleUploadSubmit} className="forensic-card" style={{
          border: '1px solid var(--accent-orange)',
          backgroundColor: 'var(--bg-secondary)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--accent-orange)' }}>
              Acquire Digital Evidence File (Multipart Ingestion)
            </h3>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              MAX 50MB • AUTOMATIC MIME MAGIC-BYTE VERIFICATION
            </span>
          </div>

          {uploadError && (
            <div style={{ color: 'var(--accent-red)', fontSize: '0.78rem' }}>
              {uploadError}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {/* Associate Evidence */}
            <div>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                Associate to Evidence Record *
              </label>
              <select
                value={uploadEvidenceId}
                onChange={(e) => setUploadEvidenceId(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                  padding: '0.45rem 0.65rem',
                  borderRadius: '4px',
                  fontSize: '0.8rem'
                }}
                required
              >
                {evidenceItems.length === 0 ? (
                  <option value="">No evidence items cataloged for this case</option>
                ) : (
                  evidenceItems.map(ev => (
                    <option key={ev.evidence_id} value={ev.evidence_id}>
                      [{ev.tracking_code}] {ev.title} ({ev.category})
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Formats Info */}
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
              <span>
                Supported: <strong>PDF, TXT, CSV, JPG, PNG, MP4, WAV, MP3, JSON, XML</strong>.
                Files are stored by secure UUID storage keys outside the public web root.
              </span>
            </div>
          </div>

          {/* Drag & Drop Box */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
            style={{
              border: `2px dashed ${isDragOver ? 'var(--accent-orange)' : 'var(--border-default)'}`,
              borderRadius: '6px',
              padding: '2rem 1rem',
              textAlign: 'center',
              backgroundColor: isDragOver ? 'rgba(251, 146, 60, 0.05)' : 'var(--bg-card)',
              cursor: 'pointer',
              transition: 'border-color 0.2s ease'
            }}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => setSelectedFile(e.target.files[0] || null)}
              style={{ display: 'none' }}
            />
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📁</div>
            {selectedFile ? (
              <div>
                <div style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                  {selectedFile.name}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '0.2rem' }}>
                  {formatBytes(selectedFile.size)} • {selectedFile.type || 'Binary Stream'}
                </div>
              </div>
            ) : (
              <div>
                <div style={{ color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: '600' }}>
                  Drag & Drop forensic evidence file here, or click to browse
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                  Original byte stream is preserved immutably with SHA-256 fingerprinting.
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => { setSelectedFile(null); setIsUploadOpen(false); }}
              className="btn-secondary"
              style={{ fontSize: '0.78rem', padding: '0.4rem 0.8rem' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || !selectedFile}
              className="btn-primary"
              style={{ fontSize: '0.78rem', padding: '0.4rem 1rem' }}
            >
              {uploading ? 'Ingesting & Hashing...' : 'Ingest into Secure Vault'}
            </button>
          </div>
        </form>
      )}

      {/* ========================================================================= */}
      {/* SEARCH & FILTERS BAR */}
      {/* ========================================================================= */}
      <div className="forensic-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', padding: '0.85rem 1.25rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
          <input
            type="text"
            placeholder="Search by filename, tracking code, or title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              backgroundColor: 'var(--bg-input)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-primary)',
              padding: '0.35rem 0.65rem',
              borderRadius: '4px',
              fontSize: '0.78rem',
              minWidth: '240px'
            }}
          />

          <select
            value={filterFormat}
            onChange={(e) => setFilterFormat(e.target.value)}
            style={{
              backgroundColor: 'var(--bg-input)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-primary)',
              padding: '0.35rem 0.65rem',
              borderRadius: '4px',
              fontSize: '0.78rem'
            }}
          >
            <option value="ALL">All Formats</option>
            <option value="PDF">PDF Documents</option>
            <option value="IMAGE">Images (JPG/PNG)</option>
            <option value="VIDEO">Video (MP4)</option>
            <option value="AUDIO">Audio (WAV/MP3)</option>
            <option value="DATA">Data (CSV/JSON/XML)</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{
              backgroundColor: 'var(--bg-input)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-primary)',
              padding: '0.35rem 0.65rem',
              borderRadius: '4px',
              fontSize: '0.78rem'
            }}
          >
            <option value="ALL">All Statuses</option>
            <option value="INTACT">INTACT</option>
            <option value="TAMPERED_MISMATCH">TAMPERED</option>
            <option value="FILE_MISSING">MISSING</option>
          </select>
        </div>

        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {filteredFiles.length} VAULT FILES
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VAULT INVENTORY TABLE */}
      {/* ========================================================================= */}
      <div className="forensic-card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-input)', borderBottom: '1px solid var(--border-default)', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>
                <th style={{ padding: '0.75rem 1rem' }}>Evidence File</th>
                <th style={{ padding: '0.75rem 1rem' }}>Associated Item</th>
                <th style={{ padding: '0.75rem 1rem' }}>Format & Size</th>
                <th style={{ padding: '0.75rem 1rem' }}>SHA-256 Fingerprint</th>
                <th style={{ padding: '0.75rem 1rem' }}>Integrity</th>
                <th style={{ padding: '0.75rem 1rem' }}>Ingested By</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Vault Operations</th>
              </tr>
            </thead>
            <tbody>
              {filteredFiles.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    {loading ? 'Retrieving secure vault files...' : 'No evidence files found in vault matching criteria.'}
                  </td>
                </tr>
              ) : (
                filteredFiles.map((file) => {
                  const isTampered = file.integrity_status === 'TAMPERED_MISMATCH';
                  const isMissing = file.integrity_status === 'FILE_MISSING';
                  const isIntact = file.integrity_status === 'INTACT';
                  const isVerifying = verifyingId === file.file_id;

                  return (
                    <tr
                      key={file.file_id}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        backgroundColor: isTampered || isMissing ? 'rgba(239, 68, 68, 0.05)' : 'transparent'
                      }}
                    >
                      {/* Evidence File */}
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <span style={{ fontSize: '1.25rem' }}>{getFormatIcon(file.file_extension)}</span>
                          <div>
                            <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
                              {file.sanitized_filename}
                            </div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                              KEY: {file.storage_key}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Associated Item */}
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-orange)', fontWeight: '700' }}>
                          {file.tracking_code || `EVD-#${file.evidence_id}`}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                          {file.evidence_title || 'Item #' + file.evidence_id}
                        </div>
                      </td>

                      {/* Format & Size */}
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                          {formatBytes(file.file_size_bytes)}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {file.detected_mime_type || file.mime_type}
                        </div>
                      </td>

                      {/* SHA-256 Fingerprint */}
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <code
                            style={{
                              fontSize: '0.72rem',
                              padding: '0.2rem 0.4rem',
                              backgroundColor: 'var(--bg-card)',
                              border: '1px solid var(--border-default)',
                              borderRadius: '3px',
                              color: 'var(--text-secondary)'
                            }}
                            title={file.sha256_hash}
                          >
                            {file.sha256_hash.substring(0, 10)}...{file.sha256_hash.substring(58)}
                          </code>
                          <button
                            onClick={() => handleCopyHash(file.sha256_hash, file.file_id)}
                            className="btn-secondary"
                            style={{ fontSize: '0.65rem', padding: '0.15rem 0.35rem' }}
                            title="Copy full SHA-256 hash"
                          >
                            {copiedHash === file.file_id ? '✓' : '📋'}
                          </button>
                        </div>
                      </td>

                      {/* Integrity */}
                      <td style={{ padding: '0.85rem 1rem' }}>
                        {isIntact && <span className="badge badge-verified">✓ INTACT</span>}
                        {isTampered && <span className="badge badge-critical">⚠ TAMPERED</span>}
                        {isMissing && <span className="badge badge-critical">✕ MISSING</span>}
                      </td>

                      {/* Ingested By */}
                      <td style={{ padding: '0.85rem 1rem', fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        <div>{file.uploaded_by_officer_name || 'Officer #' + file.uploaded_by_officer_id}</div>
                        <div>{new Date(file.upload_timestamp).toLocaleString()}</div>
                      </td>

                      {/* Operations */}
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                          <button
                            onClick={() => handleOpenFileDrawer(file)}
                            className="btn-secondary"
                            style={{ fontSize: '0.7rem', padding: '0.3rem 0.55rem' }}
                            title="Inspect file metadata and extractions"
                          >
                            🔍 Inspect
                          </button>
                          <button
                            onClick={() => handleVerifyIntegrity(file)}
                            disabled={isVerifying}
                            className="btn-primary"
                            style={{ fontSize: '0.7rem', padding: '0.3rem 0.55rem' }}
                            title="Recalculate live file SHA-256 from disk"
                          >
                            {isVerifying ? 'Checking...' : '🛡️ Hash'}
                          </button>
                          <button
                            onClick={() => setPreviewFile(file)}
                            className="btn-secondary"
                            style={{ fontSize: '0.7rem', padding: '0.3rem 0.55rem' }}
                            title="Preview file"
                          >
                            👁️ Preview
                          </button>
                          <a
                            href={api.getVaultDownloadUrl(file.file_id)}
                            download={file.sanitized_filename}
                            className="btn-secondary"
                            style={{ fontSize: '0.7rem', padding: '0.3rem 0.55rem', textDecoration: 'none' }}
                            title="Download file directly"
                          >
                            💾 Download
                          </a>
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

      {/* ========================================================================= */}
      {/* METADATA INSPECTOR & ARTIFACT DRAWER */}
      {/* ========================================================================= */}
      {activeFile && (
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
            maxWidth: '640px',
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
                  Evidence File Forensic Dossier
                </h3>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  FILE: {activeFile.sanitized_filename}
                </div>
              </div>
              <button
                onClick={() => { setActiveFile(null); setFileDetails(null); }}
                className="btn-secondary"
                style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}
              >
                ✕
              </button>
            </div>

            {drawerLoading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                Loading metadata and extractions...
              </div>
            ) : (
              <>
                {/* Physical Storage Details */}
                <div style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '6px',
                  padding: '1rem',
                  fontSize: '0.78rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem'
                }}>
                  <div style={{ color: 'var(--accent-orange)', fontWeight: '700', fontSize: '0.82rem' }}>
                    Vault Storage Specifications
                  </div>
                  <div>STORAGE KEY: <code style={{ color: 'var(--text-primary)' }}>{activeFile.storage_key}</code></div>
                  <div>PATH OUTSIDE WEB ROOT: <code style={{ color: 'var(--text-muted)' }}>{activeFile.storage_path}</code></div>
                  <div>FILE SIZE: <strong>{formatBytes(activeFile.file_size_bytes)}</strong> ({activeFile.file_size_bytes} bytes)</div>
                  <div>SHA-256 HASH: <code style={{ color: 'var(--accent-green)' }}>{activeFile.sha256_hash}</code></div>
                  <div>MIME TYPE: {activeFile.detected_mime_type} (Verified by Magic Bytes)</div>
                </div>

                {/* Automated Metadata Extraction Card */}
                {fileDetails?.latest_extraction && (
                  <div style={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-default)',
                    borderRadius: '6px',
                    padding: '1rem',
                    fontSize: '0.78rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.6rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--accent-orange)', fontWeight: '700', fontSize: '0.82rem' }}>
                        Automated Format Extraction ({fileDetails.latest_extraction.file_format})
                      </span>
                      <span className="badge badge-verified">
                        {fileDetails.latest_extraction.extraction_status}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      TOOL: {fileDetails.latest_extraction.extractor_tool} {fileDetails.latest_extraction.extractor_version}
                    </div>

                    {/* Formatted JSON Metadata Box */}
                    <div style={{
                      backgroundColor: 'var(--bg-input)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '4px',
                      padding: '0.75rem',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.72rem',
                      maxHeight: '180px',
                      overflowY: 'auto'
                    }}>
                      <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                        {typeof fileDetails.latest_extraction.extracted_metadata_json === 'string'
                          ? fileDetails.latest_extraction.extracted_metadata_json
                          : JSON.stringify(fileDetails.latest_extraction.extracted_metadata_json, null, 2)}
                      </pre>
                    </div>

                    {/* Officer Sign-off */}
                    <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.6rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                        <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
                          Officer Review Status:
                        </span>
                        <span className={`badge ${fileDetails.latest_extraction.officer_reviewed ? 'badge-verified' : 'badge-medium'}`}>
                          {fileDetails.latest_extraction.officer_reviewed ? 'REVIEWED & VERIFIED' : 'PENDING REVIEW'}
                        </span>
                      </div>

                      {!fileDetails.latest_extraction.officer_reviewed && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.4rem' }}>
                          <input
                            type="text"
                            placeholder="Add officer verification notes..."
                            value={reviewNotes}
                            onChange={(e) => setReviewNotes(e.target.value)}
                            style={{
                              backgroundColor: 'var(--bg-card)',
                              border: '1px solid var(--border-default)',
                              color: 'var(--text-primary)',
                              padding: '0.35rem 0.5rem',
                              borderRadius: '4px',
                              fontSize: '0.75rem'
                            }}
                          />
                          <button
                            onClick={() => handleReviewMetadata(fileDetails.latest_extraction.extraction_id)}
                            disabled={reviewSubmitting}
                            className="btn-primary"
                            style={{ fontSize: '0.72rem', padding: '0.3rem 0.6rem', alignSelf: 'flex-start' }}
                          >
                            {reviewSubmitting ? 'Recording...' : '✓ Approve & Sign-Off Metadata'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Derived Artifacts Section */}
                <div style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '6px',
                  padding: '1rem',
                  fontSize: '0.78rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem'
                }}>
                  <div style={{ color: 'var(--accent-orange)', fontWeight: '700', fontSize: '0.82rem' }}>
                    Derived Forensic Artifacts (Stage 6)
                  </div>

                  {/* Create Artifact Form */}
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <select
                      value={artifactType}
                      onChange={(e) => setArtifactType(e.target.value)}
                      style={{
                        backgroundColor: 'var(--bg-input)',
                        border: '1px solid var(--border-default)',
                        color: 'var(--text-primary)',
                        padding: '0.35rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem'
                      }}
                    >
                      <option value="EXTRACTED_TEXT">Extracted Text Stream</option>
                      <option value="NORMALIZED_DATA">Normalized JSON Records</option>
                      <option value="PREVIEW_IMAGE">Keyframe / Preview Snapshot</option>
                    </select>

                    <button
                      onClick={handleGenerateArtifact}
                      disabled={generatingArtifact}
                      className="btn-primary"
                      style={{ fontSize: '0.72rem', padding: '0.35rem 0.7rem' }}
                    >
                      {generatingArtifact ? 'Generating...' : '+ Generate Artifact'}
                    </button>
                  </div>

                  {/* Artifacts List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {(fileDetails?.derived_artifacts || []).length === 0 ? (
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                        No derived artifacts generated for this file yet.
                      </div>
                    ) : (
                      fileDetails.derived_artifacts.map(art => (
                        <div
                          key={art.artifact_id}
                          style={{
                            backgroundColor: 'var(--bg-input)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '4px',
                            padding: '0.6rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
                              {art.artifact_type} ({formatBytes(art.file_size_bytes)})
                            </div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                              HASH: {art.sha256_hash.substring(0, 16)}...
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                              {art.transformation_summary}
                            </div>
                          </div>

                          <a
                            href={api.getArtifactDownloadUrl(art.artifact_id)}
                            download={art.storage_key}
                            className="btn-secondary"
                            style={{ fontSize: '0.7rem', padding: '0.25rem 0.5rem', textDecoration: 'none' }}
                          >
                            💾 Download
                          </a>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* INLINE PREVIEW MODAL */}
      {/* ========================================================================= */}
      {previewFile && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: '1rem'
        }}>
          <div className="forensic-card" style={{ maxWidth: '900px', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-default)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                  Inline Forensic Preview: {previewFile.sanitized_filename}
                </h3>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  SHA-256: {previewFile.sha256_hash}
                </div>
              </div>
              <button
                onClick={() => setPreviewFile(null)}
                className="btn-secondary"
                style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}
              >
                ✕
              </button>
            </div>

            <div style={{ flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
              {['.jpg', '.jpeg', '.png'].includes((previewFile.file_extension || '').toLowerCase()) ? (
                <img
                  src={api.getVaultPreviewUrl(previewFile.file_id)}
                  alt="Evidence Preview"
                  style={{ maxWidth: '100%', maxHeight: '65vh', objectFit: 'contain', borderRadius: '4px' }}
                />
              ) : previewFile.file_extension === '.mp4' ? (
                <video
                  controls
                  src={api.getVaultPreviewUrl(previewFile.file_id)}
                  style={{ maxWidth: '100%', maxHeight: '65vh', borderRadius: '4px' }}
                />
              ) : ['.wav', '.mp3'].includes((previewFile.file_extension || '').toLowerCase()) ? (
                <audio
                  controls
                  src={api.getVaultPreviewUrl(previewFile.file_id)}
                  style={{ width: '80%' }}
                />
              ) : (
                <iframe
                  src={api.getVaultPreviewUrl(previewFile.file_id)}
                  title="Document Preview"
                  style={{ width: '100%', height: '60vh', border: 'none', backgroundColor: '#fff' }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

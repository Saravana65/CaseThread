/**
 * @file api.js
 * @description API service client communicating with CASETHREAD Express backend.
 */

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api/v1';

class ApiService {
  constructor() {
    this.tokenKey = 'casethread_auth_token';
  }

  getToken() {
    return localStorage.getItem(this.tokenKey);
  }

  setToken(token) {
    if (token) {
      localStorage.setItem(this.tokenKey, token);
    } else {
      localStorage.removeItem(this.tokenKey);
    }
  }

  async request(endpoint, options = {}) {
    const token = this.getToken();
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
    const headers = {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers
    };

    const config = {
      ...options,
      headers
    };

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401 && endpoint !== '/auth/login') {
          this.setToken(null);
        }
        throw new Error(data.error?.message || `Request failed with status ${response.status}`);
      }

      return data;
    } catch (err) {
      console.error(`[API ERROR] ${endpoint}:`, err.message);
      throw err;
    }
  }

  // Auth
  login(badge_number, password) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ badge_number, password })
    });
  }

  getProfile() {
    return this.request('/auth/profile');
  }

  // Cases
  getCases() {
    return this.request('/cases');
  }

  getCaseById(caseId) {
    return this.request(`/cases/${caseId}`);
  }

  createCase(caseData) {
    return this.request('/cases', {
      method: 'POST',
      body: JSON.stringify(caseData)
    });
  }

  // Evidence
  addEvidence(evidenceData) {
    return this.request('/evidence', {
      method: 'POST',
      body: JSON.stringify(evidenceData)
    });
  }

  getEvidenceByCase(caseId) {
    return this.request(`/evidence/case/${caseId}`);
  }

  // C Algorithm Engine Analysis
  runCaseAnalysis(caseId) {
    return this.request(`/analysis/cases/${caseId}/run`, {
      method: 'POST'
    });
  }

  getPastAnalyses(caseId) {
    return this.request(`/analysis/cases/${caseId}/history`);
  }

  // Phase 4: C-Engine Evidence Graph Analysis APIs
  getCaseGraph(caseId) {
    return this.request(`/cases/${caseId}/graph`);
  }

  getGraphNodes(caseId, params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/cases/${caseId}/graph/nodes${q ? '?' + q : ''}`);
  }

  getGraphEdges(caseId, params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/cases/${caseId}/graph/edges${q ? '?' + q : ''}`);
  }

  findGraphPath(caseId, sourceId, targetId, sourceType = '', targetType = '') {
    const q = new URLSearchParams({
      source_id: sourceId,
      target_id: targetId,
      ...(sourceType && { source_type: sourceType }),
      ...(targetType && { target_type: targetType })
    }).toString();
    return this.request(`/cases/${caseId}/graph/path?${q}`);
  }

  exploreGraphNode(caseId, nodeId, depth = 2, nodeType = '') {
    const q = new URLSearchParams({
      depth,
      ...(nodeType && { node_type: nodeType })
    }).toString();
    return this.request(`/cases/${caseId}/graph/explore/${nodeId}?${q}`);
  }

  getConnectedComponents(caseId) {
    return this.request(`/cases/${caseId}/graph/components`);
  }

  getIsolatedEvidence(caseId) {
    return this.request(`/cases/${caseId}/graph/isolated`);
  }

  createRelationship(caseId, relData) {
    return this.request(`/cases/${caseId}/graph/edges`, {
      method: 'POST',
      body: JSON.stringify(relData)
    });
  }

  // Phase 7: Forensic Evidence Integrity, Custody, Versions, and Reports
  verifyEvidenceIntegrity(evidenceId) {
    return this.request(`/evidence/${evidenceId}/verify-integrity`, {
      method: 'POST'
    });
  }

  getEvidenceVersions(evidenceId) {
    return this.request(`/evidence/${evidenceId}/versions`);
  }

  getEvidenceAuditChain(evidenceId) {
    return this.request(`/evidence/${evidenceId}/audit-chain`);
  }

  verifyEvidenceAuditChain(evidenceId) {
    return this.request(`/evidence/${evidenceId}/audit-chain/verify`, {
      method: 'POST'
    });
  }

  getCustodyHistory(evidenceId) {
    return this.request(`/custody/evidence/${evidenceId}`);
  }

  transferCustody(transferData) {
    return this.request('/custody/transfer', {
      method: 'POST',
      body: JSON.stringify(transferData)
    });
  }

  getCaseReportJson(caseId) {
    return this.request(`/reports/cases/${caseId}/json`);
  }

  getCaseReportHtmlUrl(caseId) {
    const token = this.getToken();
    return `${API_BASE_URL}/reports/cases/${caseId}/html${token ? '?token=' + encodeURIComponent(token) : ''}`;
  }

  // Phase 8: Secure Evidence File Vault, Ingestion, Metadata Extraction & Artifacts
  uploadVaultFile(formData) {
    return this.request('/vault/upload', {
      method: 'POST',
      body: formData
    });
  }

  getVaultFiles(caseId) {
    return this.request(`/vault/cases/${caseId}/files`);
  }

  getVaultFileDetails(fileId) {
    return this.request(`/vault/files/${fileId}`);
  }

  verifyVaultFileIntegrity(fileId) {
    return this.request(`/vault/files/${fileId}/verify-integrity`, {
      method: 'POST'
    });
  }

  createDerivedArtifact(fileId, artifactType, notes = '') {
    return this.request(`/vault/files/${fileId}/artifacts`, {
      method: 'POST',
      body: JSON.stringify({ artifact_type: artifactType, notes })
    });
  }

  reviewMetadataExtraction(extractionId, approved, reviewNotes = '') {
    return this.request(`/vault/extractions/${extractionId}/review`, {
      method: 'POST',
      body: JSON.stringify({ approved, review_notes: reviewNotes })
    });
  }

  searchVaultFiles(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/vault/search${q ? '?' + q : ''}`);
  }

  getVaultDownloadUrl(fileId) {
    const token = this.getToken();
    return `${API_BASE_URL}/vault/files/${fileId}/download${token ? '?token=' + encodeURIComponent(token) : ''}`;
  }

  getVaultPreviewUrl(fileId) {
    const token = this.getToken();
    return `${API_BASE_URL}/vault/files/${fileId}/preview${token ? '?token=' + encodeURIComponent(token) : ''}`;
  }

  getArtifactDownloadUrl(artifactId) {
    const token = this.getToken();
    return `${API_BASE_URL}/vault/artifacts/${artifactId}/download${token ? '?token=' + encodeURIComponent(token) : ''}`;
  }
}

export const api = new ApiService();
export default api;

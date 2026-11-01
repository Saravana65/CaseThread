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

  // Phase 9: Geospatial Evidence Intelligence & Mapping
  getCaseGeospatial(caseId) {
    return this.request(`/cases/${caseId}/geospatial`);
  }

  searchCaseGeospatial(caseId, searchPayload) {
    return this.request(`/cases/${caseId}/geospatial/search`, {
      method: 'POST',
      body: JSON.stringify(searchPayload)
    });
  }

  getCaseGeospatialClusters(caseId, radiusMeters = 200) {
    return this.request(`/cases/${caseId}/geospatial/clusters?cluster_radius_meters=${radiusMeters}`);
  }

  analyzeCaseGeospatial(caseId) {
    return this.request(`/cases/${caseId}/geospatial/analyze`, {
      method: 'POST'
    });
  }

  recordGeospatialPoint(caseId, pointData) {
    return this.request(`/cases/${caseId}/geospatial/points`, {
      method: 'POST',
      body: JSON.stringify(pointData)
    });
  }

  getEvidenceLocation(evidenceId) {
    return this.request(`/evidence/${evidenceId}/location`);
  }

  reviewGeospatialPoint(caseId, pointId, reviewData) {
    return this.request(`/cases/${caseId}/geospatial/points/${pointId}/review`, {
      method: 'POST',
      body: JSON.stringify(reviewData)
    });
  }

  // Phase 10: Multi-Officer Collaboration & Investigation Workflow
  getCaseMembers(caseId) {
    return this.request(`/cases/${caseId}/members`);
  }

  addCaseMember(caseId, data) {
    return this.request(`/cases/${caseId}/members`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  updateCaseMember(caseId, memberId, data) {
    return this.request(`/cases/${caseId}/members/${memberId}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  removeCaseMember(caseId, memberId, reason = '') {
    return this.request(`/cases/${caseId}/members/${memberId}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason })
    });
  }

  transferCaseLeadership(caseId, data) {
    return this.request(`/cases/${caseId}/transfer-leadership`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  getCaseTasks(caseId, params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/cases/${caseId}/tasks${q ? '?' + q : ''}`);
  }

  createTask(caseId, data) {
    return this.request(`/cases/${caseId}/tasks`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  getTaskById(taskId) {
    return this.request(`/tasks/${taskId}`);
  }

  updateTask(taskId, data) {
    return this.request(`/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  assignTask(taskId, data) {
    return this.request(`/tasks/${taskId}/assign`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  addTaskNote(taskId, data) {
    return this.request(`/tasks/${taskId}/notes`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  completeTask(taskId, data) {
    return this.request(`/tasks/${taskId}/complete`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  addTaskDependency(taskId, data) {
    return this.request(`/tasks/${taskId}/dependencies`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  removeTaskDependency(taskId, depId) {
    return this.request(`/tasks/${taskId}/dependencies/${depId}`, {
      method: 'DELETE'
    });
  }

  getCaseReviews(caseId) {
    return this.request(`/cases/${caseId}/reviews`);
  }

  requestEvidenceReview(evidenceId, data) {
    return this.request(`/evidence/${evidenceId}/reviews`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  submitEvidenceReview(reviewId, data) {
    return this.request(`/reviews/${reviewId}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  getCaseActivity(caseId, params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/cases/${caseId}/activity${q ? '?' + q : ''}`);
  }

  getNotifications(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/notifications${q ? '?' + q : ''}`);
  }

  markNotificationRead(notificationId) {
    return this.request(`/notifications/${notificationId}/read`, {
      method: 'PATCH'
    });
  }

  markAllNotificationsRead() {
    return this.request('/notifications/read-all', {
      method: 'POST'
    });
  }

  getWorkflowAnalytics(caseId) {
    return this.request(`/cases/${caseId}/workflow-analytics`);
  }
}

export const api = new ApiService();
export default api;

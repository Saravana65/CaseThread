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
    const headers = {
      'Content-Type': 'application/json',
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
}

export const api = new ApiService();
export default api;

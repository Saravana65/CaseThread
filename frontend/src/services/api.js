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

  // C Algorithm Engine Analysis
  runCaseAnalysis(caseId) {
    return this.request(`/analysis/cases/${caseId}/run`, {
      method: 'POST'
    });
  }

  getPastAnalyses(caseId) {
    return this.request(`/analysis/cases/${caseId}/history`);
  }
}

export const api = new ApiService();
export default api;

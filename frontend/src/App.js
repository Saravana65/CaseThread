import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import LoginForm from './components/LoginForm';
import Investigations from './pages/Investigations';
import CaseDetailsPanel from './components/CaseDetailsPanel';
import GraphAnalysis from './pages/GraphAnalysis';
import EvidenceGapWorkspace from './pages/EvidenceGapWorkspace';
import TimelinePanel from './components/TimelinePanel';
import InvestigativeLeadsPanel from './components/InvestigativeLeadsPanel';
import EvidenceIntegrityPanel from './components/EvidenceIntegrityPanel';
import EvidenceVaultPanel from './components/EvidenceVaultPanel';
import ReportExportModal from './components/ReportExportModal';
import CreateCaseModal from './components/CreateCaseModal';
import SettingsModal from './components/SettingsModal';
import ReportCenter from './pages/ReportCenter';
import JarvisVoiceAssistant from './components/JarvisVoiceAssistant';
import CrossCaseGraphView from './components/CrossCaseGraphView';
import SettingsView from './pages/SettingsView';
import api from './services/api';
import './styles/theme.css';

export default function App() {
  // Phase 20: AI Assistant is the primary workspace landing view after login
  const [activeTab, setActiveTab] = useState('ai_assistant');
  const [selectedCaseId, setSelectedCaseId] = useState(1);
  const [caseData, setCaseData] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  // Sub-view states for consolidated sections
  const [evidenceSubTab, setEvidenceSubTab] = useState('vault'); // 'vault' | 'integrity'
  const [analysisSubTab, setAnalysisSubTab] = useState('gaps'); // 'gaps' | 'graph' | 'cross_case' | 'timeline'
  const [viewingDossier, setViewingDossier] = useState(false);
  const [caseFilter, setCaseFilter] = useState('ALL');

  // Theme Management (Apple-inspired Dark Charcoal & Light Neutral)
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('casethread_theme') || 'dark';
    } catch (e) {
      return 'dark';
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('casethread_theme', theme);
    } catch (e) {}
  }, [theme]);

  const handleToggleTheme = (specificTheme) => {
    if (typeof specificTheme === 'string') {
      setTheme(specificTheme);
    } else {
      setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
    }
  };

  // Sidebar collapse & responsive state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 1024;
    }
    return false;
  });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768;
    }
    return false;
  });

  // Modal states
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [isCreateCaseOpen, setIsCreateCaseOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [isVoiceOverlayOpen, setIsVoiceOverlayOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  // Authentication state
  const [officer, setOfficer] = useState(() => {
    try {
      const cached = localStorage.getItem('casethread_officer');
      return cached ? JSON.parse(cached) : null;
    } catch (e) {
      return null;
    }
  });

  const [authLoading, setAuthLoading] = useState(() => {
    const token = api.getToken();
    const cached = localStorage.getItem('casethread_officer');
    if (!token) return false;
    if (cached) return false;
    return true;
  });

  // Responsive window resize listener
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768);
      if (width < 768) {
        setMobileSidebarOpen(false);
      } else if (width < 1024) {
        setSidebarCollapsed(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Keyboard shortcut: Ctrl+[ to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '[') {
        e.preventDefault();
        setSidebarCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Session verification
  const checkActiveSession = useCallback(async () => {
    const token = api.getToken();
    if (!token) {
      setOfficer(null);
      try {
        localStorage.removeItem('casethread_officer');
      } catch (e) {}
      setAuthLoading(false);
      return;
    }

    try {
      const res = await api.getProfile();
      const profile = res?.data?.officer || res?.data || res?.officer;
      if (profile && (profile.badge_number || profile.officer_id || profile.full_name)) {
        setOfficer(profile);
        try {
          localStorage.setItem('casethread_officer', JSON.stringify(profile));
        } catch (e) {}
      } else {
        api.setToken(null);
        setOfficer(null);
        try {
          localStorage.removeItem('casethread_officer');
        } catch (e) {}
      }
    } catch (err) {
      console.warn('Session verification notice (clearing expired session):', err.message);
      api.setToken(null);
      setOfficer(null);
      try {
        localStorage.removeItem('casethread_officer');
      } catch (e) {}
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    checkActiveSession();
  }, [checkActiveSession]);

  // Load detailed case information & C Engine analysis
  const loadCaseInfo = useCallback(async (caseId) => {
    try {
      const res = await api.getCaseById(caseId);
      if (res.data) {
        setCaseData(res.data);
      }
      try {
        const graphRes = await api.getCaseGraph(caseId);
        if (graphRes.data) {
          setAnalysisData(graphRes.data);
        }
      } catch (gErr) {
        console.warn('C-Engine graph load notice:', gErr.message);
      }
    } catch (err) {
      console.error('Failed to load case data:', err);
    }
  }, []);

  useEffect(() => {
    if (officer && selectedCaseId) {
      loadCaseInfo(selectedCaseId);
    }
  }, [officer, selectedCaseId, loadCaseInfo]);

  // Trigger C algorithm engine analysis
  const handleTriggerAnalysis = async (caseId) => {
    try {
      setAnalyzing(true);
      const res = await api.runCaseAnalysis(caseId);
      const resultData = res.data?.analysis || res.data;
      setAnalysisData(resultData);
      await loadCaseInfo(caseId);
    } catch (err) {
      console.error('Analysis execution failed:', err);
      alert('Analysis execution error: ' + err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleLoginSuccess = (officerProfile) => {
    const normalized = officerProfile?.officer || officerProfile?.data || officerProfile;
    setOfficer(normalized);
    try {
      localStorage.setItem('casethread_officer', JSON.stringify(normalized));
    } catch (e) {
      console.warn('Could not cache officer profile in localStorage:', e);
    }
    // Landing workspace upon successful authentication is AI Assistant
    setActiveTab('ai_assistant');
    setViewingDossier(false);
    setCaseFilter('ALL');
  };

  const handleLogout = () => {
    api.setToken(null);
    try {
      localStorage.removeItem('casethread_officer');
    } catch (e) {}
    setOfficer(null);
    setActiveTab('ai_assistant');
    setCaseData(null);
    setAnalysisData(null);
  };

  // Handler for navigation selections originating from the Sidebar or any view
  const handleSelectNav = (tabId, options = {}) => {
    if (options.action === 'create_case') {
      setIsCreateCaseOpen(true);
      return;
    }
    if (options.action === 'open_reports' || tabId === 'reports') {
      setActiveTab('reports');
      return;
    }
    if (options.action === 'open_settings' || tabId === 'settings') {
      setActiveTab('settings');
      return;
    }

    if (tabId === 'dashboard' || tabId === 'investigations') {
      setActiveTab('investigations');
      setViewingDossier(false);
      if (options.caseFilter !== undefined) {
        setCaseFilter(options.caseFilter);
      }
      return;
    }

    if (tabId === 'dossier') {
      setActiveTab('investigations');
      setViewingDossier(true);
      return;
    }

    if (tabId === 'vault' || tabId === 'integrity' || tabId === 'evidence') {
      setActiveTab('evidence');
      if (tabId === 'integrity') setEvidenceSubTab('integrity');
      else setEvidenceSubTab('vault');
      return;
    }

    if (['case_analysis', 'graph', 'gaps', 'cross_case_graph', 'timeline', 'leads'].includes(tabId)) {
      setActiveTab('case_analysis');
      if (tabId === 'graph') setAnalysisSubTab('graph');
      else if (tabId === 'cross_case_graph') setAnalysisSubTab('cross_case');
      else if (tabId === 'timeline' || tabId === 'leads') setAnalysisSubTab('timeline');
      else setAnalysisSubTab('gaps');
      return;
    }

    if (tabId === 'ai_assistant' || tabId === 'voice_assistant') {
      setActiveTab('ai_assistant');
      return;
    }

    if (tabId) {
      setActiveTab(tabId);
    }
  };

  // Handler when a new case is registered
  const handleCaseCreated = (newCase) => {
    const newId = newCase?.case_id;
    if (newId) {
      setSelectedCaseId(newId);
      loadCaseInfo(newId);
      setActiveTab('investigations');
      setViewingDossier(true);
    }
  };

  // 1. Initial Authentication Check Loading State
  if (authLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: 'var(--bg-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '1rem',
          color: 'var(--text-primary)'
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            border: '3px solid var(--border-default)',
            borderTopColor: 'var(--accent-primary)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}
        />
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          SECURE INVESTIGATION SYSTEM: INITIALIZING SESSION...
        </div>
      </div>
    );
  }

  // 2. Unauthenticated State: Render Login Portal
  if (!officer) {
    return <LoginForm onLoginSuccess={handleLoginSuccess} />;
  }

  // 3. Authenticated Officer Forensic Workspace: Left Sidebar + Top Header Layout
  const currentSidebarWidth = isMobile ? 0 : (sidebarCollapsed ? 68 : 240);

  return (
    <div
      className="casethread-app"
      style={{
        minHeight: '100vh',
        display: 'flex',
        backgroundColor: 'var(--bg-primary)'
      }}
    >
      {/* Collapsible Left Navigation Sidebar (6 canonical sections) */}
      <Sidebar
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        activeTab={activeTab}
        caseFilter={caseFilter}
        onSelectNav={handleSelectNav}
        officer={officer}
        onLogout={handleLogout}
        isMobile={isMobile}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      {/* Main Content Area Positioned to the Right of the Sidebar */}
      <div
        style={{
          flex: 1,
          marginLeft: `${currentSidebarWidth}px`,
          width: `calc(100% - ${currentSidebarWidth}px)`,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          transition: 'margin-left 0.25s cubic-bezier(0.4, 0, 0.2, 1), width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          minWidth: 0
        }}
      >
        {/* Top Content Header */}
        <Header
          officer={officer}
          activeTab={activeTab}
          selectedCaseId={selectedCaseId}
          caseData={caseData}
          onOpenCreateCase={() => setIsCreateCaseOpen(true)}
          onOpenReport={() => setActiveTab('reports')}
          onOpenVoiceAssistant={() => setIsVoiceOverlayOpen(true)}
          unreadCount={unreadNotifications}
          onToggleMobileSidebar={() => setMobileSidebarOpen((prev) => !prev)}
          isMobile={isMobile}
          theme={theme}
          onToggleTheme={handleToggleTheme}
        />

        {/* Dynamic Investigation Workspace Views */}
        <main style={{ flex: 1, padding: activeTab === 'ai_assistant' ? '0' : '1.25rem 0' }}>
          {/* 1. AI Assistant (Primary Landing Workspace) */}
          {(activeTab === 'ai_assistant' || activeTab === 'voice_assistant') && (
            <JarvisVoiceAssistant
              activeCase={caseData}
              officer={officer}
              onNavigateTab={handleSelectNav}
            />
          )}

          {/* 2. Investigations Section */}
          {(activeTab === 'investigations' || activeTab === 'dashboard') && (
            <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '0 2rem' }}>
              {viewingDossier && selectedCaseId ? (
                <div>
                  <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <button
                      onClick={() => setViewingDossier(false)}
                      className="btn-secondary"
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '6px 14px' }}
                    >
                      ← Back to Investigations Roster
                    </button>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Dossier: <strong>{caseData?.case_number || `CASE #${selectedCaseId}`}</strong>
                    </span>
                  </div>
                  <CaseDetailsPanel
                    caseData={caseData}
                    onTriggerAnalysis={handleTriggerAnalysis}
                    analyzing={analyzing}
                    onExploreGraph={() => handleSelectNav('graph')}
                    onRefreshCase={loadCaseInfo}
                    onOpenReport={() => setActiveTab('reports')}
                    onBack={() => setViewingDossier(false)}
                    onNavigateTab={handleSelectNav}
                  />
                </div>
              ) : (
                <Investigations
                  selectedCaseId={selectedCaseId}
                  onSelectCaseId={(id) => {
                    setSelectedCaseId(id);
                    loadCaseInfo(id);
                    setViewingDossier(true);
                  }}
                  onNavigateTab={handleSelectNav}
                  initialFilter={caseFilter}
                  onOpenCreateCase={() => setIsCreateCaseOpen(true)}
                />
              )}
            </div>
          )}

          {/* 3. Evidence Section (Unified Vault & Chain of Custody) */}
          {(activeTab === 'evidence' || activeTab === 'vault' || activeTab === 'integrity') && (
            <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '0 2rem' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '1.25rem',
                  flexWrap: 'wrap',
                  gap: '0.75rem'
                }}
              >
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                    Evidence Management & Custody Vault
                  </h2>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Cryptographic evidence vault, automated SHA-256 integrity, and court-admissible chain of custody.
                  </p>
                </div>
                <div
                  style={{
                    display: 'flex',
                    gap: '4px',
                    backgroundColor: 'var(--bg-elevated)',
                    padding: '4px',
                    borderRadius: 'var(--radius-control)',
                    border: '1px solid var(--border-default)'
                  }}
                >
                  <button
                    onClick={() => setEvidenceSubTab('vault')}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 'var(--radius-sm)',
                      border: 'none',
                      backgroundColor: evidenceSubTab === 'vault' ? 'var(--accent-primary)' : 'transparent',
                      color: evidenceSubTab === 'vault' ? '#FFFFFF' : 'var(--text-secondary)',
                      fontSize: '0.78rem',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Evidence Vault & Files
                  </button>
                  <button
                    onClick={() => setEvidenceSubTab('integrity')}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 'var(--radius-sm)',
                      border: 'none',
                      backgroundColor: evidenceSubTab === 'integrity' ? 'var(--accent-primary)' : 'transparent',
                      color: evidenceSubTab === 'integrity' ? '#FFFFFF' : 'var(--text-secondary)',
                      fontSize: '0.78rem',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Chain of Custody & Hashes
                  </button>
                </div>
              </div>

              {evidenceSubTab === 'vault' && (
                <EvidenceVaultPanel
                  selectedCaseId={selectedCaseId}
                  officer={officer}
                />
              )}
              {evidenceSubTab === 'integrity' && (
                <EvidenceIntegrityPanel
                  selectedCaseId={selectedCaseId}
                  officer={officer}
                  onOpenReport={() => setReportModalOpen(true)}
                />
              )}
            </div>
          )}

          {/* 4. Case Analysis Section (Gap Analysis, Graphs, Cross-Case, Timelines) */}
          {(activeTab === 'case_analysis' || activeTab === 'graph' || activeTab === 'gaps' || activeTab === 'cross_case_graph' || activeTab === 'timeline' || activeTab === 'leads') && (
            <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '0 2rem' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '1.25rem',
                  flexWrap: 'wrap',
                  gap: '0.75rem'
                }}
              >
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                    Forensic Case Analysis & Native C Graph Intelligence
                  </h2>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Detect evidentiary contradictions, explore relational networks, and uncover cross-case patterns.
                  </p>
                </div>
                <div
                  style={{
                    display: 'flex',
                    gap: '4px',
                    backgroundColor: 'var(--bg-elevated)',
                    padding: '4px',
                    borderRadius: 'var(--radius-control)',
                    border: '1px solid var(--border-default)',
                    flexWrap: 'wrap'
                  }}
                >
                  <button
                    onClick={() => setAnalysisSubTab('gaps')}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: 'none',
                      backgroundColor: analysisSubTab === 'gaps' ? 'var(--accent-primary)' : 'transparent',
                      color: analysisSubTab === 'gaps' ? '#FFFFFF' : 'var(--text-secondary)',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Evidence Gap Analysis
                  </button>
                  <button
                    onClick={() => setAnalysisSubTab('graph')}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: 'none',
                      backgroundColor: analysisSubTab === 'graph' ? 'var(--accent-primary)' : 'transparent',
                      color: analysisSubTab === 'graph' ? '#FFFFFF' : 'var(--text-secondary)',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Relational Graph (C-Engine)
                  </button>
                  <button
                    onClick={() => setAnalysisSubTab('cross_case')}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: 'none',
                      backgroundColor: analysisSubTab === 'cross_case' ? 'var(--accent-primary)' : 'transparent',
                      color: analysisSubTab === 'cross_case' ? '#FFFFFF' : 'var(--text-secondary)',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Cross-Case Graph
                  </button>
                  <button
                    onClick={() => setAnalysisSubTab('timeline')}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: 'none',
                      backgroundColor: analysisSubTab === 'timeline' ? 'var(--accent-primary)' : 'transparent',
                      color: analysisSubTab === 'timeline' ? '#FFFFFF' : 'var(--text-secondary)',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Timeline & Priority Leads
                  </button>
                </div>
              </div>

              {analysisSubTab === 'gaps' && (
                <EvidenceGapWorkspace
                  caseId={selectedCaseId}
                  onSelectCase={(id) => {
                    setSelectedCaseId(id);
                    loadCaseInfo(id);
                  }}
                />
              )}
              {analysisSubTab === 'graph' && (
                <GraphAnalysis
                  initialCaseId={selectedCaseId}
                  onSelectCase={(id) => {
                    setSelectedCaseId(id);
                    loadCaseInfo(id);
                  }}
                />
              )}
              {analysisSubTab === 'cross_case' && (
                <CrossCaseGraphView
                  selectedCaseId={selectedCaseId}
                  onSelectCase={(id) => {
                    setSelectedCaseId(id);
                    loadCaseInfo(id);
                  }}
                />
              )}
              {analysisSubTab === 'timeline' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <TimelinePanel
                    caseId={selectedCaseId}
                    caseData={caseData}
                    onSelectCase={(id) => {
                      setSelectedCaseId(id);
                      loadCaseInfo(id);
                    }}
                    onRefreshCase={() => loadCaseInfo(selectedCaseId)}
                  />
                  <InvestigativeLeadsPanel
                    leads={
                      analysisData?.prioritized_leads && analysisData.prioritized_leads.length > 0
                        ? analysisData.prioritized_leads
                        : (caseData?.leads || [])
                    }
                  />
                </div>
              )}
            </div>
          )}

          {/* 5. Reports Section */}
          {activeTab === 'reports' && (
            <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '0 2rem' }}>
              <ReportCenter
                caseId={selectedCaseId}
                caseData={caseData}
                onSelectCase={(id) => {
                  setSelectedCaseId(id);
                  loadCaseInfo(id);
                }}
              />
            </div>
          )}

          {/* 6. Settings Section */}
          {activeTab === 'settings' && (
            <SettingsView
              officer={officer}
              theme={theme}
              onToggleTheme={handleToggleTheme}
            />
          )}
        </main>

        {/* Global Forensic Application Footer */}
        <footer
          style={{
            backgroundColor: 'var(--bg-secondary)',
            borderTop: '1px solid var(--border-default)',
            padding: '0.85rem 2rem',
            textAlign: 'center',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)'
          }}
        >
          CASETHREAD v1.0.0 • AI-First Digital Forensics Assistant • Native C DSA Engine (BFS • DFS • Dijkstra • HashMaps)
        </footer>
      </div>

      {/* Report Export Modal */}
      <ReportExportModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        caseId={selectedCaseId}
        caseNumber={caseData?.case_number}
        caseTitle={caseData?.title}
        onNavigateToReportCenter={() => setActiveTab('reports')}
      />

      {/* Case Registration Modal */}
      <CreateCaseModal
        isOpen={isCreateCaseOpen}
        onClose={() => setIsCreateCaseOpen(false)}
        onCaseCreated={handleCaseCreated}
      />

      {/* System Settings & Diagnostics Modal */}
      <SettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        officer={officer}
        selectedCaseId={selectedCaseId}
      />

      {/* Floating JARVIS Conversational Voice AI Modal */}
      {isVoiceOverlayOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setIsVoiceOverlayOpen(false)}
        >
          <div
            style={{ width: '100%', maxWidth: '1100px', maxHeight: '90vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <JarvisVoiceAssistant
              activeCase={caseData}
              officer={officer}
              isOverlay={true}
              onClose={() => setIsVoiceOverlayOpen(false)}
              onNavigateTab={handleSelectNav}
            />
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import LoginForm from './components/LoginForm';
import Dashboard from './pages/Dashboard';
import CaseDetailsPanel from './components/CaseDetailsPanel';
import GraphAnalysis from './pages/GraphAnalysis';
import EvidenceGapPanel from './components/EvidenceGapPanel';
import TimelinePanel from './components/TimelinePanel';
import InvestigativeLeadsPanel from './components/InvestigativeLeadsPanel';
import EvidenceIntegrityPanel from './components/EvidenceIntegrityPanel';
import EvidenceVaultPanel from './components/EvidenceVaultPanel';
import GeospatialMapPanel from './components/GeospatialMapPanel';
import CollaborationPanel from './components/CollaborationPanel';
import ReportExportModal from './components/ReportExportModal';
import CreateCaseModal from './components/CreateCaseModal';
import SettingsModal from './components/SettingsModal';
import ValidationDashboard from './components/ValidationDashboard';
import api from './services/api';
import './styles/theme.css';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedCaseId, setSelectedCaseId] = useState(1);
  const [caseData, setCaseData] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  // Navigation & filtering state
  const [caseFilter, setCaseFilter] = useState('ALL');
  const [collaborationSubTab, setCollaborationSubTab] = useState('tasks');

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
    setActiveTab('dashboard');
    setCaseFilter('ALL');
  };

  const handleLogout = () => {
    api.setToken(null);
    try {
      localStorage.removeItem('casethread_officer');
    } catch (e) {}
    setOfficer(null);
    setActiveTab('dashboard');
    setCaseData(null);
    setAnalysisData(null);
  };

  // Handler for navigation selections originating from the Sidebar
  const handleSelectNav = (tabId, options = {}) => {
    if (options.action === 'create_case') {
      setIsCreateCaseOpen(true);
      return;
    }
    if (options.action === 'open_reports') {
      setReportModalOpen(true);
      return;
    }
    if (options.action === 'open_settings') {
      setSettingsModalOpen(true);
      return;
    }

    if (tabId) {
      setActiveTab(tabId);
    }

    if (options.caseFilter !== undefined) {
      setCaseFilter(options.caseFilter);
    }

    if (options.subTab) {
      setCollaborationSubTab(options.subTab);
    }
  };

  // Handler when a new case is registered
  const handleCaseCreated = (newCase) => {
    const newId = newCase?.case_id;
    if (newId) {
      setSelectedCaseId(newId);
      loadCaseInfo(newId);
      setActiveTab('dossier');
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
            borderTopColor: 'var(--accent-red)',
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

  // 2. Unauthenticated State: Render Login Portal (Sidebar strictly hidden)
  if (!officer) {
    return (
      <div className="casethread-app" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <header
          style={{
            backgroundColor: 'var(--bg-secondary)',
            borderBottom: '1px solid var(--border-default)',
            padding: '0.85rem 2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            zIndex: 100
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <div
              style={{
                width: '12px',
                height: '12px',
                backgroundColor: 'var(--accent-red)',
                borderRadius: '50%',
                boxShadow: '0 0 10px var(--accent-red)'
              }}
            />
            <div>
              <h1
                style={{
                  fontSize: '1.2rem',
                  fontWeight: '800',
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  color: 'var(--text-primary)',
                  lineHeight: 1.1
                }}
              >
                CASE<span style={{ color: 'var(--accent-red)' }}>THREAD</span>
              </h1>
              <p
                style={{
                  fontSize: '0.62rem',
                  color: 'var(--text-muted)',
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                  fontFamily: 'var(--font-mono)'
                }}
              >
                Evidence Gap Detection & Investigation Intelligence
              </p>
            </div>
          </div>
          <span className="badge badge-critical" style={{ letterSpacing: '0.5px' }}>
            AUTHENTICATION REQUIRED
          </span>
        </header>
        <main style={{ flex: 1 }}>
          <LoginForm onLoginSuccess={handleLoginSuccess} />
        </main>
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
          CASETHREAD v1.0.0 • Digital Forensics Intelligence Subsystem • C-Engine Architecture (BFS • DFS • AVL • HashMaps)
        </footer>
      </div>
    );
  }

  // 3. Authenticated Officer Forensic Workspace: Left Sidebar + Top Header Layout
  const currentSidebarWidth = isMobile ? 0 : (sidebarCollapsed ? 72 : 250);

  return (
    <div
      className="casethread-app"
      style={{
        minHeight: '100vh',
        display: 'flex',
        backgroundColor: 'var(--bg-primary)'
      }}
    >
      {/* Collapsible Left Navigation Sidebar */}
      <Sidebar
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        activeTab={activeTab}
        activeSubTab={collaborationSubTab}
        caseFilter={caseFilter}
        onSelectNav={handleSelectNav}
        officer={officer}
        onLogout={handleLogout}
        isMobile={isMobile}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
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
        {/* Top Content Header (Breadcrumbs, Case Badge, Actions) */}
        <Header
          officer={officer}
          activeTab={activeTab}
          selectedCaseId={selectedCaseId}
          caseData={caseData}
          onOpenCreateCase={() => setIsCreateCaseOpen(true)}
          onOpenReport={() => setReportModalOpen(true)}
          onOpenNotifications={() => {
            setActiveTab('collaboration');
            setCollaborationSubTab('notifications');
          }}
          unreadCount={unreadNotifications}
          onToggleMobileSidebar={() => setMobileSidebarOpen((prev) => !prev)}
          isMobile={isMobile}
        />

        {/* Dynamic Investigation Workspace Views */}
        <main style={{ flex: 1, padding: '1rem 0' }}>
          {activeTab === 'dashboard' && (
            <Dashboard
              selectedCaseId={selectedCaseId}
              onSelectCaseId={setSelectedCaseId}
              onNavigateTab={setActiveTab}
              caseFilter={caseFilter}
              onOpenCreateCase={() => setIsCreateCaseOpen(true)}
            />
          )}

          {activeTab === 'dossier' && (
            <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '0 2rem' }}>
              <CaseDetailsPanel
                caseData={caseData}
                onTriggerAnalysis={handleTriggerAnalysis}
                analyzing={analyzing}
                onExploreGraph={() => setActiveTab('graph')}
                onRefreshCase={loadCaseInfo}
                onOpenReport={() => setReportModalOpen(true)}
              />
            </div>
          )}

          {activeTab === 'collaboration' && (
            <CollaborationPanel
              caseId={selectedCaseId}
              officer={officer}
              onNotificationCountChange={setUnreadNotifications}
              initialSubTab={collaborationSubTab}
            />
          )}

          {activeTab === 'vault' && (
            <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '0 2rem' }}>
              <EvidenceVaultPanel
                selectedCaseId={selectedCaseId}
                officer={officer}
              />
            </div>
          )}

          {activeTab === 'geospatial' && (
            <GeospatialMapPanel
              selectedCaseId={selectedCaseId}
              officer={officer}
            />
          )}

          {activeTab === 'integrity' && (
            <EvidenceIntegrityPanel
              selectedCaseId={selectedCaseId}
              officer={officer}
              onOpenReport={() => setReportModalOpen(true)}
            />
          )}

          {activeTab === 'graph' && (
            <GraphAnalysis initialCaseId={selectedCaseId} />
          )}

          {activeTab === 'gaps' && (
            <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '0 2rem' }}>
              <EvidenceGapPanel
                gaps={analysisData?.evidence_gaps || []}
              />
            </div>
          )}

          {activeTab === 'timeline' && (
            <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '0 2rem' }}>
              <TimelinePanel
                timeline={caseData?.timelines || []}
                anomalies={analysisData?.timeline_anomalies || []}
              />
            </div>
          )}

          {activeTab === 'leads' && (
            <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '0 2rem' }}>
              <InvestigativeLeadsPanel
                leads={
                  analysisData?.prioritized_leads && analysisData.prioritized_leads.length > 0
                    ? analysisData.prioritized_leads
                    : caseData?.leads || []
                }
              />
            </div>
          )}

          {activeTab === 'validation' && (
            <ValidationDashboard />
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
          CASETHREAD v1.0.0 • Digital Forensics Intelligence Subsystem • C-Engine Architecture (BFS • DFS • AVL • HashMaps)
        </footer>
      </div>

      {/* Report Export Modal */}
      <ReportExportModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        caseId={selectedCaseId}
        caseNumber={caseData?.case_number}
        caseTitle={caseData?.title}
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
    </div>
  );
}

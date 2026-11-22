import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import LoginForm from './components/LoginForm';
import Dashboard from './pages/Dashboard';
import Investigations from './pages/Investigations';
import CaseDetailsPanel from './components/CaseDetailsPanel';
import GraphAnalysis from './pages/GraphAnalysis';
import EvidenceGapPanel from './components/EvidenceGapPanel';
import EvidenceGapWorkspace from './pages/EvidenceGapWorkspace';
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
import InvestigationLab from './pages/InvestigationLab';
import ReportCenter from './pages/ReportCenter';
import InvestigationIntelligencePanel from './components/InvestigationIntelligencePanel';
import JarvisVoiceAssistant from './components/JarvisVoiceAssistant';
import CrossCaseGraphView from './components/CrossCaseGraphView';
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
    if (options.action === 'open_reports' || tabId === 'reports') {
      setActiveTab('reports');
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
          onOpenReport={() => setActiveTab('reports')}
          onOpenVoiceAssistant={() => setIsVoiceOverlayOpen(true)}
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

          {activeTab === 'investigations' && (
            <Investigations
              selectedCaseId={selectedCaseId}
              onSelectCaseId={(id) => {
                setSelectedCaseId(id);
                loadCaseInfo(id);
              }}
              onNavigateTab={setActiveTab}
              initialFilter={caseFilter}
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
                onOpenReport={() => setActiveTab('reports')}
                onBack={() => setActiveTab('investigations')}
                onNavigateTab={setActiveTab}
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
            <GraphAnalysis
              initialCaseId={selectedCaseId}
              onSelectCase={(id) => {
                setSelectedCaseId(id);
                loadCaseInfo(id);
              }}
            />
          )}

          {activeTab === 'gaps' && (
            <EvidenceGapWorkspace
              caseId={selectedCaseId}
              onSelectCase={(id) => {
                setSelectedCaseId(id);
                loadCaseInfo(id);
              }}
            />
          )}

          {activeTab === 'intelligence' && (
            <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '0 2rem' }}>
              <InvestigationIntelligencePanel
                activeCase={caseData}
                officer={officer}
                onNavigateTab={setActiveTab}
              />
            </div>
          )}

          {activeTab === 'voice_assistant' && (
            <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '0 1.5rem' }}>
              <JarvisVoiceAssistant
                activeCase={caseData}
                officer={officer}
                onNavigateTab={setActiveTab}
              />
            </div>
          )}

          {activeTab === 'cross_case_graph' && (
            <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '0 1.5rem' }}>
              <CrossCaseGraphView
                selectedCaseId={selectedCaseId}
                onSelectCase={(id) => {
                  setSelectedCaseId(id);
                  loadCaseInfo(id);
                }}
              />
            </div>
          )}

          {activeTab === 'timeline' && (
            <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '0 2rem' }}>
              <TimelinePanel
                caseId={selectedCaseId}
                caseData={caseData}
                onSelectCase={(id) => { setSelectedCaseId(id); loadCaseInfo(id); }}
                onRefreshCase={() => loadCaseInfo(selectedCaseId)}
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

          {activeTab === 'lab' && (
            <InvestigationLab
              selectedCaseId={selectedCaseId}
              onSelectCaseId={(id) => {
                setSelectedCaseId(id);
                loadCaseInfo(id);
              }}
            />
          )}

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
              onNavigateTab={setActiveTab}
            />
          </div>
        </div>
      )}
    </div>
  );
}

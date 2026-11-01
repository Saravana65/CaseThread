import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import LoginForm from './components/LoginForm';
import Dashboard from './pages/Dashboard';
import CaseDetailsPanel from './components/CaseDetailsPanel';
import GraphAnalysis from './pages/GraphAnalysis';
import EvidenceGapPanel from './components/EvidenceGapPanel';
import TimelinePanel from './components/TimelinePanel';
import InvestigativeLeadsPanel from './components/InvestigativeLeadsPanel';
import EvidenceIntegrityPanel from './components/EvidenceIntegrityPanel';
import ReportExportModal from './components/ReportExportModal';
import api from './services/api';
import './styles/theme.css';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedCaseId, setSelectedCaseId] = useState(1);
  const [caseData, setCaseData] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [officer, setOfficer] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [reportModalOpen, setReportModalOpen] = useState(false);

  const checkActiveSession = useCallback(async () => {
    const token = api.getToken();
    if (!token) {
      setOfficer(null);
      setAuthLoading(false);
      return;
    }

    try {
      const res = await api.getProfile();
      if (res && res.data) {
        setOfficer(res.data);
      } else {
        api.setToken(null);
        setOfficer(null);
      }
    } catch (err) {
      console.warn('Session verification notice (clearing expired session):', err.message);
      api.setToken(null);
      setOfficer(null);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    checkActiveSession();
  }, [checkActiveSession]);

  const loadCaseInfo = useCallback(async (caseId) => {
    try {
      const res = await api.getCaseById(caseId);
      if (res.data) {
        setCaseData(res.data);
      }
      // Load C-Engine Graph and Gap Analysis
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

  const handleTriggerAnalysis = async (caseId) => {
    try {
      setAnalyzing(true);
      const res = await api.runCaseAnalysis(caseId);
      const resultData = res.data?.analysis || res.data;
      setAnalysisData(resultData);
      // Reload case details to capture any newly persisted leads
      await loadCaseInfo(caseId);
    } catch (err) {
      console.error('Analysis execution failed:', err);
      alert('Analysis execution error: ' + err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleLoginSuccess = (officerProfile) => {
    setOfficer(officerProfile);
    setActiveTab('dashboard');
  };

  const handleLogout = () => {
    api.setToken(null);
    setOfficer(null);
    setActiveTab('dashboard');
    setCaseData(null);
    setAnalysisData(null);
  };

  // 1. Initial Authentication Check Loading State
  if (authLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '1rem',
        color: 'var(--text-primary)'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid var(--border-default)',
          borderTopColor: 'var(--accent-red)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          SECURE INVESTIGATION SYSTEM: INITIALIZING SESSION...
        </div>
      </div>
    );
  }

  // 2. Unauthenticated State: Render Login Portal
  if (!officer) {
    return (
      <div className="casethread-app" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Navbar
          officer={null}
          onLogout={handleLogout}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
        <main style={{ flex: 1 }}>
          <LoginForm onLoginSuccess={handleLoginSuccess} />
        </main>
        <footer style={{
          backgroundColor: 'var(--bg-secondary)',
          borderTop: '1px solid var(--border-default)',
          padding: '0.85rem 2rem',
          textAlign: 'center',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono)'
        }}>
          CASETHREAD v1.0.0 • Digital Forensics Intelligence Subsystem • C-Engine DSA Architecture (BFS • DFS • AVL • HashMaps)
        </footer>
      </div>
    );
  }

  // 3. Authenticated Officer Forensic Intelligence Workspace
  return (
    <div className="casethread-app" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar
        officer={officer}
        onLogout={handleLogout}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenReport={() => setReportModalOpen(true)}
      />

      <main style={{ flex: 1, padding: '1rem 0' }}>
        {activeTab === 'dashboard' && (
          <Dashboard
            selectedCaseId={selectedCaseId}
            onSelectCaseId={setSelectedCaseId}
            onNavigateTab={setActiveTab}
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
              leads={analysisData?.prioritized_leads && analysisData.prioritized_leads.length > 0 
                ? analysisData.prioritized_leads 
                : (caseData?.leads || [])}
            />
          </div>
        )}
      </main>

      <ReportExportModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        caseId={selectedCaseId}
        caseNumber={caseData?.case_number}
        caseTitle={caseData?.title}
      />

      <footer style={{
        backgroundColor: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border-default)',
        padding: '0.85rem 2rem',
        textAlign: 'center',
        fontSize: '0.75rem',
        color: 'var(--text-muted)',
        fontFamily: 'var(--font-mono)'
      }}>
        CASETHREAD v1.0.0 • Digital Forensics Intelligence Subsystem • C-Engine DSA Architecture (BFS • DFS • AVL • HashMaps)
      </footer>
    </div>
  );
}

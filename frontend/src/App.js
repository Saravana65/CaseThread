import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import CaseDetailsPanel from './components/CaseDetailsPanel';
import GraphAnalysis from './pages/GraphAnalysis';
import EvidenceGapPanel from './components/EvidenceGapPanel';
import TimelinePanel from './components/TimelinePanel';
import InvestigativeLeadsPanel from './components/InvestigativeLeadsPanel';
import api from './services/api';
import './styles/theme.css';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedCaseId, setSelectedCaseId] = useState(1);
  const [caseData, setCaseData] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [officer, setOfficer] = useState({
    officer_id: 1,
    badge_number: 'DET-8841',
    full_name: 'Det. Alexander Cross',
    department: 'Major Crimes Division',
    role: 'LEAD_OFFICER'
  });

  useEffect(() => {
    if (selectedCaseId) {
      loadCaseInfo(selectedCaseId);
    }
  }, [selectedCaseId]);

  const loadCaseInfo = async (caseId) => {
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
  };

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

  const handleLogout = () => {
    setOfficer(null);
  };

  return (
    <div className="casethread-app" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar
        officer={officer}
        onLogout={handleLogout}
        activeTab={activeTab}
        onTabChange={setActiveTab}
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
            />
          </div>
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

import React, { useState } from 'react';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import './styles/theme.css';

export default function App() {
  const [officer, setOfficer] = useState({
    officer_id: 1,
    badge_number: 'DET-8841',
    full_name: 'Det. Alexander Cross',
    department: 'Major Crimes Division',
    role: 'LEAD_OFFICER'
  });

  const handleLogout = () => {
    setOfficer(null);
  };

  return (
    <div className="casethread-app" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar officer={officer} onLogout={handleLogout} />
      <main style={{ flex: 1 }}>
        <Dashboard />
      </main>
      <footer style={{
        backgroundColor: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border-default)',
        padding: '1rem 2rem',
        textAlign: 'center',
        fontSize: '0.75rem',
        color: 'var(--text-muted)',
        fontFamily: 'var(--font-mono)'
      }}>
        CASETHREAD v1.0.0 • Digital Forensics Intelligence Subsystem • C-Engine DSA Architecture
      </footer>
    </div>
  );
}

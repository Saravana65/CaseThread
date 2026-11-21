import React, { useState, useEffect } from 'react';
import api from '../services/api';
import '../styles/loginLanding.css';

/**
 * @component LoginForm
 * @description Advanced Forensic Investigation Terminal & Intelligence System Landing Portal.
 * Features: Split-screen hero, rotating intelligence slides, radar ambient backdrop,
 * ticket-card login interface with SVG leading icons, one-click demo credentials,
 * and comprehensive ADS architecture highlights.
 */
export default function LoginForm({ onLoginSuccess }) {
  const [badgeNumber, setBadgeNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [fieldErrors, setFieldErrors] = useState({});
  const [generalError, setGeneralError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [showForgotNote, setShowForgotNote] = useState(false);

  // Rotating Intelligence Slides
  const slides = [
    {
      title: 'Algorithmic',
      em: 'Evidence Intelligence.',
      desc: 'Uncover missing evidentiary provenance, hidden conspiratorial chains, and spatiotemporal contradictions with high-performance native C99 data structures.'
    },
    {
      title: 'Adjacency Graph &',
      em: 'BFS Shortest Path.',
      desc: 'Model suspects, witnesses, and evidence items as interconnected graph vertices. Trace unweighted shortest connection paths and expose isolated criminal cells.'
    },
    {
      title: 'Timeline &',
      em: 'Lead Prioritization.',
      desc: 'AVL Tree chronological indexing pinpoints physical transit velocity anomalies. Dynamic Max-Heap immediately ranks actionable investigative leads.'
    }
  ];

  // Auto-advance slides every 6.5s
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % slides.length);
    }, 6500);
    return () => clearInterval(timer);
  }, [slides.length]);

  const validate = () => {
    const errors = {};
    if (!badgeNumber.trim()) {
      errors.badgeNumber = 'Officer badge number or service ID is required.';
    }
    if (!password) {
      errors.password = 'Security passcode is required.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const executeLogin = async (badge, pass) => {
    setGeneralError(null);
    try {
      setLoading(true);
      const res = await api.login(badge.trim(), pass);
      if (res && res.data && res.data.token) {
        api.setToken(res.data.token);

        let officerProfile = res.data.officer;
        try {
          const profileRes = await api.getProfile();
          if (profileRes && profileRes.data) {
            officerProfile = profileRes.data;
          }
        } catch (pErr) {
          console.warn('Profile sync fallback to login officer payload:', pErr.message);
        }

        if (onLoginSuccess) {
          onLoginSuccess(officerProfile);
        }
      } else {
        throw new Error('Authentication rejected: Missing session token in server response.');
      }
    } catch (err) {
      console.error('Login error:', err);
      const msg = err.message || '';
      if (msg.includes('suspended') || msg.includes('deactivated') || msg.includes('ACCOUNT_INACTIVE')) {
        setGeneralError('Account Inactive: Officer credentials suspended. Contact Bureau Administration.');
      } else if (msg.includes('Invalid badge number') || msg.includes('INVALID_CREDENTIALS')) {
        setGeneralError('Invalid Credentials: Badge number or security passcode incorrect.');
      } else {
        setGeneralError(msg || 'Authentication failed. Please verify credentials or server connectivity.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    executeLogin(badgeNumber, password);
  };

  return (
    <div id="casethread-login-screen">
      {/* Decorative Forensic Radar Background */}
      <div className="ct-lp-bg" aria-hidden="true">
        <span className="ct-ring ct-ring-1"></span>
        <span className="ct-ring ct-ring-2"></span>
        <span className="ct-ring ct-ring-3"></span>
        <span className="ct-ring ct-ring-4"></span>
        <span className="ct-spark s1"></span>
        <span className="ct-spark s2"></span>
        <span className="ct-spark s3"></span>
        <span className="ct-spark s4"></span>
        <span className="ct-spark s5"></span>
      </div>

      {/* TOP NAVIGATION BAR */}
      <header className="ct-lp-nav">
        <a className="ct-lp-brand" href="#lp-home" aria-label="CASETHREAD Home">
          <div className="ct-shield-logo">🛡️</div>
          <div className="ct-lp-brand-text">
            <b>CASE<span>THREAD</span></b>
            <small>Evidence Intelligence System</small>
          </div>
        </a>
        <nav className="ct-lp-links" aria-label="Page sections">
          <a href="#lp-home">Terminal</a>
          <a href="#lp-ads">ADS Engine</a>
          <a href="#lp-pipeline">Investigation Pipeline</a>
          <a href="#lp-specs">Architecture</a>
        </nav>
      </header>

      {/* HERO SECTION: Split Screen (Slide Slogans on Left, Forensic Ticket on Right) */}
      <section id="lp-home" className="ct-lp-hero">
        <div className="ct-lp-copy">
          <div className="ct-lp-slides" aria-live="polite">
            {slides.map((s, idx) => (
              <div
                key={idx}
                className={`ct-lp-slide ${idx === activeSlide ? 'active' : ''}`}
                data-slide={idx}
              >
                <h2>
                  {s.title}
                  <br />
                  <em>{s.em}</em>
                </h2>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>

          <div className="ct-lp-cta">
            <div className="ct-lp-dots" role="tablist" aria-label="Intelligence Slides">
              {slides.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={idx === activeSlide ? 'on' : ''}
                  role="tab"
                  aria-label={`Slide ${idx + 1}`}
                  onClick={() => setActiveSlide(idx)}
                ></button>
              ))}
            </div>
          </div>
        </div>

        {/* AUTHENTICATION TICKET CARD */}
        <main className="ct-login-panel">
          <div className="ct-login-box">
            <div className="ct-login-card">
              {/* Card Notched Header */}
              <div className="ct-lc-head">
                <div className="ct-lc-shield">⚖️</div>
                <div>
                  <b>CASETHREAD Terminal</b>
                  <span>Criminal Investigation Bureau</span>
                </div>
              </div>

              {/* Card Body */}
              <div className="ct-lc-body">
                <h1>Officer Access</h1>
                <p className="ct-sub">Sign in with your badge number and security passcode.</p>

                {/* Error Banner */}
                {generalError && (
                  <div className="ct-form-alert" role="alert">
                    <span style={{ fontSize: '1rem', lineHeight: 1 }}>⚠️</span>
                    <span>{generalError}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} noValidate>
                  {/* Badge Number Field */}
                  <div className="ct-field-group">
                    <label className="ct-field-label" htmlFor="ct-badge">
                      Badge Number / Service ID
                    </label>
                    <div className={`ct-line-field ${fieldErrors.badgeNumber ? 'invalid' : ''}`}>
                      <svg
                        viewBox="0 0 24 24"
                        width="20"
                        height="20"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        <path d="M12 8v4" />
                        <path d="M12 16h.01" />
                      </svg>
                      <input
                        id="ct-badge"
                        type="text"
                        placeholder="e.g. DET-8841 or ADM-1000"
                        autoComplete="username"
                        value={badgeNumber}
                        onChange={(e) => {
                          setBadgeNumber(e.target.value);
                          if (fieldErrors.badgeNumber) {
                            setFieldErrors((prev) => ({ ...prev, badgeNumber: null }));
                          }
                        }}
                        required
                      />
                    </div>
                    {fieldErrors.badgeNumber && (
                      <div className="ct-field-error">{fieldErrors.badgeNumber}</div>
                    )}
                  </div>

                  {/* Password Field */}
                  <div className="ct-field-group">
                    <label className="ct-field-label" htmlFor="ct-password">
                      Officer Security Passcode
                    </label>
                    <div className={`ct-line-field ${fieldErrors.password ? 'invalid' : ''}`}>
                      <svg
                        viewBox="0 0 24 24"
                        width="20"
                        height="20"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <rect x="4" y="11" width="16" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                      <input
                        id="ct-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••••••"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (fieldErrors.password) {
                            setFieldErrors((prev) => ({ ...prev, password: null }));
                          }
                        }}
                        required
                      />
                      <button
                        type="button"
                        className="ct-pw-toggle"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Hide passcode' : 'Show passcode'}
                        title={showPassword ? 'Hide passcode' : 'Show passcode'}
                      >
                        {showPassword ? (
                          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>
                    {fieldErrors.password && (
                      <div className="ct-field-error">{fieldErrors.password}</div>
                    )}
                  </div>

                  {/* Options row */}
                  <div className="ct-row-between">
                    <label className="ct-check">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                      />
                      Remember badge
                    </label>
                    <button
                      type="button"
                      className="ct-link-btn"
                      onClick={() => setShowForgotNote(!showForgotNote)}
                    >
                      Need assistance?
                    </button>
                  </div>

                  {showForgotNote && (
                    <div className="ct-note" style={{ fontSize: '0.8rem', lineHeight: '1.5' }}>
                      <div style={{ marginBottom: '6px', fontWeight: '700', color: 'var(--accent-amber)' }}>
                        AUTHORIZED ACCESS CREDENTIALS BY PATH / ROLE:
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 10px', fontSize: '0.75rem' }}>
                        <b>DET-8841:</b> <span>Lead Officer / Case Commander (All Modules)</span>
                        <b>DET-9912:</b> <span>Forensics & Cyber Telemetry (Vault & Analysis)</span>
                        <b>DET-9022:</b> <span>Field Detective (Graph Relations & Suspects)</span>
                        <b>ANA-3301:</b> <span>Forensic Analyst (Biological & Lab Verification)</span>
                        <b>REV-4412:</b> <span>Senior Reviewer (Quality & Gap Auditing)</span>
                        <b>ADM-1000:</b> <span>System Admin (Platform Administration)</span>
                      </div>
                      <div style={{ marginTop: '8px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Universal Demo Passcode: <code style={{ color: '#fff' }}>Password123!</code>
                      </div>
                    </div>
                  )}

                  {/* Sign In Button */}
                  <button type="submit" className="ct-btn-submit" disabled={loading}>
                    {loading ? '🔐 Authenticating Terminal...' : 'ACCESS INVESTIGATION TERMINAL'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </main>
      </section>

      {/* SECTION 1: ADS CORE ALGORITHMIC CAPABILITIES */}
      <section id="lp-ads" className="ct-lp-section alt">
        <div className="ct-lp-wrap">
          <div className="ct-lp-section-head">
            <span className="ct-lp-eyebrow">Academic ADS Highlights</span>
            <h2>Built on <em>Native C99 Advanced Data Structures</em></h2>
            <p>
              CASETHREAD couples a modern forensic web interface with a compiled, memory-mapped native C engine,
              guaranteeing microsecond algorithmic execution over large-scale relational evidence graphs.
            </p>
          </div>

          <div className="ct-lp-facts">
            <div className="ct-fact">
              <div className="ct-fact-ico">#</div>
              <b>Hash Map (DJB2)</b>
              <span className="ct-fact-badge">O(1) AVERAGE LOOKUP</span>
              <small>
                Separate-chaining hash table with DJB2 polynomial hashing. Indexes evidence records,
                tracking codes, and entity descriptors with dynamic 2x capacity expansion at load factor ≥ 0.75.
              </small>
            </div>

            <div className="ct-fact">
              <div className="ct-fact-ico">⌘</div>
              <b>AVL Tree (Self-Balancing)</b>
              <span className="ct-fact-badge">O(log N) SEARCH &amp; RANGE</span>
              <small>
                Height-balanced Binary Search Tree enforcing balance factor |BF| ≤ 1 via LL, RR, LR, and RL rotations.
                Powers chronological range queries and transit velocity anomaly detection.
              </small>
            </div>

            <div className="ct-fact">
              <div className="ct-fact-ico">◎</div>
              <b>Graph (Adjacency List)</b>
              <span className="ct-fact-badge">O(V + E) TRAVERSAL</span>
              <small>
                Represents suspect, witness, vehicle, and evidence networks. BFS identifies unweighted shortest
                association paths; DFS discovers isolated conspiratorial clusters and contradiction cycles.
              </small>
            </div>

            <div className="ct-fact">
              <div className="ct-fact-ico">▲</div>
              <b>Max-Heap &amp; Quadtree</b>
              <span className="ct-fact-badge">O(log N) RE-RANKING</span>
              <small>
                Binary Max-Heap priority queue immediately dispatches the highest-scored investigative leads.
                2D Quadtree partitions coordinates to detect spatial co-presence via Haversine great-circle distance.
              </small>
            </div>
          </div>

          <blockquote className="ct-lp-quote">
            <p>Evidence Speaks Through Mathematical Structures</p>
            <cite>CASETHREAD Forensic Core Engine</cite>
          </blockquote>
        </div>
      </section>

      {/* SECTION 2: FORENSIC INVESTIGATION PIPELINE */}
      <section id="lp-pipeline" className="ct-lp-section">
        <div className="ct-lp-wrap">
          <div className="ct-lp-section-head">
            <span className="ct-lp-eyebrow">Investigation Lifecycle</span>
            <h2>From Crime Scene to <em>Court-Ready Findings</em></h2>
            <p>
              How CASETHREAD ingests raw case evidence, executes native algorithmic pipelines,
              and synthesizes explainable investigative leads.
            </p>
          </div>

          <ul className="ct-lp-timeline">
            <li>
              <time><b>01</b>INGEST</time>
              <div>
                <h3>Centralized Evidence Ingestion</h3>
                <p>Register physical, CCTV, vehicle, biometric, and telephony records with SHA-256 fingerprinting.</p>
              </div>
            </li>
            <li>
              <time><b>02</b>GRAPH</time>
              <div>
                <h3>Relational Network Modeling</h3>
                <p>Compile multi-entity relationship edges with confidence weights into a weighted Adjacency List.</p>
              </div>
            </li>
            <li>
              <time><b>03</b>GAPS</time>
              <div>
                <h3>Evidence Gap Discovery</h3>
                <p>Rule-based detection flags unverified provenance, unlogged collection times, and isolated degree-0 vertices.</p>
              </div>
            </li>
            <li>
              <time><b>04</b>ANOMALY</time>
              <div>
                <h3>Spatiotemporal Velocity Auditing</h3>
                <p>AVL chronological traversal computes displacement velocity, flagging impossible transit speeds.</p>
              </div>
            </li>
            <li>
              <time><b>05</b>LEADS</time>
              <div>
                <h3>Dynamic Lead Prioritization</h3>
                <p>Max-Heap scores centrality-weighted follow-up tasks, directing detectives to critical missing links.</p>
              </div>
            </li>
            <li>
              <time><b>06</b>AUDIT</time>
              <div>
                <h3>Court-Ready Audit Documentation</h3>
                <p>Immutable chain of custody logs and algorithmic explainability statements ready for judicial review.</p>
              </div>
            </li>
          </ul>
        </div>
      </section>

      {/* SECTION 3: SYSTEM ARCHITECTURE SPECIFICATIONS */}
      <section id="lp-specs" className="ct-lp-section alt">
        <div className="ct-lp-wrap">
          <div className="ct-lp-section-head">
            <span className="ct-lp-eyebrow">Enterprise Specifications</span>
            <h2>Decoupled <em>4-Tier Microkernel</em> Architecture</h2>
            <p>Designed for fault-tolerant computational isolation and audit reliability.</p>
          </div>

          <div className="ct-specs-grid">
            <div className="ct-spec-card">
              <h4>Tier 1: Presentation Layer</h4>
              <b>React.js Single Page App</b>
              <p>Port 3000 • Responsive left sidebar, dynamic SVG graph visualizer, chronological timeline explorer, and digital evidence vault.</p>
            </div>
            <div className="ct-spec-card">
              <h4>Tier 2: Orchestration Layer</h4>
              <b>Node.js &amp; Express.js API</b>
              <p>Port 5001 • JWT token verification, role-based access control (RBAC), and connection pool manager (mysql2/promise).</p>
            </div>
            <div className="ct-spec-card">
              <h4>Tier 3: Computational Core</h4>
              <b>Native C99 Binary (casethread_engine)</b>
              <p>Standard I/O IPC (stdin/stdout JSON stream) • Zero-dependency execution, isolated memory sandbox, sub-150ms run latency.</p>
            </div>
            <div className="ct-spec-card">
              <h4>Tier 4: Persistence &amp; Vault</h4>
              <b>MySQL 8.0 &amp; Forensic Vault</b>
              <p>Normalized relational schema, ACID transaction guarantees, immutable cryptographic audit logs, and file integrity ledger.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="ct-lp-footer">
        <div className="ct-lp-wrap ct-lp-foot-grid">
          <div>
            <div className="ct-lp-brand static" style={{ marginBottom: '14px' }}>
              <div className="ct-shield-logo" style={{ width: '38px', height: '38px', fontSize: '18px' }}>🛡️</div>
              <div className="ct-lp-brand-text">
                <b style={{ fontSize: '16px' }}>CASE<span>THREAD</span></b>
                <small>Forensic Investigation Platform</small>
              </div>
            </div>
            <p>
              An academic decision-support platform applying Advanced Data Structures to criminal investigation management.
              Geethanjali College of Engineering and Technology (GCET).
            </p>
          </div>
          <div>
            <h4>Quick Navigation</h4>
            <a href="#lp-home">Terminal Sign In</a>
            <a href="#lp-ads">ADS Core Engine</a>
            <a href="#lp-pipeline">Investigation Pipeline</a>
            <a href="#lp-specs">System Architecture</a>
          </div>
          <div>
            <h4>Presented By</h4>
            <p style={{ margin: 0, lineHeight: 1.8 }}>
              • <b>Saravana Srinivas</b> (25R11A66P7)<br />
              • <b>L. Anjan Kumar</b> (25R11A66N5)<br />
              • <b>Movith</b> (25R11A66M6)
            </p>
          </div>
        </div>
        <div className="ct-lp-wrap ct-lp-copy-line">
          <span>Project (PBL) in Advanced Data Structures (ADS) • B.Tech CSE</span>
          <span>CASETHREAD v1.0.0 • Production Ready</span>
        </div>
      </footer>
    </div>
  );
}

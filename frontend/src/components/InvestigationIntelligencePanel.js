/**
 * @file InvestigationIntelligencePanel.js
 * @brief Minimal functional interface for Phase 15 AI Investigation Intelligence & Evidence-Grounded Reasoning.
 * Connects directly to POST /api/v1/intelligence/query to provide natural language inquiries,
 * similar case retrieval, comparative analysis, case resolution methods, and verified source citations.
 * @project CASETHREAD
 */

import React, { useState, useRef, useEffect } from 'react';

const SUGGESTED_QUERIES = [
  'A robbery happened around 9 PM targeting electronics and cash. Have similar cases happened elsewhere?',
  'Corporate spear-phishing wire fraud involving compromised administrative tokens and mule bank accounts.',
  'Commercial warehouse break-in during night hours where perpetrator restrained store personnel.'
];

export default function InvestigationIntelligencePanel({ activeCase, officer, onNavigateTab }) {
  const [queryInput, setQueryInput] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('ALL');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [expandedComparisons, setExpandedComparisons] = useState({});

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendQuery = async (queryText) => {
    const textToSend = queryText || queryInput;
    if (!textToSend || !textToSend.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      sender: 'USER',
      text: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMessage]);
    setQueryInput('');
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const token = localStorage.getItem('casethread_token') || sessionStorage.getItem('casethread_token');
      const payload = {
        query: textToSend.trim(),
        conversationId: conversationId || undefined,
        filters: selectedCountry !== 'ALL' ? { country: selectedCountry } : {},
        limit: 4
      };

      const response = await fetch('/api/v1/intelligence/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || data.error || 'Failed to process intelligence query.');
      }

      if (data.conversation_id && !conversationId) {
        setConversationId(data.conversation_id);
      }

      const assistantMessage = {
        id: Date.now() + 1,
        sender: 'AI',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        data: data
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      setErrorMessage(err.message || 'An error occurred connecting to the intelligence service.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleComparison = (msgId, caseRef) => {
    const key = `${msgId}-${caseRef}`;
    setExpandedComparisons(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 72px)',
      backgroundColor: '#0F172A',
      color: '#E2E8F0',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Top Header Bar */}
      <div style={{
        padding: '16px 24px',
        backgroundColor: '#1E293B',
        borderBottom: '1px solid #334155',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '18px', fontWeight: 600, color: '#F8FAFC' }}>
              Investigation Intelligence & Precedent Assistant
            </span>
            <span style={{
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '12px',
              backgroundColor: '#0369A1',
              color: '#E0F2FE',
              fontWeight: 600,
              letterSpacing: '0.5px'
            }}>
              EVIDENCE-GROUNDED RAG
            </span>
          </div>
          <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>
            Multi-jurisdiction case discovery (India, UK, US) anchored exclusively in verified historical records.
          </div>
        </div>

        {/* Country Filter Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: '#94A3B8' }}>Jurisdiction:</span>
          {['ALL', 'India', 'United Kingdom', 'United States'].map(c => (
            <button
              key={c}
              onClick={() => setSelectedCountry(c)}
              style={{
                fontSize: '12px',
                padding: '4px 10px',
                borderRadius: '6px',
                border: '1px solid',
                borderColor: selectedCountry === c ? '#38BDF8' : '#334155',
                backgroundColor: selectedCountry === c ? '#0284C7' : '#0F172A',
                color: selectedCountry === c ? '#FFFFFF' : '#94A3B8',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {c === 'ALL' ? 'Worldwide (All)' : c}
            </button>
          ))}
        </div>
      </div>

      {/* Main Conversation & Timeline Area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}>
        {/* Welcome Banner if no messages */}
        {messages.length === 0 && (
          <div style={{
            backgroundColor: '#1E293B',
            border: '1px solid #334155',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '850px',
            margin: '20px auto 0'
          }}>
            <h3 style={{ margin: '0 0 10px', fontSize: '16px', color: '#F1F5F9' }}>
              Ask an Investigative Question
            </h3>
            <p style={{ fontSize: '13px', color: '#94A3B8', lineHeight: '1.6', margin: '0 0 16px' }}>
              Describe an incident, target property, or modus operandi in natural language. The system retrieves genuine historical precedents, explains factual overlaps and differences, surfaces investigative methods, and provides source citations.
            </p>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#CBD5E1', marginBottom: '8px' }}>
              Example Prompt Templates:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {SUGGESTED_QUERIES.map((sq, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendQuery(sq)}
                  style={{
                    textAlign: 'left',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: '#0F172A',
                    border: '1px solid #334155',
                    color: '#38BDF8',
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'border-color 0.15s ease'
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#38BDF8'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = '#334155'}
                >
                  <span style={{ color: '#64748B' }}>➜</span> {sq}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message Stream */}
        {messages.map(msg => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.sender === 'USER' ? 'flex-end' : 'flex-start',
              width: '100%'
            }}
          >
            {msg.sender === 'USER' ? (
              /* User Question Bubble */
              <div style={{
                maxWidth: '75%',
                backgroundColor: '#0284C7',
                color: '#FFFFFF',
                padding: '12px 16px',
                borderRadius: '12px 12px 2px 12px',
                fontSize: '13px',
                lineHeight: '1.5'
              }}>
                <div style={{ fontSize: '11px', opacity: 0.8, marginBottom: '4px' }}>
                  Investigator Query • {msg.timestamp}
                </div>
                {msg.text}
              </div>
            ) : (
              /* AI Response Container */
              <div style={{
                width: '100%',
                maxWidth: '920px',
                backgroundColor: '#1E293B',
                border: '1px solid #334155',
                borderRadius: '12px',
                padding: '20px',
                fontSize: '13px',
                lineHeight: '1.6'
              }}>
                {/* Assistant Title & Timestamp */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderBottom: '1px solid #334155',
                  paddingBottom: '10px',
                  marginBottom: '14px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#38BDF8', fontWeight: 600 }}>CaseThread Intelligence Engine</span>
                    <span style={{ fontSize: '11px', padding: '1px 6px', borderRadius: '4px', backgroundColor: '#064E3B', color: '#6EE7B7' }}>
                      SOURCE VERIFIED
                    </span>
                  </div>
                  <span style={{ fontSize: '11px', color: '#64748B' }}>{msg.timestamp}</span>
                </div>

                {/* Primary Synthesized Answer */}
                <div style={{ color: '#F1F5F9', whiteSpace: 'pre-line', marginBottom: '18px' }}>
                  {msg.data.answer}
                </div>

                {/* Similar Historical Cases Section */}
                {msg.data.similar_cases && msg.data.similar_cases.length > 0 && (
                  <div style={{ marginTop: '16px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                      Identified Historical Precedents ({msg.data.similar_cases.length})
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
                      {msg.data.similar_cases.map(sc => {
                        const comp = msg.data.case_comparisons?.find(c => c.case_reference_number === sc.case_reference_number);
                        const isExpanded = !!expandedComparisons[`${msg.id}-${sc.case_reference_number}`];

                        return (
                          <div
                            key={sc.document_id}
                            style={{
                              backgroundColor: '#0F172A',
                              border: '1px solid #334155',
                              borderRadius: '8px',
                              padding: '12px 14px'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{
                                  fontSize: '11px',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  backgroundColor: sc.relevance_tier === 'HIGH' ? '#064E3B' : (sc.relevance_tier === 'MEDIUM' ? '#78350F' : '#334155'),
                                  color: sc.relevance_tier === 'HIGH' ? '#6EE7B7' : (sc.relevance_tier === 'MEDIUM' ? '#FCD34D' : '#94A3B8'),
                                  fontWeight: 600
                                }}>
                                  {sc.relevance_tier} RELEVANCE
                                </span>
                                <span style={{ fontWeight: 600, color: '#E2E8F0' }}>{sc.case_reference_number}</span>
                                <span style={{ color: '#94A3B8', fontSize: '12px' }}>({sc.country} • {sc.jurisdiction})</span>
                              </div>
                              <button
                                onClick={() => toggleComparison(msg.id, sc.case_reference_number)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#38BDF8',
                                  fontSize: '12px',
                                  cursor: 'pointer',
                                  padding: '2px 6px'
                                }}
                              >
                                {isExpanded ? 'Hide Comparative Analysis ▲' : 'Compare Facts & Outcome ▼'}
                              </button>
                            </div>

                            <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '6px' }}>
                              {sc.similarity_explanation}
                            </div>

                            {/* Expanded Comparative Facts Drawer */}
                            {isExpanded && comp && (
                              <div style={{
                                marginTop: '10px',
                                paddingTop: '10px',
                                borderTop: '1px solid #1E293B',
                                fontSize: '12px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px'
                              }}>
                                <div>
                                  <span style={{ color: '#34D399', fontWeight: 600 }}>Similar Facts: </span>
                                  <ul style={{ margin: '4px 0 0 16px', padding: 0, color: '#CBD5E1' }}>
                                    {comp.similar_facts.map((f, idx) => <li key={idx}>{f}</li>)}
                                  </ul>
                                </div>
                                {comp.different_facts.length > 0 && (
                                  <div>
                                    <span style={{ color: '#F87171', fontWeight: 600 }}>Divergent Facts: </span>
                                    <ul style={{ margin: '4px 0 0 16px', padding: 0, color: '#CBD5E1' }}>
                                      {comp.different_facts.map((f, idx) => <li key={idx}>{f}</li>)}
                                    </ul>
                                  </div>
                                )}
                                <div>
                                  <span style={{ color: '#FCD34D', fontWeight: 600 }}>Outcome: </span>
                                  <span style={{ color: '#CBD5E1' }}>{comp.recorded_outcome}</span>
                                </div>
                                {comp.documented_investigative_methods && (
                                  <div>
                                    <span style={{ color: '#38BDF8', fontWeight: 600 }}>Investigative Methods: </span>
                                    <span style={{ color: '#CBD5E1' }}>{comp.documented_investigative_methods}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* How Previous Cases Were Solved Section */}
                {msg.data.how_previous_cases_were_solved && msg.data.how_previous_cases_were_solved.length > 0 && (
                  <div style={{ marginTop: '18px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                      Documented Resolution Methods in Precedents
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {msg.data.how_previous_cases_were_solved.map((sol, idx) => (
                        <div key={idx} style={{ backgroundColor: '#0F172A', border: '1px solid #334155', borderRadius: '6px', padding: '10px 12px', fontSize: '12px' }}>
                          <div style={{ fontWeight: 600, color: '#38BDF8', marginBottom: '4px' }}>
                            {sol.case_reference} ({sol.country}) — {sol.provenance_citation}
                          </div>
                          <div style={{ color: '#CBD5E1', marginBottom: '2px' }}>
                            <strong>Investigative Actions:</strong> {sol.investigative_methods}
                          </div>
                          <div style={{ color: '#94A3B8' }}>
                            <strong>Evidence Examined:</strong> {sol.evidence_examined} | <strong>Property Recovered:</strong> {sol.property_recovered}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Evidence-Grounded Next Steps Suggestions */}
                {msg.data.investigative_suggestions && msg.data.investigative_suggestions.length > 0 && (
                  <div style={{ marginTop: '18px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                      Suggested Investigative Verification Steps
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {msg.data.investigative_suggestions.map((sug, idx) => (
                        <div key={idx} style={{ backgroundColor: '#0F172A', border: '1px solid #334155', borderRadius: '6px', padding: '10px 12px', fontSize: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 600, color: '#F1F5F9' }}>{idx + 1}. {sug.recommendation}</span>
                            <span style={{ fontSize: '10px', color: '#F59E0B', fontWeight: 600 }}>{sug.priority}</span>
                          </div>
                          <div style={{ color: '#94A3B8', fontSize: '11px' }}>
                            <em>Rationale:</em> {sug.rationale}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Source Citations Section */}
                {msg.data.citations && msg.data.citations.length > 0 && (
                  <div style={{ marginTop: '18px', paddingTop: '12px', borderTop: '1px solid #334155' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                      Authoritative Source Citations ({msg.data.citations.length})
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {msg.data.citations.map(cit => (
                        <div
                          key={cit.citation_id}
                          style={{
                            fontSize: '11px',
                            backgroundColor: '#0F172A',
                            border: '1px solid #334155',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            color: '#CBD5E1'
                          }}
                        >
                          <span style={{ color: '#38BDF8', fontWeight: 600 }}>[{cit.citation_id}]</span> {cit.source_title} ({cit.country} • {cit.access_classification})
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Non-Guilt & AI Advisory */}
                <div style={{ marginTop: '14px', fontSize: '11px', color: '#64748B', fontStyle: 'italic' }}>
                  {msg.data.limitations}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Loading Indicator */}
        {isLoading && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: '#1E293B',
            border: '1px solid #334155',
            borderRadius: '8px',
            padding: '12px 18px',
            maxWidth: '450px',
            color: '#94A3B8',
            fontSize: '13px'
          }}>
            <div style={{
              width: '14px',
              height: '14px',
              border: '2px solid #38BDF8',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite'
            }} />
            Searching genuine historical records and synthesizing comparative evidence...
          </div>
        )}

        {/* Error Banner */}
        {errorMessage && (
          <div style={{
            backgroundColor: '#450A0A',
            border: '1px solid #991B1B',
            color: '#FECACA',
            borderRadius: '8px',
            padding: '12px 16px',
            fontSize: '13px'
          }}>
            <strong>Error:</strong> {errorMessage}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Box Footer */}
      <div style={{
        padding: '16px 24px',
        backgroundColor: '#1E293B',
        borderTop: '1px solid #334155'
      }}>
        <form
          onSubmit={e => {
            e.preventDefault();
            handleSendQuery();
          }}
          style={{ display: 'flex', gap: '10px', alignItems: 'center' }}
        >
          <input
            type="text"
            value={queryInput}
            onChange={e => setQueryInput(e.target.value)}
            placeholder="Describe an incident, targeted property, or modus operandi (e.g., Robbery at 9 PM targeting electronics)..."
            disabled={isLoading}
            style={{
              flex: 1,
              backgroundColor: '#0F172A',
              border: '1px solid #334155',
              borderRadius: '8px',
              padding: '12px 16px',
              color: '#F8FAFC',
              fontSize: '13px',
              outline: 'none',
              transition: 'border-color 0.15s ease'
            }}
            onFocus={e => e.target.style.borderColor = '#38BDF8'}
            onBlur={e => e.target.style.borderColor = '#334155'}
          />
          <button
            type="submit"
            disabled={isLoading || !queryInput.trim()}
            style={{
              backgroundColor: isLoading || !queryInput.trim() ? '#334155' : '#0284C7',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              padding: '12px 20px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: isLoading || !queryInput.trim() ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.15s ease'
            }}
          >
            {isLoading ? 'Analyzing...' : 'Search Precedents'}
          </button>
        </form>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

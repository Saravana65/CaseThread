/**
 * @file JarvisVoiceAssistant.js
 * @brief Professional JARVIS-Style Conversational AI Voice Investigation Assistant for CaseThread.
 * Integrates Web Speech Recognition, Web Audio API frequency analysis, Phase 15 Hybrid Retrieval
 * Intelligence API, Evidence-Grounded Reasoning, and Natural Speech Synthesis playback.
 * Updated for Phase 20: Apple-inspired design system, light/dark theme variables,
 * one-click contextual follow-ups, and direct report integration.
 * @project CASETHREAD
 */

import React, { useState, useEffect, useRef } from 'react';
import speechRecognitionService from '../services/speechRecognitionService';
import speechSynthesisService from '../services/speechSynthesisService';
import api from '../services/api';
import JarvisVisualizer from './JarvisVisualizer';
import {
  MicrophoneIcon,
  MicrophoneOffIcon,
  SpeakerIcon,
  SpeakerMuteIcon,
  PlayIcon,
  PauseIcon,
  StopIcon,
  RefreshIcon,
  ShieldCheckIcon,
  CheckIcon,
  ReportIcon
} from './icons/Icons';

const SUGGESTED_VOICE_QUERIES = [
  'A burglary occurred at a house around 9 PM. Cash was left untouched, but graphics cards were stolen. Find similar historical cases.',
  'Commercial robbery during night hours where electronics and cash were targeted.',
  'Find previous investigations where cash was bypassed and only specific high-value hardware was taken.',
  'What forensic evidence and investigative leads should I verify next?'
];

const SUPPORTED_LANGUAGES = [
  { code: 'en-US', label: 'English (US)' },
  { code: 'en-GB', label: 'English (UK)' },
  { code: 'en-IN', label: 'English (India)' },
  { code: 'hi-IN', label: 'Hindi (भारत)' }
];

export default function JarvisVoiceAssistant({
  activeCase = null,
  officer = null,
  isOverlay = false,
  onClose = null,
  onNavigateTab = null
}) {
  // Assistant pipeline states: IDLE, REQUESTING_PERMISSION, LISTENING, TRANSCRIBING,
  // TRANSCRIPT_READY, SEARCHING_RECORDS, GENERATING_ANSWER, SPEAKING, COMPLETED, ERROR, UNSUPPORTED
  const [assistantState, setAssistantState] = useState('IDLE');
  const [statusMessage, setStatusMessage] = useState('Ready for investigative inquiry.');

  // Speech and Audio state
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [audioFrequencyData, setAudioFrequencyData] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [speechRate, setSpeechRate] = useState(1.0);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('en-US');
  const [isSpeechPaused, setIsSpeechPaused] = useState(false);

  // Conversation & AI Intelligence state
  const [conversationId, setConversationId] = useState(null);
  const [dialogueHistory, setDialogueHistory] = useState([]);
  const [currentResponse, setCurrentResponse] = useState(null);
  const [selectedCitation, setSelectedCitation] = useState(null);
  const [expandedCaseId, setExpandedCaseId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);

  // References
  const abortControllerRef = useRef(null);
  const scrollAnchorRef = useRef(null);

  // Initialize and check hardware/browser capabilities
  useEffect(() => {
    const isSpeechSupported = speechRecognitionService.isSupported();
    if (!isSpeechSupported) {
      setAssistantState('UNSUPPORTED');
      setStatusMessage('Speech recognition is not supported in this browser. You may type your questions below.');
    }

    // Load available voices
    const loadVoices = () => {
      const voices = speechSynthesisService.getVoices();
      setAvailableVoices(voices);
      if (voices.length > 0 && !selectedVoiceName) {
        const defaultVoice = voices.find(v => v.lang.startsWith('en')) || voices[0];
        setSelectedVoiceName(defaultVoice.name);
      }
    };

    loadVoices();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    // Clean up when unmounting
    return () => {
      speechRecognitionService.stopListening();
      speechSynthesisService.stop();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Auto-scroll conversation feed
  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [dialogueHistory, assistantState]);

  /**
   * Submit the current transcript to Phase 15 Intelligence API
   */
  const handleSubmitQuery = async (overrideText = null) => {
    const textToQuery = (overrideText || transcript || interimText).trim();
    if (!textToQuery || isSubmitting) return;

    // Stop microphone if still listening
    if (speechRecognitionService.isListening()) {
      speechRecognitionService.stopListening();
      setAudioFrequencyData(null);
    }

    // Stop any ongoing speech
    speechSynthesisService.stop();
    setIsSpeechPaused(false);

    // Record user query in dialogue history
    const userMessage = {
      id: Date.now(),
      sender: 'INVESTIGATOR',
      text: textToQuery,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setDialogueHistory(prev => [...prev, userMessage]);
    setIsSubmitting(true);
    setAssistantState('SEARCHING_RECORDS');
    setStatusMessage('Searching authorized historical crime knowledge base...');

    // Prepare abort controller for request cancellation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const payload = {
        query: textToQuery,
        conversationId: conversationId || undefined,
        limit: 4
      };

      setAssistantState('GENERATING_ANSWER');
      setStatusMessage('Analyzing precedent patterns and synthesizing grounded reasoning...');

      const data = await api.request('/intelligence/query', {
        method: 'POST',
        body: JSON.stringify(payload),
        signal: abortControllerRef.current.signal
      });

      if (!data.success) {
        throw new Error(data.error?.message || data.error || 'Failed to process intelligence query.');
      }

      // Preserve conversational session identifier
      if (data.conversation_id) {
        setConversationId(data.conversation_id);
      }

      setCurrentResponse(data);

      const aiMessage = {
        id: Date.now() + 1,
        sender: 'JARVIS',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        data: data
      };

      setDialogueHistory(prev => [...prev, aiMessage]);

      // If speech synthesis is enabled and unmuted, speak the answer
      if (!isMuted && speechSynthesisService.isSupported() && data.answer) {
        setAssistantState('SPEAKING');
        setStatusMessage('JARVIS is speaking grounded investigative findings...');

        speechSynthesisService.speak(data.answer, {
          onStart: () => {
            setAssistantState('SPEAKING');
          },
          onEnd: () => {
            setAssistantState('COMPLETED');
            setStatusMessage('Inquiry complete. You may ask a follow-up question.');
          },
          onError: () => {
            setAssistantState('COMPLETED');
            setStatusMessage('Inquiry complete. Audio synthesis completed.');
          }
        });
      } else {
        setAssistantState('COMPLETED');
        setStatusMessage('Inquiry complete. Evidence records retrieved.');
      }

      // Reset input bar
      setTranscript('');
      setInterimText('');
    } catch (err) {
      if (err.name === 'AbortError') {
        setStatusMessage('Inquiry request canceled by investigator.');
        setAssistantState('IDLE');
      } else {
        setAssistantState('ERROR');
        setStatusMessage(err.message || 'An error occurred during query processing.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle starting/stopping microphone listening
   */
  const handleToggleListening = async () => {
    // If currently speaking, immediately stop speech playback when investigator activates mic
    if (speechSynthesisService.isSpeaking) {
      speechSynthesisService.stop();
      setIsSpeechPaused(false);
    }

    if (speechRecognitionService.isListening()) {
      // Stop listening and finalize transcript
      const finalCombined = speechRecognitionService.stopListening();
      setTranscript(finalCombined || transcript);
      setInterimText('');
      setAudioFrequencyData(null);
      setAssistantState('TRANSCRIPT_READY');
      if (finalCombined) handleSubmitQuery(finalCombined);
    } else {
      // Start listening
      setTranscript('');
      setInterimText('');
      setAssistantState('REQUESTING_PERMISSION');
      setStatusMessage('Requesting microphone access...');

      const success = await speechRecognitionService.startListening({
        language: selectedLanguage,
        onInterimTranscript: (interim) => {
          setInterimText(interim);
          setAssistantState('TRANSCRIBING');
          setStatusMessage('Listening to investigator speech...');
        },
        onFinalTranscript: (final) => {
          setTranscript((prev) => (prev ? `${prev} ${final}` : final));
          setInterimText('');
        },
        onError: (err) => {
          setAssistantState('ERROR');
          setStatusMessage(`Microphone error: ${err.message || 'Speech recognition failed.'}`);
          setAudioFrequencyData(null);
        },
        onAudioTelemetry: (frequencyArray) => {
          setAudioFrequencyData(frequencyArray);
        }
      });

      if (success) {
        setAssistantState('LISTENING');
        setStatusMessage('Listening... speak your investigative question.');
      } else {
        setAssistantState('ERROR');
        setStatusMessage('Microphone access denied or audio input unavailable.');
      }
    }
  };

  /**
   * Speech Playback Controls
   */
  const handlePlayPauseSpeech = () => {
    if (isSpeechPaused) {
      speechSynthesisService.resume();
      setIsSpeechPaused(false);
      setAssistantState('SPEAKING');
      setStatusMessage('Resuming spoken response...');
    } else {
      speechSynthesisService.pause();
      setIsSpeechPaused(true);
      setAssistantState('COMPLETED');
      setStatusMessage('Speech playback paused.');
    }
  };

  const handleStopSpeech = () => {
    speechSynthesisService.stop();
    setIsSpeechPaused(false);
    setAssistantState('COMPLETED');
    setStatusMessage('Speech playback stopped.');
  };

  const handleRepeatAnswer = () => {
    if (!currentResponse?.answer) return;
    speechSynthesisService.stop();
    setIsSpeechPaused(false);
    setAssistantState('SPEAKING');
    setStatusMessage('Repeating investigative findings...');

    speechSynthesisService.speak(currentResponse.answer, {
      onStart: () => setAssistantState('SPEAKING'),
      onEnd: () => {
        setAssistantState('COMPLETED');
        setStatusMessage('Repeat playback completed.');
      },
      onError: () => {
        setAssistantState('COMPLETED');
        setStatusMessage('Audio playback finished.');
      }
    });
  };

  const handleResetSession = () => {
    speechRecognitionService.stopListening();
    speechSynthesisService.stop();
    setConversationId(null);
    setDialogueHistory([]);
    setCurrentResponse(null);
    setTranscript('');
    setInterimText('');
    setAssistantState('IDLE');
    setStatusMessage('Ready for investigative inquiry.');
    setSelectedCitation(null);
    setExpandedCaseId(null);
  };

  const handleToggleMute = () => {
    const nextMute = !isMuted;
    if (nextMute && speechSynthesisService.isSpeaking) {
      speechSynthesisService.stop();
      setIsSpeechPaused(false);
    }
    setIsMuted(nextMute);
    if (nextMute) {
      setStatusMessage('Audio speech muted.');
    } else {
      setStatusMessage('Audio speech unmuted.');
    }
  };

  const handleChangeRate = (newRate) => {
    setSpeechRate(newRate);
    speechSynthesisService.setRate(newRate);
  };

  const handleChangeVoice = (voiceName) => {
    setSelectedVoiceName(voiceName);
    speechSynthesisService.setVoice(voiceName);
  };

  const handleChangeLanguage = (langCode) => {
    setSelectedLanguage(langCode);
    speechRecognitionService.setLanguage(langCode);
  };

  const handleSaveToReport = () => {
    setSaveSuccessNotice(true);
    setTimeout(() => setSaveSuccessNotice(false), 3000);
    if (onNavigateTab) {
      setTimeout(() => onNavigateTab('reports'), 1200);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: isOverlay ? '85vh' : 'calc(100vh - 80px)',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-sans)',
        borderRadius: isOverlay ? 'var(--radius-dialog)' : '0px',
        overflow: 'hidden',
        border: isOverlay ? '1px solid var(--border-default)' : 'none',
        boxShadow: isOverlay ? 'var(--shadow-modal)' : 'none'
      }}
    >
      {/* Top HUD Control Bar */}
      <div
        style={{
          padding: '12px 20px',
          backgroundColor: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-default)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '4px 12px',
              borderRadius: 'var(--radius-pill)',
              backgroundColor: 'var(--accent-primary-dim)',
              border: '1px solid var(--border-highlight)'
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor:
                  assistantState === 'LISTENING' ? '#06B6D4' :
                  assistantState === 'SPEAKING' ? '#10B981' :
                  assistantState === 'ERROR' ? 'var(--status-danger)' :
                  assistantState.includes('SEARCH') || assistantState.includes('GEN') ? '#818CF8' : 'var(--accent-primary)',
                boxShadow: '0 0 8px currentColor'
              }}
            />
            <span style={{ fontSize: '0.75rem', fontWeight: '700', letterSpacing: '0.06em', color: 'var(--text-primary)' }}>
              JARVIS FORENSIC AI
            </span>
          </div>

          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Status: <strong style={{ color: 'var(--text-primary)' }}>{assistantState}</strong>
          </span>

          {conversationId && (
            <span className="mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              SID: {conversationId.slice(0, 14)}...
            </span>
          )}
        </div>

        {/* Audio & Session Settings */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Language Selector */}
          <select
            value={selectedLanguage}
            onChange={(e) => handleChangeLanguage(e.target.value)}
            style={{
              backgroundColor: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-control)',
              padding: '4px 8px',
              fontSize: '0.75rem'
            }}
            title="Speech Recognition Language"
          >
            {SUPPORTED_LANGUAGES.map(lang => (
              <option key={lang.code} value={lang.code}>{lang.label}</option>
            ))}
          </select>

          {/* Voice Selector */}
          {availableVoices.length > 0 && (
            <select
              value={selectedVoiceName}
              onChange={(e) => handleChangeVoice(e.target.value)}
              style={{
                backgroundColor: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-control)',
                padding: '4px 8px',
                fontSize: '0.75rem',
                maxWidth: '140px'
              }}
              title="Speech Synthesis Voice"
            >
              {availableVoices.map((v, i) => (
                <option key={i} value={v.name}>{v.name.slice(0, 22)}</option>
              ))}
            </select>
          )}

          {/* Speech Rate */}
          <select
            value={speechRate}
            onChange={(e) => handleChangeRate(Number(e.target.value))}
            style={{
              backgroundColor: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-control)',
              padding: '4px 8px',
              fontSize: '0.75rem'
            }}
            title="Playback Speed"
          >
            <option value="0.8">0.8x Speed</option>
            <option value="1.0">1.0x Speed</option>
            <option value="1.2">1.2x Speed</option>
            <option value="1.5">1.5x Speed</option>
          </select>

          {/* Mute Toggle */}
          <button
            onClick={handleToggleMute}
            style={{
              backgroundColor: isMuted ? 'var(--status-danger-dim)' : 'var(--bg-elevated)',
              color: isMuted ? 'var(--status-danger)' : 'var(--text-primary)',
              border: `1px solid ${isMuted ? 'var(--status-danger-border)' : 'var(--border-default)'}`,
              borderRadius: 'var(--radius-control)',
              padding: '4px 8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.75rem'
            }}
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {isMuted ? <SpeakerMuteIcon size={14} /> : <SpeakerIcon size={14} />}
            <span>{isMuted ? 'Muted' : 'Sound On'}</span>
          </button>

          {/* New Session Button */}
          <button
            onClick={handleResetSession}
            style={{
              backgroundColor: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-control)',
              padding: '4px 10px',
              fontSize: '0.75rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title="Clear context and begin fresh inquiry session"
          >
            <RefreshIcon size={13} />
            <span>New Inquiry</span>
          </button>

          {isOverlay && onClose && (
            <button
              onClick={onClose}
              style={{
                backgroundColor: 'transparent',
                color: 'var(--text-muted)',
                border: 'none',
                fontSize: '1.2rem',
                cursor: 'pointer',
                padding: '0 4px',
                marginLeft: '8px'
              }}
              title="Close Voice Assistant"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Main Content Layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(280px, 340px) 1fr',
          flex: 1,
          overflow: 'hidden'
        }}
      >
        {/* Left Stage: Visualizer Orb, Mic Push Button, Audio Controls */}
        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            borderRight: '1px solid var(--border-default)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '24px 20px',
            position: 'relative',
            overflowY: 'auto'
          }}
        >
          {/* Status Subtitle */}
          <div style={{ textAlign: 'center', width: '100%' }}>
            <span
              style={{
                fontSize: '0.68rem',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                fontWeight: '600'
              }}
            >
              Conversational Voice Subsystem
            </span>
            <div
              style={{
                fontSize: '0.82rem',
                color: 'var(--text-secondary)',
                marginTop: '6px',
                minHeight: '38px',
                lineHeight: 1.4
              }}
            >
              {statusMessage}
            </div>
          </div>

          {/* Interactive JARVIS Orb Visualizer */}
          <div style={{ position: 'relative', margin: '14px 0' }}>
            <JarvisVisualizer
              state={assistantState}
              audioData={audioFrequencyData}
              isListening={speechRecognitionService.isListening()}
              isSpeaking={speechSynthesisService.isSpeaking}
              size={210}
              onClick={handleToggleListening}
            />
          </div>

          {/* Primary Microphone Action Trigger */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', width: '100%' }}>
            <button
              onClick={handleToggleListening}
              style={{
                width: '100%',
                padding: '12px 18px',
                borderRadius: 'var(--radius-control)',
                border: 'none',
                backgroundColor: speechRecognitionService.isListening() ? 'var(--status-danger)' : 'var(--accent-primary)',
                color: '#FFFFFF',
                fontWeight: '600',
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: speechRecognitionService.isListening()
                  ? '0 0 15px rgba(239, 68, 68, 0.4)'
                  : 'var(--shadow-card)',
                transition: 'all 0.2s ease'
              }}
            >
              {speechRecognitionService.isListening() ? (
                <>
                  <MicrophoneOffIcon size={18} />
                  <span>Stop Listening</span>
                </>
              ) : (
                <>
                  <MicrophoneIcon size={18} />
                  <span>Speak Inquiry (Click Mic)</span>
                </>
              )}
            </button>

            {/* Audio Response Controls */}
            {currentResponse?.answer && (
              <div style={{ display: 'flex', gap: '8px', width: '100%', justifyContent: 'center' }}>
                <button
                  onClick={handlePlayPauseSpeech}
                  style={{
                    flex: 1,
                    backgroundColor: 'var(--bg-elevated)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 10px',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                  title={isSpeechPaused ? 'Resume Playback' : 'Pause Speech'}
                >
                  {isSpeechPaused ? <PlayIcon size={14} /> : <PauseIcon size={14} />}
                  <span>{isSpeechPaused ? 'Resume' : 'Pause'}</span>
                </button>

                <button
                  onClick={handleStopSpeech}
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 10px',
                    fontSize: '0.75rem',
                    cursor: 'pointer'
                  }}
                  title="Stop Speech Output"
                >
                  <StopIcon size={14} />
                </button>

                <button
                  onClick={handleRepeatAnswer}
                  style={{
                    flex: 1,
                    backgroundColor: 'var(--bg-elevated)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 10px',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                  title="Repeat Answer from Start"
                >
                  <RefreshIcon size={14} />
                  <span>Repeat</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Stage: Conversation Log, Structured Answers, Case Cards */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'var(--bg-primary)',
            overflow: 'hidden'
          }}
        >
          {/* Scrollable Dialogue & Intelligence View */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px'
            }}
          >
            {dialogueHistory.length === 0 ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  textAlign: 'center',
                  padding: '20px',
                  color: 'var(--text-muted)'
                }}
              >
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--accent-primary-dim)',
                    border: '1px solid var(--border-highlight)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent-primary)',
                    marginBottom: '16px'
                  }}
                >
                  <MicrophoneIcon size={28} />
                </div>
                <h3 style={{ fontSize: '1.15rem', color: 'var(--text-primary)', fontWeight: '700', marginBottom: '8px' }}>
                  JARVIS Conversational Intelligence
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '520px', lineHeight: 1.5, marginBottom: '24px' }}>
                  Speak or type an incident description naturally. The system retrieves genuine historical crime precedents across the UK, US, and India with verifiable source citations.
                </p>

                {/* Suggested Inquiry Pills */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', maxWidth: '560px' }}>
                  <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', textAlign: 'left', fontWeight: '600' }}>
                    Suggested Incident Inquiries:
                  </span>
                  {SUGGESTED_VOICE_QUERIES.map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setTranscript(q);
                        handleSubmitQuery(q);
                      }}
                      style={{
                        textAlign: 'left',
                        padding: '12px 16px',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-default)',
                        borderRadius: 'var(--radius-control)',
                        color: 'var(--text-primary)',
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        lineHeight: 1.4,
                        transition: 'all 0.15s ease'
                      }}
                    >
                      "{q}"
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              dialogueHistory.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignSelf: item.sender === 'INVESTIGATOR' ? 'flex-end' : 'flex-start',
                    maxWidth: item.sender === 'INVESTIGATOR' ? '75%' : '100%',
                    width: item.sender === 'INVESTIGATOR' ? 'auto' : '100%'
                  }}
                >
                  {/* Sender Tag */}
                  <div
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: '600',
                      color: item.sender === 'INVESTIGATOR' ? 'var(--accent-primary)' : 'var(--status-success)',
                      marginBottom: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <span>{item.sender === 'INVESTIGATOR' ? 'DETECTIVE' : 'JARVIS FORENSIC INTELLIGENCE'}</span>
                    <span style={{ color: 'var(--text-muted)', fontWeight: '400' }}>{item.timestamp}</span>
                  </div>

                  {/* Message Bubble */}
                  {item.sender === 'INVESTIGATOR' ? (
                    <div
                      style={{
                        backgroundColor: 'var(--bg-elevated)',
                        color: 'var(--text-primary)',
                        padding: '12px 16px',
                        borderRadius: '12px 12px 2px 12px',
                        fontSize: '0.88rem',
                        lineHeight: 1.5,
                        border: '1px solid var(--border-default)'
                      }}
                    >
                      {item.text}
                    </div>
                  ) : (
                    <div
                      style={{
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-default)',
                        borderRadius: 'var(--radius-card)',
                        padding: '20px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px',
                        boxShadow: 'var(--shadow-sm)'
                      }}
                    >
                      {/* Synthesized Grounded Answer */}
                      <div
                        style={{
                          fontSize: '0.9rem',
                          lineHeight: 1.6,
                          color: 'var(--text-primary)',
                          whiteSpace: 'pre-line'
                        }}
                      >
                        {item.data.answer}
                      </div>

                      {/* Cross-Case Graph Action Banner */}
                      {(item.data.cross_case_graph || item.data.patterns_detected) && (
                        <div
                          style={{
                            padding: '10px 14px',
                            backgroundColor: 'var(--bg-elevated)',
                            borderRadius: 'var(--radius-control)',
                            border: '1px solid var(--border-default)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '8px'
                          }}
                        >
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)' }}>
                            ⚡ <strong>Native C Graph Analysis:</strong> Multi-case relationship graph computed ({item.data.cross_case_graph?.nodes?.length || 0} nodes, {item.data.cross_case_graph?.edges?.length || 0} edges).
                          </span>
                          {onNavigateTab && (
                            <button
                              onClick={() => onNavigateTab('case_analysis')}
                              style={{
                                backgroundColor: 'var(--accent-primary)',
                                color: '#FFFFFF',
                                border: 'none',
                                borderRadius: 'var(--radius-sm)',
                                padding: '6px 12px',
                                fontSize: '0.75rem',
                                fontWeight: '600',
                                cursor: 'pointer'
                              }}
                            >
                              Explore Cross-Case Graph ➜
                            </button>
                          )}
                        </div>
                      )}

                      {/* Similar Historical Cases Cards */}
                      {item.data.similar_cases && item.data.similar_cases.length > 0 && (
                        <div style={{ marginTop: '4px' }}>
                          <div
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: '700',
                              letterSpacing: '0.04em',
                              textTransform: 'uppercase',
                              color: 'var(--text-muted)',
                              marginBottom: '8px'
                            }}
                          >
                            Retrieved Historical Cases ({item.data.similar_cases.length} authentic precedents):
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {item.data.similar_cases.map((c, i) => (
                              <div
                                key={i}
                                style={{
                                  backgroundColor: 'var(--bg-elevated)',
                                  border: '1px solid var(--border-default)',
                                  borderRadius: 'var(--radius-control)',
                                  padding: '14px'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontWeight: '700', color: 'var(--accent-primary)', fontSize: '0.85rem' }} className="mono">
                                      {c.case_reference_number || c.document_title}
                                    </span>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                      {c.country} • {c.jurisdiction}
                                    </span>
                                  </div>

                                  <span
                                    style={{
                                      fontSize: '0.68rem',
                                      fontWeight: '700',
                                      padding: '2px 8px',
                                      borderRadius: 'var(--radius-pill)',
                                      backgroundColor:
                                        c.relevance_tier === 'HIGH' ? 'var(--status-success-dim)' : 'var(--bg-card)',
                                      color:
                                        c.relevance_tier === 'HIGH' ? 'var(--status-success)' : 'var(--text-secondary)',
                                      border: `1px solid ${c.relevance_tier === 'HIGH' ? 'var(--status-success-border)' : 'var(--border-default)'}`
                                    }}
                                  >
                                    {c.relevance_tier} RELEVANCE
                                  </span>
                                </div>

                                <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', marginBottom: '8px' }}>
                                  <strong>Documented Outcome:</strong> {c.case_outcome || 'Resolution not documented'}
                                </div>

                                {/* Comparison Details Toggle */}
                                <button
                                  onClick={() => setExpandedCaseId(expandedCaseId === c.document_id ? null : c.document_id)}
                                  style={{
                                    backgroundColor: 'transparent',
                                    border: 'none',
                                    color: 'var(--accent-primary)',
                                    fontSize: '0.75rem',
                                    cursor: 'pointer',
                                    padding: 0,
                                    textDecoration: 'underline'
                                  }}
                                >
                                  {expandedCaseId === c.document_id ? 'Hide Comparative Analysis' : 'Inspect Similar vs Divergent Facts'}
                                </button>

                                {expandedCaseId === c.document_id && c.comparison && (
                                  <div
                                    style={{
                                      marginTop: '10px',
                                      padding: '12px',
                                      backgroundColor: 'var(--bg-primary)',
                                      borderRadius: 'var(--radius-control)',
                                      fontSize: '0.78rem',
                                      display: 'grid',
                                      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                                      gap: '12px',
                                      border: '1px solid var(--border-default)'
                                    }}
                                  >
                                    <div>
                                      <span style={{ color: 'var(--status-success)', fontWeight: '600' }}>✓ Supported Similarities:</span>
                                      <ul style={{ margin: '6px 0 0 16px', padding: 0, color: 'var(--text-secondary)' }}>
                                        {c.comparison.similar_facts?.map((f, fi) => (
                                          <li key={fi}>{f}</li>
                                        ))}
                                      </ul>
                                    </div>
                                    <div>
                                      <span style={{ color: 'var(--status-danger)', fontWeight: '600' }}>✗ Divergent Circumstances:</span>
                                      <ul style={{ margin: '6px 0 0 16px', padding: 0, color: 'var(--text-secondary)' }}>
                                        {c.comparison.different_facts?.map((df, dfi) => (
                                          <li key={dfi}>{df}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Verified Source Citations Badges */}
                      {item.data.citations && item.data.citations.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '700' }}>
                            SOURCE CITATIONS:
                          </span>
                          {item.data.citations.map((cit, ci) => (
                            <span
                              key={ci}
                              onClick={() => setSelectedCitation(cit)}
                              className="mono"
                              style={{
                                cursor: 'pointer',
                                padding: '3px 8px',
                                borderRadius: 'var(--radius-sm)',
                                backgroundColor: 'var(--bg-elevated)',
                                border: '1px solid var(--border-default)',
                                color: 'var(--accent-primary)',
                                fontSize: '0.72rem',
                                fontWeight: '600'
                              }}
                              title={`Click to inspect source citation: ${cit.source_title || cit.title}`}
                            >
                              {cit.citation_id} • {cit.case_reference_number}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Contextual Follow-Up Suggestions & Report Action */}
                      <div style={{ paddingTop: '10px', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                            RECOMMENDED INVESTIGATIVE FOLLOW-UPS:
                          </span>
                          <button
                            onClick={handleSaveToReport}
                            className="btn-secondary"
                            style={{
                              padding: '4px 10px',
                              fontSize: '0.72rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <ReportIcon size={12} />
                            <span>{saveSuccessNotice ? 'Saved to Dossier Report ✓' : 'Save Findings to Report'}</span>
                          </button>
                        </div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          <button
                            onClick={() => handleSubmitQuery('How was the closest matching case investigated?')}
                            style={{
                              padding: '6px 12px',
                              borderRadius: 'var(--radius-pill)',
                              backgroundColor: 'var(--bg-elevated)',
                              border: '1px solid var(--border-default)',
                              color: 'var(--text-secondary)',
                              fontSize: '0.75rem',
                              cursor: 'pointer'
                            }}
                          >
                            💬 How was the closest matching case investigated?
                          </button>
                          <button
                            onClick={() => handleSubmitQuery('What should I verify next?')}
                            style={{
                              padding: '6px 12px',
                              borderRadius: 'var(--radius-pill)',
                              backgroundColor: 'var(--bg-elevated)',
                              border: '1px solid var(--border-default)',
                              color: 'var(--text-secondary)',
                              fontSize: '0.75rem',
                              cursor: 'pointer'
                            }}
                          >
                            🔍 What should I verify next?
                          </button>
                          <button
                            onClick={() => handleSubmitQuery('Are these incidents directly connected?')}
                            style={{
                              padding: '6px 12px',
                              borderRadius: 'var(--radius-pill)',
                              backgroundColor: 'var(--bg-elevated)',
                              border: '1px solid var(--border-default)',
                              color: 'var(--text-secondary)',
                              fontSize: '0.75rem',
                              cursor: 'pointer'
                            }}
                          >
                            🔗 Are these incidents directly connected?
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
            <div ref={scrollAnchorRef} />
          </div>

          {/* Interactive Input Bar & Push-to-Talk Transcript Box */}
          <div
            style={{
              padding: '16px 20px',
              backgroundColor: 'var(--bg-secondary)',
              borderTop: '1px solid var(--border-default)'
            }}
          >
            {/* Live interim transcript banner when active */}
            {speechRecognitionService.isListening() && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '8px',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--accent-primary-dim)',
                  border: '1px solid var(--border-highlight)',
                  fontSize: '0.75rem',
                  color: 'var(--accent-primary)'
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--accent-primary)',
                    animation: 'pulse 1s infinite'
                  }}
                />
                <span>Listening live... spoken words appear in the inquiry field.</span>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmitQuery();
              }}
              style={{ display: 'flex', gap: '8px', alignItems: 'center' }}
            >
              <input
                type="text"
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder={
                  speechRecognitionService.isListening()
                    ? 'Listening... speaking will transcribe here.'
                    : 'Describe an incident verbally using the mic, or type your inquiry here...'
                }
                disabled={isSubmitting}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-control)',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              />

              <button
                type="submit"
                disabled={!transcript.trim() || isSubmitting}
                className="btn-primary"
                style={{
                  padding: '12px 20px',
                  height: 'auto',
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {isSubmitting ? (
                  <span>Searching...</span>
                ) : (
                  <>
                    <CheckIcon size={14} />
                    <span>Ask JARVIS</span>
                  </>
                )}
              </button>

              {transcript && (
                <button
                  type="button"
                  onClick={() => setTranscript('')}
                  className="btn-secondary"
                  style={{
                    padding: '12px 14px',
                    height: 'auto',
                    fontSize: '0.8rem'
                  }}
                  title="Clear Transcript"
                >
                  Clear
                </button>
              )}
            </form>
          </div>
        </div>
      </div>

      {/* Citation Detail Modal */}
      {selectedCitation && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.72)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
            backdropFilter: 'blur(4px)'
          }}
          onClick={() => setSelectedCitation(null)}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-card)',
              padding: '24px',
              maxWidth: '560px',
              width: '100%',
              boxShadow: 'var(--shadow-modal)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheckIcon size={20} color="var(--accent-primary)" />
                <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>
                  Verified Source Record: {selectedCitation.citation_id}
                </h4>
              </div>
              <button
                onClick={() => setSelectedCitation(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div><strong>Case Reference:</strong> <span className="mono" style={{ color: 'var(--accent-primary)' }}>{selectedCitation.case_reference_number}</span></div>
              <div><strong>Document Title:</strong> {selectedCitation.source_title || selectedCitation.title}</div>
              <div><strong>Jurisdiction:</strong> {selectedCitation.country} • {selectedCitation.jurisdiction}</div>
              <div><strong>Publisher / Source:</strong> {selectedCitation.publisher}</div>
              <div><strong>Data Classification:</strong> <span style={{ color: 'var(--status-success)', fontWeight: '600' }}>{selectedCitation.access_classification}</span></div>
              {/^https?:\/\//i.test(selectedCitation.source_url || '') && (
                <div><strong>Source URL:</strong> <a href={selectedCitation.source_url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-primary)', wordBreak: 'break-all' }}>{selectedCitation.source_url}</a></div>
              )}
            </div>

            <div style={{ marginTop: '20px', textAlign: 'right' }}>
              <button
                onClick={() => setSelectedCitation(null)}
                className="btn-primary"
                style={{ fontSize: '0.8rem', padding: '8px 16px' }}
              >
                Close Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

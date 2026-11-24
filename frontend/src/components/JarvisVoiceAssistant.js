/**
 * @file JarvisVoiceAssistant.js
 * @brief Professional JARVIS-Style Conversational AI Voice Investigation Assistant for CaseThread.
 * Integrates Web Speech Recognition, Web Audio API frequency analysis, Phase 15 Hybrid Retrieval
 * Intelligence API, Evidence-Grounded Reasoning, and Natural Speech Synthesis playback.
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
  CheckIcon
} from './icons/Icons';

const SUGGESTED_VOICE_QUERIES = [
  'A robbery happened around 9 PM targeting electronics and cash. Find similar cases.',
  'How was the closest matching case investigated and solved?',
  'What forensic evidence and investigative leads should I verify next?',
  'Commercial warehouse break-in during night hours with restrained guards.'
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
        lang: selectedLanguage,
        onTranscript: ({ final, interim, combined }) => {
          setTranscript(combined);
          setInterimText(interim);
          setAssistantState('LISTENING');
          setStatusMessage('Listening to your spoken inquiry...');
        },
        onUtterance: handleSubmitQuery,
        onError: ({ code, message }) => {
          setAssistantState('ERROR');
          setStatusMessage(message);
          setAudioFrequencyData(null);
        },
        onStateChange: (state, msg) => {
          setAssistantState(state);
          if (msg) setStatusMessage(msg);
        },
        onAudioData: (data) => {
          setAudioFrequencyData(data);
        }
      });

      if (success) {
        setAssistantState('LISTENING');
        setStatusMessage('Listening... speak your investigative question.');
      }
    }
  };



  /**
   * Reset session context (New Session)
   */
  const handleResetSession = () => {
    speechRecognitionService.stopListening();
    speechSynthesisService.stop();
    setConversationId(null);
    setDialogueHistory([]);
    setCurrentResponse(null);
    setTranscript('');
    setInterimText('');
    setAudioFrequencyData(null);
    setAssistantState('IDLE');
    setStatusMessage('Session reset. Ready for new investigative inquiry.');
  };

  /**
   * Playback controls
   */
  const handlePlayPauseSpeech = () => {
    if (!currentResponse?.answer) return;

    if (speechSynthesisService.isSpeaking) {
      if (isSpeechPaused) {
        speechSynthesisService.resume();
        setIsSpeechPaused(false);
        setAssistantState('SPEAKING');
        setStatusMessage('Resuming spoken response...');
      } else {
        speechSynthesisService.pause();
        setIsSpeechPaused(true);
        setStatusMessage('Speech paused.');
      }
    } else {
      setAssistantState('SPEAKING');
      setStatusMessage('Speaking response...');
      speechSynthesisService.speak(currentResponse.answer, {
        onStart: () => setAssistantState('SPEAKING'),
        onEnd: () => {
          setAssistantState('COMPLETED');
          setStatusMessage('Inquiry complete. Ready for follow-up.');
        }
      });
    }
  };

  const handleStopSpeech = () => {
    speechSynthesisService.stop();
    setIsSpeechPaused(false);
    setAssistantState('COMPLETED');
    setStatusMessage('Audio playback stopped.');
  };

  const handleRepeatAnswer = () => {
    if (currentResponse?.answer) {
      speechSynthesisService.stop();
      setIsSpeechPaused(false);
      setAssistantState('SPEAKING');
      setStatusMessage('Repeating last investigative answer...');
      speechSynthesisService.speak(currentResponse.answer, {
        onStart: () => setAssistantState('SPEAKING'),
        onEnd: () => setAssistantState('COMPLETED')
      });
    }
  };

  const handleToggleMute = () => {
    const nextMute = speechSynthesisService.toggleMute();
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

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: isOverlay ? '85vh' : 'calc(100vh - 60px)',
        backgroundColor: '#090D16',
        color: '#E2E8F0',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        borderRadius: isOverlay ? '12px' : '0px',
        overflow: 'hidden',
        border: isOverlay ? '1px solid #334155' : 'none',
        boxShadow: isOverlay ? '0 25px 50px -12px rgba(0, 0, 0, 0.75)' : 'none'
      }}
    >
      {/* Top HUD Control Bar */}
      <div
        style={{
          padding: '12px 20px',
          backgroundColor: '#0F172A',
          borderBottom: '1px solid #1E293B',
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
              padding: '4px 10px',
              borderRadius: '20px',
              backgroundColor: 'rgba(56, 189, 248, 0.1)',
              border: '1px solid rgba(56, 189, 248, 0.3)'
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
                  assistantState === 'ERROR' ? '#EF4444' :
                  assistantState.includes('SEARCH') || assistantState.includes('GEN') ? '#818CF8' : '#38BDF8',
                boxShadow: '0 0 8px currentColor'
              }}
            />
            <span style={{ fontSize: '0.75rem', fontWeight: '700', letterSpacing: '0.08em', color: '#38BDF8' }}>
              JARVIS FORENSIC AI
            </span>
          </div>

          <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
            State: <strong style={{ color: '#F8FAFC' }}>{assistantState}</strong>
          </span>

          {conversationId && (
            <span style={{ fontSize: '0.7rem', color: '#64748B', fontFamily: 'monospace' }}>
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
              backgroundColor: '#1E293B',
              color: '#CBD5E1',
              border: '1px solid #334155',
              borderRadius: '6px',
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
                backgroundColor: '#1E293B',
                color: '#CBD5E1',
                border: '1px solid #334155',
                borderRadius: '6px',
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
              backgroundColor: '#1E293B',
              color: '#CBD5E1',
              border: '1px solid #334155',
              borderRadius: '6px',
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
              backgroundColor: isMuted ? 'rgba(239, 68, 68, 0.2)' : '#1E293B',
              color: isMuted ? '#EF4444' : '#CBD5E1',
              border: `1px solid ${isMuted ? '#EF4444' : '#334155'}`,
              borderRadius: '6px',
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
              backgroundColor: '#1E293B',
              color: '#CBD5E1',
              border: '1px solid #334155',
              borderRadius: '6px',
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
            <span>New Session</span>
          </button>

          {isOverlay && onClose && (
            <button
              onClick={onClose}
              style={{
                backgroundColor: 'transparent',
                color: '#94A3B8',
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
          gridTemplateColumns: '320px 1fr',
          flex: 1,
          overflow: 'hidden'
        }}
      >
        {/* Left Stage: Visualizer Orb, Mic Push Button, Audio Controls */}
        <div
          style={{
            backgroundColor: '#0B1120',
            borderRight: '1px solid #1E293B',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '24px 16px',
            position: 'relative'
          }}
        >
          {/* Status Subtitle */}
          <div style={{ textAlign: 'center', width: '100%' }}>
            <span
              style={{
                fontSize: '0.68rem',
                color: '#64748B',
                textTransform: 'uppercase',
                letterSpacing: '0.1em'
              }}
            >
              Audio Telemetry Subsystem
            </span>
            <div
              style={{
                fontSize: '0.82rem',
                color: '#94A3B8',
                marginTop: '4px',
                minHeight: '38px',
                lineHeight: 1.3
              }}
            >
              {statusMessage}
            </div>
          </div>

          {/* Interactive JARVIS Orb Visualizer */}
          <div style={{ position: 'relative', margin: '12px 0' }}>
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
                borderRadius: '8px',
                border: 'none',
                backgroundColor: speechRecognitionService.isListening() ? '#EF4444' : '#0284C7',
                color: '#FFFFFF',
                fontWeight: '600',
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: speechRecognitionService.isListening()
                  ? '0 0 15px rgba(239, 68, 68, 0.5)'
                  : '0 0 15px rgba(2, 132, 199, 0.4)',
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
                    backgroundColor: '#1E293B',
                    color: '#E2E8F0',
                    border: '1px solid #334155',
                    borderRadius: '6px',
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
                    backgroundColor: '#1E293B',
                    color: '#94A3B8',
                    border: '1px solid #334155',
                    borderRadius: '6px',
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
                    backgroundColor: '#1E293B',
                    color: '#E2E8F0',
                    border: '1px solid #334155',
                    borderRadius: '6px',
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
            backgroundColor: '#090D16',
            overflow: 'hidden'
          }}
        >
          {/* Scrollable Dialogue & Intelligence View */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '20px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
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
                  color: '#64748B'
                }}
              >
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(56, 189, 248, 0.05)',
                    border: '1px solid rgba(56, 189, 248, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#38BDF8',
                    marginBottom: '16px'
                  }}
                >
                  <MicrophoneIcon size={28} />
                </div>
                <h3 style={{ fontSize: '1.1rem', color: '#F1F5F9', fontWeight: '600', marginBottom: '8px' }}>
                  JARVIS Conversational Intelligence
                </h3>
                <p style={{ fontSize: '0.85rem', maxWidth: '480px', lineHeight: 1.5, marginBottom: '20px' }}>
                  Speak or type naturally. Queries retrieve authentic precedents from the Private Knowledge Base across India, United Kingdom, and the United States.
                </p>

                {/* Suggested Inquiry Pills */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', maxWidth: '520px' }}>
                  <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569', textAlign: 'left' }}>
                    Suggested Voice Queries:
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
                        padding: '10px 14px',
                        backgroundColor: '#0F172A',
                        border: '1px solid #1E293B',
                        borderRadius: '8px',
                        color: '#93C5FD',
                        fontSize: '0.8rem',
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
                    maxWidth: item.sender === 'INVESTIGATOR' ? '70%' : '100%',
                    width: item.sender === 'INVESTIGATOR' ? 'auto' : '100%'
                  }}
                >
                  {/* Sender Tag */}
                  <div
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: '600',
                      color: item.sender === 'INVESTIGATOR' ? '#38BDF8' : '#10B981',
                      marginBottom: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <span>{item.sender === 'INVESTIGATOR' ? 'DETECTIVE' : 'JARVIS INTELLIGENCE'}</span>
                    <span style={{ color: '#475569', fontWeight: '400' }}>{item.timestamp}</span>
                  </div>

                  {/* Message Bubble */}
                  {item.sender === 'INVESTIGATOR' ? (
                    <div
                      style={{
                        backgroundColor: '#1E293B',
                        color: '#F8FAFC',
                        padding: '12px 16px',
                        borderRadius: '12px 12px 2px 12px',
                        fontSize: '0.88rem',
                        lineHeight: 1.5,
                        border: '1px solid #334155'
                      }}
                    >
                      {item.text}
                    </div>
                  ) : (
                    <div
                      style={{
                        backgroundColor: '#0B1120',
                        border: '1px solid #1E293B',
                        borderRadius: '12px',
                        padding: '18px 20px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px'
                      }}
                    >
                      {/* Synthesized Answer */}
                      <div
                        style={{
                          fontSize: '0.88rem',
                          lineHeight: 1.6,
                          color: '#E2E8F0',
                          whiteSpace: 'pre-line'
                        }}
                      >
                        {item.data.answer}
                      </div>

                      {/* Phase 17 Cross-Case Graph & Native C Engine Action */}
                      {(item.data.cross_case_graph || item.data.patterns) && (
                        <div
                          style={{
                            padding: '8px 12px',
                            backgroundColor: '#1E293B',
                            borderRadius: '8px',
                            border: '1px solid #334155',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '8px'
                          }}
                        >
                          <span style={{ fontSize: '0.74rem', color: '#93C5FD' }}>
                            ⚡ <strong>Native C Graph Analysis:</strong> Multi-case relational graph generated ({item.data.cross_case_graph?.nodes?.length || 0} nodes, {item.data.cross_case_graph?.edges?.length || 0} edges).
                          </span>
                          {onNavigateTab && (
                            <button
                              onClick={() => onNavigateTab('cross_case_graph')}
                              style={{
                                backgroundColor: '#0284C7',
                                color: '#FFFFFF',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '4px 8px',
                                fontSize: '0.72rem',
                                fontWeight: '600',
                                cursor: 'pointer'
                              }}
                            >
                              Open Cross-Case Graph View ➜
                            </button>
                          )}
                        </div>
                      )}

                      {/* Similar Historical Cases Carousel / Cards */}
                      {item.data.similar_cases && item.data.similar_cases.length > 0 && (
                        <div style={{ marginTop: '8px' }}>
                          <div
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: '700',
                              letterSpacing: '0.05em',
                              textTransform: 'uppercase',
                              color: '#94A3B8',
                              marginBottom: '8px'
                            }}
                          >
                            Retrieved Historical Precedents ({item.data.similar_cases.length} cases):
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {item.data.similar_cases.map((c, i) => (
                              <div
                                key={i}
                                style={{
                                  backgroundColor: '#111827',
                                  border: '1px solid #1F2937',
                                  borderRadius: '8px',
                                  padding: '12px 14px'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontWeight: '700', color: '#60A5FA', fontSize: '0.82rem', fontFamily: 'monospace' }}>
                                      {c.case_reference_number || c.document_title}
                                    </span>
                                    <span style={{ fontSize: '0.72rem', color: '#9CA3AF' }}>
                                      {c.country} • {c.jurisdiction}
                                    </span>
                                  </div>

                                  <span
                                    style={{
                                      fontSize: '0.68rem',
                                      fontWeight: '700',
                                      padding: '2px 8px',
                                      borderRadius: '4px',
                                      backgroundColor:
                                        c.relevance_tier === 'HIGH' ? 'rgba(16, 185, 129, 0.2)' :
                                        c.relevance_tier === 'MEDIUM' ? 'rgba(234, 179, 8, 0.2)' : 'rgba(107, 114, 128, 0.2)',
                                      color:
                                        c.relevance_tier === 'HIGH' ? '#34D399' :
                                        c.relevance_tier === 'MEDIUM' ? '#FBBF24' : '#9CA3AF'
                                    }}
                                  >
                                    {c.relevance_tier} RELEVANCE
                                  </span>
                                </div>

                                <div style={{ fontSize: '0.78rem', color: '#D1D5DB', marginBottom: '6px' }}>
                                  <strong>Documented Outcome:</strong> {c.case_outcome || 'Not documented'}
                                </div>

                                {/* Comparison Toggle */}
                                <button
                                  onClick={() => setExpandedCaseId(expandedCaseId === c.document_id ? null : c.document_id)}
                                  style={{
                                    backgroundColor: 'transparent',
                                    border: 'none',
                                    color: '#38BDF8',
                                    fontSize: '0.72rem',
                                    cursor: 'pointer',
                                    padding: 0,
                                    textDecoration: 'underline'
                                  }}
                                >
                                  {expandedCaseId === c.document_id ? 'Hide Comparative Facts' : 'Inspect Similar vs Divergent Facts'}
                                </button>

                                {expandedCaseId === c.document_id && c.comparison && (
                                  <div
                                    style={{
                                      marginTop: '8px',
                                      padding: '10px',
                                      backgroundColor: '#0F172A',
                                      borderRadius: '6px',
                                      fontSize: '0.75rem',
                                      display: 'grid',
                                      gridTemplateColumns: '1fr 1fr',
                                      gap: '12px'
                                    }}
                                  >
                                    <div>
                                      <span style={{ color: '#34D399', fontWeight: '600' }}>✓ Matching Circumstances:</span>
                                      <ul style={{ margin: '4px 0 0 16px', padding: 0, color: '#CBD5E1' }}>
                                        {c.comparison.similar_facts?.map((f, fi) => (
                                          <li key={fi}>{f}</li>
                                        ))}
                                      </ul>
                                    </div>
                                    <div>
                                      <span style={{ color: '#F87171', fontWeight: '600' }}>✗ Divergent Circumstances:</span>
                                      <ul style={{ margin: '4px 0 0 16px', padding: 0, color: '#CBD5E1' }}>
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', paddingTop: '8px', borderTop: '1px solid #1E293B' }}>
                          <span style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: '600' }}>
                            SOURCE CITATIONS:
                          </span>
                          {item.data.citations.map((cit, ci) => (
                            <span
                              key={ci}
                              onClick={() => setSelectedCitation(cit)}
                              style={{
                                cursor: 'pointer',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                backgroundColor: '#1E293B',
                                border: '1px solid #334155',
                                color: '#93C5FD',
                                fontSize: '0.72rem',
                                fontFamily: 'monospace'
                              }}
                              title={`Click to view record: ${cit.title}`}
                            >
                              {cit.citation_id} • {cit.case_reference_number}
                            </span>
                          ))}
                        </div>
                      )}
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
              backgroundColor: '#0F172A',
              borderTop: '1px solid #1E293B'
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
                  borderRadius: '6px',
                  backgroundColor: 'rgba(6, 182, 212, 0.1)',
                  border: '1px solid rgba(6, 182, 212, 0.3)',
                  fontSize: '0.75rem',
                  color: '#38BDF8'
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: '#06B6D4',
                    animation: 'pulse 1s infinite'
                  }}
                />
                <span>Listening live... words appear in text field as you speak.</span>
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
                    : 'Speak using the microphone or type your investigation query here...'
                }
                disabled={isSubmitting}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: '#1E293B',
                  border: '1px solid #334155',
                  color: '#F8FAFC',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              />

              <button
                type="submit"
                disabled={!transcript.trim() || isSubmitting}
                style={{
                  padding: '10px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: !transcript.trim() || isSubmitting ? '#334155' : '#0284C7',
                  color: '#FFFFFF',
                  fontWeight: '600',
                  fontSize: '0.82rem',
                  cursor: !transcript.trim() || isSubmitting ? 'not-allowed' : 'pointer',
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
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #334155',
                    backgroundColor: '#1E293B',
                    color: '#94A3B8',
                    fontSize: '0.8rem',
                    cursor: 'pointer'
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
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={() => setSelectedCitation(null)}
        >
          <div
            style={{
              backgroundColor: '#0F172A',
              border: '1px solid #334155',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '560px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheckIcon size={20} color="#38BDF8" />
                <h4 style={{ margin: 0, fontSize: '1rem', color: '#F8FAFC' }}>
                  Verified Source Record: {selectedCitation.citation_id}
                </h4>
              </div>
              <button
                onClick={() => setSelectedCitation(null)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: '0.82rem', color: '#CBD5E1', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div><strong>Case Reference:</strong> <span style={{ fontFamily: 'monospace', color: '#60A5FA' }}>{selectedCitation.case_reference_number}</span></div>
              <div><strong>Document Title:</strong> {selectedCitation.source_title}</div>
              <div><strong>Jurisdiction:</strong> {selectedCitation.country} • {selectedCitation.jurisdiction}</div>
              <div><strong>Publisher / Source:</strong> {selectedCitation.publisher}</div>
              <div><strong>Data Classification:</strong> <span style={{ color: '#34D399' }}>{selectedCitation.access_classification}</span></div>
              {/^https?:\/\//i.test(selectedCitation.source_url || '') && (
                <div><strong>Source URL:</strong> <a href={selectedCitation.source_url} target="_blank" rel="noreferrer" style={{ color: '#38BDF8', wordBreak: 'break-all' }}>{selectedCitation.source_url}</a></div>
              )}
            </div>

            <div style={{ marginTop: '20px', textAlign: 'right' }}>
              <button
                onClick={() => setSelectedCitation(null)}
                style={{
                  backgroundColor: '#0284C7',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  fontSize: '0.8rem',
                  cursor: 'pointer'
                }}
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

/**
 * @file speechRecognitionService.js
 * @brief Production-grade Speech-to-Text service for CaseThread JARVIS Voice Assistant.
 * Provides real-time speech recognition via Web Speech API (with webkitSpeechRecognition fallback)
 * combined with Web Audio API AnalyserNode for real-time microphone frequency visualizer data.
 * Strictly avoids audio retention; all MediaStream tracks are terminated on stop.
 * @project CASETHREAD
 */

class SpeechRecognitionService {
  constructor() {
    this.recognition = null;
    this.audioContext = null;
    this.mediaStream = null;
    this.analyserNode = null;
    this.dataArray = null;
    this.animationFrameId = null;

    this.isListeningActive = false;
    this.callbacks = {
      onTranscript: null,
      onError: null,
      onStateChange: null,
      onAudioData: null
    };

    this.currentLanguage = 'en-US';
    this.transcript = '';
    this.interimTranscript = '';

    this._initializeRecognition();
  }

  /**
   * Check if speech recognition is supported in the current browser environment.
   * @returns {boolean}
   */
  isSupported() {
    if (typeof window === 'undefined') return false;
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  /**
   * Check if Web Audio API is available for real-time frequency analysis.
   * @returns {boolean}
   */
  isAudioAnalysisSupported() {
    if (typeof window === 'undefined') return false;
    return Boolean(window.AudioContext || window.webkitAudioContext);
  }

  /**
   * Initialize speech recognition instance with optimal continuous transcription flags.
   * @private
   */
  _initializeRecognition() {
    if (!this.isSupported()) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;
    this.recognition.lang = this.currentLanguage;

    this.recognition.onstart = () => {
      this.isListeningActive = true;
      this._notifyState('LISTENING');
    };

    this.recognition.onresult = (event) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const item = event.results[i];
        const text = item[0]?.transcript || '';
        if (item.isFinal) {
          final += text;
        } else {
          interim += text;
        }
      }

      if (final) {
        this.transcript = (this.transcript ? this.transcript + ' ' : '') + final.trim();
      }
      this.interimTranscript = interim.trim();

      if (this.callbacks.onTranscript) {
        this.callbacks.onTranscript({
          final: this.transcript,
          interim: this.interimTranscript,
          combined: (this.transcript + ' ' + this.interimTranscript).trim()
        });
      }
    };

    this.recognition.onerror = (event) => {
      // 'no-speech' is a benign timeout that can happen during conversational pauses
      if (event.error === 'no-speech') {
        return;
      }

      let userFriendlyMessage = 'Speech recognition error: ' + event.error;
      if (event.error === 'not-allowed') {
        userFriendlyMessage = 'Microphone access was denied. Please allow microphone permissions in your browser.';
      } else if (event.error === 'audio-capture') {
        userFriendlyMessage = 'No microphone detected on your system. Please connect an input device.';
      } else if (event.error === 'network') {
        userFriendlyMessage = 'Network error occurred during speech recognition. Check your internet connection.';
      }

      this.isListeningActive = false;
      this._stopAudioAnalysis();
      this._notifyState('ERROR', userFriendlyMessage);
      if (this.callbacks.onError) {
        this.callbacks.onError({
          code: event.error,
          message: userFriendlyMessage
        });
      }
    };

    this.recognition.onend = () => {
      // If recognition stopped unexpectedly while still flagged as active, restart or finish
      if (this.isListeningActive) {
        this._stopAudioAnalysis();
        this.isListeningActive = false;
        this._notifyState('TRANSCRIPT_READY');
        if (this.transcript.trim()) this.callbacks.onUtterance?.(this.transcript.trim());
      }
    };
  }

  /**
   * Start listening for spoken input with real-time audio visualization.
   * @param {Object} options
   * @param {Function} options.onTranscript - Receives { final, interim, combined }
   * @param {Function} options.onError - Receives { code, message }
   * @param {Function} options.onStateChange - Receives state string
   * @param {Function} options.onAudioData - Receives Uint8Array frequency data
   * @param {string} [options.lang='en-US'] - Language code (e.g. 'en-US', 'en-IN', 'hi-IN')
   */
  async startListening({ onTranscript, onUtterance, onError, onStateChange, onAudioData, lang = 'en-US' } = {}) {
    if (!this.isSupported()) {
      const err = {
        code: 'UNSUPPORTED_BROWSER',
        message: 'Speech Recognition is not supported by this browser. Chrome, Edge, or Safari is recommended. You may type your questions manually.'
      };
      if (onError) onError(err);
      if (onStateChange) onStateChange('UNSUPPORTED');
      return false;
    }

    this.callbacks = { onTranscript, onUtterance, onError, onStateChange, onAudioData };
    this.currentLanguage = lang;
    this.transcript = '';
    this.interimTranscript = '';

    try {
      this._notifyState('REQUESTING_PERMISSION');

      // 1. Request real microphone access for frequency analysis & validation
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });

        this._startAudioAnalysis(this.mediaStream);
      }

      // 2. Configure and start speech recognition
      if (!this.recognition) {
        this._initializeRecognition();
      }
      this.recognition.lang = this.currentLanguage;
      this.recognition.start();
      return true;
    } catch (err) {
      this._stopAudioAnalysis();
      this.isListeningActive = false;

      let msg = err.message || 'Failed to access microphone.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Microphone permission was denied. Please grant microphone access in browser settings.';
      }

      this._notifyState('ERROR', msg);
      if (onError) onError({ code: err.name || 'PERMISSION_DENIED', message: msg });
      return false;
    }
  }

  /**
   * Initialize Web Audio API AnalyserNode to feed the visualizer live frequencies.
   * @private
   */
  _startAudioAnalysis(stream) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 64; // Produces 32 frequency bins
      this.analyserNode.smoothingTimeConstant = 0.8;

      source.connect(this.analyserNode);
      this.dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);

      const updateFrequencyData = () => {
        if (!this.analyserNode || !this.isListeningActive) return;

        this.analyserNode.getByteFrequencyData(this.dataArray);
        if (this.callbacks.onAudioData) {
          this.callbacks.onAudioData(this.dataArray);
        }
        this.animationFrameId = requestAnimationFrame(updateFrequencyData);
      };

      this.animationFrameId = requestAnimationFrame(updateFrequencyData);
    } catch (e) {
      console.warn('Web Audio analysis initialization bypassed:', e.message);
    }
  }

  /**
   * Stop Web Audio API and release all microphone hardware tracks.
   * @private
   */
  _stopAudioAnalysis() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (e) {}
      });
      this.mediaStream = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch (e) {}
      this.audioContext = null;
    }

    this.analyserNode = null;
    this.dataArray = null;
  }

  /**
   * Stop listening and finalize transcript.
   * @returns {string} Finalized combined transcript text
   */
  stopListening() {
    this.isListeningActive = false;
    this._stopAudioAnalysis();

    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {}
    }

    const finalResult = (this.transcript + ' ' + this.interimTranscript).trim();
    this._notifyState('TRANSCRIPT_READY');
    return finalResult;
  }

  /**
   * Abort listening immediately, discarding current input.
   */
  abortListening() {
    this.isListeningActive = false;
    this._stopAudioAnalysis();

    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch (e) {}
    }

    this.transcript = '';
    this.interimTranscript = '';
    this._notifyState('IDLE');
  }

  /**
   * Helper to dispatch state transitions.
   * @private
   */
  _notifyState(state, message = null) {
    if (this.callbacks.onStateChange) {
      this.callbacks.onStateChange(state, message);
    }
  }

  /**
   * Set preferred recognition language.
   * @param {string} lang
   */
  setLanguage(lang) {
    this.currentLanguage = lang;
    if (this.recognition) {
      this.recognition.lang = lang;
    }
  }

  /**
   * Current active status.
   * @returns {boolean}
   */
  isListening() {
    return this.isListeningActive;
  }
}

export const speechRecognitionService = new SpeechRecognitionService();
export default speechRecognitionService;

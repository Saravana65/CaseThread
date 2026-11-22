/**
 * @file speechSynthesisService.js
 * @brief Production-grade Text-to-Speech (TTS) service for CaseThread JARVIS Voice Assistant.
 * Utilizes window.speechSynthesis with sentence segmentation, natural abbreviation expansion,
 * citation stripping, speech rate controls, voice selection, and interruption handling.
 * @project CASETHREAD
 */

class SpeechSynthesisService {
  constructor() {
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.voices = [];
    this.selectedVoice = null;
    this.rate = 1.0;
    this.pitch = 1.0;
    this.isMuted = false;
    this.isSpeaking = false;
    this.isPaused = false;

    this.utteranceQueue = [];
    this.currentUtteranceIndex = 0;
    this.currentText = '';

    this.callbacks = {
      onStart: null,
      onSentence: null,
      onEnd: null,
      onError: null
    };

    this._initVoices();
  }

  /**
   * Check if speech synthesis is available.
   * @returns {boolean}
   */
  isSupported() {
    return Boolean(typeof window !== 'undefined' && window.speechSynthesis);
  }

  /**
   * Load and cache available voices from the browser.
   * @private
   */
  _initVoices() {
    if (!this.isSupported()) return;

    const loadVoices = () => {
      this.voices = this.synth.getVoices() || [];
      if (!this.selectedVoice && this.voices.length > 0) {
        // Prefer natural English voices (Google US English, Samantha, Microsoft David/Zira, Daniel)
        const preferred = this.voices.find(v => 
          (v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Enhanced') || v.name.includes('David') || v.name.includes('Daniel') || v.name.includes('Samantha')))
        ) || this.voices.find(v => v.lang.startsWith('en')) || this.voices[0];

        this.selectedVoice = preferred;
      }
    };

    loadVoices();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = loadVoices;
    }
  }

  /**
   * Get list of currently installed synthesis voices.
   * @param {string} [langPrefix] - Optional language code prefix (e.g. 'en', 'hi', 'te')
   * @returns {Array<SpeechSynthesisVoice>}
   */
  getVoices(langPrefix = null) {
    if (!this.voices || this.voices.length === 0) {
      if (this.synth) this.voices = this.synth.getVoices() || [];
    }

    if (langPrefix) {
      return this.voices.filter(v => v.lang.toLowerCase().startsWith(langPrefix.toLowerCase()));
    }
    return this.voices;
  }

  /**
   * Select a specific voice by name or URI.
   * @param {string} voiceName
   */
  setVoice(voiceName) {
    const match = this.voices.find(v => v.name === voiceName || v.voiceURI === voiceName);
    if (match) {
      this.selectedVoice = match;
    }
  }

  /**
   * Set playback speed rate (0.5 to 2.0).
   * @param {number} rate
   */
  setRate(rate) {
    this.rate = Math.max(0.5, Math.min(2.0, Number(rate) || 1.0));
  }

  /**
   * Toggle mute state.
   * @param {boolean} [muteValue]
   * @returns {boolean} New mute state
   */
  toggleMute(muteValue = null) {
    this.isMuted = muteValue !== null ? Boolean(muteValue) : !this.isMuted;
    if (this.isMuted && this.isSpeaking) {
      this.stop();
    }
    return this.isMuted;
  }

  /**
   * Sanitize AI intelligence response for natural human speech:
   * 1. Strips citation markers ([CIT-32], [CIT-1], etc.)
   * 2. Strips markdown asterisks, hashes, backticks, bullets, links, table pipes
   * 3. Expands legal/forensic acronyms so the speech synthesizer pronounces them clearly
   * 4. Normalizes whitespace and removes trailing raw URLs or IDs
   * @param {string} text
   * @returns {string} Clean human-readable text suitable for speech
   */
  cleanTextForSpeech(text) {
    if (!text || typeof text !== 'string') return '';

    let cleaned = text;

    // 1. Remove source citation tokens like [CIT-32], [CIT-Doc-12], etc.
    cleaned = cleaned.replace(/\[CIT-[^\]]+\]/gi, '');

    // 2. Remove markdown links [Title](https://...) -> Title
    cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

    // 3. Remove raw URLs
    cleaned = cleaned.replace(/https?:\/\/\S+/gi, '');

    // 4. Remove markdown headers (#, ##, ###)
    cleaned = cleaned.replace(/^#{1,6}\s+/gm, '');

    // 5. Remove bold / italic markers (**text**, *text*, _text_)
    cleaned = cleaned.replace(/(\*\*|__)(.*?)\1/g, '$2');
    cleaned = cleaned.replace(/(\*|_)(.*?)\1/g, '$2');

    // 6. Remove backticks and inline code
    cleaned = cleaned.replace(/`([^`]+)`/g, '$1');

    // 7. Remove bullet symbols at start of lines (*, -, +)
    cleaned = cleaned.replace(/^\s*[-*+]\s+/gm, '');

    // 8. Remove markdown table formatting characters (|)
    cleaned = cleaned.replace(/\|/g, ' ');

    // 9. Expand legal & investigative acronyms for natural phonetic synthesis
    const acronyms = [
      { pattern: /\bCCTV\b/g, replacement: 'C C T V' },
      { pattern: /\bDVR\b/g, replacement: 'D V R' },
      { pattern: /\bFIR\b/g, replacement: 'F I R' },
      { pattern: /\bIMEI\b/g, replacement: 'I M E I' },
      { pattern: /\bIPC\b/g, replacement: 'I P C' },
      { pattern: /\bCrPC\b/gi, replacement: 'C R P C' },
      { pattern: /\bIUCR\b/g, replacement: 'I U C R' },
      { pattern: /\bGPS\b/g, replacement: 'G P S' },
      { pattern: /\bIP\b/g, replacement: 'I P' },
      { pattern: /\bAI\b/g, replacement: 'A I' },
      { pattern: /\bPM\b/g, replacement: 'P M' },
      { pattern: /\bAM\b/g, replacement: 'A M' },
      { pattern: /\bvs\b/gi, replacement: 'versus' }
    ];

    for (const item of acronyms) {
      cleaned = cleaned.replace(item.pattern, item.replacement);
    }

    // 10. Collapse multiple spaces and newlines
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    return cleaned;
  }

  /**
   * Split sanitized text into concise, natural sentence chunks (< 160 characters).
   * Prevents browser speech synthesis hanging on long monolithic paragraphs.
   * @param {string} text
   * @returns {Array<string>}
   */
  segmentIntoSentences(text) {
    if (!text) return [];

    // Match punctuation boundaries followed by space or end
    const rawSentences = text.match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g) || [text];
    const chunks = [];

    for (const sentence of rawSentences) {
      const trimmed = sentence.trim();
      if (!trimmed) continue;

      if (trimmed.length <= 160) {
        chunks.push(trimmed);
      } else {
        // Sub-segment at clause commas or semicolons
        const clauses = trimmed.split(/([,;:]\s+)/);
        let currentChunk = '';

        for (const part of clauses) {
          if ((currentChunk + part).length <= 160) {
            currentChunk += part;
          } else {
            if (currentChunk.trim()) chunks.push(currentChunk.trim());
            currentChunk = part;
          }
        }
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
        }
      }
    }

    return chunks;
  }

  /**
   * Speak a text string with natural sentence queuing and state callbacks.
   * @param {string} text - Raw or markdown response from AI intelligence
   * @param {Object} options
   * @param {Function} options.onStart
   * @param {Function} options.onSentence - Receives (currentSentence, index, total)
   * @param {Function} options.onEnd
   * @param {Function} options.onError
   */
  speak(text, { onStart, onSentence, onEnd, onError } = {}) {
    if (!this.isSupported() || this.isMuted) {
      if (onEnd) onEnd();
      return;
    }

    // Stop any existing speech playback to prevent overlaps
    this.stop();

    const cleaned = this.cleanTextForSpeech(text);
    if (!cleaned) {
      if (onEnd) onEnd();
      return;
    }

    this.currentText = cleaned;
    this.callbacks = { onStart, onSentence, onEnd, onError };
    this.utteranceQueue = this.segmentIntoSentences(cleaned);
    this.currentUtteranceIndex = 0;

    if (this.utteranceQueue.length === 0) {
      if (onEnd) onEnd();
      return;
    }

    this.isSpeaking = true;
    this.isPaused = false;

    if (onStart) onStart();
    this._speakNextUtterance();
  }

  /**
   * Speak the next sentence in the queue.
   * @private
   */
  _speakNextUtterance() {
    if (!this.synth || !this.isSpeaking) return;

    if (this.currentUtteranceIndex >= this.utteranceQueue.length) {
      this.isSpeaking = false;
      this.isPaused = false;
      if (this.callbacks.onEnd) {
        this.callbacks.onEnd();
      }
      return;
    }

    const sentence = this.utteranceQueue[this.currentUtteranceIndex];
    const utterance = new SpeechSynthesisUtterance(sentence);

    if (this.selectedVoice) {
      utterance.voice = this.selectedVoice;
      utterance.lang = this.selectedVoice.lang;
    }
    utterance.rate = this.rate;
    utterance.pitch = this.pitch;

    if (this.callbacks.onSentence) {
      this.callbacks.onSentence(sentence, this.currentUtteranceIndex, this.utteranceQueue.length);
    }

    utterance.onend = () => {
      this.currentUtteranceIndex++;
      this._speakNextUtterance();
    };

    utterance.onerror = (event) => {
      // If canceled deliberately by stop(), don't report as an error
      if (event.error === 'canceled' || event.error === 'interrupted') {
        return;
      }
      console.warn('Speech synthesis utterance error:', event.error);
      this.currentUtteranceIndex++;
      this._speakNextUtterance();
    };

    this.synth.speak(utterance);
  }

  /**
   * Pause current speech playback.
   */
  pause() {
    if (this.synth && this.isSpeaking && !this.isPaused) {
      this.synth.pause();
      this.isPaused = true;
    }
  }

  /**
   * Resume paused speech playback.
   */
  resume() {
    if (this.synth && this.isPaused) {
      this.synth.resume();
      this.isPaused = false;
    }
  }

  /**
   * Stop speech synthesis immediately and clear the queue.
   */
  stop() {
    this.isSpeaking = false;
    this.isPaused = false;
    this.utteranceQueue = [];
    this.currentUtteranceIndex = 0;

    if (this.synth) {
      try {
        this.synth.cancel();
      } catch (e) {}
    }

    if (this.callbacks.onEnd) {
      this.callbacks.onEnd();
    }
  }
}

export const speechSynthesisService = new SpeechSynthesisService();
export default speechSynthesisService;

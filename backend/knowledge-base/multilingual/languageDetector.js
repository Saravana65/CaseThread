/**
 * @file languageDetector.js
 * @brief Fast, reliable Unicode block and heuristic language detector.
 * Detects English, Hindi, Spanish, French, German, and multilingual scripts without external APIs.
 * @project CASETHREAD
 */

class LanguageDetector {
  /**
   * Detects script and predominant language from input text.
   * @param {string} text
   * @returns {{ language: string, confidence: number, script: string }}
   */
  static detectLanguage(text) {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return { language: 'en', confidence: 1.0, script: 'Latin' };
    }

    const clean = text.trim();
    const len = clean.length;

    // Count character occurrences in distinct Unicode blocks
    let devanagariCount = 0;
    let cyrillicCount = 0;
    let arabicCount = 0;
    let cjkCount = 0;
    let latinCount = 0;

    for (let i = 0; i < len; i++) {
      const code = clean.charCodeAt(i);
      if (code >= 0x0900 && code <= 0x097F) devanagariCount++;
      else if (code >= 0x0400 && code <= 0x04FF) cyrillicCount++;
      else if (code >= 0x0600 && code <= 0x06FF) arabicCount++;
      else if (code >= 0x4E00 && code <= 0x9FFF) cjkCount++;
      else if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122) || (code >= 0x00C0 && code <= 0x00FF)) latinCount++;
    }

    // Evaluate script dominance
    if (devanagariCount > len * 0.15) {
      return { language: 'hi', confidence: Math.min(1.0, devanagariCount / (len * 0.5)), script: 'Devanagari' };
    }
    if (cyrillicCount > len * 0.15) {
      return { language: 'ru', confidence: Math.min(1.0, cyrillicCount / (len * 0.5)), script: 'Cyrillic' };
    }
    if (arabicCount > len * 0.15) {
      return { language: 'ar', confidence: Math.min(1.0, arabicCount / (len * 0.5)), script: 'Arabic' };
    }
    if (cjkCount > len * 0.15) {
      return { language: 'zh', confidence: Math.min(1.0, cjkCount / (len * 0.5)), script: 'CJK' };
    }

    // For Latin scripts, use high-frequency stopwords heuristics
    const lower = clean.toLowerCase();
    const words = lower.split(/[\s,.;:!?()"]+/).filter(w => w.length > 1);

    const spanishStopwords = new Set(['el', 'la', 'los', 'las', 'de', 'del', 'en', 'un', 'una', 'por', 'con', 'para', 'policía', 'delito']);
    const frenchStopwords = new Set(['le', 'la', 'les', 'des', 'du', 'en', 'un', 'une', 'pour', 'avec', 'police', 'tribunal']);
    const germanStopwords = new Set(['der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'und', 'in', 'von', 'mit', 'polizei', 'gericht']);

    let esMatches = 0;
    let frMatches = 0;
    let deMatches = 0;

    // Check specific diacritics / umlauts
    if (/[äöüß]/i.test(lower)) deMatches += 3;
    if (/[áéíóúñ¿¡]/i.test(lower)) esMatches += 3;
    if (/[àâçéèêëîïôûù]/i.test(lower)) frMatches += 2;

    for (const w of words.slice(0, 200)) {
      if (spanishStopwords.has(w)) esMatches++;
      if (frenchStopwords.has(w)) frMatches++;
      if (germanStopwords.has(w)) deMatches++;
    }

    if (esMatches >= 2 && esMatches > frMatches && esMatches > deMatches) {
      return { language: 'es', confidence: 0.85, script: 'Latin' };
    }
    if (frMatches >= 2 && frMatches > esMatches && frMatches > deMatches) {
      return { language: 'fr', confidence: 0.85, script: 'Latin' };
    }
    if (deMatches >= 2 && deMatches > esMatches && deMatches > deMatches - 1) {
      return { language: 'de', confidence: 0.85, script: 'Latin' };
    }

    return { language: 'en', confidence: 0.95, script: 'Latin' };
  }
}

module.exports = LanguageDetector;

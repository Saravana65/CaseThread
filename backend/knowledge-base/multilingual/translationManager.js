/**
 * @file translationManager.js
 * @brief Manages multilingual storage, translation status, and citation preservation.
 * Stores translated text separately from original records without altering names, dates, or citations.
 * @project CASETHREAD
 */

class TranslationManager {
  /**
   * Processes an incoming document for multilingual storage.
   * @param {object} params
   * @param {string} params.text - Original text
   * @param {string} params.declaredLanguage - Declared or detected language code
   * @param {string} [params.providedTranslation] - Pre-translated official text if available
   * @param {string} [params.translationMethod] - 'NONE' | 'AUTO_TRANSLATED' | 'OFFICIAL_VERIFIED'
   */
  static processTranslation({ text, declaredLanguage, providedTranslation = null, translationMethod = 'NONE' }) {
    if (!text) {
      return {
        originalText: '',
        language: 'en',
        translatedText: null,
        translationStatus: 'NONE'
      };
    }

    const lang = declaredLanguage || 'en';

    // If text is already in English, no translation needed
    if (lang === 'en') {
      return {
        originalText: text,
        language: 'en',
        translatedText: null,
        translationStatus: 'NONE'
      };
    }

    // If an official or model-provided translation is supplied, preserve it
    if (providedTranslation && typeof providedTranslation === 'string' && providedTranslation.trim().length > 0) {
      return {
        originalText: text,
        language: lang,
        translatedText: providedTranslation.trim(),
        translationStatus: translationMethod || 'OFFICIAL_VERIFIED'
      };
    }

    // No translation performed: preserve original intact and mark translationStatus = 'NONE'
    return {
      originalText: text,
      language: lang,
      translatedText: null,
      translationStatus: 'NONE'
    };
  }
}

module.exports = TranslationManager;

/**
 * @file textNormalizer.js
 * @brief Cleans, normalizes, and sanitizes raw extracted text for indexing.
 * @project CASETHREAD
 */

class TextNormalizer {
  /**
   * Cleans UTF-8 string, removes non-printable control characters, normalizes line endings.
   * @param {string} text - Raw input string
   * @returns {string} Normalized clean string
   */
  static normalizeText(text) {
    if (!text || typeof text !== 'string') return '';

    return text
      // Normalize Unicode characters to NFKC form
      .normalize('NFKC')
      // Standardize Windows / Mac line endings to standard Unix \n
      .replace(/\r\n|\r/g, '\n')
      // Remove unprintable control characters, preserving \n, \t
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      // Replace non-breaking spaces and tabs with standard space
      .replace(/[\u00A0\t]/g, ' ')
      // Collapse multiple consecutive spaces within a line
      .replace(/[ ]{2,}/g, ' ')
      // Collapse 3+ consecutive newlines into 2
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * Neutralizes potential formula injection symbols (=, +, -, @, \t, \r)
   * if text origin is tabular or CSV/spreadsheet cells.
   * @param {string} val - Cell text
   * @returns {string} Safe text
   */
  static neutralizeFormulaInjection(val) {
    if (!val || typeof val !== 'string') return '';
    const trimmed = val.trim();
    if (/^[=+\-@\t\r]/.test(trimmed)) {
      return `'${trimmed}`;
    }
    return trimmed;
  }
}

module.exports = TextNormalizer;

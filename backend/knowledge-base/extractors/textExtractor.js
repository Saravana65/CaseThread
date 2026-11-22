/**
 * @file textExtractor.js
 * @brief Plain text file extractor for Private Crime Knowledge Base.
 * @project CASETHREAD
 */

const fs = require('fs');

class TextExtractor {
  /**
   * Extracts text and basic metadata from a plain text file.
   * @param {string} filePath
   * @returns {Promise<{ text: string, metadata: object }>}
   */
  static async extract(filePath) {
    const rawContent = await fs.promises.readFile(filePath, 'utf8');
    
    // Heuristic extraction of common crime record headers if present
    const metadata = {
      format: 'txt',
      extracted_at: new Date().toISOString()
    };

    const lines = rawContent.split('\n').map(l => l.trim()).filter(Boolean);
    for (const line of lines.slice(0, 15)) {
      if (/^case\s*(?:no|number|ref)?\s*[:=-]\s*(.+)$/i.test(line)) {
        metadata.case_number = line.match(/^case\s*(?:no|number|ref)?\s*[:=-]\s*(.+)$/i)[1].trim();
      } else if (/^(?:jurisdiction|court|police department)\s*[:=-]\s*(.+)$/i.test(line)) {
        metadata.jurisdiction = line.match(/^(?:jurisdiction|court|police department)\s*[:=-]\s*(.+)$/i)[1].trim();
      } else if (/^(?:category|offense|crime)\s*[:=-]\s*(.+)$/i.test(line)) {
        metadata.crime_category = line.match(/^(?:category|offense|crime)\s*[:=-]\s*(.+)$/i)[1].trim();
      }
    }

    return {
      text: rawContent,
      metadata
    };
  }
}

module.exports = TextExtractor;

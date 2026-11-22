/**
 * @file csvExtractor.js
 * @brief CSV tabular record extractor for Private Crime Knowledge Base with formula injection safeguards.
 * @project CASETHREAD
 */

const fs = require('fs');
const TextNormalizer = require('../normalization/textNormalizer');

class CsvExtractor {
  /**
   * Simple, reliable CSV line parser handling quotes and commas.
   */
  static parseCsvLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  }

  /**
   * Extracts text and metadata from CSV file.
   * @param {string} filePath
   * @returns {Promise<{ text: string, metadata: object }>}
   */
  static async extract(filePath) {
    const rawContent = await fs.promises.readFile(filePath, 'utf8');
    const lines = rawContent.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    if (lines.length === 0) {
      return { text: '', metadata: { format: 'csv', row_count: 0 } };
    }

    const headers = this.parseCsvLine(lines[0]).map(h => h.trim());
    const rows = [];

    const metadata = {
      format: 'csv',
      row_count: lines.length - 1,
      headers: headers,
      extracted_at: new Date().toISOString()
    };

    const textBlocks = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCsvLine(lines[i]);
      const rowObj = {};
      const rowLines = [`[ROW ${i}]`];

      headers.forEach((hdr, idx) => {
        let val = values[idx] || '';
        // Neutralize formula injection
        val = TextNormalizer.neutralizeFormulaInjection(val);
        rowObj[hdr] = val;
        rowLines.push(`${hdr}: ${val}`);
      });

      rows.push(rowObj);
      textBlocks.push(rowLines.join('\n'));

      // Harvest metadata from first few rows if matching keys exist
      if (i === 1) {
        for (const [k, v] of Object.entries(rowObj)) {
          const lk = k.toLowerCase();
          if (lk.includes('case') && !metadata.case_number) metadata.case_number = v;
          if ((lk.includes('court') || lk.includes('jurisdiction')) && !metadata.jurisdiction) metadata.jurisdiction = v;
          if ((lk.includes('category') || lk.includes('crime') || lk.includes('offense')) && !metadata.crime_category) metadata.crime_category = v;
        }
      }
    }

    return {
      text: textBlocks.join('\n\n---\n\n'),
      metadata
    };
  }
}

module.exports = CsvExtractor;

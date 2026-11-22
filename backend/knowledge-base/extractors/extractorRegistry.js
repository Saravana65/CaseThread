/**
 * @file extractorRegistry.js
 * @brief Dispatcher for file extractors supporting .pdf, .docx, .txt, .json, .csv.
 * @project CASETHREAD
 */

const path = require('path');
const TextExtractor = require('./textExtractor');
const JsonExtractor = require('./jsonExtractor');
const CsvExtractor = require('./csvExtractor');
const PdfExtractor = require('./pdfExtractor');
const DocxExtractor = require('./docxExtractor');

class ExtractorRegistry {
  /**
   * Dispatches extraction according to file extension.
   * @param {string} filePath
   * @returns {Promise<{ text: string, metadata: object, is_ocr_required?: boolean }>}
   */
  static async extract(filePath) {
    const ext = path.extname(filePath).toLowerCase();

    switch (ext) {
      case '.txt':
        return await TextExtractor.extract(filePath);
      case '.json':
        return await JsonExtractor.extract(filePath);
      case '.csv':
        return await CsvExtractor.extract(filePath);
      case '.pdf':
        return await PdfExtractor.extract(filePath);
      case '.docx':
        return await DocxExtractor.extract(filePath);
      default:
        throw new Error(`Unsupported file type for extraction: ${ext}`);
    }
  }
}

module.exports = ExtractorRegistry;

/**
 * @file pdfExtractor.js
 * @brief PDF extractor and scanner for Private Crime Knowledge Base.
 * Validates %PDF- signature, decompresses Flate streams, extracts text & metadata,
 * and detects scanned PDFs requiring OCR.
 * @project CASETHREAD
 */

const fs = require('fs');
const zlib = require('zlib');

class PdfExtractor {
  /**
   * Extracts text, dictionary metadata, and OCR requirement flags from a PDF file.
   * @param {string} filePath
   * @returns {Promise<{ text: string, metadata: object, is_ocr_required: boolean }>}
   */
  static async extract(filePath) {
    const buffer = await fs.promises.readFile(filePath);

    // 1. Verify %PDF- header signature
    const header = buffer.slice(0, 8).toString('latin1');
    if (!header.startsWith('%PDF-')) {
      throw new Error('Invalid PDF format: Missing %PDF- signature in header.');
    }

    const pdfVersion = header.trim();
    const metadata = {
      format: 'pdf',
      pdf_version: pdfVersion,
      extracted_at: new Date().toISOString()
    };

    const rawString = buffer.toString('latin1');

    // 2. Extract Document Information Dictionary (/Title, /Author, /CreationDate, etc.)
    const titleMatch = rawString.match(/\/Title\s*(?:\(([^)]+)\)|<([0-9A-Fa-f]+)>)/);
    if (titleMatch) metadata.title = titleMatch[1] || Buffer.from(titleMatch[2], 'hex').toString('utf8');

    const authorMatch = rawString.match(/\/Author\s*(?:\(([^)]+)\)|<([0-9A-Fa-f]+)>)/);
    if (authorMatch) metadata.author = authorMatch[1] || Buffer.from(authorMatch[2], 'hex').toString('utf8');

    const dateMatch = rawString.match(/\/CreationDate\s*\(([^)]+)\)/);
    if (dateMatch) metadata.creation_date = dateMatch[1];

    // Count pages roughly by /Type /Page
    const pageMatches = rawString.match(/\/Type\s*\/Page\b/g);
    metadata.page_count = pageMatches ? pageMatches.length : 1;

    // 3. Scan and decompress streams to extract text operators
    const textSegments = [];
    const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
    let match;

    while ((match = streamRegex.exec(rawString)) !== null) {
      const streamData = match[1];
      let decoded = '';

      // Try raw text directly
      if (streamData.includes('BT') && streamData.includes('ET')) {
        decoded = streamData;
      } else {
        // Try decompressing with FlateDecode (zlib)
        try {
          const streamBuf = Buffer.from(streamData, 'binary');
          const inflated = zlib.inflateSync(streamBuf);
          decoded = inflated.toString('latin1');
        } catch {
          // Stream might not be flate or might be compressed differently (e.g. image stream)
          decoded = '';
        }
      }

      if (decoded && decoded.includes('BT')) {
        // Extract text inside Tj and TJ operators
        // e.g. (Hello World) Tj or [(Hello) 20 (World)] TJ
        const tjRegex = /\(([^)]*)\)\s*Tj/g;
        let tjMatch;
        while ((tjMatch = tjRegex.exec(decoded)) !== null) {
          textSegments.push(tjMatch[1]);
        }

        const tjArrayRegex = /\[(.*?)\]\s*TJ/g;
        let tjaMatch;
        while ((tjaMatch = tjArrayRegex.exec(decoded)) !== null) {
          const innerTj = tjaMatch[1];
          const subMatches = innerTj.match(/\(([^)]*)\)/g);
          if (subMatches) {
            const joined = subMatches.map(m => m.slice(1, -1)).join(' ');
            textSegments.push(joined);
          }
        }
      }
    }

    // Clean extracted text
    let fullText = textSegments.join(' ').replace(/\\([()\\])/g, '$1').trim();

    // 4. Scanned PDF Detection (OCR Requirement)
    // If text is virtually empty but document has pages or is > 5KB
    const isOcrRequired = fullText.length < 50 && buffer.length > 5120;

    if (isOcrRequired) {
      metadata.ocr_required = true;
      metadata.ocr_status = 'PENDING';
      fullText = `[SCANNED DOCUMENT NOTICE]\nThis PDF appears to be a scanned image document without an embedded text stream.\nFile size: ${(buffer.length / 1024).toFixed(1)} KB.\nEmbedded text extraction yielded negligible characters. OCR processing required for full text indexing.`;
    }

    return {
      text: fullText,
      metadata,
      is_ocr_required: isOcrRequired
    };
  }
}

module.exports = PdfExtractor;

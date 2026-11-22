/**
 * @file docxExtractor.js
 * @brief Microsoft Word (.docx) extractor for Private Crime Knowledge Base.
 * Parses ZIP container to read word/document.xml and decompress via zlib,
 * extracting text and paragraph structure.
 * @project CASETHREAD
 */

const fs = require('fs');
const zlib = require('zlib');

class DocxExtractor {
  /**
   * Reads a ZIP file buffer and finds the uncompressed/decompressed content of a target file inside.
   * Standard ZIP Local File Header signature: 0x04034b50 (PK\x03\x04)
   */
  static extractZipEntry(buffer, targetEntryName) {
    let offset = 0;
    while (offset < buffer.length - 30) {
      // Check for Local File Header signature (0x04034b50)
      if (buffer.readUInt32LE(offset) === 0x04034b50) {
        const compressionMethod = buffer.readUInt16LE(offset + 8);
        const compressedSize = buffer.readUInt32LE(offset + 18);
        const fileNameLength = buffer.readUInt16LE(offset + 26);
        const extraFieldLength = buffer.readUInt16LE(offset + 28);

        const fileName = buffer.toString('utf8', offset + 30, offset + 30 + fileNameLength);
        const dataOffset = offset + 30 + fileNameLength + extraFieldLength;

        if (fileName === targetEntryName) {
          const compressedData = buffer.slice(dataOffset, dataOffset + compressedSize);
          if (compressionMethod === 0) {
            // Uncompressed (stored)
            return compressedData;
          } else if (compressionMethod === 8) {
            // Deflated (zlib raw inflate)
            return zlib.inflateRawSync(compressedData);
          } else {
            throw new Error(`Unsupported ZIP compression method: ${compressionMethod}`);
          }
        }

        // Advance to next header
        offset = dataOffset + compressedSize;
      } else {
        offset++;
      }
    }
    return null;
  }

  /**
   * Extracts text and structure from a .docx file.
   * @param {string} filePath
   * @returns {Promise<{ text: string, metadata: object }>}
   */
  static async extract(filePath) {
    const buffer = await fs.promises.readFile(filePath);

    // Verify ZIP magic number PK\x03\x04
    if (buffer.readUInt32LE(0) !== 0x04034b50) {
      throw new Error('Invalid DOCX format: Not a valid ZIP package.');
    }

    const xmlBuffer = this.extractZipEntry(buffer, 'word/document.xml');
    if (!xmlBuffer) {
      throw new Error('Invalid DOCX format: word/document.xml not found in package.');
    }

    const xmlText = xmlBuffer.toString('utf8');

    // Extract core properties if present (docProps/core.xml)
    const metadata = {
      format: 'docx',
      extracted_at: new Date().toISOString()
    };

    const coreBuffer = this.extractZipEntry(buffer, 'docProps/core.xml');
    if (coreBuffer) {
      const coreXml = coreBuffer.toString('utf8');
      const titleMatch = coreXml.match(/<dc:title>([^<]*)<\/dc:title>/i);
      if (titleMatch) metadata.title = titleMatch[1];
      const creatorMatch = coreXml.match(/<dc:creator>([^<]*)<\/dc:creator>/i);
      if (creatorMatch) metadata.author = creatorMatch[1];
    }

    // Parse paragraphs <w:p> and text runs <w:t>
    const paragraphs = [];
    const pRegex = /<w:p(?:\s+[^>]*)?>([\s\S]*?)<\/w:p>/g;
    let pMatch;

    while ((pMatch = pRegex.exec(xmlText)) !== null) {
      const pContent = pMatch[1];
      const tRegex = /<w:t(?:\s+[^>]*)?>([\s\S]*?)<\/w:t>/g;
      let tMatch;
      const tParts = [];

      while ((tMatch = tRegex.exec(pContent)) !== null) {
        tParts.push(tMatch[1]);
      }

      if (tParts.length > 0) {
        paragraphs.push(tParts.join(''));
      }
    }

    // Join paragraphs with double newlines
    const fullText = paragraphs.join('\n\n').trim();

    return {
      text: fullText,
      metadata
    };
  }
}

module.exports = DocxExtractor;

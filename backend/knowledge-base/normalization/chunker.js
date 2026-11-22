/**
 * @file chunker.js
 * @brief Splits normalized text into structured search chunks with overlap and metadata.
 * @project CASETHREAD
 */

class Chunker {
  /**
   * Chunks text into segments of target size with boundary awareness.
   * @param {string} text - Clean normalized text
   * @param {object} options
   * @param {number} options.targetSize - Target chunk size in characters (default 1000)
   * @param {number} options.minSize - Minimum chunk size (default 800)
   * @param {number} options.maxSize - Maximum chunk size (default 1200)
   * @param {number} options.overlap - Overlap size in characters (default 100)
   * @param {number} options.charsPerPage - Estimated characters per page (default 2000)
   * @returns {Array<object>} Array of chunks
   */
  static chunk(text, options = {}) {
    if (!text || typeof text !== 'string') return [];

    const targetSize = options.targetSize || 1000;
    const minSize = options.minSize || 800;
    const maxSize = options.maxSize || 1200;
    const overlap = options.overlap || 100;
    const charsPerPage = options.charsPerPage || 2000;

    const chunks = [];
    let startIdx = 0;
    let chunkIndex = 0;
    const totalLen = text.length;

    // Detect section headings if present (lines starting with #, Section, Chapter, ARTICLE, etc.)
    const headingRegex = /^(?:#+\s*|SECTION\s+\d+|CHAPTER\s+\d+|ARTICLE\s+\d+|RECORD\s+REF:|[A-Z\s]{4,}:)/i;

    while (startIdx < totalLen) {
      let endIdx = Math.min(startIdx + targetSize, totalLen);

      // If we're not at the very end of text, find the best boundary between minSize and maxSize
      if (endIdx < totalLen) {
        const searchWindowStart = Math.min(startIdx + minSize, totalLen);
        const searchWindowEnd = Math.min(startIdx + maxSize, totalLen);
        const windowText = text.substring(searchWindowStart, searchWindowEnd);

        // Try paragraph break first (\n\n)
        const paraBreak = windowText.lastIndexOf('\n\n');
        if (paraBreak !== -1) {
          endIdx = searchWindowStart + paraBreak + 2;
        } else {
          // Try sentence break (. / ! / ? followed by space or newline)
          const sentenceMatches = [...windowText.matchAll(/[.!?][\s\n]/g)];
          if (sentenceMatches.length > 0) {
            const lastMatch = sentenceMatches[sentenceMatches.length - 1];
            endIdx = searchWindowStart + lastMatch.index + 2;
          } else {
            // Try word break (space or newline)
            const spaceMatches = [...windowText.matchAll(/[\s\n]/g)];
            if (spaceMatches.length > 0) {
              const lastSpace = spaceMatches[spaceMatches.length - 1];
              endIdx = searchWindowStart + lastSpace.index + 1;
            } else {
              // Forced break at targetSize
              endIdx = Math.min(startIdx + targetSize, totalLen);
            }
          }
        }
      }

      let chunkText = text.substring(startIdx, endIdx).trim();

      if (chunkText.length > 0) {
        // Estimate page number
        const estimatedPage = Math.floor(startIdx / charsPerPage) + 1;

        // Try to identify section reference
        let sectionRef = `Segment ${chunkIndex + 1}`;
        const firstLines = chunkText.split('\n').slice(0, 3);
        for (const line of firstLines) {
          const trimmedLine = line.trim();
          if (headingRegex.test(trimmedLine) && trimmedLine.length < 80) {
            sectionRef = trimmedLine;
            break;
          }
        }

        chunks.push({
          chunk_index: chunkIndex,
          chunk_text: chunkText,
          page_number: estimatedPage,
          section_reference: sectionRef,
          char_length: chunkText.length,
          start_offset: startIdx,
          end_offset: endIdx
        });

        chunkIndex++;
      }

      // Advance startIdx by endIdx - overlap
      if (endIdx >= totalLen) {
        break;
      }

      startIdx = Math.max(endIdx - overlap, startIdx + 1);
    }

    return chunks;
  }
}

module.exports = Chunker;

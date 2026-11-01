/**
 * @file metadataExtractor.js
 * @description Format-aware automated metadata extraction for images, PDFs, audio, video,
 * and structured text files. Strictly non-destructive; never mutates original files.
 * @project CASETHREAD - Phase 8 Automated Metadata Extraction
 */

const fs = require('fs');
const path = require('path');

const EXTRACTOR_TOOL = 'CaseThread-ForensicExtractor';
const EXTRACTOR_VERSION = 'v1.0.0';

/**
 * Parses GPS rational coordinates (degrees, minutes, seconds) from EXIF TIFF values.
 */
function parseGpsDms(dmsArray, ref) {
  if (!dmsArray || !Array.isArray(dmsArray) || dmsArray.length < 3) return null;
  const deg = dmsArray[0];
  const min = dmsArray[1];
  const sec = dmsArray[2];
  let dec = deg + (min / 60) + (sec / 3600);
  if (ref === 'S' || ref === 'W') {
    dec = -dec;
  }
  return Number(dec.toFixed(6));
}

/**
 * Extracts metadata from PNG files.
 */
function extractPngMetadata(buffer) {
  if (buffer.length < 24) throw new Error('File too small for valid PNG header.');

  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const bitDepth = buffer.readUInt8(24);
  const colorType = buffer.readUInt8(25);

  const colorTypeMap = {
    0: 'Grayscale',
    2: 'Truecolor (RGB)',
    3: 'Indexed-color',
    4: 'Grayscale with alpha',
    6: 'Truecolor with alpha (RGBA)'
  };

  return {
    format: 'PNG',
    dimensions: { width, height },
    aspect_ratio: height ? Number((width / height).toFixed(2)) : null,
    bit_depth: bitDepth,
    color_type: colorTypeMap[colorType] || `Type ${colorType}`,
    channels: (colorType === 6) ? 4 : (colorType === 2) ? 3 : 1
  };
}

/**
 * Extracts metadata and EXIF tags from JPEG files.
 */
function extractJpegMetadata(buffer) {
  let offset = 2; // Skip FF D8 SOI
  let width = null;
  let height = null;
  let exifData = {};

  while (offset < buffer.length - 1) {
    if (buffer[offset] !== 0xFF) {
      offset++;
      continue;
    }

    const marker = buffer[offset + 1];
    offset += 2;

    // Standalone markers without length
    if (marker === 0xD8 || marker === 0xD9 || (marker >= 0xD0 && marker <= 0xD7)) {
      continue;
    }

    if (offset + 2 > buffer.length) break;
    const length = buffer.readUInt16BE(offset);

    // SOF0 (Baseline), SOF2 (Progressive)
    if ((marker === 0xC0 || marker === 0xC2) && offset + length <= buffer.length) {
      const precision = buffer.readUInt8(offset + 2);
      height = buffer.readUInt16BE(offset + 3);
      width = buffer.readUInt16BE(offset + 5);
      const components = buffer.readUInt8(offset + 7);
      exifData.dimensions = { width, height };
      exifData.precision_bits = precision;
      exifData.color_channels = components;
    }

    // APP1 (EXIF Marker): "Exif\0\0"
    if (marker === 0xE1 && offset + length <= buffer.length) {
      const header = buffer.toString('utf8', offset + 2, offset + 8);
      if (header.startsWith('Exif')) {
        parseExifBlock(buffer.slice(offset + 8, offset + length), exifData);
      }
    }

    offset += length;
  }

  return {
    format: 'JPEG',
    dimensions: exifData.dimensions || { width, height },
    camera_make: exifData.camera_make || null,
    camera_model: exifData.camera_model || null,
    capture_timestamp: exifData.capture_timestamp || null,
    gps_coordinates: exifData.gps_coordinates || null,
    software: exifData.software || null,
    details: exifData
  };
}

/**
 * Parses TIFF structure in EXIF APP1 block.
 */
function parseExifBlock(tiffBuf, out) {
  try {
    if (tiffBuf.length < 8) return;
    const isLe = tiffBuf.toString('ascii', 0, 2) === 'II';
    const read16 = (o) => isLe ? tiffBuf.readUInt16LE(o) : tiffBuf.readUInt16BE(o);
    const read32 = (o) => isLe ? tiffBuf.readUInt32LE(o) : tiffBuf.readUInt32BE(o);

    const ifdOffset = read32(4);
    if (ifdOffset >= tiffBuf.length) return;

    const numEntries = read16(ifdOffset);
    let cur = ifdOffset + 2;

    for (let i = 0; i < numEntries && cur + 12 <= tiffBuf.length; i++) {
      const tag = read16(cur);
      const type = read16(cur + 2);
      const count = read32(cur + 4);
      const valOffset = read32(cur + 8);

      // Make (0x010F) & Model (0x0110)
      if (tag === 0x010F && valOffset < tiffBuf.length) {
        out.camera_make = tiffBuf.toString('ascii', valOffset, Math.min(valOffset + count, tiffBuf.length)).replace(/\0/g, '').trim();
      } else if (tag === 0x0110 && valOffset < tiffBuf.length) {
        out.camera_model = tiffBuf.toString('ascii', valOffset, Math.min(valOffset + count, tiffBuf.length)).replace(/\0/g, '').trim();
      } else if (tag === 0x0132 && valOffset < tiffBuf.length) {
        out.modification_date = tiffBuf.toString('ascii', valOffset, Math.min(valOffset + count, tiffBuf.length)).replace(/\0/g, '').trim();
      } else if (tag === 0x9003 && valOffset < tiffBuf.length) {
        out.capture_timestamp = tiffBuf.toString('ascii', valOffset, Math.min(valOffset + count, tiffBuf.length)).replace(/\0/g, '').trim();
      } else if (tag === 0x0131 && valOffset < tiffBuf.length) {
        out.software = tiffBuf.toString('ascii', valOffset, Math.min(valOffset + count, tiffBuf.length)).replace(/\0/g, '').trim();
      }

      cur += 12;
    }
  } catch (err) {
    // Non-fatal: ignore corrupt EXIF headers
  }
}

/**
 * Extracts metadata from PDF documents.
 */
function extractPdfMetadata(buffer) {
  const content = buffer.toString('binary');
  
  // 1. Page Count Detection
  let pageCount = 0;
  const pageMatches = content.match(/\/Type\s*\/Page\b/g);
  if (pageMatches) {
    pageCount = pageMatches.length;
  }
  // Check /Count tag in /Pages root
  const countMatch = content.match(/\/Type\s*\/Pages[\s\S]{0,100}\/Count\s+(\d+)/);
  if (countMatch && parseInt(countMatch[1], 10) > 0) {
    pageCount = parseInt(countMatch[1], 10);
  }
  if (pageCount === 0) pageCount = 1; // Minimum 1 if valid PDF header

  // 2. Title & Author
  let title = null;
  let author = null;
  let creationDate = null;
  let modDate = null;

  const titleMatch = content.match(/\/Title\s*\(([^)]+)\)/);
  if (titleMatch) title = titleMatch[1].trim();

  const authorMatch = content.match(/\/Author\s*\(([^)]+)\)/);
  if (authorMatch) author = authorMatch[1].trim();

  const creationMatch = content.match(/\/CreationDate\s*\(([^)]+)\)/);
  if (creationMatch) creationDate = normalizePdfDate(creationMatch[1]);

  const modMatch = content.match(/\/ModDate\s*\(([^)]+)\)/);
  if (modMatch) modDate = normalizePdfDate(modMatch[1]);

  // PDF Version
  const versionMatch = content.slice(0, 15).match(/%PDF-(\d+\.\d+)/);
  const pdfVersion = versionMatch ? versionMatch[1] : '1.4';

  return {
    format: 'PDF',
    pdf_version: pdfVersion,
    page_count: pageCount,
    document_title: title,
    document_author: author,
    creation_date: creationDate,
    modification_date: modDate,
    has_encrypted_stream: content.includes('/Encrypt')
  };
}

function normalizePdfDate(rawDate) {
  if (!rawDate) return null;
  // D:YYYYMMDDHHmmSSOHH'mm'
  const match = rawDate.match(/D:?(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?/);
  if (match) {
    const y = match[1], m = match[2], d = match[3];
    const hr = match[4] || '00', min = match[5] || '00', sec = match[6] || '00';
    return `${y}-${m}-${d} ${hr}:${min}:${sec}`;
  }
  return rawDate;
}

/**
 * Extracts metadata from WAV audio files.
 */
function extractWavMetadata(buffer) {
  if (buffer.length < 44) throw new Error('File too short for standard WAV header.');

  const audioFormat = buffer.readUInt16LE(20);
  const channels = buffer.readUInt16LE(22);
  const sampleRate = buffer.readUInt32LE(24);
  const byteRate = buffer.readUInt32LE(28);
  const blockAlign = buffer.readUInt16LE(32);
  const bitsPerSample = buffer.readUInt16LE(34);

  // Search for 'data' chunk
  let dataSize = buffer.length - 44;
  const dataIdx = buffer.indexOf('data');
  if (dataIdx !== -1 && dataIdx + 8 <= buffer.length) {
    dataSize = buffer.readUInt32LE(dataIdx + 4);
  }

  const durationSec = byteRate > 0 ? Number((dataSize / byteRate).toFixed(2)) : 0;

  return {
    format: 'WAV',
    codec: audioFormat === 1 ? 'PCM Linear' : `Format code ${audioFormat}`,
    channels: channels === 1 ? 'Mono (1 channel)' : channels === 2 ? 'Stereo (2 channels)' : `${channels} channels`,
    sample_rate_hz: sampleRate,
    bits_per_sample: bitsPerSample,
    bitrate_kbps: Math.round((byteRate * 8) / 1000),
    duration_seconds: durationSec,
    audio_data_bytes: dataSize
  };
}

/**
 * Extracts metadata from MP3 audio files.
 */
function extractMp3Metadata(buffer) {
  let title = null;
  let artist = null;
  let sampleRate = 44100;
  let bitrateKbps = 128;
  let durationSec = 0;

  // Check ID3v2 tag
  if (buffer.length >= 10 && buffer.toString('ascii', 0, 3) === 'ID3') {
    const id3Size = (buffer[6] << 21) | (buffer[7] << 14) | (buffer[8] << 7) | buffer[9];
    const tagContent = buffer.toString('latin1', 10, Math.min(10 + id3Size, buffer.length));
    
    const tit2Match = tagContent.match(/TIT2[^\x00-\x1F]{1,3}([^\x00]+)/);
    if (tit2Match) title = tit2Match[1].replace(/[\x00-\x1F]/g, '').trim();

    const tpe1Match = tagContent.match(/TPE1[^\x00-\x1F]{1,3}([^\x00]+)/);
    if (tpe1Match) artist = tpe1Match[1].replace(/[\x00-\x1F]/g, '').trim();
  }

  // Scan for MPEG frame sync (11 consecutive bits set: 0xFF followed by 0xE0 mask)
  for (let i = 0; i < buffer.length - 4; i++) {
    if (buffer[i] === 0xFF && (buffer[i + 1] & 0xE0) === 0xE0) {
      const brIdx = (buffer[i + 2] & 0xF0) >> 4;
      const srIdx = (buffer[i + 2] & 0x0C) >> 2;
      const bitrates = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
      const sampleRates = [44100, 48000, 32000];

      if (bitrates[brIdx]) bitrateKbps = bitrates[brIdx];
      if (sampleRates[srIdx]) sampleRate = sampleRates[srIdx];
      break;
    }
  }

  durationSec = Number(((buffer.length * 8) / (bitrateKbps * 1000)).toFixed(2));

  return {
    format: 'MP3',
    codec: 'MPEG-1 Layer III',
    sample_rate_hz: sampleRate,
    bitrate_kbps: bitrateKbps,
    duration_seconds: durationSec,
    track_title: title,
    track_artist: artist
  };
}

/**
 * Extracts metadata from MP4 video containers.
 */
function extractMp4Metadata(buffer) {
  let duration = 0;
  let timescale = 1000;
  let width = 1920;
  let height = 1080;
  let codec = 'H.264 / AVC';

  // Search for mvhd (Movie Header) box
  const mvhdIndex = buffer.indexOf('mvhd');
  if (mvhdIndex !== -1 && mvhdIndex + 24 <= buffer.length) {
    const version = buffer.readUInt8(mvhdIndex + 4);
    if (version === 0) {
      timescale = buffer.readUInt32BE(mvhdIndex + 16);
      duration = buffer.readUInt32BE(mvhdIndex + 20);
    } else if (version === 1) {
      timescale = buffer.readUInt32BE(mvhdIndex + 24);
      duration = Number(buffer.readBigUInt64BE(mvhdIndex + 28));
    }
  }

  // Search for tkhd (Track Header) box for dimensions
  const tkhdIndex = buffer.indexOf('tkhd');
  if (tkhdIndex !== -1 && tkhdIndex + 84 <= buffer.length) {
    const w = buffer.readUInt32BE(tkhdIndex + 76) >> 16;
    const h = buffer.readUInt32BE(tkhdIndex + 80) >> 16;
    if (w > 0 && h > 0) {
      width = w;
      height = h;
    }
  }

  // Detect codec marker
  if (buffer.indexOf('avc1') !== -1) codec = 'AVC / H.264';
  else if (buffer.indexOf('hvc1') !== -1) codec = 'HEVC / H.265';
  else if (buffer.indexOf('mp4v') !== -1) codec = 'MPEG-4 Part 2';

  const durationSec = timescale > 0 ? Number((duration / timescale).toFixed(2)) : 0;

  return {
    format: 'MP4',
    container: 'ISO Base Media / QuickTime',
    codec,
    resolution: `${width}x${height}`,
    dimensions: { width, height },
    duration_seconds: durationSec,
    aspect_ratio: height ? Number((width / height).toFixed(2)) : null
  };
}

/**
 * Extracts metadata from CSV, TXT, JSON, and XML structured text files.
 */
function extractTextMetadata(buffer, ext) {
  const content = buffer.toString('utf8');
  const lines = content.split(/\r\n|\r|\n/);
  const lineCount = lines.length;
  const wordCount = (content.match(/\S+/g) || []).length;
  const charCount = content.length;

  if (ext === '.csv') {
    // Detect delimiter: comma, semicolon, tab
    const headerLine = lines[0] || '';
    const commaCount = (headerLine.match(/,/g) || []).length;
    const semiCount = (headerLine.match(/;/g) || []).length;
    const tabCount = (headerLine.match(/\t/g) || []).length;

    let delimiter = ',';
    if (semiCount > commaCount && semiCount > tabCount) delimiter = ';';
    if (tabCount > commaCount && tabCount > semiCount) delimiter = '\t';

    const columns = headerLine.split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
    const rowCount = Math.max(0, lines.filter(l => l.trim().length > 0).length - 1);

    return {
      format: 'CSV',
      encoding: 'UTF-8',
      delimiter,
      column_count: columns.length,
      columns,
      row_count: rowCount,
      line_count: lineCount,
      sample_records: lines.slice(1, 4).filter(Boolean)
    };
  }

  if (ext === '.json') {
    let parsed = null;
    let isArray = false;
    let topKeys = [];
    try {
      parsed = JSON.parse(content);
      isArray = Array.isArray(parsed);
      if (isArray) {
        topKeys = parsed.length > 0 && typeof parsed[0] === 'object' && parsed[0] !== null ? Object.keys(parsed[0]) : [];
      } else if (typeof parsed === 'object' && parsed !== null) {
        topKeys = Object.keys(parsed);
      }
    } catch (e) {
      // handled in caller
    }

    return {
      format: 'JSON',
      encoding: 'UTF-8',
      root_type: isArray ? 'ARRAY' : 'OBJECT',
      element_count: isArray ? parsed.length : topKeys.length,
      top_level_keys: topKeys,
      line_count: lineCount,
      file_size_bytes: buffer.length
    };
  }

  if (ext === '.xml') {
    const rootTagMatch = content.match(/<([a-zA-Z0-9_\-:]+)[\s>]/);
    const rootTag = rootTagMatch ? rootTagMatch[1] : 'unknown';
    const tagCount = (content.match(/<[a-zA-Z0-9_\-:]+/g) || []).length;

    return {
      format: 'XML',
      encoding: 'UTF-8',
      root_element: rootTag,
      estimated_tag_count: tagCount,
      line_count: lineCount,
      file_size_bytes: buffer.length
    };
  }

  return {
    format: 'PLAIN_TEXT',
    encoding: 'UTF-8',
    line_count: lineCount,
    word_count: wordCount,
    character_count: charCount,
    file_size_bytes: buffer.length
  };
}

/**
 * Main dispatcher for automated metadata extraction.
 * Guarantees that the original file is never modified.
 * 
 * @param {string} filePath Absolute path to file
 * @param {string} fileExtension Lowercase extension (e.g. '.pdf')
 * @returns {Promise<Object>} Formatted extraction result
 */
async function extractMetadataFromFile(filePath, fileExtension) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Target file not found at path: ${filePath}`);
  }

  const buffer = fs.readFileSync(filePath);
  const ext = fileExtension.toLowerCase().startsWith('.') ? fileExtension.toLowerCase() : `.${fileExtension.toLowerCase()}`;
  let extracted = {};
  let status = 'SUCCESS';
  let gpsLat = null;
  let gpsLon = null;
  let extractedTimestamp = null;

  try {
    switch (ext) {
      case '.png':
        extracted = extractPngMetadata(buffer);
        break;
      case '.jpg':
      case '.jpeg':
        extracted = extractJpegMetadata(buffer);
        if (extracted.capture_timestamp) extractedTimestamp = extracted.capture_timestamp;
        if (extracted.gps_coordinates) {
          gpsLat = extracted.gps_coordinates.latitude || null;
          gpsLon = extracted.gps_coordinates.longitude || null;
        }
        break;
      case '.pdf':
        extracted = extractPdfMetadata(buffer);
        if (extracted.creation_date) extractedTimestamp = extracted.creation_date;
        break;
      case '.wav':
        extracted = extractWavMetadata(buffer);
        break;
      case '.mp3':
        extracted = extractMp3Metadata(buffer);
        break;
      case '.mp4':
        extracted = extractMp4Metadata(buffer);
        break;
      case '.csv':
      case '.json':
      case '.xml':
      case '.txt':
        extracted = extractTextMetadata(buffer, ext);
        break;
      default:
        extracted = { format: 'UNKNOWN', file_size_bytes: buffer.length };
        status = 'UNSUPPORTED_FORMAT';
    }
  } catch (err) {
    status = 'FAILED';
    extracted = { error: err.message, file_size_bytes: buffer.length };
  }

  return {
    extractor_tool: EXTRACTOR_TOOL,
    extractor_version: EXTRACTOR_VERSION,
    extraction_status: status,
    extracted_metadata: extracted,
    extracted_timestamp: extractedTimestamp,
    extracted_gps_lat: gpsLat,
    extracted_gps_lon: gpsLon,
    analyzed_at: new Date().toISOString()
  };
}

module.exports = {
  EXTRACTOR_TOOL,
  EXTRACTOR_VERSION,
  extractMetadataFromFile
};

/**
 * @file create_test_fixtures.js
 * @brief Generates synthetic test fixtures for Phase 13 automated testing.
 * All fixtures are explicitly labeled as SYNTHETIC TEST DATA.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const FIXTURES_DIR = path.resolve(__dirname, 'knowledge_test_fixtures');

if (!fs.existsSync(FIXTURES_DIR)) {
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });
}

// 1. Synthetic Plain Text Record
const txtContent = `CASE NUMBER: SYNTH-2026-991
JURISDICTION: Metropolitan Criminal Court
CRIME CATEGORY: Cyber Fraud & Identity Theft
DATE: 2026-03-15

[NOTICE: SYNTHETIC TEST DATA FOR AUTOMATED INTEGRATION TESTS]

STATEMENT OF FACTS:
The accused engaged in unauthorized extraction of credentials using phishing vectors.
The forensic audit retrieved digital ledgers corroborating transactions between multiple IP addresses.

FINDINGS & VERDICT:
Guilty under Section 66C and 66D of Information Technology Act.
Restitution ordered in the amount of 500,000 currency units.
`;
fs.writeFileSync(path.join(FIXTURES_DIR, 'synthetic_judgment.txt'), txtContent, 'utf8');

// 2. Synthetic JSON Record
const jsonContent = JSON.stringify({
  _test_notice: "SYNTHETIC TEST DATA - NOT A REAL CASE",
  case_number: "SYNTH-JSON-2026-042",
  case_name: "State vs. Test Suspect Alpha",
  jurisdiction: "High Court of Forensic Testing",
  crime_category: "Grand Larceny & Financial Tampering",
  incident_date: "2026-02-10",
  verdict: "CONVICTED",
  summary: "Synthetic criminal record generated for testing automated knowledge retrieval.",
  statement_of_facts: "Audit ledger records show discrepancy of 120,000 units transferred through shell accounts.",
  analysis: "Transactional trail linked directly to defendant digital signature.",
  parties: {
    prosecution: "State Prosecution Service",
    defense: "Public Defender"
  }
}, null, 2);
fs.writeFileSync(path.join(FIXTURES_DIR, 'synthetic_court_record.json'), jsonContent, 'utf8');

// 3. Synthetic CSV Ledger
const csvContent = `CaseRef,Jurisdiction,CrimeCategory,Amount,Date,FormulaTest
SYNTH-CSV-001,District Court South,Armed Robbery,45000,2026-01-20,=SUM(A1:A5)
SYNTH-CSV-002,District Court North,Wire Fraud,128000,2026-01-25,+CMD|' /C calc'!A0
SYNTH-CSV-003,Central Commercial Court,Extortion,75000,2026-02-01,-@HYPERLINK("http://attacker.com")
`;
fs.writeFileSync(path.join(FIXTURES_DIR, 'synthetic_crime_ledger.csv'), csvContent, 'utf8');

// 4. Synthetic PDF with Embedded Text Stream
const pdfStreamText = "BT /F1 12 Tf 72 712 Td (SYNTHETIC TEST RECORD: Digital Evidence Tampering Case SYNTH-PDF-771) Tj ET";
const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length ${pdfStreamText.length} >>
stream
${pdfStreamText}
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000202 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
320
%%EOF
`;
fs.writeFileSync(path.join(FIXTURES_DIR, 'synthetic_case.pdf'), pdfContent, 'latin1');

// 5. Synthetic Scanned PDF (No text stream, large enough to trigger OCR required detection)
const dummyImageBytes = Buffer.alloc(8000, 0x41); // 8KB dummy bytes
const scannedPdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length ${dummyImageBytes.length} >>
stream
${dummyImageBytes.toString('latin1')}
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000202 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
8200
%%EOF
`;
fs.writeFileSync(path.join(FIXTURES_DIR, 'synthetic_scanned_case.pdf'), scannedPdf, 'latin1');

// 6. Synthetic DOCX (Construct minimal valid ZIP container with word/document.xml)
function buildMinimalDocx(textContent) {
  const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>[SYNTHETIC TEST DOCX - CASETHREAD PHASE 13]</w:t></w:r></w:p>
    <w:p><w:r><w:t>${textContent}</w:t></w:r></w:p>
  </w:body>
</w:document>`;

  const xmlBuffer = Buffer.from(docXml, 'utf8');
  const entryName = 'word/document.xml';
  const nameBuffer = Buffer.from(entryName, 'utf8');

  // ZIP Local File Header (30 bytes + name + data)
  const lfh = Buffer.alloc(30);
  lfh.writeUInt32LE(0x04034b50, 0); // signature
  lfh.writeUInt16LE(20, 4); // version needed
  lfh.writeUInt16LE(0, 6);  // bit flag
  lfh.writeUInt16LE(0, 8);  // compression method (0 = stored)
  lfh.writeUInt16LE(0, 10); // last mod time
  lfh.writeUInt16LE(0, 12); // last mod date
  lfh.writeUInt32LE(0, 14); // crc-32 (0 for simple read)
  lfh.writeUInt32LE(xmlBuffer.length, 18); // compressed size
  lfh.writeUInt32LE(xmlBuffer.length, 22); // uncompressed size
  lfh.writeUInt16LE(nameBuffer.length, 26); // filename length
  lfh.writeUInt16LE(0, 28); // extra field length

  // Central Directory Header (46 bytes + name)
  const cdh = Buffer.alloc(46);
  cdh.writeUInt32LE(0x02014b50, 0); // central dir signature
  cdh.writeUInt16LE(20, 4); // version made by
  cdh.writeUInt16LE(20, 6); // version needed
  cdh.writeUInt16LE(0, 8);  // bit flag
  cdh.writeUInt16LE(0, 10); // compression method (0)
  cdh.writeUInt16LE(0, 12); // mod time
  cdh.writeUInt16LE(0, 14); // mod date
  cdh.writeUInt32LE(0, 16); // crc-32
  cdh.writeUInt32LE(xmlBuffer.length, 20); // compressed size
  cdh.writeUInt32LE(xmlBuffer.length, 24); // uncompressed size
  cdh.writeUInt16LE(nameBuffer.length, 28); // filename length
  cdh.writeUInt16LE(0, 30); // extra field length
  cdh.writeUInt16LE(0, 32); // comment length
  cdh.writeUInt16LE(0, 34); // disk number start
  cdh.writeUInt16LE(0, 36); // internal file attributes
  cdh.writeUInt32LE(0, 38); // external file attributes
  cdh.writeUInt32LE(0, 42); // relative offset of local header (0)

  const centralDirOffset = lfh.length + nameBuffer.length + xmlBuffer.length;
  const centralDirSize = cdh.length + nameBuffer.length;

  // End of Central Directory Record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // EOCD signature
  eocd.writeUInt16LE(0, 4);  // disk number
  eocd.writeUInt16LE(0, 6);  // disk with central dir
  eocd.writeUInt16LE(1, 8);  // total entries disk
  eocd.writeUInt16LE(1, 10); // total entries
  eocd.writeUInt32LE(centralDirSize, 12); // size of central dir
  eocd.writeUInt32LE(centralDirOffset, 16); // offset of central dir
  eocd.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([lfh, nameBuffer, xmlBuffer, cdh, nameBuffer, eocd]);
}

const docxBuffer = buildMinimalDocx('Judicial opinion regarding synthetic forensic ballistic analysis case SYNTH-DOCX-882.');
fs.writeFileSync(path.join(FIXTURES_DIR, 'synthetic_case.docx'), docxBuffer);

// 7. Invalid extension file
fs.writeFileSync(path.join(FIXTURES_DIR, 'unsupported_binary.bin'), Buffer.from([0xDE, 0xAD, 0xBE, 0xEF]));

console.log('Test fixtures created successfully in:', FIXTURES_DIR);

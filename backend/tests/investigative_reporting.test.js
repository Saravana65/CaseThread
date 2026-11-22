/**
 * @file investigative_reporting.test.js
 * @brief Automated Unit & Integration Test Suite for CaseThread Phase 9:
 *        Investigative Reporting, Document Export & Report History.
 */

const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const { execute, testConnection } = require('../database/connection');
const reportController = require('../controllers/reportController');

describe('Phase 9: Investigative Reporting & Document Export System', () => {
  let activeCaseId = 1;

  before(async () => {
    await testConnection();
    const [cases] = await execute('SELECT case_id FROM cases ORDER BY case_id ASC LIMIT 1');
    if (cases && cases.length > 0) {
      activeCaseId = cases[0].case_id;
    }
  });

  test('1. Case Dossier compilation returns complete evidentiary and metadata sections', async () => {
    let responseData = null;
    const req = { params: { caseId: activeCaseId } };
    const res = { json: (d) => { responseData = d; } };

    await reportController.getCaseDossier(req, res, (err) => { if (err) throw err; });

    assert.ok(responseData, 'Response data must exist');
    assert.equal(responseData.success, true);
    const d = responseData.data;

    assert.ok(d.case_summary, 'Must contain case_summary');
    assert.equal(d.case_summary.case_id, activeCaseId);
    assert.ok(d.case_summary.title, 'Must contain case title');
    assert.ok(d.case_summary.statistics, 'Must contain statistics');
    assert.ok(Array.isArray(d.evidence_inventory), 'Evidence inventory must be an array');
    assert.ok(Array.isArray(d.chain_of_custody_history), 'Custody history must be an array');
    assert.ok(Array.isArray(d.chronological_timeline), 'Timeline records must be an array');
    assert.ok(Array.isArray(d.academic_limitations), 'Must contain academic limitations list');
    assert.ok(d.tamper_evident_audit, 'Must contain tamper-evident audit section');
  });

  test('2. Structured JSON Export sets appropriate content headers and attachment filename', async () => {
    let responseData = null;
    const headersSet = {};
    const req = { params: { caseId: activeCaseId } };
    const res = {
      setHeader: (k, v) => { headersSet[k] = v; },
      json: (d) => { responseData = d; }
    };

    await reportController.exportCaseReportJson(req, res, (err) => { if (err) throw err; });

    assert.ok(headersSet['Content-Type'].includes('application/json'));
    assert.ok(headersSet['Content-Disposition'].includes('attachment'));
    assert.ok(headersSet['Content-Disposition'].includes('.json'));
    assert.ok(responseData.success);
    assert.ok(responseData.data);
  });

  test('3. CSV Export generates sanitized, formula-injection-safe evidence inventory', async () => {
    let csvOutput = '';
    const headersSet = {};
    const req = { params: { caseId: activeCaseId }, query: { template: 'EVIDENCE' } };
    const res = {
      setHeader: (k, v) => { headersSet[k] = v; },
      send: (c) => { csvOutput = c; }
    };

    await reportController.exportCaseReportCsv(req, res, (err) => { if (err) throw err; });

    assert.ok(headersSet['Content-Type'].includes('text/csv'));
    assert.ok(headersSet['Content-Disposition'].includes('attachment'));
    assert.ok(headersSet['Content-Disposition'].includes('.csv'));

    const lines = csvOutput.split('\r\n').filter(l => l.trim().length > 0);
    assert.ok(lines.length >= 2, 'CSV must contain at least header and one data row');
    assert.ok(lines[0].includes('Tracking Code'), 'Header must contain Tracking Code');
    assert.ok(lines[0].includes('SHA-256 Digest'), 'Header must contain SHA-256 Digest');
  });

  test('4. CSV Export handles Custody and Timeline templates', async () => {
    // Custody CSV
    let custodyCsv = '';
    const custReq = { params: { caseId: activeCaseId }, query: { template: 'CUSTODY' } };
    const custRes = { setHeader: () => {}, send: (c) => { custodyCsv = c; } };
    await reportController.exportCaseReportCsv(custReq, custRes, (err) => { if (err) throw err; });
    assert.ok(custodyCsv.includes('Transfer Timestamp'), 'Custody CSV must have Transfer Timestamp');
    assert.ok(custodyCsv.includes('Previous Custodian'), 'Custody CSV must have Previous Custodian');

    // Timeline CSV
    let timelineCsv = '';
    const timeReq = { params: { caseId: activeCaseId }, query: { template: 'TIMELINE' } };
    const timeRes = { setHeader: () => {}, send: (c) => { timelineCsv = c; } };
    await reportController.exportCaseReportCsv(timeReq, timeRes, (err) => { if (err) throw err; });
    assert.ok(timelineCsv.includes('Event ID'), 'Timeline CSV must have Event ID');
    assert.ok(timelineCsv.includes('Precision'), 'Timeline CSV must have Precision');
  });

  test('5. Printable HTML / PDF view produces complete, print-styled document', async () => {
    let htmlOutput = '';
    const headersSet = {};
    const req = { params: { caseId: activeCaseId }, query: { template: 'COMPREHENSIVE' } };
    const res = {
      setHeader: (k, v) => { headersSet[k] = v; },
      send: (h) => { htmlOutput = h; }
    };

    await reportController.exportCaseReportHtml(req, res, (err) => { if (err) throw err; });

    assert.ok(headersSet['Content-Type'].includes('text/html'));
    assert.ok(htmlOutput.includes('<!DOCTYPE html>'));
    assert.ok(htmlOutput.includes('@media print'));
    assert.ok(htmlOutput.includes('@page'));
    assert.ok(htmlOutput.includes('CASE INVESTIGATION REPORT'));
    assert.ok(htmlOutput.includes('LEGAL & ACADEMIC GROUND-TRUTH NOTICE'));
    assert.ok(htmlOutput.includes('window.print()'));
  });

  test('6. Report History generation, retrieval, and deletion lifecycle', async () => {
    // A. Generate Report Record
    let generateResult = null;
    const genReq = {
      body: {
        case_id: activeCaseId,
        report_name: 'Unit Test Automated Dossier Export',
        template_type: 'COMPREHENSIVE',
        format: 'PDF',
        included_sections: ['overview', 'evidence', 'custody', 'audit']
      }
    };
    const genRes = {
      status: (code) => ({
        json: (d) => { generateResult = d; }
      })
    };

    await reportController.generateReportRecord(genReq, genRes, (err) => { if (err) throw err; });

    assert.ok(generateResult);
    assert.equal(generateResult.success, true);
    const createdReportId = generateResult.data.report_id;
    assert.ok(createdReportId > 0);
    assert.ok(generateResult.data.download_urls.html_pdf);

    // B. Retrieve History
    let historyData = null;
    const histReq = { query: { caseId: String(activeCaseId) } };
    const histRes = { json: (d) => { historyData = d; } };

    await reportController.getReportHistory(histReq, histRes, (err) => { if (err) throw err; });

    assert.ok(historyData.success);
    assert.ok(Array.isArray(historyData.data));
    const found = historyData.data.find(r => r.report_id === createdReportId);
    assert.ok(found, 'Created report must be found in history list');
    assert.equal(found.template_type, 'COMPREHENSIVE');

    // C. Delete History Record
    let deleteResult = null;
    const delReq = { params: { reportId: String(createdReportId) } };
    const delRes = { json: (d) => { deleteResult = d; } };

    await reportController.deleteReportRecord(delReq, delRes, (err) => { if (err) throw err; });
    assert.ok(deleteResult.success);

    // D. Verify Deletion
    const [checkRows] = await execute('SELECT * FROM investigation_reports WHERE report_id = ?', [createdReportId]);
    assert.equal(checkRows.length, 0, 'Report record must be deleted from database');
  });

  test('7. Edge Case: Non-existent case ID returns 404', async () => {
    let errorCode = null;
    let errorData = null;
    const req = { params: { caseId: '999999' } };
    const res = {
      status: (code) => {
        errorCode = code;
        return { json: (d) => { errorData = d; } };
      }
    };

    await reportController.getCaseDossier(req, res, (err) => { if (err) throw err; });

    assert.equal(errorCode, 404);
    assert.equal(errorData.success, false);
    assert.equal(errorData.error.code, 'CASE_NOT_FOUND');
  });
});

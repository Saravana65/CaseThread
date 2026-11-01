/**
 * @file collaboration.test.js
 * @brief Automated test suite for Phase 10:
 * Multi-Officer Collaboration, Case Access, Investigation Task Lifecycle & DAG Dependencies,
 * Evidence Review Queue, Activity Timeline, Internal Notifications, and Workflow Analytics.
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
process.env.USE_MEMORY_STORE = 'true';
process.env.JWT_SECRET = 'casethread_collab_test_jwt_secret_key_2026!';

const app = require('../server');

let server;
let baseUrl;
let leadToken;
let investigatorToken;
let readOnlyToken;
let unauthorizedToken;

before(async () => {
  // Issue JWT tokens for various case collaboration roles
  leadToken = jwt.sign(
    { officer_id: 1, badge_number: 'DET-8841', role: 'LEAD_OFFICER', full_name: 'Det. Alexander Cross' },
    process.env.JWT_SECRET,
    { expiresIn: '2h' }
  );

  investigatorToken = jwt.sign(
    { officer_id: 2, badge_number: 'DET-9912', role: 'INVESTIGATOR', full_name: 'Det. Sarah Lin' },
    process.env.JWT_SECRET,
    { expiresIn: '2h' }
  );

  readOnlyToken = jwt.sign(
    { officer_id: 6, badge_number: 'OBS-5509', role: 'INVESTIGATOR', full_name: 'Rachel Green' },
    process.env.JWT_SECRET,
    { expiresIn: '2h' }
  );

  unauthorizedToken = jwt.sign(
    { officer_id: 99, badge_number: 'UNAUTH-99', role: 'INVESTIGATOR', full_name: 'Officer Outsider' },
    process.env.JWT_SECRET,
    { expiresIn: '2h' }
  );

  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}/api/v1`;
      resolve();
    });
  });
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

describe('CASETHREAD Phase 10 - Multi-Officer Collaboration & Investigation Management', () => {

  // ----------------------------------------------------------------------------
  // STAGE 1: Case Membership & Controlled Access
  // ----------------------------------------------------------------------------

  test('1. Retrieves active case members with joined officer profiles', async () => {
    const res = await fetch(`${baseUrl}/cases/1/members`, {
      headers: { Authorization: `Bearer ${leadToken}` }
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length >= 2);

    const leadMember = body.data.find(m => m.officer_id === 1);
    assert.ok(leadMember);
    assert.strictEqual(leadMember.role, 'LEAD_INVESTIGATOR');
    assert.ok(leadMember.full_name);
    assert.ok(leadMember.badge_number);
  });

  test('2. Lead investigator assigns an authorized officer to the case', async () => {
    const res = await fetch(`${baseUrl}/cases/1/members`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${leadToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        officer_id: 7,
        role: 'INVESTIGATING_OFFICER'
      })
    });
    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.officer_id, 7);
    assert.strictEqual(body.data.role, 'INVESTIGATING_OFFICER');
  });

  test('3. Rejects assigning an already active case member (duplicate prevention)', async () => {
    const res = await fetch(`${baseUrl}/cases/1/members`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${leadToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        officer_id: 2, // Officer 2 is already active
        role: 'INVESTIGATING_OFFICER'
      })
    });
    assert.strictEqual(res.status, 409);
    const body = await res.json();
    assert.strictEqual(body.success, false);
  });

  test('4. Revokes case access when an officer is removed and records audit reason', async () => {
    // Remove officer 7 added in test 2
    const listRes = await fetch(`${baseUrl}/cases/1/members`, {
      headers: { Authorization: `Bearer ${leadToken}` }
    });
    const listBody = await listRes.json();
    const targetMember = listBody.data.find(m => m.officer_id === 7);
    assert.ok(targetMember);

    const delRes = await fetch(`${baseUrl}/cases/1/members/${targetMember.member_id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${leadToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        reason: 'Reassigned to Special Operations Division'
      })
    });
    assert.strictEqual(delRes.status, 200);
    const delBody = await delRes.json();
    assert.strictEqual(delBody.success, true);
  });

  test('5. Enforces role restrictions: READ_ONLY_REVIEWER is rejected with 403 on write operation', async () => {
    const res = await fetch(`${baseUrl}/cases/1/tasks`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${readOnlyToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: 'Unauthorized Task by Observer',
        priority: 'HIGH'
      })
    });
    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.success, false);
  });

  test('6. Transfers case primary leadership with audit logging and notification', async () => {
    const res = await fetch(`${baseUrl}/cases/1/transfer-leadership`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${leadToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        new_lead_officer_id: 2,
        reason: 'Senior Command assignment change'
      })
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.lead_officer_id, 2);

    // Transfer back to Officer 1 for remaining test consistency
    await fetch(`${baseUrl}/cases/1/transfer-leadership`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${leadToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ new_lead_officer_id: 1 })
    });
  });

  // ----------------------------------------------------------------------------
  // STAGE 2: Investigation Task Lifecycle Management
  // ----------------------------------------------------------------------------

  let createdTaskId;

  test('7. Creates a new investigation task with priority, due date, and linked evidence', async () => {
    const res = await fetch(`${baseUrl}/cases/1/tasks`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${leadToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: 'Interrogate Vehicle Owner Damon Vance',
        description: 'Conduct formal deposition regarding movements of black sedan 7XYZ99 on breach night.',
        priority: 'HIGH',
        assigned_officer_id: 2,
        due_date: '2026-10-25 14:00:00',
        related_evidence_ids: [3, 5],
        related_entity_ids: [{ type: 'SUSPECT', id: 2 }]
      })
    });
    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.task_id);
    assert.strictEqual(body.data.priority, 'HIGH');
    assert.strictEqual(body.data.version, 1);
    createdTaskId = body.data.task_id;
  });

  test('8. Reassigns task to another authorized case member with audit event', async () => {
    const res = await fetch(`${baseUrl}/tasks/${createdTaskId}/assign`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${leadToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        assigned_officer_id: 3,
        reason: 'Shift rotation'
      })
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.assigned_officer_id, 3);
  });

  test('9. Appends a progress note to an investigation task', async () => {
    const res = await fetch(`${baseUrl}/tasks/${createdTaskId}/notes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${investigatorToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        note_text: 'Subpoena served on legal counsel. Deposition scheduled for Thursday 10:00 AM.'
      })
    });
    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.note_id);
  });

  test('10. Retrieves task by ID with notes and dependencies', async () => {
    const res = await fetch(`${baseUrl}/tasks/${createdTaskId}`, {
      headers: { Authorization: `Bearer ${leadToken}` }
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.task_id, createdTaskId);
    assert.ok(Array.isArray(body.data.notes));
    assert.strictEqual(body.data.notes.length, 1);
    assert.ok(body.data.dependencies);
  });

  // ----------------------------------------------------------------------------
  // STAGE 3: Task Dependencies DAG & Cycle Detection
  // ----------------------------------------------------------------------------

  let depTaskA, depTaskB, depTaskC;

  test('11. Creates dependent workflow tasks (Task C depends on B, B depends on A)', async () => {
    // Create Task A
    const resA = await fetch(`${baseUrl}/cases/1/tasks`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${leadToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Obtain Port Surveillance Tape', priority: 'NORMAL' })
    });
    const bodyA = await resA.json();
    depTaskA = bodyA.data.task_id;

    // Create Task B
    const resB = await fetch(`${baseUrl}/cases/1/tasks`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${leadToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Extract Timestamp Markers', priority: 'NORMAL' })
    });
    const bodyB = await resB.json();
    depTaskB = bodyB.data.task_id;

    // Create Task C
    const resC = await fetch(`${baseUrl}/cases/1/tasks`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${leadToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Compare Port Tape with Witness Timeline', priority: 'HIGH' })
    });
    const bodyC = await resC.json();
    depTaskC = bodyC.data.task_id;

    // Add dependency: B depends on A
    const linkB = await fetch(`${baseUrl}/tasks/${depTaskB}/dependencies`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${leadToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ depends_on_task_id: depTaskA })
    });
    assert.strictEqual(linkB.status, 201);

    // Add dependency: C depends on B
    const linkC = await fetch(`${baseUrl}/tasks/${depTaskC}/dependencies`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${leadToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ depends_on_task_id: depTaskB })
    });
    assert.strictEqual(linkC.status, 201);
  });

  test('12. Rejects circular task dependency (A depending on C) with 400 CIRCULAR_DEPENDENCY_DETECTED', async () => {
    // Attempting to make Task A depend on Task C creates a cycle: A -> C -> B -> A
    const res = await fetch(`${baseUrl}/tasks/${depTaskA}/dependencies`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${leadToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ depends_on_task_id: depTaskC })
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'CIRCULAR_DEPENDENCY_DETECTED');
  });

  test('13. Prevents task completion when mandatory dependencies are incomplete', async () => {
    // Task C depends on B (incomplete)
    const res = await fetch(`${baseUrl}/tasks/${depTaskC}/complete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${leadToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ completion_notes: 'Attempting completion before prerequisites.' })
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'TASK_DEPENDENCIES_UNMET');
    assert.ok(Array.isArray(body.error.unmet_dependencies));
  });

  test('14. Allows task completion once prerequisite dependencies are completed', async () => {
    // Complete A first
    await fetch(`${baseUrl}/tasks/${depTaskA}/complete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${leadToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ completion_notes: 'Tape obtained.' })
    });

    // Complete B
    await fetch(`${baseUrl}/tasks/${depTaskB}/complete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${leadToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ completion_notes: 'Markers extracted.' })
    });

    // Now Task C can be completed
    const resC = await fetch(`${baseUrl}/tasks/${depTaskC}/complete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${leadToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ completion_notes: 'Comparison successfully finished.' })
    });
    assert.strictEqual(resC.status, 200);
    const bodyC = await resC.json();
    assert.strictEqual(bodyC.success, true);
    assert.strictEqual(bodyC.data.status, 'COMPLETED');
  });

  // ----------------------------------------------------------------------------
  // STAGE 4: Concurrency & Optimistic Locking
  // ----------------------------------------------------------------------------

  test('15. Rejects concurrent modification with 409 Conflict when version mismatches', async () => {
    // Fetch current version of task
    const fetchRes = await fetch(`${baseUrl}/tasks/${createdTaskId}`, {
      headers: { Authorization: `Bearer ${leadToken}` }
    });
    const fetchBody = await fetchRes.json();
    const currentVersion = fetchBody.data.version;

    // Simulate stale update with wrong version
    const staleRes = await fetch(`${baseUrl}/tasks/${createdTaskId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${leadToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Conflicting Edit',
        version: currentVersion - 1 // Stale version
      })
    });
    assert.strictEqual(staleRes.status, 409);
    const staleBody = await staleRes.json();
    assert.strictEqual(staleBody.error.code, 'CONCURRENT_MODIFICATION_DETECTED');
  });

  // ----------------------------------------------------------------------------
  // STAGE 5: Evidence Review Assignments & Queue
  // ----------------------------------------------------------------------------

  let createdReviewId;

  test('16. Requests an evidence review assignment', async () => {
    const res = await fetch(`${baseUrl}/evidence/2/reviews`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${leadToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assigned_reviewer_id: 5, // James Vance (EVIDENCE_REVIEWER)
        review_notes: 'Verify cell tower calibration azimuth and carrier antenna records.',
        related_task_id: 1
      })
    });
    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.review_id);
    assert.strictEqual(body.data.review_status, 'PENDING_REVIEW');
    createdReviewId = body.data.review_id;
  });

  test('17. Submits review findings preserving original evidence SHA-256 fingerprint', async () => {
    const reviewerToken = jwt.sign(
      { officer_id: 5, badge_number: 'REV-4412', role: 'SENIOR_DETECTIVE' },
      process.env.JWT_SECRET
    );

    const res = await fetch(`${baseUrl}/reviews/${createdReviewId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${reviewerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        review_status: 'VERIFIED',
        reviewer_observations: 'Tower azimuth corresponds exactly with loading dock coordinates.',
        integrity_verification_status: 'VERIFIED',
        metadata_review_status: 'APPROVED',
        review_notes: 'Independent technical calibration verified.'
      })
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.review_status, 'VERIFIED');
  });

  // ----------------------------------------------------------------------------
  // STAGE 6: Activity History & Timeline
  // ----------------------------------------------------------------------------

  test('18. Retrieves chronological investigation activity timeline', async () => {
    const res = await fetch(`${baseUrl}/cases/1/activity`, {
      headers: { Authorization: `Bearer ${leadToken}` }
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data.events));
    assert.ok(body.data.total_events >= 5);

    // Verify ordering
    const events = body.data.events;
    for (let i = 0; i < events.length - 1; i++) {
      assert.ok(new Date(events[i].created_at) >= new Date(events[i + 1].created_at));
    }
  });

  // ----------------------------------------------------------------------------
  // STAGE 7: Internal Notification System
  // ----------------------------------------------------------------------------

  test('19. Retrieves officer notifications and manages read status', async () => {
    const res = await fetch(`${baseUrl}/notifications`, {
      headers: { Authorization: `Bearer ${investigatorToken}` }
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data.notifications));
    assert.ok(body.data.notifications.length >= 1);

    // Mark single notification read
    const firstNotif = body.data.notifications[0];
    const markRes = await fetch(`${baseUrl}/notifications/${firstNotif.notification_id}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${investigatorToken}` }
    });
    assert.strictEqual(markRes.status, 200);

    // Mark all read
    const allRes = await fetch(`${baseUrl}/notifications/read-all`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${investigatorToken}` }
    });
    assert.strictEqual(allRes.status, 200);
  });

  // ----------------------------------------------------------------------------
  // STAGE 8: Multi-Tenant Case Isolation & Security
  // ----------------------------------------------------------------------------

  test('20. Cross-Case Isolation: Rejects unassigned officer access with 403 Forbidden', async () => {
    // Tasks
    const tasksRes = await fetch(`${baseUrl}/cases/1/tasks`, {
      headers: { Authorization: `Bearer ${unauthorizedToken}` }
    });
    assert.strictEqual(tasksRes.status, 403);

    // Members
    const membersRes = await fetch(`${baseUrl}/cases/1/members`, {
      headers: { Authorization: `Bearer ${unauthorizedToken}` }
    });
    assert.strictEqual(membersRes.status, 403);

    // Reviews
    const reviewsRes = await fetch(`${baseUrl}/cases/1/reviews`, {
      headers: { Authorization: `Bearer ${unauthorizedToken}` }
    });
    assert.strictEqual(reviewsRes.status, 403);
  });

  // ----------------------------------------------------------------------------
  // STAGE 9: Workflow & Case Workload Analytics
  // ----------------------------------------------------------------------------

  test('21. Computes case operational analytics from real database records', async () => {
    const res = await fetch(`${baseUrl}/cases/1/workflow-analytics`, {
      headers: { Authorization: `Bearer ${leadToken}` }
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    const metrics = body.data;

    assert.strictEqual(metrics.case_id, 1);
    assert.ok(metrics.total_assigned_officers >= 2);
    assert.ok(metrics.total_tasks >= 5);
    assert.ok(typeof metrics.task_completion_percentage === 'number');
    assert.ok(metrics.task_completion_percentage >= 0 && metrics.task_completion_percentage <= 100);
    assert.ok(typeof metrics.tasks_by_priority === 'object');
    assert.ok(typeof metrics.tasks_by_status === 'object');
  });

});

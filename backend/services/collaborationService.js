/**
 * @file collaborationService.js
 * @description Domain logic for multi-officer case access, task dependency cycle detection (DAG),
 * evidence review workflows, activity logging, notification dispatch, and workflow analytics.
 */

const { execute } = require('../database/connection');

// Role-Based Case Permissions Matrix
const ROLE_PERMISSIONS = {
  LEAD_INVESTIGATOR: [
    'manage_members',
    'transfer_leadership',
    'create_task',
    'assign_task',
    'update_task',
    'complete_task',
    'delete_task',
    'request_review',
    'submit_review',
    'view_case',
    'edit_case'
  ],
  INVESTIGATING_OFFICER: [
    'create_task',
    'assign_task',
    'update_task',
    'complete_task',
    'request_review',
    'view_case'
  ],
  FORENSIC_ANALYST: [
    'update_task',
    'submit_review',
    'view_case',
    'request_review'
  ],
  EVIDENCE_REVIEWER: [
    'submit_review',
    'view_case'
  ],
  READ_ONLY_REVIEWER: [
    'view_case'
  ]
};

/**
 * Validates officer case access permissions and checks role capabilities.
 * @param {number} caseId Case primary key
 * @param {object} officer Decoded JWT officer object
 * @param {string} [requiredPermission] Optional required permission string
 * @returns {Promise<{ authorized: boolean, status?: number, error?: string, role?: string, member?: object }>}
 */
async function verifyCaseAccess(caseId, officer, requiredPermission = null) {
  if (!officer) {
    return { authorized: false, status: 401, error: 'Authentication token required.' };
  }

  // Global ADMIN role bypasses case-specific constraints
  if (officer.role === 'ADMIN') {
    return { authorized: true, role: 'LEAD_INVESTIGATOR' };
  }

  const numericCaseId = parseInt(caseId, 10);
  const [cases] = await execute('SELECT case_id, lead_officer_id FROM cases WHERE case_id = ?', [numericCaseId]);
  if (!cases || cases.length === 0) {
    return { authorized: false, status: 404, error: `Case ID ${caseId} does not exist.` };
  }

  const currentCase = cases[0];

  // Lead Officer of the case file is granted LEAD_INVESTIGATOR privileges
  if (currentCase.lead_officer_id === officer.officer_id) {
    return { authorized: true, role: 'LEAD_INVESTIGATOR' };
  }

  // Check normalized case_members table
  const [members] = await execute(
    'SELECT * FROM case_members WHERE case_id = ? AND officer_id = ? AND is_active = 1',
    [numericCaseId, officer.officer_id]
  );

  if (!members || members.length === 0) {
    return {
      authorized: false,
      status: 403,
      error: 'Access denied: You are not an authorized member of this investigation case file.'
    };
  }

  const member = members[0];
  const role = member.role || 'INVESTIGATING_OFFICER';

  if (requiredPermission) {
    const allowed = ROLE_PERMISSIONS[role] || [];
    if (!allowed.includes(requiredPermission)) {
      return {
        authorized: false,
        status: 403,
        error: `Investigator case role '${role}' lacks permission for '${requiredPermission}'.`
      };
    }
  }

  return { authorized: true, role, member };
}

/**
 * Cycle Detection in Task Dependency Graph using Directed Graph Traversal (BFS/DFS).
 * In our DAG model, an edge (dependentTaskId -> prerequisiteTaskId) indicates
 * that dependentTaskId depends on prerequisiteTaskId.
 * Adding an edge (D -> P) creates a directed cycle if and only if P already depends on D (P ~> D).
 *
 * @param {number} caseId Case ID
 * @param {number} dependentTaskId Task that will depend on prerequisite
 * @param {number} prerequisiteTaskId Prerequisite task
 * @returns {Promise<boolean>} True if adding dependency creates a cycle, false otherwise
 */
async function detectCycle(caseId, dependentTaskId, prerequisiteTaskId) {
  const dId = parseInt(dependentTaskId, 10);
  const pId = parseInt(prerequisiteTaskId, 10);

  // Self-dependency is an immediate cycle
  if (dId === pId) return true;

  // Retrieve all existing dependencies in this case
  const [rows] = await execute(
    `SELECT d.task_id, d.depends_on_task_id 
     FROM investigation_task_dependencies d 
     JOIN investigation_tasks t ON d.task_id = t.task_id 
     WHERE t.case_id = ?`,
    [caseId]
  );

  // Build adjacency list: node -> array of nodes it depends on
  const adj = new Map();
  for (const row of rows) {
    if (!adj.has(row.task_id)) adj.set(row.task_id, []);
    adj.get(row.task_id).push(row.depends_on_task_id);
  }

  // Check if there is already a path from prerequisiteTaskId to dependentTaskId
  const visited = new Set();
  const queue = [pId];
  visited.add(pId);

  while (queue.length > 0) {
    const curr = queue.shift();
    if (curr === dId) {
      return true; // Cycle detected!
    }

    const neighbors = adj.get(curr) || [];
    for (const next of neighbors) {
      if (next === dId) {
        return true; // Cycle detected!
      }
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }

  return false;
}

/**
 * Validates whether a task's prerequisite dependencies are all COMPLETED.
 * @param {number} taskId Task ID to check
 * @returns {Promise<{ canComplete: boolean, unmetDependencies: Array }>}
 */
async function canCompleteTask(taskId) {
  const numericId = parseInt(taskId, 10);
  const [prereqs] = await execute(
    `SELECT d.depends_on_task_id, t.title, t.status, t.priority 
     FROM investigation_task_dependencies d 
     JOIN investigation_tasks t ON d.depends_on_task_id = t.task_id 
     WHERE d.task_id = ?`,
    [numericId]
  );

  const unmet = prereqs.filter(p => p.status !== 'COMPLETED');
  return {
    canComplete: unmet.length === 0,
    unmetDependencies: unmet
  };
}

/**
 * Fetches the dependency chain (prerequisites and dependents) for a given task.
 * @param {number} taskId
 * @returns {Promise<{ prerequisites: Array, dependents: Array }>}
 */
async function getTaskDependencyChain(taskId) {
  const numericId = parseInt(taskId, 10);

  // Prerequisites: tasks this task depends on
  const [prerequisites] = await execute(
    `SELECT d.dependency_id, d.depends_on_task_id, t.title, t.status, t.priority, t.due_date 
     FROM investigation_task_dependencies d 
     JOIN investigation_tasks t ON d.depends_on_task_id = t.task_id 
     WHERE d.task_id = ?`,
    [numericId]
  );

  // Dependents: tasks that depend on this task
  const [dependents] = await execute(
    `SELECT d.dependency_id, d.task_id, t.title, t.status, t.priority, t.due_date 
     FROM investigation_task_dependencies d 
     JOIN investigation_tasks t ON d.task_id = t.task_id 
     WHERE d.depends_on_task_id = ?`,
    [numericId]
  );

  return { prerequisites, dependents };
}

/**
 * Logs an event to the unified case activity ledger.
 * @param {number} caseId Case ID
 * @param {number} actorId Officer who performed the action
 * @param {string} eventType Event classification ENUM
 * @param {string|number} relatedRecordId Primary key of related record
 * @param {object} previousState Previous state snapshot
 * @param {object} newState New state snapshot
 * @param {string} description Human-readable description
 */
async function logCaseActivity(caseId, actorId, eventType, relatedRecordId, previousState, newState, description) {
  try {
    const prevJson = previousState ? JSON.stringify(previousState) : null;
    const nextJson = newState ? JSON.stringify(newState) : null;
    await execute(
      `INSERT INTO case_activity_logs (case_id, actor_id, event_type, related_record_id, previous_state, new_state, event_description)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [caseId, actorId, eventType, String(relatedRecordId || ''), prevJson, nextJson, description]
    );
  } catch (err) {
    console.error('[COLLABORATION SERVICE] Failed to record activity log:', err.message);
  }
}

/**
 * Dispatches an internal notification to an officer with deduplication protection.
 * @param {number} officerId Target officer
 * @param {number} caseId Case ID
 * @param {string} eventType Notification category
 * @param {string} title Short header
 * @param {string} message Descriptive text
 * @param {string} referenceType Related entity type (e.g. TASK, EVIDENCE_REVIEW)
 * @param {string|number} referenceId Related ID
 * @param {string} [dedupKey] Unique deduplication key
 */
async function createNotification(officerId, caseId, eventType, title, message, referenceType, referenceId, dedupKey = null) {
  try {
    const key = dedupKey || `${eventType}:${referenceType || 'REF'}:${referenceId || '0'}:${officerId}`;
    await execute(
      `INSERT INTO officer_notifications (officer_id, case_id, event_type, title, message, reference_type, reference_id, dedup_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE created_at = CURRENT_TIMESTAMP`,
      [officerId, caseId || null, eventType, title, message, referenceType || null, String(referenceId || ''), key]
    );
  } catch (err) {
    console.error('[COLLABORATION SERVICE] Failed to create notification:', err.message);
  }
}

/**
 * Calculates operational workflow analytics from actual database records.
 * @param {number} caseId Case ID
 * @returns {Promise<object>} Computed case operational metrics
 */
async function calculateWorkflowAnalytics(caseId) {
  const numericId = parseInt(caseId, 10);

  // 1. Members
  const [members] = await execute(
    'SELECT member_id, role FROM case_members WHERE case_id = ? AND is_active = 1',
    [numericId]
  );

  // 2. Tasks
  const [tasks] = await execute(
    'SELECT task_id, priority, status, due_date, created_at, completed_at FROM investigation_tasks WHERE case_id = ?',
    [numericId]
  );

  // 3. Evidence Reviews
  const [reviews] = await execute(
    'SELECT review_id, review_status, integrity_verification_status FROM evidence_reviews WHERE case_id = ?',
    [numericId]
  );

  const now = new Date();
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'COMPLETED').length;
  const activeTasks = tasks.filter(t => ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'UNDER_REVIEW'].includes(t.status)).length;
  const blockedTasks = tasks.filter(t => t.status === 'BLOCKED').length;

  const overdueTasks = tasks.filter(t => {
    if (t.status === 'COMPLETED' || t.status === 'CANCELLED') return false;
    if (!t.due_date) return false;
    return new Date(t.due_date) < now;
  }).length;

  const pendingReviews = reviews.filter(r => ['PENDING_REVIEW', 'UNDER_REVIEW'].includes(r.review_status)).length;
  const completedReviews = reviews.filter(r => ['VERIFIED', 'REQUIRES_CLARIFICATION', 'FLAGGED_FOR_RECHECK'].includes(r.review_status)).length;

  const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 1000) / 10 : 0.0;

  // Average task completion time in hours
  let totalCompletionHours = 0;
  let timedTasksCount = 0;
  for (const t of tasks) {
    if (t.status === 'COMPLETED' && t.completed_at && t.created_at) {
      const diffMs = new Date(t.completed_at) - new Date(t.created_at);
      if (diffMs > 0) {
        totalCompletionHours += diffMs / (1000 * 60 * 60);
        timedTasksCount++;
      }
    }
  }
  const avgCompletionTimeHours = timedTasksCount > 0 ? Math.round((totalCompletionHours / timedTasksCount) * 10) / 10 : 0.0;

  // Breakdown by priority
  const tasksByPriority = {
    LOW: tasks.filter(t => t.priority === 'LOW').length,
    NORMAL: tasks.filter(t => t.priority === 'NORMAL').length,
    HIGH: tasks.filter(t => t.priority === 'HIGH').length,
    CRITICAL: tasks.filter(t => t.priority === 'CRITICAL').length
  };

  // Breakdown by status
  const tasksByStatus = {
    OPEN: tasks.filter(t => t.status === 'OPEN').length,
    ASSIGNED: tasks.filter(t => t.status === 'ASSIGNED').length,
    IN_PROGRESS: tasks.filter(t => t.status === 'IN_PROGRESS').length,
    UNDER_REVIEW: tasks.filter(t => t.status === 'UNDER_REVIEW').length,
    COMPLETED: completedTasks,
    BLOCKED: blockedTasks,
    CANCELLED: tasks.filter(t => t.status === 'CANCELLED').length
  };

  return {
    case_id: numericId,
    total_assigned_officers: members.length,
    total_tasks: totalTasks,
    active_tasks: activeTasks,
    completed_tasks: completedTasks,
    overdue_tasks: overdueTasks,
    blocked_tasks: blockedTasks,
    pending_evidence_reviews: pendingReviews,
    completed_evidence_reviews: completedReviews,
    task_completion_percentage: completionPercentage,
    avg_task_completion_time_hours: avgCompletionTimeHours,
    tasks_by_priority: tasksByPriority,
    tasks_by_status: tasksByStatus
  };
}

module.exports = {
  ROLE_PERMISSIONS,
  verifyCaseAccess,
  detectCycle,
  canCompleteTask,
  getTaskDependencyChain,
  logCaseActivity,
  createNotification,
  calculateWorkflowAnalytics
};

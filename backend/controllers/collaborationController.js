/**
 * @file collaborationController.js
 * @description Controller handling multi-officer case collaboration, investigation task lifecycle,
 * task dependencies DAG, evidence reviews, activity logs, notifications, and workflow analytics.
 */

const { execute } = require('../database/connection');
const collaborationService = require('../services/collaborationService');

// ==============================================================================
// 1. CASE COLLABORATION & MEMBERSHIP
// ==============================================================================

/**
 * Lists all active members assigned to a case.
 * GET /api/v1/cases/:caseId/members
 */
exports.getCaseMembers = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.caseId, 10);
    const access = await collaborationService.verifyCaseAccess(caseId, req.officer, 'view_case');
    if (!access.authorized) {
      return res.status(access.status || 403).json({ success: false, error: { message: access.error } });
    }

    const [members] = await execute(
      `SELECT cm.member_id, cm.case_id, cm.officer_id, cm.role, cm.assigned_by_officer_id,
              cm.is_active, cm.permissions, cm.assigned_at, cm.revoked_at,
              o.full_name, o.badge_number, o.rank_designation, o.department, o.email
       FROM case_members cm
       JOIN officers o ON cm.officer_id = o.officer_id
       WHERE cm.case_id = ? AND cm.is_active = 1
       ORDER BY cm.assigned_at ASC`,
      [caseId]
    );

    res.json({ success: true, data: members });
  } catch (error) {
    next(error);
  }
};

/**
 * Invites or assigns an authorized officer to a case.
 * POST /api/v1/cases/:caseId/members
 */
exports.addCaseMember = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.caseId, 10);
    const access = await collaborationService.verifyCaseAccess(caseId, req.officer, 'manage_members');
    if (!access.authorized) {
      return res.status(access.status || 403).json({ success: false, error: { message: access.error } });
    }

    const { officer_id, role, permissions } = req.body;
    if (!officer_id) {
      return res.status(400).json({ success: false, error: { message: 'officer_id is required.' } });
    }

    const validRoles = ['LEAD_INVESTIGATOR', 'INVESTIGATING_OFFICER', 'FORENSIC_ANALYST', 'EVIDENCE_REVIEWER', 'READ_ONLY_REVIEWER'];
    const memberRole = role && validRoles.includes(role) ? role : 'INVESTIGATING_OFFICER';

    // Verify target officer exists
    const [officers] = await execute('SELECT officer_id, full_name, badge_number FROM officers WHERE officer_id = ?', [officer_id]);
    if (!officers || officers.length === 0) {
      return res.status(404).json({ success: false, error: { message: `Officer ID ${officer_id} does not exist.` } });
    }

    // Check if already an active member
    const [existing] = await execute(
      'SELECT member_id FROM case_members WHERE case_id = ? AND officer_id = ? AND is_active = 1',
      [caseId, officer_id]
    );
    if (existing && existing.length > 0) {
      return res.status(409).json({ success: false, error: { message: 'Officer is already an active member of this case file.' } });
    }

    const assignedBy = req.officer.officer_id;
    const [result] = await execute(
      `INSERT INTO case_members (case_id, officer_id, role, assigned_by_officer_id, permissions)
       VALUES (?, ?, ?, ?, ?)`,
      [caseId, officer_id, memberRole, assignedBy, permissions ? JSON.stringify(permissions) : null]
    );

    // Log Activity
    await collaborationService.logCaseActivity(
      caseId,
      assignedBy,
      'OFFICER_ASSIGNED',
      result.insertId,
      null,
      { officer_id, role: memberRole },
      `Officer ${officers[0].full_name} (${officers[0].badge_number}) assigned to case as ${memberRole}.`
    );

    // Notify Officer
    await collaborationService.createNotification(
      officer_id,
      caseId,
      'CASE_ACCESS_GRANTED',
      'Assigned to Investigation Case File',
      `You have been granted '${memberRole}' access to Case #${caseId}.`,
      'CASE_MEMBER',
      result.insertId
    );

    res.status(201).json({
      success: true,
      data: {
        member_id: result.insertId,
        case_id: caseId,
        officer_id,
        role: memberRole,
        full_name: officers[0].full_name,
        badge_number: officers[0].badge_number
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Updates a member's role or permissions.
 * PATCH /api/v1/cases/:caseId/members/:memberId
 */
exports.updateCaseMember = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.caseId, 10);
    const memberId = parseInt(req.params.memberId, 10);
    const access = await collaborationService.verifyCaseAccess(caseId, req.officer, 'manage_members');
    if (!access.authorized) {
      return res.status(access.status || 403).json({ success: false, error: { message: access.error } });
    }

    const { role, permissions } = req.body;
    const [members] = await execute('SELECT * FROM case_members WHERE member_id = ? AND case_id = ? AND is_active = 1', [memberId, caseId]);
    if (!members || members.length === 0) {
      return res.status(404).json({ success: false, error: { message: `Member ID ${memberId} not found in this case.` } });
    }

    const prev = members[0];
    const newRole = role || prev.role;
    const newPerms = permissions !== undefined ? JSON.stringify(permissions) : prev.permissions;

    await execute(
      'UPDATE case_members SET role = ?, permissions = ? WHERE member_id = ?',
      [newRole, newPerms, memberId]
    );

    await collaborationService.logCaseActivity(
      caseId,
      req.officer.officer_id,
      'OFFICER_ASSIGNED',
      memberId,
      { role: prev.role },
      { role: newRole },
      `Officer membership role updated from ${prev.role} to ${newRole}.`
    );

    res.json({
      success: true,
      data: { member_id: memberId, role: newRole }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Revokes an officer's access to a case.
 * DELETE /api/v1/cases/:caseId/members/:memberId
 */
exports.removeCaseMember = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.caseId, 10);
    const memberId = parseInt(req.params.memberId, 10);
    const access = await collaborationService.verifyCaseAccess(caseId, req.officer, 'manage_members');
    if (!access.authorized) {
      return res.status(access.status || 403).json({ success: false, error: { message: access.error } });
    }

    const [members] = await execute('SELECT * FROM case_members WHERE member_id = ? AND case_id = ? AND is_active = 1', [memberId, caseId]);
    if (!members || members.length === 0) {
      return res.status(404).json({ success: false, error: { message: `Active member ID ${memberId} not found.` } });
    }

    const member = members[0];
    const reason = req.body.reason || 'Case reassignment / removal by lead investigator';
    const actorId = req.officer.officer_id;

    await execute(
      'UPDATE case_members SET is_active = 0, revoked_by_officer_id = ?, revocation_reason = ? WHERE member_id = ?',
      [actorId, reason, memberId]
    );

    await collaborationService.logCaseActivity(
      caseId,
      actorId,
      'OFFICER_REMOVED',
      memberId,
      { officer_id: member.officer_id, role: member.role },
      { is_active: 0 },
      `Officer ${member.officer_id} removed from case. Reason: ${reason}`
    );

    await collaborationService.createNotification(
      member.officer_id,
      caseId,
      'CASE_ACCESS_REVOKED',
      'Investigation Case Access Revoked',
      `Your access to Case #${caseId} has been revoked. Reason: ${reason}`,
      'CASE_MEMBER',
      memberId
    );

    res.json({
      success: true,
      data: { member_id: memberId, message: 'Case membership successfully revoked.' }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Transfers primary leadership of a case file.
 * POST /api/v1/cases/:caseId/transfer-leadership
 */
exports.transferCaseLeadership = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.caseId, 10);
    const access = await collaborationService.verifyCaseAccess(caseId, req.officer, 'transfer_leadership');
    if (!access.authorized) {
      return res.status(access.status || 403).json({ success: false, error: { message: access.error } });
    }

    const { new_lead_officer_id, reason } = req.body;
    if (!new_lead_officer_id) {
      return res.status(400).json({ success: false, error: { message: 'new_lead_officer_id is required.' } });
    }

    const [cases] = await execute('SELECT lead_officer_id FROM cases WHERE case_id = ?', [caseId]);
    const oldLead = cases[0].lead_officer_id;

    // Update case lead_officer_id
    await execute('UPDATE cases SET lead_officer_id = ? WHERE case_id = ?', [new_lead_officer_id, caseId]);

    // Ensure new lead is active member with LEAD_INVESTIGATOR role
    const [existingMember] = await execute('SELECT member_id FROM case_members WHERE case_id = ? AND officer_id = ? AND is_active = 1', [caseId, new_lead_officer_id]);
    if (existingMember && existingMember.length > 0) {
      await execute('UPDATE case_members SET role = ? WHERE member_id = ?', ['LEAD_INVESTIGATOR', existingMember[0].member_id]);
    } else {
      await execute(
        'INSERT INTO case_members (case_id, officer_id, role, assigned_by_officer_id) VALUES (?, ?, ?, ?)',
        [caseId, new_lead_officer_id, 'LEAD_INVESTIGATOR', req.officer.officer_id]
      );
    }

    // Log Activity
    await collaborationService.logCaseActivity(
      caseId,
      req.officer.officer_id,
      'CASE_LEADERSHIP_TRANSFERRED',
      caseId,
      { lead_officer_id: oldLead },
      { lead_officer_id: new_lead_officer_id },
      `Case primary leadership transferred from Officer ${oldLead} to Officer ${new_lead_officer_id}. Reason: ${reason || 'Command transfer'}`
    );

    // Notify New Lead
    await collaborationService.createNotification(
      new_lead_officer_id,
      caseId,
      'CASE_LEADERSHIP_TRANSFERRED',
      'Case Primary Leadership Transferred',
      `You have been appointed Lead Investigator for Case #${caseId}.`,
      'CASE',
      caseId
    );

    res.json({
      success: true,
      data: { case_id: caseId, lead_officer_id: new_lead_officer_id, message: 'Case leadership transferred successfully.' }
    });
  } catch (error) {
    next(error);
  }
};

// ==============================================================================
// 2. INVESTIGATION TASK MANAGEMENT
// ==============================================================================

/**
 * Lists tasks for a case with filtering.
 * GET /api/v1/cases/:caseId/tasks
 */
exports.getCaseTasks = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.caseId, 10);
    const access = await collaborationService.verifyCaseAccess(caseId, req.officer, 'view_case');
    if (!access.authorized) {
      return res.status(access.status || 403).json({ success: false, error: { message: access.error } });
    }

    const { officer_id, status, priority, overdue } = req.query;
    let sql = `
      SELECT t.*, 
             ao.full_name AS assigned_officer_name, ao.badge_number AS assigned_officer_badge,
             co.full_name AS created_by_officer_name, co.badge_number AS created_by_officer_badge
      FROM investigation_tasks t
      LEFT JOIN officers ao ON t.assigned_officer_id = ao.officer_id
      LEFT JOIN officers co ON t.created_by_officer_id = co.officer_id
      WHERE t.case_id = ?
    `;
    const params = [caseId];

    if (officer_id) {
      sql += ' AND t.assigned_officer_id = ?';
      params.push(parseInt(officer_id, 10));
    }
    if (status) {
      sql += ' AND t.status = ?';
      params.push(status);
    }
    if (priority) {
      sql += ' AND t.priority = ?';
      params.push(priority);
    }

    const [tasks] = await execute(sql, params);

    // Filter overdue in-memory if requested
    let result = tasks;
    if (overdue === 'true') {
      const now = new Date();
      result = tasks.filter(t => t.status !== 'COMPLETED' && t.status !== 'CANCELLED' && t.due_date && new Date(t.due_date) < now);
    }

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * Creates a new investigation task.
 * POST /api/v1/cases/:caseId/tasks
 */
exports.createTask = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.caseId, 10);
    const access = await collaborationService.verifyCaseAccess(caseId, req.officer, 'create_task');
    if (!access.authorized) {
      return res.status(access.status || 403).json({ success: false, error: { message: access.error } });
    }

    const {
      title,
      description,
      assigned_officer_id,
      priority,
      status,
      due_date,
      related_evidence_ids,
      related_entity_ids,
      related_lead_id
    } = req.body;

    if (!title || title.trim().length === 0) {
      return res.status(400).json({ success: false, error: { message: 'Task title is required.' } });
    }

    const createdBy = req.officer.officer_id;
    const taskPriority = priority || 'NORMAL';
    const taskStatus = status || (assigned_officer_id ? 'ASSIGNED' : 'OPEN');

    const [result] = await execute(
      `INSERT INTO investigation_tasks 
       (case_id, title, description, assigned_officer_id, created_by_officer_id, priority, status, due_date, related_evidence_ids, related_entity_ids, related_lead_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        caseId,
        title.trim(),
        description || '',
        assigned_officer_id || null,
        createdBy,
        taskPriority,
        taskStatus,
        due_date || null,
        related_evidence_ids ? JSON.stringify(related_evidence_ids) : '[]',
        related_entity_ids ? JSON.stringify(related_entity_ids) : '[]',
        related_lead_id || null
      ]
    );

    const taskId = result.insertId;

    // Log Activity
    await collaborationService.logCaseActivity(
      caseId,
      createdBy,
      'TASK_CREATED',
      taskId,
      null,
      { title, priority: taskPriority, status: taskStatus },
      `Task created: "${title}" [Priority: ${taskPriority}]`
    );

    // If assigned, notify officer
    if (assigned_officer_id) {
      await collaborationService.createNotification(
        assigned_officer_id,
        caseId,
        'TASK_ASSIGNED',
        'New Investigation Task Assigned',
        `You have been assigned task: "${title}"`,
        'TASK',
        taskId
      );
    }

    res.status(201).json({
      success: true,
      data: {
        task_id: taskId,
        case_id: caseId,
        title,
        priority: taskPriority,
        status: taskStatus,
        version: 1
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieves a single task by ID with notes and dependencies.
 * GET /api/v1/tasks/:taskId
 */
exports.getTaskById = async (req, res, next) => {
  try {
    const taskId = parseInt(req.params.taskId, 10);
    const [tasks] = await execute(
      `SELECT t.*, 
              ao.full_name AS assigned_officer_name, ao.badge_number AS assigned_officer_badge,
              co.full_name AS created_by_officer_name, co.badge_number AS created_by_officer_badge
       FROM investigation_tasks t
       LEFT JOIN officers ao ON t.assigned_officer_id = ao.officer_id
       LEFT JOIN officers co ON t.created_by_officer_id = co.officer_id
       WHERE t.task_id = ?`,
      [taskId]
    );

    if (!tasks || tasks.length === 0) {
      return res.status(404).json({ success: false, error: { message: `Task ID ${taskId} not found.` } });
    }

    const task = tasks[0];
    const access = await collaborationService.verifyCaseAccess(task.case_id, req.officer, 'view_case');
    if (!access.authorized) {
      return res.status(access.status || 403).json({ success: false, error: { message: access.error } });
    }

    // Concurrently load notes and dependency chain
    const [notes] = await execute(
      `SELECT n.*, o.full_name AS author_name, o.badge_number AS author_badge
       FROM investigation_task_notes n
       JOIN officers o ON n.officer_id = o.officer_id
       WHERE n.task_id = ?
       ORDER BY n.created_at ASC`,
      [taskId]
    );

    const dependencies = await collaborationService.getTaskDependencyChain(taskId);

    res.json({
      success: true,
      data: {
        ...task,
        notes,
        dependencies
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Updates a task (with optimistic concurrency check).
 * PATCH /api/v1/tasks/:taskId
 */
exports.updateTask = async (req, res, next) => {
  try {
    const taskId = parseInt(req.params.taskId, 10);
    const [tasks] = await execute('SELECT * FROM investigation_tasks WHERE task_id = ?', [taskId]);
    if (!tasks || tasks.length === 0) {
      return res.status(404).json({ success: false, error: { message: `Task ID ${taskId} not found.` } });
    }

    const task = tasks[0];
    const access = await collaborationService.verifyCaseAccess(task.case_id, req.officer, 'update_task');
    if (!access.authorized) {
      return res.status(access.status || 403).json({ success: false, error: { message: access.error } });
    }

    const {
      title,
      description,
      priority,
      status,
      due_date,
      completion_notes,
      version
    } = req.body;

    // Optimistic Concurrency Control: verify version matches if provided
    if (version !== undefined && parseInt(version, 10) !== task.version) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'CONCURRENT_MODIFICATION_DETECTED',
          message: 'Task was updated by another investigator concurrently. Please refresh and review latest state.'
        }
      });
    }

    // Check dependency constraints before completing
    if (status === 'COMPLETED') {
      const checkPrereqs = await collaborationService.canCompleteTask(taskId);
      if (!checkPrereqs.canComplete) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'TASK_DEPENDENCIES_UNMET',
            message: 'Cannot complete task: prerequisite tasks are still incomplete.',
            unmet_dependencies: checkPrereqs.unmetDependencies
          }
        });
      }
    }

    const updatedTitle = title !== undefined ? title : task.title;
    const updatedDesc = description !== undefined ? description : task.description;
    const updatedPrio = priority !== undefined ? priority : task.priority;
    const updatedStatus = status !== undefined ? status : task.status;
    const updatedDue = due_date !== undefined ? due_date : task.due_date;
    const updatedCompNotes = completion_notes !== undefined ? completion_notes : task.completion_notes;
    const completedAt = updatedStatus === 'COMPLETED' ? new Date().toISOString().slice(0, 19).replace('T', ' ') : task.completed_at;

    const [updateRes] = await execute(
      `UPDATE investigation_tasks 
       SET title = ?, description = ?, priority = ?, status = ?, due_date = ?, completed_at = ?, completion_notes = ?, version = version + 1
       WHERE task_id = ? AND version = ?`,
      [updatedTitle, updatedDesc, updatedPrio, updatedStatus, updatedDue, completedAt, updatedCompNotes, taskId, task.version]
    );

    if (updateRes.affectedRows === 0) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'CONCURRENT_MODIFICATION_DETECTED',
          message: 'Conflict during commit. Another update occurred concurrently.'
        }
      });
    }

    // Log Activity if status changed
    if (updatedStatus !== task.status) {
      await collaborationService.logCaseActivity(
        task.case_id,
        req.officer.officer_id,
        'TASK_STATUS_CHANGED',
        taskId,
        { status: task.status },
        { status: updatedStatus },
        `Task "${task.title}" status transitioned from ${task.status} to ${updatedStatus}.`
      );
    }

    res.json({
      success: true,
      data: {
        task_id: taskId,
        title: updatedTitle,
        status: updatedStatus,
        version: task.version + 1
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reassigns a task to another officer.
 * POST /api/v1/tasks/:taskId/assign
 */
exports.assignTask = async (req, res, next) => {
  try {
    const taskId = parseInt(req.params.taskId, 10);
    const [tasks] = await execute('SELECT * FROM investigation_tasks WHERE task_id = ?', [taskId]);
    if (!tasks || tasks.length === 0) {
      return res.status(404).json({ success: false, error: { message: `Task ID ${taskId} not found.` } });
    }

    const task = tasks[0];
    const access = await collaborationService.verifyCaseAccess(task.case_id, req.officer, 'assign_task');
    if (!access.authorized) {
      return res.status(access.status || 403).json({ success: false, error: { message: access.error } });
    }

    const { assigned_officer_id, reason } = req.body;
    if (!assigned_officer_id) {
      return res.status(400).json({ success: false, error: { message: 'assigned_officer_id is required.' } });
    }

    // Verify officer is an active member of this case
    const [members] = await execute(
      'SELECT member_id FROM case_members WHERE case_id = ? AND officer_id = ? AND is_active = 1',
      [task.case_id, assigned_officer_id]
    );
    if (!members || members.length === 0) {
      return res.status(400).json({ success: false, error: { message: 'Assigned officer must be an active member of this case.' } });
    }

    const prevAssigned = task.assigned_officer_id;
    await execute(
      'UPDATE investigation_tasks SET assigned_officer_id = ?, status = ?, version = version + 1 WHERE task_id = ?',
      [assigned_officer_id, task.status === 'OPEN' ? 'ASSIGNED' : task.status, taskId]
    );

    // Log Activity
    await collaborationService.logCaseActivity(
      task.case_id,
      req.officer.officer_id,
      'TASK_ASSIGNED',
      taskId,
      { assigned_officer_id: prevAssigned },
      { assigned_officer_id },
      `Task "${task.title}" reassigned to Officer ${assigned_officer_id}. Reason: ${reason || 'Workload reallocation'}`
    );

    // Notify Officer
    await collaborationService.createNotification(
      assigned_officer_id,
      task.case_id,
      'TASK_ASSIGNED',
      'Investigation Task Assigned',
      `You have been assigned to task: "${task.title}"`,
      'TASK',
      taskId
    );

    res.json({
      success: true,
      data: {
        task_id: taskId,
        assigned_officer_id,
        previous_assigned: prevAssigned
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Appends a progress note to an existing task.
 * POST /api/v1/tasks/:taskId/notes
 */
exports.addTaskNote = async (req, res, next) => {
  try {
    const taskId = parseInt(req.params.taskId, 10);
    const [tasks] = await execute('SELECT * FROM investigation_tasks WHERE task_id = ?', [taskId]);
    if (!tasks || tasks.length === 0) {
      return res.status(404).json({ success: false, error: { message: `Task ID ${taskId} not found.` } });
    }

    const task = tasks[0];
    const access = await collaborationService.verifyCaseAccess(task.case_id, req.officer, 'update_task');
    if (!access.authorized) {
      return res.status(access.status || 403).json({ success: false, error: { message: access.error } });
    }

    const { note_text } = req.body;
    if (!note_text || note_text.trim().length === 0) {
      return res.status(400).json({ success: false, error: { message: 'note_text is required.' } });
    }

    const authorId = req.officer.officer_id;
    const [result] = await execute(
      'INSERT INTO investigation_task_notes (task_id, case_id, officer_id, note_text) VALUES (?, ?, ?, ?)',
      [taskId, task.case_id, authorId, note_text.trim()]
    );

    // Log Activity
    await collaborationService.logCaseActivity(
      task.case_id,
      authorId,
      'INVESTIGATION_NOTE_ADDED',
      taskId,
      null,
      { note_id: result.insertId },
      `Progress note added to Task "${task.title}": ${note_text.slice(0, 60)}...`
    );

    res.status(201).json({
      success: true,
      data: {
        note_id: result.insertId,
        task_id: taskId,
        officer_id: authorId,
        note_text: note_text.trim()
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Finalizes and marks a task COMPLETED with mandatory dependency check.
 * POST /api/v1/tasks/:taskId/complete
 */
exports.completeTask = async (req, res, next) => {
  try {
    const taskId = parseInt(req.params.taskId, 10);
    const [tasks] = await execute('SELECT * FROM investigation_tasks WHERE task_id = ?', [taskId]);
    if (!tasks || tasks.length === 0) {
      return res.status(404).json({ success: false, error: { message: `Task ID ${taskId} not found.` } });
    }

    const task = tasks[0];
    const access = await collaborationService.verifyCaseAccess(task.case_id, req.officer, 'complete_task');
    if (!access.authorized) {
      return res.status(access.status || 403).json({ success: false, error: { message: access.error } });
    }

    // Verify dependencies
    const checkPrereqs = await collaborationService.canCompleteTask(taskId);
    if (!checkPrereqs.canComplete) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'TASK_DEPENDENCIES_UNMET',
          message: 'Cannot complete task: prerequisite tasks are not finished yet.',
          unmet_dependencies: checkPrereqs.unmetDependencies
        }
      });
    }

    const completionNotes = req.body.completion_notes || 'Task marked completed by assigned officer.';
    await execute(
      'UPDATE investigation_tasks SET status = ?, completed_at = CURRENT_TIMESTAMP, completion_notes = ?, version = version + 1 WHERE task_id = ?',
      ['COMPLETED', completionNotes, taskId]
    );

    // Log Activity
    await collaborationService.logCaseActivity(
      task.case_id,
      req.officer.officer_id,
      'TASK_STATUS_CHANGED',
      taskId,
      { status: task.status },
      { status: 'COMPLETED' },
      `Task "${task.title}" completed. Notes: ${completionNotes}`
    );

    res.json({
      success: true,
      data: {
        task_id: taskId,
        status: 'COMPLETED',
        completion_notes: completionNotes
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Adds a dependency between tasks with cycle detection.
 * POST /api/v1/tasks/:taskId/dependencies
 */
exports.addTaskDependency = async (req, res, next) => {
  try {
    const taskId = parseInt(req.params.taskId, 10);
    const { depends_on_task_id } = req.body;
    if (!depends_on_task_id) {
      return res.status(400).json({ success: false, error: { message: 'depends_on_task_id is required.' } });
    }

    const pId = parseInt(depends_on_task_id, 10);
    if (taskId === pId) {
      return res.status(400).json({
        success: false,
        error: { code: 'SELF_DEPENDENCY_INVALID', message: 'A task cannot depend on itself.' }
      });
    }

    const [tasks] = await execute('SELECT case_id FROM investigation_tasks WHERE task_id = ?', [taskId]);
    if (!tasks || tasks.length === 0) {
      return res.status(404).json({ success: false, error: { message: `Task ID ${taskId} not found.` } });
    }

    const caseId = tasks[0].case_id;
    const access = await collaborationService.verifyCaseAccess(caseId, req.officer, 'update_task');
    if (!access.authorized) {
      return res.status(access.status || 403).json({ success: false, error: { message: access.error } });
    }

    // Verify prerequisite task exists in same case
    const [prereqTasks] = await execute('SELECT task_id, title FROM investigation_tasks WHERE task_id = ? AND case_id = ?', [pId, caseId]);
    if (!prereqTasks || prereqTasks.length === 0) {
      return res.status(404).json({ success: false, error: { message: `Prerequisite task ID ${pId} not found in this case.` } });
    }

    // Graph Cycle Detection
    const hasCycle = await collaborationService.detectCycle(caseId, taskId, pId);
    if (hasCycle) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'CIRCULAR_DEPENDENCY_DETECTED',
          message: `Cannot add dependency: Task ${taskId} depending on Task ${pId} creates a circular dependency chain.`
        }
      });
    }

    const [result] = await execute(
      'INSERT INTO investigation_task_dependencies (task_id, depends_on_task_id, created_by_officer_id) VALUES (?, ?, ?)',
      [taskId, pId, req.officer.officer_id]
    );

    res.status(201).json({
      success: true,
      data: {
        dependency_id: result.insertId,
        task_id: taskId,
        depends_on_task_id: pId
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Removes a task dependency.
 * DELETE /api/v1/tasks/:taskId/dependencies/:dependencyId
 */
exports.removeTaskDependency = async (req, res, next) => {
  try {
    const taskId = parseInt(req.params.taskId, 10);
    const depId = parseInt(req.params.dependencyId, 10);

    const [tasks] = await execute('SELECT case_id FROM investigation_tasks WHERE task_id = ?', [taskId]);
    if (!tasks || tasks.length === 0) {
      return res.status(404).json({ success: false, error: { message: `Task ID ${taskId} not found.` } });
    }

    const access = await collaborationService.verifyCaseAccess(tasks[0].case_id, req.officer, 'update_task');
    if (!access.authorized) {
      return res.status(access.status || 403).json({ success: false, error: { message: access.error } });
    }

    await execute('DELETE FROM investigation_task_dependencies WHERE dependency_id = ?', [depId]);

    res.json({
      success: true,
      data: { dependency_id: depId, message: 'Task dependency removed successfully.' }
    });
  } catch (error) {
    next(error);
  }
};

// ==============================================================================
// 3. EVIDENCE REVIEW ASSIGNMENTS & QUEUE
// ==============================================================================

/**
 * Lists evidence reviews for a case.
 * GET /api/v1/cases/:caseId/reviews
 */
exports.getCaseReviews = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.caseId, 10);
    const access = await collaborationService.verifyCaseAccess(caseId, req.officer, 'view_case');
    if (!access.authorized) {
      return res.status(access.status || 403).json({ success: false, error: { message: access.error } });
    }

    const [reviews] = await execute(
      `SELECT r.*, e.tracking_code, e.title AS evidence_title, e.category AS evidence_category,
              o.full_name AS reviewer_name, o.badge_number AS reviewer_badge
       FROM evidence_reviews r
       JOIN evidence e ON r.evidence_id = e.evidence_id
       LEFT JOIN officers o ON r.assigned_reviewer_id = o.officer_id
       WHERE r.case_id = ?
       ORDER BY r.created_at DESC`,
      [caseId]
    );

    res.json({ success: true, data: reviews });
  } catch (error) {
    next(error);
  }
};

/**
 * Requests an evidence review assignment.
 * POST /api/v1/evidence/:evidenceId/reviews
 */
exports.requestEvidenceReview = async (req, res, next) => {
  try {
    const evidenceId = parseInt(req.params.evidenceId, 10);
    const [evidenceRows] = await execute('SELECT case_id, title, tracking_code FROM evidence WHERE evidence_id = ?', [evidenceId]);
    if (!evidenceRows || evidenceRows.length === 0) {
      return res.status(404).json({ success: false, error: { message: `Evidence ID ${evidenceId} not found.` } });
    }

    const ev = evidenceRows[0];
    const access = await collaborationService.verifyCaseAccess(ev.case_id, req.officer, 'request_review');
    if (!access.authorized) {
      return res.status(access.status || 403).json({ success: false, error: { message: access.error } });
    }

    const { assigned_reviewer_id, review_notes, related_task_id } = req.body;
    if (!assigned_reviewer_id) {
      return res.status(400).json({ success: false, error: { message: 'assigned_reviewer_id is required.' } });
    }

    const createdBy = req.officer.officer_id;
    const [result] = await execute(
      `INSERT INTO evidence_reviews 
       (evidence_id, case_id, assigned_reviewer_id, created_by_officer_id, review_status, review_notes, related_task_id)
       VALUES (?, ?, ?, ?, 'PENDING_REVIEW', ?, ?)`,
      [evidenceId, ev.case_id, assigned_reviewer_id, createdBy, review_notes || null, related_task_id || null]
    );

    const reviewId = result.insertId;

    // Log Activity
    await collaborationService.logCaseActivity(
      ev.case_id,
      createdBy,
      'EVIDENCE_REVIEWED',
      reviewId,
      null,
      { review_status: 'PENDING_REVIEW', assigned_reviewer_id },
      `Evidence review requested for "${ev.title}" (${ev.tracking_code}). Assigned to Officer ${assigned_reviewer_id}.`
    );

    // Notify Reviewer
    await collaborationService.createNotification(
      assigned_reviewer_id,
      ev.case_id,
      'EVIDENCE_REVIEW_REQUESTED',
      'Evidence Review Requested',
      `Review requested for evidence item ${ev.tracking_code} ("${ev.title}")`,
      'EVIDENCE_REVIEW',
      reviewId
    );

    res.status(201).json({
      success: true,
      data: {
        review_id: reviewId,
        evidence_id: evidenceId,
        case_id: ev.case_id,
        review_status: 'PENDING_REVIEW',
        assigned_reviewer_id
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Submits findings and updates an evidence review.
 * PATCH /api/v1/reviews/:reviewId
 */
exports.submitEvidenceReview = async (req, res, next) => {
  try {
    const reviewId = parseInt(req.params.reviewId, 10);
    const [reviews] = await execute('SELECT * FROM evidence_reviews WHERE review_id = ?', [reviewId]);
    if (!reviews || reviews.length === 0) {
      return res.status(404).json({ success: false, error: { message: `Review ID ${reviewId} not found.` } });
    }

    const review = reviews[0];
    const access = await collaborationService.verifyCaseAccess(review.case_id, req.officer, 'submit_review');
    if (!access.authorized) {
      return res.status(access.status || 403).json({ success: false, error: { message: access.error } });
    }

    const {
      review_status,
      reviewer_observations,
      integrity_verification_status,
      metadata_review_status,
      review_notes
    } = req.body;

    const validStatuses = ['PENDING_REVIEW', 'UNDER_REVIEW', 'VERIFIED', 'REQUIRES_CLARIFICATION', 'FLAGGED_FOR_RECHECK'];
    const newStatus = review_status && validStatuses.includes(review_status) ? review_status : review.review_status;

    await execute(
      `UPDATE evidence_reviews 
       SET review_status = ?, reviewer_observations = ?, integrity_verification_status = ?, metadata_review_status = ?, review_notes = ?, reviewed_at = CURRENT_TIMESTAMP
       WHERE review_id = ?`,
      [
        newStatus,
        reviewer_observations !== undefined ? reviewer_observations : review.reviewer_observations,
        integrity_verification_status || review.integrity_verification_status,
        metadata_review_status || review.metadata_review_status,
        review_notes !== undefined ? review_notes : review.review_notes,
        reviewId
      ]
    );

    // Log Activity
    const isFlagged = newStatus === 'FLAGGED_FOR_RECHECK' || newStatus === 'REQUIRES_CLARIFICATION';
    await collaborationService.logCaseActivity(
      review.case_id,
      req.officer.officer_id,
      isFlagged ? 'EVIDENCE_FLAGGED' : 'EVIDENCE_REVIEWED',
      reviewId,
      { status: review.review_status },
      { status: newStatus },
      `Evidence review #${reviewId} finalized with status ${newStatus}. Observations: ${reviewer_observations || 'None'}`
    );

    // Notify Case Lead
    const [caseData] = await execute('SELECT lead_officer_id FROM cases WHERE case_id = ?', [review.case_id]);
    if (caseData && caseData.length > 0) {
      await collaborationService.createNotification(
        caseData[0].lead_officer_id,
        review.case_id,
        'EVIDENCE_REVIEW_COMPLETED',
        'Evidence Review Completed',
        `Review #${reviewId} submitted with status: ${newStatus}`,
        'EVIDENCE_REVIEW',
        reviewId
      );
    }

    res.json({
      success: true,
      data: {
        review_id: reviewId,
        review_status: newStatus,
        integrity_verification_status: integrity_verification_status || review.integrity_verification_status,
        metadata_review_status: metadata_review_status || review.metadata_review_status
      }
    });
  } catch (error) {
    next(error);
  }
};

// ==============================================================================
// 4. UNIFIED INVESTIGATION ACTIVITY TIMELINE
// ==============================================================================

/**
 * Retrieves the chronological investigation event timeline for a case.
 * GET /api/v1/cases/:caseId/activity
 */
exports.getCaseActivity = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.caseId, 10);
    const access = await collaborationService.verifyCaseAccess(caseId, req.officer, 'view_case');
    if (!access.authorized) {
      return res.status(access.status || 403).json({ success: false, error: { message: access.error } });
    }

    const { officer_id, event_type, from_date, to_date, limit, offset } = req.query;
    let sql = `
      SELECT a.*, o.full_name AS actor_name, o.badge_number AS actor_badge, o.rank_designation AS actor_rank
      FROM case_activity_logs a
      LEFT JOIN officers o ON a.actor_id = o.officer_id
      WHERE a.case_id = ?
    `;
    const params = [caseId];

    if (officer_id) {
      sql += ' AND a.actor_id = ?';
      params.push(parseInt(officer_id, 10));
    }
    if (event_type) {
      sql += ' AND a.event_type = ?';
      params.push(event_type);
    }
    if (from_date) {
      sql += ' AND a.created_at >= ?';
      params.push(from_date);
    }
    if (to_date) {
      sql += ' AND a.created_at <= ?';
      params.push(to_date);
    }

    sql += ' ORDER BY a.created_at DESC';

    const [logs] = await execute(sql, params);

    // Apply pagination in memory if provided
    let paginated = logs;
    const l = limit ? parseInt(limit, 10) : 100;
    const o = offset ? parseInt(offset, 10) : 0;
    paginated = logs.slice(o, o + l);

    res.json({
      success: true,
      data: {
        total_events: logs.length,
        events: paginated
      }
    });
  } catch (error) {
    next(error);
  }
};

// ==============================================================================
// 5. INTERNAL NOTIFICATION SYSTEM
// ==============================================================================

/**
 * Retrieves notifications for the authenticated officer.
 * GET /api/v1/notifications
 */
exports.getNotifications = async (req, res, next) => {
  try {
    const officerId = req.officer.officer_id;
    const { is_read, limit } = req.query;

    let sql = 'SELECT * FROM officer_notifications WHERE officer_id = ?';
    const params = [officerId];

    if (is_read !== undefined) {
      sql += ' AND is_read = ?';
      params.push(is_read === 'true' || is_read === '1' ? 1 : 0);
    }

    sql += ' ORDER BY created_at DESC';

    const [notifs] = await execute(sql, params);
    const [unreadRows] = await execute('SELECT COUNT(*) AS unread_count FROM officer_notifications WHERE officer_id = ? AND is_read = 0', [officerId]);
    const unreadCount = unreadRows && unreadRows[0] ? unreadRows[0].unread_count : 0;

    const l = limit ? parseInt(limit, 10) : 50;
    res.json({
      success: true,
      data: {
        unread_count: unreadCount,
        notifications: notifs.slice(0, l)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Marks a single notification as read.
 * PATCH /api/v1/notifications/:notificationId/read
 */
exports.markNotificationRead = async (req, res, next) => {
  try {
    const notificationId = parseInt(req.params.notificationId, 10);
    const officerId = req.officer.officer_id;

    await execute(
      'UPDATE officer_notifications SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE notification_id = ? AND officer_id = ?',
      [notificationId, officerId]
    );

    res.json({
      success: true,
      data: { notification_id: notificationId, is_read: true }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Marks all notifications as read for current officer.
 * POST /api/v1/notifications/read-all
 */
exports.markAllNotificationsRead = async (req, res, next) => {
  try {
    const officerId = req.officer.officer_id;
    await execute(
      'UPDATE officer_notifications SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE officer_id = ? AND is_read = 0',
      [officerId]
    );

    res.json({
      success: true,
      data: { message: 'All notifications marked as read.' }
    });
  } catch (error) {
    next(error);
  }
};

// ==============================================================================
// 6. WORKFLOW & CASE WORKLOAD ANALYTICS
// ==============================================================================

/**
 * Computes case operational metrics from real database records.
 * GET /api/v1/cases/:caseId/workflow-analytics
 */
exports.getWorkflowAnalytics = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.caseId, 10);
    const access = await collaborationService.verifyCaseAccess(caseId, req.officer, 'view_case');
    if (!access.authorized) {
      return res.status(access.status || 403).json({ success: false, error: { message: access.error } });
    }

    const metrics = await collaborationService.calculateWorkflowAnalytics(caseId);
    res.json({ success: true, data: metrics });
  } catch (error) {
    next(error);
  }
};

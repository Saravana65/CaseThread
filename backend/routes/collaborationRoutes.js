/**
 * @file collaborationRoutes.js
 * @description API route definitions for multi-officer case collaboration, investigation task lifecycle,
 * task dependencies DAG, evidence reviews, activity logs, notifications, and workflow analytics.
 */

const express = require('express');
const router = express.Router();
const collaborationController = require('../controllers/collaborationController');
const { authenticateToken } = require('../middleware/auth');

// All collaboration endpoints require authenticated investigator
router.use(authenticateToken);

// 1. Case Collaboration & Team Membership
router.get('/cases/:caseId/members', collaborationController.getCaseMembers);
router.post('/cases/:caseId/members', collaborationController.addCaseMember);
router.patch('/cases/:caseId/members/:memberId', collaborationController.updateCaseMember);
router.delete('/cases/:caseId/members/:memberId', collaborationController.removeCaseMember);
router.post('/cases/:caseId/transfer-leadership', collaborationController.transferCaseLeadership);

// 2. Investigation Task Management & Lifecycle
router.get('/cases/:caseId/tasks', collaborationController.getCaseTasks);
router.post('/cases/:caseId/tasks', collaborationController.createTask);
router.get('/tasks/:taskId', collaborationController.getTaskById);
router.patch('/tasks/:taskId', collaborationController.updateTask);
router.post('/tasks/:taskId/assign', collaborationController.assignTask);
router.post('/tasks/:taskId/notes', collaborationController.addTaskNote);
router.post('/tasks/:taskId/complete', collaborationController.completeTask);

// 3. Task Dependencies & Workflow Rules
router.post('/tasks/:taskId/dependencies', collaborationController.addTaskDependency);
router.delete('/tasks/:taskId/dependencies/:dependencyId', collaborationController.removeTaskDependency);

// 4. Evidence Review Assignments & Queue
router.get('/cases/:caseId/reviews', collaborationController.getCaseReviews);
router.post('/evidence/:evidenceId/reviews', collaborationController.requestEvidenceReview);
router.patch('/reviews/:reviewId', collaborationController.submitEvidenceReview);

// 5. Investigation Activity Timeline
router.get('/cases/:caseId/activity', collaborationController.getCaseActivity);

// 6. Internal Notification System
router.get('/notifications', collaborationController.getNotifications);
router.patch('/notifications/:notificationId/read', collaborationController.markNotificationRead);
router.post('/notifications/read-all', collaborationController.markAllNotificationsRead);

// 7. Case Workload & Progress Analytics
router.get('/cases/:caseId/workflow-analytics', collaborationController.getWorkflowAnalytics);

module.exports = router;

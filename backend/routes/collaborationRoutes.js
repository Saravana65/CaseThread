/**
 * @file collaborationRoutes.js
 * @description API route definitions for multi-officer case collaboration, investigation task lifecycle,
 * task dependencies DAG, evidence reviews, activity logs, notifications, and workflow analytics.
 */

const express = require('express');
const router = express.Router();
const collaborationController = require('../controllers/collaborationController');
const { authenticateToken } = require('../middleware/auth');

// 1. Case Collaboration & Team Membership
router.get('/cases/:caseId/members', authenticateToken, collaborationController.getCaseMembers);
router.post('/cases/:caseId/members', authenticateToken, collaborationController.addCaseMember);
router.patch('/cases/:caseId/members/:memberId', authenticateToken, collaborationController.updateCaseMember);
router.delete('/cases/:caseId/members/:memberId', authenticateToken, collaborationController.removeCaseMember);
router.post('/cases/:caseId/transfer-leadership', authenticateToken, collaborationController.transferCaseLeadership);

// 2. Investigation Task Management & Lifecycle
router.get('/cases/:caseId/tasks', authenticateToken, collaborationController.getCaseTasks);
router.post('/cases/:caseId/tasks', authenticateToken, collaborationController.createTask);
router.get('/tasks/:taskId', authenticateToken, collaborationController.getTaskById);
router.patch('/tasks/:taskId', authenticateToken, collaborationController.updateTask);
router.post('/tasks/:taskId/assign', authenticateToken, collaborationController.assignTask);
router.post('/tasks/:taskId/notes', authenticateToken, collaborationController.addTaskNote);
router.post('/tasks/:taskId/complete', authenticateToken, collaborationController.completeTask);

// 3. Task Dependencies & Workflow Rules
router.post('/tasks/:taskId/dependencies', authenticateToken, collaborationController.addTaskDependency);
router.delete('/tasks/:taskId/dependencies/:dependencyId', authenticateToken, collaborationController.removeTaskDependency);

// 4. Evidence Review Assignments & Queue
router.get('/cases/:caseId/reviews', authenticateToken, collaborationController.getCaseReviews);
router.post('/evidence/:evidenceId/reviews', authenticateToken, collaborationController.requestEvidenceReview);
router.patch('/reviews/:reviewId', authenticateToken, collaborationController.submitEvidenceReview);

// 5. Investigation Activity Timeline
router.get('/cases/:caseId/activity', authenticateToken, collaborationController.getCaseActivity);

// 6. Internal Notification System
router.get('/notifications', authenticateToken, collaborationController.getNotifications);
router.patch('/notifications/:notificationId/read', authenticateToken, collaborationController.markNotificationRead);
router.post('/notifications/read-all', authenticateToken, collaborationController.markAllNotificationsRead);

// 7. Case Workload & Progress Analytics
router.get('/cases/:caseId/workflow-analytics', authenticateToken, collaborationController.getWorkflowAnalytics);

module.exports = router;

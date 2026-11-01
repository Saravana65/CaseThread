import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

export default function CollaborationPanel({ caseId, officer, onNotificationCountChange }) {
  const [activeSubTab, setActiveSubTab] = useState('tasks'); // 'tasks' | 'team' | 'reviews' | 'activity' | 'notifications' | 'analytics'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Data states
  const [members, setMembers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [activity, setActivity] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [analytics, setAnalytics] = useState(null);

  // Filters & selection
  const [taskStatusFilter, setTaskStatusFilter] = useState('ALL');
  const [taskPriorityFilter, setTaskPriorityFilter] = useState('ALL');
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedTaskDetails, setSelectedTaskDetails] = useState(null);

  // Modals
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showTransferLeadModal, setShowTransferLeadModal] = useState(false);
  const [showAddDepModal, setShowAddDepModal] = useState(false);
  const [showSubmitReviewModal, setShowSubmitReviewModal] = useState(false);
  const [activeReviewItem, setActiveReviewItem] = useState(null);

  // Forms
  const [newTaskForm, setNewTaskForm] = useState({
    title: '',
    description: '',
    priority: 'NORMAL',
    assigned_officer_id: '',
    due_date: ''
  });

  const [newMemberForm, setNewMemberForm] = useState({
    officer_id: '',
    role: 'INVESTIGATING_OFFICER'
  });

  const [newNoteText, setNewNoteText] = useState('');
  const [depPrereqTaskId, setDepPrereqTaskId] = useState('');
  const [transferLeadId, setTransferLeadId] = useState('');

  const [reviewForm, setReviewForm] = useState({
    review_status: 'VERIFIED',
    reviewer_observations: '',
    integrity_verification_status: 'VERIFIED',
    metadata_review_status: 'APPROVED',
    review_notes: ''
  });

  const notify = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Load all case collaboration data
  const loadCaseData = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    setError(null);
    try {
      const [membersRes, tasksRes, reviewsRes, actRes, notifsRes, analyticsRes] = await Promise.all([
        api.getCaseMembers(caseId).catch(() => ({ data: [] })),
        api.getCaseTasks(caseId).catch(() => ({ data: [] })),
        api.getCaseReviews(caseId).catch(() => ({ data: [] })),
        api.getCaseActivity(caseId, { limit: 50 }).catch(() => ({ data: { events: [] } })),
        api.getNotifications({ limit: 30 }).catch(() => ({ data: { notifications: [], unread_count: 0 } })),
        api.getWorkflowAnalytics(caseId).catch(() => ({ data: null }))
      ]);

      setMembers(membersRes.data || []);
      setTasks(tasksRes.data || []);
      setReviews(reviewsRes.data || []);
      setActivity(actRes.data?.events || []);
      setNotifications(notifsRes.data?.notifications || []);
      const unread = notifsRes.data?.unread_count || 0;
      setUnreadCount(unread);
      if (onNotificationCountChange) onNotificationCountChange(unread);
      setAnalytics(analyticsRes.data || null);
    } catch (err) {
      setError(err.message || 'Failed to load case collaboration workspace.');
    } finally {
      setLoading(false);
    }
  }, [caseId, onNotificationCountChange]);

  useEffect(() => {
    loadCaseData();
  }, [loadCaseData]);

  // Load detailed single task with notes & dependencies
  const loadTaskDetails = async (taskId) => {
    try {
      const res = await api.getTaskById(taskId);
      setSelectedTaskDetails(res.data);
    } catch (err) {
      setError(err.message || 'Failed to load task details.');
    }
  };

  const handleSelectTask = (task) => {
    setSelectedTask(task);
    loadTaskDetails(task.task_id);
  };

  // 1. Create Task
  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!newTaskForm.title.trim()) return;
    try {
      await api.createTask(caseId, {
        ...newTaskForm,
        assigned_officer_id: newTaskForm.assigned_officer_id ? parseInt(newTaskForm.assigned_officer_id, 10) : null
      });
      setShowCreateTaskModal(false);
      setNewTaskForm({ title: '', description: '', priority: 'NORMAL', assigned_officer_id: '', due_date: '' });
      notify('Investigation task created successfully.');
      loadCaseData();
    } catch (err) {
      setError(err.message || 'Failed to create task.');
    }
  };

  // 2. Add Note to Task
  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNoteText.trim() || !selectedTask) return;
    try {
      await api.addTaskNote(selectedTask.task_id, { note_text: newNoteText });
      setNewNoteText('');
      notify('Progress note recorded.');
      loadTaskDetails(selectedTask.task_id);
      loadCaseData();
    } catch (err) {
      setError(err.message || 'Failed to add task note.');
    }
  };

  // 3. Complete Task
  const handleCompleteTask = async (taskId) => {
    try {
      await api.completeTask(taskId, { completion_notes: 'Completed by investigator in collaboration board.' });
      notify('Task marked as COMPLETED.');
      loadCaseData();
      if (selectedTask?.task_id === taskId) {
        loadTaskDetails(taskId);
      }
    } catch (err) {
      setError(err.message || 'Cannot complete task. Verify all prerequisite dependencies are met.');
    }
  };

  // 4. Add Task Dependency
  const handleAddDependency = async (e) => {
    e.preventDefault();
    if (!depPrereqTaskId || !selectedTask) return;
    try {
      await api.addTaskDependency(selectedTask.task_id, {
        depends_on_task_id: parseInt(depPrereqTaskId, 10)
      });
      setShowAddDepModal(false);
      setDepPrereqTaskId('');
      notify('Task dependency linked successfully.');
      loadTaskDetails(selectedTask.task_id);
    } catch (err) {
      setError(err.message || 'Failed to link dependency. Circular dependency detected.');
    }
  };

  // 5. Remove Task Dependency
  const handleRemoveDependency = async (depId) => {
    if (!selectedTask) return;
    try {
      await api.removeTaskDependency(selectedTask.task_id, depId);
      notify('Dependency link removed.');
      loadTaskDetails(selectedTask.task_id);
    } catch (err) {
      setError(err.message || 'Failed to remove dependency.');
    }
  };

  // 6. Assign Member
  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!newMemberForm.officer_id) return;
    try {
      await api.addCaseMember(caseId, {
        officer_id: parseInt(newMemberForm.officer_id, 10),
        role: newMemberForm.role
      });
      setShowAddMemberModal(false);
      setNewMemberForm({ officer_id: '', role: 'INVESTIGATING_OFFICER' });
      notify('Officer assigned to case collaboration team.');
      loadCaseData();
    } catch (err) {
      setError(err.message || 'Failed to assign officer.');
    }
  };

  // 7. Revoke Member
  const handleRevokeMember = async (memberId, officerName) => {
    const reason = window.prompt(`Enter reason for revoking case access for ${officerName}:`, 'Case workload rebalance');
    if (!reason) return;
    try {
      await api.removeCaseMember(caseId, memberId, reason);
      notify(`Case access revoked for ${officerName}.`);
      loadCaseData();
    } catch (err) {
      setError(err.message || 'Failed to revoke member access.');
    }
  };

  // 8. Transfer Leadership
  const handleTransferLeadership = async (e) => {
    e.preventDefault();
    if (!transferLeadId) return;
    try {
      await api.transferCaseLeadership(caseId, {
        new_lead_officer_id: parseInt(transferLeadId, 10),
        reason: 'Command leadership reallocated'
      });
      setShowTransferLeadModal(false);
      setTransferLeadId('');
      notify('Case primary leadership successfully transferred.');
      loadCaseData();
    } catch (err) {
      setError(err.message || 'Failed to transfer leadership.');
    }
  };

  // 9. Submit Evidence Review
  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!activeReviewItem) return;
    try {
      await api.submitEvidenceReview(activeReviewItem.review_id, reviewForm);
      setShowSubmitReviewModal(false);
      setActiveReviewItem(null);
      notify('Evidence review observations submitted successfully.');
      loadCaseData();
    } catch (err) {
      setError(err.message || 'Failed to submit evidence review.');
    }
  };

  // 10. Mark Notification Read
  const handleMarkNotifRead = async (notificationId) => {
    try {
      await api.markNotificationRead(notificationId);
      loadCaseData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      notify('All notifications marked as read.');
      loadCaseData();
    } catch (err) {
      console.error(err);
    }
  };

  // Filtered tasks
  const filteredTasks = tasks.filter(t => {
    if (taskStatusFilter !== 'ALL' && t.status !== taskStatusFilter) return false;
    if (taskPriorityFilter !== 'ALL' && t.priority !== taskPriorityFilter) return false;
    return true;
  });

  const getPriorityBadgeClass = (priority) => {
    switch (priority) {
      case 'CRITICAL': return 'badge-critical';
      case 'HIGH': return 'badge-high';
      case 'NORMAL': return 'badge-medium';
      case 'LOW': return 'badge-low';
      default: return 'badge-low';
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'COMPLETED': return 'badge-verified';
      case 'IN_PROGRESS': return 'badge-medium';
      case 'BLOCKED': return 'badge-critical';
      case 'UNDER_REVIEW': return 'badge-high';
      default: return 'badge-low';
    }
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '1.5rem',
        borderBottom: '1px solid var(--border-default)',
        paddingBottom: '1rem'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.5rem' }}>🤝</span>
            <h2 style={{ fontSize: '1.4rem', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
              Multi-Officer Collaboration Workspace
            </h2>
            <span className="badge badge-medium">CASE #{caseId}</span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            Role-Based Access Control • Task DAG Dependencies • Evidence Review Queue • Real-time Team Activity
          </p>
        </div>

        {/* Global Action Buttons */}
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowCreateTaskModal(true)}
            className="btn-primary"
            style={{ fontSize: '0.8rem', padding: '0.5rem 0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <span>➕</span> New Task
          </button>
          <button
            onClick={() => setShowAddMemberModal(true)}
            className="btn-secondary"
            style={{ fontSize: '0.8rem', padding: '0.5rem 0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <span>👤</span> Assign Officer
          </button>
          <button
            onClick={() => setShowTransferLeadModal(true)}
            className="btn-secondary"
            style={{ fontSize: '0.8rem', padding: '0.5rem 0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <span>🔄</span> Transfer Lead
          </button>
          <button
            onClick={loadCaseData}
            className="btn-secondary"
            style={{ fontSize: '0.8rem', padding: '0.5rem 0.9rem' }}
            title="Refresh Collaboration Data"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div style={{
          backgroundColor: 'rgba(230, 57, 70, 0.15)',
          border: '1px solid var(--accent-red)',
          color: '#ff8080',
          padding: '0.75rem 1rem',
          borderRadius: '4px',
          marginBottom: '1rem',
          fontSize: '0.85rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div><strong>⚠️ System Error:</strong> {error}</div>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: '#ff8080', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
        </div>
      )}

      {successMsg && (
        <div style={{
          backgroundColor: 'rgba(42, 157, 143, 0.15)',
          border: '1px solid #2a9d8f',
          color: '#48cae4',
          padding: '0.75rem 1rem',
          borderRadius: '4px',
          marginBottom: '1rem',
          fontSize: '0.85rem'
        }}>
          ✅ {successMsg}
        </div>
      )}

      {/* Collaboration Sub-navigation Bar */}
      <div style={{
        display: 'flex',
        gap: '0.4rem',
        borderBottom: '1px solid var(--border-default)',
        marginBottom: '1.5rem',
        overflowX: 'auto',
        paddingBottom: '0.5rem'
      }}>
        {[
          { id: 'tasks', label: '📋 Task Board', count: tasks.length },
          { id: 'team', label: '👥 Case Team', count: members.length },
          { id: 'reviews', label: '🔬 Evidence Review Queue', count: reviews.length },
          { id: 'activity', label: '📜 Activity Timeline', count: activity.length },
          { id: 'notifications', label: '🔔 Notifications', count: unreadCount, badgeClass: unreadCount > 0 ? 'badge-critical' : 'badge-low' },
          { id: 'analytics', label: '📊 Workload Analytics', count: null }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={activeSubTab === tab.id ? 'btn-primary' : 'btn-secondary'}
            style={{
              fontSize: '0.8rem',
              padding: '0.45rem 0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              whiteSpace: 'nowrap'
            }}
          >
            <span>{tab.label}</span>
            {tab.count !== null && (
              <span className={`badge ${tab.badgeClass || 'badge-low'}`} style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem' }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          🔄 Synchronizing investigation collaborative state...
        </div>
      )}

      {/* =========================================================================
          SUB-TAB 1: INVESTIGATION TASK BOARD
          ========================================================================= */}
      {activeSubTab === 'tasks' && (
        <div>
          {/* Filter Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            backgroundColor: 'var(--bg-secondary)',
            padding: '0.75rem 1rem',
            borderRadius: '4px',
            marginBottom: '1rem',
            border: '1px solid var(--border-default)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: '700' }}>STATUS:</span>
              {['ALL', 'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'UNDER_REVIEW', 'COMPLETED', 'BLOCKED'].map(st => (
                <button
                  key={st}
                  onClick={() => setTaskStatusFilter(st)}
                  className={taskStatusFilter === st ? 'btn-primary' : 'btn-secondary'}
                  style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}
                >
                  {st}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: '700' }}>PRIORITY:</span>
              <select
                value={taskPriorityFilter}
                onChange={(e) => setTaskPriorityFilter(e.target.value)}
                style={{
                  backgroundColor: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '4px',
                  padding: '0.3rem 0.6rem',
                  fontSize: '0.75rem'
                }}
              >
                <option value="ALL">All Priorities</option>
                <option value="CRITICAL">CRITICAL</option>
                <option value="HIGH">HIGH</option>
                <option value="NORMAL">NORMAL</option>
                <option value="LOW">LOW</option>
              </select>
            </div>
          </div>

          {/* Grid Layout: Task List + Task Details Drawer */}
          <div style={{ display: 'grid', gridTemplateColumns: selectedTask ? '1fr 1fr' : '1fr', gap: '1.25rem' }}>
            {/* Task Cards Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {filteredTasks.length === 0 ? (
                <div style={{
                  padding: '2rem',
                  textAlign: 'center',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px dashed var(--border-default)',
                  borderRadius: '4px',
                  color: 'var(--text-muted)'
                }}>
                  No investigation tasks match current filters. Click "New Task" above to initialize tasks.
                </div>
              ) : (
                filteredTasks.map(t => {
                  const isOverdue = t.status !== 'COMPLETED' && t.status !== 'CANCELLED' && t.due_date && new Date(t.due_date) < new Date();
                  const isSelected = selectedTask?.task_id === t.task_id;
                  return (
                    <div
                      key={t.task_id}
                      onClick={() => handleSelectTask(t)}
                      style={{
                        backgroundColor: isSelected ? 'rgba(230, 57, 70, 0.08)' : 'var(--bg-secondary)',
                        border: isSelected ? '1px solid var(--accent-red)' : '1px solid var(--border-default)',
                        borderRadius: '4px',
                        padding: '1rem',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span className={`badge ${getPriorityBadgeClass(t.priority)}`}>{t.priority}</span>
                          <span className={`badge ${getStatusBadgeClass(t.status)}`}>{t.status}</span>
                          {isOverdue && <span className="badge badge-critical">⚠️ OVERDUE</span>}
                        </div>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          TASK #{t.task_id} • v{t.version}
                        </span>
                      </div>

                      <h4 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                        {t.title}
                      </h4>

                      <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.6rem', lineHeight: 1.4 }}>
                        {t.description || 'No detailed instructions provided.'}
                      </p>

                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '0.72rem',
                        color: 'var(--text-muted)',
                        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                        paddingTop: '0.5rem',
                        fontFamily: 'var(--font-mono)'
                      }}>
                        <div>
                          👤 {t.assigned_officer_name ? `${t.assigned_officer_name} (${t.assigned_officer_badge})` : 'UNASSIGNED'}
                        </div>
                        <div>
                          ⏱️ Due: {t.due_date ? new Date(t.due_date).toLocaleDateString() : 'NO DEADLINE'}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Task Details & Dependencies Drawer */}
            {selectedTask && (
              <div style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-default)',
                borderRadius: '4px',
                padding: '1.25rem',
                position: 'sticky',
                top: '5rem',
                maxHeight: 'calc(100vh - 7rem)',
                overflowY: 'auto'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-default)', paddingBottom: '0.75rem' }}>
                  <div>
                    <span className="badge badge-medium">TASK #{selectedTask.task_id}</span>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                      {selectedTask.title}
                    </h3>
                  </div>
                  <button
                    onClick={() => setSelectedTask(null)}
                    className="btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                  >
                    ✕ Close
                  </button>
                </div>

                {/* Status Actions */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                  {selectedTask.status !== 'COMPLETED' && (
                    <button
                      onClick={() => handleCompleteTask(selectedTask.task_id)}
                      className="btn-primary"
                      style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
                    >
                      ✓ Mark Completed
                    </button>
                  )}
                  <button
                    onClick={() => setShowAddDepModal(true)}
                    className="btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
                  >
                    🔗 Add Dependency (DAG)
                  </button>
                </div>

                {/* Task Metadata */}
                <div style={{
                  backgroundColor: 'var(--bg-tertiary)',
                  padding: '0.75rem',
                  borderRadius: '4px',
                  marginBottom: '1rem',
                  fontSize: '0.75rem',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '0.5rem'
                }}>
                  <div><strong style={{ color: 'var(--text-secondary)' }}>Priority:</strong> <span className={`badge ${getPriorityBadgeClass(selectedTask.priority)}`}>{selectedTask.priority}</span></div>
                  <div><strong style={{ color: 'var(--text-secondary)' }}>Status:</strong> <span className={`badge ${getStatusBadgeClass(selectedTask.status)}`}>{selectedTask.status}</span></div>
                  <div><strong style={{ color: 'var(--text-secondary)' }}>Assigned:</strong> {selectedTask.assigned_officer_name || 'Unassigned'}</div>
                  <div><strong style={{ color: 'var(--text-secondary)' }}>Created By:</strong> {selectedTask.created_by_officer_name || 'System'}</div>
                  <div><strong style={{ color: 'var(--text-secondary)' }}>Due Date:</strong> {selectedTask.due_date ? new Date(selectedTask.due_date).toLocaleString() : 'N/A'}</div>
                  <div><strong style={{ color: 'var(--text-secondary)' }}>Version:</strong> v{selectedTaskDetails?.version || selectedTask.version}</div>
                </div>

                {/* Workflow Dependencies (DAG) */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                    Prerequisite Tasks (Blocks This Task)
                  </h4>
                  {selectedTaskDetails?.dependencies?.prerequisites?.length === 0 ? (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      No prerequisite dependencies. This task can be completed anytime.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {selectedTaskDetails?.dependencies?.prerequisites?.map(p => (
                        <div
                          key={p.dependency_id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            backgroundColor: 'var(--bg-tertiary)',
                            padding: '0.4rem 0.6rem',
                            borderRadius: '4px',
                            borderLeft: p.status === 'COMPLETED' ? '3px solid #2a9d8f' : '3px solid var(--accent-red)'
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                              #{p.depends_on_task_id} {p.title}
                            </div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                              Status: <span className={`badge ${getStatusBadgeClass(p.status)}`}>{p.status}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveDependency(p.dependency_id)}
                            style={{ background: 'none', border: 'none', color: '#ff8080', cursor: 'pointer', fontSize: '0.75rem' }}
                            title="Remove dependency link"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Progress Notes */}
                <div>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                    Investigation Progress Notes ({selectedTaskDetails?.notes?.length || 0})
                  </h4>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    {selectedTaskDetails?.notes?.map(n => (
                      <div
                        key={n.note_id}
                        style={{
                          backgroundColor: 'var(--bg-tertiary)',
                          padding: '0.6rem',
                          borderRadius: '4px',
                          border: '1px solid rgba(255, 255, 255, 0.05)'
                        }}
                      >
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-primary)', margin: 0, lineHeight: 1.4 }}>
                          {n.note_text}
                        </p>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.3rem', fontFamily: 'var(--font-mono)' }}>
                          ✍️ {n.author_name} ({n.author_badge}) • {new Date(n.created_at).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add Note Form */}
                  <form onSubmit={handleAddNote} style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text"
                      placeholder="Add investigation progress note..."
                      value={newNoteText}
                      onChange={(e) => setNewNoteText(e.target.value)}
                      style={{
                        flex: 1,
                        backgroundColor: 'var(--bg-tertiary)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-default)',
                        borderRadius: '4px',
                        padding: '0.4rem 0.6rem',
                        fontSize: '0.75rem'
                      }}
                    />
                    <button
                      type="submit"
                      className="btn-primary"
                      style={{ fontSize: '0.75rem', padding: '0.4rem 0.75rem' }}
                    >
                      Post Note
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          SUB-TAB 2: CASE TEAM (ROLE-BASED MEMBERSHIP)
          ========================================================================= */}
      {activeSubTab === 'team' && (
        <div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '1rem'
          }}>
            {members.map(m => (
              <div
                key={m.member_id}
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '4px',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span className="badge badge-medium">{m.role}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      MEMBER #{m.member_id}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                    {m.full_name}
                  </h3>
                  <div style={{ fontSize: '0.75rem', color: 'var(--accent-orange)', fontFamily: 'var(--font-mono)', marginBottom: '0.5rem' }}>
                    BADGE: {m.badge_number} • {m.rank_designation}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                    🏢 {m.department}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                    ✉️ {m.email || 'N/A'}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    📅 Assigned: {new Date(m.assigned_at).toLocaleDateString()}
                  </div>
                </div>

                <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '0.75rem', display: 'flex', justifyContent: 'flex-end' }}>
                  {m.role !== 'LEAD_INVESTIGATOR' && (
                    <button
                      onClick={() => handleRevokeMember(m.member_id, m.full_name)}
                      className="btn-secondary"
                      style={{ fontSize: '0.7rem', color: '#ff8080', padding: '0.3rem 0.6rem' }}
                    >
                      🚫 Revoke Access
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          SUB-TAB 3: EVIDENCE REVIEW QUEUE
          ========================================================================= */}
      {activeSubTab === 'reviews' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {reviews.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: 'var(--bg-secondary)', borderRadius: '4px', color: 'var(--text-muted)' }}>
              No evidence reviews currently pending. Review requests appear here when evidence is submitted.
            </div>
          ) : (
            reviews.map(r => (
              <div
                key={r.review_id}
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '4px',
                  padding: '1.25rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className={`badge ${r.review_status === 'VERIFIED' ? 'badge-verified' : 'badge-high'}`}>
                      {r.review_status}
                    </span>
                    <span className="badge badge-medium">{r.evidence_category}</span>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    REVIEW #{r.review_id} • EVIDENCE: {r.tracking_code}
                  </span>
                </div>

                <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                  {r.evidence_title}
                </h4>

                <div style={{
                  backgroundColor: 'var(--bg-tertiary)',
                  padding: '0.6rem 0.8rem',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  marginBottom: '0.75rem',
                  lineHeight: 1.4
                }}>
                  <strong style={{ color: 'var(--text-secondary)' }}>Reviewer Observations:</strong>{' '}
                  {r.reviewer_observations || 'Pending forensic reviewer evaluation.'}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    👤 Assigned Reviewer: <strong>{r.reviewer_name} ({r.reviewer_badge})</strong> • Integrity: {r.integrity_verification_status}
                  </div>
                  <button
                    onClick={() => {
                      setActiveReviewItem(r);
                      setReviewForm({
                        review_status: r.review_status || 'VERIFIED',
                        reviewer_observations: r.reviewer_observations || '',
                        integrity_verification_status: r.integrity_verification_status || 'VERIFIED',
                        metadata_review_status: r.metadata_review_status || 'APPROVED',
                        review_notes: r.review_notes || ''
                      });
                      setShowSubmitReviewModal(true);
                    }}
                    className="btn-primary"
                    style={{ fontSize: '0.72rem', padding: '0.35rem 0.7rem' }}
                  >
                    📝 Submit Review Findings
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* =========================================================================
          SUB-TAB 4: INVESTIGATION ACTIVITY TIMELINE
          ========================================================================= */}
      {activeSubTab === 'activity' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {activity.map(act => (
            <div
              key={act.activity_id}
              style={{
                backgroundColor: 'var(--bg-secondary)',
                borderLeft: '4px solid var(--accent-red)',
                borderTop: '1px solid var(--border-default)',
                borderRight: '1px solid var(--border-default)',
                borderBottom: '1px solid var(--border-default)',
                borderRadius: '0 4px 4px 0',
                padding: '0.85rem 1.25rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '1rem'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                  <span className="badge badge-medium" style={{ fontSize: '0.65rem' }}>{act.event_type}</span>
                  <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                    {act.actor_name} ({act.actor_badge})
                  </span>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
                  {act.event_description}
                </p>
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                {new Date(act.created_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* =========================================================================
          SUB-TAB 5: INTERNAL NOTIFICATION CENTER
          ========================================================================= */}
      {activeSubTab === 'notifications' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)' }}>
              Investigation Alerts ({notifications.length})
            </h3>
            <button
              onClick={handleMarkAllRead}
              className="btn-secondary"
              style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
            >
              ✓ Mark All Read
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: 'var(--bg-secondary)', borderRadius: '4px', color: 'var(--text-muted)' }}>
                No active notifications.
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.notification_id}
                  style={{
                    backgroundColor: n.is_read ? 'var(--bg-secondary)' : 'rgba(230, 57, 70, 0.08)',
                    border: n.is_read ? '1px solid var(--border-default)' : '1px solid var(--accent-red)',
                    borderRadius: '4px',
                    padding: '0.75rem 1rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                      <span className={`badge ${n.is_read ? 'badge-low' : 'badge-critical'}`}>{n.event_type}</span>
                      <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{n.title}</strong>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      {n.message}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.2rem', fontFamily: 'var(--font-mono)' }}>
                      {new Date(n.created_at).toLocaleString()}
                    </div>
                  </div>

                  {!n.is_read && (
                    <button
                      onClick={() => handleMarkNotifRead(n.notification_id)}
                      className="btn-secondary"
                      style={{ fontSize: '0.7rem', padding: '0.3rem 0.6rem' }}
                    >
                      Mark Read
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          SUB-TAB 6: CASE WORKLOAD & PROGRESS ANALYTICS
          ========================================================================= */}
      {activeSubTab === 'analytics' && analytics && (
        <div>
          {/* Top Metric Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            marginBottom: '1.5rem'
          }}>
            {[
              { label: 'Assigned Investigators', value: analytics.total_assigned_officers, icon: '👥' },
              { label: 'Total Tasks', value: analytics.total_tasks, icon: '📋' },
              { label: 'Active Tasks', value: analytics.active_tasks, icon: '⚡' },
              { label: 'Completed Tasks', value: analytics.completed_tasks, icon: '✓' },
              { label: 'Overdue Tasks', value: analytics.overdue_tasks, icon: '⚠️', alert: analytics.overdue_tasks > 0 },
              { label: 'Blocked Tasks', value: analytics.blocked_tasks, icon: '🛑', alert: analytics.blocked_tasks > 0 },
              { label: 'Pending Reviews', value: analytics.pending_evidence_reviews, icon: '🔬' },
              { label: 'Avg Completion Time', value: `${analytics.avg_task_completion_time_hours}h`, icon: '⏱️' }
            ].map((m, idx) => (
              <div
                key={idx}
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: m.alert ? '1px solid var(--accent-red)' : '1px solid var(--border-default)',
                  borderRadius: '4px',
                  padding: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.8rem'
                }}
              >
                <span style={{ fontSize: '1.6rem' }}>{m.icon}</span>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                    {m.label}
                  </div>
                  <div style={{ fontSize: '1.3rem', fontWeight: '800', color: m.alert ? 'var(--accent-red)' : 'var(--text-primary)' }}>
                    {m.value}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Progress Bar */}
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-default)',
            borderRadius: '4px',
            padding: '1.25rem',
            marginBottom: '1.5rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                OVERALL INVESTIGATION TASK COMPLETION VELOCITY
              </span>
              <span style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--accent-orange)' }}>
                {analytics.task_completion_percentage}%
              </span>
            </div>
            <div style={{
              width: '100%',
              height: '10px',
              backgroundColor: 'var(--bg-tertiary)',
              borderRadius: '5px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${analytics.task_completion_percentage}%`,
                height: '100%',
                backgroundColor: 'var(--accent-red)',
                transition: 'width 0.4s ease'
              }} />
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODALS
          ========================================================================= */}

      {/* Modal 1: Create Task */}
      {showCreateTaskModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-default)',
            borderRadius: '6px', padding: '1.5rem', width: '90%', maxWidth: '500px'
          }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '1rem' }}>
              Create Investigation Task
            </h3>
            <form onSubmit={handleCreateTask} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Task Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Subpoena Bank Transaction Records"
                  value={newTaskForm.title}
                  onChange={(e) => setNewTaskForm({ ...newTaskForm, title: e.target.value })}
                  style={{ width: '100%', backgroundColor: 'var(--bg-tertiary)', color: '#fff', border: '1px solid var(--border-default)', padding: '0.5rem', borderRadius: '4px', fontSize: '0.8rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Detailed Instructions</label>
                <textarea
                  rows="3"
                  placeholder="Operational specifics, requested artifacts, objectives..."
                  value={newTaskForm.description}
                  onChange={(e) => setNewTaskForm({ ...newTaskForm, description: e.target.value })}
                  style={{ width: '100%', backgroundColor: 'var(--bg-tertiary)', color: '#fff', border: '1px solid var(--border-default)', padding: '0.5rem', borderRadius: '4px', fontSize: '0.8rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Priority</label>
                  <select
                    value={newTaskForm.priority}
                    onChange={(e) => setNewTaskForm({ ...newTaskForm, priority: e.target.value })}
                    style={{ width: '100%', backgroundColor: 'var(--bg-tertiary)', color: '#fff', border: '1px solid var(--border-default)', padding: '0.5rem', borderRadius: '4px', fontSize: '0.8rem' }}
                  >
                    <option value="LOW">LOW</option>
                    <option value="NORMAL">NORMAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Assigned Officer</label>
                  <select
                    value={newTaskForm.assigned_officer_id}
                    onChange={(e) => setNewTaskForm({ ...newTaskForm, assigned_officer_id: e.target.value })}
                    style={{ width: '100%', backgroundColor: 'var(--bg-tertiary)', color: '#fff', border: '1px solid var(--border-default)', padding: '0.5rem', borderRadius: '4px', fontSize: '0.8rem' }}
                  >
                    <option value="">Unassigned</option>
                    {members.map(m => (
                      <option key={m.officer_id} value={m.officer_id}>
                        {m.full_name} ({m.badge_number})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Due Date</label>
                <input
                  type="datetime-local"
                  value={newTaskForm.due_date}
                  onChange={(e) => setNewTaskForm({ ...newTaskForm, due_date: e.target.value })}
                  style={{ width: '100%', backgroundColor: 'var(--bg-tertiary)', color: '#fff', border: '1px solid var(--border-default)', padding: '0.5rem', borderRadius: '4px', fontSize: '0.8rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowCreateTaskModal(false)} className="btn-secondary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Add Case Member */}
      {showAddMemberModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-default)',
            borderRadius: '6px', padding: '1.5rem', width: '90%', maxWidth: '450px'
          }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '1rem' }}>
              Assign Officer to Case
            </h3>
            <form onSubmit={handleAddMember} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Officer ID / System Identifier *</label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 3"
                  value={newMemberForm.officer_id}
                  onChange={(e) => setNewMemberForm({ ...newMemberForm, officer_id: e.target.value })}
                  style={{ width: '100%', backgroundColor: 'var(--bg-tertiary)', color: '#fff', border: '1px solid var(--border-default)', padding: '0.5rem', borderRadius: '4px', fontSize: '0.8rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Case Collaboration Role *</label>
                <select
                  value={newMemberForm.role}
                  onChange={(e) => setNewMemberForm({ ...newMemberForm, role: e.target.value })}
                  style={{ width: '100%', backgroundColor: 'var(--bg-tertiary)', color: '#fff', border: '1px solid var(--border-default)', padding: '0.5rem', borderRadius: '4px', fontSize: '0.8rem' }}
                >
                  <option value="INVESTIGATING_OFFICER">INVESTIGATING_OFFICER (Tasks, Leads, Evidence)</option>
                  <option value="FORENSIC_ANALYST">FORENSIC_ANALYST (Technical & Vault Tasks)</option>
                  <option value="EVIDENCE_REVIEWER">EVIDENCE_REVIEWER (Review Queue Oversight)</option>
                  <option value="READ_ONLY_REVIEWER">READ_ONLY_REVIEWER (Observer / External Legal)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowAddMemberModal(false)} className="btn-secondary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
                  Assign Officer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Transfer Leadership */}
      {showTransferLeadModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-default)',
            borderRadius: '6px', padding: '1.5rem', width: '90%', maxWidth: '450px'
          }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              Transfer Case Leadership
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Select an active team member to appoint as Lead Investigator. Only authorized command roles can initiate transfer.
            </p>
            <form onSubmit={handleTransferLeadership} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>New Lead Investigator *</label>
                <select
                  required
                  value={transferLeadId}
                  onChange={(e) => setTransferLeadId(e.target.value)}
                  style={{ width: '100%', backgroundColor: 'var(--bg-tertiary)', color: '#fff', border: '1px solid var(--border-default)', padding: '0.5rem', borderRadius: '4px', fontSize: '0.8rem' }}
                >
                  <option value="">Select Team Member</option>
                  {members.map(m => (
                    <option key={m.officer_id} value={m.officer_id}>
                      {m.full_name} ({m.badge_number}) • {m.role}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowTransferLeadModal(false)} className="btn-secondary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
                  Confirm Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: Add Task Dependency */}
      {showAddDepModal && selectedTask && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-default)',
            borderRadius: '6px', padding: '1.5rem', width: '90%', maxWidth: '450px'
          }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              Add Task Dependency Link
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Select prerequisite task that must be COMPLETED before <strong>Task #{selectedTask.task_id}</strong> can be finished.
            </p>
            <form onSubmit={handleAddDependency} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Prerequisite Task *</label>
                <select
                  required
                  value={depPrereqTaskId}
                  onChange={(e) => setDepPrereqTaskId(e.target.value)}
                  style={{ width: '100%', backgroundColor: 'var(--bg-tertiary)', color: '#fff', border: '1px solid var(--border-default)', padding: '0.5rem', borderRadius: '4px', fontSize: '0.8rem' }}
                >
                  <option value="">Select Prerequisite Task</option>
                  {tasks.filter(t => t.task_id !== selectedTask.task_id).map(t => (
                    <option key={t.task_id} value={t.task_id}>
                      #{t.task_id} {t.title} [{t.status}]
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowAddDepModal(false)} className="btn-secondary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
                  Link Dependency
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 5: Submit Evidence Review */}
      {showSubmitReviewModal && activeReviewItem && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-default)',
            borderRadius: '6px', padding: '1.5rem', width: '90%', maxWidth: '550px'
          }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              Submit Evidence Review Findings
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Evidence Item: <strong>{activeReviewItem.tracking_code}</strong> - {activeReviewItem.evidence_title}
            </p>
            <form onSubmit={handleSubmitReview} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Review Verdict *</label>
                  <select
                    value={reviewForm.review_status}
                    onChange={(e) => setReviewForm({ ...reviewForm, review_status: e.target.value })}
                    style={{ width: '100%', backgroundColor: 'var(--bg-tertiary)', color: '#fff', border: '1px solid var(--border-default)', padding: '0.5rem', borderRadius: '4px', fontSize: '0.8rem' }}
                  >
                    <option value="VERIFIED">VERIFIED (High Reliability)</option>
                    <option value="UNDER_REVIEW">UNDER_REVIEW (Active Inspection)</option>
                    <option value="REQUIRES_CLARIFICATION">REQUIRES_CLARIFICATION</option>
                    <option value="FLAGGED_FOR_RECHECK">FLAGGED_FOR_RECHECK</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Integrity Verification</label>
                  <select
                    value={reviewForm.integrity_verification_status}
                    onChange={(e) => setReviewForm({ ...reviewForm, integrity_verification_status: e.target.value })}
                    style={{ width: '100%', backgroundColor: 'var(--bg-tertiary)', color: '#fff', border: '1px solid var(--border-default)', padding: '0.5rem', borderRadius: '4px', fontSize: '0.8rem' }}
                  >
                    <option value="VERIFIED">VERIFIED (SHA-256 Valid)</option>
                    <option value="DISCREPANCY_DETECTED">DISCREPANCY_DETECTED</option>
                    <option value="FAILED">FAILED</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Reviewer Observations *</label>
                <textarea
                  required
                  rows="3"
                  placeholder="Record factual observations, calibration tests, technical notes..."
                  value={reviewForm.reviewer_observations}
                  onChange={(e) => setReviewForm({ ...reviewForm, reviewer_observations: e.target.value })}
                  style={{ width: '100%', backgroundColor: 'var(--bg-tertiary)', color: '#fff', border: '1px solid var(--border-default)', padding: '0.5rem', borderRadius: '4px', fontSize: '0.8rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowSubmitReviewModal(false)} className="btn-secondary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
                  Submit Findings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

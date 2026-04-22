import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import * as taskApi from '../api/taskApi.js';

function getWeekStart(dateStr) {
  const d    = new Date(dateStr + 'T12:00:00');
  const day  = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

export const TODAY       = new Date().toISOString().split('T')[0];
export const WEEK1_START = getWeekStart(TODAY);

export function getTaskSprintNum(dateStr) {
  const start    = new Date(WEEK1_START + 'T12:00:00');
  const date     = new Date(dateStr     + 'T12:00:00');
  const diffDays = Math.round((date - start) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return null;
  return Math.floor(diffDays / 7) + 1;
}

export function getSprintRange(num) {
  const s = new Date(WEEK1_START + 'T12:00:00');
  s.setDate(s.getDate() + (num - 1) * 7);
  const e = new Date(s);
  e.setDate(e.getDate() + 6);
  return {
    start: s.toISOString().split('T')[0],
    end:   e.toISOString().split('T')[0],
  };
}

export const CURRENT_SPRINT_NUM = getTaskSprintNum(TODAY) || 1;

export const DEFAULT_SPRINT_GOALS = {
  1: 'Complete all foundational coursework and stay ahead of deadlines this week.',
  2: 'Reinforce key topics and tackle advanced problem sets.',
  3: 'Deep review sessions and begin preparation for upcoming exams.',
};

function normalizeTask(task) {
  return {
    ...task,
    id:     task._id,
    date:   task.date.split('T')[0],
    done:   task.done || task.status === 'done',
    status: task.status || 'todo',
  };
}

function readHasGoogleCalendar() {
  try {
    const stored = localStorage.getItem('user');
    if (!stored) return false;
    return !!JSON.parse(stored).hasGoogleCalendar;
  } catch {
    return false;
  }
}

function buildSyncMessage(syncSummary) {
  if (!syncSummary) return '';
  const { deleted = 0, updated = 0 } = syncSummary;
  const parts = [];
  if (deleted > 0)
    parts.push(
      `${deleted} task${deleted !== 1 ? 's were' : ' was'} removed — ` +
      `Google Calendar event${deleted !== 1 ? 's were' : ' was'} deleted`
    );
  if (updated > 0)
    parts.push(
      `${updated} task${updated !== 1 ? 's were' : ' was'} updated from Google Calendar`
    );
  return parts.join(' · ');
}

const TaskCtx = createContext(null);

export function TaskProvider({ children }) {
  const [tasks,               setTasks]      = useState([]);
  const [sprintGoals,         setGoals]      = useState(DEFAULT_SPRINT_GOALS);
  const [loading,             setLoading]    = useState(true);
  const [error,               setError]      = useState(null);
  const [hasGoogleCalendar,   setHasGCal]    = useState(readHasGoogleCalendar);
  const [calendarSyncMessage, setSyncMsg]    = useState('');
  const [calendarSyncStatus,  setSyncStatus] = useState('idle');

  useEffect(() => {
    const sync = () => setHasGCal(readHasGoogleCalendar());
    window.addEventListener('storage', sync);
    let count = 0;
    const timer = setInterval(() => { sync(); if (++count >= 5) clearInterval(timer); }, 2000);
    return () => { window.removeEventListener('storage', sync); clearInterval(timer); };
  }, []);

  const loadTasks = useCallback(async (silent = false) => {
    try {
      if (!silent) { setLoading(true); setSyncStatus('syncing'); }
      setError(null);

      const { tasks: rawTasks, syncSummary } = await taskApi.fetchTasks();

      setTasks(rawTasks.map(normalizeTask));

      const msg = buildSyncMessage(syncSummary);
      if (msg) {
        setSyncMsg(msg);
        console.log('[TaskContext] Calendar sync result:', syncSummary, '→', msg);
      }
    } catch (err) {
      console.error('[TaskContext] Error loading tasks:', err);
      if (!silent) {
        setError(err.message);
        setTasks([]);
      }
    } finally {
      if (!silent) { setLoading(false); setSyncStatus('done'); }
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadTasks(false);
  }, [loadTasks]);

  // 45-second background polling
  useEffect(() => {
    const id = setInterval(() => {
      console.log('[TaskContext] Polling — background sync check');
      loadTasks(true);
    }, 45 * 1000);
    return () => clearInterval(id);
  }, [loadTasks]);

  // Tab-switch sync — fires the instant the user returns to this tab.
  // Edit or delete in Google Calendar, switch back here, changes appear in ~1-2s.
  const lastVisibilitySyncRef = useRef(0);
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastVisibilitySyncRef.current < 5000) return;
      lastVisibilitySyncRef.current = now;
      console.log('[TaskContext] Tab visible — triggering background sync');
      loadTasks(true);
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [loadTasks]);

  const toggle = async (id) => {
    try {
      const updated = await taskApi.toggleTaskDone(id);
      setTasks(prev => prev.map(t => t.id === id ? normalizeTask(updated) : t));
    } catch (err) {
      console.error('Error toggling task:', err);
    }
  };

  const remove = async (id) => {
    try {
      await taskApi.deleteExistingTask(id);
      setTasks(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      console.error('Error deleting task:', err);
    }
  };

  const addTask = async (data) => {
    try {
      const newTask = await taskApi.createNewTask({
        title:          data.title,
        subject:        data.subject,
        date:           data.date,
        startTime:      data.startTime,
        endTime:        data.endTime,
        priority:       data.priority,
        description:    data.description || '',
        syncToCalendar: hasGoogleCalendar && data.syncToCalendar === true,
      });
      setTasks(prev => [...prev, normalizeTask(newTask)]);
      return normalizeTask(newTask);
    } catch (err) {
      console.error('Error creating task:', err);
      setError(err.message);
      throw err;
    }
  };

  const editTask = async (id, data) => {
    try {
      const updated = await taskApi.updateExistingTask(id, {
        title:          data.title,
        subject:        data.subject,
        date:           data.date,
        startTime:      data.startTime,
        endTime:        data.endTime,
        priority:       data.priority,
        description:    data.description || '',
        syncToCalendar: hasGoogleCalendar ? data.syncToCalendar : false,
      });
      setTasks(prev => prev.map(t => t.id === id ? normalizeTask(updated) : t));
      return normalizeTask(updated);
    } catch (err) {
      console.error('Error updating task:', err);
      setError(err.message);
      throw err;
    }
  };

  const moveToCol = async (id, newStatus) => {
    try {
      const updated = await taskApi.updateStatusTask(id, newStatus);
      setTasks(prev => prev.map(t => t.id === id ? normalizeTask(updated) : t));
    } catch (err) {
      console.error('Error updating task status:', err);
    }
  };

  const updateGoal = (num, goal) => setGoals(prev => ({ ...prev, [num]: goal }));

  const dismissSyncMessage = () => setSyncMsg('');

  return (
    <TaskCtx.Provider value={{
      tasks,
      sprintGoals,
      hasGoogleCalendar,
      calendarSyncStatus,
      calendarSyncMessage,
      dismissSyncMessage,
      toggle,
      remove,
      addTask,
      editTask,
      moveToCol,
      updateGoal,
      loading,
      error,
    }}>
      {children}
    </TaskCtx.Provider>
  );
}

export function useTasks() {
  return useContext(TaskCtx);
}

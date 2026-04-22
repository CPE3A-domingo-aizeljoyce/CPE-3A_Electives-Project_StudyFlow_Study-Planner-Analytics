import axios from 'axios';

const API_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/tasks/`;

const getConfig = () => {
  const token = localStorage.getItem('token');
  return {
    headers: { Authorization: `Bearer ${token}` },
  };
};

// ✅ Returns { tasks: Task[], syncSummary: { deleted: number, updated: number } }
// The backend runs a live Google Calendar sync before responding, so
// the task list is already up-to-date when this promise resolves.
// syncSummary is read from the X-Calendar-Sync response header
// (server.js must have exposedHeaders: ['X-Calendar-Sync'] in CORS config).
export const fetchTasks = async () => {
  const response = await axios.get(API_URL, getConfig());

  let syncSummary = { deleted: 0, updated: 0 };
  try {
    const raw = response.headers['x-calendar-sync'];
    if (raw) syncSummary = JSON.parse(raw);
  } catch {
    // Malformed or missing header — degrade gracefully
  }

  return { tasks: response.data, syncSummary };
};

export const fetchTask = async (id) => {
  const response = await axios.get(`${API_URL}${id}`, getConfig());
  return response.data;
};

export const createNewTask = async (taskData) => {
  const response = await axios.post(API_URL, taskData, getConfig());
  return response.data;
};

export const updateExistingTask = async (id, taskData) => {
  const response = await axios.put(`${API_URL}${id}`, taskData, getConfig());
  return response.data;
};

export const deleteExistingTask = async (id) => {
  const response = await axios.delete(`${API_URL}${id}`, getConfig());
  return response.data;
};

export const toggleTaskDone = async (id) => {
  const response = await axios.patch(`${API_URL}${id}/toggle`, {}, getConfig());
  return response.data;
};

export const updateStatusTask = async (id, status) => {
  const response = await axios.patch(`${API_URL}${id}/status`, { status }, getConfig());
  return response.data;
};

export const syncTaskToCalendar = async (taskId) => {
  const response = await axios.post(`${API_URL}${taskId}/sync-calendar`, {}, getConfig());
  return response.data;
};

export const fetchCalendarEvents = async (startDate, endDate) => {
  const response = await axios.get(`${API_URL}calendar/events`, {
    ...getConfig(),
    params: {
      startDate: startDate.toISOString(),
      endDate:   endDate.toISOString(),
    },
  });
  return response.data;
};

export const fetchCalendarStats = async (startDate, endDate) => {
  const response = await axios.get(`${API_URL}calendar/stats`, {
    ...getConfig(),
    params: {
      startDate: startDate.toISOString(),
      endDate:   endDate.toISOString(),
    },
  });
  return response.data;
};

// Manual sync trigger — bypasses debounce on the backend
export const triggerCalendarSync = async () => {
  const response = await axios.post(
    `${API_URL}calendar/sync-from-calendar`,
    {},
    getConfig()
  );
  return response.data;
};
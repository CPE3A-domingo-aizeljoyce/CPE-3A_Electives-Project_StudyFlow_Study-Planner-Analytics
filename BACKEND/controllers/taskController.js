import Task from '../models/Task.js';
import User from '../models/User.js';
import { google } from 'googleapis';
import Goal from '../models/goalModel.js';
import { checkAndAwardAchievements } from '../utils/achievementService.js';

const calendar = google.calendar('v3');

const SYNC_DEBOUNCE_MS = 5 * 1000;

async function getOAuth2Client(userId) {
  const user = await User.findById(userId);
  if (!user || !user.googleRefreshToken) {
    throw new Error('User not connected to Google Calendar');
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.SERVER_URL + '/api/auth/google/callback'
  );

  oauth2Client.setCredentials({
    refresh_token: user.googleRefreshToken,
    access_token:  user.googleAccessToken,
    expiry_date:   user.googleTokenExpiry,
  });

  if (user.googleTokenExpiry && new Date() > new Date(user.googleTokenExpiry)) {
    const { credentials } = await oauth2Client.refreshAccessToken();
    user.googleAccessToken = credentials.access_token;
    user.googleTokenExpiry = credentials.expiry_date;
    await user.save();
    oauth2Client.setCredentials({
      refresh_token: user.googleRefreshToken,
      access_token:  credentials.access_token,
      expiry_date:   credentials.expiry_date,
    });
  }

  return oauth2Client;
}

function getCalendarColorFromPriority(priority) {
  return { high: '11', medium: '5', low: '8' }[priority] || '8';
}

function parseGCalDateTime(dateTimeStr) {
  if (!dateTimeStr) return { date: null, time: null };
  const dt = new Date(dateTimeStr);
  if (isNaN(dt.getTime())) return { date: null, time: null };

  const m = new Date(dt.getTime() + 8 * 60 * 60 * 1000);

  const date = [
    m.getUTCFullYear(),
    String(m.getUTCMonth() + 1).padStart(2, '0'),
    String(m.getUTCDate()).padStart(2, '0'),
  ].join('-');

  const time = [
    String(m.getUTCHours()).padStart(2, '0'),
    String(m.getUTCMinutes()).padStart(2, '0'),
  ].join(':');

  return { date, time };
}

// Reads the Subject: and Priority: lines from the GCal description.
// GCal description format written by the website:
//   Subject: Mathematics
//   Priority: high
//
// If the user edits these lines in GCal, the new values sync back.
// If a line is missing or Priority is not high/medium/low, it is skipped safely.
function parseGCalMetadata(raw) {
  if (!raw) return { subject: null, priority: null };
  const lines  = raw.split('\n');
  let subject  = null;
  let priority = null;
  for (const line of lines) {
    if (line.startsWith('Subject:'))
      subject  = line.replace('Subject:', '').trim() || null;
    if (line.startsWith('Priority:'))
      priority = line.replace('Priority:', '').trim().toLowerCase() || null;
  }
  if (priority && !['high', 'medium', 'low'].includes(priority)) priority = null;
  return { subject, priority };
}

async function syncCalendarToDatabase(userId, { forceSync = false } = {}) {
  const user = await User.findById(userId);
  if (!user || !user.googleRefreshToken) {
    return { deleted: 0, updated: 0, skipped: true };
  }

  const now = new Date();

  if (!forceSync && user.calendarLastSynced) {
    const elapsed = now - new Date(user.calendarLastSynced);
    if (elapsed < SYNC_DEBOUNCE_MS) {
      console.log(
        `[CalendarSync] Debounced — ${Math.round(elapsed / 1000)}s since last sync ` +
        `(limit: ${SYNC_DEBOUNCE_MS / 1000}s)`
      );
      return { deleted: 0, updated: 0, skipped: true };
    }
  }

  user.calendarLastSynced = now;
  await user.save();

  const syncedTasks = await Task.find({
    user:          userId,
    googleEventId: { $ne: null },
  });

  if (syncedTasks.length === 0) {
    console.log(`[CalendarSync] No synced tasks for user ${userId}`);
    return { deleted: 0, updated: 0 };
  }

  console.log(`[CalendarSync] Checking ${syncedTasks.length} synced task(s) against Google Calendar...`);

  let auth;
  try {
    auth = await getOAuth2Client(userId);
  } catch (authErr) {
    console.warn(`[CalendarSync] Auth error: ${authErr.message}`);
    return { deleted: 0, updated: 0, authError: true };
  }

  const fetches = syncedTasks.map(task =>
    calendar.events.get({
      auth,
      calendarId: 'primary',
      eventId:    task.googleEventId,
      fields:     'id,status,summary,description,start,end',
    }).catch(err => ({
      __error:     err,
      __taskId:    task._id,
      __taskTitle: task.title,
      __eventId:   task.googleEventId,
    }))
  );

  const results = await Promise.all(fetches);

  let deleted = 0;
  let updated = 0;

  for (let i = 0; i < syncedTasks.length; i++) {
    const task   = syncedTasks[i];
    const result = results[i];

    if (result.__error) {
      const err    = result.__error;
      const status = err.code || err.status || err?.response?.status || 0;

      if (status === 404 || status === 410) {
        console.log(
          `[CalendarSync] ✗ Event not found (${status}) — ` +
          `deleting task "${task.title}" (googleEventId: ${task.googleEventId})`
        );
        await Task.findByIdAndDelete(task._id);
        deleted++;
      } else {
        console.warn(
          `[CalendarSync] ⚠ Could not fetch event ${task.googleEventId}: ` +
          `${err.message} (status ${status}) — skipping`
        );
      }
      continue;
    }

    const event = result.data;

    if (event.status === 'cancelled') {
      console.log(
        `[CalendarSync] ✗ Event cancelled — ` +
        `deleting task "${task.title}" (googleEventId: ${task.googleEventId})`
      );
      await Task.findByIdAndDelete(task._id);
      deleted++;
      continue;
    }

    const changes = {};

    // Title
    if (event.summary && event.summary.trim() !== task.title.trim()) {
      console.log(`[CalendarSync] ✏ Title: "${task.title}" → "${event.summary.trim()}"`);
      changes.title = event.summary.trim();
    }

    // Subject and Priority — parsed from the description metadata lines
    const { subject: gSubject, priority: gPriority } = parseGCalMetadata(event.description);

    if (gSubject && gSubject !== task.subject) {
      console.log(`[CalendarSync] ✏ Subject: "${task.subject}" → "${gSubject}"`);
      changes.subject = gSubject;
    }

    if (gPriority && gPriority !== task.priority) {
      console.log(`[CalendarSync] ✏ Priority: "${task.priority}" → "${gPriority}"`);
      changes.priority = gPriority;
    }

    // Date + start time
    if (event.start?.dateTime) {
      const { date: gDate, time: gStart } = parseGCalDateTime(event.start.dateTime);
      const taskDateStr = task.date.toISOString().split('T')[0];

      if (gDate && gDate !== taskDateStr) {
        console.log(`[CalendarSync] ✏ Date: ${taskDateStr} → ${gDate}`);
        changes.date = new Date(gDate);
      }
      if (gStart && gStart !== task.startTime) {
        console.log(`[CalendarSync] ✏ Start: ${task.startTime} → ${gStart}`);
        changes.startTime = gStart;
      }
    }

    // End time
    if (event.end?.dateTime) {
      const { time: gEnd } = parseGCalDateTime(event.end.dateTime);
      if (gEnd && gEnd !== task.endTime) {
        console.log(`[CalendarSync] ✏ End: ${task.endTime} → ${gEnd}`);
        changes.endTime = gEnd;
      }
    }

    if (Object.keys(changes).length > 0) {
      changes.lastCalendarSyncAt = now;
      await Task.findByIdAndUpdate(task._id, changes);
      updated++;
      console.log(
        `[CalendarSync] ✓ Updated task "${task.title}" — fields: ` +
        Object.keys(changes).filter(k => k !== 'lastCalendarSyncAt').join(', ')
      );
    }
  }

  console.log(`[CalendarSync] ✅ Complete — ${deleted} deleted, ${updated} updated`);
  return { deleted, updated };
}

async function syncTaskToCalendarInternal(userId, task) {
  try {
    const auth    = await getOAuth2Client(userId);
    const dateStr = task.date.toISOString().split('T')[0];

    const eventData = {
      summary:     task.title,
      description: `Subject: ${task.subject}\nPriority: ${task.priority}`,
      start: {
        dateTime: `${dateStr}T${task.startTime}:00`,
        timeZone: 'Asia/Manila',
      },
      end: {
        dateTime: `${dateStr}T${task.endTime}:00`,
        timeZone: 'Asia/Manila',
      },
      colorId:      getCalendarColorFromPriority(task.priority),
      transparency: task.done ? 'transparent' : 'opaque',
    };

    let event;
    if (task.googleEventId) {
      event = await calendar.events.update({
        auth,
        calendarId: 'primary',
        eventId:    task.googleEventId,
        resource:   eventData,
      });
    } else {
      event = await calendar.events.insert({
        auth,
        calendarId: 'primary',
        resource:   eventData,
      });
    }

    return event.data.id;
  } catch (error) {
    console.error('[Calendar] Error syncing task to calendar:', error.message);
    throw new Error(`Failed to sync task to calendar: ${error.message}`);
  }
}

async function removeTaskFromCalendarInternal(userId, googleEventId) {
  try {
    if (!googleEventId) return true;
    const auth = await getOAuth2Client(userId);
    await calendar.events.delete({
      auth,
      calendarId: 'primary',
      eventId:    googleEventId,
    });
    return true;
  } catch (error) {
    if (error.code === 404 || error.code === 410 || error.status === 404 || error.status === 410) {
      return true;
    }
    console.error('[Calendar] Error removing event from calendar:', error.message);
    return false;
  }
}

async function markTaskDoneInCalendarInternal(userId, googleEventId, isDone) {
  try {
    if (!googleEventId) return;
    const auth  = await getOAuth2Client(userId);
    const event = await calendar.events.get({
      auth,
      calendarId: 'primary',
      eventId:    googleEventId,
    });
    event.data.transparency = isDone ? 'transparent' : 'opaque';
    await calendar.events.update({
      auth,
      calendarId: 'primary',
      eventId:    googleEventId,
      resource:   event.data,
    });
    return true;
  } catch (error) {
    console.error('[Calendar] Error updating event transparency:', error.message);
    return false;
  }
}

export const getTasks = async (req, res) => {
  try {
    let syncResult = { deleted: 0, updated: 0 };

    if (req.user.googleRefreshToken) {
      try {
        syncResult = await syncCalendarToDatabase(req.user.id);
      } catch (syncErr) {
        console.warn('[CalendarSync] Non-fatal error in getTasks:', syncErr.message);
      }
    }

    const tasks = await Task.find({ user: req.user.id }).sort({ date: 1, startTime: 1 });

    res.set('X-Calendar-Sync', JSON.stringify({
      deleted: syncResult.deleted || 0,
      updated: syncResult.updated || 0,
    }));

    res.status(200).json(tasks);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const createTask = async (req, res) => {
  try {
    const { title, subject, date, startTime, endTime, priority, description, syncToCalendar } = req.body;

    if (!title || !subject || !date || !startTime || !endTime)
      return res.status(400).json({ message: 'Missing required fields' });

    if (endTime <= startTime)
      return res.status(400).json({ message: 'End time must be after start time.' });

    const task = await Task.create({
      user:           req.user.id,
      title,
      subject,
      date:           new Date(date),
      startTime,
      endTime,
      priority:       priority || 'medium',
      status:         'todo',
      done:           false,
      description:    description || '',
      calendarSynced: false,
    });

    console.log(`[Tasks] Created "${task.title}" — syncToCalendar=${syncToCalendar}, hasToken=${!!req.user.googleRefreshToken}`);

    if (syncToCalendar && req.user.googleRefreshToken) {
      try {
        const googleEventId     = await syncTaskToCalendarInternal(req.user.id, task);
        task.googleEventId      = googleEventId;
        task.calendarSynced     = true;
        task.lastCalendarSyncAt = new Date();
        await task.save();
        console.log(`[Tasks] Calendar sync SUCCESS — eventId: ${googleEventId}`);
      } catch (calendarError) {
        task.calendarSynced = false;
        await task.save();
        console.warn(`[Tasks] Calendar sync FAILED: ${calendarError.message}`);
      }
    }

    res.status(201).json(task);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const getTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task)
      return res.status(404).json({ message: 'Task not found' });
    if (task.user.toString() !== req.user.id)
      return res.status(401).json({ message: 'Not authorized to access this task' });
    res.status(200).json(task);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const task    = await Task.findById(id);

    if (!task)
      return res.status(404).json({ message: 'Task not found' });
    if (task.user.toString() !== req.user.id)
      return res.status(401).json({ message: 'Not authorized to update this task' });

    const { syncToCalendar, ...fields } = req.body;
    const allowed = ['title', 'subject', 'date', 'startTime', 'endTime', 'priority', 'description', 'status', 'done'];
    for (const key of allowed) {
      if (fields[key] !== undefined)
        task[key] = key === 'date' ? new Date(fields[key]) : fields[key];
    }

    if (req.user.googleRefreshToken) {
      const shouldSync = syncToCalendar === true || (syncToCalendar === undefined && task.calendarSynced);
      if (shouldSync) {
        try {
          const googleEventId     = await syncTaskToCalendarInternal(req.user.id, task);
          task.googleEventId      = googleEventId;
          task.calendarSynced     = true;
          task.lastCalendarSyncAt = new Date();
          console.log(`[Tasks] Updated event in Calendar — eventId: ${googleEventId}`);
        } catch (calErr) {
          console.warn(`[Tasks] Calendar update failed: ${calErr.message}`);
        }
      } else if (syncToCalendar === false && task.googleEventId) {
        try {
          await removeTaskFromCalendarInternal(req.user.id, task.googleEventId);
          task.googleEventId  = null;
          task.calendarSynced = false;
          console.log(`[Tasks] Removed event from Calendar (sync disabled)`);
        } catch (calErr) {
          console.warn(`[Tasks] Calendar removal failed: ${calErr.message}`);
        }
      }
    }

    await task.save();
    res.status(200).json(task);
  } catch (error) {
    console.error('[Tasks] updateTask error:', error.message);
    res.status(500).json({ message: 'Failed to update task details' });
  }
};

export const deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task)
      return res.status(404).json({ message: 'Task not found' });
    if (task.user.toString() !== req.user.id)
      return res.status(401).json({ message: 'Not authorized to delete this task' });

    if (task.googleEventId && req.user.googleRefreshToken) {
      try {
        await removeTaskFromCalendarInternal(req.user.id, task.googleEventId);
      } catch (calendarError) {
        console.warn('[Tasks] Failed to remove event from calendar:', calendarError.message);
      }
    }

    await Task.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Task deleted successfully' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const toggleTask = async (req, res) => {
  try {
    let task = await Task.findById(req.params.id);
    if (!task)
      return res.status(404).json({ message: 'Task not found' });
    if (task.user.toString() !== req.user.id)
      return res.status(401).json({ message: 'Not authorized to update this task' });

    task.done   = !task.done;
    task.status = task.done ? 'done' : 'todo';
    task        = await task.save();

    if (task.googleEventId && req.user.googleRefreshToken) {
      try {
        await markTaskDoneInCalendarInternal(req.user.id, task.googleEventId, task.done);
      } catch (calendarError) {
        console.warn('[Tasks] Failed to update event transparency:', calendarError.message);
      }
    }

    if (task.done) {
      checkAndAwardAchievements(req.user.id)
        .catch(err => console.error('[Achievements] toggleTask hook error:', err.message));
    }

    res.status(200).json(task);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const updateTaskStatus = async (req, res) => {
  try {
    const { id }     = req.params;
    const { status } = req.body;
    const task = await Task.findByIdAndUpdate(id, { status }, { new: true });
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.status(200).json(task);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update task status' });
  }
};

export const syncTaskToCalendar = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task)
      return res.status(404).json({ message: 'Task not found' });
    if (task.user.toString() !== req.user.id)
      return res.status(401).json({ message: 'Not authorized to update this task' });
    if (!req.user.googleRefreshToken)
      return res.status(400).json({ message: 'User not connected to Google Calendar' });

    const googleEventId     = await syncTaskToCalendarInternal(req.user.id, task);
    task.googleEventId      = googleEventId;
    task.calendarSynced     = true;
    task.lastCalendarSyncAt = new Date();
    await task.save();

    res.status(200).json({ message: 'Task synced to calendar', task });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const getCalendarEvents = async (req, res) => {
  try {
    if (!req.user.googleRefreshToken)
      return res.status(400).json({ message: 'User not connected to Google Calendar' });

    const { startDate, endDate } = req.query;
    if (!startDate || !endDate)
      return res.status(400).json({ message: 'startDate and endDate query params required' });

    const auth   = await getOAuth2Client(req.user.id);
    const events = await calendar.events.list({
      auth,
      calendarId:   'primary',
      timeMin:      new Date(startDate).toISOString(),
      timeMax:      new Date(endDate).toISOString(),
      singleEvents: true,
      orderBy:      'startTime',
      fields:       'items(id,summary,start,end,description,colorId)',
    });

    res.status(200).json(events.data.items || []);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const getCalendarStats = async (req, res) => {
  try {
    if (!req.user.googleRefreshToken)
      return res.status(400).json({ message: 'User not connected to Google Calendar' });

    const { startDate, endDate } = req.query;
    if (!startDate || !endDate)
      return res.status(400).json({ message: 'startDate and endDate query params required' });

    const auth   = await getOAuth2Client(req.user.id);
    const events = await calendar.events.list({
      auth,
      calendarId:   'primary',
      timeMin:      new Date(startDate).toISOString(),
      timeMax:      new Date(endDate).toISOString(),
      singleEvents: true,
      orderBy:      'startTime',
      fields:       'items(id,summary,start,end,description,colorId,transparency)',
    });

    const items = events.data.items || [];
    const stats = {
      totalEvents:     items.length,
      completedEvents: items.filter(e => e.transparency === 'transparent').length,
      byColor:         {},
      totalDuration:   0,
    };

    items.forEach(event => {
      const color          = event.colorId || '8';
      stats.byColor[color] = (stats.byColor[color] || 0) + 1;
      if (event.start.dateTime && event.end.dateTime) {
        stats.totalDuration +=
          (new Date(event.end.dateTime) - new Date(event.start.dateTime)) / (1000 * 60);
      }
    });

    res.status(200).json(stats);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const syncFromCalendar = async (req, res) => {
  try {
    if (!req.user.googleRefreshToken) {
      return res.status(200).json({
        message:      'No Google Calendar connected.',
        deletedCount: 0,
        updatedCount: 0,
        deletedTasks: [],
      });
    }

    const result = await syncCalendarToDatabase(req.user.id, { forceSync: true });

    res.status(200).json({
      message:      `Sync complete — ${result.deleted || 0} removed, ${result.updated || 0} updated.`,
      deletedCount: result.deleted || 0,
      updatedCount: result.updated || 0,
      deletedTasks: [],
    });
  } catch (err) {
    console.error('[syncFromCalendar] Error:', err.message);
    res.status(200).json({
      message:      `Sync skipped: ${err.message}`,
      deletedCount: 0,
      updatedCount: 0,
      deletedTasks: [],
      error:        true,
    });
  }
};

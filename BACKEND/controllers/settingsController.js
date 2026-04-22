import UserSettings from '../models/UserSettings.js';

const defaultProfile = {
  name: 'Moran', email: 'secret@gmail.com', username: 'mrnski',
  bio: 'CS student passionate about math and physics. Aiming for a perfect GPA!',
  timezone: 'America/New_York', studyGoal: 4,
};

const defaultNotifs = {
  taskReminders: true, breakReminders: true, dailyDigest: false,
  achievementAlerts: true, streakWarning: true, weeklyReport: true,
  emailNotifs: false, soundAlerts: true,
};

const defaultTimer = {
  focusDuration: 25, shortBreak: 5, longBreak: 15,
  sessionsBeforeLong: 4, autoStartBreaks: true, autoStartSessions: false,
  soundEnabled: true, notifyOnComplete: true,
};

export const getSettings = async (req, res) => {
  try {
    const settings = await UserSettings.findOne({ userId: req.user._id });
    if (!settings) {
      return res.json({ profile: defaultProfile, notifs: defaultNotifs, timer: defaultTimer });
    }
    res.json({
      profile: settings.profile,
      notifs: settings.notifs,
      timer: settings.timer,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

export const updateSettings = async (req, res) => {
  try {
    const { profile, notifs, timer } = req.body;
    const updatedSettings = await UserSettings.findOneAndUpdate(
      { userId: req.user._id },
      {
        profile: { ...defaultProfile, ...profile },
        notifs: { ...defaultNotifs, ...notifs },
        timer: { ...defaultTimer, ...timer },
      },
      { upsert: true, new: true }
    );
    res.json({ message: 'Settings updated successfully', data: updatedSettings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};
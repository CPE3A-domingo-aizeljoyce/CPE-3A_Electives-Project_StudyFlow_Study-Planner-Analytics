// SETTINGS ROUTES
// Manages user preferences and app settings
//
// Connected frontend:
// - Settings.jsx
//
// Uses:
// - Controller: settingsController.js
// - Model: UserSettings.js
// - Middleware: authMiddleware.js

import express from 'express';
import { getSettings, updateSettings } from '../controllers/settingsController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

router.get('/', getSettings);
router.put('/', updateSettings);

export default router;

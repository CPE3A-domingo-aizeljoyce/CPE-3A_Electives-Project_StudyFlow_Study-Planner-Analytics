import express from 'express';
import { createGoal, getGoals } from '../controllers/goalController.js';

import { protect } from '../middleware/authMiddleware.js'; 

const router = express.Router();

router.route('/').get(protect, getGoals).post(protect, createGoal);

export default router;
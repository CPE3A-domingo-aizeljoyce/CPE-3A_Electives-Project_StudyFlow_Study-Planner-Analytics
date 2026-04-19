import express from 'express';
import {
  register,
  login,
  verifyEmail,
  googleAuth,
  getGoogleAuthUrl,
  googleCallback,
  forgotPassword,
  resetPassword,
  getMe,
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/register',        register);
router.post('/login',           login);
router.get ('/verify-email',    verifyEmail);
router.post('/google',          googleAuth);
router.get ('/google/url',      getGoogleAuthUrl);   // ← NEW
router.get ('/google/callback', googleCallback);     // ← NEW
router.post('/forgot-password', forgotPassword);
router.post('/reset-password',  resetPassword);
router.get ('/me',              protect, getMe);

export default router;
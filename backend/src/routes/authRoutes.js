import express from 'express';
// 👇 MAKE SURE getMe IS IN THIS LIST RIGHT HERE 👇
import { login, register, getMe, updateMyProfilePicture, updateMyProfile } from '../controllers/authController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { uploadProfilePicture } from '../middleware/profileImageUpload.js';

const router = express.Router();

router.post('/login', login);
router.post('/register', register);
router.get('/me', protect, getMe);
router.put('/me/profile', protect, authorize('buyer'), updateMyProfile);
router.post('/me/profile-picture', protect, authorize('buyer'), uploadProfilePicture, updateMyProfilePicture);

export default router;
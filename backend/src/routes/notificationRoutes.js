import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  getMyNotifications,
  getMyUnreadCount,
  markMyNotificationRead,
  markMyNotificationsRead,
} from '../controllers/NotificationController.js';

const router = express.Router();

router.get('/', protect, getMyNotifications);
router.get('/unread-count', protect, getMyUnreadCount);
router.patch('/read-all', protect, markMyNotificationsRead);
router.patch('/:id/read', protect, markMyNotificationRead);

export default router;

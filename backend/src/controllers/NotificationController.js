import mongoose from 'mongoose';
import Notification from '../models/Notification.js';
import { sendSuccess } from '../utils/response.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';
import AppError from '../utils/errors.js';

export const getMyNotifications = asyncHandler(async (req, res) => {
  const notifications = await Notification.find({ recipientId: req.user._id })
    .sort({ createdAt: -1 })
    .limit(50);
  return sendSuccess(res, 200, 'Notifications fetched successfully.', notifications);
});

export const getMyUnreadCount = asyncHandler(async (req, res) => {
  const count = await Notification.countDocuments({ recipientId: req.user._id, read: false });
  return sendSuccess(res, 200, 'Unread notification count fetched successfully.', { count });
});

export const markMyNotificationsRead = asyncHandler(async (req, res) => {
  const result = await Notification.updateMany(
    { recipientId: req.user._id, read: false },
    { $set: { read: true } }
  );
  return sendSuccess(res, 200, 'Notifications marked as read.', { updatedCount: result.modifiedCount });
});

export const markMyNotificationRead = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new AppError('Notification not found.', 404);
  }
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, recipientId: req.user._id },
    { $set: { read: true } },
    { new: true }
  );
  if (!notification) throw new AppError('Notification not found.', 404);
  return sendSuccess(res, 200, 'Notification marked as read.', notification);
});

import mongoose from 'mongoose';

export const NOTIFICATION_TYPES = [
  'inquiry_new',
  'site_visit_new',
  'inquiry_responded',
  'inquiry_closed',
  'inquiry_converted',
  'site_visit_scheduled',
  'site_visit_completed',
  'site_visit_responded',
];

const notificationSchema = new mongoose.Schema(
  {
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true,
    },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    relatedId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'relatedModel',
    },
    relatedModel: {
      type: String,
      enum: ['Inquiry', 'SiteVisit'],
      required: true,
    },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model('Notification', notificationSchema);

import mongoose from 'mongoose';

export const SITE_VISIT_STATUSES = ['Pending', 'Scheduled', 'Completed'];

const siteVisitSchema = new mongoose.Schema(
  {
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'A buyer is required'],
    },
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      required: [true, 'A property is required'],
    },
    preferredDate: {
      type: Date,
      required: [true, 'A preferred date is required'],
      validate: {
        validator: function(value) {
          const today = new Date();
          // Reset time to start of day for comparison
          today.setUTCHours(0, 0, 0, 0);
          return value >= today;
        },
        message: 'Preferred date cannot be in the past',
      },
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    adminResponse: {
      type: String,
      trim: true,
      maxlength: [2000, 'Admin response cannot exceed 2000 characters'],
      default: '',
    },
    status: {
      type: String,
      enum: SITE_VISIT_STATUSES,
      default: 'Pending',
    },
  },
  { timestamps: true }
);

siteVisitSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

siteVisitSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.adminResponse = ret.adminResponse ?? '';
    return ret;
  },
});

export default mongoose.model('SiteVisit', siteVisitSchema);

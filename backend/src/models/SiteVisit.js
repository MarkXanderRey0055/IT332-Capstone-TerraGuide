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
    },
    notes: {
      type: String,
      trim: true,
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

siteVisitSchema.set('toJSON', { virtuals: true });

export default mongoose.model('SiteVisit', siteVisitSchema);

import mongoose from 'mongoose';

export const INQUIRY_STATUSES = ['Pending', 'Responded'];

const inquirySchema = new mongoose.Schema(
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
    message: {
      type: String,
      required: [true, 'A message is required'],
      trim: true,
      maxlength: [1000, 'Message cannot exceed 1000 characters'],
    },
    adminResponse: {
      type: String,
      trim: true,
      maxlength: [2000, 'Admin response cannot exceed 2000 characters'],
      default: '',
    },
    status: {
      type: String,
      enum: INQUIRY_STATUSES,
      default: 'Pending',
    },
  },
  { timestamps: true }
);

inquirySchema.virtual('id').get(function () {
  return this._id.toHexString();
});

inquirySchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.adminResponse = ret.adminResponse ?? '';
    return ret;
  },
});

export default mongoose.model('Inquiry', inquirySchema);

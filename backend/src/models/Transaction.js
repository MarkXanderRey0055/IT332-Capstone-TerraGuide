import mongoose from 'mongoose';
export const TRANSACTION_STATUSES = ['Reserved', 'Processing', 'Completed', 'Cancelled'];
export const ACTIVE_TRANSACTION_STATUSES = ['Reserved', 'Processing'];

const transactionSchema = new mongoose.Schema(
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

    amount: {
      type: Number,
      required: [true, 'Transaction amount is required'],
      min: [0, 'Amount must be greater than or equal to 0'],
    },
    status: {
      type: String,
      enum: TRANSACTION_STATUSES,
      default: 'Reserved',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    
    completedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);


transactionSchema.virtual('id').get(function () {
  return this._id.toHexString();
});


transactionSchema.virtual('reference').get(function () {
  return `TXN-${this._id.toHexString().slice(-6).toUpperCase()}`;
});

transactionSchema.set('toJSON', { virtuals: true });

export default mongoose.model('Transaction', transactionSchema);

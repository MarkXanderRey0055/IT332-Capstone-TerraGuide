import mongoose from 'mongoose';
export const TRANSACTION_STATUSES = ['Reserved', 'Processing', 'Completed', 'Cancelled'];
export const ACTIVE_TRANSACTION_STATUSES = ['Reserved', 'Processing'];

const correctionSchema = new mongoose.Schema(
  {
    reason: { type: String, required: [true, 'A correction reason is required'], trim: true },
    correctedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    correctedAt: { type: Date, default: Date.now },
    original: {
      amount: { type: Number, required: true },
      notes: { type: String, default: '' },
    },
    revised: {
      amount: { type: Number, required: true },
      notes: { type: String, default: '' },
    },
  },
  { _id: true }
);

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
      min: [0.01, 'Amount must be greater than zero'],
    },
    listingPriceAtCreation: {
      type: Number,
      min: [0, 'Listing price must be zero or greater'],
      default: null,
    },
    correctionHistory: { type: [correctionSchema], default: [] },
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

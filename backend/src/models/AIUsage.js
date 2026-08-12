import mongoose from 'mongoose';

// One document per day. "date" is a YYYY-MM-DD key computed in Philippine
// time (see utils/aiUsageTime.js) so the daily reset lines up with local
// midnight regardless of what timezone the server itself runs in.
const aiUsageSchema = new mongoose.Schema(
  {
    date: {
      type: String,
      required: true,
      unique: true,
    },
    totalRequests: {
      type: Number,
      default: 0,
    },
    complianceRequests: {
      type: Number,
      default: 0,
    },
    portfolioRequests: {
      type: Number,
      default: 0,
    },
    marketInsightRequests: {
      type: Number,
      default: 0,
    },
    // Snapshot of the limit that was in effect when this day's record was
    // first created — mainly so a mid-day .env change doesn't retroactively
    // change what earlier requests on the same day were checked against.
    dailyLimit: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model('AIUsage', aiUsageSchema);

import mongoose from 'mongoose';

// A lightweight fixed-window rate limiter: one document per 60-second
// window (windowId = Math.floor(Date.now() / 60000)), incremented
// atomically the same way the daily quota is. This is a lighter-weight
// mechanism than a true sliding log — it can, in the worst case, allow a
// short burst near a window boundary to approach roughly double the
// configured limit across the boundary — but it needs no extra
// infrastructure beyond MongoDB, and it fully prevents the "two
// concurrent requests both read count=34 and both proceed" race that a
// naive count-then-insert approach would allow, because the increment and
// the limit check happen as a single atomic MongoDB operation.
const aiRateLimitSchema = new mongoose.Schema({
  windowId: {
    type: Number,
    required: true,
    unique: true,
  },
  count: {
    type: Number,
    default: 0,
  },
  // TTL cleanup — windows are only ever relevant for ~60s, so old ones
  // are purged automatically instead of accumulating forever.
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 120,
  },
});

export default mongoose.model('AIRateLimit', aiRateLimitSchema);

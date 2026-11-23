import mongoose from 'mongoose';

const searchEventSchema = new mongoose.Schema({
  buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  propertyType: { type: String, trim: true },
  location: {
    type: String,
    set(value) {
      return typeof value === 'string'
        ? value.trim().toLowerCase().replace(/\s+/g, ' ')
        : value;
    },
  },
  minPrice: { type: Number },
  maxPrice: { type: Number },
  resultCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now, index: true },
});

export default mongoose.model('SearchEvent', searchEventSchema);

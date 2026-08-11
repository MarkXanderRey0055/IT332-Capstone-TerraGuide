import mongoose from 'mongoose';
export const CABINET_COLORS = ['green', 'blue', 'orange', 'purple', 'red', 'gray'];

const cabinetSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Cabinet name is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    capacity: {
      type: Number,
      required: [true, 'Cabinet capacity is required'],
      min: [1, 'Capacity must be at least 1'],
    },
    color: {
      type: String,
      enum: CABINET_COLORS,
      default: 'green',
    },
  },
  {
    timestamps: true,
  }
);

// Same frontend-compatibility pattern used on Property — gives the
// frontend a plain `id` string instead of dealing with `_id` directly.
cabinetSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

cabinetSchema.set('toJSON', { virtuals: true });

export default mongoose.model('Cabinet', cabinetSchema);
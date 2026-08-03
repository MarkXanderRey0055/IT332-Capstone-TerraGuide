import mongoose from 'mongoose';

const propertySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Property name is required'],
      trim: true,
    },
    owner: {
      type: String,
      trim: true,
      default: '',
    },
    location: {
      type: String,
      required: [true, 'Location is required'],
      trim: true,
    },
    type: {
      type: String,
      enum: ['Residential', 'House & Lot', 'Agricultural', 'Commercial', 'Condominium'],
      required: [true, 'Property type is required'],
    },
    // Optional-ish extras the admin form collects — title/description aren't
    // filled in by the current form but we leave room for them, and size/
    // pricePerSqm/images are things the form already computes and sends.
    title: {
      type: String,
      trim: true,
      default: '',
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price must be greater than or equal to 0'],
    },
    size: {
      type: Number,
      default: 0,
    },
    pricePerSqm: {
      type: Number,
      default: 0,
    },
    images: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ['Available', 'Reserved', 'Sold'],
      default: 'Available',
    },
    lat: {
      type: Number,
      required: [true, 'Latitude is required'],
    },
    lng: {
      type: Number,
      required: [true, 'Longitude is required'],
    },
    lotSize: {
      type: Number,
      default: 0,
    },
    documents: {
      deed: {
        type: String,
        enum: ['pending', 'verified', 'missing'],
        default: 'pending',
      },
      tax: {
        type: String,
        enum: ['pending', 'verified', 'missing'],
        default: 'pending',
      },
      survey: {
        type: String,
        enum: ['pending', 'verified', 'missing'],
        default: 'pending',
      },
    },
  },
  {
    timestamps: true,
  }
);

// frontend compatibility 
propertySchema.virtual('id').get(function () {
  return this._id.toHexString();
});

propertySchema.set('toJSON', {
  virtuals: true,
});

export default mongoose.model('Property', propertySchema);
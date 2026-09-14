import mongoose from "mongoose";

const buyerPreferenceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    budgetMin: {
      type: Number,
      default: null,
    },

    budgetMax: {
      type: Number,
      default: null,
    },

    landType: {
      type: String,
      enum: [
        "Residential",
        "Commercial",
        "Agricultural",
        "Condominium",
        "House & Lot",
      ],
      default: null,
    },

    intendedUse: {
      type: String,
      enum: [
        "Primary Residence",
        "Investment",
        "Business",
        "Farming",
        "Vacation Home",
      ],
      default: null,
    },

    location: {
      type: String,
      default: null,
    },

    minLotSize: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model(
  "BuyerPreference",
  buyerPreferenceSchema
);
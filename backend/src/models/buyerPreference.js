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
      required: true,
    },

    budgetMax: {
      type: Number,
      required: true,
    },

    landType: {
      type: String,
      required: true,
      enum: [
        "Residential",
        "Commercial",
        "Agricultural",
        "Condominium",
        "House & Lot",
      ],
    },

    intendedUse: {
      type: String,
      required: true,
      enum: [
        "Primary Residence",
        "Investment",
        "Business",
        "Farming",
        "Vacation Home",
      ],
    },

    location: {
      type: String,
      required: true,
    },

    minLotSize: {
      type: Number,
      required: true,
      default: 0,
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
import mongoose from 'mongoose';

const auditSchema = new mongoose.Schema({
  propertyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: [true, 'propertyId is required'],
  },
  generatedAt: {
    type: Date,
    default: Date.now,
  },
  model: {
    type: String,
    default: 'meta/llama-3.1-8b-instruct',
  },
  complianceScore: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
  },
  estimatedSuccessRate: {
    type: Number,
    required: true,
    default: 50,
  },
  potentialSuccessRate: {
    type: Number,
    required: true,
    default: 90,
  },
  riskLevel: {
    type: String,
    enum: ['High', 'Medium', 'Low'],
    required: true,
  },
  verifiedDocuments: {
    type: Number,
    required: true,
  },
  totalDocuments: {
    type: Number,
    required: true,
  },
  missingItems: {
    type: [String],
    default: [],
  },
  summary: {
    type: String,
    required: true,
  },
  recommendation: {
    type: String,
    required: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
});

export default mongoose.model('Audit', auditSchema);
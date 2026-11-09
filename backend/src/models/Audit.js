import mongoose from 'mongoose';

const readinessFindingSchema = new mongoose.Schema(
  {
    category: { type: String, required: true },
    field: { type: String, required: true },
    severity: { type: String, enum: ['critical', 'non_critical'] },
    code: { type: String, required: true },
    message: { type: String, required: true },
  },
  { _id: false }
);

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
    default: 'meta/llama-3.2-11b-vision-instruct',
  },
  methodologyVersion: { type: String, default: null },
  documentWeights: {
    deed: { type: Number },
    tax: { type: Number },
    survey: { type: Number },
  },
  documentStatuses: {
    deed: { type: String, enum: ['pending', 'verified', 'missing'] },
    tax: { type: String, enum: ['pending', 'verified', 'missing'] },
    survey: { type: String, enum: ['pending', 'verified', 'missing'] },
  },
  documentCompleteness: { type: Number, min: 0, max: 100 },
  readinessSourceSnapshot: {
    version: { type: Number },
    name: { type: String, default: null },
    type: { type: String, default: null },
    location: { type: String, default: null },
    price: { type: Number, default: null },
    size: { type: Number, default: null },
    lotSize: { type: Number, default: null },
    description: { type: String, default: null },
    suitableFor: { type: [String], default: [] },
    status: { type: String, default: null },
    documents: {
      deed: { type: String, default: null },
      tax: { type: String, default: null },
      survey: { type: String, default: null },
    },
    verificationRemarks: { type: String, default: null },
  },
  readinessFingerprint: { type: String, default: null },
  readinessClassification: { type: String, default: null },
  readinessClassificationLabel: { type: String, default: null },
  readinessIsReadyForPresentation: { type: Boolean, default: false },
  readinessCriticalIssues: { type: [readinessFindingSchema], default: [] },
  readinessPendingItems: { type: [readinessFindingSchema], default: [] },
  readinessNonCriticalIssues: { type: [readinessFindingSchema], default: [] },
  complianceScore: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
  },
  estimatedSuccessRate: {
    type: Number,
    required: true,
  },
  potentialSuccessRate: {
    type: Number,
    required: true,
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
  pendingItems: { type: [String], default: [] },
  unknownStatuses: { type: [mongoose.Schema.Types.Mixed], default: [] },
  summary: {
    type: String,
    required: true,
  },
  recommendation: {
    type: String,
    required: true,
  },
  narrativeOrigin: {
    type: String,
    enum: ['AI_GENERATED', 'SYSTEM_FALLBACK'],
    default: null,
  },
  narrativeFallbackReason: {
    type: String,
    enum: ['AI_UNAVAILABLE', 'AI_INVALID_RESPONSE', 'AI_CONTRADICTORY_RESPONSE'],
    default: null,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
});

export default mongoose.model('Audit', auditSchema);

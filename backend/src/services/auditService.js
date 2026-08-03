import Property from '../models/Property.js';
import Audit from '../models/Audit.js';
import AppError from '../utils/errors.js';
import { generateComplianceInsights } from './geminiService.js';

const DOCUMENT_LABELS = {
  tax: 'Tax Declaration',
  deed: 'Deed of Sale',
  survey: 'Survey Plan',
};

function computeDocumentStats(documents) {
  const keys = Object.keys(DOCUMENT_LABELS);
  const totalDocuments = keys.length;

  const verifiedDocuments = keys.filter(
    (key) => documents?.[key] === 'verified'
  ).length;

  const missingItems = keys
    .filter((key) => documents?.[key] !== 'verified')
    .map((key) => DOCUMENT_LABELS[key]);

  const verifiedList = keys
    .filter((key) => documents?.[key] === 'verified')
    .map((key) => DOCUMENT_LABELS[key]);

  return { verifiedDocuments, totalDocuments, missingItems, verifiedList };
}

export async function generateAudit(propertyId, adminUserId) {
  const property = await Property.findById(propertyId);
  if (!property) {
    throw new AppError('Property not found.', 404);
  }

  const { verifiedDocuments, totalDocuments, missingItems, verifiedList } =
    computeDocumentStats(property.documents);

  // 1. Calculate Compliance Score
  const complianceScore = Math.round(
    (verifiedDocuments / totalDocuments) * 100
  );

  // 2. Derive Risk Level
  let riskLevel = 'High';
  if (complianceScore >= 70) {
    riskLevel = 'Low';
  } else if (complianceScore >= 40) {
    riskLevel = 'Medium';
  }

  // 3. Derive Success Rates (Business Intelligence Metrics)
  const estimatedSuccessRate = Math.round(35 + complianceScore * 0.55);
  const potentialSuccessRate = 90; // Standard benchmark for 100% compliant listings

  // 4. Send clean facts to AI
  const { summary, recommendation } = await generateComplianceInsights({
    propertyName: property.name,
    propertyType: property.type,
    location: property.location,
    verifiedDocuments,
    totalDocuments,
    missingItems,
    verifiedList,
    complianceScore,
    estimatedSuccessRate,
    potentialSuccessRate,
    riskLevel,
  });

  // 5. Save complete record to MongoDB
  const audit = await Audit.create({
    propertyId: property._id,
    model: 'meta/llama-3.1-8b-instruct',
    complianceScore,
    estimatedSuccessRate,
    potentialSuccessRate,
    riskLevel,
    verifiedDocuments,
    totalDocuments,
    missingItems,
    summary,
    recommendation,
    createdBy: adminUserId,
  });

  return audit;
}

export async function getAuditHistory(propertyId) {
  const propertyExists = await Property.exists({ _id: propertyId });
  if (!propertyExists) {
    throw new AppError('Property not found.', 404);
  }

  const audits = await Audit.find({ propertyId }).sort({ generatedAt: -1 });

  return audits;
}
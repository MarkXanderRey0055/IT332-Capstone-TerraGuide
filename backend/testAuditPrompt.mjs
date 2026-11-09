import assert from 'node:assert/strict';
import { buildCompliancePrompt } from './src/services/aiService.js';

const baseFacts = {
  propertyName: 'Test Property',
  propertyType: 'Residential',
  location: 'Batangas',
  listingStatus: 'Available',
  suitableFor: ['Primary Residence'],
  documentStatuses: { deed: 'verified', tax: 'pending', survey: 'unknown' },
  documentStatusCounts: { verified: 1, pending: 1, missing: 0, unknown: 1 },
  verifiedList: ['Deed of Sale'],
  pendingItems: ['Tax Declaration'],
  missingItems: [],
  unknownStatuses: [{ document: 'survey', receivedStatus: null }],
  documentCompleteness: 55,
  estimatedSuccessRate: 55,
  riskLevel: 'Medium',
  readinessClassification: 'ATTENTION_REQUIRED',
  readinessClassificationLabel: 'Attention Required',
  readinessIsReadyForPresentation: false,
  readinessCriticalIssues: [],
  readinessPendingItems: [{ code: 'REQUIRED_DOCUMENT_PENDING', message: 'Tax Declaration is pending verification.' }],
  readinessNonCriticalIssues: [{ code: 'MISSING_PROPERTY_DESCRIPTION', message: 'Property description is missing.' }],
};

const prompt = buildCompliancePrompt(baseFacts);
assert.match(prompt, /Listing status: Available/);
assert.match(prompt, /Suitable uses \/ intended use: Primary Residence/);
assert.match(prompt, /deed: verified, tax: pending, survey: unknown/);
assert.match(prompt, /verified=1, pending=1, missing=0, unknown=1/);
assert.match(prompt, /Estimated listing success rate \(authoritative backend reference\): 55%/);
assert.match(prompt, /ATTENTION_REQUIRED/);
assert.match(prompt, /Tax Declaration is pending verification/);
assert.match(prompt, /Property description is missing/);
assert.match(prompt, /Never claim all documents are verified/);
assert.match(prompt, /Do not invent numerical metrics/);

for (const [classification, expectedInstruction] of [
  ['READY_FOR_PRESENTATION', 'tracked administrative requirements are satisfied'],
  ['ATTENTION_REQUIRED', 'outstanding pending documents'],
  ['HOLD_FOR_REVIEW', 'holding further listing or transaction processing'],
  ['NOT_APPLICABLE', 'Reserved or Sold properties are not active listing candidates'],
  ['NOT_YET_ASSESSED', 'no completed readiness assessment is available'],
]) {
  const classificationPrompt = buildCompliancePrompt({
    ...baseFacts,
    readinessClassification: classification,
  });
  assert.match(classificationPrompt, new RegExp(expectedInstruction));
}

const unknownOnlyPrompt = buildCompliancePrompt({
  ...baseFacts,
  documentStatuses: { deed: 'unknown', tax: 'verified', survey: 'verified' },
  documentStatusCounts: { verified: 2, pending: 0, missing: 0, unknown: 1 },
  missingItems: [],
  unknownStatuses: [{ document: 'deed', receivedStatus: 'rejected' }],
});
assert.match(unknownOnlyPrompt, /deed: unknown/);
assert.match(unknownOnlyPrompt, /Missing Documents: None/);
assert.match(unknownOnlyPrompt, /deed \(rejected\)/);

console.log('Audit prompt tests passed.');

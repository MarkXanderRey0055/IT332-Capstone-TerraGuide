import assert from 'node:assert/strict';
import {
  createDeterministicFallbackNarrative,
  parseJsonResponse,
  validateComplianceNarrative,
} from './src/services/aiService.js';

const baseFacts = {
  propertyName: 'Test Property',
  listingStatus: 'Available',
  documentStatuses: { deed: 'verified', tax: 'pending', survey: 'unknown' },
  pendingItems: ['Tax Declaration'],
  readinessPendingItems: [{ code: 'REQUIRED_DOCUMENT_PENDING', message: 'Tax Declaration is pending verification.' }],
  readinessCriticalIssues: [],
  readinessNonCriticalIssues: [{ code: 'MISSING_PROPERTY_DESCRIPTION', message: 'Property description is missing.' }],
};

const validNarratives = {
  READY_FOR_PRESENTATION: {
    summary: 'Tracked administrative requirements are satisfied. This review does not establish legal compliance, ownership, title validity, or sale probability.',
    recommendation: 'No unresolved findings require administrative follow-up.',
  },
  ATTENTION_REQUIRED: {
    summary: 'Pending documents and noncritical property-information issues require administrative attention.',
    recommendation: 'Complete administrative follow-up before proceeding.',
  },
  HOLD_FOR_REVIEW: {
    summary: 'Critical findings require review before further processing.',
    recommendation: 'Hold processing until the critical findings are addressed and reviewed.',
  },
  NOT_APPLICABLE: {
    summary: 'This property is not an active listing candidate because it is Reserved.',
    recommendation: 'Do not proceed with a new active listing transaction.',
  },
  NOT_YET_ASSESSED: {
    summary: 'No completed readiness assessment is available.',
    recommendation: 'Complete a readiness assessment before taking further action.',
  },
};

for (const [classification, narrative] of Object.entries(validNarratives)) {
  assert.deepEqual(
    validateComplianceNarrative(narrative, {
      ...baseFacts,
      readinessClassification: classification,
      readinessCriticalIssues: classification === 'HOLD_FOR_REVIEW'
        ? [{ code: 'REQUIRED_DOCUMENT_MISSING', message: 'Deed of Sale is missing.' }]
        : baseFacts.readinessCriticalIssues,
      pendingItems: classification === 'ATTENTION_REQUIRED' ? baseFacts.pendingItems : [],
      readinessPendingItems: classification === 'ATTENTION_REQUIRED' ? baseFacts.readinessPendingItems : [],
      readinessNonCriticalIssues: classification === 'ATTENTION_REQUIRED' ? baseFacts.readinessNonCriticalIssues : [],
    }),
    narrative
  );
}

const rejects = [
  [{ summary: '', recommendation: 'Follow up.' }, baseFacts],
  [{ summary: 'ok', recommendation: 42 }, baseFacts],
  [{ summary: 'ok', recommendation: 'ok', extra: true }, baseFacts],
  [{ summary: 'ok', recommendation: 'The rate is 90%.' }, baseFacts],
  [{ summary: 'The title is valid.', recommendation: 'Follow up.' }, baseFacts],
  [
    { summary: 'Critical findings remain.', recommendation: 'We recommend proceeding with publication.' },
    { ...baseFacts, readinessClassification: 'HOLD_FOR_REVIEW', readinessCriticalIssues: [{ code: 'X', message: 'Critical issue.' }] },
  ],
  [
    { summary: 'All requirements are complete.', recommendation: 'No follow-up is necessary.' },
    { ...baseFacts, readinessClassification: 'ATTENTION_REQUIRED' },
  ],
  [
    { summary: 'The property passed the assessment.', recommendation: 'Continue.' },
    { ...baseFacts, readinessClassification: 'NOT_YET_ASSESSED' },
  ],
];

for (const [narrative, facts] of rejects) {
  assert.throws(() => validateComplianceNarrative(narrative, facts));
}

assert.throws(() => parseJsonResponse('not json'));
assert.throws(() => validateComplianceNarrative({ summary: 'x'.repeat(2001), recommendation: 'ok' }, baseFacts));

for (const classification of Object.keys(validNarratives)) {
  const fallback = createDeterministicFallbackNarrative({
    ...baseFacts,
    readinessClassification: classification,
    readinessClassificationLabel: classification,
    readinessCriticalIssues: [{ code: 'CRITICAL', message: 'Critical finding.' }],
  });
  assert.equal(typeof fallback.summary, 'string');
  assert.equal(typeof fallback.recommendation, 'string');
  assert.doesNotMatch(`${fallback.summary} ${fallback.recommendation}`, /\d+%|₱\s*\d/);
}

const notApplicableFallback = createDeterministicFallbackNarrative({
  ...baseFacts,
  listingStatus: 'Sold',
  readinessClassification: 'NOT_APPLICABLE',
  readinessClassificationLabel: 'Not Applicable',
});
assert.match(notApplicableFallback.recommendation, /Do not initiate/);

console.log('AI validation and fallback tests passed.');

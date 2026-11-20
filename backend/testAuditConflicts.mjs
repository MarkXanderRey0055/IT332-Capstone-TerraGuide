import assert from 'node:assert/strict';
import {
  assessPropertyReadiness,
  calculateDocumentReadiness,
  READINESS_CLASSIFICATIONS,
} from './src/utils/auditReadiness.js';

const allVerified = { deed: 'verified', tax: 'verified', survey: 'verified' };
const completeProperty = (status, documents, overrides = {}) => ({
  name: 'Conflict Test Property',
  owner: 'Test Owner',
  location: 'Balayan, Batangas',
  type: 'Residential',
  price: 1_000_000,
  size: 500,
  lotSize: 500,
  description: 'Complete test property.',
  suitableFor: ['Investment'],
  images: ['https://example.test/property.jpg'],
  status,
  documents,
  ...overrides,
});

const cases = [
  {
    name: 'Reserved with all documents Missing',
    property: completeProperty('Reserved', { deed: 'missing', tax: 'missing', survey: 'missing' }),
    expectedCurrent: {
      score: 0,
      classification: READINESS_CLASSIFICATIONS.NOT_APPLICABLE,
      findings: [
        ['critical', 'REQUIRED_DOCUMENT_MISSING'],
        ['critical', 'REQUIRED_DOCUMENT_MISSING'],
        ['critical', 'REQUIRED_DOCUMENT_MISSING'],
      ],
    },
    statedExpectation: { score: 0, classification: 'NOT_APPLICABLE' },
  },
  {
    name: 'Sold with all documents Pending',
    property: completeProperty('Sold', { deed: 'pending', tax: 'pending', survey: 'pending' }),
    expectedCurrent: {
      score: 50,
      classification: READINESS_CLASSIFICATIONS.NOT_APPLICABLE,
      findings: [
        ['pending', 'REQUIRED_DOCUMENT_PENDING'],
        ['pending', 'REQUIRED_DOCUMENT_PENDING'],
        ['pending', 'REQUIRED_DOCUMENT_PENDING'],
      ],
    },
    statedExpectation: { score: 50, classification: 'NOT_APPLICABLE' },
  },
  {
    name: 'Available, Title Deed Verified, Tax and Survey Missing',
    property: completeProperty('Available', { deed: 'verified', tax: 'missing', survey: 'missing' }),
    expectedCurrent: {
      score: 40,
      classification: READINESS_CLASSIFICATIONS.HOLD_FOR_REVIEW,
      findings: [
        ['critical', 'REQUIRED_DOCUMENT_MISSING'],
        ['critical', 'REQUIRED_DOCUMENT_MISSING'],
      ],
    },
    statedExpectation: { score: 40, classification: 'HOLD_FOR_REVIEW' },
  },
  {
    name: 'Available with all documents Pending',
    property: completeProperty('Available', { deed: 'pending', tax: 'pending', survey: 'pending' }),
    expectedCurrent: {
      score: 50,
      classification: READINESS_CLASSIFICATIONS.ATTENTION_REQUIRED,
      findings: [
        ['pending', 'REQUIRED_DOCUMENT_PENDING'],
        ['pending', 'REQUIRED_DOCUMENT_PENDING'],
        ['pending', 'REQUIRED_DOCUMENT_PENDING'],
      ],
    },
    statedExpectation: { score: 50, classification: 'ATTENTION_REQUIRED' },
  },
  {
    name: 'Available, all Verified, owner empty',
    property: completeProperty('Available', allVerified, { owner: '' }),
    expectedCurrent: {
      score: 100,
      classification: READINESS_CLASSIFICATIONS.ATTENTION_REQUIRED,
      findings: [['non_critical', 'MISSING_PROPERTY_OWNER']],
    },
    statedExpectation: { score: 100, classification: 'ATTENTION_REQUIRED' },
  },
  {
    name: 'Available, all Verified, lot size missing',
    property: completeProperty('Available', allVerified, { lotSize: undefined }),
    expectedCurrent: {
      score: 100,
      classification: READINESS_CLASSIFICATIONS.ATTENTION_REQUIRED,
      findings: [['non_critical', 'MISSING_PROPERTY_LOT_SIZE']],
    },
    statedExpectation: { score: 100, classification: 'ATTENTION_REQUIRED' },
  },
  {
    name: 'Available, all Verified, lot size -500',
    property: completeProperty('Available', allVerified, { lotSize: -500 }),
    expectedCurrent: {
      score: 100,
      classification: READINESS_CLASSIFICATIONS.HOLD_FOR_REVIEW,
      findings: [['critical', 'INVALID_PROPERTY_LOT_SIZE']],
    },
    statedExpectation: {
      score: 100,
      classification: 'HOLD_FOR_REVIEW',
      lotSizeFinding: true,
    },
  },
  {
    name: 'Available, all Verified, lot size zero',
    property: completeProperty('Available', allVerified, { lotSize: 0 }),
    expectedCurrent: {
      score: 100,
      classification: READINESS_CLASSIFICATIONS.HOLD_FOR_REVIEW,
      findings: [['critical', 'INVALID_PROPERTY_LOT_SIZE']],
    },
    statedExpectation: { score: 100, classification: 'HOLD_FOR_REVIEW', lotSizeFinding: true },
  },
  {
    name: 'Available, all Verified, valid positive lot size',
    property: completeProperty('Available', allVerified, { lotSize: 25 }),
    expectedCurrent: {
      score: 100,
      classification: READINESS_CLASSIFICATIONS.READY_FOR_PRESENTATION,
      findings: [],
    },
    statedExpectation: { score: 100, lotSizeFinding: false },
  },
  {
    name: 'Available, all Verified, price zero',
    property: completeProperty('Available', allVerified, { price: 0 }),
    expectedCurrent: {
      score: 100,
      classification: READINESS_CLASSIFICATIONS.HOLD_FOR_REVIEW,
      findings: [['critical', 'ZERO_PROPERTY_PRICE']],
    },
    statedExpectation: { score: 100, classification: 'HOLD_FOR_REVIEW' },
  },
  {
    name: 'Available, all Verified, location empty',
    property: completeProperty('Available', allVerified, { location: '' }),
    expectedCurrent: {
      score: 100,
      classification: READINESS_CLASSIFICATIONS.HOLD_FOR_REVIEW,
      findings: [['critical', 'MISSING_PROPERTY_LOCATION']],
    },
    statedExpectation: { score: 100, classification: 'HOLD_FOR_REVIEW' },
  },
  {
    name: 'Available, all Verified, owner and lot size missing',
    property: completeProperty('Available', allVerified, { owner: '', lotSize: undefined }),
    expectedCurrent: {
      score: 100,
      classification: READINESS_CLASSIFICATIONS.ATTENTION_REQUIRED,
      findings: [
        ['non_critical', 'MISSING_PROPERTY_LOT_SIZE'],
        ['non_critical', 'MISSING_PROPERTY_OWNER'],
      ],
    },
  },
  {
    name: 'Available, Title Deed Verified, property name whitespace-only',
    property: completeProperty('Available', allVerified, { name: '   ' }),
    expectedCurrent: {
      score: 100,
      classification: READINESS_CLASSIFICATIONS.HOLD_FOR_REVIEW,
      findings: [['critical', 'MISSING_PROPERTY_NAME']],
    },
    statedExpectation: { score: 100, classification: 'HOLD_FOR_REVIEW' },
  },
];

const mismatches = [];

for (const [index, testCase] of cases.entries()) {
  const score = calculateDocumentReadiness(testCase.property.documents).documentCompleteness;
  const readiness = assessPropertyReadiness(testCase.property);
  const findings = [
    ...readiness.criticalIssues,
    ...readiness.pendingItems.map((finding) => ({ ...finding, severity: 'pending' })),
    ...readiness.nonCriticalIssues,
  ].map(({ severity, code, field, message }) => ({ severity, code, field, message }));
  const findingSignatures = findings.map(({ severity, code }) => [severity, code]);
  const actual = {
    score,
    classification: readiness.classification,
    findings: findingSignatures,
  };

  assert.deepEqual(actual, testCase.expectedCurrent, `${testCase.name} should document current behavior`);

  console.log(`Case ${index + 1}: ${testCase.name}`);
  console.log(`  Inputs: ${JSON.stringify(testCase.property)}`);
  console.log(`  Score: ${score}`);
  console.log(`  Readiness classification: ${readiness.classification}`);
  console.log(`  Findings: ${JSON.stringify(findings)}`);

  if (testCase.statedExpectation) {
    const stated = testCase.statedExpectation;
    const differences = [];
    if (stated.score !== undefined && stated.score !== score) {
      differences.push(`score expected ${stated.score}, actual ${score}`);
    }
    if (stated.classification !== undefined && stated.classification !== readiness.classification) {
      differences.push(`classification expected ${stated.classification}, actual ${readiness.classification}`);
    }
    if (stated.lotSizeFinding !== undefined) {
      const hasLotSizeFinding = findings.some((finding) =>
        ['MISSING_PROPERTY_LOT_SIZE', 'INVALID_PROPERTY_LOT_SIZE'].includes(finding.code)
      );
      if (stated.lotSizeFinding !== hasLotSizeFinding) {
        differences.push(`lot size finding expected ${stated.lotSizeFinding}, actual ${hasLotSizeFinding}`);
      }
    }
    if (differences.length > 0) {
      mismatches.push({ case: index + 1, differences });
      console.log(`  Stated-expectation difference: ${differences.join('; ')}`);
    } else {
      console.log('  Stated expectation: matched');
    }
  } else {
    console.log('  Stated expectation: report actual result');
  }
}

console.log(`Summary: ${mismatches.length} stated-expectation mismatch(es).`);
for (const mismatch of mismatches) {
  console.log(`  Case ${mismatch.case}: ${mismatch.differences.join('; ')}`);
}
console.log('Audit conflict characterization tests passed: all actual results match the code-current expectations.');

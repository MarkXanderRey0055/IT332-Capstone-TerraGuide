import assert from 'node:assert/strict';
import Property from './src/models/Property.js';
import Audit from './src/models/Audit.js';
import { getAttentionProperties } from './src/services/analyticsService.js';

const properties = [
  { _id: 'unaudited-available', name: 'Unaudited available', status: 'Available', documents: { deed: 'verified', tax: 'verified', survey: 'verified' } },
  { _id: 'audited-low-risk', name: 'Audited low risk', status: 'Available' },
  { _id: 'audited-medium-risk', name: 'Audited medium risk', status: 'Available' },
  { _id: 'audited-high-risk', name: 'Audited high risk', status: 'Available' },
  { _id: 'reserved', name: 'Reserved listing', status: 'Reserved' },
  { _id: 'sold', name: 'Sold listing', status: 'Sold' },
];

const audits = [
  { _id: 'audited-low-risk', audit: { complianceScore: 70, missingItems: ['Title Deed'] } },
  { _id: 'audited-medium-risk', audit: { complianceScore: 40, missingItems: [] } },
  { _id: 'audited-high-risk', audit: { complianceScore: 39, missingItems: [] } },
];

const originalFind = Property.find;
const originalAggregate = Audit.aggregate;
Property.find = () => Promise.resolve(properties);
Audit.aggregate = () => Promise.resolve(audits);

try {
  const result = await getAttentionProperties();
  const byId = new Map(result.map((entry) => [entry.propertyId, entry]));

  assert.equal(byId.get('unaudited-available')?.riskLevel, null);
  assert.deepEqual(byId.get('unaudited-available')?.reasons, ['Not yet audited']);
  assert.equal(byId.get('audited-low-risk')?.riskLevel, 'Low');
  assert.equal(byId.get('audited-medium-risk')?.riskLevel, 'Medium');
  assert.equal(byId.get('audited-high-risk')?.riskLevel, 'High');
  assert.equal(byId.has('reserved'), false);
  assert.equal(byId.has('sold'), false);
  assert.equal(result.length, 4);
  console.log('Attention properties tests passed: unaudited properties are Not assessed, audited risk thresholds remain unchanged, and Reserved/Sold are excluded.');
} finally {
  Property.find = originalFind;
  Audit.aggregate = originalAggregate;
}

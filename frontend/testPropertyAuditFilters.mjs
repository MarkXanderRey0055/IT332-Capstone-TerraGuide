import assert from 'node:assert/strict';
import { filterPropertiesByAuditState } from './src/utils/propertyAuditFilters.mjs';

const properties = [
  { id: 'not-audited', status: 'Available', auditState: { status: 'NOT_AUDITED' } },
  { id: 'stale', status: 'Available', auditState: { status: 'STALE' } },
  { id: 'current', status: 'Available', auditState: { status: 'AUDITED' } },
  { id: 'reserved-stale', status: 'Reserved', auditState: { status: 'STALE' } },
  { id: 'sold-not-audited', status: 'Sold', auditState: { status: 'NOT_AUDITED' } },
];

assert.deepEqual(
  filterPropertiesByAuditState(properties, 'NOT_AUDITED').map(({ id }) => id),
  ['not-audited']
);
assert.deepEqual(
  filterPropertiesByAuditState(properties, 'STALE').map(({ id }) => id),
  ['stale']
);
assert.deepEqual(filterPropertiesByAuditState(properties, null), properties);
console.log('Property audit quick-filter tests passed: only matching Available listings are returned.');

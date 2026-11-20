import assert from 'node:assert/strict';
import Property from './src/models/Property.js';
import { updateProperty } from './src/services/propertyService.js';

const records = new Map([
  ['available', { _id: 'available', name: 'Available listing', owner: 'Owner', price: 1000, lotSize: 10, status: 'Available' }],
  ['reserved', { _id: 'reserved', name: 'Reserved listing', owner: 'Owner', price: 1000, lotSize: 10, status: 'Reserved' }],
]);
for (const record of records.values()) record.save = async function save() { return this; };
Property.findById = async (id) => records.get(String(id)) ?? null;

for (const status of ['Reserved', 'Sold']) {
  const availableBefore = { ...records.get('available') };
  await assert.rejects(
    updateProperty('available', { status }),
    (error) => error.statusCode === 400 && error.message === 'Reserved and Sold are set by transactions.'
  );
  assert.equal(records.get('available').status, 'Available');
  assert.equal(records.get('available').name, availableBefore.name);
}

const reserved = records.get('reserved');
await updateProperty('reserved', { name: 'Updated reserved listing', status: 'Reserved' });
assert.equal(reserved.name, 'Updated reserved listing');
assert.equal(reserved.status, 'Reserved');

await updateProperty('available', { name: 'Still available', status: 'Available' });
assert.equal(records.get('available').status, 'Available');

console.log('Property status guard tests passed: manual Reserved/Sold changes reject; unchanged statuses and other edits succeed.');

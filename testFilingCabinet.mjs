// TEMPORARY test script — not part of the deliverable, used only to verify
// Filing Cabinet logic without a live MongoDB connection. Monkey-patches
// Cabinet/Property model statics with controlled fake data, same approach
// as testBuyerAnalytics.mjs and testAdminBuyers.mjs.

import assert from 'node:assert/strict';
import mongoose from 'mongoose';

import Cabinet from './src/models/Cabinet.js';
import Property from './src/models/Property.js';
import * as cabinetService from './src/services/cabinetService.js';

const oid = () => new mongoose.Types.ObjectId();

function mockQuery(data) {
  const promise = Promise.resolve(data);
  promise.sort = () => mockQuery(data);
  return promise;
}

const cabinetAId = oid();
const cabinetBId = oid();

function makeCabinetDoc(overrides) {
  const doc = {
    _id: cabinetAId,
    name: 'Balayan',
    description: 'Property listings located in Balayan.',
    capacity: 10,
    color: 'green',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  doc.toJSON = () => ({
    id: doc._id.toString(),
    name: doc.name,
    description: doc.description,
    capacity: doc.capacity,
    color: doc.color,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  });
  doc.save = async function () { return this; };
  return doc;
}

// ---- Scenario 1: listCabinets computes filed/remaining counts correctly ----
Cabinet.find = () => mockQuery([makeCabinetDoc({ capacity: 10 })]);
Property.aggregate = async () => [{ _id: cabinetAId, count: 4 }];
Property.countDocuments = async () => 2; // unassigned count

const { cabinets, unassignedCount } = await cabinetService.listCabinets();
assert.equal(cabinets[0].filedCount, 4);
assert.equal(cabinets[0].remainingCapacity, 6);
assert.equal(unassignedCount, 2);
console.log('✅ Scenario 1 (listCabinets computes filed/remaining counts) passed');

// ---- Scenario 2: createCabinet rejects missing name / bad capacity / bad color ----
await assert.rejects(
  () => cabinetService.createCabinet({ name: '', capacity: 10 }),
  /name is required/i
);
await assert.rejects(
  () => cabinetService.createCabinet({ name: 'Balayan', capacity: 0 }),
  /capacity must be/i
);
await assert.rejects(
  () => cabinetService.createCabinet({ name: 'Balayan', capacity: 10, color: 'rainbow' }),
  /color must be one of/i
);
console.log('✅ Scenario 2 (createCabinet validation) passed');

// ---- Scenario 3: createCabinet with valid custom values (no hardcoded name/capacity) ----
Cabinet.create = async (data) => makeCabinetDoc(data);
const created = await cabinetService.createCabinet({
  name: 'Important Documents',
  description: 'Priority filings',
  capacity: 20,
  color: 'purple',
});
assert.equal(created.name, 'Important Documents');
assert.equal(created.capacity, 20);
assert.equal(created.color, 'purple');
assert.equal(created.filedCount, 0);
console.log('✅ Scenario 3 (createCabinet accepts fully custom values) passed');

// ---- Scenario 4: updateCabinet rejects lowering capacity below filed count ----
Cabinet.findById = async () => makeCabinetDoc({ capacity: 10 });
Property.countDocuments = async () => 4; // 4 properties currently filed

await assert.rejects(
  () => cabinetService.updateCabinet(cabinetAId, { capacity: 3 }),
  (err) => {
    assert.equal(err.statusCode, 400);
    assert.match(err.message, /currently contains 4 properties/);
    assert.match(err.message, /Capacity cannot be lower than the number of filed properties/);
    return true;
  }
);
console.log('✅ Scenario 4 (updateCabinet rejects invalid capacity reduction with exact message) passed');

// ---- Scenario 5: updateCabinet allows increasing capacity ----
Cabinet.findById = async () => makeCabinetDoc({ capacity: 10 });
Property.countDocuments = async () => 4;
const updated = await cabinetService.updateCabinet(cabinetAId, { capacity: 50, name: 'Balayan Residential' });
assert.equal(updated.capacity, 50);
assert.equal(updated.name, 'Balayan Residential');
console.log('✅ Scenario 5 (updateCabinet allows increasing capacity + renaming) passed');

// ---- Scenario 6: deleteCabinet unassigns properties instead of deleting them ----
let updateManyCalledWith = null;
Cabinet.findById = async () => makeCabinetDoc({});
Property.updateMany = async (filter, update) => {
  updateManyCalledWith = { filter, update };
  return { modifiedCount: 3 };
};
Cabinet.findByIdAndDelete = async () => makeCabinetDoc({});

await cabinetService.deleteCabinet(cabinetAId);
assert.deepEqual(updateManyCalledWith.update, { $set: { cabinetId: null } });
console.log('✅ Scenario 6 (deleteCabinet unassigns properties, never deletes them) passed');

// ---- Scenario 7: assignPropertiesToCabinet rejects over-capacity selections ----
Cabinet.findById = async () => makeCabinetDoc({ capacity: 5 });
Property.countDocuments = async (query) => {
  // "already here" check vs "current count" check — both return via same countDocuments mock
  if (query.cabinetId && query._id) return 0; // none of the selected are already filed here
  return 4; // 4 already filed, so only 1 slot remains
};

await assert.rejects(
  () => cabinetService.assignPropertiesToCabinet(cabinetAId, [oid().toString(), oid().toString(), oid().toString()]),
  /only has 1 slot\(s\) remaining/
);
console.log('✅ Scenario 7 (assignPropertiesToCabinet blocks over-capacity assignment) passed');

// ---- Scenario 8: assignPropertiesToCabinet succeeds within capacity (also covers "move") ----
Cabinet.findById = async () => makeCabinetDoc({ capacity: 5 });
Property.countDocuments = async (query) => {
  if (query.cabinetId && query._id) return 0;
  return 1; // only 1 filed so far, plenty of room
};
Property.updateMany = async (filter, update) => {
  assert.deepEqual(update, { $set: { cabinetId: cabinetAId } });
  return { matchedCount: 2, modifiedCount: 2 };
};
const assignResult = await cabinetService.assignPropertiesToCabinet(cabinetAId, [oid().toString(), oid().toString()]);
assert.equal(assignResult.filedCount, 2);
console.log('✅ Scenario 8 (assignPropertiesToCabinet succeeds within capacity — same path used for moving) passed');

// ---- Scenario 9: removePropertyFromCabinet sets cabinetId to null, doesn't delete ----
const propDoc = { _id: oid(), name: 'Sample Lot', cabinetId: cabinetBId, save: async function () { return this; } };
Property.findById = async () => propDoc;
const removed = await cabinetService.removePropertyFromCabinet(propDoc._id);
assert.equal(removed.cabinetId, null);
assert.equal(removed.name, 'Sample Lot', 'the property record itself must remain intact');
console.log('✅ Scenario 9 (removePropertyFromCabinet unassigns without deleting the property) passed');

console.log('\nALL FILING CABINET TESTS PASSED ✅');

//test script
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

import User from './src/models/User.js';
import BuyerPreference from './src/models/BuyerPreference.js';
import * as adminBuyerService from './src/services/adminBuyerService.js';

const oid = () => new mongoose.Types.ObjectId();

function mockQuery(data) {
  const promise = Promise.resolve(data);
  promise.select = () => mockQuery(data);
  promise.sort = () => mockQuery(data);
  return promise;
}

const buyerAId = oid();
const buyerBId = oid();
const buyerCId = oid();

const buyerA = {
  _id: buyerAId,
  username: 'juandelacruz',
  email: 'juan@example.com',
  fullName: 'Juan Dela Cruz',
  address: 'Manila',
  role: 'buyer',
  createdAt: new Date('2026-06-01'),
};
const buyerB = {
  _id: buyerBId,
  username: 'mariasantos',
  email: 'maria@example.com',
  fullName: 'Maria Santos',
  address: 'Cebu',
  role: 'buyer',
  createdAt: new Date('2026-07-01'),
};
const buyerC = {
  _id: buyerCId,
  username: 'pedropenduko',
  email: 'pedro@example.com',
  fullName: 'Pedro Penduko',
  address: 'Davao',
  role: 'buyer',
  createdAt: new Date('2026-07-15'),
};

const prefA = {
  userId: buyerAId,
  landType: 'Residential',
  intendedUse: 'Primary Residence',
  budgetMin: 400000,
  budgetMax: 600000,
  location: 'Suburbs',
  minLotSize: 100,
  updatedAt: new Date('2026-07-20'),
};

// ---- Scenario 1: listBuyers() joins account + preferences correctly ----
User.find = () => mockQuery([buyerA, buyerB, buyerC]);
BuyerPreference.find = () => mockQuery([prefA]);

const list = await adminBuyerService.listBuyers();
assert.equal(list.length, 3);

const joined = list.find((b) => b.userId.equals(buyerAId));
assert.ok(joined.preferences, 'buyer with saved preferences should have a preferences object');
assert.equal(joined.preferences.landType, 'Residential');
assert.equal(joined.preferences.budgetMax, 600000);

const unjoined = list.find((b) => b.userId.equals(buyerBId));
assert.equal(unjoined.preferences, null, 'buyer without preferences should show null, not fabricated data');

console.log('✅ Scenario 1 (listBuyers joins account + preferences correctly) passed');

// ---- Scenario 2: empty result set doesn't crash ----
User.find = () => mockQuery([]);
const emptyList = await adminBuyerService.listBuyers();
assert.deepEqual(emptyList, []);
console.log('✅ Scenario 2 (empty buyer list handled gracefully) passed');

// ---- Scenario 3: updateBuyer merges preference fields instead of overwriting ----
User.findOne = ({ _id }) => (_id.toString() === buyerAId.toString() ? { ...buyerA, save: async function () { return this; } } : null);
BuyerPreference.findOne = () => ({ ...prefA, toObject: () => ({ ...prefA }) });

let capturedUpsert = null;
BuyerPreference.findOneAndUpdate = (query, update) => {
  capturedUpsert = update.$set;
  return Promise.resolve({ ...prefA, ...update.$set });
};

const updated = await adminBuyerService.updateBuyer(buyerAId, { budgetMax: 750000 });
assert.equal(capturedUpsert.budgetMax, 750000, 'the field being updated should carry through');
assert.equal(capturedUpsert.landType, 'Residential', 'unrelated existing fields should be preserved, not wiped out');
console.log('✅ Scenario 3 (partial preference update merges instead of overwriting) passed');

// ---- Scenario 4: createBuyer always forces role to "buyer" ----
User.findOne = () => null; // no existing username/email collision
let capturedCreate = null;
User.create = (data) => {
  capturedCreate = data;
  return Promise.resolve({
    ...data,
    _id: oid(),
    toObject: function () {
      const obj = { ...this };
      delete obj.toObject;
      delete obj.password;
      return obj;
    },
  });
};
BuyerPreference.findOneAndUpdate = () => Promise.resolve({});

await adminBuyerService.createBuyer({
  username: 'newbuyer',
  email: 'newbuyer@example.com',
  password: 'password123',
  fullName: 'New Buyer',
  address: 'Quezon City',
  role: 'admin', // attempting privilege escalation via payload
});

assert.equal(capturedCreate.role, 'buyer', 'role must always be forced to buyer regardless of payload');
console.log('✅ Scenario 4 (createBuyer ignores role override attempts) passed');

// ---- Scenario 5: deleteBuyer cascades to preferences without erroring when none exist ----
User.findOneAndDelete = () => Promise.resolve(buyerB);
let deletePrefCalled = false;
BuyerPreference.findOneAndDelete = () => {
  deletePrefCalled = true;
  return Promise.resolve(null); // buyerB never set preferences
};

await adminBuyerService.deleteBuyer(buyerBId);
assert.ok(deletePrefCalled, 'preference cleanup should still be attempted even if none exists');
console.log('✅ Scenario 5 (deleteBuyer cascades cleanly with no preference doc) passed');

// ---- Scenario 6: deleteBuyer on a non-existent buyer throws a clean 404 ----
User.findOneAndDelete = () => Promise.resolve(null);
try {
  await adminBuyerService.deleteBuyer(oid());
  assert.fail('should have thrown');
} catch (err) {
  assert.equal(err.statusCode, 404);
  console.log('✅ Scenario 6 (deleting a non-existent buyer surfaces a 404, not a crash):', err.message);
}

console.log('\nALL ADMIN BUYER INTEGRATION TESTS PASSED ✅');

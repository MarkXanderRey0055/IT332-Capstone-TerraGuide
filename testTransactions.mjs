import assert from 'node:assert/strict';
import mongoose from 'mongoose';

import Transaction from './src/models/Transaction.js';
import User from './src/models/User.js';
import Property from './src/models/Property.js';
import * as transactionService from './src/services/transactionService.js';
import { deleteProperty } from './src/services/propertyService.js';
import { deleteBuyer } from './src/services/adminBuyerService.js';

const oid = () => new mongoose.Types.ObjectId();

function mockQuery(data) {
  const promise = Promise.resolve(data);
  promise.populate = () => mockQuery(data);
  promise.sort = () => mockQuery(data);
  return promise;
}

const buyerId = oid();
const adminId = oid();
const propertyId = oid();

const buyerDoc = { _id: buyerId, role: 'buyer', fullName: 'Juan Dela Cruz', username: 'juan', email: 'juan@example.com' };

let propertyStore = { _id: propertyId, status: 'Available', name: 'Balayan Farm Lot', price: 500000 };

// propertyService.updateProperty() calls Property.findByIdAndUpdate — fake
// it against our in-memory propertyStore so the real service logic runs.
Property.findByIdAndUpdate = async (id, data, options) => {
  if (id.toString() !== propertyId.toString()) return null;
  Object.assign(propertyStore, data);
  return { ...propertyStore };
};
Property.findById = async (id) => (id.toString() === propertyId.toString() ? { ...propertyStore } : null);

function makeTransactionDoc(overrides) {
  const doc = {
    _id: oid(),
    buyerId,
    propertyId,
    amount: 500000,
    status: 'Reserved',
    notes: '',
    createdBy: adminId,
    completedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
  Object.defineProperty(doc, 'reference', {
    get() { return `TXN-${this._id.toHexString().slice(-6).toUpperCase()}`; },
  });
  doc.save = async function () { return this; };
  return doc;
}

// ---- Scenario 1: createTransaction succeeds and reserves the property ----
propertyStore = { _id: propertyId, status: 'Available', name: 'Balayan Farm Lot', price: 500000 };
User.findOne = async ({ _id }) => (_id.toString() === buyerId.toString() ? buyerDoc : null);
Transaction.findOne = async () => null; // no existing active transaction
let createdDoc = null;
Transaction.create = async (data) => {
  createdDoc = makeTransactionDoc(data);
  return createdDoc;
};
Transaction.findById = () => mockQuery(createdDoc);

const created = await transactionService.createTransaction({
  buyerId,
  propertyId,
  amount: 500000,
  notes: 'Initial reservation',
  createdByUserId: adminId,
});

assert.equal(created.status, 'Reserved');
assert.equal(propertyStore.status, 'Reserved', 'creating a transaction must reserve the property');
console.log('✅ Scenario 1 (createTransaction succeeds and reserves the property) passed');

// ---- Scenario 2: createTransaction rejects an invalid buyer ----
User.findOne = async () => null;
await assert.rejects(
  () => transactionService.createTransaction({ buyerId: oid(), propertyId, amount: 100, createdByUserId: adminId }),
  /Buyer not found/
);
console.log('✅ Scenario 2 (createTransaction rejects an invalid/non-buyer account) passed');

// ---- Scenario 3: createTransaction rejects an invalid property ----
User.findOne = async () => buyerDoc;
Property.findById = async () => null;
await assert.rejects(
  () => transactionService.createTransaction({ buyerId, propertyId: oid(), amount: 100, createdByUserId: adminId }),
  /Property not found/
);
console.log('✅ Scenario 3 (createTransaction rejects an invalid property) passed');

// ---- Scenario 4: createTransaction rejects a second active transaction on the same property ----
Property.findById = async (id) => (id.toString() === propertyId.toString() ? { ...propertyStore } : null);
Transaction.findOne = async () => makeTransactionDoc({ status: 'Reserved' }); // already active
await assert.rejects(
  () => transactionService.createTransaction({ buyerId, propertyId, amount: 100, createdByUserId: adminId }),
  (err) => {
    assert.equal(err.statusCode, 409);
    assert.match(err.message, /already has an active transaction/);
    return true;
  }
);
console.log('✅ Scenario 4 (blocks a second active transaction on the same property) passed');

// ---- Scenario 5: createTransaction rejects a property that is already Sold ----
propertyStore.status = 'Sold';
Transaction.findOne = async () => null;
await assert.rejects(
  () => transactionService.createTransaction({ buyerId, propertyId, amount: 100, createdByUserId: adminId }),
  /already marked Sold/
);
propertyStore.status = 'Reserved'; // restore for later scenarios
console.log('✅ Scenario 5 (blocks creating a transaction against an already-Sold property) passed');

// ---- Scenario 6: updateTransaction to Completed sets completedAt and marks the property Sold ----
propertyStore = { _id: propertyId, status: 'Reserved', name: 'Balayan Farm Lot', price: 500000 };
Property.findByIdAndUpdate = async (id, data) => {
  Object.assign(propertyStore, data);
  return { ...propertyStore };
};
Property.findById = async () => ({ ...propertyStore });

const activeTxn = makeTransactionDoc({ status: 'Reserved' });
Transaction.findById = (id) => {
  if (typeof id === 'object' && id?.populate) return id; // guard, not used here
  return mockQuery(activeTxn);
};
// getTransactionById() calls Transaction.findById(id).populate(...).populate(...).populate(...)
Transaction.findById = () => mockQuery(activeTxn);

const completed = await transactionService.updateTransaction(activeTxn._id, { status: 'Completed' });
assert.equal(activeTxn.status, 'Completed');
assert.ok(activeTxn.completedAt instanceof Date);
assert.equal(propertyStore.status, 'Sold', 'completing a transaction must mark the property Sold');
console.log('✅ Scenario 6 (completing a transaction sets completedAt and marks the property Sold) passed');

// ---- Scenario 7: Completed transactions cannot be cancelled (terminal state) ----
await assert.rejects(
  () => transactionService.updateTransaction(activeTxn._id, { status: 'Cancelled' }),
  (err) => {
    assert.equal(err.statusCode, 400);
    assert.match(err.message, /Cannot change transaction status from "Completed" to "Cancelled"/);
    return true;
  }
);
console.log('✅ Scenario 7 (Completed is terminal — cannot be cancelled) passed');

// ---- Scenario 8: cancelling a Reserved transaction reverts the property to Available ----
propertyStore = { _id: propertyId, status: 'Reserved', name: 'Balayan Farm Lot', price: 500000 };
Property.findByIdAndUpdate = async (id, data) => {
  Object.assign(propertyStore, data);
  return { ...propertyStore };
};
Property.findById = async () => ({ ...propertyStore });

const reservedTxn = makeTransactionDoc({ status: 'Reserved' });
Transaction.findById = () => mockQuery(reservedTxn);

await transactionService.updateTransaction(reservedTxn._id, { status: 'Cancelled' });
assert.equal(reservedTxn.status, 'Cancelled');
assert.equal(propertyStore.status, 'Available', 'cancelling must return the property to Available');
console.log('✅ Scenario 8 (cancelling a Reserved transaction reverts the property to Available) passed');

// ---- Scenario 9: invalid status transitions are rejected (e.g. skipping backwards) ----
propertyStore = { _id: propertyId, status: 'Sold', name: 'Balayan Farm Lot', price: 500000 };
const cancelledTxn = makeTransactionDoc({ status: 'Cancelled' });
Transaction.findById = () => mockQuery(cancelledTxn);
await assert.rejects(
  () => transactionService.updateTransaction(cancelledTxn._id, { status: 'Processing' }),
  /Cannot change transaction status from "Cancelled" to "Processing"/
);
console.log('✅ Scenario 9 (Cancelled is terminal — cannot transition to any other status) passed');

// ---- Scenario 10: getPendingTransactionCount reflects active statuses only ----
Transaction.countDocuments = async (filter) => {
  assert.deepEqual(filter, { status: { $in: ['Reserved', 'Processing'] } });
  return 4;
};
const pendingCount = await transactionService.getPendingTransactionCount();
assert.equal(pendingCount, 4);
console.log('✅ Scenario 10 (pending transaction count queries only active statuses) passed');

// ---- Scenario 11: editing permitted fields (amount, notes) preserves existing buyer and property ----
const activeEditTxn = makeTransactionDoc({
  status: 'Reserved',
  amount: 450000,
  notes: 'Old notes',
  buyerId,
  propertyId,
});
Transaction.findById = () => mockQuery(activeEditTxn);

const editedTxn = await transactionService.updateTransaction(activeEditTxn._id, {
  amount: 480000,
  notes: 'Updated reservation terms',
});
assert.equal(activeEditTxn.amount, 480000);
assert.equal(activeEditTxn.notes, 'Updated reservation terms');
assert.equal(activeEditTxn.buyerId.toString(), buyerId.toString(), 'buyer association must be preserved');
assert.equal(activeEditTxn.propertyId.toString(), propertyId.toString(), 'property association must be preserved');
console.log('✅ Scenario 11 (editing permitted fields updates amount/notes while preserving associations) passed');

// ---- Scenario 12: editing buyer explicitly updates association when valid ----
const newBuyerId = oid();
const newBuyerDoc = { _id: newBuyerId, role: 'buyer', fullName: 'Maria Santos', username: 'maria' };
User.findOne = async ({ _id, role }) => {
  if (_id.toString() === newBuyerId.toString() && role === 'buyer') return newBuyerDoc;
  return null;
};
await transactionService.updateTransaction(activeEditTxn._id, {
  buyerId: newBuyerId,
});
assert.equal(activeEditTxn.buyerId.toString(), newBuyerId.toString());
console.log('✅ Scenario 12 (editing buyer explicitly updates association) passed');

// ---- Scenario 13: editing property explicitly transfers reservation cleanly ----
const newPropId = oid();
const newPropertyStore = { _id: newPropId, status: 'Available', name: 'Tagaytay Highlands Lot', price: 900000 };
propertyStore = { _id: propertyId, status: 'Reserved', name: 'Balayan Farm Lot', price: 500000 };

Property.findById = async (id) => {
  if (id.toString() === newPropId.toString()) return { ...newPropertyStore };
  if (id.toString() === propertyId.toString()) return { ...propertyStore };
  return null;
};
Property.findByIdAndUpdate = async (id, data) => {
  if (id.toString() === newPropId.toString()) {
    Object.assign(newPropertyStore, data);
    return { ...newPropertyStore };
  }
  if (id.toString() === propertyId.toString()) {
    Object.assign(propertyStore, data);
    return { ...propertyStore };
  }
  return null;
};
Transaction.findOne = async () => null; // No collision

await transactionService.updateTransaction(activeEditTxn._id, {
  propertyId: newPropId,
});
assert.equal(activeEditTxn.propertyId.toString(), newPropId.toString());
assert.equal(propertyStore.status, 'Available', 'old property must revert to Available');
assert.equal(newPropertyStore.status, 'Reserved', 'new property must be Reserved');
console.log('✅ Scenario 13 (editing property transfers reservation between properties) passed');

// ---- Scenario 14: Completed transactions reject modifying amount, notes, or associations ----
const finalCompletedTxn = makeTransactionDoc({ status: 'Completed', amount: 500000 });
Transaction.findById = () => mockQuery(finalCompletedTxn);
await assert.rejects(
  () => transactionService.updateTransaction(finalCompletedTxn._id, { amount: 600000 }),
  (err) => {
    assert.equal(err.statusCode, 400);
    assert.match(err.message, /Cannot modify a Completed transaction/);
    return true;
  }
);
console.log('✅ Scenario 14 (Completed transactions are immutable — rejects edits) passed');

// ---- Scenario 15: deleteProperty blocks deleting a property with an active transaction ----
Transaction.findOne = async ({ propertyId, status }) => {
  if (status?.$in?.includes('Reserved')) {
    return makeTransactionDoc({ status: 'Reserved', reference: 'TXN-ACT001' });
  }
  return null;
};
await assert.rejects(
  () => deleteProperty(propertyId),
  (err) => {
    assert.equal(err.statusCode, 409);
    assert.match(err.message, /Cannot delete property because it has an active transaction/);
    return true;
  }
);
console.log('✅ Scenario 15 (deleteProperty blocks deleting a property with an active transaction) passed');

// ---- Scenario 16: deleteBuyer blocks deleting a buyer account with an active transaction ----
Transaction.findOne = async ({ buyerId, status }) => {
  if (status?.$in?.includes('Reserved')) {
    return makeTransactionDoc({ status: 'Reserved', reference: 'TXN-ACT002' });
  }
  return null;
};
await assert.rejects(
  () => deleteBuyer(buyerId),
  (err) => {
    assert.equal(err.statusCode, 409);
    assert.match(err.message, /Cannot delete buyer because they have an active transaction/);
    return true;
  }
);
console.log('✅ Scenario 16 (deleteBuyer blocks deleting a buyer with an active transaction) passed');

console.log('\nALL TRANSACTION MANAGEMENT TESTS PASSED ✅');

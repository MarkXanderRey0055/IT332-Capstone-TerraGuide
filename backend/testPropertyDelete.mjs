import assert from 'node:assert/strict';
import mongoose from 'mongoose';

import Property from './src/models/Property.js';
import Transaction from './src/models/Transaction.js';
import { deleteProperty } from './src/services/propertyService.js';

const propertyId = () => new mongoose.Types.ObjectId();
const properties = new Map();
let transactions = [];
let sessionCount = 0;

mongoose.startSession = async () => {
  const session = { active: false };
  sessionCount += 1;
  session.withTransaction = async (callback) => {
    const previousProperties = new Map(properties);
    const previousTransactions = structuredClone(transactions);
    session.active = true;
    try {
      await callback();
    } catch (error) {
      properties.clear();
      for (const [id, property] of previousProperties) properties.set(id, property);
      transactions = previousTransactions;
      throw error;
    } finally {
      session.active = false;
    }
  };
  session.endSession = async () => {};
  return session;
};

Transaction.findOne = (filter) => ({
  session: async (session) => {
    assert.equal(session.active, true, 'transaction lookup must run in the session');
    return transactions.find((transaction) => String(transaction.propertyId) === String(filter.propertyId)) ?? null;
  },
});

Property.findByIdAndDelete = (id) => ({
  session: async (session) => {
    assert.equal(session.active, true, 'property deletion must run in the session');
    const key = String(id);
    const property = properties.get(key) ?? null;
    if (property) properties.delete(key);
    return property;
  },
});

const addProperty = (id) => {
  const property = { _id: id, name: `Property ${id}` };
  properties.set(String(id), property);
  return property;
};

const assertBlockedWithoutChanges = async (status) => {
  const id = propertyId();
  const property = addProperty(id);
  const transaction = { _id: propertyId(), propertyId: id, status, reference: `TXN-${status}` };
  transactions = [...transactions, transaction];
  const transactionsBefore = structuredClone(transactions);
  const propertiesBefore = structuredClone([...properties.entries()]);

  await assert.rejects(
    deleteProperty(String(id)),
    (error) => error.statusCode === 409
      && error.message === 'This property has transaction records and can’t be deleted. Archive it instead.'
  );

  assert.equal(properties.get(String(id)), property, `${status} transaction must leave its property in place`);
  assert.deepEqual(transactions, transactionsBefore, `${status} transaction record must remain unchanged`);
  assert.deepEqual(structuredClone([...properties.entries()]), propertiesBefore, `${status} rejection must not modify any property records`);
};

console.log('--- Property deletion transaction tests ---');

transactions = [];
const deletableId = propertyId();
const deletableProperty = addProperty(deletableId);
const recordsBeforeDelete = structuredClone(transactions);
const deleted = await deleteProperty(String(deletableId));
assert.equal(deleted, deletableProperty);
assert.equal(properties.has(String(deletableId)), false);
assert.deepEqual(transactions, recordsBeforeDelete, 'deleting a property without transaction history must not modify transaction records');

for (const status of ['Reserved', 'Completed', 'Cancelled']) {
  await assertBlockedWithoutChanges(status);
}

assert.equal(sessionCount, 4, 'each deletion attempt must use a MongoDB session transaction');
console.log('Property deletion tests passed: no-history deletion succeeds; Reserved, Completed, and Cancelled transactions block without modifying records; all checks and deletes use sessions.');

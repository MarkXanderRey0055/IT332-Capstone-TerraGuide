import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Inquiry from './src/models/Inquiry.js';
import Notification from './src/models/Notification.js';
import Property from './src/models/Property.js';
import Transaction from './src/models/Transaction.js';
import User from './src/models/User.js';
import { createTransaction, updateTransaction } from './src/services/transactionService.js';

const id = () => new mongoose.Types.ObjectId();
const buyerId = id();
const otherBuyerId = id();
const propertyId = id();
const otherPropertyId = id();
const inquiryId = id();
const property = { _id: propertyId, id: propertyId.toString(), name: 'Test Property', owner: 'Test Owner', price: 250000, lotSize: 500, status: 'Available', save: async function save() { return this; } };
const otherProperty = { _id: otherPropertyId, id: otherPropertyId.toString(), name: 'Other Property', owner: 'Other Owner', price: 180000, lotSize: 400, status: 'Available', save: async function save() { return this; } };
const buyer = { _id: buyerId, role: 'buyer' };
const otherBuyer = { _id: otherBuyerId, role: 'buyer' };
let inquiry;
let transactions = [];
let notifications = [];
let failInquirySave = false;
let transactionSequence = 0;

const queryFor = (resolve) => ({
  session() { return this; },
  populate() { return this; },
  then(resolveThen, reject) { return Promise.resolve(typeof resolve === 'function' ? resolve() : resolve).then(resolveThen, reject); },
});

User.findOne = async ({ _id }) => [_id.toString() === buyerId.toString() ? buyer : otherBuyer][0];
Property.findById = (idValue) => queryFor(() => idValue.toString() === propertyId.toString() ? property : (idValue.toString() === otherPropertyId.toString() ? otherProperty : null));
Inquiry.findById = () => queryFor(inquiry);
Transaction.findOne = (filter) => queryFor(() => transactions.find((transaction) => {
  if (filter.convertedInquiryId) return transaction.convertedInquiryId?.toString() === filter.convertedInquiryId.toString();
  if (filter.propertyId && filter.status?.$in) {
    return transaction.propertyId.toString() === filter.propertyId.toString() && filter.status.$in.includes(transaction.status);
  }
  return false;
}) ?? null);
Transaction.findById = (idValue) => queryFor(() => transactions.find((transaction) => transaction._id.toString() === idValue.toString()) ?? null);
Transaction.create = async (input) => {
  const docs = Array.isArray(input) ? input : [input];
  const created = docs.map((doc) => {
    transactionSequence += 1;
    const transaction = {
      ...doc,
      _id: new mongoose.Types.ObjectId(),
      id: `test-transaction-${transactionSequence}`,
      createdAt: new Date(),
      completedAt: null,
      save: async () => {},
    };
    transactions.push(transaction);
    return transaction;
  });
  return Array.isArray(input) ? created : created[0];
};
Inquiry.prototype.save = async function save() {
  if (failInquirySave) throw new Error('simulated inquiry update failure');
  return this;
};
Notification.create = async (notification) => { notifications.push(notification); return notification; };

mongoose.startSession = async () => ({
  async withTransaction(callback) {
    const priorTransactions = [...transactions];
    const priorStatus = inquiry.status;
    const priorClosedAt = inquiry.closedAt;
    const priorPropertyStatus = property.status;
    try {
      await callback();
    } catch (error) {
      transactions = priorTransactions;
      inquiry.status = priorStatus;
      inquiry.closedAt = priorClosedAt;
      property.status = priorPropertyStatus;
      throw error;
    }
  },
  async endSession() {},
});

function setInquiry(status = 'Pending') {
  inquiry = {
    _id: inquiryId,
    buyerId,
    propertyId,
    status,
    closedAt: null,
    save: async function save() {
      if (failInquirySave) throw new Error('simulated inquiry update failure');
      return this;
    },
  };
}

function request(overrides = {}) {
  return {
    buyerId: buyerId.toString(),
    propertyId: propertyId.toString(),
    amount: 250000,
    notes: '',
    convertedInquiryId: inquiryId.toString(),
    createdByUserId: id().toString(),
    ...overrides,
  };
}

const originalConsoleError = console.error;
const logged = [];
console.error = (...args) => logged.push(args);

try {
  // A Pending inquiry converts atomically and notifies its buyer exactly once.
  setInquiry('Pending');
  property.status = 'Available';
  const converted = await createTransaction(request());
  assert.equal(inquiry.status, 'Converted');
  assert.ok(inquiry.closedAt instanceof Date);
  assert.equal(converted.status, 'Reserved');
  assert.equal(converted.convertedInquiryId.toString(), inquiryId.toString());
  assert.equal(property.status, 'Reserved');
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].type, 'inquiry_converted');
  assert.equal(notifications[0].recipientId.toString(), buyerId.toString());
  assert.equal(notifications[0].title, 'Your inquiry is being processed');
  assert.equal(notifications[0].message, 'Your inquiry about Test Property has been converted into a transaction. The TerraGuide team will follow up with you.');

  inquiry.status = 'Pending';
  await assert.rejects(createTransaction(request()), /already has a linked transaction/);
  inquiry.status = 'Converted';
  assert.equal(transactions.length, 1, 'A second conversion must not create another transaction');

  setInquiry('Not interested');
  property.status = 'Available';
  await assert.rejects(createTransaction(request()), /Only Pending or Responded inquiries can be converted/);
  setInquiry('Pending');
  await assert.rejects(createTransaction(request({ buyerId: otherBuyerId.toString() })), /must match the inquiry/);
  await assert.rejects(createTransaction(request({ propertyId: otherPropertyId.toString() })), /must match the inquiry/);
  assert.equal(transactions.length, 1);

  // Cancellation changes the transaction/property, not the inquiry outcome.
  setInquiry('Converted');
  const linked = transactions[0];
  const cancelled = await updateTransaction(linked._id.toString(), { status: 'Cancelled' });
  assert.equal(cancelled.status, 'Cancelled');
  assert.equal(inquiry.status, 'Converted');
  assert.equal(property.status, 'Available');

  // Standalone transaction creation retains the existing no-link workflow.
  property.status = 'Available';
  const standalone = await createTransaction(request({ convertedInquiryId: undefined }));
  assert.equal(standalone.status, 'Reserved');
  assert.equal(standalone.convertedInquiryId, undefined);
  assert.equal(property.status, 'Reserved', 'transaction creation reserves the property through its internal update path');
  const completedStandalone = await updateTransaction(standalone._id.toString(), { status: 'Completed' });
  assert.equal(completedStandalone.status, 'Completed');
  assert.equal(property.status, 'Sold', 'transaction completion marks the property Sold through its internal update path');
  assert.equal(notifications.length, 1, 'Standalone transactions do not emit inquiry-conversion notifications');

  // A failed inquiry update aborts the Mongo transaction (including the created transaction).
  setInquiry('Responded');
  inquiry._id = id();
  inquiry.propertyId = otherPropertyId;
  const failureInquiryId = inquiry._id.toString();
  property.status = 'Available';
  failInquirySave = true;
  const countBeforeFailure = transactions.length;
  await assert.rejects(createTransaction(request({ propertyId: otherPropertyId.toString(), convertedInquiryId: failureInquiryId })), /simulated inquiry update failure/);
  failInquirySave = false;
  assert.equal(transactions.length, countBeforeFailure, 'Aborting conversion rolls back its transaction insert');
  assert.equal(inquiry.status, 'Responded');
  assert.equal(property.status, 'Available', 'Aborting conversion rolls back the property reservation');
  assert.ok(logged.some((args) => args[1]?.inquiryId === failureInquiryId && args[1]?.errorMessage === 'simulated inquiry update failure'));

  const index = Transaction.schema.indexes().find(([keys]) => keys.convertedInquiryId === 1);
  assert.ok(index, 'Transaction schema declares a convertedInquiryId index');
  assert.equal(index[1].unique, true);
  assert.deepEqual(index[1].partialFilterExpression, { convertedInquiryId: { $type: 'objectId' } });
} finally {
  console.error = originalConsoleError;
}

console.log('Inquiry conversion tests passed: conversion, duplicate/closed/mismatch rejection, cancellation, standalone creation, notification, rollback, and index declaration.');

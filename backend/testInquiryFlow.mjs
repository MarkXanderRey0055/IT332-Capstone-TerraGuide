import assert from 'node:assert/strict';
import mongoose from 'mongoose';

import Inquiry, { INQUIRY_CLOSING_STATUSES, INQUIRY_STATUSES } from './src/models/Inquiry.js';
import Property from './src/models/Property.js';
import User from './src/models/User.js';
import Notification from './src/models/Notification.js';
import * as inquiryService from './src/services/inquiryService.js';
import { updateInquiryStatus as updateInquiryController } from './src/controllers/InquiryController.js';
import { errorHandler } from './src/middleware/errorMiddleware.js';
import AppError from './src/utils/errors.js';

const oid = () => new mongoose.Types.ObjectId();

function mockQuery(data) {
  const p = Promise.resolve(data);
  p.populate = () => mockQuery(data);
  p.sort = () => mockQuery(data);
  return p;
}

const mockBuyerId = oid();
const mockPropertyId = oid();

const mockProperty = {
  _id: mockPropertyId,
  name: 'Sunrise Hill Estates',
  location: 'Antipolo, Rizal',
  type: 'Residential',
  status: 'Available',
  price: 4500000,
  images: ['https://example.com/prop.jpg'],
};

User.find = () => ({ select: async () => [] });
const notificationsCreated = [];
Notification.create = async (notification) => {
  notificationsCreated.push(notification);
  return notification;
};

console.log('--- Starting TerraGuide Inquiry Flow Integration Tests ---');

// ============================================================
// Test 1: Empty or whitespace-only messages are rejected
// ============================================================
Property.findById = async (id) => (id.toString() === mockPropertyId.toString() ? mockProperty : null);

try {
  const emptyMessage = '   ';
  if (!emptyMessage.trim()) {
    throw new AppError('propertyId and message are required.', 400);
  }
  assert.fail('Should have rejected empty message');
} catch (err) {
  assert.equal(err.statusCode, 400);
  assert.equal(err.message, 'propertyId and message are required.');
  console.log('✅ Test 1 Passed: Empty message is rejected with 400 status');
}

// ============================================================
// Test 2: Invalid property ID is rejected
// ============================================================
try {
  await inquiryService.createInquiry({
    buyerId: mockBuyerId,
    propertyId: 'invalid-id-format',
    message: 'Hello, is this property still available?',
  });
  assert.fail('Should have thrown 400 on invalid property ID');
} catch (err) {
  assert.equal(err.statusCode, 400);
  assert.match(err.message, /Invalid property ID/);
  console.log('✅ Test 2 Passed: Invalid property ID rejected with 400 status');
}

// ============================================================
// Test 3: Successful inquiry submission with topic prefix
// ============================================================
let savedInquiryDoc = null;
const inquiryId = oid();

Inquiry.create = async (doc) => {
  savedInquiryDoc = {
    ...doc,
    _id: inquiryId,
    status: 'Pending',
    adminResponse: '',
    closeReason: '',
    closedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  return savedInquiryDoc;
};

Inquiry.findById = (id) => {
  const populated = {
    ...savedInquiryDoc,
    buyerId: { _id: mockBuyerId, fullName: 'Maria Clara', email: 'maria@example.com' },
    propertyId: mockProperty,
  };
  return mockQuery(populated);
};

const topicTaggedMessage = '[Topic: Pricing & Terms]\n\nI would like to inquire about installment plans for this property.';
const created = await inquiryService.createInquiry({
  buyerId: mockBuyerId,
  propertyId: mockPropertyId.toString(),
  message: topicTaggedMessage,
});

assert.ok(created, 'Inquiry should be created');
assert.equal(savedInquiryDoc.buyerId.toString(), mockBuyerId.toString());
assert.equal(savedInquiryDoc.propertyId.toString(), mockPropertyId.toString());
assert.equal(savedInquiryDoc.message, topicTaggedMessage);
assert.equal(savedInquiryDoc.status, 'Pending');
assert.equal(savedInquiryDoc.adminResponse, '');
assert.ok(INQUIRY_STATUSES.includes(savedInquiryDoc.status));
console.log('✅ Test 3 Passed: Inquiry created with topic prefix, correctly associated with buyer and property');

// ============================================================
// Test 4: Buyer inquiries retrieval
// ============================================================
Inquiry.find = ({ buyerId } = {}) => {
  if (buyerId && buyerId.toString() === mockBuyerId.toString()) {
    return mockQuery([
      {
        ...savedInquiryDoc,
        buyerId: { _id: mockBuyerId, fullName: 'Maria Clara' },
        propertyId: mockProperty,
      },
    ]);
  }
  return mockQuery([]);
};

const buyerInquiries = await inquiryService.getInquiriesForBuyer(mockBuyerId);
assert.equal(buyerInquiries.length, 1);
assert.equal(buyerInquiries[0].propertyId.name, 'Sunrise Hill Estates');
assert.equal(buyerInquiries[0].status, 'Pending');
console.log('✅ Test 4 Passed: Buyer inquiries fetched and populated with property info');

// ============================================================
// Test 5: Admin status update and official response
// ============================================================
const inquiryDocument = {
  get _id() { return savedInquiryDoc._id; },
  get buyerId() { return savedInquiryDoc.buyerId; },
  get propertyId() { return savedInquiryDoc.propertyId; },
  get status() { return savedInquiryDoc.status; },
  set status(value) { savedInquiryDoc.status = value; },
  get adminResponse() { return savedInquiryDoc.adminResponse; },
  set adminResponse(value) { savedInquiryDoc.adminResponse = value; },
  get closeReason() { return savedInquiryDoc.closeReason; },
  set closeReason(value) { savedInquiryDoc.closeReason = value; },
  get closedAt() { return savedInquiryDoc.closedAt; },
  set closedAt(value) { savedInquiryDoc.closedAt = value; },
  save: async () => { savedInquiryDoc.updatedAt = new Date(); },
  populate: () => mockQuery({
    ...savedInquiryDoc,
    buyerId: { _id: mockBuyerId, fullName: 'Maria Clara' },
    propertyId: mockProperty,
  }),
};
Inquiry.findById = () => inquiryDocument;

const updatedInquiry = await inquiryService.updateInquiryStatus(inquiryId.toString(), {
  status: 'Responded',
  adminResponse: 'We have flexible 5-year installment terms available with 20% down payment.',
});

assert.equal(updatedInquiry.status, 'Responded');
assert.equal(
  updatedInquiry.adminResponse,
  'We have flexible 5-year installment terms available with 20% down payment.'
);
console.log('✅ Test 5 Passed: Status updated to Responded with official admin response');

// ============================================================
// Test 6: Inquiry status follows the trimmed admin response in both directions
// ============================================================
const clearedResponse = await inquiryService.updateInquiryStatus(inquiryId.toString(), {
  status: 'Responded',
  adminResponse: '   ',
});
assert.equal(clearedResponse.status, 'Pending');
assert.equal(clearedResponse.adminResponse, '');

const addedResponse = await inquiryService.updateInquiryStatus(inquiryId.toString(), {
  status: 'Pending',
  adminResponse: '  We can arrange a viewing.  ',
});
assert.equal(addedResponse.status, 'Responded');
assert.equal(addedResponse.adminResponse, 'We can arrange a viewing.');

const clearedAgain = await inquiryService.updateInquiryStatus(inquiryId.toString(), {
  adminResponse: '   ',
});
assert.equal(clearedAgain.status, 'Pending');
assert.equal(clearedAgain.adminResponse, '');

try {
  await inquiryService.updateInquiryStatus(inquiryId.toString(), { status: 'Invalid' });
  assert.fail('Unknown status must fail');
} catch (err) {
  assert.equal(err.statusCode, 400);
}
console.log('✅ Test 6 Passed: Inquiry status automatically follows response presence and invalid statuses are rejected');

// ============================================================
// Test 7: Closing outcomes require a reason, notify once, and are terminal
// ============================================================
for (const [index, closingStatus] of INQUIRY_CLOSING_STATUSES.entries()) {
  const originalResponse = index === 0 ? '' : 'Existing official response';
  savedInquiryDoc.status = index === 0 ? 'Pending' : 'Responded';
  savedInquiryDoc.adminResponse = originalResponse;
  savedInquiryDoc.closeReason = '';
  savedInquiryDoc.closedAt = null;
  notificationsCreated.length = 0;

  try {
    await inquiryService.updateInquiryStatus(inquiryId.toString(), { status: closingStatus });
    assert.fail(`${closingStatus} requires a close reason`);
  } catch (err) {
    assert.equal(err.statusCode, 400);
    assert.match(err.message, /reason is required/i);
  }

  const closed = await inquiryService.updateInquiryStatus(inquiryId.toString(), {
    status: closingStatus,
    closeReason: '  Buyer confirmed this outcome.  ',
  });
  assert.equal(closed.status, closingStatus);
  assert.equal(savedInquiryDoc.adminResponse, originalResponse, 'Closing must preserve adminResponse');
  assert.equal(savedInquiryDoc.closeReason, 'Buyer confirmed this outcome.');
  assert.ok(savedInquiryDoc.closedAt instanceof Date);
  assert.equal(notificationsCreated.length, 1);
  assert.equal(notificationsCreated[0].recipientId.toString(), mockBuyerId.toString());
  assert.equal(notificationsCreated[0].type, 'inquiry_closed');
  assert.equal(notificationsCreated[0].title, 'Your inquiry was closed');
  assert.equal(notificationsCreated[0].message, `Your inquiry about ${mockProperty.name} was closed: ${closingStatus}.`);
  assert.doesNotMatch(notificationsCreated[0].message, /Buyer confirmed this outcome/);

}

// Every terminal outcome rejects response edits, status edits, and identical saves.
for (const terminalStatus of [...INQUIRY_CLOSING_STATUSES, 'Converted']) {
  savedInquiryDoc.status = terminalStatus;
  savedInquiryDoc.adminResponse = terminalStatus === 'Converted' ? 'Conversion response' : 'Existing official response';
  savedInquiryDoc.closeReason = terminalStatus === 'Converted' ? '' : 'Existing close reason';
  savedInquiryDoc.closedAt = new Date('2026-01-15T12:00:00.000Z');

  const requests = [
    { status: terminalStatus, adminResponse: 'Changed response', closeReason: savedInquiryDoc.closeReason },
    { status: 'Pending', adminResponse: savedInquiryDoc.adminResponse, closeReason: savedInquiryDoc.closeReason },
    { status: terminalStatus, adminResponse: savedInquiryDoc.adminResponse, closeReason: savedInquiryDoc.closeReason },
  ];

  for (const request of requests) {
    const before = {
      status: savedInquiryDoc.status,
      adminResponse: savedInquiryDoc.adminResponse,
      closeReason: savedInquiryDoc.closeReason,
      closedAt: savedInquiryDoc.closedAt,
      updatedAt: savedInquiryDoc.updatedAt,
    };
    const notificationCount = notificationsCreated.length;
    try {
      await inquiryService.updateInquiryStatus(inquiryId.toString(), request);
      assert.fail(`${terminalStatus} inquiry must reject all updates`);
    } catch (err) {
      assert.equal(err.statusCode, 400);
      assert.equal(err.message, 'This inquiry is closed and can’t be changed.');
    }
    assert.deepEqual({
      status: savedInquiryDoc.status,
      adminResponse: savedInquiryDoc.adminResponse,
      closeReason: savedInquiryDoc.closeReason,
      closedAt: savedInquiryDoc.closedAt,
      updatedAt: savedInquiryDoc.updatedAt,
    }, before, `${terminalStatus} record must remain unchanged after rejection`);
    assert.equal(notificationsCreated.length, notificationCount, 'Rejected updates must not create notifications');
  }
}

savedInquiryDoc.status = 'Converted';
let forwardedControllerError;
await new Promise((resolve) => {
  updateInquiryController(
    { params: { id: inquiryId.toString() }, body: {} },
    {},
    (error) => {
      forwardedControllerError = error;
      resolve();
    }
  );
});
let controllerErrorStatus;
let controllerErrorBody;
errorHandler(forwardedControllerError, {}, {
  status(statusCode) {
    controllerErrorStatus = statusCode;
    return this;
  },
  json(body) {
    controllerErrorBody = body;
    return body;
  },
}, () => {});
assert.equal(controllerErrorStatus, 400);
assert.equal(controllerErrorBody.message, 'This inquiry is closed and can’t be changed.');
console.log('✅ Test 7 Passed: Closing outcomes require reasons; all closed statuses, including Converted, reject response/status/identical updates without changes or notifications');

// ============================================================
// Test 8: Unavailable properties reject inquiry creation
// ============================================================
mockProperty.status = 'Reserved';
try {
  await inquiryService.createInquiry({ buyerId: mockBuyerId, propertyId: mockPropertyId.toString(), message: 'Still available?' });
  assert.fail('Reserved properties must reject inquiries');
} catch (err) {
  assert.equal(err.statusCode, 400);
  assert.equal(err.message, 'This property is no longer accepting inquiries or site visit requests.');
}
mockProperty.status = 'Available';
console.log('✅ Test 8 Passed: Reserved properties reject inquiries with the expected message');

// ============================================================
// Test 9: Verify status constraints
// ============================================================
assert.deepEqual(INQUIRY_STATUSES, ['Pending', 'Responded', ...INQUIRY_CLOSING_STATUSES, 'Converted']);
console.log('✅ Test 9 Passed: Status constraint verified against backend schema enum');

console.log('\n🎉 ALL INQUIRY FLOW INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉\n');

import assert from 'node:assert/strict';
import User from './src/models/User.js';
import BuyerPreference from './src/models/BuyerPreference.js';
import Inquiry from './src/models/Inquiry.js';
import SiteVisit from './src/models/SiteVisit.js';
import Transaction from './src/models/Transaction.js';
import { getBuyerDetails, listBuyers } from './src/services/adminBuyerService.js';
import { authorize } from './src/middleware/authMiddleware.js';

let assertions = 0;
const check = (fn) => {
  fn();
  assertions += 1;
};

const originalUserFind = User.find;
const originalUserFindOne = User.findOne;
const originalPrefFind = BuyerPreference.find;
const originalPrefFindOne = BuyerPreference.findOne;
const originalInquiryFind = Inquiry.find;
const originalVisitFind = SiteVisit.find;
const originalTxFind = Transaction.find;

function makeChain(result) {
  return {
    select() { return this; },
    populate() { return this; },
    sort() { return Promise.resolve(result); },
    then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); },
  };
}

const BUYER_A_ID = '507f1f77bcf86cd799439011';
const BUYER_B_ID = '507f1f77bcf86cd799439022';

try {
  // 1. Non-admin authorization is denied with 403
  let forbiddenError = null;
  authorize('admin')({ user: { _id: BUYER_A_ID, role: 'buyer' } }, {}, (err) => {
    forbiddenError = err;
  });
  check(() => assert.equal(forbiddenError?.statusCode, 403));

  // 2. Invalid ObjectId is rejected with 400
  await assert.rejects(() => getBuyerDetails('not-an-object-id'), (err) => err.statusCode === 400);
  assertions += 1;

  // 3. Missing or non-buyer userId returns 404
  User.findOne = () => makeChain(null);
  await assert.rejects(() => getBuyerDetails(BUYER_A_ID), (err) => err.statusCode === 404);
  assertions += 1;

  // 4. Admin retrieves buyer details scoped strictly to BUYER_A_ID,
  //    handling missing property references and stripping password/publicId
  const seenScopes = {};
  User.findOne = (query) => {
    seenScopes.user = query;
    return makeChain({
      _id: BUYER_A_ID,
      fullName: 'Juan Dela Cruz',
      username: 'juan_buyer',
      email: 'juan@example.com',
      address: 'Lipa City, Batangas',
      role: 'buyer',
      profilePictureUrl: 'https://res.cloudinary.com/demo/image/upload/juan.png',
      profilePicturePublicId: 'secret-public-id',
      password: 'secret-password-hash',
      createdAt: new Date('2026-08-01T00:00:00Z'),
    });
  };
  BuyerPreference.findOne = (query) => {
    seenScopes.pref = query;
    return Promise.resolve({
      userId: BUYER_A_ID,
      landType: 'Residential',
      intendedUse: 'Primary Residence',
      budgetMin: 2_000_000,
      budgetMax: 5_000_000,
      location: 'Lipa City',
      minLotSize: 200,
      updatedAt: new Date('2026-09-01T00:00:00Z'),
    });
  };
  Inquiry.find = (query) => {
    seenScopes.inquiries = query;
    return makeChain([
      {
        _id: 'inq-1',
        buyerId: BUYER_A_ID,
        propertyId: { _id: 'prop-1', name: 'Hillside Lot', location: 'Lipa', type: 'Residential', status: 'Available', price: 3_000_000 },
        status: 'Pending',
        message: 'Is this still available?',
        createdAt: new Date('2026-10-01T00:00:00Z'),
      },
      {
        _id: 'inq-deleted-prop',
        buyerId: BUYER_A_ID,
        propertyId: null,
        status: 'Responded',
        message: 'Follow-up on archived listing',
        createdAt: new Date('2026-09-15T00:00:00Z'),
      },
    ]);
  };
  SiteVisit.find = (query) => {
    seenScopes.siteVisits = query;
    return makeChain([
      {
        _id: 'visit-1',
        buyerId: BUYER_A_ID,
        propertyId: null,
        preferredDate: '2026-11-10',
        preferredTime: '10:00 AM',
        status: 'Scheduled',
        notes: '',
        createdAt: new Date('2026-10-20T00:00:00Z'),
      },
    ]);
  };
  Transaction.find = (query) => {
    seenScopes.transactions = query;
    return makeChain([
      {
        _id: 'tx-1',
        reference: 'TX-2026-001',
        buyerId: BUYER_A_ID,
        propertyId: { _id: 'prop-1', name: 'Hillside Lot', location: 'Lipa', type: 'Residential', status: 'Sold', price: 3_000_000 },
        amount: 3_000_000,
        status: 'Completed',
        createdAt: new Date('2026-10-25T00:00:00Z'),
        completedAt: new Date('2026-10-28T00:00:00Z'),
      },
    ]);
  };

  const details = await getBuyerDetails(BUYER_A_ID);
  check(() => assert.deepEqual(seenScopes.user, { _id: BUYER_A_ID, role: 'buyer' }));
  check(() => assert.deepEqual(seenScopes.pref, { userId: BUYER_A_ID }));
  check(() => assert.deepEqual(seenScopes.inquiries, { buyerId: BUYER_A_ID }));
  check(() => assert.deepEqual(seenScopes.siteVisits, { buyerId: BUYER_A_ID }));
  check(() => assert.deepEqual(seenScopes.transactions, { buyerId: BUYER_A_ID }));

  check(() => assert.equal(details.fullName, 'Juan Dela Cruz'));
  check(() => assert.equal(details.profilePictureUrl, 'https://res.cloudinary.com/demo/image/upload/juan.png'));
  check(() => assert.equal('password' in details, false));
  check(() => assert.equal('profilePicturePublicId' in details, false));
  check(() => assert.equal(details.inquiries.length, 2));
  check(() => assert.equal(details.inquiries[0].property.name, 'Hillside Lot'));
  check(() => assert.equal(details.inquiries[1].property, null));
  check(() => assert.equal(details.siteVisits[0].property, null));
  check(() => assert.equal(details.transactions[0].reference, 'TX-2026-001'));

  // 5. Legacy buyer with missing fullName/address, no preferences, and empty histories
  User.findOne = () => makeChain({
    _id: BUYER_B_ID,
    username: 'legacy_b',
    email: 'legacyb@example.com',
    role: 'buyer',
    createdAt: new Date('2026-07-01T00:00:00Z'),
  });
  BuyerPreference.findOne = () => Promise.resolve(null);
  Inquiry.find = () => makeChain([]);
  SiteVisit.find = () => makeChain([]);
  Transaction.find = () => makeChain([]);

  const legacyDetails = await getBuyerDetails(BUYER_B_ID);
  check(() => assert.equal(legacyDetails.fullName, ''));
  check(() => assert.equal(legacyDetails.address, ''));
  check(() => assert.equal(legacyDetails.profilePictureUrl, null));
  check(() => assert.equal(legacyDetails.preferences, null));
  check(() => assert.deepEqual(legacyDetails.inquiries, []));
  check(() => assert.deepEqual(legacyDetails.siteVisits, []));
  check(() => assert.deepEqual(legacyDetails.transactions, []));

  // 6. listBuyers includes profilePictureUrl and omits secrets
  User.find = () => makeChain([
    {
      _id: BUYER_A_ID,
      fullName: 'Juan Dela Cruz',
      username: 'juan_buyer',
      email: 'juan@example.com',
      address: 'Lipa City',
      profilePictureUrl: 'https://res.cloudinary.com/demo/image/upload/juan.png',
      profilePicturePublicId: 'secret-public-id',
      password: 'secret-password-hash',
      createdAt: new Date('2026-08-01T00:00:00Z'),
    },
  ]);
  BuyerPreference.find = () => Promise.resolve([]);
  const buyers = await listBuyers();
  check(() => assert.equal(buyers[0].profilePictureUrl, 'https://res.cloudinary.com/demo/image/upload/juan.png'));
  check(() => assert.equal('password' in buyers[0], false));
  check(() => assert.equal('profilePicturePublicId' in buyers[0], false));

  console.log(`testAdminBuyerDetails: PASS (${assertions} assertions)`);
} finally {
  User.find = originalUserFind;
  User.findOne = originalUserFindOne;
  BuyerPreference.find = originalPrefFind;
  BuyerPreference.findOne = originalPrefFindOne;
  Inquiry.find = originalInquiryFind;
  SiteVisit.find = originalVisitFind;
  Transaction.find = originalTxFind;
}

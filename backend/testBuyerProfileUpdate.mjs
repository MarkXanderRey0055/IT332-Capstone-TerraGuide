import assert from 'node:assert/strict';
import User from './src/models/User.js';
import { updateMyProfile } from './src/services/authService.js';
import { updateMyProfile as updateMyProfileController } from './src/controllers/authController.js';
import { protect, authorize } from './src/middleware/authMiddleware.js';

let assertions = 0;
const check = (fn) => {
  fn();
  assertions += 1;
};

const originalFindOne = User.findOne;
const originalFindByIdAndUpdate = User.findByIdAndUpdate;

function makeSelectQuery(result) {
  return {
    select() {
      return Promise.resolve(result);
    },
    then(resolve, reject) {
      return Promise.resolve(result).then(resolve, reject);
    },
  };
}

const BUYER_ID = '507f1f77bcf86cd799439011';
const OTHER_USER_ID = '507f1f77bcf86cd799439099';

try {
  // 1. Successful profile information update (and protected fields are ignored)
  let capturedUpdate = null;
  User.findOne = (query) => {
    if (query._id === BUYER_ID && query.role === 'buyer') {
      return makeSelectQuery({
        _id: BUYER_ID,
        username: 'old_buyer',
        email: 'buyer@example.com',
        role: 'buyer',
        fullName: 'Old Name',
        address: 'Old Address',
        contactNumber: null,
        profilePictureUrl: 'https://res.cloudinary.com/demo/image/upload/avatar.png',
      });
    }
    // Duplicate username lookup returns null (available)
    return Promise.resolve(null);
  };
  User.findByIdAndUpdate = (id, update) => {
    capturedUpdate = { id, update };
    return makeSelectQuery({
      _id: BUYER_ID,
      username: update.$set.username,
      email: 'buyer@example.com',
      role: 'buyer',
      fullName: update.$set.fullName,
      address: update.$set.address,
      contactNumber: update.$set.contactNumber,
      profilePictureUrl: 'https://res.cloudinary.com/demo/image/upload/avatar.png',
      profilePicturePublicId: 'secret-public-id',
      password: 'hashed-password-secret',
    });
  };

  const updated = await updateMyProfile(BUYER_ID, {
    fullName: '  Maria Clara  ',
    username: '  Maria_Clara01  ',
    contactNumber: '  0917-123-4567  ',
    address: '  Lipa City, Batangas  ',
    // Attempted protected field modifications — must be ignored
    email: 'hacked@example.com',
    password: 'newpassword123',
    role: 'admin',
    profilePictureUrl: 'https://evil.example/avatar.png',
    profilePicturePublicId: 'evil/public-id',
    _id: OTHER_USER_ID,
    userId: OTHER_USER_ID,
  });

  check(() => assert.equal(capturedUpdate.id, BUYER_ID));
  check(() => assert.deepEqual(capturedUpdate.update, {
    $set: {
      fullName: 'Maria Clara',
      username: 'maria_clara01',
      address: 'Lipa City, Batangas',
      contactNumber: '0917-123-4567',
    },
  }));
  check(() => assert.equal(updated.fullName, 'Maria Clara'));
  check(() => assert.equal(updated.username, 'maria_clara01'));
  check(() => assert.equal(updated.contactNumber, '0917-123-4567'));
  check(() => assert.equal(updated.address, 'Lipa City, Batangas'));
  check(() => assert.equal(updated.email, 'buyer@example.com'));
  check(() => assert.equal(updated.role, 'buyer'));
  check(() => assert.equal(updated.profilePictureUrl, 'https://res.cloudinary.com/demo/image/upload/avatar.png'));
  check(() => assert.equal('password' in updated, false));
  check(() => assert.equal('profilePicturePublicId' in updated, false));

  // 2. Required field validation & invalid username / contactNumber validation
  await assert.rejects(
    () => updateMyProfile(BUYER_ID, {
      fullName: '   ',
      username: 'ab',
      address: '',
      contactNumber: 'invalid!!!',
    }),
    (err) =>
      err.statusCode === 400 &&
      Boolean(err.details?.fullName) &&
      Boolean(err.details?.username) &&
      Boolean(err.details?.address) &&
      Boolean(err.details?.contactNumber)
  );
  assertions += 1;

  // 3. Duplicate username rejection
  User.findOne = (query) => {
    if (query._id === BUYER_ID && query.role === 'buyer') {
      return makeSelectQuery({
        _id: BUYER_ID,
        username: 'old_buyer',
        email: 'buyer@example.com',
        role: 'buyer',
      });
    }
    // Simulate another user owning 'taken_user'
    if (query.username === 'taken_user') {
      return Promise.resolve({ _id: OTHER_USER_ID, username: 'taken_user' });
    }
    return Promise.resolve(null);
  };

  await assert.rejects(
    () => updateMyProfile(BUYER_ID, {
      fullName: 'Maria Clara',
      username: 'taken_user',
      address: 'Lipa City',
      contactNumber: '',
    }),
    (err) => err.statusCode === 400 && Boolean(err.details?.username)
  );
  assertions += 1;

  // 4. Legacy buyer with missing fullName/address/contactNumber can update cleanly
  //    (optional contactNumber omitted -> stored as null)
  User.findOne = (query) => {
    if (query._id === BUYER_ID && query.role === 'buyer') {
      return makeSelectQuery({
        _id: BUYER_ID,
        username: 'legacy_buyer',
        email: 'legacy@example.com',
        role: 'buyer',
      });
    }
    return Promise.resolve(null);
  };
  const legacyUpdated = await updateMyProfile(BUYER_ID, {
    fullName: 'Legacy Buyer',
    username: 'legacy_buyer',
    address: 'Batangas City',
    contactNumber: '',
  });
  check(() => assert.equal(legacyUpdated.fullName, 'Legacy Buyer'));
  check(() => assert.equal(legacyUpdated.address, 'Batangas City'));
  check(() => assert.equal(legacyUpdated.contactNumber, null));

  // 5. Unauthenticated request -> 401; non-buyer (admin) -> 403
  let unauthError = null;
  await new Promise((resolve) => {
    protect({ headers: {} }, {}, (err) => {
      unauthError = err;
      resolve();
    });
  });
  check(() => assert.equal(unauthError?.statusCode, 401));

  let forbiddenError = null;
  authorize('buyer')({ user: { _id: 'admin-1', role: 'admin' } }, {}, (err) => {
    forbiddenError = err;
  });
  check(() => assert.equal(forbiddenError?.statusCode, 403));

  // 6. Controller derives userId strictly from req.user._id, ignoring client body/params userId
  let queriedId = null;
  User.findOne = (query) => {
    queriedId = query._id;
    return makeSelectQuery(null);
  };
  let controllerError = null;
  await new Promise((resolve) => {
    updateMyProfileController(
      {
        user: { _id: BUYER_ID, role: 'buyer' },
        params: { userId: OTHER_USER_ID },
        body: { userId: OTHER_USER_ID, fullName: 'A', username: 'abc', address: 'X' },
      },
      { status() { return this; }, json() { return this; } },
      (err) => {
        controllerError = err;
        resolve();
      }
    );
  });
  check(() => assert.equal(queriedId, BUYER_ID));
  check(() => assert.equal(controllerError?.statusCode, 404));

  console.log(`testBuyerProfileUpdate: PASS (${assertions} assertions)`);
} finally {
  User.findOne = originalFindOne;
  User.findByIdAndUpdate = originalFindByIdAndUpdate;
}

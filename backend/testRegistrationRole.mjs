import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import User from './src/models/User.js';
import { registerUser } from './src/services/authService.js';

const originalFindOne = User.findOne;
const originalCreate = User.create;

let capturedCreateArg = null;
User.findOne = async () => null;
User.create = async (data) => {
  capturedCreateArg = data;
  const record = {
    _id: new mongoose.Types.ObjectId(),
    ...data,
  };
  return {
    ...record,
    toObject: () => ({ ...record }),
  };
};

const basePayload = {
  username: 'buyer_test',
  email: 'buyer_test@example.com',
  password: 'Password123!',
  fullName: 'Buyer Test',
  address: 'Balayan, Batangas',
};

try {
  // a. registerUser with role 'admin' stores role 'buyer'
  capturedCreateArg = null;
  const adminAttempt = await registerUser({ ...basePayload, role: 'admin' });
  assert.equal(capturedCreateArg.role, 'buyer', 'role "admin" must be ignored and stored as "buyer"');
  assert.equal(adminAttempt.user.role, 'buyer');

  // b. registerUser with role omitted stores role 'buyer'
  capturedCreateArg = null;
  const omittedRole = await registerUser({ ...basePayload });
  assert.equal(capturedCreateArg.role, 'buyer', 'omitted role must default to "buyer"');
  assert.equal(omittedRole.user.role, 'buyer');

  // c. registerUser with role 'buyer' stores role 'buyer'
  capturedCreateArg = null;
  const buyerRole = await registerUser({ ...basePayload, role: 'buyer' });
  assert.equal(capturedCreateArg.role, 'buyer', 'explicit "buyer" role must store "buyer"');
  assert.equal(buyerRole.user.role, 'buyer');

  // d. registerUser with missing username throws the 400 error
  await assert.rejects(
    registerUser({ ...basePayload, username: '' }),
    (error) => error.statusCode === 400
  );

  // e. Returned user does not include password
  assert.equal('password' in adminAttempt.user, false, 'returned user must not include password');
  assert.equal('password' in omittedRole.user, false, 'returned user must not include password');
  assert.equal('password' in buyerRole.user, false, 'returned user must not include password');

  console.log('Registration role tests passed: buyer-only role enforced, missing fields rejected with 400, password omitted from response.');
} finally {
  User.findOne = originalFindOne;
  User.create = originalCreate;
}

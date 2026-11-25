import assert from 'node:assert/strict';
import { validateAdminInput } from './scripts/createAdmin.mjs';

const validEnv = {
  ADMIN_USERNAME: 'admin_test',
  ADMIN_EMAIL: 'admin_test@example.com',
  ADMIN_PASSWORD: 'StrongPassword123!',
  ADMIN_FULL_NAME: 'Admin Test',
  ADMIN_ADDRESS: 'Balayan, Batangas',
};

// a. validateAdminInput with all five values valid returns no errors
const validResult = validateAdminInput(validEnv);
assert.equal(validResult.valid, true, 'valid admin input should pass validation');
assert.deepEqual(validResult.errors, []);
assert.deepEqual(validResult.missing, []);

// b. Each missing variable is reported by name
const requiredVars = [
  'ADMIN_USERNAME',
  'ADMIN_EMAIL',
  'ADMIN_PASSWORD',
  'ADMIN_FULL_NAME',
  'ADMIN_ADDRESS',
];

for (const varName of requiredVars) {
  const partialEnv = { ...validEnv, [varName]: '' };
  const result = validateAdminInput(partialEnv);
  assert.equal(result.valid, false, `missing ${varName} should fail validation`);
  assert.ok(result.missing.includes(varName), `missing list should include ${varName}`);
  assert.ok(
    result.errors.some((message) => message.includes(varName)),
    `error message should report ${varName} by name`
  );
}

// c. A short password is rejected, and the error message does not include the password value
const shortPassword = 'abc1234';
const shortPasswordResult = validateAdminInput({
  ...validEnv,
  ADMIN_PASSWORD: shortPassword,
});
assert.equal(shortPasswordResult.valid, false, 'password shorter than 8 characters should be rejected');
assert.ok(shortPasswordResult.errors.length > 0);
for (const message of shortPasswordResult.errors) {
  assert.equal(
    message.includes(shortPassword),
    false,
    'error message must never include the password value'
  );
}

// d. An invalid email is rejected
const invalidEmailResult = validateAdminInput({
  ...validEnv,
  ADMIN_EMAIL: 'not-an-email',
});
assert.equal(invalidEmailResult.valid, false, 'invalid email should be rejected');
assert.ok(
  invalidEmailResult.errors.some((message) => message.includes('ADMIN_EMAIL')),
  'error message should name ADMIN_EMAIL'
);

console.log('Create-admin validation tests passed: valid input accepted, missing variables reported by name, short password and invalid email rejected safely.');

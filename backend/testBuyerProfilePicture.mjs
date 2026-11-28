import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import User from './src/models/User.js';
import { getMe, updateMyProfilePicture } from './src/services/authService.js';
import { updateMyProfilePicture as updateMyProfilePictureController } from './src/controllers/authController.js';
import { uploadBuyerProfilePictureToCloudinary } from './src/services/imageStorageService.js';
import { uploadProfilePicture, MAX_PROFILE_IMAGE_SIZE } from './src/middleware/profileImageUpload.js';
import { protect, authorize } from './src/middleware/authMiddleware.js';

let assertions = 0;
const check = (fn) => {
  fn();
  assertions += 1;
};

// Minimal valid 1x1 PNG header/buffer
const VALID_PNG_BUFFER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
  0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
  0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
]);

const originalFindOne = User.findOne;
const originalFindById = User.findById;
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

function runMultipartMiddleware(boundary, bodyBuffer) {
  return new Promise((resolve) => {
    const req = Readable.from([bodyBuffer]);
    req.headers = {
      'content-type': `multipart/form-data; boundary=${boundary}`,
      'content-length': String(bodyBuffer.length),
    };
    uploadProfilePicture(req, {}, (err) => resolve({ err, file: req.file }));
  });
}

function buildMultipart(boundary, fieldName, filename, contentType, contentBuffer) {
  const head = Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\n` +
    `Content-Type: ${contentType}\r\n\r\n`
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return Buffer.concat([head, contentBuffer, tail]);
}

try {
  // 1. Legacy buyer without fullName, address, or profilePictureUrl can fetch profile via getMe
  const legacyBuyerId = '507f1f77bcf86cd799439011';
  User.findById = () => makeSelectQuery({
    _id: legacyBuyerId,
    username: 'legacy_buyer',
    email: 'legacy@example.com',
    role: 'buyer',
    password: 'hashed_secret_password',
    profilePicturePublicId: 'internal-public-id',
  });
  const me = await getMe(legacyBuyerId);
  check(() => assert.equal(me.username, 'legacy_buyer'));
  check(() => assert.equal(me.profilePictureUrl, null));
  check(() => assert.equal('password' in me, false));
  check(() => assert.equal('profilePicturePublicId' in me, false));

  // 2. Missing file is rejected with 400
  await assert.rejects(
    () => updateMyProfilePicture(legacyBuyerId, null),
    (err) => err.statusCode === 400
  );
  assertions += 1;

  // 3. Invalid file signature (text bytes claiming image/png) is rejected with 400
  await assert.rejects(
    () => uploadBuyerProfilePictureToCloudinary(legacyBuyerId, {
      buffer: Buffer.from('not-actually-a-png'),
      mimetype: 'image/png',
      size: 18,
    }),
    (err) => err.statusCode === 400
  );
  assertions += 1;

  // 4. Multer middleware rejects invalid MIME type (image/svg+xml) and oversized (> 5 MB)
  const boundary = '----TerraGuideTestBoundary';
  const invalidMimeBody = buildMultipart(boundary, 'image', 'avatar.svg', 'image/svg+xml', Buffer.from('<svg/>'));
  const invalidMimeRes = await runMultipartMiddleware(boundary, invalidMimeBody);
  check(() => assert.equal(invalidMimeRes.err?.statusCode, 400));

  const oversizedBody = buildMultipart(
    boundary,
    'image',
    'huge.png',
    'image/png',
    Buffer.alloc(MAX_PROFILE_IMAGE_SIZE + 1024, 1)
  );
  const oversizedRes = await runMultipartMiddleware(boundary, oversizedBody);
  check(() => assert.equal(oversizedRes.err?.statusCode, 400));

  // 5. Legacy buyer upload + replacement sequence:
  //    upload new -> DB findByIdAndUpdate -> cleanup old ONLY after DB succeeds
  const callOrder = [];
  const cleanedPublicIds = [];
  let savedUpdateDoc = null;

  User.findOne = (query) => {
    check(() => assert.deepEqual(query, { _id: legacyBuyerId, role: 'buyer' }));
    return makeSelectQuery({
      _id: legacyBuyerId,
      username: 'legacy_buyer',
      email: 'legacy@example.com',
      role: 'buyer',
      profilePictureUrl: 'https://res.cloudinary.com/demo/image/upload/old.png',
      profilePicturePublicId: 'terraguide/profiles/507f1f77bcf86cd799439011/old-avatar',
    });
  };
  User.findByIdAndUpdate = (id, update) => {
    callOrder.push('db-update');
    savedUpdateDoc = { id, update };
    return makeSelectQuery({
      _id: legacyBuyerId,
      username: 'legacy_buyer',
      email: 'legacy@example.com',
      role: 'buyer',
      password: 'should-be-stripped',
      profilePictureUrl: update.$set.profilePictureUrl,
      profilePicturePublicId: update.$set.profilePicturePublicId,
    });
  };

  const replaceResult = await updateMyProfilePicture(
    legacyBuyerId,
    { buffer: VALID_PNG_BUFFER, mimetype: 'image/png', size: VALID_PNG_BUFFER.length },
    {
      uploadProfilePicture: async (uid) => {
        callOrder.push('upload-new');
        return {
          url: `https://res.cloudinary.com/demo/image/upload/terraguide/profiles/${uid}/new-avatar.png`,
          publicId: `terraguide/profiles/${uid}/new-avatar`,
        };
      },
      cleanupAssets: async (assets) => {
        callOrder.push('cleanup');
        cleanedPublicIds.push(...assets.map((a) => a.publicId));
      },
    }
  );

  check(() => assert.deepEqual(callOrder, ['upload-new', 'db-update', 'cleanup']));
  check(() => assert.deepEqual(cleanedPublicIds, ['terraguide/profiles/507f1f77bcf86cd799439011/old-avatar']));
  check(() => assert.equal(
    savedUpdateDoc.update.$set.profilePictureUrl,
    `https://res.cloudinary.com/demo/image/upload/terraguide/profiles/${legacyBuyerId}/new-avatar.png`
  ));
  check(() => assert.equal(
    replaceResult.profilePictureUrl,
    `https://res.cloudinary.com/demo/image/upload/terraguide/profiles/${legacyBuyerId}/new-avatar.png`
  ));
  check(() => assert.equal('password' in replaceResult.user, false));
  check(() => assert.equal('profilePicturePublicId' in replaceResult.user, false));

  // 6. Failed DB update cleans up the NEWLY uploaded asset and leaves the old asset untouched
  const rollbackCleaned = [];
  User.findByIdAndUpdate = () => ({
    select() {
      return Promise.reject(new Error('Simulated DB write failure'));
    },
  });

  await assert.rejects(
    () => updateMyProfilePicture(
      legacyBuyerId,
      { buffer: VALID_PNG_BUFFER, mimetype: 'image/png', size: VALID_PNG_BUFFER.length },
      {
        uploadProfilePicture: async (uid) => ({
          url: `https://res.cloudinary.com/demo/image/upload/terraguide/profiles/${uid}/orphaned.png`,
          publicId: `terraguide/profiles/${uid}/orphaned`,
        }),
        cleanupAssets: async (assets) => {
          rollbackCleaned.push(...assets.map((a) => a.publicId));
        },
      }
    ),
    /Simulated DB write failure/
  );
  check(() => assert.deepEqual(rollbackCleaned, [`terraguide/profiles/${legacyBuyerId}/orphaned`]));

  // 7. Authorization checks: unauthenticated -> 401; admin role -> 403
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

  // 8. Controller ignores client-supplied userId in body/params and uses req.user._id
  let queriedUserId = null;
  User.findOne = (query) => {
    queriedUserId = query._id;
    return makeSelectQuery(null);
  };
  let controllerError = null;
  await new Promise((resolve) => {
    updateMyProfilePictureController(
      {
        user: { _id: legacyBuyerId, role: 'buyer' },
        params: { userId: '507f1f77bcf86cd799439099' },
        body: { userId: '507f1f77bcf86cd799439099' },
        file: { buffer: VALID_PNG_BUFFER, mimetype: 'image/png', size: VALID_PNG_BUFFER.length },
      },
      { status() { return this; }, json() { return this; } },
      (err) => {
        controllerError = err;
        resolve();
      }
    );
  });
  check(() => assert.equal(queriedUserId, legacyBuyerId));
  check(() => assert.equal(controllerError?.statusCode, 404));

  console.log(`testBuyerProfilePicture: PASS (${assertions} assertions)`);
} finally {
  User.findOne = originalFindOne;
  User.findById = originalFindById;
  User.findByIdAndUpdate = originalFindByIdAndUpdate;
}

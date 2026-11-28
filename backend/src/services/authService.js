import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import AppError from '../utils/errors.js';
import {
  uploadBuyerProfilePictureToCloudinary,
  cleanupCloudinaryAssets,
} from './imageStorageService.js';

function sanitizeUser(user) {
  const userObj = typeof user?.toObject === 'function' ? user.toObject() : { ...user };
  delete userObj.password;
  delete userObj.profilePicturePublicId;
  userObj.profilePictureUrl = userObj.profilePictureUrl ?? null;
  userObj.contactNumber = userObj.contactNumber ?? null;
  return userObj;
}

/**
 * Generate a JWT for a user.
 * @param {string} userId User ID
 * @returns {string} Signed JWT
 */
const generateToken = (userId) => {
  const secret = process.env.JWT_SECRET || 'your_jwt_secret_key_change_in_production';
  return jwt.sign({ id: userId }, secret, {
    expiresIn: '30d' // Token valid for 30 days
  });
};

/**
 * Service to register a new user.
 */
export const registerUser = async ({ username, email, password, fullName, address }) => {
  // Validate input presence
  if (!username || !email || !password || !fullName || !address) {
    throw new AppError('Please provide username, email, password, fullName, and address.', 400);
  }

  // Check if user already exists
  const existingUsername = await User.findOne({ username: username.toLowerCase() });
  if (existingUsername) {
    throw new AppError('A user with this username already exists.', 400);
  }

  const existingEmail = await User.findOne({ email: email.toLowerCase() });
  if (existingEmail) {
    throw new AppError('A user with this email already exists.', 400);
  }

  // Create new user in DB with added fields
  const newUser = await User.create({
    username,
    email,
    password,
    role: 'buyer',
    fullName,
    address
  });

  // Generate JWT token
  const token = generateToken(newUser._id);

  // Exclude password and internal storage IDs from output
  const userObj = sanitizeUser(newUser);

  return {
    user: userObj,
    token
  };
};

export const loginUser = async ({ username, password }) => {
  const query = username.includes("@")
    ? { email: username.toLowerCase() }
    : { username: username.toLowerCase() };

  const user = await User.findOne(query);

  if (!user) {
    throw new AppError("Invalid credentials.", 401);
  }

  const isMatch = await user.comparePassword(password);

  if (!isMatch) {
    throw new AppError("Invalid credentials.", 401);
  }

  const token = generateToken(user._id);

  const userObj = sanitizeUser(user);

  return {
    user: userObj,
    token
  };
};

/**
 * Service to retrieve the currently logged in user profile.
 */
export const getMe = async (userId) => {
  const user = await User.findById(userId).select('-password -profilePicturePublicId');
  if (!user) {
    throw new AppError('User not found.', 404);
  }
  return sanitizeUser(user);
};

/**
 * Upload or replace the authenticated buyer's profile picture.
 * Uses a targeted findByIdAndUpdate so legacy accounts with missing unrelated
 * fields (e.g. fullName or address) are not blocked by full-document validation.
 */
export const updateMyProfilePicture = async (
  userId,
  file,
  {
    uploadProfilePicture = uploadBuyerProfilePictureToCloudinary,
    cleanupAssets = cleanupCloudinaryAssets,
  } = {}
) => {
  if (!file) {
    throw new AppError('Please select an image file to upload.', 400);
  }

  const existing = await User.findOne({ _id: userId, role: 'buyer' }).select('+profilePicturePublicId');
  if (!existing) {
    throw new AppError('Buyer account not found.', 404);
  }

  const previousPublicId = existing.profilePicturePublicId || null;
  const uploaded = await uploadProfilePicture(String(existing._id), file);

  let updated;
  try {
    updated = await User.findByIdAndUpdate(
      existing._id,
      {
        $set: {
          profilePictureUrl: uploaded.url,
          profilePicturePublicId: uploaded.publicId,
        },
      },
      { new: true }
    ).select('-password -profilePicturePublicId');

    if (!updated) {
      throw new AppError('Buyer account not found.', 404);
    }
  } catch (error) {
    await cleanupAssets([{ publicId: uploaded.publicId }]);
    throw error;
  }

  if (previousPublicId && previousPublicId !== uploaded.publicId) {
    await cleanupAssets([{ publicId: previousPublicId }]);
  }

  const sanitizedUser = sanitizeUser(updated);
  return {
    user: sanitizedUser,
    profilePictureUrl: sanitizedUser.profilePictureUrl,
  };
};

const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;
const CONTACT_NUMBER_PATTERN = /^[0-9+\-\s()]{7,20}$/;

/**
 * Update the authenticated buyer's editable personal information.
 * Strictly allowlists fullName, username, contactNumber, and address.
 * Protected fields (email, password, role, profilePicture*, _id) are ignored.
 */
export const updateMyProfile = async (userId, payload = {}) => {
  const existing = await User.findOne({ _id: userId, role: 'buyer' }).select('-password -profilePicturePublicId');
  if (!existing) {
    throw new AppError('Buyer account not found.', 404);
  }

  const fullName = typeof payload.fullName === 'string' ? payload.fullName.trim() : '';
  const username = typeof payload.username === 'string' ? payload.username.trim().toLowerCase() : '';
  const address = typeof payload.address === 'string' ? payload.address.trim() : '';
  const rawContact = payload.contactNumber;
  const contactNumber =
    typeof rawContact === 'string' && rawContact.trim().length > 0
      ? rawContact.trim()
      : null;

  const errors = {};
  if (!fullName) {
    errors.fullName = 'Full name is required.';
  }
  if (!username) {
    errors.username = 'Username is required.';
  } else if (username.length < 3) {
    errors.username = 'Username must be at least 3 characters long.';
  } else if (!USERNAME_PATTERN.test(username)) {
    errors.username = 'Username can only contain letters, numbers, and underscores.';
  }
  if (!address) {
    errors.address = 'Address is required.';
  }
  if (contactNumber !== null && !CONTACT_NUMBER_PATTERN.test(contactNumber)) {
    errors.contactNumber = 'Please enter a valid contact number (7–20 digits or standard phone characters).';
  }

  if (Object.keys(errors).length > 0) {
    throw new AppError('Please fix the highlighted profile fields.', 400, errors);
  }

  if (username !== existing.username) {
    const duplicate = await User.findOne({
      username,
      _id: { $ne: existing._id },
    });
    if (duplicate) {
      throw new AppError('A user with this username already exists.', 400, {
        username: 'This username is already taken.',
      });
    }
  }

  const updated = await User.findByIdAndUpdate(
    existing._id,
    {
      $set: {
        fullName,
        username,
        address,
        contactNumber,
      },
    },
    { new: true }
  ).select('-password -profilePicturePublicId');

  if (!updated) {
    throw new AppError('Buyer account not found.', 404);
  }

  return sanitizeUser(updated);
};
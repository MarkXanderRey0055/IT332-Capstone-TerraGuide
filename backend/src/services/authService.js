import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import AppError from '../utils/errors.js';

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
export const registerUser = async ({ username, email, password, role }) => {
  // Validate input presence
  if (!username || !email || !password || !role) {
    throw new AppError('Please provide username, email, password, and role.', 400);
  }

  // Ensure role is either admin or buyer
  if (!['admin', 'buyer'].includes(role)) {
    throw new AppError('Role must be either "admin" or "buyer".', 400);
  }

  // Check if user already exists (custom check to throw a friendly error before Mongoose handles duplicates)
  const existingUsername = await User.findOne({ username: username.toLowerCase() });
  if (existingUsername) {
    throw new AppError('A user with this username already exists.', 400);
  }

  const existingEmail = await User.findOne({ email: email.toLowerCase() });
  if (existingEmail) {
    throw new AppError('A user with this email already exists.', 400);
  }

  // Create new user in DB
  const newUser = await User.create({
    username,
    email,
    password,
    role
  });

  // Generate JWT token
  const token = generateToken(newUser._id);

  // Exclude password from output
  const userObj = newUser.toObject();
  delete userObj.password;

  return {
    user: userObj,
    token
  };
};


export const loginUser = async ({ username, password }) => {
  console.log("\n========== LOGIN DEBUG ==========");
  console.log("Input:", username);

  const query = username.includes("@")
    ? { email: username.toLowerCase() }
    : { username: username.toLowerCase() };

  console.log("Query:", query);

  const user = await User.findOne(query);

  console.log("User found:", !!user);

  if (!user) {
    throw new AppError("Invalid credentials.", 401);
  }

  console.log("Stored username:", user.username);
  console.log("Stored email:", user.email);
  console.log("Stored hash:", user.password);

  const isMatch = await user.comparePassword(password);

  console.log("Password match:", isMatch);

  if (!isMatch) {
    throw new AppError("Invalid credentials.", 401);
  }

  console.log("LOGIN SUCCESS");

  const token = generateToken(user._id);

  const userObj = user.toObject();
  delete userObj.password;

  return {
    user: userObj,
    token
  };
};

/**
 * Service to retrieve the currently logged in user profile.
 */
export const getMe = async (userId) => {
  const user = await User.findById(userId).select('-password');
  if (!user) {
    throw new AppError('User not found.', 404);
  }
  return user;
};

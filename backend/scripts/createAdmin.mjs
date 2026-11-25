import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import connectDB from '../src/config/db.js';
import User from '../src/models/User.js';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(scriptDir, '../.env') });

const REQUIRED_ENV_VARS = [
  'ADMIN_USERNAME',
  'ADMIN_EMAIL',
  'ADMIN_PASSWORD',
  'ADMIN_FULL_NAME',
  'ADMIN_ADDRESS',
];

const SIMPLE_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

export function validateAdminInput(env = process.env) {
  const source = env ?? {};
  const missing = REQUIRED_ENV_VARS.filter(
    (name) => typeof source[name] !== 'string' || source[name].trim().length === 0
  );

  const errors = [];
  if (missing.length > 0) {
    errors.push(`Missing required environment variables: ${missing.join(', ')}`);
    return { valid: false, missing, errors };
  }

  const username = source.ADMIN_USERNAME.trim();
  const email = source.ADMIN_EMAIL.trim();
  const password = source.ADMIN_PASSWORD;
  const fullName = source.ADMIN_FULL_NAME.trim();
  const address = source.ADMIN_ADDRESS.trim();

  if (!SIMPLE_EMAIL_REGEX.test(email)) {
    errors.push('ADMIN_EMAIL must be a valid email address.');
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.push(`ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
  }

  if (errors.length > 0) {
    return { valid: false, missing: [], errors };
  }

  return {
    valid: true,
    missing: [],
    errors: [],
    values: { username, email, password, fullName, address },
  };
}

async function main() {
  const validation = validateAdminInput(process.env);
  if (!validation.valid) {
    for (const message of validation.errors) {
      console.error(message);
    }
    process.exitCode = 1;
    return;
  }

  const { username, email, password, fullName, address } = validation.values;

  await connectDB();
  try {
    const existing = await User.findOne({
      $or: [
        { username: username.toLowerCase() },
        { email: email.toLowerCase() },
      ],
    });

    if (existing) {
      console.error('An account with this username or email already exists');
      process.exitCode = 1;
      return;
    }

    const created = await User.create({
      username,
      email,
      password,
      role: 'admin',
      fullName,
      address,
    });

    console.log(`Created admin account: ${created.username}`);
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(async (error) => {
    console.error('Admin creation failed:', error.message);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    process.exitCode = 1;
  });
}

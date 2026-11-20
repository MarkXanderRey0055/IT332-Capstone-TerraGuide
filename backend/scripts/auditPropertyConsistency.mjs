import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import Property from '../src/models/Property.js';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(scriptDir, '../.env') });

const REQUIRED_FIELDS = ['name', 'owner', 'location', 'type', 'price', 'lotSize'];
const TEXT_FIELDS = new Set(['name', 'owner', 'location', 'type']);

function isInvalidValue(field, value) {
  if (TEXT_FIELDS.has(field)) {
    return typeof value !== 'string' || value.trim().length === 0;
  }
  return typeof value !== 'number' || !Number.isFinite(value) || value <= 0;
}

function formatValue(value) {
  if (value === undefined) return '(missing)';
  if (value === null) return '(null)';
  const text = typeof value === 'string' ? JSON.stringify(value) : String(value);
  return text.length > 40 ? `${text.slice(0, 37)}...` : text;
}

function formatPropertyName(value) {
  if (typeof value !== 'string' || !value.trim()) return '(missing)';
  const normalized = value.trim();
  return normalized.length > 40 ? `${normalized.slice(0, 37)}...` : normalized;
}

export async function auditPropertyConsistency({ log = console.log } = {}) {
  const properties = await Property.find()
    .select('_id name owner location type price lotSize status')
    .lean();
  const fieldCounts = Object.fromEntries(REQUIRED_FIELDS.map((field) => [field, 0]));
  const flaggedPropertyIds = new Set();
  const flaggedUnavailablePropertyIds = new Set();

  for (const property of properties) {
    for (const field of REQUIRED_FIELDS) {
      const value = property[field];
      if (!isInvalidValue(field, value)) continue;

      fieldCounts[field] += 1;
      flaggedPropertyIds.add(String(property._id));
      if (property.status === 'Reserved' || property.status === 'Sold') {
        flaggedUnavailablePropertyIds.add(String(property._id));
      }

      log([
        `Property ID: ${property._id}`,
        `Name: ${formatPropertyName(property.name)}`,
        `Status: ${property.status ?? '(missing)'}`,
        `${field}: ${formatValue(value)}`,
      ].join(' | '));
    }
  }

  log(`Total properties checked: ${properties.length}`);
  log(`Properties with at least one problem: ${flaggedPropertyIds.size}`);
  for (const field of REQUIRED_FIELDS) {
    log(`Invalid ${field}: ${fieldCounts[field]}`);
  }
  log(`Flagged Reserved or Sold properties: ${flaggedUnavailablePropertyIds.size}`);

  return {
    checkedCount: properties.length,
    flaggedCount: flaggedPropertyIds.size,
    flaggedUnavailableCount: flaggedUnavailablePropertyIds.size,
    fieldCounts,
  };
}

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not configured.');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  try {
    await auditPropertyConsistency();
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(async (error) => {
    console.error('Property consistency audit failed:', error.message);
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    process.exitCode = 1;
  });
}

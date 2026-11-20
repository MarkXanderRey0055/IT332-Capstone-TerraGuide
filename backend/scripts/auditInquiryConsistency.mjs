import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import Inquiry from '../src/models/Inquiry.js';
import '../src/models/User.js';
import '../src/models/Property.js';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(scriptDir, '../.env') });

export const isInquiryInconsistent = (inquiry) => {
  if (!['Pending', 'Responded'].includes(inquiry.status)) return false;
  const hasResponse = String(inquiry.adminResponse ?? '').trim().length > 0;
  return (inquiry.status === 'Pending' && hasResponse)
    || (inquiry.status === 'Responded' && !hasResponse);
};

const expectedConsistentStatus = (inquiry) =>
  String(inquiry.adminResponse ?? '').trim() ? 'Responded' : 'Pending';

export async function findInconsistentInquiries() {
  const records = await Inquiry.find({ status: { $in: ['Pending', 'Responded'] } })
    .populate('buyerId', 'email')
    .populate('propertyId', 'name');
  return records.filter(isInquiryInconsistent);
}

const responseExcerpt = (response) => {
  const normalized = String(response ?? '').trim().replace(/\s+/g, ' ');
  return normalized.length > 80 ? `${normalized.slice(0, 77)}...` : normalized || '(empty)';
};

export async function auditInquiryConsistency({ apply = false, log = console.log } = {}) {
  const matches = await findInconsistentInquiries();

  if (!apply) {
    for (const inquiry of matches) {
      log([
        `Inquiry ID: ${inquiry._id}`,
        `Buyer email: ${inquiry.buyerId?.email ?? '(unavailable)'}`,
        `Property: ${inquiry.propertyId?.name ?? '(unavailable)'}`,
        `Status: ${inquiry.status}`,
        `Response: ${responseExcerpt(inquiry.adminResponse)}`,
      ].join(' | '));
    }
    log(`Total inconsistent inquiries: ${matches.length}`);
    return { matches, changedIds: [] };
  }

  const changedIds = [];
  for (const inquiry of matches) {
    const correctedStatus = expectedConsistentStatus(inquiry);
    const allowed = inquiry.status === correctedStatus
      || (inquiry.status === 'Pending' && correctedStatus === 'Responded')
      || (inquiry.status === 'Responded' && correctedStatus === 'Pending');
    if (!allowed) continue;

    inquiry.status = correctedStatus;
    await inquiry.save();
    changedIds.push(inquiry._id.toString());
    log(`Repaired inquiry ID: ${inquiry._id}`);
  }

  log(`Total inquiries repaired: ${changedIds.length}`);
  return { matches, changedIds };
}

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not configured.');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  try {
    await auditInquiryConsistency({ apply: process.argv.includes('--apply') });
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(async (error) => {
    console.error('Inquiry consistency audit failed:', error.message);
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    process.exitCode = 1;
  });
}

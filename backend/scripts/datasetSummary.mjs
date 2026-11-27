import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import connectDB from '../src/config/db.js';
import Property from '../src/models/Property.js';
import User from '../src/models/User.js';
import BuyerPreference from '../src/models/BuyerPreference.js';
import Transaction from '../src/models/Transaction.js';
import Inquiry from '../src/models/Inquiry.js';
import SiteVisit from '../src/models/SiteVisit.js';
import SearchEvent from '../src/models/SearchEvent.js';
import Audit from '../src/models/Audit.js';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(scriptDir, '../.env') });

const PROPERTY_STATUSES = ['Available', 'Reserved', 'Sold'];
const TRANSACTION_STATUSES = ['Reserved', 'Processing', 'Completed', 'Cancelled'];
const INQUIRY_STATUSES = [
  'Pending',
  'Responded',
  'Not interested',
  'Property unavailable',
  'Duplicate',
  'Converted',
];
const SITE_VISIT_STATUSES = ['Pending', 'Scheduled', 'Completed'];
const SEARCH_WINDOW_DAYS = 30;
const LABEL_WIDTH = 36;

function safeCount(value) {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? Math.trunc(num) : 0;
}

function formatDate(value) {
  if (!value) return 'N/A';
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return 'N/A';
  return date.toISOString().slice(0, 10);
}

function formatRange(range) {
  if (!range || (!range.earliest && !range.latest)) return 'N/A';
  return `${formatDate(range.earliest)} to ${formatDate(range.latest)}`;
}

function row(label, value) {
  return `  ${label.padEnd(LABEL_WIDTH)} ${value}`;
}

function bucketStatuses(statusMap, knownStatuses) {
  const source = statusMap && typeof statusMap === 'object' ? statusMap : {};
  const knownSet = new Set(knownStatuses);
  const buckets = {};
  for (const status of knownStatuses) {
    buckets[status] = safeCount(source[status]);
  }
  let other = 0;
  for (const [key, count] of Object.entries(source)) {
    if (!knownSet.has(key)) {
      other += safeCount(count);
    }
  }
  buckets.Other = other;
  return buckets;
}

export function summarizeDataset(counts = {}) {
  const properties = counts?.properties ?? {};
  const buyers = counts?.buyers ?? {};
  const admins = counts?.admins ?? {};
  const transactions = counts?.transactions ?? {};
  const inquiries = counts?.inquiries ?? {};
  const siteVisits = counts?.siteVisits ?? {};
  const searchEvents = counts?.searchEvents ?? {};
  const audits = counts?.audits ?? {};

  const propStatuses = bucketStatuses(properties.byStatus, PROPERTY_STATUSES);
  const txnStatuses = bucketStatuses(transactions.byStatus, TRANSACTION_STATUSES);
  const inqStatuses = bucketStatuses(inquiries.byStatus, INQUIRY_STATUSES);
  const visitStatuses = bucketStatuses(siteVisits.byStatus, SITE_VISIT_STATUSES);

  const completedTotal = safeCount(transactions.completedTotal);
  const completedWithDate = safeCount(transactions.completedWithDate);
  const completedWithoutDate =
    transactions.completedWithoutDate !== undefined
      ? safeCount(transactions.completedWithoutDate)
      : Math.max(0, completedTotal - completedWithDate);

  const lines = [
    '=== TerraGuide Analytics Dataset Summary ===',
    '',
    'Properties',
    row('Total:', safeCount(properties.total)),
    ...PROPERTY_STATUSES.map((status) => row(`Status - ${status}:`, propStatuses[status])),
    row('Status - Other:', propStatuses.Other),
    row('Audited properties:', safeCount(properties.auditedCount)),
    row('Missing or invalid owner:', safeCount(properties.missingOrInvalidOwnerCount)),
    '',
    'Buyers',
    row('Total buyers:', safeCount(buyers.total)),
    row('Buyers with preferences:', safeCount(buyers.withPreferences)),
    '',
    'Admins',
    row('Total admins:', safeCount(admins.total)),
    '',
    'Transactions',
    row('Total:', safeCount(transactions.total)),
    ...TRANSACTION_STATUSES.map((status) => row(`Status - ${status}:`, txnStatuses[status])),
    row('Status - Other:', txnStatuses.Other),
    row('createdAt range:', formatRange(transactions.dateRange)),
    row('Completed total:', completedTotal),
    row('Completed with completedAt:', completedWithDate),
    row('Completed without completedAt:', completedWithoutDate),
    '',
    'Inquiries',
    row('Total:', safeCount(inquiries.total)),
    ...INQUIRY_STATUSES.map((status) => row(`Status - ${status}:`, inqStatuses[status])),
    row('Status - Other:', inqStatuses.Other),
    row('createdAt range:', formatRange(inquiries.dateRange)),
    '',
    'Site Visits',
    row('Total:', safeCount(siteVisits.total)),
    ...SITE_VISIT_STATUSES.map((status) => row(`Status - ${status}:`, visitStatuses[status])),
    row('Status - Other:', visitStatuses.Other),
    row('createdAt range:', formatRange(siteVisits.dateRange)),
    '',
    'Search Events',
    row('Total:', safeCount(searchEvents.total)),
    row('createdAt range:', formatRange(searchEvents.dateRange)),
    row('Last 30 days:', safeCount(searchEvents.last30Days)),
    row('recordSearch field stored:', 'No (not stored on SearchEvent model)'),
    '',
    'Audits',
    row('Total:', safeCount(audits.total)),
    row('createdAt/generatedAt range:', formatRange(audits.dateRange)),
  ];

  return lines;
}

function aggregationToMap(rows) {
  const map = {};
  for (const entry of rows) {
    const key = entry?._id ? String(entry._id) : 'Other';
    map[key] = safeCount(entry?.count);
  }
  return map;
}

async function getDateRange(Model, fieldExpr) {
  const [result] = await Model.aggregate([
    {
      $group: {
        _id: null,
        earliest: { $min: fieldExpr },
        latest: { $max: fieldExpr },
      },
    },
  ]);
  return {
    earliest: result?.earliest ?? null,
    latest: result?.latest ?? null,
  };
}

async function collectDatasetCounts(now = new Date()) {
  const searchWindowStart = new Date(
    now.getTime() - SEARCH_WINDOW_DAYS * 24 * 60 * 60 * 1000
  );

  const [
    propertyTotal,
    propertyStatusAgg,
    auditedPropertyIds,
    propertyOwners,
    buyerTotal,
    prefUserIds,
    adminTotal,
    transactionTotal,
    transactionStatusAgg,
    transactionDateRange,
    completedTotal,
    completedWithDate,
    inquiryTotal,
    inquiryStatusAgg,
    inquiryDateRange,
    siteVisitTotal,
    siteVisitStatusAgg,
    siteVisitDateRange,
    searchEventTotal,
    searchEventDateRange,
    searchEventLast30Days,
    auditTotal,
    auditDateRange,
  ] = await Promise.all([
    Property.countDocuments(),
    Property.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Audit.distinct('propertyId'),
    Property.find().select('owner').lean(),
    User.countDocuments({ role: 'buyer' }),
    BuyerPreference.distinct('userId'),
    User.countDocuments({ role: 'admin' }),
    Transaction.countDocuments(),
    Transaction.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    getDateRange(Transaction, '$createdAt'),
    Transaction.countDocuments({ status: 'Completed' }),
    Transaction.countDocuments({ status: 'Completed', completedAt: { $ne: null } }),
    Inquiry.countDocuments(),
    Inquiry.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    getDateRange(Inquiry, '$createdAt'),
    SiteVisit.countDocuments(),
    SiteVisit.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    getDateRange(SiteVisit, '$createdAt'),
    SearchEvent.countDocuments(),
    getDateRange(SearchEvent, '$createdAt'),
    SearchEvent.countDocuments({ createdAt: { $gte: searchWindowStart, $lte: now } }),
    Audit.countDocuments(),
    getDateRange(Audit, { $ifNull: ['$createdAt', '$generatedAt'] }),
  ]);

  const [auditedCount, buyersWithPreferences] = await Promise.all([
    auditedPropertyIds.length > 0
      ? Property.countDocuments({ _id: { $in: auditedPropertyIds } })
      : 0,
    prefUserIds.length > 0
      ? User.countDocuments({ role: 'buyer', _id: { $in: prefUserIds } })
      : 0,
  ]);

  const missingOrInvalidOwnerCount = propertyOwners.filter(
    (property) => typeof property?.owner !== 'string' || property.owner.trim().length === 0
  ).length;

  return {
    properties: {
      total: propertyTotal,
      byStatus: aggregationToMap(propertyStatusAgg),
      auditedCount,
      missingOrInvalidOwnerCount,
    },
    buyers: {
      total: buyerTotal,
      withPreferences: buyersWithPreferences,
    },
    admins: {
      total: adminTotal,
    },
    transactions: {
      total: transactionTotal,
      byStatus: aggregationToMap(transactionStatusAgg),
      dateRange: transactionDateRange,
      completedTotal,
      completedWithDate,
      completedWithoutDate: Math.max(0, completedTotal - completedWithDate),
    },
    inquiries: {
      total: inquiryTotal,
      byStatus: aggregationToMap(inquiryStatusAgg),
      dateRange: inquiryDateRange,
    },
    siteVisits: {
      total: siteVisitTotal,
      byStatus: aggregationToMap(siteVisitStatusAgg),
      dateRange: siteVisitDateRange,
    },
    searchEvents: {
      total: searchEventTotal,
      dateRange: searchEventDateRange,
      last30Days: searchEventLast30Days,
    },
    audits: {
      total: auditTotal,
      dateRange: auditDateRange,
    },
  };
}

async function main() {
  await connectDB();
  try {
    const counts = await collectDatasetCounts();
    const lines = summarizeDataset(counts);
    for (const line of lines) {
      console.log(line);
    }
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(async (error) => {
    console.error(error?.message || 'Dataset summary failed.');
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    process.exitCode = 1;
  });
}

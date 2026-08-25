import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { Writable } from 'node:stream';

import Property from './src/models/Property.js';
import Cabinet from './src/models/Cabinet.js';
import User from './src/models/User.js';
import BuyerPreference from './src/models/BuyerPreference.js';
import Transaction from './src/models/Transaction.js';
import * as exportService from './src/services/exportService.js';

const oid = () => new mongoose.Types.ObjectId();

/** Chainable, awaitable fake query — mirrors the pattern used in testTransactions.mjs */
function mockQuery(data) {
  const promise = Promise.resolve(data);
  promise.populate = () => mockQuery(data);
  promise.sort = () => mockQuery(data);
  promise.skip = () => mockQuery(data);
  promise.limit = () => mockQuery(data);
  promise.select = () => mockQuery(data);
  return promise;
}

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

const cabinetId = oid();
const propertyId1 = oid();
const propertyId2 = oid();
const buyerId1 = oid();
const buyerId2 = oid();
const adminId = oid();

const properties = [
  {
    _id: propertyId1,
    name: 'Bahay ni Xander',
    owner: 'Maricel Buño',
    location: 'Balayan, Batangas',
    type: 'Residential',
    price: 1500000,
    size: 200,
    lotSize: 200,
    pricePerSqm: 7500,
    status: 'Sold',
    lat: 13.9,
    lng: 120.7,
    documents: { deed: 'verified', tax: 'verified', survey: 'pending' },
    cabinetId,
    createdAt: new Date('2026-01-05T02:00:00.000Z'),
    updatedAt: new Date('2026-02-01T02:00:00.000Z'),
  },
  {
    // A property with a comma and quotes in its name/owner, to exercise CSV escaping
    _id: propertyId2,
    name: 'Green Meadows, "Phase 2"',
    owner: '',
    location: 'Lipa City',
    type: 'Agricultural',
    price: 800000,
    size: 0,
    lotSize: 500,
    pricePerSqm: 1600,
    status: 'Available',
    lat: 13.94,
    lng: 121.16,
    documents: { deed: 'pending', tax: 'missing', survey: 'pending' },
    cabinetId: null,
    createdAt: new Date('2026-03-10T02:00:00.000Z'),
    updatedAt: new Date('2026-03-10T02:00:00.000Z'),
  },
];

const cabinets = [{ _id: cabinetId, name: 'Balayan', toJSON() { return { _id: this._id, name: this.name }; } }];

const buyerUsers = [
  {
    _id: buyerId1,
    role: 'buyer',
    fullName: 'Juan Dela Cruz',
    username: 'juandelacruz',
    email: 'juan@example.com',
    address: 'Batangas City',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  },
  {
    _id: buyerId2,
    role: 'buyer',
    fullName: 'Maria Santos',
    username: 'sakit_likod',
    email: 'maria@example.com',
    address: 'Lipa City',
    createdAt: new Date('2026-02-15T00:00:00.000Z'),
  },
];

const preferences = [
  {
    userId: buyerId1,
    landType: 'Residential',
    intendedUse: 'Primary Residence',
    budgetMin: 1000000,
    budgetMax: 2000000,
    location: 'Batangas',
    minLotSize: 150,
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  },
  // buyerId2 intentionally has no preference doc, to test the "no preferences" row.
];

const transactions = [
  {
    _id: oid(),
    buyerId: { fullName: 'Juan Dela Cruz', username: 'juandelacruz', email: 'juan@example.com' },
    propertyId: { name: 'Bahay ni Xander', location: 'Balayan, Batangas', type: 'Residential', status: 'Sold', price: 1500000 },
    amount: 1450000,
    status: 'Completed',
    notes: 'Paid in full, "cash" basis',
    createdBy: { fullName: 'Admin User', username: 'admin' },
    completedAt: new Date('2026-02-01T02:00:00.000Z'),
    createdAt: new Date('2026-01-10T02:00:00.000Z'),
    get reference() {
      return `TXN-${this._id.toHexString().slice(-6).toUpperCase()}`;
    },
  },
];

/* ------------------------------------------------------------------ */
/* Model mocking                                                       */
/* ------------------------------------------------------------------ */

Property.find = () => mockQuery(properties);
Property.countDocuments = async (filter) => {
  if (filter && filter.cabinetId === null) {
    return properties.filter((p) => p.cabinetId === null).length;
  }
  return properties.length;
};
Property.aggregate = async () => [{ _id: cabinetId, count: 1 }];

Cabinet.find = () => mockQuery(cabinets);

User.find = () => mockQuery(buyerUsers);

BuyerPreference.find = () => mockQuery(preferences);

Transaction.find = () => mockQuery(transactions);

/* ------------------------------------------------------------------ */
/* Fake `res` object that captures headers + written body              */
/* ------------------------------------------------------------------ */

function makeFakeRes() {
  const chunks = [];
  const stream = new Writable({
    write(chunk, encoding, callback) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      callback();
    },
  });
  stream.headers = {};
  stream.setHeader = function (name, value) {
    this.headers[name] = value;
  };
  stream.send = function (body) {
    chunks.push(Buffer.isBuffer(body) ? body : Buffer.from(body));
    this.body = Buffer.concat(chunks).toString('utf8');
  };
  stream.on('finish', () => {
    stream.body = Buffer.concat(chunks);
    stream._ended = true;
  });
  return stream;
}

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

async function testPropertiesCSV() {
  const res = makeFakeRes();
  await exportService.exportDatasetCSV('properties', res);

  assert.equal(res.headers['Content-Type'], 'text/csv; charset=utf-8');
  assert.match(res.headers['Content-Disposition'], /^attachment; filename="TerraGuide_Properties_\d{4}-\d{2}-\d{2}\.csv"$/);

  const csv = res.body.replace(/^\uFEFF/, '');
  const lines = csv.trim().split('\r\n');
  assert.equal(lines.length, 3, 'header + 2 property rows');
  assert.equal(
    lines[0],
    'Property Name,Owner,Location,Type,Price,Lot Size (sqm),Price per Sqm,Status,Cabinet,Latitude,Longitude,Deed Status,Tax Status,Survey Status,Created Date,Updated Date'
  );

  // Row 1: plain values, numeric price/lotSize unquoted, cabinet name resolved.
  assert.match(lines[1], /^Bahay ni Xander,Maricel Buño,"Balayan, Batangas",Residential,1500000,200,7500,Sold,Balayan,13\.9,120\.7,verified,verified,pending,/);

  // Row 2: name with comma+quotes must be CSV-escaped; empty owner stays empty; unassigned cabinet.
  assert.match(lines[2], /^"Green Meadows, ""Phase 2""",,Lipa City,Agricultural,800000,500,1600,Available,Unassigned,13\.94,121\.16,pending,missing,pending,/);

  console.log('✓ Properties CSV: headers, escaping, numeric values, cabinet resolution all correct');
}

async function testBuyersCSVNoPasswords() {
  const res = makeFakeRes();
  await exportService.exportDatasetCSV('buyers', res);

  assert.match(res.headers['Content-Disposition'], /TerraGuide_Buyers_\d{4}-\d{2}-\d{2}\.csv/);

  const csv = res.body.replace(/^\uFEFF/, '');
  assert.doesNotMatch(csv.toLowerCase(), /password/, 'password field must never appear in buyer export');

  const lines = csv.trim().split('\r\n');
  assert.equal(lines.length, 3, 'header + 2 buyer rows');
  assert.match(lines[1], /^Juan Dela Cruz,juandelacruz,juan@example\.com,Batangas City,.*,1000000,2000000,Residential,Primary Residence,Batangas,150$/);
  // Buyer with no preference doc -> preference fields blank, not malformed.
  assert.match(lines[2], /^Maria Santos,sakit_likod,maria@example\.com,Lipa City,.*,,,,,,$/);

  console.log('✓ Buyers CSV: no password leakage, missing preferences render as clean blanks');
}

async function testTransactionsCSV() {
  const res = makeFakeRes();
  await exportService.exportDatasetCSV('transactions', res);

  const csv = res.body.replace(/^\uFEFF/, '');
  const lines = csv.trim().split('\r\n');
  assert.equal(lines.length, 2, 'header + 1 transaction row');
  assert.match(lines[1], /^TXN-[0-9A-F]{6},Juan Dela Cruz,Bahay ni Xander,1450000,Completed,"Paid in full, ""cash"" basis",Admin User,.*,.*$/);

  console.log('✓ Transactions CSV: reference, notes escaping, numeric amount all correct');
}

function waitFinish(stream) {
  return new Promise((resolve) => stream.on('finish', resolve));
}

async function testPropertiesPDF() {
  const res = makeFakeRes();
  const finished = waitFinish(res);
  await exportService.exportDatasetPDF('properties', res);
  await finished;

  assert.equal(res.headers['Content-Type'], 'application/pdf');
  assert.match(res.headers['Content-Disposition'], /TerraGuide_Properties_\d{4}-\d{2}-\d{2}\.pdf/);
  assert.ok(res._ended, 'PDF stream should end');
  assert.ok(Buffer.isBuffer(res.body) && res.body.slice(0, 4).toString() === '%PDF', 'output should be a valid PDF binary');
  assert.ok(res.body.length > 500, 'PDF should have real content, not an empty shell');

  console.log('✓ Properties PDF: valid PDF binary generated with headers');
}

async function testAllDataZip() {
  const res = makeFakeRes();
  const finished = waitFinish(res);
  await exportService.exportAllDataZip(res);
  await finished;

  assert.equal(res.headers['Content-Type'], 'application/zip');
  assert.match(res.headers['Content-Disposition'], /TerraGuide_AllData_\d{4}-\d{2}-\d{2}\.zip/);
  assert.ok(res._ended, 'ZIP stream should end');
  // ZIP local file header signature
  assert.equal(res.body.slice(0, 2).toString('hex'), '504b', 'output should be a valid ZIP binary');
  assert.ok(res.body.length > 200, 'ZIP should contain real archived content');

  console.log('✓ All Data ZIP: valid ZIP binary generated containing CSV entries');
}

async function run() {
  await testPropertiesCSV();
  await testBuyersCSVNoPasswords();
  await testTransactionsCSV();
  await testPropertiesPDF();
  await testAllDataZip();
  console.log('\nAll export tests passed.');
}

run().catch((err) => {
  console.error('✗ Export test failed:', err);
  process.exit(1);
});

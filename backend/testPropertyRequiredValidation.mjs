import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import Property from './src/models/Property.js';
import { createProperty, updateProperty } from './src/controllers/propertyController.js';
import { errorHandler } from './src/middleware/errorMiddleware.js';
import { validatePropertyInput } from './src/middleware/propertyValidation.js';

const records = new Map();
let createCalls = 0;
const existingId = 'existing-property';
const existing = {
  _id: existingId,
  name: 'Existing listing',
  owner: 'Valid Owner',
  price: 500_000,
  lotSize: 200,
  location: 'Balayan',
  type: 'Residential',
  description: 'Original description',
  lat: 13.9,
  lng: 120.7,
  save: async function save() {
    records.set(existingId, this);
    return this;
  },
};
records.set(existingId, existing);

Property.create = async (data) => {
  createCalls += 1;
  const created = { _id: `created-${createCalls}`, ...data };
  records.set(created._id, created);
  return created;
};
Property.findById = async (id) => records.get(String(id)) ?? null;

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.user = { id: 'test-admin' };
  next();
});
app.post('/properties', validatePropertyInput, createProperty);
app.put('/properties/:id', validatePropertyInput, updateProperty);
app.use(errorHandler);

const server = http.createServer(app);
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const snapshotRecords = () => [...records.entries()].map(([id, value]) => {
  const { save, ...plainValue } = value;
  return [id, structuredClone(plainValue)];
});

async function request(method, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

const validPayload = {
  name: 'New listing',
  owner: ' Owner Name ',
  price: 750_000,
  lotSize: 250,
  location: 'Balayan',
  type: 'Residential',
  lat: 13.9,
  lng: 120.7,
};

try {
  const recordsBeforeRejections = snapshotRecords();
  const createCallsBeforeRejections = createCalls;
  const failures = [
    [
      { ...validPayload, price: 0 },
      { price: 'Please enter a valid price greater than 0.' },
    ],
    [
      { ...validPayload, lotSize: -10 },
      { lotSize: 'Please enter a valid lot size greater than 0.' },
    ],
    [
      Object.fromEntries(Object.entries(validPayload).filter(([key]) => key !== 'owner')),
      { owner: 'Owner name is required.' },
    ],
  ];

  for (const [payload, expectedErrors] of failures) {
    const response = await request('POST', '/properties', payload);
    assert.equal(response.status, 400);
    assert.deepEqual(response.body.errors, expectedErrors);
  }
  assert.equal(createCalls, createCallsBeforeRejections, 'rejected POST requests must not create records');
  assert.deepEqual(snapshotRecords(), recordsBeforeRejections, 'rejected POST requests must leave records unchanged');

  const beforeInvalidUpdate = snapshotRecords().find(([id]) => id === existingId)[1];
  const invalidUpdate = await request('PUT', `/properties/${existingId}`, { owner: '   ' });
  assert.equal(invalidUpdate.status, 400);
  assert.deepEqual(invalidUpdate.body.errors, { owner: 'Owner name is required.' });
  const afterInvalidUpdate = { ...records.get(existingId) };
  delete afterInvalidUpdate.save;
  assert.deepEqual(afterInvalidUpdate, beforeInvalidUpdate, 'rejected PUT must leave the stored record unchanged');

  const validUpdate = await request('PUT', `/properties/${existingId}`, { name: 'Renamed listing' });
  assert.equal(validUpdate.status, 200);
  assert.equal(records.get(existingId).name, 'Renamed listing');
  assert.equal(records.get(existingId).owner, 'Valid Owner');

  const validCreate = await request('POST', '/properties', validPayload);
  assert.equal(validCreate.status, 201);
  assert.equal(validCreate.body.success, true);
  assert.equal(createCalls, createCallsBeforeRejections + 1);

  const maxDescriptionCreate = await request('POST', '/properties', {
    ...validPayload,
    description: 'x'.repeat(500),
  });
  assert.equal(maxDescriptionCreate.status, 201, 'a 500-character description is accepted');
  assert.equal(maxDescriptionCreate.body.data.description.length, 500);

  const beforeTooLongDescription = snapshotRecords();
  const tooLongDescription = await request('POST', '/properties', {
    ...validPayload,
    description: 'x'.repeat(501),
  });
  assert.equal(tooLongDescription.status, 400);
  assert.deepEqual(tooLongDescription.body.errors, { description: 'Description must be 500 characters or fewer.' });
  assert.deepEqual(snapshotRecords(), beforeTooLongDescription, 'rejected description must not write a record');

  const trimmedDescription = await request('POST', '/properties', {
    ...validPayload,
    description: '  Short property summary  ',
  });
  assert.equal(trimmedDescription.status, 201);
  assert.equal(trimmedDescription.body.data.description, 'Short property summary');

  const clearDescription = await request('PUT', `/properties/${existingId}`, { description: '' });
  assert.equal(clearDescription.status, 200);
  assert.equal(records.get(existingId).description, '', 'blank PUT explicitly clears the stored description');

  const trimmedUpdate = await request('PUT', `/properties/${existingId}`, { description: '  Updated summary  ' });
  assert.equal(trimmedUpdate.status, 200);
  assert.equal(records.get(existingId).description, 'Updated summary');
  console.log('Property required-value API tests passed: invalid POST/PUT requests return per-field 400 errors without writes; valid partial PUT and POST succeed.');
} finally {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

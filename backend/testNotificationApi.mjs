import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Notification from './src/models/Notification.js';
import { protect } from './src/middleware/authMiddleware.js';
import notificationRoutes from './src/routes/notificationRoutes.js';
import {
  getMyNotifications,
  getMyUnreadCount,
  markMyNotificationRead,
  markMyNotificationsRead,
} from './src/controllers/NotificationController.js';

const id = () => new mongoose.Types.ObjectId();
const userId = id();
const otherUserId = id();
const ownedUnread = { _id: id(), recipientId: userId, read: false, createdAt: new Date('2026-01-02') };
const secondOwnedUnread = { _id: id(), recipientId: userId, read: false, createdAt: new Date('2026-01-01T12:00:00.000Z') };
const ownedRead = { _id: id(), recipientId: userId, read: true, createdAt: new Date('2026-01-01') };
const foreignUnread = { _id: id(), recipientId: otherUserId, read: false, createdAt: new Date('2026-01-03') };
const records = [ownedUnread, secondOwnedUnread, ownedRead, foreignUnread];
const matches = (record, filter) => Object.entries(filter).every(([key, value]) => String(record[key]) === String(value));

Notification.find = (filter) => {
  let result = records.filter((record) => matches(record, filter));
  const query = {
    sort(order) {
      const [key] = Object.keys(order);
      result = [...result].sort((a, b) => new Date(b[key]) - new Date(a[key]));
      return query;
    },
    limit(max) { result = result.slice(0, max); return query; },
    then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); },
  };
  return query;
};
Notification.countDocuments = async (filter) => records.filter((record) => matches(record, filter)).length;
Notification.findOneAndUpdate = async (filter, update) => {
  const record = records.find((item) => matches(item, filter));
  if (!record) return null;
  Object.assign(record, update.$set);
  return record;
};
Notification.updateMany = async (filter, update) => {
  const matching = records.filter((record) => matches(record, filter));
  matching.forEach((record) => Object.assign(record, update.$set));
  return { modifiedCount: matching.length };
};

function call(handler, req) {
  return new Promise((resolve, reject) => {
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(body) { resolve({ statusCode: this.statusCode, body }); return body; },
    };
    handler(req, res, reject);
  });
}

const listed = await call(getMyNotifications, { user: { _id: userId } });
assert.equal(listed.body.success, true);
assert.deepEqual(listed.body.data.map((item) => String(item._id)), [String(ownedUnread._id), String(secondOwnedUnread._id), String(ownedRead._id)]);

const count = await call(getMyUnreadCount, { user: { _id: userId } });
assert.deepEqual(count.body.data, { count: 2 });

const marked = await call(markMyNotificationRead, { user: { _id: userId }, params: { id: String(ownedUnread._id) } });
assert.equal(marked.body.data.read, true);

await assert.rejects(
  call(markMyNotificationRead, { user: { _id: userId }, params: { id: String(foreignUnread._id) } }),
  (error) => error.statusCode === 404 && error.message === 'Notification not found.'
);

const readAll = await call(markMyNotificationsRead, { user: { _id: userId } });
assert.equal(readAll.body.data.updatedCount, 1);
assert.equal(secondOwnedUnread.read, true);
assert.equal(foreignUnread.read, false, 'read-all must not modify another user’s notification');

const routes = notificationRoutes.stack.filter((layer) => layer.route).map((layer) => layer.route);
assert.deepEqual(routes.map((route) => `${Object.keys(route.methods)[0].toUpperCase()} ${route.path}`), [
  'GET /', 'GET /unread-count', 'PATCH /read-all', 'PATCH /:id/read',
]);
assert.ok(routes.every((route) => route.stack[0].handle === protect), 'Every route must use protect');

console.log('Notification API tests passed: user scoping, unread count, read operations, route order, and authentication middleware.');

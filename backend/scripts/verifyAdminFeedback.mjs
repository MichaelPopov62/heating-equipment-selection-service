/**
 * Назначение: verify контракта admin feedback, cursor, статусов, SSE hub и модели.
 */

import assert from 'node:assert/strict';
import express from 'express';
import mongoose from 'mongoose';

import { createAdminFeedbackRouter } from '../src/api/adminFeedbackRoutes.js';
import {
  buildFeedbackStatusUpdate,
  decodeFeedbackCursor,
  encodeFeedbackCursor,
  parseAdminFeedbackListQuery,
  parseAdminFeedbackPatchBody,
  serializeAdminFeedback,
} from '../src/feedback/adminFeedback.js';
import {
  feedbackEventSubscriberCount,
  publishFeedbackEvent,
  subscribeFeedbackEvents,
} from '../src/feedback/feedbackEventHub.js';
import { Feedback } from '../src/models/Feedback.js';

const id = new mongoose.Types.ObjectId('64b000000000000000000001');
const createdAt = new Date('2026-07-29T10:00:00.000Z');
const updatedAt = new Date('2026-07-29T10:01:00.000Z');

const cursor = encodeFeedbackCursor({ createdAt, id });
assert.deepEqual(decodeFeedbackCursor(cursor), { createdAt, id });
assert.equal(decodeFeedbackCursor('not-a-cursor'), null);

assert.deepEqual(parseAdminFeedbackListQuery({}), {
  ok: true,
  value: { limit: 20 },
});
assert.equal(parseAdminFeedbackListQuery({ limit: '0' }).ok, false);
assert.equal(parseAdminFeedbackListQuery({ limit: '101' }).ok, false);
assert.equal(parseAdminFeedbackListQuery({ status: 'invalid' }).ok, false);
assert.equal(parseAdminFeedbackListQuery({ type: 'other' }).ok, false);
assert.equal(parseAdminFeedbackListQuery({ status: ['new', 'read'] }).ok, false);
assert.equal(parseAdminFeedbackListQuery({ cursor }).ok, true);

assert.deepEqual(parseAdminFeedbackPatchBody({ status: 'read' }), {
  ok: true,
  status: 'read',
});
assert.equal(parseAdminFeedbackPatchBody({ status: 'read', extra: true }).ok, false);

const now = new Date('2026-07-29T11:00:00.000Z');
const oldReadAt = new Date('2026-07-29T10:30:00.000Z');
assert.deepEqual(buildFeedbackStatusUpdate('new', oldReadAt, now), {
  $set: { status: 'new' },
  $unset: { readAt: 1, resolvedAt: 1 },
});
assert.deepEqual(buildFeedbackStatusUpdate('read', oldReadAt, now), {
  $set: { status: 'read', readAt: oldReadAt },
  $unset: { resolvedAt: 1 },
});
assert.deepEqual(buildFeedbackStatusUpdate('resolved', undefined, now), {
  $set: { status: 'resolved', readAt: now, resolvedAt: now },
});

const item = serializeAdminFeedback({
  _id: id,
  type: 'bug',
  status: 'new',
  message: 'Ошибка',
  clientIp: '127.0.0.1',
  createdAt,
  updatedAt,
});
assert.equal(item.id, String(id));
assert.equal('clientIp' in item, false);
assert.equal(
  serializeAdminFeedback({
    _id: id,
    type: 'contact',
    message: 'Legacy feedback',
    createdAt,
    updatedAt,
  }).status,
  'new',
);

let received = null;
const unsubscribe = subscribeFeedbackEvents((event) => {
  received = event;
});
assert.equal(feedbackEventSubscriberCount(), 1);
publishFeedbackEvent({ event: 'feedback.created', feedback: item });
assert.deepEqual(received, { event: 'feedback.created', feedback: item });
unsubscribe();
assert.equal(feedbackEventSubscriberCount(), 0);

assert.equal(Feedback.schema.path('status').defaultValue, 'new');
assert.ok(Feedback.schema.path('readAt'));
assert.ok(Feedback.schema.path('resolvedAt'));
const indexKeys = Feedback.schema.indexes().map(([keys]) => JSON.stringify(keys));
assert.ok(indexKeys.includes(JSON.stringify({ createdAt: -1, _id: -1 })));
assert.ok(indexKeys.includes(JSON.stringify({ status: 1, type: 1, createdAt: -1, _id: -1 })));

const router = createAdminFeedbackRouter();
const routePaths = router.stack
  .filter((layer) => layer.route)
  .map((layer) => String(layer.route.path));
assert.ok(
  routePaths.indexOf('/api/v1/admin/feedback/stream') <
    routePaths.indexOf('/api/v1/admin/feedback/:id'),
  'SSE route must be declared before /:id',
);

const app = express();
app.use(router);
const server = app.listen(0, '127.0.0.1');
await new Promise((resolve) => server.once('listening', resolve));
const address = server.address();
assert.ok(address && typeof address === 'object');
const baseUrl = `http://127.0.0.1:${address.port}`;

const originalFind = Feedback.find;
let observedFilter = null;
Feedback.find = (filter) => {
  observedFilter = filter;
  const query = {
    sort() {
      return query;
    },
    limit() {
      return query;
    },
    lean() {
      return query;
    },
    async exec() {
      return [
        {
          _id: id,
          type: 'bug',
          message: 'Legacy HTTP feedback',
          clientIp: '127.0.0.1',
          createdAt,
          updatedAt,
        },
      ];
    },
  };
  return query;
};

try {
  const listResponse = await fetch(
    `${baseUrl}/api/v1/admin/feedback?limit=1&status=new`,
  );
  assert.equal(listResponse.status, 200);
  const listBody = await listResponse.json();
  assert.equal(listBody.limit, 1);
  assert.equal(listBody.items[0].status, 'new');
  assert.equal('clientIp' in listBody.items[0], false);
  assert.deepEqual(observedFilter.$and[0].$or, [
    { status: 'new' },
    { status: { $exists: false } },
  ]);

  const controller = new AbortController();
  const streamResponse = await fetch(`${baseUrl}/api/v1/admin/feedback/stream`, {
    signal: controller.signal,
  });
  assert.equal(streamResponse.status, 200);
  assert.match(streamResponse.headers.get('content-type') ?? '', /^text\/event-stream/);
  assert.ok(streamResponse.body);
  const reader = streamResponse.body.getReader();
  const decoder = new TextDecoder();
  const connectedChunk = await reader.read();
  assert.match(decoder.decode(connectedChunk.value), /: connected\n\n/);
  assert.equal(feedbackEventSubscriberCount(), 1);

  publishFeedbackEvent({ event: 'feedback.created', feedback: item });
  const eventChunk = await reader.read();
  const eventText = decoder.decode(eventChunk.value);
  assert.match(eventText, /event: feedback\.created\n/);
  assert.match(eventText, /"id":"64b000000000000000000001"/);

  controller.abort();
  await reader.cancel().catch(() => {});
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(feedbackEventSubscriberCount(), 0);
} finally {
  Feedback.find = originalFind;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

console.log('verify:admin-feedback OK');

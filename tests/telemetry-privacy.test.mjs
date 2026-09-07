import test from 'node:test';
import assert from 'node:assert/strict';

import {
  runTelemetryRequest,
  sanitizeTelemetryEvent,
} from '../functions/utils/telemetryPrivacy.js';

test('telemetry strips credentials, query strings and visitor metadata', () => {
  const event = sanitizeTelemetryEvent({
    request: {
      method: 'POST',
      url: 'https://images.example/api/upload?authCode=secret',
      headers: { authorization: 'Bearer secret', cookie: 'token=secret' },
      cookies: { token: 'secret' },
      query_string: 'authCode=secret',
      data: 'secret-body',
    },
    user: { ip_address: '203.0.113.1' },
    contexts: {
      request: { headers: { authorization: 'secret' } },
      cf: { country: 'XX' },
      runtime: { name: 'cloudflare' },
    },
  });

  assert.deepEqual(event.request, { method: 'POST', url: '/api/upload' });
  assert.equal(event.user, undefined);
  assert.deepEqual(event.contexts, { runtime: { name: 'cloudflare' } });
});

test('telemetry executes downstream once and always finishes its transaction', async () => {
  let nextCalls = 0;
  let finishCalls = 0;
  const tags = {};
  const context = {
    request: new Request('https://images.example/api/upload?authCode=secret', {
      method: 'POST',
      headers: { authorization: 'Bearer secret', cookie: 'token=secret' },
    }),
    data: {
      sentry: {
        setTag(key, value) { tags[key] = value; },
        startTransaction() {
          return { finish() { finishCalls += 1; } };
        },
      },
    },
    async next() {
      nextCalls += 1;
      throw new Error('downstream failure');
    },
  };

  await assert.rejects(runTelemetryRequest(context), /downstream failure/);
  assert.equal(nextCalls, 1);
  assert.equal(finishCalls, 1);
  assert.deepEqual(tags, { path: '/api/upload', method: 'POST' });
});

test('missing telemetry client falls back without a cleanup exception', async () => {
  let nextCalls = 0;
  const response = await runTelemetryRequest({
    request: new Request('https://images.example/'),
    data: {},
    async next() {
      nextCalls += 1;
      return new Response('ok');
    },
  });

  assert.equal(await response.text(), 'ok');
  assert.equal(nextCalls, 1);
});

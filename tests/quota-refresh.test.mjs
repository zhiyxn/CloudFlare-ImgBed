import test from 'node:test';
import assert from 'node:assert/strict';

import { onRequest } from '../functions/api/manage/quota.js';

test('quota POST schedules a rebuild instead of waiting for a full scan', async () => {
  let scheduled;
  let releaseList;
  const listGate = new Promise((resolve) => { releaseList = resolve; });
  const kv = {
    async get(key) {
      if (key === 'manage@index@meta') {
        return JSON.stringify({
          totalCount: 12,
          totalSizeMB: 34,
          channelStats: { R2: { usedMB: 34, fileCount: 12 } },
          lastUpdated: 123,
        });
      }
      return null;
    },
    async list() {
      await listGate;
      return { keys: [], cursor: null };
    },
    async put() {},
    async delete() {},
  };

  const response = await onRequest({
    request: new Request('https://images.example/api/manage/quota', { method: 'POST' }),
    env: { img_url: kv },
    waitUntil(promise) { scheduled = promise; },
  });
  const body = await response.json();

  assert.equal(response.status, 202);
  assert.equal(body.rebuildScheduled, true);
  assert.equal(body.totalCount, 12);
  assert.ok(scheduled instanceof Promise);

  releaseList();
  await scheduled;
});

import test from 'node:test';
import assert from 'node:assert/strict';

import { onRequest as manageMiddleware } from '../functions/api/manage/_middleware.js';
import { getSecurityConfig } from '../functions/api/manage/sysConfig/security.js';

test('empty stored credentials do not shadow environment credentials', async () => {
  const db = {
    async get() {
      return JSON.stringify({
        auth: {
          user: { authCode: '' },
          admin: { adminUsername: '', adminPassword: '' },
        },
      });
    },
  };
  const settings = await getSecurityConfig(db, {
    AUTH_CODE: 'user-from-env',
    BASIC_USER: 'admin-from-env',
    BASIC_PASS: 'password-from-env',
  });

  assert.deepEqual(settings.auth, {
    user: { authCode: 'user-from-env' },
    admin: { adminUsername: 'admin-from-env', adminPassword: 'password-from-env' },
  });
});

test('non-empty stored credentials still override environment defaults', async () => {
  const db = {
    async get() {
      return JSON.stringify({
        auth: {
          user: { authCode: 'user-from-db' },
          admin: { adminUsername: 'admin-from-db', adminPassword: 'password-from-db' },
        },
      });
    },
  };
  const settings = await getSecurityConfig(db, {
    AUTH_CODE: 'user-from-env', BASIC_USER: 'admin-from-env', BASIC_PASS: 'password-from-env',
  });

  assert.deepEqual(settings.auth, {
    user: { authCode: 'user-from-db' },
    admin: { adminUsername: 'admin-from-db', adminPassword: 'password-from-db' },
  });
});

test('manage API errors do not disclose messages or stack traces', async () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    const response = await manageMiddleware[0]({
      async next() {
        const error = new Error('database password leaked');
        error.stack = 'secret stack trace';
        throw error;
      },
    });
    const body = await response.text();

    assert.equal(response.status, 500);
    assert.equal(response.headers.get('cache-control'), 'private, no-store, max-age=0');
    assert.deepEqual(JSON.parse(body), { error: 'Internal Server Error' });
    assert.doesNotMatch(body, /database password|secret stack/i);
  } finally {
    console.error = originalError;
  }
});

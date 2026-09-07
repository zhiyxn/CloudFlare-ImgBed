import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authenticate, AUTH_SCOPE } from '../functions/utils/auth/authCore.js';

function kvWithSecurityConfig(value) {
    return {
        get(key) {
            return key === 'manage@sysConfig@security' ? value : null;
        },
        put() {},
        delete() {},
        list() { return { keys: [], list_complete: true }; },
    };
}

test('authentication fails closed when security configuration cannot be read', async () => {
    const env = {
        img_url: kvWithSecurityConfig(null),
    };
    env.img_url.get = () => { throw new Error('simulated database failure'); };

    await assert.rejects(
        authenticate({
            env,
            request: new Request('https://example.test/api/manage/list'),
            requiredPermission: 'list',
            authScope: AUTH_SCOPE.ADMIN,
        }),
        /simulated database failure/,
    );
});

test('an explicitly empty authentication configuration remains open', async () => {
    const security = JSON.stringify({
        auth: {
            user: { authCode: '' },
            admin: { adminUsername: '', adminPassword: '' },
        },
    });
    const result = await authenticate({
        env: { img_url: kvWithSecurityConfig(security) },
        request: new Request('https://example.test/api/manage/list'),
        requiredPermission: 'list',
        authScope: AUTH_SCOPE.ADMIN,
    });

    assert.deepEqual(result, { authorized: true, authType: 'admin' });
});

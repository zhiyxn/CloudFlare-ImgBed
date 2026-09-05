import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleCORS } from '../functions/utils/cors.js';
import { fileUrl } from '../functions/utils/fileUrl.js';

test('preflight permits legacy authCode without touching authentication or storage', async () => {
    const response = await handleCORS({
        request: new Request('https://example.test/upload', { method: 'OPTIONS' }),
        next() { throw new Error('preflight must not access storage'); },
    });
    assert.equal(response.status, 204);
    assert.equal(await response.text(), '');
    assert.match(response.headers.get('Access-Control-Allow-Headers'), /authCode/);
    assert.match(response.headers.get('Access-Control-Allow-Headers'), /Authorization/);
    assert.match(response.headers.get('Access-Control-Allow-Methods'), /DELETE/);
    assert.equal(response.headers.get('Access-Control-Allow-Credentials'), null);
});

for (const status of [200, 206, 401, 403, 500]) {
    test(`CORS preserves downstream status ${status}, headers and body`, async () => {
        let called = 0;
        const response = await handleCORS({
            request: new Request('https://example.test/api/manage/list'),
            next() {
                called++;
                return new Response('downstream', { status, headers: {
                    'Cache-Control': 'private, no-store',
                    'Content-Type': 'text/plain',
                    'Content-Range': 'bytes 0-9/100',
                } });
            },
        });
        assert.equal(called, 1);
        assert.equal(response.status, status);
        assert.equal(await response.text(), 'downstream');
        assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
        assert.equal(response.headers.get('Content-Range'), 'bytes 0-9/100');
        assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
        assert.equal(response.headers.get('Access-Control-Allow-Credentials'), null);
    });
}

test('HEAD remains bodyless', async () => {
    const response = await handleCORS({
        request: new Request('https://example.test/file/test', { method: 'HEAD' }),
        next: () => new Response(null, { status: 200 }),
    });
    assert.equal(response.body, null);
});

test('file URL encodes special characters while preserving directories and origin', () => {
    assert.equal(
        fileUrl('http://localhost:8080', '目录/space #?%文件.png'),
        'http://localhost:8080/file/%E7%9B%AE%E5%BD%95/space%20%23%3F%25%E6%96%87%E4%BB%B6.png',
    );
    assert.equal(fileUrl('https://example.test', 'a/b.png'), 'https://example.test/file/a/b.png');
    assert.equal(fileUrl('https://example.test', 'a%2Fb.png'), 'https://example.test/file/a%252Fb.png');
});

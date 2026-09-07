import test from 'node:test';
import assert from 'node:assert/strict';

import {
    getAllowedChildDirectories,
    getPublicDirectoryAccess,
    normalizeAllowedDirectories,
    normalizePublicDirectory,
} from '../functions/api/public/directoryAccess.js';
import { onRequest as listPublicFiles } from '../functions/api/public/list.js';

function publicBrowseContext(url, allowedDir) {
    return {
        request: new Request(url),
        env: {
            img_url: {
                async get(key) {
                    if (key !== 'manage@sysConfig@others') return null;
                    return JSON.stringify({ publicBrowse: { enabled: true, allowedDir } });
                },
            },
        },
    };
}

test('normalizes configured public directories without widening access', () => {
    assert.deepEqual(
        normalizeAllowedDirectories([' /photos/ ', 'photos', 'docs/reports/', '../private']),
        ['photos', 'docs/reports'],
    );
    assert.equal(normalizeAllowedDirectories(['../private']), null);
    assert.equal(getPublicDirectoryAccess('', normalizeAllowedDirectories(['../private'])), 'denied');
    assert.deepEqual(normalizeAllowedDirectories(['photos', '*', 'private']), ['*']);
});

test('rejects traversal directory requests', () => {
    assert.equal(normalizePublicDirectory('photos/../private'), null);
    assert.equal(normalizePublicDirectory('photos\\..\\private'), null);
    assert.equal(getPublicDirectoryAccess('photos/../private', ['photos']), 'denied');
});

test('restricted public roots expose navigation ancestors but not their contents', () => {
    const allowed = normalizeAllowedDirectories(['photos/2026', 'docs', 'photos/events']);

    assert.equal(getPublicDirectoryAccess('', allowed), 'navigation');
    assert.equal(getPublicDirectoryAccess('photos', allowed), 'navigation');
    assert.equal(getPublicDirectoryAccess('photos/2026', allowed), 'content');
    assert.equal(getPublicDirectoryAccess('photos/2026/trip', allowed), 'content');
    assert.equal(getPublicDirectoryAccess('private', allowed), 'denied');

    assert.deepEqual(getAllowedChildDirectories('', allowed), ['photos', 'docs']);
    assert.deepEqual(getAllowedChildDirectories('photos', allowed), ['photos/2026', 'photos/events']);
});

test('empty and wildcard allow-lists preserve unrestricted browsing', () => {
    assert.equal(getPublicDirectoryAccess('', []), 'content');
    assert.equal(getPublicDirectoryAccess('any/folder', []), 'content');
    assert.equal(getPublicDirectoryAccess('', ['*']), 'content');
    assert.equal(getPublicDirectoryAccess('any/folder', ['*']), 'content');
});

test('public list root returns only virtual entries leading to configured roots', async () => {
    const response = await listPublicFiles(publicBrowseContext(
        'https://example.test/api/public/list?dir=',
        'photos/2026,docs,photos/events',
    ));
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body.files, []);
    assert.deepEqual(body.directories, ['photos', 'docs']);
    assert.equal(body.totalCount, 0);
});

test('public list exposes the next allowed path segment and still denies siblings', async () => {
    const parentResponse = await listPublicFiles(publicBrowseContext(
        'https://example.test/api/public/list?dir=photos',
        'photos/2026,docs,photos/events',
    ));
    assert.equal(parentResponse.status, 200);
    assert.deepEqual((await parentResponse.json()).directories, ['photos/2026', 'photos/events']);

    const deniedResponse = await listPublicFiles(publicBrowseContext(
        'https://example.test/api/public/list?dir=private',
        'photos/2026,docs,photos/events',
    ));
    assert.equal(deniedResponse.status, 403);
    assert.deepEqual(await deniedResponse.json(), { error: 'Directory not allowed' });
});

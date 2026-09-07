import test from 'node:test';
import assert from 'node:assert/strict';

import {
  fetchPublicHttpResource,
  RemoteUrlError,
  validatePublicHttpUrl,
} from '../functions/utils/safeRemoteFetch.js';

test('remote URL validation rejects private, metadata and credentialed targets', () => {
  const blocked = [
    'http://127.0.0.1/image.png',
    'http://2130706433/image.png',
    'http://169.254.169.254/latest/meta-data',
    'http://10.0.0.1/image.png',
    'http://[::1]/image.png',
    'http://[::ffff:127.0.0.1]/image.png',
    'http://metadata.google.internal/',
    'https://user:password@example.com/image.png',
    'file:///etc/passwd',
  ];

  for (const url of blocked) {
    assert.throws(() => validatePublicHttpUrl(url), RemoteUrlError, url);
  }
  assert.equal(validatePublicHttpUrl('https://cdn.example/image.png').hostname, 'cdn.example');
});

test('remote fetch validates every redirect before making the next request', async () => {
  const originalFetch = globalThis.fetch;
  const fetched = [];
  globalThis.fetch = async (url) => {
    fetched.push(String(url));
    return new Response(null, {
      status: 302,
      headers: { location: 'http://169.254.169.254/latest/meta-data' },
    });
  };

  try {
    await assert.rejects(
      fetchPublicHttpResource('https://cdn.example/image.png'),
      /internal addresses/,
    );
    assert.deepEqual(fetched, ['https://cdn.example/image.png']);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('remote fetch follows a validated public redirect', async () => {
  const originalFetch = globalThis.fetch;
  const fetched = [];
  globalThis.fetch = async (url) => {
    fetched.push(String(url));
    if (fetched.length === 1) {
      return new Response(null, { status: 302, headers: { location: '/final.png' } });
    }
    return new Response('image', { status: 200 });
  };

  try {
    const response = await fetchPublicHttpResource('https://cdn.example/start.png');
    assert.equal(await response.text(), 'image');
    assert.deepEqual(fetched, [
      'https://cdn.example/start.png',
      'https://cdn.example/final.png',
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

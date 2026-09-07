/**
 * 远程资源代理读取 API
 * 负责在鉴权后拉取请求体中指定 URL 的资源并透传响应内容
 */
import { dualAuthCheck } from '../utils/auth/dualAuth.js';
import { fetchPublicHttpResource, RemoteUrlError } from '../utils/safeRemoteFetch.js';

const IS_NODE_RUNTIME = typeof process !== 'undefined' && Boolean(process.versions?.node);
const HOP_BY_HOP_HEADERS = [
    'connection',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailer',
    'transfer-encoding',
    'upgrade'
];

/**
 * Build response headers that are safe to send on a new proxy response.
 * Node's fetch transparently decompresses upstream bodies while retaining
 * Content-Encoding/Content-Length, so those headers must be removed there.
 *
 * @param {Headers} responseHeaders - headers returned by the upstream server
 * @returns {Headers}
 */
function createProxyHeaders(responseHeaders) {
    const headers = new Headers(responseHeaders);

    for (const name of HOP_BY_HOP_HEADERS) {
        headers.delete(name);
    }

    if (IS_NODE_RUNTIME) {
        headers.delete('content-encoding');
        headers.delete('content-length');
    }

    return headers;
}

export async function onRequest(context) {
    // 获取请求体中URL的内容
    const {
        request,
        env,
        params,
        waitUntil,
        next,
        data
    } = context;

    // 双重鉴权检查
    const url = new URL(request.url);
    const { authorized } = await dualAuthCheck(env, url, request);
    if (!authorized) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const jsonRequest = await request.json();
    const targetUrl = jsonRequest.url;
    if (targetUrl === undefined) {
        return new Response('URL is required', { status: 400 })
    }

    try {
        const response = await fetchPublicHttpResource(targetUrl);

        const headers = createProxyHeaders(response.headers);
        return new Response(response.body, {
            headers: headers,
            status: response.status
        })
    } catch (error) {
        if (error instanceof RemoteUrlError) {
            return new Response(JSON.stringify({ error: error.message }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        throw error;
    }
}

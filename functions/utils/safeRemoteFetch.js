const IS_NODE_RUNTIME = typeof process !== 'undefined' && Boolean(process.versions?.node);

export class RemoteUrlError extends Error {
    constructor(message) {
        super(message);
        this.name = 'RemoteUrlError';
    }
}

export function isPrivateHostname(hostname) {
    if (!hostname) return true;
    let value = hostname.toLowerCase();
    if (value.startsWith('[') && value.endsWith(']')) value = value.slice(1, -1);

    if (value === 'localhost' || value === 'ip6-localhost' || value === 'ip6-loopback') return true;
    if (value.endsWith('.localhost') || value.endsWith('.local') || value.endsWith('.internal')) return true;
    if (value === 'metadata.google.internal' || value === 'metadata.goog') return true;

    const ipv4 = value.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4) {
        const octets = ipv4.slice(1).map(Number);
        if (octets.some((part) => part > 255)) return true;
        const [a, b] = octets;
        return a === 0 || a === 10 || a === 127 ||
            (a === 100 && b >= 64 && b <= 127) ||
            (a === 169 && b === 254) ||
            (a === 172 && b >= 16 && b <= 31) ||
            (a === 192 && b === 168) || a >= 224;
    }

    if (value.includes(':')) {
        if (value === '::' || value === '::1') return true;
        if (value.startsWith('fe8') || value.startsWith('fe9') || value.startsWith('fea') || value.startsWith('feb')) return true;
        if (value.startsWith('fc') || value.startsWith('fd')) return true;
        const mapped = value.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
        if (mapped) return isPrivateHostname(mapped[1]);
        const mappedHex = value.match(/^::ffff:(?:0:)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
        if (mappedHex) {
            const high = parseInt(mappedHex[1], 16);
            const low = parseInt(mappedHex[2], 16);
            return isPrivateHostname(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`);
        }
    }

    return false;
}

export function validatePublicHttpUrl(input) {
    let parsed;
    try {
        parsed = new URL(input);
    } catch {
        throw new RemoteUrlError('Invalid URL');
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new RemoteUrlError('Only http(s) URLs are allowed');
    }
    if (parsed.username || parsed.password) {
        throw new RemoteUrlError('Credentials in URL are not allowed');
    }
    if (isPrivateHostname(parsed.hostname)) {
        throw new RemoteUrlError('Access to internal addresses is not allowed');
    }
    return parsed;
}

function fetchTarget(url) {
    const options = { redirect: 'manual' };
    if (IS_NODE_RUNTIME) options.headers = { 'Accept-Encoding': 'identity' };
    return fetch(url.toString(), options);
}

export async function fetchPublicHttpResource(input, maxRedirects = 5) {
    let currentUrl = validatePublicHttpUrl(input);

    for (let hops = 0; ; hops += 1) {
        const response = await fetchTarget(currentUrl);
        const location = response.headers.get('location');
        if (response.status < 300 || response.status >= 400 || !location) return response;

        const nextUrl = validatePublicHttpUrl(new URL(location, currentUrl).toString());
        if (hops >= maxRedirects) throw new RemoteUrlError('Too many redirects');
        currentUrl = nextUrl;
    }
}

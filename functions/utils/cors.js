// Preserve this fork's token-based cross-origin clients without enabling cookies.
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, authCode',
    'Access-Control-Max-Age': '86400',
};

export async function handleCORS(context) {
    if (context.request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Authentication and database checks still run for every actual request.
    const response = await context.next();
    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries(corsHeaders)) {
        headers.set(name, value);
    }
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
    });
}

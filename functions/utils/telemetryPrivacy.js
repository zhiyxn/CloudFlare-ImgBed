export function sanitizeTelemetryEvent(event) {
  if (!event || typeof event !== 'object') return event;

  const sanitized = { ...event };

  if (event.request && typeof event.request === 'object') {
    const request = {};
    if (typeof event.request.method === 'string') request.method = event.request.method;
    if (typeof event.request.url === 'string') {
      try {
        request.url = new URL(event.request.url, 'https://telemetry.invalid').pathname;
      } catch {
        request.url = '/';
      }
    }
    sanitized.request = request;
  }

  // Never attach visitor identity or arbitrary request/Cloudflare contexts.
  delete sanitized.user;
  if (event.contexts && typeof event.contexts === 'object') {
    const contexts = { ...event.contexts };
    delete contexts.request;
    delete contexts.cf;
    sanitized.contexts = contexts;
  }

  return sanitized;
}

export async function runTelemetryRequest(context) {
  const sentry = context.data?.sentry;
  if (!sentry) return context.next();

  let transaction;
  try {
    const pathname = new URL(context.request.url).pathname;
    const method = context.request.method;
    sentry.setTag('path', pathname);
    sentry.setTag('method', method);
    transaction = sentry.startTransaction({ name: `${method} ${pathname}` });
    context.data.transaction = transaction;
  } catch (error) {
    console.warn('Telemetry setup failed:', error);
    return context.next();
  }

  try {
    return await context.next();
  } finally {
    transaction?.finish();
  }
}

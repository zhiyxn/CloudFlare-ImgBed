import { checkDatabaseConfig } from '../utils/middleware';

// CORS 处理中间件
async function handleCORS(context) {
  const { request } = context;

  // 优先处理 OPTIONS 请求（CORS 预检）
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, authCode',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  return await context.next(); // 继续处理其他中间件
}

export const onRequest = [handleCORS, checkDatabaseConfig];
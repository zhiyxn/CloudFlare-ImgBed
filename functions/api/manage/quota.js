/**
 * 容量配额管理 API
 * GET: 获取各渠道容量统计（从索引元数据读取）
 * POST: 重新统计容量（触发索引重建）
 */

import { getIndexMeta, rebuildIndex } from '../../utils/indexManager.js';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
};

export async function onRequest(context) {
    const { request, env } = context;

    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    // GET: 获取容量统计（从索引元数据读取，只需 1 次读取）
    if (request.method === 'GET') {
        return await getQuotaStats(context);
    }

    // POST: 重新统计容量（触发索引重建）
    if (request.method === 'POST') {
        return await recalculateQuota(context);
    }

    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
}

// 获取各渠道容量统计（从索引元数据读取）
async function getQuotaStats(context) {
    try {
        const indexMeta = await getIndexMeta(context);

        return new Response(JSON.stringify({
            success: true,
            quotaStats: indexMeta.channelStats || {},
            totalSizeMB: indexMeta.totalSizeMB || 0,
            totalCount: indexMeta.totalCount || 0,
            lastUpdated: indexMeta.lastUpdated
        }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}

// 重新统计容量。重建放入后台执行，避免大数据集占满单次请求时限。
async function recalculateQuota(context) {
    try {
        // 先返回当前快照，保持旧客户端所需的字段；新统计会在后台完成后生效。
        const indexMeta = await getIndexMeta(context);
        context.waitUntil(rebuildIndex(context));

        return new Response(JSON.stringify({
            success: true,
            rebuildScheduled: true,
            message: 'Quota recalculation scheduled',
            channelStats: indexMeta.channelStats || {},
            totalSizeMB: indexMeta.totalSizeMB || 0,
            totalCount: indexMeta.totalCount || 0,
            lastUpdated: indexMeta.lastUpdated
        }), {
            status: 202,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}

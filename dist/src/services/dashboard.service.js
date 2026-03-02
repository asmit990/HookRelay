"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboardStats = getDashboardStats;
const client_1 = require("../config/db/client");
async function getDashboardStats(userId) {
    const [webhookCounts, deliveryStatsToday, recentLogs, topFailingWebhooks, hourlyTrend] = await Promise.all([
        getWebhookCounts(userId),
        getDeliveryStatsToday(userId),
        getRecentLogs(userId),
        getTopFailingWebhooks(userId),
        getHourlyTrend(userId)
    ]);
    const totalToday = deliveryStatsToday.successCount + deliveryStatsToday.failedCount;
    const successRate = totalToday === 0
        ? '0%'
        : `${((deliveryStatsToday.successCount / totalToday) * 100).toFixed(1)}%`;
    return {
        totalWebhooks: webhookCounts.total,
        activeWebhooks: webhookCounts.active,
        deadWebhooks: webhookCounts.dead,
        eventsToday: deliveryStatsToday.totalEvents,
        successToday: deliveryStatsToday.successCount,
        failedToday: deliveryStatsToday.failedCount,
        successRate,
        recentLogs,
        topFailingWebhooks,
        hourlyTrend
    };
}
async function getWebhookCounts(userId) {
    const groups = await client_1.prisma.webhook.groupBy({
        by: ['isActive'],
        where: { userId },
        _count: { id: true }
    });
    const active = groups.find((g) => g.isActive === true)?._count.id ?? 0;
    const inactive = groups.find((g) => g.isActive === false)?._count.id ?? 0;
    const total = active + inactive;
    const deadWebhooks = await client_1.prisma.webhook.count({
        where: {
            userId,
            deliveryLogs: {
                some: { status: 'DEAD' }
            }
        }
    });
    return { total, active, inactive, dead: deadWebhooks };
}
async function getDeliveryStatsToday(userId) {
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);
    const totalEvents = await client_1.prisma.event.count({
        where: {
            userId,
            createdAt: { gte: startOfToday }
        }
    });
    const deliveryGroups = await client_1.prisma.deliveryLog.groupBy({
        by: ['status'],
        where: {
            webhook: { userId },
            deliveredAt: { gte: startOfToday }
        },
        _count: { id: true }
    });
    const successCount = deliveryGroups.find((g) => g.status === 'SUCCESS')?._count.id ?? 0;
    const failedCount = (deliveryGroups.find((g) => g.status === 'FAILED')?._count.id ?? 0) +
        (deliveryGroups.find((g) => g.status === 'DEAD')?._count.id ?? 0);
    return { totalEvents, successCount, failedCount };
}
async function getRecentLogs(userId) {
    const logs = await client_1.prisma.deliveryLog.findMany({
        where: {
            webhook: { userId }
        },
        orderBy: { deliveredAt: 'desc' },
        take: 10,
        select: {
            id: true,
            status: true,
            attemptNumber: true,
            responseCode: true,
            errorMessage: true,
            deliveredAt: true,
            webhook: {
                select: {
                    targetUrl: true
                }
            },
            event: {
                select: {
                    eventType: true
                }
            }
        }
    });
    return logs;
}
async function getTopFailingWebhooks(userId) {
    const failureCounts = await client_1.prisma.deliveryLog.groupBy({
        by: ['webhookId'],
        where: {
            webhook: { userId },
            status: { in: ['FAILED', 'DEAD'] }
        },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5
    });
    if (failureCounts.length === 0)
        return [];
    const webhookIds = failureCounts.map((f) => f.webhookId);
    const webhooks = await client_1.prisma.webhook.findMany({
        where: { id: { in: webhookIds } },
        select: { id: true, targetUrl: true, isActive: true }
    });
    return failureCounts.map((f) => {
        const webhook = webhooks.find((w) => w.id === f.webhookId);
        return {
            webhookId: f.webhookId,
            targetUrl: webhook?.targetUrl ?? 'Unknown',
            isActive: webhook?.isActive ?? false,
            failureCount: f._count.id
        };
    });
}
async function getHourlyTrend(userId) {
    const since24HoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const logs = await client_1.prisma.deliveryLog.findMany({
        where: {
            webhook: { userId },
            deliveredAt: { gte: since24HoursAgo }
        },
        select: {
            status: true,
            deliveredAt: true
        }
    });
    const buckets = {};
    for (const log of logs) {
        if (!log.deliveredAt)
            continue;
        const d = log.deliveredAt;
        const key = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}`;
        if (!buckets[key]) {
            buckets[key] = { success: 0, failed: 0 };
        }
        if (log.status === 'SUCCESS') {
            buckets[key].success++;
        }
        else {
            buckets[key].failed++;
        }
    }
    return Object.entries(buckets)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([hour, counts]) => ({ hour, ...counts }));
}
function pad(n) {
    return String(n).padStart(2, '0');
}

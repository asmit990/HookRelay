"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllLogs = getAllLogs;
exports.getLogsForWebhook = getLogsForWebhook;
const client_1 = require("../config/db/client");
async function getAllLogs(req, res) {
    try {
        const userId = req.userId;
        const status = req.query.status;
        // Pagination
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const where = {
            webhook: { userId },
            ...(status && { status })
        };
        const [total, logs] = await Promise.all([
            client_1.prisma.deliveryLog.count({ where }),
            client_1.prisma.deliveryLog.findMany({
                where,
                orderBy: { deliveredAt: 'desc' },
                skip,
                take: limit,
                select: {
                    id: true,
                    status: true,
                    attemptNumber: true,
                    responseCode: true,
                    errorMessage: true,
                    deliveredAt: true,
                    // Include related info so the UI can display it nicely
                    webhook: {
                        select: { id: true, targetUrl: true }
                    },
                    event: {
                        select: { id: true, eventType: true }
                    }
                }
            })
        ]);
        return res.status(200).json({
            success: true,
            data: logs,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    }
    catch (error) {
        console.error('[getAllLogs] error:', error);
        return res.status(500).json({
            success: false,
            error: 'SERVER_ERROR',
            message: 'Something went wrong'
        });
    }
}
// ─────────────────────────────────────────────
// GET /api/logs/:webhook_id
// All delivery logs for ONE specific webhook
// Useful for debugging a specific failing webhook
// ─────────────────────────────────────────────
async function getLogsForWebhook(req, res) {
    try {
        const webhook_id = req.params.webhook_id;
        const userId = req.userId;
        // First verify: does this webhook belong to this user?
        const webhook = await client_1.prisma.webhook.findFirst({
            where: { id: webhook_id, userId }
        });
        if (!webhook) {
            return res.status(404).json({
                success: false,
                error: 'WEBHOOK_NOT_FOUND',
                message: 'Webhook not found or does not belong to you'
            });
        }
        // Pagination
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const [total, logs] = await Promise.all([
            client_1.prisma.deliveryLog.count({
                where: { webhookId: webhook_id }
            }),
            client_1.prisma.deliveryLog.findMany({
                where: { webhookId: webhook_id },
                orderBy: { deliveredAt: 'desc' },
                skip,
                take: limit,
                select: {
                    id: true,
                    status: true,
                    attemptNumber: true,
                    responseCode: true,
                    errorMessage: true,
                    deliveredAt: true,
                    event: {
                        select: { id: true, eventType: true, payload: true }
                    }
                }
            })
        ]);
        return res.status(200).json({
            success: true,
            data: {
                webhook: {
                    id: webhook.id,
                    targetUrl: webhook.targetUrl,
                    isActive: webhook.isActive,
                    eventTypes: webhook.eventTypes
                },
                logs
            },
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    }
    catch (error) {
        console.error('[getLogsForWebhook] error:', error);
        return res.status(500).json({
            success: false,
            error: 'SERVER_ERROR',
            message: 'Something went wrong'
        });
    }
}

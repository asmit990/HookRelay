"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWebhook = createWebhook;
exports.listWebhooks = listWebhooks;
exports.updateWebhook = updateWebhook;
exports.deleteWebhook = deleteWebhook;
exports.toggleWebhook = toggleWebhook;
const client_1 = require("../config/db/client");
// ─────────────────────────────────────────────
async function createWebhook(req, res) {
    try {
        const { targetUrl, eventTypes } = req.body;
        const userId = req.userId; // set by auth middleware
        if (!targetUrl || !eventTypes || !Array.isArray(eventTypes) || eventTypes.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'MISSING_FIELDS',
                message: 'targetUrl and eventTypes (array) are required'
            });
        }
        try {
            new URL(targetUrl);
        }
        catch {
            return res.status(400).json({
                success: false,
                error: 'INVALID_URL',
                message: 'targetUrl must be a valid URL (e.g. https://yoursite.com/hooks)'
            });
        }
        const webhook = await client_1.prisma.webhook.create({
            data: {
                userId,
                targetUrl,
                eventTypes,
                isActive: true
            }
        });
        return res.status(201).json({
            success: true,
            message: 'Webhook registered successfully',
            data: webhook
        });
    }
    catch (error) {
        console.error('[createWebhook] error:', error);
        return res.status(500).json({
            success: false,
            error: 'SERVER_ERROR',
            message: 'Something went wrong'
        });
    }
}
// ─────────────────────────────────────────────
// GET /api/webhooks
// List all webhooks belonging to this user
// ─────────────────────────────────────────────
async function listWebhooks(req, res) {
    try {
        const userId = req.userId;
        const webhooks = await client_1.prisma.webhook.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: { deliveryLogs: true }
                }
            }
        });
        return res.status(200).json({
            success: true,
            data: webhooks
        });
    }
    catch (error) {
        console.error('[listWebhooks] error:', error);
        return res.status(500).json({
            success: false,
            error: 'SERVER_ERROR',
            message: 'Something went wrong'
        });
    }
}
// ─────────────────────────────────────────────
// PATCH /api/webhooks/:id
// Update a webhook's URL or event types
// ─────────────────────────────────────────────
async function updateWebhook(req, res) {
    try {
        const id = req.params.id;
        const { targetUrl, eventTypes } = req.body;
        const userId = req.userId;
        const existing = await client_1.prisma.webhook.findFirst({
            where: { id, userId }
        });
        if (!existing) {
            return res.status(404).json({
                success: false,
                error: 'WEBHOOK_NOT_FOUND',
                message: 'Webhook not found or does not belong to you'
            });
        }
        const updated = await client_1.prisma.webhook.update({
            where: { id },
            data: {
                ...(targetUrl && { targetUrl }),
                ...(eventTypes && { eventTypes })
            }
        });
        return res.status(200).json({
            success: true,
            message: 'Webhook updated successfully',
            data: updated
        });
    }
    catch (error) {
        console.error('[updateWebhook] error:', error);
        return res.status(500).json({
            success: false,
            error: 'SERVER_ERROR',
            message: 'Something went wrong'
        });
    }
}
// ─────────────────────────────────────────────
// DELETE /api/webhooks/:id
// Permanently delete a webhook
// ─────────────────────────────────────────────
async function deleteWebhook(req, res) {
    try {
        const id = req.params.id;
        const userId = req.userId;
        const existing = await client_1.prisma.webhook.findFirst({
            where: { id, userId }
        });
        if (!existing) {
            return res.status(404).json({
                success: false,
                error: 'WEBHOOK_NOT_FOUND',
                message: 'Webhook not found or does not belong to you'
            });
        }
        await client_1.prisma.webhook.delete({ where: { id } });
        return res.status(200).json({
            success: true,
            message: 'Webhook deleted successfully'
        });
    }
    catch (error) {
        console.error('[deleteWebhook] error:', error);
        return res.status(500).json({
            success: false,
            error: 'SERVER_ERROR',
            message: 'Something went wrong'
        });
    }
}
// ─────────────────────────────────────────────
// PATCH /api/webhooks/:id/toggle
// Enable or disable a webhook without deleting it
// Active → Inactive, or Inactive → Active
// ─────────────────────────────────────────────
async function toggleWebhook(req, res) {
    try {
        const id = req.params.id;
        const userId = req.userId;
        const existing = await client_1.prisma.webhook.findFirst({
            where: { id, userId }
        });
        if (!existing) {
            return res.status(404).json({
                success: false,
                error: 'WEBHOOK_NOT_FOUND',
                message: 'Webhook not found or does not belong to you'
            });
        }
        const updated = await client_1.prisma.webhook.update({
            where: { id },
            data: { isActive: !existing.isActive }
        });
        return res.status(200).json({
            success: true,
            message: `Webhook ${updated.isActive ? 'enabled' : 'disabled'} successfully`,
            data: { id: updated.id, isActive: updated.isActive }
        });
    }
    catch (error) {
        console.error('[toggleWebhook] error:', error);
        return res.status(500).json({
            success: false,
            error: 'SERVER_ERROR',
            message: 'Something went wrong'
        });
    }
}

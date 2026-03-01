import { Request, Response } from 'express';
import { prisma } from '../config/db/client';

export async function createWebhook(req: Request, res: Response) {
  try {
    const { targetUrl, eventTypes } = req.body;
    const userId = req.userId; 

    if (!targetUrl || !eventTypes || !Array.isArray(eventTypes) || eventTypes.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_FIELDS',
        message: 'targetUrl and eventTypes (array) are required'
      });
    }

    try {
      new URL(targetUrl);
    } catch {
      return res.status(400).json({
        success: false,
        error: 'INVALID_URL',
        message: 'targetUrl must be a valid URL (e.g. https://yoursite.com/hooks)'
      });
    }

    const webhook = await prisma.webhook.create({
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

  } catch (error) {
    console.error('[createWebhook] error:', error);
    return res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Something went wrong'
    });
  }
}

export async function listWebhooks(req: Request, res: Response) {
  try {
    const userId = req.userId;

    const webhooks = await prisma.webhook.findMany({
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

  } catch (error) {
    console.error('[listWebhooks] error:', error);
    return res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Something went wrong'
    });
  }
}

export async function updateWebhook(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const { targetUrl, eventTypes } = req.body;
    const userId = req.userId;

    const existing = await prisma.webhook.findFirst({
      where: { id, userId }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'WEBHOOK_NOT_FOUND',
        message: 'Webhook not found or does not belong to you'
      });
    }

    const updated = await prisma.webhook.update({
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

  } catch (error) {
    console.error('[updateWebhook] error:', error);
    return res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Something went wrong'
    });
  }
}

export async function deleteWebhook(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const userId = req.userId;

    const existing = await prisma.webhook.findFirst({
      where: { id, userId }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'WEBHOOK_NOT_FOUND',
        message: 'Webhook not found or does not belong to you'
      });
    }

    await prisma.webhook.delete({ where: { id } });

    return res.status(200).json({
      success: true,
      message: 'Webhook deleted successfully'
    });

  } catch (error) {
    console.error('[deleteWebhook] error:', error);
    return res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Something went wrong'
    });
  }
}

export async function toggleWebhook(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const userId = req.userId;

    const existing = await prisma.webhook.findFirst({
      where: { id, userId }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'WEBHOOK_NOT_FOUND',
        message: 'Webhook not found or does not belong to you'
      });
    }

    const updated = await prisma.webhook.update({
      where: { id },
      data: { isActive: !existing.isActive }
    });

    return res.status(200).json({
      success: true,
      message: `Webhook ${updated.isActive ? 'enabled' : 'disabled'} successfully`,
      data: { id: updated.id, isActive: updated.isActive }
    });

  } catch (error) {
    console.error('[toggleWebhook] error:', error);
    return res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Something went wrong'
    });
  }
}

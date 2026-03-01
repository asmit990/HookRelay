import { Request, Response } from 'express';
import { prisma } from '../config/db/client';

export async function getAllLogs(req: Request, res: Response) {
  try {
    const userId = req.userId;

    const status = req.query.status as any;

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const where = {
      webhook: { userId },
      ...(status && { status })
    };

    const [total, logs] = await Promise.all([
      prisma.deliveryLog.count({ where }),
      prisma.deliveryLog.findMany({
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

  } catch (error) {
    console.error('[getAllLogs] error:', error);
    return res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Something went wrong'
    });
  }
}

export async function getLogsForWebhook(req: Request, res: Response) {
  try {
    const webhook_id = req.params.webhook_id as string;
    const userId = req.userId;

    const webhook = await prisma.webhook.findFirst({
      where: { id: webhook_id, userId }
    });

    if (!webhook) {
      return res.status(404).json({
        success: false,
        error: 'WEBHOOK_NOT_FOUND',
        message: 'Webhook not found or does not belong to you'
      });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [total, logs] = await Promise.all([
      prisma.deliveryLog.count({
        where: { webhookId: webhook_id }
      }),
      prisma.deliveryLog.findMany({
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

  } catch (error) {
    console.error('[getLogsForWebhook] error:', error);
    return res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Something went wrong'
    });
  }
}

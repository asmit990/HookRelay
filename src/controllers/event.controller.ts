import { Request, Response } from 'express';
import { getDashboardStats } from '../services/dashboard.service';

export async function getDashboard(req: Request, res: Response) {
  try {
    const userId = req.userId;

    const stats = await getDashboardStats(userId);

    return res.status(200).json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('[getDashboard] error:', error);
    return res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Something went wrong'
    });
  }
}

export async function triggerEvent(req: Request, res: Response) {
  res.status(200).json({ success: true, message: "Event triggered" });
}

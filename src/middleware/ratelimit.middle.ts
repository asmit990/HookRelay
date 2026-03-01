import { Request, Response, NextFunction } from 'express';
import { redis as redisClient } from '../config/redis/redis';

const WINDOW_SECONDS = 60;
const MAX_REQUESTS = 100;

export async function rateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {

    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {

      return next();
    }

    const currentMinute = new Date().toISOString().slice(0, 16);
    const redisKey = `ratelimit:${apiKey}:${currentMinute}`;

    const currentCount = await redisClient.incr(redisKey);

    if (currentCount === 1) {
      await redisClient.expire(redisKey, WINDOW_SECONDS);
    }

    res.setHeader('X-RateLimit-Limit', MAX_REQUESTS);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, MAX_REQUESTS - currentCount));
    res.setHeader('X-RateLimit-Reset', WINDOW_SECONDS); 

    if (currentCount > MAX_REQUESTS) {
      return res.status(429).json({
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
        message: `Too many requests. You are limited to ${MAX_REQUESTS} requests per minute.`,
        retryAfter: `${WINDOW_SECONDS} seconds`
      });
    }

    next();

  } catch (error) {

    console.error('[rateLimitMiddleware] Redis error:', error);
    next();
  }
}

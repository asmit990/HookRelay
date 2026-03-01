"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimitMiddleware = rateLimitMiddleware;
const redis_1 = require("../config/redis/redis");
const WINDOW_SECONDS = 60;
const MAX_REQUESTS = 100;
async function rateLimitMiddleware(req, res, next) {
    try {
        const apiKey = req.headers['x-api-key'];
        if (!apiKey) {
            return next();
        }
        const currentMinute = new Date().toISOString().slice(0, 16);
        const redisKey = `ratelimit:${apiKey}:${currentMinute}`;
        const currentCount = await redis_1.redis.incr(redisKey);
        if (currentCount === 1) {
            await redis_1.redis.expire(redisKey, WINDOW_SECONDS);
        }
        res.setHeader('X-RateLimit-Limit', MAX_REQUESTS);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, MAX_REQUESTS - currentCount));
        res.setHeader('X-RateLimit-Reset', WINDOW_SECONDS); // seconds until reset
        if (currentCount > MAX_REQUESTS) {
            return res.status(429).json({
                success: false,
                error: 'RATE_LIMIT_EXCEEDED',
                message: `Too many requests. You are limited to ${MAX_REQUESTS} requests per minute.`,
                retryAfter: `${WINDOW_SECONDS} seconds`
            });
        }
        next();
    }
    catch (error) {
        // If Redis is down, don't block all traffic
        // Log the error but let the request through (fail open)
        console.error('[rateLimitMiddleware] Redis error:', error);
        next();
    }
}

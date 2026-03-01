"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
exports.apiKeyMiddleware = apiKeyMiddleware;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("../config/db/client");
const JWT_SECRET = process.env.JWT_SECRET;
async function authMiddleware(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'MISSING_TOKEN',
                message: 'Authorization header is required. Format: Bearer <token>'
            });
        }
        const token = authHeader.split(' ')[1];
        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'MISSING_TOKEN',
                message: 'Token is missing from Authorization header'
            });
        }
        let decoded;
        try {
            decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        }
        catch (jwtError) {
            const isExpired = jwtError.name === 'TokenExpiredError';
            return res.status(401).json({
                success: false,
                error: isExpired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
                message: isExpired
                    ? 'Your session has expired. Please log in again.'
                    : 'Invalid token. Please log in again.'
            });
        }
        const user = await client_1.prisma.user.findUnique({
            where: { id: decoded.userId },
            select: { id: true } // we only need id — no need to fetch everything
        });
        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'USER_NOT_FOUND',
                message: 'User no longer exists. Please register again.'
            });
        }
        req.userId = user.id;
        next();
    }
    catch (error) {
        console.error('[authMiddleware] error:', error);
        return res.status(500).json({
            success: false,
            error: 'SERVER_ERROR',
            message: 'Something went wrong during authentication'
        });
    }
}
async function apiKeyMiddleware(req, res, next) {
    try {
        const apiKey = req.headers['x-api-key'];
        if (!apiKey) {
            return res.status(401).json({
                success: false,
                error: 'MISSING_API_KEY',
                message: 'x-api-key header is required to trigger events'
            });
        }
        const user = await client_1.prisma.user.findUnique({
            where: { apiKey },
            select: { id: true }
        });
        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'INVALID_API_KEY',
                message: 'API key is invalid. Check your HookRelay dashboard.'
            });
        }
        req.userId = user.id;
        next();
    }
    catch (error) {
        console.error('[apiKeyMiddleware] error:', error);
        return res.status(500).json({
            success: false,
            error: 'SERVER_ERROR',
            message: 'Something went wrong during authentication'
        });
    }
}

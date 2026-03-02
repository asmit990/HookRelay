"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../src/app"));
const client_1 = require("../src/config/db/client");
const redis_1 = require("../src/config/redis/redis");
const crypto_1 = __importDefault(require("crypto"));
describe('Auth and Webhook API Endpoints', () => {
    const testEmail = `test_${crypto_1.default.randomBytes(4).toString('hex')}@example.com`;
    const testPassword = 'password123';
    let token = '';
    afterAll(async () => {
        // Cleanup generated user
        await client_1.prisma.user.deleteMany({
            where: { email: testEmail }
        });
        // Disconnect prisma and redis to prevent open handles
        await client_1.prisma.$disconnect();
        await redis_1.redis.quit();
    });
    describe('Authentication', () => {
        it('should register a new user', async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .post('/api/auth/register')
                .send({
                email: testEmail,
                password: testPassword,
            });
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.token).toBeDefined();
            expect(res.body.data.user.email).toBe(testEmail);
        });
        it('should not register the same user twice', async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .post('/api/auth/register')
                .send({
                email: testEmail,
                password: testPassword,
            });
            expect(res.status).toBe(409);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('USER_EXISTS');
        });
        it('should login the existing user', async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .post('/api/auth/login')
                .send({
                email: testEmail,
                password: testPassword,
            });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.token).toBeDefined();
            // Store token for protected routes
            token = res.body.data.token;
        });
        it('should fetch the current user profile (me)', async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.email).toBe(testEmail);
        });
    });
    describe('Webhooks', () => {
        let webhookId = '';
        it('should return empty webhooks list initially', async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .get('/api/webhooks')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toEqual([]);
        });
        it('should create a new webhook', async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .post('/api/webhooks')
                .set('Authorization', `Bearer ${token}`)
                .send({
                targetUrl: 'https://example.com/hook',
                eventTypes: ['test.event']
            });
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.targetUrl).toBe('https://example.com/hook');
            expect(res.body.data.id).toBeDefined();
            webhookId = res.body.data.id;
        });
        it('should toggle webhook active status', async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .patch(`/api/webhooks/${webhookId}/toggle`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.isActive).toBe(false);
        });
        it('should delete the webhook', async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .delete(`/api/webhooks/${webhookId}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });
});

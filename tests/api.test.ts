import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/db/client';
import { redis } from '../src/config/redis/redis';
import crypto from 'crypto';

describe('Auth and Webhook API Endpoints', () => {
    const testEmail = `test_${crypto.randomBytes(4).toString('hex')}@example.com`;
    const testPassword = 'password123';
    let token = '';

    afterAll(async () => {
        // Cleanup generated user
        await prisma.user.deleteMany({
            where: { email: testEmail }
        });
        // Disconnect prisma and redis to prevent open handles
        await prisma.$disconnect();
        await redis.quit();
    });

    describe('Authentication', () => {
        it('should register a new user', async () => {
            const res = await request(app)
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
            const res = await request(app)
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
            const res = await request(app)
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
            const res = await request(app)
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
            const res = await request(app)
                .get('/api/webhooks')
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toEqual([]);
        });

        it('should create a new webhook', async () => {
            const res = await request(app)
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
            const res = await request(app)
                .patch(`/api/webhooks/${webhookId}/toggle`)
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.isActive).toBe(false);
        });

        it('should delete the webhook', async () => {
            const res = await request(app)
                .delete(`/api/webhooks/${webhookId}`)
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });
});

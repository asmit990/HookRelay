"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bullmq_1 = require("bullmq"); // fix 1: named import
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
const redis_1 = require("../config/redis/redis");
const client_1 = require("../config/db/client"); // fix: use relative path, not 'src/'
const worker = new bullmq_1.Worker('webhook:delivery', async (job) => {
    const { webhookId, eventId, targetUrl, payload, secretKey, eventType } = job.data;
    const attemptNumber = job.attemptsMade + 1; // fix 2: attemptsMade not attemptMade
    const payloadString = JSON.stringify(payload);
    const signature = crypto_1.default
        .createHmac('sha256', secretKey)
        .update(payloadString)
        .digest('hex');
    try {
        const response = await axios_1.default.post(targetUrl, payload, {
            timeout: 5000,
            headers: {
                'Content-Type': 'application/json',
                'X-HookRelay-Signature': `sha256=${signature}`,
                'X-HookRelay-Event': eventType,
                'X-HookRelay-Delivery-Id': job.id
            }
        });
        // fix 3: log SUCCESS to delivery_logs, not create a webhook
        await client_1.prisma.deliveryLog.create({
            data: {
                webhookId,
                eventId,
                status: 'SUCCESS',
                attemptNumber,
                responseCode: response.status,
                deliveredAt: new Date()
            }
        });
        console.log(`✅ Delivered to ${targetUrl} — Status: ${response.status}`);
    }
    catch (error) { // fix 4: catch block added
        const responseCode = error.response?.status ?? null;
        const isLastAttempt = attemptNumber >= 5;
        // log FAILURE to delivery_logs
        await client_1.prisma.deliveryLog.create({
            data: {
                webhookId,
                eventId,
                status: isLastAttempt ? 'DEAD' : 'FAILED',
                attemptNumber,
                responseCode,
                errorMessage: error.message,
                deliveredAt: new Date()
            }
        });
        console.log(` Attempt ${attemptNumber} failed for ${targetUrl}: ${error.message}`);
        throw error; // CRITICAL: throw so BullMQ knows to retry
    }
}, { connection: redis_1.redis } // fix 5: pass redis connection
);
worker.on('completed', (job) => console.log(` Job ${job.id} done`));
worker.on('failed', (job, err) => console.log(` Job ${job?.id} failed: ${err.message}`));
exports.default = worker;

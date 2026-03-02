"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const bullmq_1 = require("bullmq");
const redis_1 = require("./src/config/redis/redis");
const client_1 = require("./src/config/db/client");
const delivery_service_1 = require("./src/services/delivery.service");
async function startWorker() {
    try {
        await client_1.prisma.$connect();
        console.log(' PostgreSQL connected');
        await redis_1.redis.ping();
        console.log('Redis connected');
        const worker = new bullmq_1.Worker('webhook:delivery', async (job) => {
            console.log(`  Processing job ${job.id} | attempt ${job.attemptsMade + 1}`);
            await (0, delivery_service_1.deliverWebhook)({
                ...job.data,
                jobId: job.id,
                attemptNumber: job.attemptsMade + 1
            });
        }, {
            connection: redis_1.redis,
            concurrency: 10,
        });
        worker.on('completed', (job) => {
            console.log(` Job ${job.id} completed successfully`);
        });
        worker.on('failed', (job, error) => {
            console.log(` Job ${job?.id} failed (attempt ${job?.attemptsMade}): ${error.message}`);
        });
        worker.on('error', (error) => {
            console.error(' Worker error:', error);
        });
        console.log('');
        console.log(' HookRelay Worker is running');
        console.log(' Listening on queue: webhook:delivery');
        console.log(' Concurrency: 10 jobs at a time');
        console.log('');
        // STEP 4: Graceful shutdown
        // When worker process is killed, finish current jobs before stopping
        process.on('SIGINT', async () => {
            console.log('\n Shutting down worker...');
            await worker.close();
            await client_1.prisma.$disconnect();
            await redis_1.redis.quit();
            console.log(' Worker shut down cleanly.');
            process.exit(0);
        });
        process.on('SIGTERM', async () => {
            console.log('\n SIGTERM received. Shutting down worker...');
            await worker.close();
            await client_1.prisma.$disconnect();
            await redis_1.redis.quit();
            process.exit(0);
        });
    }
    catch (error) {
        console.error(' Failed to start worker:', error);
        process.exit(1);
    }
}
startWorker();

import 'dotenv/config';
import { Worker } from 'bullmq';
import { redis as redisClient } from './src/config/redis/redis';
import { prisma } from './src/config/db/client';
import { deliverWebhook } from './src/services/delivery.service';

async function startWorker() {
    try {

        await prisma.$connect();
        console.log('✅ PostgreSQL connected');

        await redisClient.ping();
        console.log('✅ Redis connected');

        const worker = new Worker(
            'webhook:delivery',

            async (job) => {
                console.log(`⚙️  Processing job ${job.id} | attempt ${job.attemptsMade + 1}`);

                await deliverWebhook({
                    ...job.data,
                    jobId: job.id as string,
                    attemptNumber: job.attemptsMade + 1
                });
            },

            {
                connection: redisClient,
                concurrency: 10,  

            }
        );

        worker.on('completed', (job) => {
            console.log(`✅ Job ${job.id} completed successfully`);
        });

        worker.on('failed', (job, error) => {

            console.log(`❌ Job ${job?.id} failed (attempt ${job?.attemptsMade}): ${error.message}`);
        });

        worker.on('error', (error) => {

            console.error('🔥 Worker error:', error);
        });

        console.log('');
        console.log('⚡ HookRelay Worker is running');
        console.log('👂 Listening on queue: webhook:delivery');
        console.log('🔄 Concurrency: 10 jobs at a time');
        console.log('');

        // STEP 4: Graceful shutdown
        // When worker process is killed, finish current jobs before stopping
        process.on('SIGINT', async () => {
            console.log('\n🛑 Shutting down worker...');
            await worker.close();         
            await prisma.$disconnect();
            await redisClient.quit();
            console.log('✅ Worker shut down cleanly.');
            process.exit(0);
        });

        process.on('SIGTERM', async () => {
            console.log('\n🛑 SIGTERM received. Shutting down worker...');
            await worker.close();
            await prisma.$disconnect();
            await redisClient.quit();
            process.exit(0);
        });

    } catch (error) {
        console.error('❌ Failed to start worker:', error);
        process.exit(1);
    }
}

startWorker();

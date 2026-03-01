import 'dotenv/config';
import app from './src/app';
import { prisma } from './src/config/db/client';
import { redis as redisClient } from './src/config/redis/redis';

const PORT = process.env.PORT || 3000;

async function startServer() {
    try {

        await prisma.$connect();
        console.log('✅ PostgreSQL connected');

        await redisClient.ping();
        console.log('✅ Redis connected');

        app.listen(PORT, () => {
            console.log('');
            console.log(' HookRelay API Server is running');
            console.log(` URL:          http://localhost:${PORT}`);
            console.log(`  Health:       http://localhost:${PORT}/health`);
            console.log(` Environment:  ${process.env.NODE_ENV || 'development'}`);
            console.log('');
        });

    } catch (error) {
        console.error(' Failed to start server:', error);
        process.exit(1);
    }
}

process.on('SIGINT', async () => {
    console.log('\n Shutting down server...');
    await prisma.$disconnect();
    await redisClient.quit();
    console.log(' Connections closed. Goodbye.');
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n SIGTERM received. Shutting down...');
    await prisma.$disconnect();
    await redisClient.quit();
    process.exit(0);
});

startServer();

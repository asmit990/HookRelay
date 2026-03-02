"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const app_1 = __importDefault(require("./src/app"));
const client_1 = require("./src/config/db/client");
const redis_1 = require("./src/config/redis/redis");
const PORT = process.env.PORT || 3000;
async function startServer() {
    try {
        await client_1.prisma.$connect();
        console.log(' PostgreSQL connected');
        await redis_1.redis.ping();
        console.log('Redis connected');
        app_1.default.listen(PORT, () => {
            console.log('');
            console.log(' HookRelay API Server is running');
            console.log(` URL:          http://localhost:${PORT}`);
            console.log(`  Health:       http://localhost:${PORT}/health`);
            console.log(` Environment:  ${process.env.NODE_ENV || 'development'}`);
            console.log('');
        });
    }
    catch (error) {
        console.error(' Failed to start server:', error);
        process.exit(1);
    }
}
process.on('SIGINT', async () => {
    console.log('\n Shutting down server...');
    await client_1.prisma.$disconnect();
    await redis_1.redis.quit();
    console.log(' Connections closed. Goodbye.');
    process.exit(0);
});
process.on('SIGTERM', async () => {
    console.log('\n SIGTERM received. Shutting down...');
    await client_1.prisma.$disconnect();
    await redis_1.redis.quit();
    process.exit(0);
});
startServer();

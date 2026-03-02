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
// Increase Jest timeout for the stress test (1 hour)
jest.setTimeout(3600000);
describe('50k User Stress Test', () => {
    const TOTAL_USERS = 50000;
    const BATCH_SIZE = 100; // Send requests in chunks of 100 to avoid Node.js network exhaustion
    afterAll(async () => {
        console.log('Cleaning up stress test users...');
        await client_1.prisma.user.deleteMany({
            where: { email: { contains: 'stress_test_' } }
        });
        // Disconnect prisma and redis
        await client_1.prisma.$disconnect();
        await redis_1.redis.quit();
        console.log('Cleanup complete.');
    });
    it(`should successfully register ${TOTAL_USERS} users under load`, async () => {
        let successCount = 0;
        let failCount = 0;
        console.log(`Starting stress test for ${TOTAL_USERS} users...`);
        const startTime = Date.now();
        for (let i = 0; i < TOTAL_USERS; i += BATCH_SIZE) {
            const batchPromises = [];
            const currentBatchSize = Math.min(BATCH_SIZE, TOTAL_USERS - i);
            for (let j = 0; j < currentBatchSize; j++) {
                const testEmail = `stress_test_${crypto_1.default.randomBytes(6).toString('hex')}@example.com`;
                const testPassword = 'stresspassword123';
                batchPromises.push((0, supertest_1.default)(app_1.default)
                    .post('/api/auth/register')
                    .send({ email: testEmail, password: testPassword }));
            }
            // Wait for the current batch to finish before sending the next
            const results = await Promise.all(batchPromises);
            for (const res of results) {
                if (res.status === 201) {
                    successCount++;
                }
                else {
                    failCount++;
                    console.error(`Failed to register user. Status: ${res.status}, Error: ${res.body?.error}`);
                }
            }
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
            console.log(`Batch ${i / BATCH_SIZE + 1} complete. Registered: ${successCount}. Failed: ${failCount}. Elapsed: ${elapsed}s`);
        }
        const totalSeconds = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`Stress test finished in ${totalSeconds} seconds.`);
        console.log(`Total Success: ${successCount}`);
        console.log(`Total Failed: ${failCount}`);
        expect(successCount).toBe(TOTAL_USERS);
        expect(failCount).toBe(0);
    });
});

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deliveryQueue = void 0;
exports.addDeliveryJob = addDeliveryJob;
const bullmq_1 = require("bullmq");
const redis_1 = require("../config/redis/redis");
exports.deliveryQueue = new bullmq_1.Queue('webhook-delivery', {
    connection: redis_1.redis
});
async function addDeliveryJob(data) {
    await exports.deliveryQueue.add('deliver', data, {
        attempts: 5,
        backoff: {
            type: 'exponential',
            delay: 3000
        },
        removeOnComplete: 100,
        removeOnFail: 200
    });
}

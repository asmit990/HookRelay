import { Queue } from 'bullmq'
import { redis } from '../config/redis/redis'

export const deliveryQueue = new Queue('webhook-delivery', {
  connection: redis
})

export async function addDeliveryJob(data: any) {
  await deliveryQueue.add('deliver', data, {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 3000
    },
    removeOnComplete: 100,
    removeOnFail: 200
  })
}

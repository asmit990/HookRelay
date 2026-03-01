import { Worker } from 'bullmq';                  
import axios from 'axios';
import crypto from 'crypto';
import {redis} from '../config/redis/redis';
import { prisma } from '../config/db/client';     

const worker = new Worker(
  'webhook:delivery',

  async (job: any) => {
    const { webhookId, eventId, targetUrl, payload, secretKey, eventType } = job.data;

    const attemptNumber = job.attemptsMade + 1;   

    const payloadString = JSON.stringify(payload);

    const signature = crypto
      .createHmac('sha256', secretKey)
      .update(payloadString)
      .digest('hex');

    try {
      const response = await axios.post(targetUrl, payload, {
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json',
          'X-HookRelay-Signature': `sha256=${signature}`,
          'X-HookRelay-Event': eventType,
          'X-HookRelay-Delivery-Id': job.id
        }
      });

      await prisma.deliveryLog.create({
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

    } catch (error: any) {                         
      const responseCode = error.response?.status ?? null;
      const isLastAttempt = attemptNumber >= 5;

      await prisma.deliveryLog.create({
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

      throw error; 
    }
  },

  { connection: redis }                            
);

worker.on('completed', (job) => console.log(` Job ${job.id} done`));
worker.on('failed', (job, err) => console.log(` Job ${job?.id} failed: ${err.message}`));

export default worker;

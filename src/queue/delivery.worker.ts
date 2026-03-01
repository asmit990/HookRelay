import  Worker from  'bullmq';
import axios from  'axios';
import  crypto from 'crypto';    // built-in Node.js, no install needed
import redis from '../config/redis/redis';
import { createWebhook, createEvent} from '../config/db/index'
import { prisma } from 'src/config/db/client';


const worker = new Worker(
    'webhook:delivery',


    async (job: any) => {
        const { webhookId, eventId, targetUrl, payload, secretKey, eventType}  = job.data

        const attemptNumber = job.attemptMade + 1;


        const payloadString = JSON.stringify(payload)

        const signature = crypto
                 .createHmac('sha256', secretKey)
                 .update(payloadString)
                 .digest('hex')

    try {
      // STEP 2: Send the HTTP POST to the receiver's URL
      const response = await axios.post(targetUrl, payload, {
        timeout: 5000,   // give up after 5 seconds
        headers: {
          'Content-Type': 'application/json',
          'X-HookRelay-Signature': `sha256=${signature}`,
          'X-HookRelay-Event': eventType,
          'X-HookRelay-Delivery-Id': job.id
        }
      });

      await prisma.createWebhook(webhookId, eventId, targetUrl, payload, secretKey)

      console.log(`delivery to ${targetUrl} - status: ${response.status}`)

    }
)
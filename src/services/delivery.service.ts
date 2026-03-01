import axios from 'axios';
import { generateSignature } from './hmac.service';
import { prisma } from '../config/db/client';
import { STATUS_CODES } from 'node:http';

interface DeliveryPayload {
  webhookId: string;
  eventId: string;
  targetUrl: string;
  payload: object;
  secretKey: string;
  eventType: string;
  jobId: string;         
  attemptNumber: number; 
}

interface DeliveryResult {
  success: boolean;
  statusCode: number | null;
  errorMessage: string | null;
}

export async function deliverWebhook(data: DeliveryPayload): Promise<DeliveryResult> {
  const {
    webhookId,
    eventId,
    targetUrl,
    payload,
    secretKey,
    eventType,
    jobId,
    attemptNumber
  } = data;

  const signature = generateSignature(payload, secretKey);

  try {

    const response = await axios.post(targetUrl, payload, {
      timeout: 5000,  
      headers: {
        'Content-Type': 'application/json',
        'X-HookRelay-Signature': signature,        
        'X-HookRelay-Event': eventType,            
        'X-HookRelay-Delivery-Id': jobId,            
        'X-HookRelay-Attempt': String(attemptNumber) 
      }
    });

    await logDelivery({
      webhookId,
      eventId,
      status: 'success',
      attemptNumber,
      responseCode: response.status,
      errorMessage: null
    });

    console.log(`[Attempt ${attemptNumber}] Delivered → ${targetUrl} (${response.status})`);

    return {
      success: true,
      statusCode: response.status,
      errorMessage: null
    };

  } catch (error) {
    const axiosError = error ;

    const responseCode =  null;
    const errorMessage = buildErrorMessage(axiosError);
    const isLastAttempt = attemptNumber >= 5;

    await logDelivery({
      webhookId,
      eventId,
      status: isLastAttempt ? 'dead' : 'failed', 
      attemptNumber,
      responseCode ,
      errorMessage
    });

    console.log(` [Attempt ${attemptNumber}] Failed → ${targetUrl} | ${errorMessage}`);

    if (isLastAttempt) {
      console.log(` Webhook ${webhookId} is now DEAD after 5 failed attempts`);
    }

    throw error;
  }
}

interface LogDeliveryParams {
  webhookId: string;
  eventId: string;
  status: 'success' | 'failed' | 'dead';
  attemptNumber: number;
  responseCode: number | null;
  errorMessage: string | null;
}

async function logDelivery(params: LogDeliveryParams): Promise<void> {
  const { webhookId, eventId, status, attemptNumber, responseCode, errorMessage } = params;

  await prisma.deliveryLog.create({
    data: {
      webhookId,
      eventId,
      status:  STATUS_CODES ? "SUCCESS" : "FAILED" ,
      attemptNumber,
      responseCode,
      errorMessage,
      deliveredAt: new Date()
    }
  });
}

function buildErrorMessage(error: any): string {
  if (error.code === 'ECONNABORTED') {
    return 'Request timed out after 5 seconds';
  }

  if (error.code === 'ENOTFOUND') {
    return `DNS lookup failed — target URL is unreachable`;
  }

  if (error.code === 'ECONNREFUSED') {
    return `Connection refused — target server is not accepting connections`;
  }

  if (error.response) {

    return `Received HTTP ${error.response.status} from target URL`;
  }

  return error.message ?? 'Unknown delivery error';
}

import crypto from 'crypto';


function normalizePayload(payload: string | Buffer | object): string | Buffer {
  if (typeof payload === 'string' || Buffer.isBuffer(payload)) {
    return payload; 
  }
  return JSON.stringify(payload);   
}

export interface VerifySignatureOptions {
  toleranceInSeconds?: number;
}


export function generateSignature(
  payload: string | Buffer | object,
  secretKey: string,
  timestamp?: number
): string {
  const ts = timestamp || Math.floor(Date.now() / 1000);
  const normalizedPayload = normalizePayload(payload);

  const payloadToSign = `${ts}.${normalizedPayload}`;

  const hmac = crypto
    .createHmac('sha256', secretKey)
    .update(payloadToSign)
    .digest('hex');

  return `t=${ts},v1=${hmac}`;
}


export function verifySignature(
  payload: string | Buffer | object,
  secretKey: string,
  incomingSignature: string,
  options: VerifySignatureOptions = {}
): boolean {
  if (typeof incomingSignature !== 'string') {
    return false;
  }

  try {
    const tolerance = options.toleranceInSeconds ?? 300; 

    const parts = incomingSignature.split(',');
    const tPart = parts.find(p => p.startsWith('t='));
    const v1Part = parts.find(p => p.startsWith('v1='));

    if (!tPart || !v1Part) {
     
      if (incomingSignature.startsWith('sha256=')) {
        const legacyHash = incomingSignature.replace('sha256=', '');
        const legacyNormalized = normalizePayload(payload);
        const expectedLegacyHmac = crypto.createHmac('sha256', secretKey).update(legacyNormalized).digest('hex');

        const legacyExpectedBuffer = Buffer.from(expectedLegacyHmac, 'utf8');
        const legacyIncomingBuffer = Buffer.from(legacyHash, 'utf8');

        if (legacyExpectedBuffer.length !== legacyIncomingBuffer.length) return false;
        return crypto.timingSafeEqual(legacyExpectedBuffer, legacyIncomingBuffer);
      }
      return false; 
    }

    const timestamp = parseInt(tPart.split('=')[1], 10);
    const hashUnparsed = v1Part.split('=')[1];

    if (isNaN(timestamp) || !hashUnparsed) {
      return false;
    }

    
    const currentTimestamp = Math.floor(Date.now() / 1000);
    if (Math.abs(currentTimestamp - timestamp) > tolerance) {
      return false; 
    }

  const expectedSignatureFull = generateSignature(payload, secretKey, timestamp);

   const expectedBuffer = Buffer.from(expectedSignatureFull, 'utf8');
    const incomingBuffer = Buffer.from(incomingSignature, 'utf8');

    if (expectedBuffer.length !== incomingBuffer.length) {
      return false;
    }

   return crypto.timingSafeEqual(expectedBuffer, incomingBuffer);
  } catch (err) {
    return false;
  }
}

export function generateApiKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

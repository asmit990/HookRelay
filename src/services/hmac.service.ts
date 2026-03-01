import crypto from 'crypto';

export function generateSignature(payload: object, secretKey: string): string {
  const payloadString = JSON.stringify(payload);

  const hmac = crypto
    .createHmac('sha256', secretKey)  
    .update(payloadString)            
    .digest('hex');                   

  return `sha256=${hmac}`;
}

export function verifySignature(
  payload: object,
  secretKey: string,
  incomingSignature: string   
): boolean {
  const expectedSignature = generateSignature(payload, secretKey);

 const expectedBuffer = Buffer.from(expectedSignature);
  const incomingBuffer = Buffer.from(incomingSignature);

  if (expectedBuffer.length !== incomingBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, incomingBuffer);
}

export function generateApiKey(): string {

  return crypto.randomBytes(32).toString('hex');
}

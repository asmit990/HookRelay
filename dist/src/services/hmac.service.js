"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSignature = generateSignature;
exports.verifySignature = verifySignature;
exports.generateApiKey = generateApiKey;
const crypto_1 = __importDefault(require("crypto"));
function generateSignature(payload, secretKey) {
    const payloadString = JSON.stringify(payload);
    const hmac = crypto_1.default
        .createHmac('sha256', secretKey)
        .update(payloadString)
        .digest('hex');
    return `sha256=${hmac}`;
}
function verifySignature(payload, secretKey, incomingSignature) {
    const expectedSignature = generateSignature(payload, secretKey);
    const expectedBuffer = Buffer.from(expectedSignature);
    const incomingBuffer = Buffer.from(incomingSignature);
    if (expectedBuffer.length !== incomingBuffer.length) {
        return false;
    }
    return crypto_1.default.timingSafeEqual(expectedBuffer, incomingBuffer);
}
function generateApiKey() {
    return crypto_1.default.randomBytes(32).toString('hex');
}

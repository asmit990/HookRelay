"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deliverWebhook = deliverWebhook;
const axios_1 = __importDefault(require("axios"));
const hmac_service_1 = require("./hmac.service");
const client_1 = require("../config/db/client");
const node_http_1 = require("node:http");
async function deliverWebhook(data) {
    const { webhookId, eventId, targetUrl, payload, secretKey, eventType, jobId, attemptNumber } = data;
    const signature = (0, hmac_service_1.generateSignature)(payload, secretKey);
    try {
        const response = await axios_1.default.post(targetUrl, payload, {
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
    }
    catch (error) {
        const axiosError = error;
        const responseCode = null;
        const errorMessage = buildErrorMessage(axiosError);
        const isLastAttempt = attemptNumber >= 5;
        await logDelivery({
            webhookId,
            eventId,
            status: isLastAttempt ? 'dead' : 'failed',
            attemptNumber,
            responseCode,
            errorMessage
        });
        console.log(` [Attempt ${attemptNumber}] Failed → ${targetUrl} | ${errorMessage}`);
        if (isLastAttempt) {
            console.log(` Webhook ${webhookId} is now DEAD after 5 failed attempts`);
        }
        throw error;
    }
}
async function logDelivery(params) {
    const { webhookId, eventId, status, attemptNumber, responseCode, errorMessage } = params;
    await client_1.prisma.deliveryLog.create({
        data: {
            webhookId,
            eventId,
            status: node_http_1.STATUS_CODES ? "SUCCESS" : "FAILED",
            attemptNumber,
            responseCode,
            errorMessage,
            deliveredAt: new Date()
        }
    });
}
function buildErrorMessage(error) {
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
        // Server responded with a non-2xx status
        return `Received HTTP ${error.response.status} from target URL`;
    }
    return error.message ?? 'Unknown delivery error';
}

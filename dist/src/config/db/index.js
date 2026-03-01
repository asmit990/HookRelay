"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUser = createUser;
exports.getUser = getUser;
exports.findUserByEmail = findUserByEmail;
exports.createWebhook = createWebhook;
exports.createEvent = createEvent;
exports.createDeliveryLog = createDeliveryLog;
const client_1 = require("./client");
const bcrypt_1 = __importDefault(require("bcrypt"));
async function createUser(data) {
    return client_1.prisma.user.create({
        data
    });
}
async function getUser(email, password) {
    const user = await client_1.prisma.user.findUnique({
        where: { email }
    });
    if (!user) {
        throw new Error("Invalid email or password");
    }
    const isValid = await bcrypt_1.default.compare(password, user.passwordHash);
    if (!isValid)
        throw new Error("invalid eail or password");
    return user;
}
async function findUserByEmail(email) {
    return client_1.prisma.user.findUnique({
        where: { email }
    });
}
async function createWebhook(userId, targetUrl, eventTypes) {
    const webhook = await client_1.prisma.webhook.create({
        data: {
            targetUrl,
            eventTypes,
            userId
        }
    });
    return webhook;
}
async function createEvent(userId, eventType, payload) {
    const event = await client_1.prisma.event.create({
        data: {
            userId,
            eventType,
            payload
        }
    });
    return event;
}
async function createDeliveryLog(webhookId, eventId, status, attemptNumber, responseCode, errorMessage) {
    const deliveryLog = await client_1.prisma.deliveryLog.create({
        data: {
            webhookId,
            eventId,
            status,
            attemptNumber,
            responseCode: responseCode ?? null,
            errorMessage: errorMessage ?? null,
            deliveredAt: new Date()
        }
    });
    return deliveryLog;
}

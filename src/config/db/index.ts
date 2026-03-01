import { prisma } from "./client"
import crypto, { randomUUID } from "crypto"
import bcrypt from "bcrypt"
import { DeliveryStatus, Prisma } from "@prisma/client"

export async function createUser(
  data: Prisma.UserCreateInput
) {
  return prisma.user.create({
    data
  });
}

export async function getUser(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email }
  })

  if (!user) {
    throw new Error("Invalid email or password")
  }

  const isValid = await bcrypt.compare(password, user.passwordHash)

  if (!isValid) throw new Error("invalid eail or password")

  return user
}

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email }
  })

}

export async function createWebhook(
  userId: string,
  targetUrl: string,
  eventTypes: string[]
) {
  const webhook = await prisma.webhook.create({
    data: {
      targetUrl,
      eventTypes,
      userId
    }
  })

  return webhook
}

export async function createEvent(
  userId: string,
  eventType: string,
  payload: any
) {
  const event = await prisma.event.create({
    data: {
      userId,
      eventType,
      payload
    }
  })

  return event
}

export async function createDeliveryLog(
  webhookId: string,
  eventId: string,
  status: DeliveryStatus,
  attemptNumber: number,
  responseCode?: number,
  errorMessage?: string
) {
  const deliveryLog = await prisma.deliveryLog.create({
    data: {
      webhookId,
      eventId,
      status,
      attemptNumber,
      responseCode: responseCode ?? null,
      errorMessage: errorMessage ?? null,
      deliveredAt: new Date()
    }
  })

  return deliveryLog
}

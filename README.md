# 🪝 HookRelay

> A production-grade Webhook Delivery Infrastructure with **AI-Powered Failure Intelligence** — built with Node.js, Redis, BullMQ, PostgreSQL & Claude AI

[![Node.js](https://img.shields.io/badge/Node.js-18+-green?logo=node.js)](https://nodejs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-blue?logo=postgresql)](https://postgresql.org)
[![Redis](https://img.shields.io/badge/Redis-7+-red?logo=redis)](https://redis.io)
[![Claude AI](https://img.shields.io/badge/Claude-AI%20Powered-blueviolet?logo=anthropic)](https://anthropic.com)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

---

## 📖 What is HookRelay?

HookRelay is a **webhook delivery infrastructure service** — the same kind of system that powers Stripe, Razorpay, and GitHub's webhook notifications.

You register a URL. An event fires. HookRelay guarantees your URL gets notified — with **automatic retries**, **exponential backoff**, **HMAC signature verification**, and a full **delivery log**.

Think of it as a **reliable postman** that never gives up until the message is delivered.

---

## 🏗️ Architecture

```
┌─────────────────┐       ┌──────────────────┐       ┌─────────────────┐
│   API Server    │──────▶│   BullMQ Queue   │──────▶│  Worker Process │
│  (Express.js)   │       │   (Redis-backed) │       │  (Job Processor)│
└─────────────────┘       └──────────────────┘       └────────┬────────┘
         │                                                     │
         │                                                     ▼
         ▼                                           ┌─────────────────┐
┌─────────────────┐                                 │  Target URL     │
│   PostgreSQL    │◀────────────────────────────────│  (HTTP POST)    │
│  (Logs + Data)  │         delivery logs            └─────────────────┘
└─────────────────┘
```

**Two separate processes:**
- `server.js` — handles all incoming API requests
- `worker.js` — processes the delivery queue independently

---

## ✨ Features

- 🔐 **JWT Auth** with API key + secret key per user
- 🎯 **Webhook Registration** — register URLs with specific event type subscriptions
- ⚡ **Async Event Triggering** — fires jobs into queue, returns 200 instantly (never blocks sender)
- 🔁 **Retry with Exponential Backoff** — 3s → 9s → 27s → 81s → 243s before marking DEAD
- 💀 **Dead Letter Queue** — failed jobs stored separately for inspection
- 🔒 **HMAC-SHA256 Signature** — every delivery signed with `X-HookRelay-Signature` header
- 📋 **Delivery Logs** — full history of every attempt with status, response code, error
- 🚦 **Rate Limiting** — 100 events/min per API key (Redis-backed)
- 📊 **Dashboard API** — stats endpoint for frontend consumption
- 🧩 **Toggle Webhooks** — enable/disable without deleting
- 🤖 **AI Failure Analyst** — Claude AI reads your delivery logs and explains WHY webhooks are failing in plain English
- 🧠 **AI Payload Validator** — paste any payload and AI tells you if it's well-structured, suggests improvements
- 💬 **AI Debug Assistant** — describe your issue in plain text, get a root cause + fix suggestion instantly
- 📈 **AI Anomaly Alerts** — AI monitors your success rate and flags unusual patterns before they become outages

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 18+ |
| Framework | Express.js |
| Database | PostgreSQL |
| Queue | BullMQ |
| Cache / Queue Broker | Redis |
| Auth | JWT (access + refresh tokens) |
| HTTP Client | Axios |
| Password Hashing | bcrypt |
| Signature | HMAC-SHA256 (crypto module) |
| AI Layer | Claude API (Anthropic) |

---

## 📁 Project Structure

```
hookrelay/
├── src/
│   ├── config/
│   │   ├── db.js                  # PostgreSQL connection pool
│   │   └── redis.js               # Redis client setup
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── webhook.controller.js
│   │   ├── event.controller.js
│   │   └── log.controller.js
│   ├── middleware/
│   │   ├── auth.middleware.js      # JWT verification
│   │   └── ratelimit.middleware.js # Redis-based rate limiter
│   ├── queues/
│   │   ├── delivery.queue.js      # BullMQ queue definition
│   │   └── delivery.worker.js     # Worker that processes jobs
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── webhook.routes.js
│   │   ├── event.routes.js
│   │   └── log.routes.js
│   ├── services/
│   │   ├── hmac.service.js        # Signature generation & verification
│   │   ├── delivery.service.js    # HTTP POST logic with timeout
│   │   └── dashboard.service.js   # Stats aggregation
│   ├── utils/
│   │   └── apiResponse.js         # Standardized response format
│   └── app.js                     # Express app setup
├── worker.js                      # Worker process entry point
├── server.js                      # API server entry point
├── .env.example
├── package.json
└── README.md
```

---

## 🗃️ Database Schema

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  api_key VARCHAR(64) UNIQUE NOT NULL,
  secret_key VARCHAR(64) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Webhooks table
CREATE TABLE webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  target_url TEXT NOT NULL,
  event_types TEXT[] NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Events table
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Delivery logs table
CREATE TABLE delivery_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID REFERENCES webhooks(id),
  event_id UUID REFERENCES events(id),
  status VARCHAR(20) NOT NULL,   -- pending | success | failed | dead
  attempt_number INT DEFAULT 1,
  response_code INT,
  error_message TEXT,
  delivered_at TIMESTAMP
);
```

---

## 🔌 API Reference

### Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Login and get JWT |
| GET | `/api/auth/me` | Get current user info |

### Webhooks

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/webhooks` | Register a new webhook |
| GET | `/api/webhooks` | List all your webhooks |
| PATCH | `/api/webhooks/:id` | Update URL or event types |
| DELETE | `/api/webhooks/:id` | Delete a webhook |
| PATCH | `/api/webhooks/:id/toggle` | Enable / disable |

### Events

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/events/trigger` | Trigger an event (uses `x-api-key` header) |
| GET | `/api/events` | List past triggered events |

### Logs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/logs` | All delivery logs for your account |
| GET | `/api/logs/:webhook_id` | Logs for a specific webhook |

### AI

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/analyse-failure/:webhook_id` | AI diagnoses why a webhook keeps failing |
| POST | `/api/ai/validate-payload` | AI validates your event payload before sending |
| POST | `/api/ai/debug` | Ask AI anything about your webhook system |
| GET | `/api/ai/alerts` | Get AI-generated anomaly alerts |

### Dashboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/stats` | Summary stats for frontend |

---

## ⚙️ Environment Variables

Create a `.env` file from `.env.example`:

```env
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/hookrelay
REDIS_URL=redis://localhost:6379
JWT_SECRET=your_super_secret_jwt_key
JWT_REFRESH_SECRET=your_refresh_secret_key
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Redis 7+

### Installation

```bash
# Clone the repo
git clone https://github.com/asmit990/hookrelay.git
cd hookrelay

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env with your DB and Redis credentials

# Run database migrations
npm run migrate

# Start the API server
npm run dev

# In a separate terminal, start the worker
npm run worker
```

---

## 🔁 Retry Logic

HookRelay uses **exponential backoff** for failed deliveries:

```
Attempt 1  →  immediate
Attempt 2  →  wait 3s
Attempt 3  →  wait 9s
Attempt 4  →  wait 27s
Attempt 5  →  wait 81s
─────────────────────────
After 5 failures → status: DEAD → moved to Dead Letter Queue
```

A delivery is considered failed if:
- The target URL returns a non-2xx response
- The request times out (> 5 seconds)
- The URL is unreachable

---

## 🔒 HMAC Signature Verification

Every outgoing webhook request includes a signature header:

```
X-HookRelay-Signature: sha256=<hmac_hex>
```

**How it's generated:**
```js
const signature = crypto
  .createHmac('sha256', user.secret_key)
  .update(JSON.stringify(payload))
  .digest('hex');
```

**How to verify on your end (receiver side):**
```js
const expectedSig = crypto
  .createHmac('sha256', YOUR_SECRET_KEY)
  .update(JSON.stringify(req.body))
  .digest('hex');

const isValid = `sha256=${expectedSig}` === req.headers['x-hookrelay-signature'];
```

---

## 📊 Dashboard Stats Response

```json
{
  "total_webhooks": 12,
  "active_webhooks": 10,
  "events_today": 143,
  "success_rate": "94.2%",
  "failed_today": 8,
  "dead_webhooks": 2,
  "recent_logs": [...]
}
```

---

## 📦 NPM Dependencies

```json
{
  "dependencies": {
    "express": "^4.18.0",
    "pg": "^8.11.0",
    "redis": "^4.6.0",
    "bullmq": "^4.0.0",
    "bcrypt": "^5.1.0",
    "jsonwebtoken": "^9.0.0",
    "axios": "^1.4.0",
    "dotenv": "^16.0.0",
    "cors": "^2.8.5",
    "uuid": "^9.0.0",
    "express-rate-limit": "^6.7.0"
  }
}
```

---

## 🧪 Testing Webhooks Locally

Use [webhook.site](https://webhook.site) or [requestbin.com](https://requestbin.com) to get a free test URL that logs all incoming requests — perfect for testing during development.

```bash
# Trigger a test event
curl -X POST http://localhost:3000/api/events/trigger \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"event_type": "payment.success", "payload": {"amount": 500, "currency": "INR"}}'
```

---

## 🤖 AI-Powered Features

This is where HookRelay goes beyond a standard webhook system. Four AI features powered by the **Claude API** are baked into the backend.

---

### 1. 🔍 AI Failure Analyst

When a webhook hits the Dead Letter Queue, instead of staring at raw error logs, you call one endpoint and get a human-readable explanation of what went wrong and how to fix it.

**Endpoint:**
```
POST /api/ai/analyse-failure/:webhook_id
```

**What it does:** Sends your last 10 delivery log attempts to Claude AI and asks it to diagnose the issue.

**Example response:**
```json
{
  "analysis": "Your webhook is consistently timing out after 5 seconds. The target URL (api.yoursite.com/hook) appears to be doing synchronous database writes before returning a response. Recommendation: Make your receiver return 200 immediately and process the payload asynchronously using a queue on your side.",
  "severity": "high",
  "suggested_fix": "Add immediate ACK response pattern on receiver"
}
```

---

### 2. 🧠 AI Payload Validator

Before you trigger a real event, run your payload through the AI validator to catch structural issues, missing fields, or bad formatting.

**Endpoint:**
```
POST /api/ai/validate-payload
```

**Request:**
```json
{
  "event_type": "payment.success",
  "payload": { "amt": 500 }
}
```

**AI Response:**
```json
{
  "valid": false,
  "issues": [
    "Field 'amt' looks like a typo — did you mean 'amount'?",
    "Missing 'currency' field — required for financial events",
    "Missing 'transaction_id' — makes debugging impossible without this"
  ],
  "suggested_payload": {
    "amount": 500,
    "currency": "INR",
    "transaction_id": "txn_xxxxxxxx"
  }
}
```

---

### 3. 💬 AI Debug Assistant

A natural language interface to your webhook system. Describe your problem in plain English and get a technical answer back.

**Endpoint:**
```
POST /api/ai/debug
```

**Request:**
```json
{
  "question": "My webhook worked fine yesterday but now it keeps failing with a 401. I didn't change anything."
}
```

**AI Response:**
```json
{
  "diagnosis": "A 401 Unauthorized on the receiver side usually means the HMAC signature verification is failing. This happens when: (1) your secret key was rotated, (2) the payload is being modified before verification (e.g. by a reverse proxy re-encoding JSON), or (3) the receiver is using a different string encoding. Check if your secret_key in .env matches what the receiver is using.",
  "steps": [
    "Compare secret key on both sides",
    "Log raw request body before verification",
    "Ensure no middleware is transforming the body"
  ]
}
```

---

### 4. 📈 AI Anomaly Detection

A cron job runs every hour, feeds your success rate + delivery stats to Claude, and flags any unusual patterns before they turn into real problems.

**How it works:**
```
Every 1 hour → cron collects last hour's stats → sends to Claude AI → 
if anomaly detected → creates an alert in DB → exposed via /api/ai/alerts
```

**Example alert:**
```json
{
  "alert": "Your success rate dropped from 98% to 71% in the last hour. 
            23 of 30 failures are from the same webhook ID (wh_abc123) 
            targeting payments.yoursite.com. This is likely a deployment 
            issue on the receiver side, not a HookRelay problem.",
  "affected_webhook": "wh_abc123",
  "triggered_at": "2025-03-01T14:00:00Z"
}
```

---

### AI Env Variables

Add these to your `.env`:

```env
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxx
AI_MODEL=claude-3-haiku-20240307
```

> Uses **Claude Haiku** for speed and cost efficiency — perfect for real-time API responses.

---


Recommended: **Railway** (free tier supports Node.js + PostgreSQL + Redis)

```bash
# Deploy API server
railway up

# Set environment variables on Railway dashboard
# Add a second service for the worker process (point to worker.js)
```

---

## 🗺️ 10-Day Build Plan

| Day | Goal |
|-----|------|
| 1 | Project setup, DB schema, Express boilerplate |
| 2 | Auth (register, login, JWT, API key generation) |
| 3 | Webhook CRUD endpoints |
| 4 | Redis + BullMQ queue setup |
| 5 | Worker: HTTP delivery + 5s timeout |
| 6 | Retry logic + exponential backoff |
| 7 | HMAC signature generation + delivery logs |
| 8 | Rate limiting + **AI features** (Failure Analyst, Payload Validator, Debug Assistant) |
| 9 | AI Anomaly Detection cron + vibe code the frontend dashboard |
| 10 | Deploy on Railway + write Postman collection |

---

## 🤝 Contributing

Pull requests are welcome. For major changes, open an issue first to discuss what you'd like to change.

---

## 📄 License

[MIT](LICENSE)

---

> Built by [asmit](https://github.com/asmit990) · Made with ☕, way too many console.logs, and a little help from AI
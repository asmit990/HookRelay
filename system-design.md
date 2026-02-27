# 🏗️ HookRelay — System Design Document

> **Version:** 1.0  
> **Author:** asmit 
> **Stack:** Node.js · PostgreSQL · Redis · BullMQ · Claude AI  
> **Last Updated:** Feb 2026

---

## 📋 Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Functional Requirements](#2-functional-requirements)
3. [Non-Functional Requirements](#3-non-functional-requirements)
4. [High Level Architecture](#4-high-level-architecture)
5. [Component Breakdown](#5-component-breakdown)
6. [Database Design & Indexing](#6-database-design--indexing)
7. [Queue & Worker Design](#7-queue--worker-design)
8. [AI Integration Flow](#8-ai-integration-flow)
9. [API Design Principles](#9-api-design-principles)
10. [Scaling & Bottlenecks](#10-scaling--bottlenecks)
11. [Failure Scenarios & Mitigations](#11-failure-scenarios--mitigations)
12. [Security Design](#12-security-design)

---

## 1. Problem Statement

When a payment succeeds, a user signs up, or an order ships — multiple downstream services need to know about it **immediately and reliably**. Directly calling every service from your backend is fragile: what if one is down? What if it times out? You lose the event forever.

**HookRelay solves this** by acting as a reliable middle layer:

- Sender fires one event → HookRelay handles all deliveries
- If a delivery fails → auto-retry with backoff
- Full audit log of every attempt
- AI layer to diagnose failures before they become incidents

This is exactly how **Stripe, GitHub, Razorpay, and Shopify** handle their webhook infrastructure internally.

---

## 2. Functional Requirements

| # | Requirement |
|---|-------------|
| FR1 | Users can register, login, and get a unique API key + secret key |
| FR2 | Users can register webhook endpoints (URLs + event types to subscribe to) |
| FR3 | Senders can trigger events via API using their API key |
| FR4 | System delivers the event payload to all matching registered URLs |
| FR5 | If delivery fails, system retries with exponential backoff (max 5 attempts) |
| FR6 | After 5 failures, webhook is marked DEAD and moved to Dead Letter Queue |
| FR7 | Every delivery attempt is logged with status, response code, error |
| FR8 | Each delivery is signed with HMAC-SHA256 for receiver verification |
| FR9 | Rate limit: max 100 events/min per API key |
| FR10 | AI can analyse failed webhooks, validate payloads, and detect anomalies |

---

## 3. Non-Functional Requirements

| # | Requirement | Target |
|---|-------------|--------|
| NFR1 | **Availability** | 99.9% uptime |
| NFR2 | **Latency** | Event trigger API responds in < 50ms (never waits for delivery) |
| NFR3 | **Throughput** | Handle 1,000 events/sec at peak |
| NFR4 | **Delivery Guarantee** | At-least-once delivery (may retry even on success edge cases) |
| NFR5 | **Durability** | No event lost even if worker crashes mid-job |
| NFR6 | **Observability** | 100% of delivery attempts logged |
| NFR7 | **Security** | All payloads signed, all routes authenticated |

---

## 4. High Level Architecture

```
                         ┌─────────────────────────────────────────────────┐
                         │                  HookRelay System                │
                         │                                                   │
  ┌──────────────┐       │  ┌─────────────┐      ┌────────────────────┐    │
  │    Sender    │──────▶│  │  API Server  │─────▶│   BullMQ Queue     │    │
  │  (any app)   │  POST │  │ (Express.js) │      │  (Redis-backed)    │    │
  └──────────────┘ event │  └──────┬──────┘      └────────┬───────────┘    │
                         │         │                       │                 │
                         │         ▼                       ▼                 │
                         │  ┌─────────────┐      ┌────────────────────┐    │
                         │  │  PostgreSQL  │      │   Worker Process   │    │
                         │  │  (primary    │      │   (delivery.js)    │    │
                         │  │   datastore) │      └────────┬───────────┘    │
                         │  └─────────────┘               │                 │
                         │                                 │  HTTP POST      │
                         │  ┌─────────────┐               │  + HMAC sig     │
                         │  │   Redis      │               ▼                 │
                         │  │  (queue +    │      ┌────────────────────┐    │
                         │  │  rate limit) │      │   Receiver URL     │    │
                         │  └─────────────┘      │  (client's server) │    │
                         │                        └────────────────────┘    │
                         │  ┌─────────────┐                                 │
                         │  │  Claude AI   │◀─── failure analysis           │
                         │  │  (Anthropic) │     payload validation          │
                         │  └─────────────┘     anomaly detection           │
                         └─────────────────────────────────────────────────┘
```

**Key design decision:** The API server and Worker are **two completely separate processes**. The API server never does HTTP delivery — it only writes to the queue and responds instantly. This decoupling is what makes the system fast and resilient.

---

## 5. Component Breakdown

### 5.1 API Server (`server.js`)

**Responsibilities:**
- Handle all incoming HTTP requests
- Validate JWT / API key on every route
- Write events to BullMQ queue (fire-and-forget)
- Serve logs, dashboard stats, AI endpoints
- Enforce rate limits via Redis

**Does NOT:**
- Deliver webhooks directly
- Wait for delivery confirmations
- Talk to Claude AI synchronously on hot paths

---

### 5.2 Worker Process (`worker.js`)

**Responsibilities:**
- Continuously poll BullMQ queue for jobs
- HTTP POST to receiver URLs with 5s timeout
- Handle success/failure and update delivery logs
- Implement retry + exponential backoff logic
- Move dead jobs to Dead Letter Queue after 5 failures

**Runs separately** from the API server — can be scaled independently.

---

### 5.3 PostgreSQL (Primary Datastore)

Stores all persistent data: users, webhooks, events, delivery logs.

**Why PostgreSQL over MongoDB?**
- Delivery logs need strong consistency (you don't want duplicate log entries)
- JSONB columns give you NoSQL flexibility for payloads
- Relational integrity (foreign keys) prevents orphaned log entries
- Better suited for complex analytics queries on the dashboard

---

### 5.4 Redis

Serves two purposes:

| Purpose | How |
|---------|-----|
| BullMQ job broker | Stores queued jobs, job state, retry schedules |
| Rate limiting | Sliding window counters per API key |

**Why Redis for the queue?**
- BullMQ is built on Redis — battle-tested for millions of jobs/day
- Jobs survive worker restarts (persisted in Redis)
- Built-in delayed job support (perfect for backoff retries)

---

### 5.5 Claude AI Layer

Three async AI features — all called **off the hot path** (never slows down event delivery):

| Feature | When it runs |
|---------|-------------|
| Failure Analyst | On-demand via `/api/ai/analyse-failure` |
| Payload Validator | On-demand via `/api/ai/validate-payload` |
| Debug Assistant | On-demand via `/api/ai/debug` |
| Anomaly Detection | Cron job, every 1 hour |

---

## 6. Database Design & Indexing

### 6.1 Schema (with decisions explained)

```sql
-- USERS
-- api_key: used by senders to authenticate event triggers
-- secret_key: used for HMAC signing (never exposed in logs)
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  api_key     VARCHAR(64) UNIQUE NOT NULL,  -- random 32 bytes hex
  secret_key  VARCHAR(64) NOT NULL,         -- random 32 bytes hex
  created_at  TIMESTAMP DEFAULT NOW()
);

-- WEBHOOKS
-- event_types: TEXT[] array — one webhook can subscribe to multiple events
-- is_active: soft toggle without deleting history
CREATE TABLE webhooks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  target_url  TEXT NOT NULL,
  event_types TEXT[] NOT NULL,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- EVENTS
-- payload: JSONB — flexible structure, fully queryable
-- Immutable after insert — events are never modified
CREATE TABLE events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id),
  event_type  VARCHAR(100) NOT NULL,
  payload     JSONB NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- DELIVERY_LOGS
-- One row per delivery ATTEMPT (not per event)
-- An event with 3 retries = 3 rows in this table
-- status ENUM: pending | success | failed | dead
CREATE TABLE delivery_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id     UUID REFERENCES webhooks(id) ON DELETE CASCADE,
  event_id       UUID REFERENCES events(id),
  status         VARCHAR(20) NOT NULL,
  attempt_number INT DEFAULT 1,
  response_code  INT,
  error_message  TEXT,
  delivered_at   TIMESTAMP
);
```

---

### 6.2 Indexes (Critical for Performance)

```sql
-- Fast lookup: "give me all webhooks for this user"
CREATE INDEX idx_webhooks_user_id ON webhooks(user_id);

-- Fast lookup: "give me all webhooks subscribed to this event type"
CREATE INDEX idx_webhooks_event_types ON webhooks USING GIN(event_types);
-- GIN index is required for array containment queries (@> operator)

-- Fast lookup: "give me all delivery logs for this webhook"
CREATE INDEX idx_delivery_logs_webhook_id ON delivery_logs(webhook_id);

-- Fast lookup: "give me all failed/dead logs" (dashboard, AI analysis)
CREATE INDEX idx_delivery_logs_status ON delivery_logs(status);

-- Fast lookup: "give me all events for this user sorted by time"
CREATE INDEX idx_events_user_id_created ON events(user_id, created_at DESC);
```

**Why the GIN index on event_types matters:**

When an event fires, you need to find ALL webhooks subscribed to that event type:
```sql
SELECT * FROM webhooks
WHERE event_types @> ARRAY['payment.success']
AND is_active = TRUE;
```
Without the GIN index this is a full table scan. With it, O(log n).

---

### 6.3 Data Flow (Event Trigger → Delivery Log)

```
POST /api/events/trigger
         │
         ▼
  Insert into events table
         │
         ▼
  Query: SELECT webhooks WHERE event_types @> [event_type] AND is_active = true
         │
         ▼
  For each matching webhook → push job to BullMQ queue
         │
         ▼
  Return 200 immediately ✅
         │
         (async, in worker)
         ▼
  Worker picks job → HTTP POST to target_url
         │
    ┌────┴────┐
  success   failure
    │           │
    ▼           ▼
  Insert      Insert
  log:        log:
  status=     status=
  success     failed
              │
              ▼
         attempt < 5?
          │       │
         YES      NO
          │       │
      schedule  mark DEAD
      retry     → DLQ
```

---

## 7. Queue & Worker Design

### 7.1 BullMQ Queue Architecture

```
  ┌─────────────────────────────────────────────────┐
  │                  Redis (BullMQ)                  │
  │                                                   │
  │   webhook:delivery queue                          │
  │  ┌──────────────────────────────────────────┐    │
  │  │  WAITING   │  ACTIVE  │  COMPLETED       │    │
  │  │  [job4]    │  [job2]  │  [job1] [job3]   │    │
  │  └──────────────────────────────────────────┘    │
  │                                                   │
  │   webhook:dlq (dead letter queue)                 │
  │  ┌──────────────────────────────────────────┐    │
  │  │  [job5 - 5 failures, permanently dead]   │    │
  │  └──────────────────────────────────────────┘    │
  └─────────────────────────────────────────────────┘
            ▲                    │
            │ push jobs          │ poll jobs
            │                    ▼
      API Server           Worker Process
                          (1 or more instances)
```

---

### 7.2 Job Schema

Every job pushed to the queue looks like this:

```json
{
  "jobId": "uuid-v4",
  "webhookId": "wh_abc123",
  "eventId": "evt_xyz789",
  "targetUrl": "https://yoursite.com/hooks/payment",
  "payload": { "amount": 500, "currency": "INR" },
  "secretKey": "user_secret_for_hmac",
  "attemptNumber": 1
}
```

---

### 7.3 Retry Logic with Exponential Backoff

```
Attempt 1 → IMMEDIATE
              │
           FAIL?
              │
         wait 3^1 = 3s
              │
Attempt 2 → retry
              │
           FAIL?
              │
         wait 3^2 = 9s
              │
Attempt 3 → retry
              │
           FAIL?
              │
         wait 3^3 = 27s
              │
Attempt 4 → retry
              │
           FAIL?
              │
         wait 3^4 = 81s
              │
Attempt 5 → retry
              │
           FAIL?
              │
         ┌────────────┐
         │  MARK DEAD │
         │  move to   │
         │    DLQ     │
         └────────────┘
```

**BullMQ handles this natively:**
```js
const queue = new Queue('webhook:delivery', { connection: redis });

await queue.add('deliver', jobData, {
  attempts: 5,
  backoff: {
    type: 'exponential',
    delay: 3000  // base delay 3s → 3s, 9s, 27s, 81s, 243s
  }
});
```

---

### 7.4 Worker Failure Safety

**Problem:** What if the worker crashes mid-delivery?

**Solution:** BullMQ uses a **"lock"** on active jobs. If the worker dies while processing a job, the lock expires and the job goes back to WAITING state automatically. No event is lost.

```
Worker picks job → job moves to ACTIVE (locked for 30s)
     │
Worker crashes!
     │
Lock expires after 30s
     │
Job returns to WAITING → another worker picks it up ✅
```

---

### 7.5 Delivery with Timeout

Every HTTP POST to a receiver has a hard **5 second timeout**:

```js
try {
  const response = await axios.post(targetUrl, payload, {
    timeout: 5000,
    headers: {
      'Content-Type': 'application/json',
      'X-HookRelay-Signature': `sha256=${hmacSignature}`,
      'X-HookRelay-Event': eventType,
      'X-HookRelay-Delivery-Id': jobId
    }
  });

  if (response.status >= 200 && response.status < 300) {
    // SUCCESS → log it, done
  } else {
    throw new Error(`Non-2xx: ${response.status}`);
  }
} catch (err) {
  // FAIL → BullMQ will schedule retry automatically
  throw err;
}
```

---

## 8. AI Integration Flow

### 8.1 Overview

```
  ┌────────────────────────────────────────────────────────┐
  │                    AI Layer                             │
  │                                                         │
  │   ┌──────────────┐   ┌──────────────┐                 │
  │   │  On-Demand   │   │  Scheduled   │                 │
  │   │  (API calls) │   │  (Cron job)  │                 │
  │   └──────┬───────┘   └──────┬───────┘                 │
  │          │                  │                           │
  │   ┌──────▼───────────────────▼──────┐                 │
  │   │         Claude API               │                 │
  │   │    (claude-haiku-20240307)       │                 │
  │   └─────────────────────────────────┘                 │
  │          │                  │                           │
  │   ┌──────▼──────┐   ┌───────▼──────┐                 │
  │   │  AI Response │   │ Anomaly Alert│                 │
  │   │  → JSON      │   │ → DB insert  │                 │
  │   └─────────────┘   └──────────────┘                 │
  └────────────────────────────────────────────────────────┘
```

---

### 8.2 Failure Analyst Flow

```
User calls: POST /api/ai/analyse-failure/:webhook_id
                    │
                    ▼
      Query last 10 delivery logs for webhook
                    │
                    ▼
      Build prompt:
      ┌────────────────────────────────────────────┐
      │ "You are a webhook delivery expert.         │
      │  Here are the last 10 delivery attempts     │
      │  for webhook targeting {url}:               │
      │  {logs_as_json}                             │
      │  Diagnose the root cause and suggest a fix. │
      │  Respond in JSON: {analysis, severity,      │
      │  suggested_fix}"                            │
      └────────────────────────────────────────────┘
                    │
                    ▼
            Claude API call
                    │
                    ▼
         Parse JSON response
                    │
                    ▼
         Return to user ✅
```

---

### 8.3 Anomaly Detection Cron Flow

```
Every 1 hour → cron fires
      │
      ▼
Query: last hour stats per user
  - total events
  - success count
  - failure count
  - success rate %
  - compare to previous hour baseline
      │
      ▼
For each user where success_rate dropped > 15%:
      │
      ▼
  Build prompt:
  ┌────────────────────────────────────────────┐
  │ "Analyse this webhook delivery data.        │
  │  Previous hour: 98% success (143 events)   │
  │  Current hour:  71% success (30 events)    │
  │  Failure details: {top failing webhooks}   │
  │  Is this an anomaly? What's likely cause?" │
  └────────────────────────────────────────────┘
      │
      ▼
  Claude responds with anomaly report
      │
      ▼
  Insert into ai_alerts table
      │
      ▼
  User sees alert on GET /api/ai/alerts ✅
```

---

### 8.4 AI Alerts Table (extra schema)

```sql
CREATE TABLE ai_alerts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES users(id),
  alert_type   VARCHAR(50),  -- anomaly | failure_pattern | etc
  message      TEXT,
  severity     VARCHAR(20),  -- low | medium | high | critical
  is_read      BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMP DEFAULT NOW()
);
```

---

### 8.5 Why Claude Haiku?

| Model | Latency | Cost | Good for |
|-------|---------|------|----------|
| Claude Opus | Slow | High | Complex reasoning |
| Claude Sonnet | Medium | Medium | Balanced tasks |
| **Claude Haiku** | **Fast** | **Low** | **Real-time API responses ✅** |

For failure analysis and payload validation, users expect a fast response. Haiku gives answers in ~1s at a fraction of the cost — perfect for a backend API.

---

## 9. API Design Principles

### 9.1 Standard Response Format

Every endpoint returns the same envelope:

```json
// Success
{
  "success": true,
  "data": { ... },
  "message": "Webhook created successfully"
}

// Error
{
  "success": false,
  "error": "WEBHOOK_NOT_FOUND",
  "message": "No webhook found with that ID"
}
```

### 9.2 HTTP Status Codes Used

| Code | When |
|------|------|
| 200 | Success (GET, PATCH, DELETE) |
| 201 | Resource created (POST) |
| 400 | Bad request / validation error |
| 401 | Missing or invalid JWT / API key |
| 403 | Authenticated but not authorized (trying to access someone else's webhook) |
| 404 | Resource not found |
| 429 | Rate limit exceeded |
| 500 | Internal server error |

### 9.3 Auth Strategy

```
Regular routes (webhooks, logs, dashboard):
  → Bearer JWT in Authorization header
  → Expires in 15 minutes
  → Refresh token: 7 days

Event trigger route:
  → x-api-key header (long-lived, like an API key)
  → Why? Senders automate event triggering — JWT expiry would break their integrations
```

---

## 10. Scaling & Bottlenecks

### 10.1 Current Architecture Limits (Single Server)

| Component | Bottleneck | Limit |
|-----------|-----------|-------|
| API Server | CPU / single thread | ~500 req/sec |
| Worker | Single process, sequential delivery | ~50 deliveries/sec |
| PostgreSQL | Connection pool (default 10) | ~200 concurrent queries |
| Redis | Single instance | ~100k ops/sec (not a concern yet) |

---

### 10.2 Scaling the Worker (Most Important)

The worker is the **first bottleneck** you'll hit. Simple fix: run more workers.

```
Current:
  1 Worker → 50 deliveries/sec

Scale to 5 Workers:
  5 Workers → 250 deliveries/sec

BullMQ handles this automatically — multiple workers compete for the same queue.
No code changes needed.
```

```
  ┌─────────────┐
  │  BullMQ     │
  │  Queue      │
  └──────┬──────┘
         │
    ┌────┴─────────────┐
    ▼         ▼         ▼
 Worker1   Worker2   Worker3
 (Railway  (Railway  (Railway
  dyno 1)   dyno 2)   dyno 3)
```

---

### 10.3 Scaling the API Server

Use a load balancer in front of multiple API server instances:

```
                   ┌──────────────┐
  Requests ───────▶│ Load Balancer│
                   └──────┬───────┘
              ┌───────────┼───────────┐
              ▼           ▼           ▼
         API Server  API Server  API Server
            #1          #2          #3
              └───────────┼───────────┘
                          ▼
                     PostgreSQL
                  (shared primary DB)
```

Since the API server is stateless (JWT-based auth, no in-memory sessions), this works out of the box.

---

### 10.4 Database Scaling Path

```
Phase 1 (current): Single PostgreSQL instance
         │
         ▼ (when reads get slow)
Phase 2: Read Replica for dashboard + log queries
  Primary DB ──────▶ Replica DB
  (writes only)      (reads only: logs, stats)
         │
         ▼ (when data grows huge)
Phase 3: Partition delivery_logs by created_at (monthly partitions)
  delivery_logs_2025_01
  delivery_logs_2025_02
  ...
```

---

### 10.5 Rate Limiting Design (Redis Sliding Window)

```
User makes request with API key
         │
         ▼
Redis: INCR "ratelimit:{api_key}:{current_minute}"
         │
         ▼
      count > 100?
       │       │
      YES      NO
       │       │
  Return 429  Allow request
              Set TTL = 60s on key
```

**Why per-minute sliding window over per-second?**
Burst traffic is normal — a sender might fire 50 events in 2 seconds then go quiet. Per-minute window allows natural bursts without false-positive throttling.

---

## 11. Failure Scenarios & Mitigations

| Scenario | What Happens | Mitigation |
|----------|-------------|------------|
| Worker crashes mid-delivery | Job lock expires → job re-queued automatically | BullMQ lock mechanism |
| Redis goes down | Queue stops; API returns 503 | Redis sentinel / replicated Redis in prod |
| PostgreSQL goes down | All writes fail; API returns 503 | Connection retry with exponential backoff |
| Receiver URL times out | Counted as failure → retry scheduled | 5s timeout + retry logic |
| Receiver returns 500 | Counted as failure → retry scheduled | Retry up to 5 times |
| Receiver returns 200 but crashes after | Delivery marked success (at-least-once guarantee) | Receivers must be idempotent |
| Claude API is down | AI endpoints return graceful error | Try/catch → return "AI unavailable" message |
| Duplicate job delivery (rare) | Receiver gets same event twice | Idempotency key in headers (`X-HookRelay-Delivery-Id`) |

---

## 12. Security Design

### 12.1 HMAC Signature Flow

```
Sender triggers event
         │
         ▼
Worker builds delivery:
  payload_string = JSON.stringify(payload)
  signature = HMAC-SHA256(payload_string, user.secret_key)
  header: X-HookRelay-Signature: sha256={signature}
         │
         ▼
HTTP POST to receiver URL
         │
         ▼
Receiver verifies:
  expected = HMAC-SHA256(req.body, THEIR_SECRET_KEY)
  isValid = (expected === req.headers['x-hookrelay-signature'])
         │
      ┌──┴───┐
    VALID  INVALID
      │       │
   Process  Reject
   payload  (return 401)
```

### 12.2 Security Checklist

| Layer | Protection |
|-------|-----------|
| Passwords | bcrypt with salt rounds = 12 |
| API Keys | `crypto.randomBytes(32).toString('hex')` |
| JWT | Short-lived (15 min) + refresh token rotation |
| Payloads | HMAC-SHA256 signed on every delivery |
| Routes | Auth middleware on every non-public route |
| Rate Limiting | 100 req/min per API key (Redis) |
| SQL Injection | Parameterized queries via `pg` driver |
| Secrets | Never logged, never returned in API responses |

---

## Summary

HookRelay is designed around three core principles:

**1. Decoupling** — The API server never does delivery. Queue separates concerns cleanly.

**2. Resilience** — Every failure is handled. Retry logic, backoff, dead letter queues, lock-based crash recovery.

**3. Observability** — Every delivery attempt is logged. AI layer turns raw logs into actionable insights.

This architecture can handle a college side project today and scale to a real SaaS product tomorrow — without changing the core design.

---

> 📌 *This document should be read alongside `README.md` for setup and API reference.*
# Next Development Steps

Prioritized near-term tasks ordered by business risk. Complete Priority 1 before any real club goes live.

---

## ✅ Completed

All tasks below have been implemented and committed.

### Priority 1 — Security & Stability
- [x] **1.1 Dashboard Authentication** — NextAuth v5 credentials provider, middleware protection, `/login` page, sign-out button
- [x] **1.2 `.env.example`** — All required variables documented with placeholder values
- [x] **1.3 Webhook Signature Verification** — `X-Hub-Signature-256` HMAC-SHA256 checked before processing; dev bypass when secret is unset
- [x] **1.4 Rate Limiting on Webhook Endpoint** — Upstash Redis + `@upstash/ratelimit`, 20 req/min per IP, graceful no-op when unconfigured

### Priority 2 — Multi-Club Routing
- [x] **2.1 Route DMs by WhatsApp Phone Number ID** — `phone_number_id` extracted from webhook metadata; `resolveClub()` queries `clubs.whatsapp_number` before falling back to first-active-club

### Priority 3 — Reliability
- [x] **3.1 Error Monitoring** — Sentry SDK installed; `instrumentation.ts`, server and edge configs wired; `SENTRY_DSN` documented in `.env.example`
- [x] **3.2 Agent Failure Fallback Message** — `catch` block in `handleMessages()` sends "Sorry, something went wrong…" to the player
- [x] **3.3 Retry Logic for WhatsApp Send** — Exponential backoff (500 / 1000 / 2000ms, max 3 retries); 4xx responses not retried

### Priority 4 — Developer Experience
- [x] **4.1 Test Suite** — 26 Vitest tests across 4 files: WhatsApp parser, LLM history filter, booking tools (mocked DB), MockAdapter contract
- [x] **4.2 CI Pipeline** — GitHub Actions: `npm ci` → lint → typecheck → test on every push / PR
- [x] **4.3 Seed Script** — `npm run seed` inserts a demo club with mock booking config; skips if already exists

### Priority 5 — Conversation Quality
- [x] **5.1 Non-Text Message Handling** — Voice notes / images / video now receive a polite "I can only handle text messages" reply instead of silence

---

## Remaining / New Tasks

Ordered by business risk. Tasks marked **[BLOCKER]** must be done before the first paying club goes live.

---

## Priority 6 — Production Hardening

### ✅ 6.1 Webhook Idempotency

**Files:** `app/api/webhooks/whatsapp/route.ts`, new Supabase table or Redis key
**Complexity:** M

WhatsApp (both 360dialog and Meta Cloud API) may re-deliver the same webhook if your server doesn't respond within 5 seconds or returns a non-200. Currently a duplicate delivery would run the agent twice and send the player two responses.

Fix: before calling `runAgent()`, check whether `msg.messageId` has already been processed. Use a lightweight deduplication store:

Option A — Supabase: add a `processed_message_ids` table with a `message_id` PK and a TTL-cleanup job.
Option B — Redis: `SET msg:{id} 1 EX 86400 NX` (requires Upstash, which is already a dependency).

Return early (no agent call, no reply) if the message ID already exists.

---

### ✅ 6.2 Sentry DSN + Source Maps in Production

**Files:** `.env.local` / Vercel env vars, `next.config.ts`
**Complexity:** S

Sentry is wired but won't capture anything until `SENTRY_DSN` is set. Without source maps, stack traces in the Sentry dashboard will be minified and hard to read.

Steps:
1. Create a Sentry project at sentry.io → copy the DSN
2. Add `SENTRY_DSN` to Vercel env vars (all environments)
3. Add `SENTRY_AUTH_TOKEN` for source map uploads:
   ```bash
   npx @sentry/wizard@latest -i nextjs --saas
   ```
   The wizard adds `withSentryConfig()` to `next.config.ts` and a `SENTRY_AUTH_TOKEN` env var.
4. Verify by throwing a test error and confirming it appears in Sentry.

---

### 6.3 Upstash Redis Provisioning `[BLOCKER]`

**Files:** `.env.local` / Vercel env vars
**Complexity:** S

Rate limiting is implemented but disabled until the env vars are set. Without it, a single player can flood the agent and exhaust Anthropic API credits.

Steps:
1. Create a free Upstash Redis database at console.upstash.com
2. Copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
3. Add both to Vercel env vars (and `.env.local` for local testing)
4. Verify: send 21+ rapid requests to `POST /api/webhooks/whatsapp` and confirm the 22nd returns 429.

---

### ✅ 6.4 Structured Logging

**Files:** `lib/logger.ts` (create), all route handlers and agent loop
**Complexity:** M

All logging currently uses `console.log` / `console.error`. In Vercel's log drain or any log aggregator, these produce unstructured blobs that are hard to query.

Replace with a thin structured logger (e.g. `pino` or a hand-rolled JSON wrapper):
```ts
// lib/logger.ts
export const log = {
  info: (msg: string, ctx?: object) => console.log(JSON.stringify({ level: "info", msg, ...ctx })),
  warn: (msg: string, ctx?: object) => console.warn(JSON.stringify({ level: "warn", msg, ...ctx })),
  error: (msg: string, ctx?: object) => console.error(JSON.stringify({ level: "error", msg, ...ctx })),
};
```

Key fields to include on webhook logs: `messageId`, `from`, `clubId`, `durationMs`.

---

### ✅ 6.5 Health Check Endpoint

**Files:** `app/api/health/route.ts` (create)
**Complexity:** S

Add `GET /api/health` that verifies the DB connection is alive and returns a structured status:
```json
{ "status": "ok", "db": "ok", "ts": "2026-03-07T..." }
```

Returns `503` if the DB ping fails. Use this URL in Vercel uptime checks or an external monitor (Better Uptime, UptimeRobot).

---

### ✅ 6.6 WhatsApp Opt-Out Handling

**Files:** `app/api/webhooks/whatsapp/route.ts`, `lib/agent/conversation.ts`
**Complexity:** M

If a player sends "STOP", "UNSUBSCRIBE", or "OPT OUT", the agent currently passes it to the LLM which will likely respond with booking-related text. Meta's platform policy requires honouring opt-out requests.

Steps:
1. In `handleMessages()`, before calling `runAgent()`, check if the message matches an opt-out keyword (case-insensitive).
2. If matched: set a `opted_out_at` column on the `conversations` record, reply "You've been unsubscribed. Reply START to re-subscribe.", and skip the agent.
3. Gate future messages from opted-out contacts: skip processing and do not reply.

Add `opted_out_at TIMESTAMPTZ` to `conversations` table via migration.

---

## Priority 7 — Production Deployment

### 7.1 Vercel Production Deploy

**Files:** `vercel.json` (optional), Vercel dashboard
**Complexity:** M (mostly config, no code)

Steps:
1. Push the repo to GitHub (done).
2. Import the repo in Vercel → set Framework to Next.js.
3. Set all env vars from `.env.example` in Vercel's Environment Variables panel (Production + Preview).
4. Set the Vercel project domain in the 360dialog portal as the webhook URL: `https://your-domain.vercel.app/api/webhooks/whatsapp`.
5. Verify the webhook GET challenge response (360dialog will call it on registration).
6. Send a test WhatsApp message to the registered number.

**Environment variables checklist:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `WHATSAPP_API_URL` / `WHATSAPP_API_KEY` / `WHATSAPP_WEBHOOK_VERIFY_TOKEN` / `WHATSAPP_APP_SECRET`
- `AUTH_SECRET` / `ADMIN_EMAIL` / `ADMIN_PASSWORD`
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`
- `SENTRY_DSN` / `SENTRY_AUTH_TOKEN`

---

### ✅ 7.2 Supabase `whatsapp_number` Column Verification

**Files:** `supabase/migrations/` (may need new migration)
**Complexity:** S

The multi-club routing added in Task 7 queries `clubs.whatsapp_number`. Verify this column exists in the live schema. If not, create a migration:
```sql
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;
CREATE INDEX IF NOT EXISTS clubs_whatsapp_number_idx ON clubs (whatsapp_number);
```

Run `npm run db:push` to apply.

---

### ✅ 7.3 Conversation Session TTL / Reset

**Files:** `lib/agent/conversation.ts`, `app/api/conversations/` (or new endpoint)
**Complexity:** M

Conversations currently grow indefinitely. Long-lived conversations have two problems:
1. History is capped at 20 messages (`MAX_HISTORY`) but the DB record never closes.
2. Players who return weeks later are greeted with stale context.

Add a `last_message_at` column to `conversations`. If the last message is older than N days (e.g. 7), treat it as a new conversation (insert a fresh record) rather than continuing the old one.

Also add a player-facing reset command: if a message is exactly "RESET" or "START OVER", clear the active conversation and start fresh.

---

## Priority 8 — Multi-Turn Context Fix

### ✅ 8.1 Tool Result Persistence in Message History

**Files:** `lib/agent/conversation.ts`, `supabase/migrations/`
**Complexity:** L

**Current issue:** Intermediate tool-call messages are filtered from LLM history on load because the Anthropic API requires `tool_use` blocks to pair with `tool_result` blocks — but we only store the plain text summary. On a follow-up turn in a new session, the agent has no memory of tool results.

**Correct fix:**
1. Add a `tool_use_block` JSONB column to `messages` to store the full Anthropic `tool_use` content block alongside each ASSISTANT tool-calling message.
2. On history load, reconstruct the proper Anthropic format: `{ role: "assistant", content: [toolUseBlock] }` + `{ role: "user", content: [toolResultBlock] }`.
3. Remove the current filter that drops TOOL and intermediate ASSISTANT messages.

This is a significant refactor of the message schema and agent loop. The current fallback (agent infers from its own final replies) is acceptable for MVP but will cause issues in complex multi-step bookings across sessions.

---

## Priority 9 — Growth & Billing

### 9.1 Stripe Billing Integration

**Files:** `app/api/stripe/` (create), `app/(dashboard)/billing/` (create), Supabase `clubs` table
**Complexity:** L

Without billing, the product is free. Implement before growing beyond 2–3 test clubs.

Steps:
1. `npm install stripe`
2. Create Stripe products: Starter (€99/mo), Growth (€199/mo)
3. Webhook: `POST /api/stripe/webhook` to handle `customer.subscription.created/updated/deleted`
4. Gate `is_active` on clubs: set to `false` when subscription lapses
5. Add a `/billing` dashboard page showing plan, next billing date, and an upgrade link
6. Add `stripe_customer_id` and `stripe_subscription_id` to the `clubs` table

---

### 9.2 Club Self-Serve Onboarding

**Files:** `app/(dashboard)/onboarding/` (create), `app/api/clubs/` (extend)
**Complexity:** L

Currently onboarding a new club requires manual DB setup and developer intervention. Self-serve onboarding removes this bottleneck.

Minimum viable flow:
1. Club admin visits `/onboarding`
2. Enters club name, WhatsApp number, booking platform + credentials, court list, operating hours
3. App creates the `clubs` record, validates booking credentials, and shows the webhook URL to register with 360dialog
4. Club is active and ready

Gate behind Stripe: only allow onboarding if payment is set up (or use a free trial period).

---

## Deferred (Low Priority)

These are tracked for future phases but should not block launch:

- **5.2 Multi-Turn Tool Context** — see Priority 8 above for the full fix
- **5.3 Player Name Persistence** — already works; no action needed
- **Playtomic official API** — current adapter is reverse-engineered; apply for official partnership when volume justifies it
- **Analytics dashboard** — booking volume, peak hours, common requests (post-launch)
- **WhatsApp template messages** — proactive booking reminders via HSM templates (requires Meta approval)
- **Multi-language support** — detect player language and respond in kind

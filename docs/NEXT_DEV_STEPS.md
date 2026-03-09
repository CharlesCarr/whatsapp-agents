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
- [x] **5.2 Multi-Turn Tool Context** — `tool_use_block` JSONB column on `messages`; history loader reconstructs proper `tool_use` + `tool_result` pairs instead of filtering them out

### Priority 6 — Production Hardening
- [x] **6.1 Webhook Idempotency** — Redis `SET NX EX 86400` on `wa:msg:<messageId>` deduplicates redelivered webhooks; graceful no-op without Redis
- [x] **6.2 Sentry Source Maps** — `withSentryConfig()` in `next.config.ts`; `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` documented in `.env.example`
- [x] **6.4 Structured Logging** — `lib/logger.ts` JSON wrapper (`log.info/warn/error`); replaces all `console.*` in webhook handler, agent loop, and WhatsApp client
- [x] **6.5 Health Check Endpoint** — `GET /api/health` pings Supabase; returns `200 {status:"ok"}` or `503 {status:"error"}` for uptime monitors
- [x] **6.6 WhatsApp Opt-Out Handling** — STOP/UNSUBSCRIBE sets `opted_out_at`, sends unsubscribe reply, silently drops future messages (Meta policy); START/YES re-subscribes

### Priority 7 — Schema & Deployment Prep
- [x] **7.2 Supabase `whatsapp_number` Column** — Column exists in initial migration; verified
- [x] **7.3 Conversation Session TTL + RESET** — 7-day idle expiry clears message history; RESET/START OVER command deletes messages and resets `last_message_at`

---

## Remaining Tasks

Ordered by business risk. Tasks marked **[BLOCKER]** must be done before the first paying club goes live.

---

## Priority 6 — Production Hardening

### 6.3 Upstash Redis Provisioning `[BLOCKER]`

**Files:** `.env.local` / Vercel env vars
**Complexity:** S (ops only — no code changes needed)

Rate limiting and webhook idempotency are implemented but disabled until the env vars are set. Without Redis, a single player can flood the agent and exhaust Anthropic API credits, and duplicate webhook deliveries will double-process messages.

Steps:
1. Create a free Upstash Redis database at console.upstash.com
2. Copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
3. Add both to Vercel env vars (and `.env.local` for local testing)
4. Verify rate limiting: send 21+ rapid requests to `POST /api/webhooks/whatsapp` and confirm the 22nd returns 429
5. Verify idempotency: replay a webhook with a duplicate `messageId` and confirm the second is silently dropped

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
7. Run `npm run db:push` to apply the 3 new migrations (`opted_out_at`, `last_message_at`, `tool_use_block`).

**Environment variables checklist:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `WHATSAPP_API_URL` / `WHATSAPP_API_KEY` / `WHATSAPP_WEBHOOK_VERIFY_TOKEN` / `WHATSAPP_APP_SECRET`
- `AUTH_SECRET` / `ADMIN_EMAIL` / `ADMIN_PASSWORD`
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`
- `SENTRY_DSN` / `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN`

---

## Priority 8 — Growth & Billing

### 8.1 Stripe Billing Integration

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

### 8.2 Club Self-Serve Onboarding

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

- **5.3 Player Name Persistence** — already works; no action needed
- **Playtomic official API** — current adapter is reverse-engineered; apply for official partnership when volume justifies it
- **Analytics dashboard** — booking volume, peak hours, common requests (post-launch)
- **WhatsApp template messages** — proactive booking reminders via HSM templates (requires Meta approval)
- **Multi-language support** — detect player language and respond in kind

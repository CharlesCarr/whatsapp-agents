# Next Development Steps

Prioritized near-term tasks ordered by business risk. Complete Priority 1 before any real club goes live.

---

## Priority 1 — Security & Stability

These are blockers for production use. Do not onboard paying clubs without these.

### 1.1 Dashboard Authentication

**Affected files:** `app/(dashboard)/layout.tsx` (create), `middleware.ts` (create)
**Complexity:** M

The dashboard has no auth. Any visitor can read all club configs (including booking API keys), view all player conversations, and modify club settings.

Recommended: **Clerk** (simpler setup than NextAuth beta, good Next.js App Router support).

Steps:
1. `npm install @clerk/nextjs`
2. Wrap `app/(dashboard)/layout.tsx` with `ClerkProvider` and add a `SignIn` redirect
3. Add `middleware.ts` with `authMiddleware({ publicRoutes: ["/api/webhooks/whatsapp"] })`
4. Add `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` to `.env.local`

Alternative: NextAuth v5 (beta) with a credentials provider against a hardcoded admin email/password env var — simpler but less scalable.

---

### 1.2 `.env.example` File

**Affected files:** `.env.example` (create)
**Complexity:** S

No `.env.example` exists. New developers have no reference for required variables.

Create `.env.example` with all keys and placeholder values:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ANTHROPIC_API_KEY=sk-ant-...
WHATSAPP_API_URL=https://waba.360dialog.io/v1
WHATSAPP_API_KEY=your-360dialog-api-key
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your-random-verify-token
```

---

### 1.3 Webhook Signature Verification

**Affected files:** `app/api/webhooks/whatsapp/route.ts`, `lib/whatsapp/client.ts`
**Complexity:** M

Currently any HTTP POST to `/api/webhooks/whatsapp` is processed. An attacker can inject arbitrary messages to the agent.

For 360dialog, verify the `X-Hub-Signature-256` header using HMAC-SHA256 of the raw request body with the app secret. For Meta Cloud API, same mechanism.

Implementation sketch in `lib/whatsapp/client.ts`:
```ts
export function verifySignature(body: string, signature: string, secret: string): boolean {
  const expected = "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
```

Call before `req.json()` in the POST handler. Return `403` on failure.

Add `WHATSAPP_APP_SECRET` to env vars.

---

### 1.4 Rate Limiting on Webhook Endpoint

**Affected files:** `middleware.ts` or `app/api/webhooks/whatsapp/route.ts`
**Complexity:** M

No rate limiting exists. A flood of messages (malicious or accidental) would exhaust Anthropic API credits.

Options:
- **Vercel Edge Middleware** with `@upstash/ratelimit` + Redis (recommended for Vercel deployments)
- Simple in-memory counter if single-instance (not suitable for serverless)

Suggested limit: 20 messages/minute per sender phone number.

---

## Priority 2 — Multi-Club Routing

### 2.1 Route DMs by WhatsApp Phone Number ID

**Affected files:** `app/api/webhooks/whatsapp/route.ts`, `lib/whatsapp/types.ts`
**Complexity:** M

Current `resolveClub()` for DMs returns the first active club regardless of which WhatsApp number received the message. This breaks with multiple clubs.

The 360dialog webhook payload includes `metadata.phone_number_id` on each message entry. This should match `clubs.whatsapp_number`.

Steps:
1. Extract `phone_number_id` from the webhook payload in `parseWebhook()` and include it in the parsed message object.
2. Update `resolveClub(senderPhone, groupId, receivingNumberId)` to first attempt:
   ```ts
   db.from("clubs").select("*").eq("whatsapp_number", receivingNumberId).eq("is_active", true).single()
   ```
3. Keep the first-active-club fallback only if `receivingNumberId` is not present (backwards compat for single-club setups).

---

## Priority 3 — Reliability

### 3.1 Error Monitoring

**Affected files:** `instrumentation.ts` (create), all route handlers
**Complexity:** M

Errors currently log to `console.error` only. In production this means silent failures.

Recommended: **Sentry** with Next.js SDK.
```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

Add `SENTRY_DSN` to env. All uncaught exceptions and edge cases in the agent loop will be captured automatically.

---

### 3.2 Dead-Letter Logging for Failed Agent Runs

**Affected files:** `app/api/webhooks/whatsapp/route.ts`
**Complexity:** S

When `runAgent()` throws, the error is logged but the player receives no response. Add a catch that sends a fallback WhatsApp message ("Sorry, something went wrong...") and logs the failure to a `errors` table or Sentry.

---

### 3.3 Retry Logic for WhatsApp Send Failures

**Affected files:** `lib/whatsapp/client.ts`
**Complexity:** S

`sendWhatsAppMessage()` has no retry. Network blips cause silent message drops.

Wrap with a simple exponential backoff retry (2–3 attempts, 500ms base delay). Use `p-retry` or a small inline implementation.

---

### 3.4 Production Deployment Guide

**Affected files:** `docs/CLIENT_IMPLEMENTATION.md` (already covers this)
**Complexity:** S

Vercel is the simplest deploy target. Ensure all env vars are set in the Vercel dashboard (not committed). See `CLIENT_IMPLEMENTATION.md` Step 7 for full checklist.

---

## Priority 4 — Developer Experience

### 4.1 Test Suite

**Affected files:** `__tests__/` (create), `vitest.config.ts` (create)
**Complexity:** L

No tests exist. Key units to cover:

| Unit | Test Focus |
|---|---|
| `lib/agent/conversation.ts` | History filtering logic; tool iteration cap |
| `lib/agent/tools.ts` | Each tool case; error handling path |
| `lib/booking/adapters/mock.ts` | Full BookingProvider contract |
| `lib/whatsapp/client.ts` | `parseWebhook()` with fixture payloads |
| `app/api/webhooks/whatsapp/route.ts` | `resolveClub()` logic with mock DB |

Recommended: **Vitest** (fast, native ESM, good TypeScript support).

```bash
npm install -D vitest @vitest/coverage-v8
```

---

### 4.2 CI Pipeline

**Affected files:** `.github/workflows/ci.yml` (create)
**Complexity:** S

```yaml
name: CI
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run lint
      - run: npx tsc --noEmit
      - run: npm test
```

---

### 4.3 Seed Script

**Affected files:** `scripts/seed.ts` (create), `package.json`
**Complexity:** S

Add `npm run seed` to insert a demo club with mock `booking_config` so developers can run the app locally without manual database setup. Use the `MockAdapter` platform.

---

## Priority 5 — Conversation Quality

### 5.1 Support Image / Document Message Types

**Affected files:** `lib/whatsapp/client.ts`, `lib/whatsapp/types.ts`
**Complexity:** M

Non-text messages (images, documents, voice notes) are currently silently skipped by `parseWebhook()`. Players who send a voice note get no response, which feels broken.

At minimum: detect the message type and send a polite "I can only handle text messages for now. Please type your request." response.

---

### 5.2 Multi-Turn Context — Tool Result Preservation

**Affected files:** `lib/agent/conversation.ts`
**Complexity:** L

Intermediate tool-call messages are filtered out of the LLM context when loading history (`m.role === Role.TOOL` → excluded). This means that in a follow-up conversation turn, the agent has no memory of tool results from a previous session.

The correct long-term fix is to store the full Anthropic-format tool_use + tool_result message pairs in a structured column, and reconstruct them on load. This is a significant refactor of the message schema and agent loop.

Short-term: the final ASSISTANT message already contains the booking outcome (reference, court, time), so the agent can read its own prior responses and infer context.

---

### 5.3 Player Name Persistence

**Affected files:** `lib/agent/conversation.ts`
**Complexity:** S (mostly done)

Player name is already stored in `conversations.player_name` and passed to `buildSystemPrompt()`. The one gap: if the player's name comes from the WhatsApp sender profile (`msg.senderName`) but the conversation already exists with `player_name = null`, it is updated on the next message. This is correct behaviour. No action needed unless explicit opt-in/opt-out is required.

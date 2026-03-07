# Client Implementation Guide

Step-by-step guide to onboarding a new padel club — from zero to live on WhatsApp.

---

## Prerequisites

Before starting, ensure you have:

- A **WhatsApp Business Account (WABA)** registered via [360dialog](https://www.360dialog.com/). 360dialog will provide your API key and webhook URL configuration panel.
- A **booking platform account** with API access:
  - CourtReserve: API key + organization ID (from CourtReserve admin panel)
  - Playtomic: Club manager email + password + tenant ID
  - Custom platform: base URL and any auth headers
- Access to your **Supabase project** (shared instance or a dedicated project for this club)
- Node.js 18+ and npm installed locally

---

## Step 1: Environment Setup

```bash
git clone <repo-url> whatsapp-agents
cd whatsapp-agents
npm install
cp .env.example .env.local
```

Edit `.env.local` and fill in all values:

| Variable | Description | Example |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | `https://abcdef.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key — Settings > API in Supabase dashboard. **Keep secret.** | `eyJhbGci...` |
| `ANTHROPIC_API_KEY` | Anthropic API key from console.anthropic.com | `sk-ant-api03-...` |
| `WHATSAPP_API_URL` | 360dialog API base URL | `https://waba.360dialog.io/v1` |
| `WHATSAPP_API_KEY` | 360dialog API key for this WABA | `your-360dialog-key` |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | A random string you choose — used to verify the webhook handshake | `my-secret-token-123` |

---

## Step 2: Database Setup

**Option A — Supabase SQL Editor (recommended for first setup):**

1. Open your Supabase project → Database → SQL Editor → New query
2. Paste the full contents of `lib/db/schema.sql` and run it
3. Verify the 5 tables were created: `clubs`, `whatsapp_groups`, `conversations`, `messages`, `booking_activity`

**Option B — CLI (if Supabase CLI is installed and project is linked):**

```bash
npm run db:push
```

After any schema change, regenerate TypeScript types:

```bash
npm run db:types
```

This updates `lib/db/database.types.ts` with the latest column types.

---

## Step 3: Create the Club Record

### Via the Dashboard (recommended)

1. Start the app: `npm run dev`
2. Open `http://localhost:3000/clubs`
3. Click **Add Club**
4. Fill in the form — see the `booking_config` and `agent_config` reference at the bottom of this guide

### Via API

```bash
curl -X POST http://localhost:3000/api/clubs \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Padel Club Madrid",
    "slug": "padel-madrid",
    "whatsapp_number": "34612345678",
    "booking_platform": "COURTRESERVE",
    "booking_config": {
      "apiKey": "cr-live-abc123",
      "organizationId": "org-456"
    },
    "agent_config": {
      "courtNames": ["Court 1", "Court 2", "Court 3", "Court 4"],
      "operatingHours": "8:00 AM – 10:00 PM",
      "clubTone": "friendly and concise"
    }
  }'
```

**Example payloads by platform:**

CourtReserve:
```json
{
  "booking_platform": "COURTRESERVE",
  "booking_config": {
    "apiKey": "cr-live-abc123",
    "organizationId": "org-456",
    "baseUrl": "https://api.courtreserve.com/api"
  }
}
```

Playtomic:
```json
{
  "booking_platform": "PLAYTOMIC",
  "booking_config": {
    "email": "manager@myclubpadel.com",
    "password": "securepassword",
    "tenantId": "tenant-789"
  }
}
```

Custom REST API:
```json
{
  "booking_platform": "CUSTOM",
  "booking_config": {
    "baseUrl": "https://api.mybookingsystem.com/v1",
    "apiKey": "my-api-key",
    "headers": {
      "X-Club-Id": "club-123"
    },
    "fieldMapping": {
      "slotId": "openingId",
      "courtName": "resourceName",
      "startTime": "from",
      "endTime": "to",
      "reference": "confirmationCode"
    }
  }
}
```

Mock (local testing only):
```json
{
  "booking_platform": "CUSTOM",
  "booking_config": {
    "mock": true
  }
}
```

---

## Step 4: Link WhatsApp Groups (for group bookings)

If the club has a WhatsApp group where players ask for bookings:

1. Get the group's **JID** from the 360dialog dashboard (format: `120363xxxxxxx@g.us`)
2. Find the club's `id` from the dashboard or `GET /api/clubs`
3. Link the group:

```bash
curl -X POST http://localhost:3000/api/clubs/{CLUB_ID}/groups \
  -H "Content-Type: application/json" \
  -d '{ "group_id": "120363012345678@g.us" }'
```

You can link multiple groups to the same club. Each group message will be routed to the correct club automatically.

**Direct messages (DMs):** In a single-club setup, DMs automatically route to the first active club. In multi-club setups, routing uses `clubs.whatsapp_number` matched to the receiving WhatsApp number ID from the webhook payload.

---

## Step 5: Configure the WhatsApp Webhook

### Local Development (using ngrok)

1. Start the app: `npm run dev`
2. In a separate terminal: `ngrok http 3000`
3. Copy the HTTPS forwarding URL (e.g. `https://abc123.ngrok.io`)
4. In the 360dialog dashboard:
   - Go to your WABA → Webhooks
   - Set the webhook URL to: `https://abc123.ngrok.io/api/webhooks/whatsapp`
   - Set the verify token to match your `WHATSAPP_WEBHOOK_VERIFY_TOKEN` env var
5. Save — 360dialog will send a GET request to verify. The app responds automatically.

### Production

Replace the ngrok URL with your production domain (see Step 7).

---

## Step 6: Test the Agent

**Via the dashboard test simulator:**

1. Open `http://localhost:3000/test`
2. Select the club from the dropdown
3. Enter a test player name
4. Type: `"What courts are available tomorrow?"`
5. The agent should respond with availability (or a mock response if using the Mock adapter)

**Verify the results:**

- Open `http://localhost:3000/conversations` — you should see a new conversation
- Click the conversation to see the message thread including any tool calls
- Open `http://localhost:3000/activity` — if a booking was made, it should appear here

**Via curl (direct agent API):**

```bash
curl -X POST http://localhost:3000/api/agent \
  -H "Content-Type: application/json" \
  -d '{
    "clubId": "YOUR_CLUB_ID",
    "waContactId": "34699000001",
    "incomingText": "Is Court 1 free tomorrow at 6pm?",
    "playerName": "Carlos"
  }'
```

---

## Step 7: Go Live

1. **Deploy to Vercel:**
   ```bash
   npm install -g vercel
   vercel --prod
   ```
   Or connect the GitHub repo in the Vercel dashboard for automatic deploys.

2. **Set environment variables in Vercel:**
   - Go to Vercel dashboard → Project → Settings → Environment Variables
   - Add all variables from `.env.local` (do **not** commit `.env.local` to git)

3. **Update the 360dialog webhook URL:**
   - Replace the ngrok URL with your production Vercel URL:
     `https://your-app.vercel.app/api/webhooks/whatsapp`

4. **Verify the webhook:**
   - In the 360dialog dashboard, click "Verify webhook"
   - You should see a 200 OK response

5. **Run a production end-to-end test:**
   - Send a WhatsApp message to the club's number from a real phone
   - Confirm the agent responds within a few seconds
   - Check `/conversations` in the dashboard to see the exchange logged

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| Agent returns "Sorry, I wasn't able to process that" | Anthropic API error or club not found | Check `ANTHROPIC_API_KEY` is valid; verify club `id` and `is_active = true` |
| Webhook not receiving messages | Wrong URL or verify token mismatch | Re-check the URL in 360dialog; confirm `WHATSAPP_WEBHOOK_VERIFY_TOKEN` matches |
| Bookings failing | Bad `booking_config` JSON | Test the booking adapter directly via `POST /api/agent`; check logs for the specific error |
| "Club not found" in webhook logs | Group not linked, or DM routing fallback returned null | Ensure `whatsapp_groups.group_id` matches the group JID exactly; or check a club is `is_active = true` |
| No response sent to player | `sendWhatsAppMessage` failed | Check `WHATSAPP_API_URL` and `WHATSAPP_API_KEY` are correct and the WABA is approved |
| TypeScript errors after schema change | `database.types.ts` is stale | Run `npm run db:types` to regenerate |
| Webhook returns 403 on verification | Token mismatch | Double-check `WHATSAPP_WEBHOOK_VERIFY_TOKEN` matches what you set in 360dialog |

---

## `booking_config` Reference

### CourtReserve

```json
{
  "apiKey": "string — Bearer token for CourtReserve API",
  "organizationId": "string — your organization ID in CourtReserve",
  "baseUrl": "string (optional) — defaults to https://api.courtreserve.com/api"
}
```

### Playtomic

```json
{
  "email": "string — club manager login email",
  "password": "string — club manager login password",
  "tenantId": "string — Playtomic club/tenant ID"
}
```

Note: Playtomic uses a reverse-engineered mobile API. This may break if Playtomic changes their endpoints. Treat as provisional.

### Custom REST API

```json
{
  "baseUrl": "string — base URL of your booking API",
  "apiKey": "string (optional) — added as Bearer token in Authorization header",
  "headers": {
    "X-Custom-Header": "value"
  },
  "fieldMapping": {
    "slotId": "your API's field name for slot ID",
    "courtId": "your API's field name for court ID",
    "courtName": "your API's field name for court name",
    "date": "your API's field name for date",
    "startTime": "your API's field name for start time",
    "endTime": "your API's field name for end time",
    "available": "your API's field name for availability flag",
    "bookingId": "your API's field name for booking ID",
    "reference": "your API's field name for booking reference/confirmation number",
    "status": "your API's field name for booking status"
  }
}
```

All `fieldMapping` values are optional — if omitted, the adapter looks for the standard field name (e.g. `id`, `courtName`, `startTime`).

The Custom adapter expects:
- `GET {baseUrl}/availability?date=YYYY-MM-DD[&courtId=...][&timeFrom=HH:MM][&timeTo=HH:MM]` → array of slot objects
- `POST {baseUrl}/bookings` with `{ slotId, playerName, playerPhone }` → booking object
- `POST {baseUrl}/bookings/{id}/cancel` → 200 OK
- `GET {baseUrl}/bookings?playerPhone={phone}` → array of booking objects

### Mock (Testing Only)

```json
{
  "mock": true
}
```

Returns realistic fake data. Use during development before connecting a real booking system.

---

## `agent_config` Reference

```json
{
  "courtNames": ["Court 1", "Court 2", "Court 3"],
  "operatingHours": "8:00 AM – 10:00 PM",
  "clubTone": "friendly and concise",
  "systemPromptOverride": "..."
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `courtNames` | `string[]` | `["the courts"]` | List of court names shown to players and used by the agent when listing availability |
| `operatingHours` | `string` | `"6:00 AM – 10:00 PM"` | Displayed in the system prompt so the agent knows the club's hours |
| `clubTone` | `string` | `"friendly and concise"` | Instruction to the agent about communication style (e.g. `"formal"`, `"casual and upbeat"`) |
| `systemPromptOverride` | `string` | — | If set, replaces the entire auto-generated system prompt. Use for full control over agent persona. Receives no automatic injection of court names, hours, or tone — include everything manually. |

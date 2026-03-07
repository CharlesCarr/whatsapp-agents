# Current State — WhatsApp Padel Agents

> Last updated: March 2026

---

## Product Overview

WhatsApp Padel Agents is a SaaS product that lets padel club players book courts via WhatsApp using a conversational AI agent. No app download required — players message the club's WhatsApp number and the AI handles availability checks, bookings, and cancellations in natural language.

**Business model:** Clubs pay a monthly subscription. The agent integrates with their existing booking platform (CourtReserve, Playtomic, or a custom REST API), so no migration required.

**Target customer:** Independent padel clubs and small chains (5–50 courts) in Europe and LATAM who currently manage bookings via phone or WhatsApp groups manually.

---

## Architecture

```
Player (WhatsApp)
      |
      | (message)
      v
360dialog BSP  ──POST──>  /api/webhooks/whatsapp
                                    |
                           resolveClub() — matches group or DM to a club record
                                    |
                           runAgent() — agentic loop (max 5 tool iterations)
                                    |
                      ┌─────────────┴─────────────┐
                      |                           |
               Claude Sonnet 4.6           BookingProvider
               (conversation + reasoning)   (CourtReserve / Playtomic / Custom)
                      |
                      v
              response text sent back to player via sendWhatsAppMessage()
                      |
              all messages + booking_activity stored in Supabase (PostgreSQL)
```

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Framework | Next.js (App Router) | No `src/` dir, TypeScript strict |
| Language | TypeScript | Strict mode enabled |
| Database | Supabase (PostgreSQL) | Service role key only on server; typed via generated `database.types.ts` |
| ORM/Client | `@supabase/supabase-js` v2 | No Prisma |
| LLM | Claude Sonnet 4.6 (`claude-sonnet-4-6`) | Via `@anthropic-ai/sdk` |
| Validation | Zod v4 | `z.record(z.string(), z.unknown())` pattern |
| Styling | Tailwind CSS v4 | Dashboard UI |
| WhatsApp BSP | 360dialog | Webhook-based; Meta Cloud API planned |

---

## Database Schema

### Enums

| Enum | Values |
|---|---|
| `booking_platform` | `COURTRESERVE`, `PLAYTOMIC`, `CUSTOM` |
| `message_role` | `USER`, `ASSISTANT`, `TOOL` |

### Tables

#### `clubs`
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID as text |
| `name` | TEXT | Display name |
| `slug` | TEXT UNIQUE | URL-safe identifier |
| `whatsapp_number` | TEXT UNIQUE | The club's WhatsApp number (for multi-club routing) |
| `booking_platform` | booking_platform | Enum |
| `booking_config` | JSONB | Platform-specific config (API keys, org IDs, etc.) |
| `agent_config` | JSONB | Court names, hours, tone, optional system prompt override |
| `is_active` | BOOLEAN | Soft-disable without deletion |
| `created_at` / `updated_at` | TIMESTAMPTZ | Auto-managed |

#### `whatsapp_groups`
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID as text |
| `group_id` | TEXT UNIQUE | WhatsApp JID of the group |
| `club_id` | TEXT FK → clubs | Cascade delete |

#### `conversations`
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID as text |
| `club_id` | TEXT FK → clubs | |
| `wa_contact_id` | TEXT | Player's WhatsApp phone number |
| `wa_group_id` | TEXT | Nullable — group context if applicable |
| `player_name` | TEXT | Nullable — populated once known |
| Unique | `(club_id, wa_contact_id, wa_group_id)` | `NULLS NOT DISTINCT` |

#### `messages`
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `conversation_id` | TEXT FK → conversations | Cascade delete |
| `role` | message_role | USER, ASSISTANT, or TOOL |
| `content` | TEXT | Message body |
| `tool_name` | TEXT | Nullable — set for TOOL messages |
| `tool_call_id` | TEXT | Nullable — Anthropic tool call correlation ID |
| `metadata` | JSONB | Nullable — stores `toolCalls` array for intermediate ASSISTANT messages |

#### `booking_activity`
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `club_id` | TEXT | |
| `conversation_id` | TEXT | |
| `wa_contact_id` | TEXT | Player phone |
| `player_name` | TEXT | Nullable |
| `action` | TEXT | `BOOKED`, `CANCELLED`, or `CHECKED` |
| `booking_ref` | TEXT | Nullable — booking confirmation reference |
| `court_name` | TEXT | Nullable |
| `slot_date` / `slot_time` | TEXT | Nullable |
| `metadata` | JSONB | Nullable |

---

## API Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/webhooks/whatsapp` | 360dialog webhook verification (hub challenge-response) |
| POST | `/api/webhooks/whatsapp` | Incoming WhatsApp messages — triggers agent |
| GET | `/api/clubs` | List all clubs |
| POST | `/api/clubs` | Create a new club |
| GET | `/api/clubs/[id]` | Get a single club |
| PATCH | `/api/clubs/[id]` | Update a club |
| DELETE | `/api/clubs/[id]` | Delete a club |
| POST | `/api/clubs/[id]/groups` | Link a WhatsApp group to a club |
| GET | `/api/conversations` | List conversations (optionally filtered by club) |
| GET | `/api/conversations/[id]` | Get a conversation with its messages |
| GET | `/api/activity` | List booking activity (optionally filtered by club) |
| POST | `/api/agent` | Debug endpoint — run the agent directly without WhatsApp |

---

## Agent System

### Loop Behavior (`lib/agent/conversation.ts`)

1. Load or create a `conversation` record for `(club_id, wa_contact_id, wa_group_id)`.
2. Persist the incoming user message as a `USER` role message.
3. Load the last 20 messages from DB, filtering out `TOOL` messages and intermediate `ASSISTANT` messages (those with `metadata.toolCalls`) — these can't be reconstructed into valid Anthropic tool_use/tool_result pairs.
4. Enter the agentic loop (max **5 iterations**):
   - Call Claude with the message history, system prompt, and 4 booking tools.
   - If `stop_reason === "tool_use"`, execute each tool, persist tool messages, append to LLM context, and loop.
   - Otherwise, break and return the final text response.
5. Persist the final `ASSISTANT` message to DB.
6. Return the response text to the webhook handler, which sends it via WhatsApp.

### System Prompt

Built dynamically per request (`buildSystemPrompt()`):
- Injects today's date, day of week, court names, operating hours, and tone from `agent_config`
- Includes the player's name if known, or instructs the agent to ask
- Can be fully overridden via `agent_config.systemPromptOverride`

### Tools (`lib/agent/tools.ts`)

| Tool | Description | Required Input |
|---|---|---|
| `check_availability` | Returns open slots for a given date | `date` (YYYY-MM-DD); optional: `time_from`, `time_to`, `court_id` |
| `create_booking` | Books a slot and logs to `booking_activity` | `slot_id`, `player_name` |
| `cancel_booking` | Cancels a booking by reference and logs to `booking_activity` | `booking_reference` |
| `get_player_bookings` | Returns all upcoming bookings for the player's phone | none |

---

## Booking Integrations (`lib/booking/`)

| Platform | Adapter | Status | Config Fields |
|---|---|---|---|
| CourtReserve | `CourtReserveAdapter` | Full REST API | `apiKey`, `organizationId`, `baseUrl?` |
| Playtomic | `PlaytomicAdapter` | Reverse-engineered mobile API | `email`, `password`, `tenantId` |
| Custom | `CustomAdapter` | Generic REST with field mapping | `baseUrl`, `apiKey?`, `headers?`, `fieldMapping?` |
| Mock | `MockAdapter` | In-memory stub for testing | `mock: true` |

All adapters implement the `BookingProvider` interface (`lib/booking/interface.ts`): `getAvailability`, `createBooking`, `cancelBooking`, `getBookingsByPlayer`.

Factory at `lib/booking/factory.ts` selects the correct adapter from `club.booking_platform` and `club.booking_config`.

---

## Dashboard Pages (`app/(dashboard)/`)

| Route | Page | Description |
|---|---|---|
| `/clubs` | Clubs list | View, create, edit clubs. `ClubForm.tsx` handles the JSONB config fields. |
| `/conversations` | Conversations | List all conversations; click to view message thread via `ConversationMessages.tsx` |
| `/activity` | Activity feed | Chronological log of all `BOOKED`, `CANCELLED`, and `CHECKED` actions across clubs |
| `/test` | Test simulator | Send messages to the agent directly (via `POST /api/agent`) without WhatsApp |

The dashboard root (`/`) redirects to `/clubs`.

---

## WhatsApp Integration (`lib/whatsapp/`)

- **BSP:** 360dialog (currently), Meta Cloud API (planned)
- **Webhook verification:** `GET /api/webhooks/whatsapp` responds to `hub.mode=subscribe` challenge using `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
- **Incoming message parsing:** `parseWebhook()` in `lib/whatsapp/client.ts` normalises the 360dialog payload into `{ from, text, senderName, groupId }` objects
- **Outbound messages:** `sendWhatsAppMessage(to, text)` calls the 360dialog REST API with `WHATSAPP_API_URL` + `WHATSAPP_API_KEY`
- **Acknowledgement pattern:** The POST handler returns `200 OK` immediately; message processing runs in a detached async call to satisfy WhatsApp's 5-second response requirement

---

## Known Limitations / Gaps

| Area | Limitation |
|---|---|
| **Auth** | No authentication on the dashboard — any visitor can access `/clubs`, `/conversations`, `/activity` |
| **DM routing** | Direct messages fall back to the first active club ordered by `created_at`. Multi-club DM routing requires matching `metadata.phone_number_id` from the webhook to `clubs.whatsapp_number` (TODO comment in `route.ts:78`) |
| **Playtomic** | Uses reverse-engineered mobile API endpoints. No official partnership or stable contract. Subject to breakage. |
| **Billing** | No Stripe integration; no subscription or usage tracking |
| **Onboarding** | No self-serve onboarding flow; clubs must be created manually via dashboard or API |
| **Webhook security** | No HMAC signature verification on incoming webhooks — any POST to the endpoint is processed |
| **Rate limiting** | No rate limiting on the webhook endpoint |
| **Error monitoring** | No Sentry or equivalent; errors log to console only |
| **Message types** | Only text messages are processed; images, documents, and voice notes are silently skipped |
| **History filtering** | Intermediate tool-call messages are dropped from LLM context on reload; tool result context is only preserved within a single agent run |

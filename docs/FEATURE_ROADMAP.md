# Feature Roadmap

Medium-to-long-term product vision organized by theme. Items within each phase are roughly ordered by priority but not strictly sequential.

For near-term tactical tasks, see `NEXT_DEV_STEPS.md`.

---

## Phase 1 — Core SaaS Infrastructure

*Prerequisite to selling the product at scale.*

### Stripe Billing

Per-club monthly subscription with usage-based tier enforcement.

- Integrate Stripe Billing with three plan tiers (see `GO_TO_MARKET.md` for suggested pricing)
- Webhook handler for `customer.subscription.updated` / `deleted` to toggle `clubs.is_active`
- Usage metering: track bookings processed per billing period against tier limits
- Customer portal link for clubs to manage payment details

### Self-Serve Club Onboarding

Replace the current manual setup flow with a web form that provisions everything automatically.

- Public-facing signup form: club name, WhatsApp number, booking platform, API credentials
- On submit: create club record, send confirmation email, return dashboard link
- Guided setup wizard (7 steps matching `CLIENT_IMPLEMENTATION.md`) with inline validation
- Stripe Checkout integration at the end of onboarding

### Club Admin Portal

Give clubs a self-managed view separate from the internal operator dashboard.

- Club-specific login (Clerk organization or simple magic link)
- Edit agent config: court names, operating hours, tone, system prompt
- View their own conversations and activity feed (scoped to their club_id)
- Connect/disconnect booking platform

### Multi-Language Agent

Configurable response language per club.

- Agent detects or is configured to respond in: Spanish, French, Arabic, Portuguese
- `agent_config.language` field drives a language instruction in the system prompt
- Court name and time format localization (e.g. 24h vs 12h)

---

## Phase 2 — Richer Booking Experiences

### Recurring Bookings

"Book Court 1 every Tuesday at 10am."

- Recurring booking intent detection in the agent
- Store recurring schedules in a new `recurring_bookings` table
- Scheduled job (cron or Supabase Edge Function) to auto-book each recurrence
- WhatsApp confirmation sent to player each time a recurrence is booked
- Cancel all / cancel next recurrence via WhatsApp

### Group / Doubles Booking

Link multiple players to a single court slot.

- `create_booking` tool extended to accept multiple player names/phones
- New `booking_players` join table linking a booking to multiple `wa_contact_id` values
- Each player receives a confirmation WhatsApp message
- Group chat context: one player books for the whole group

### Waitlist Management

Notify players automatically when a slot opens.

- `join_waitlist` tool added to the agent
- New `waitlist` table: `(club_id, slot_date, slot_time, court_id, wa_contact_id)`
- Booking cancellation webhook / polling triggers availability check for waitlisted players
- Auto-message the next player in queue; booking reserved for 10 minutes

### Booking Reminders

WhatsApp reminder 24 hours before a booking.

- Scheduled job queries `booking_activity` for bookings starting tomorrow
- `sendWhatsAppMessage()` sends a reminder to each player's `wa_contact_id`
- Reminder includes booking ref, court, time, and a "Reply CANCEL to cancel" shortcut
- Unsubscribe option via reply

### In-Chat Payment Collection

Collect court fees via WhatsApp before confirming booking.

- Generate Stripe Payment Link for the slot price
- Agent sends link in-chat: "To confirm your booking, please pay here: [link]"
- Stripe `checkout.session.completed` webhook triggers booking creation
- Payment status shown in club activity feed

---

## Phase 3 — Platform Expansion

### Playtomic Official API

Replace the reverse-engineered mobile API adapter with an official integration.

- Pursue Playtomic Partner Program or enterprise API agreement
- Update `PlaytomicAdapter` to use stable, documented endpoints
- Remove credential-based auth (email/password) in favour of OAuth or API key

### Additional Booking Platforms

Expand the `BookingProvider` ecosystem:

| Platform | Region | Notes |
|---|---|---|
| Sportigo | Spain/France | Popular in France |
| LigaPadel | Spain | Spanish padel federation system |
| Matchi | Nordics | Popular in Sweden, Finland |
| Resapadel | France | French market leader |

Each requires a new adapter in `lib/booking/adapters/` implementing the `BookingProvider` interface.

### Calendar Integrations

Let players sync bookings to their personal calendar.

- After booking, offer "Add to Google Calendar" link (via Google Calendar API)
- `.ics` file generation for Apple Calendar / Outlook
- `booking_activity` record enriched with calendar event ID for cancellation sync

### SMS Fallback Channel

Serve markets where WhatsApp penetration is lower.

- Abstract the messaging channel behind a `MessagingProvider` interface
- Twilio or Vonage SMS adapter
- Channel selection per club (`clubs.channel`: `whatsapp` | `sms`)
- Shared agent loop; only the send/receive layer changes

---

## Phase 4 — Analytics & Intelligence

### Club Analytics Dashboard

Help club operators understand their business through the agent's data.

- Booking volume by day / week / court
- Peak time heatmap (most popular slots)
- Cancellation rate and reasons (inferred from agent conversations)
- Court utilisation rate
- Built as new `/analytics` dashboard page with charts (Recharts or Chart.js)

### Player Behaviour Insights

- Frequent booker identification (top 10 players by booking count)
- Churn signals: players who previously booked regularly but have stopped
- First-time vs returning player ratio

### Revenue Reporting

- Revenue per court per month (requires price data from booking platform)
- Revenue trend vs prior period
- Export to CSV for accounting

### Agent Performance Metrics

Measure how well the AI is doing its job.

- Resolution rate: % of conversations that end with a `BOOKED` or `CANCELLED` action
- Average tool call depth per resolved conversation
- Average turns to first booking
- Fallback rate: % of conversations where agent returned an error or asked player to call the club

---

## Phase 5 — Network Effects

### Player-Facing Profiles

Build a persistent identity for players across clubs.

- Opt-in player profile: name, phone, booking history across all clubs
- "My bookings" command works across clubs the player has interacted with
- Profile privacy controls

### Club Discovery

Let players find nearby padel clubs via WhatsApp.

- Directory of participating clubs with WhatsApp numbers
- Location-based search: "Find padel clubs near Madrid"
- Referral flow: player shares a club's WhatsApp number from within a conversation

### Partner Integrations

Connect with the broader padel ecosystem.

- World Padel Tour / national federation ranking sync: display player's ranking in their profile
- Tournament registration via WhatsApp
- Equipment rental add-on at booking time (if club offers it)

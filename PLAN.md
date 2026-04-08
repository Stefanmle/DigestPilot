# DigestPilot — AI Message Digest & Reply Assistant

## Context

Building a SaaS product for clients who struggle to keep up with email (and eventually SMS). The app connects to their inboxes, sends AI summaries on a user-defined schedule, suggests replies, and lets them act on replies quickly. Over time, it learns their reply style and can auto-reply on their behalf.

**Product name:** DigestPilot (digestpilot.com)
**Tagline:** "Your messages, on autopilot."
**Business model:** Subscription with per-inbox pricing (with digest caps per tier). The owner uses one Anthropic API key and charges clients a markup via subscription.
**AI language:** Automatically matches the language of each email (Swedish, English, etc.).

---

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | Next.js 15 (App Router) | Full-stack, great DX, Vercel-native |
| Hosting | Vercel (Pro plan required) | Cron jobs, edge functions, 60s function timeout |
| Database | Supabase (Pro plan for production) | Auth, DB, row-level security. Free tier for dev only. |
| Auth | Supabase Auth (Google OAuth primary + email/password fallback) | Google sign-in recommended in v1, email+password as alternative. Microsoft sign-in added later. |
| UI | Tailwind CSS + shadcn/ui | Mobile-first, polished components |
| AI | Claude API (Sonnet for summarization + replies, Haiku for urgency classification) | Cost-effective, high quality |
| Email - Gmail | Gmail API (OAuth2, **read-only** scope in MVP) | Official, reliable. Read-only avoids Google's restricted-scope security audit. |
| Email - Microsoft | Microsoft Graph API (OAuth2) | Covers Outlook/365 (Phase 2) |
| Email - Other | IMAP/SMTP (Phase 3) | Any provider via IMAP (read) + SMTP (send) credentials |
| Payments | Stripe | Per-inbox billing, subscription management |
| Cron | Vercel Cron (every 15 min) | Identify users due for digest, fan out to per-user processing |
| Email Sending | Resend | Transactional digest emails |
| Error Tracking | Sentry (with Crons monitoring) | Errors, cron health, performance |
| PWA | next-pwa | "Add to home screen" for app-like mobile experience, no native app needed |
| Testing | Vitest + Playwright | Unit/integration + E2E |

---

## MVP Scope — What We Ship First

The MVP is deliberately constrained to get real users fast:

1. **Gmail read-only** — no sending replies through Gmail API. This avoids the `gmail.send` restricted scope, which requires a costly third-party security audit ($15K-75K) and weeks of Google review. Users act on replies via two paths: (a) **Quick reply from digest email** — "Reply with this" Gmail compose links directly in the email, one per email, pre-filled with the correct recipient, subject, and suggested reply. (b) **Edit & reply from dashboard** — for replies that need tweaking, a deep link opens the dashboard where users can edit the suggestion, then copy or open in Gmail. This delivers 90% of the value without the regulatory barrier.

2. **Simple schedule picker** — no cron expressions. Users pick times and days from a UI. Stored as simple time + days-of-week in the database. No cron parser library needed.

3. **"Digest now" button** — always available on the dashboard. Users can trigger an on-demand digest anytime, not just on schedule. Rate-limited to 5 per user per hour.

4. **Reply learning from day one** — after a user copies a suggested reply and sends it via their email client, we detect their actual sent reply on the next sync (read-only scope can read the sent folder). By matching sent emails back to digest threads via thread ID, we capture what we suggested vs. what they actually sent — no send scope needed. These patterns are used as few-shot examples to improve future suggestions.

5. **No Stripe in MVP** — first customers are invoiced manually or use a simple Stripe payment link. Full subscription management comes in Phase 3.

---

## Database Schema (Supabase/PostgreSQL)

```sql
-- Users
users (
  id uuid PK,
  email text,
  name text,
  timezone text DEFAULT 'Europe/Stockholm',
  consent_given_at timestamptz,    -- GDPR: when user consented to AI email processing
  consent_version text,            -- version of privacy policy/terms accepted
  created_at timestamptz
)

-- Connected email accounts (billable unit)
inboxes (
  id uuid PK,
  user_id uuid FK -> users,
  provider enum('gmail', 'microsoft', 'imap'),
  email_address text,
  access_token text,          -- encrypted at application level (AES-256-GCM)
  refresh_token text,         -- encrypted at application level (AES-256-GCM)
  token_key_version int DEFAULT 1, -- encryption key version for rotation support
  token_expires_at timestamptz,
  sync_cursor text,           -- provider-specific sync state (Gmail historyId, Graph deltaLink)
  sent_sync_cursor text,      -- sync state for sent folder (to detect user replies)
  last_synced_at timestamptz,
  is_active boolean DEFAULT true,
  auto_reply_enabled boolean DEFAULT false,  -- Phase 3
  created_at timestamptz,
  UNIQUE (user_id, email_address)
)

-- User-defined digest schedules (simple time + days, not cron expressions)
digest_schedules (
  id uuid PK,
  user_id uuid FK -> users,
  label text,                  -- e.g. "Morning digest", "End of day wrap-up"
  time time NOT NULL,          -- e.g. '08:00', '17:00'
  days int[] NOT NULL,         -- days of week: 0=Sun, 1=Mon, ..., 6=Sat. e.g. {1,2,3,4,5} for weekdays
  is_active boolean DEFAULT true,
  last_triggered_at timestamptz, -- for reliable deduplication (more robust than date-based checks)
  created_at timestamptz
)
-- Users can have multiple rows (e.g. one for 08:00 weekdays, one for 17:00 weekdays)
-- Presets in UI create the right rows automatically:
--   "Once daily (14:00)"    → 1 row: time=14:00, days={0,1,2,3,4,5,6}
--   "Twice daily"           → 2 rows: time=08:00 + time=17:00, days={0,1,2,3,4,5,6}
--   "Every morning"         → 1 row: time=08:00, days={0,1,2,3,4,5,6}
--   "Weekdays only"         → 1 row: time=08:00, days={1,2,3,4,5}
--   "Weekly Monday summary" → 1 row: time=09:00, days={1}
--   "Custom"                → user picks times + days via UI

-- Digests
digests (
  id uuid PK,
  user_id uuid FK -> users,
  schedule_id uuid FK -> digest_schedules NULL, -- NULL for on-demand digests
  status enum('queued', 'processing', 'completed', 'failed') DEFAULT 'queued',
  summary_html text,
  email_count int,
  error_message text,          -- populated on failure
  retry_count int DEFAULT 0,
  ai_cost_cents int,           -- track actual AI cost per digest for monitoring
  sent_at timestamptz,
  created_at timestamptz
)

-- Individual email threads in a digest
digest_emails (
  id uuid PK,
  digest_id uuid FK -> digests,
  inbox_id uuid FK -> inboxes,
  user_id uuid FK -> users,    -- denormalized for simpler/faster RLS policies
  external_id text,
  thread_id text NOT NULL,     -- required for reply matching (Gmail always provides this)
  from_name text,
  from_email text,
  subject text,
  body_preview text,           -- truncated to max 4000 chars before storage
  token_estimate int,          -- estimated token count for cost monitoring
  urgency enum('low', 'medium', 'high'),
  category text,
  ai_summary text,
  suggested_reply text,
  user_reply text,             -- actual reply detected from sent folder (NULL until matched)
  reply_matched_at timestamptz,-- when the sent-folder scan matched a reply to this email
  created_at timestamptz,
  UNIQUE (inbox_id, external_id)  -- prevent duplicate imports
)

-- Reply history for learning style (MVP — populated via sent-folder sync)
reply_patterns (
  id uuid PK,
  user_id uuid FK -> users,
  language text,               -- detected language (e.g. 'sv', 'en') for language-aware few-shot selection
  email_context_summary text,  -- AI-generated summary of incoming email (not full body)
  ai_suggestion text,
  user_reply text,
  was_edited boolean,
  created_at timestamptz
)
-- Retention: keep last 200 per user, prune older entries via scheduled job

-- Stripe subscription tracking (Phase 3)
subscriptions (
  id uuid PK,
  user_id uuid FK -> users,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan_tier enum('starter', 'pro', 'business'),
  inbox_count int,
  email_volume_limit int,      -- max emails processed per day across all inboxes
  digest_daily_limit int,      -- max digests per day (scheduled + on-demand combined)
  status enum('active', 'past_due', 'cancelled'),
  current_period_end timestamptz
)

-- Cron run log for monitoring
cron_runs (
  id uuid PK,
  started_at timestamptz,
  completed_at timestamptz,
  users_evaluated int,
  digests_queued int,
  digests_completed int,
  digests_failed int,
  total_ai_cost_cents int,
  error_message text
)
```

### Indexes

```sql
CREATE INDEX idx_digest_emails_thread ON digest_emails(thread_id);
CREATE INDEX idx_digest_emails_digest ON digest_emails(digest_id);
CREATE INDEX idx_digest_emails_user ON digest_emails(user_id, created_at DESC);
CREATE INDEX idx_digests_user_created ON digests(user_id, created_at DESC);
CREATE INDEX idx_digests_status ON digests(status) WHERE status IN ('queued', 'processing', 'failed');
CREATE INDEX idx_digest_schedules_active ON digest_schedules(is_active) WHERE is_active = true;
CREATE INDEX idx_reply_patterns_user_lang ON reply_patterns(user_id, language, created_at DESC);
```

### Row-Level Security (RLS) Policies

Every table must have RLS enabled. Key policies:
- `users`: `user_id = auth.uid()` — read/update own row only
- `inboxes`: `user_id = auth.uid()` — CRUD own inboxes only
- `digests`: `user_id = auth.uid()` — read own digests only
- `digest_emails`: `user_id = auth.uid()` — read own emails only (uses denormalized `user_id` for fast policy evaluation, no subquery needed)
- `digest_schedules`: `user_id = auth.uid()` — CRUD own schedules only
- `reply_patterns`: `user_id = auth.uid()` — read/write own patterns only
- `subscriptions`: `user_id = auth.uid()` — read own subscription only (Phase 3)

---

## Token Encryption

OAuth tokens are encrypted at the application level before storing in Supabase:
- **Algorithm:** AES-256-GCM
- **Key:** Stored in `ENCRYPTION_KEY` environment variable (generated via `openssl rand -hex 32`)
- **Implementation:** `lib/encryption.ts` — `encrypt(plaintext)` / `decrypt(ciphertext)` helpers
- **Storage format:** `{version}:{iv_hex}:{ciphertext_hex}` — structured format that includes key version for rotation
- **Key version:** Tracked in `inboxes.token_key_version` (defaults to 1). Supports future rotation without schema migration.
- **Emergency rotation procedure:** Generate new key → set as `ENCRYPTION_KEY_V2` → run re-encryption script (`scripts/rotate-encryption-key.ts`) → update env var → deploy. Script re-encrypts all tokens and updates `token_key_version`.

---

## Architecture Overview

```
[Vercel Cron — every 15 minutes]
        |
        v
[API Route: /api/cron/digest]  (CRON_SECRET protected)
  - Identify users due for a digest in this 15-min window
  - Create digest records with status='queued'
  - Fan out: call /api/digest/process/[digestId] for each (fire-and-forget via fetch)
  - Log cron run to cron_runs table
  - Return immediately (stays within Vercel timeout)
        |
        v
[API Route: /api/digest/process/[digestId]]  (internal, API key protected)
  - One invocation per user per digest (separate Vercel function, own 60s timeout)
  - Steps for each digest:
        |
        ├── 1. SENT-FOLDER SCAN (reply learning)
        │   ├── Fetch sent emails since sent_sync_cursor
        │   ├── Match sent replies to digest_emails by thread_id
        │   │   - Primary match: thread_id
        │   │   - Fallback: subject-line matching (strip Re:/Fwd: prefixes)
        │   │   - Multiple replies in thread: match to most recent unmatched digest_email
        │   │   - Unmatched sent emails: skip gracefully (no orphaned patterns)
        │   ├── Store matched pairs in reply_patterns (with detected language tag)
        │   └── Update sent_sync_cursor
        │
        ├── 2. INBOX FETCH (with Gmail API quota management)
        │   ├── Fetch new emails since sync_cursor from Gmail API (read-only)
        │   ├── Truncate each email body to 4000 chars, estimate token count
        │   ├── On 429 (rate limit): exponential backoff, retry up to 3 times
        │   └── Update sync_cursor + last_synced_at on each inbox
        │
        v
  [Claude Haiku: Classify urgency per email (batched)]
  [Claude Sonnet: Summarize emails + suggest replies (batched)]
    - Dynamic batching: group by cumulative token count (~30K tokens/batch), not fixed count
    - Include last 10 reply_patterns as few-shot examples, filtered by detected language
    - Long emails (>2000 tokens): extract most recent 2-3 messages in thread only
        |
        ├── Save digest to DB (status: 'completed', ai_cost_cents tracked)
        ├── Send digest email via Resend (email-first: full summaries + reply buttons inline)
        |   └── On failure: set digest status to 'failed', log to Sentry
        └── Update digest_schedules.last_triggered_at
        
[User opens digest email — PRIMARY PATH (80% of interactions)]
        |
        ├── Reads AI summaries + suggested replies inline
        ├── Quick reply: taps "Reply with this" → Gmail compose opens with reply pre-filled → send
        ├── Edit reply: taps "Edit & reply" → opens dashboard email detail → edit → copy/compose
        └── Next sync: sent-folder scan detects what they sent → reply learning improves

[User opens dashboard — SECONDARY PATH (settings, history, editing)]
        |
        ├── Browse digest history
        ├── "Digest now" button for on-demand digest (rate-limited: 5/hour)
        ├── Edit suggested replies before copying
        └── Manage inboxes, schedules, settings
```

### Cron Schedule Matching Logic
The cron runs every 15 minutes. For each run it:
1. Gets current UTC time
2. Queries `digest_schedules` joined with `users.timezone`
3. Converts each schedule's `time` to the user's local time in their timezone
4. Matches if the schedule's local time falls within the current 15-minute window AND `last_triggered_at` is not within the same window
5. **DST handling:** On spring-forward, if scheduled time is skipped (e.g., 02:30 doesn't exist), deliver at the next valid time. On fall-back, deliver only on the first occurrence (checked via `last_triggered_at`).

### Fan-Out Pattern (Vercel Function Timeouts)
The cron endpoint does NOT process digests itself. It:
1. Identifies due users and creates `digest` records with `status='queued'`
2. Fires off separate `fetch()` calls to `/api/digest/process/[digestId]` for each
3. Each process call runs in its own Vercel function with its own 60s timeout
4. This scales horizontally — 100 users = 100 parallel function invocations (within Vercel concurrency limits)

### Error Handling & Retries
- Failed digests are marked `status: 'failed'` with `error_message`
- Next cron run retries failed digests up to 3 times (tracked via `retry_count`)
- If an inbox token expires: mark inbox `is_active: false`, email user to reconnect
- Structured logging via Sentry for all cron errors and API failures
- Sentry Crons monitors cron job health (alerts if cron doesn't run for 30+ minutes)

### Gmail API Quota Management
- Gmail API quota: 250 quota units per user per second, 25K per user per day
- `messages.list` = 5 units, `messages.get` = 5 units per message
- On 429 responses: exponential backoff (1s, 2s, 4s), max 3 retries
- Per-user processing runs in separate function invocations (natural rate distribution)
- Track API calls per user per day; if approaching daily limit, defer remaining to next cycle

---

## Rate Limiting & Cost Controls

### API Rate Limits
| Endpoint | Limit | Implementation |
|----------|-------|----------------|
| `/api/digests/now` | 5 per user per hour | Vercel Edge Middleware + Supabase counter |
| `/api/schedules` | 20 per user per hour | Vercel Edge Middleware |
| `/api/inboxes` | 10 per user per hour | Vercel Edge Middleware |
| `/api/cron/digest` | CRON_SECRET only | Header validation |
| `/api/digest/process/[id]` | Internal API key only | Not user-accessible |

### AI Cost Controls
- **Per-digest cost tracking:** Every digest records `ai_cost_cents` based on actual token usage
- **Per-user daily cap:** Max $2/day in AI costs per user. If exceeded, on-demand digests are disabled until the next day. Scheduled digests still run.
- **Per-digest email cap:** Max 100 emails per digest. If inbox has more, process the 100 most recent and note "X older emails not included."
- **Global alerting:** If total daily AI spend exceeds $50, alert the operator via Sentry.
- **Tier-based limits (Phase 3):**

| Tier | Scheduled digests/day | On-demand digests/day | Inboxes | Max emails/digest |
|------|----------------------|----------------------|---------|-------------------|
| Starter ($29/mo) | 2 | 3 | 1 | 75 |
| Pro ($49/mo) | 5 | 10 | 3 | 150 |
| Business ($99/mo) | Unlimited | 20 | 10 | 300 |

---

## AI Cost Model & Unit Economics

### Per-User AI Cost (50 emails/day, 1 digest)

| Step | Model | Tokens | Cost |
|------|-------|--------|------|
| Urgency classification (batched) | Haiku | ~30K input, ~2K output | ~$0.01 |
| Summarization + replies (batched) | Sonnet | ~60K input, ~15K output | ~$0.30 |
| **Total per digest** | | | **~$0.31** |

### Full Unit Economics (per user/month, Starter tier)

| Cost | Monthly |
|------|---------|
| AI (avg 1.5 digests/day x $0.31) | $14.00 |
| Supabase Pro (prorated per user at 100 users) | $0.25 |
| Vercel Pro (prorated per user at 100 users) | $0.20 |
| Resend (~45 digest emails/month) | $0.02 |
| Sentry (prorated) | $0.05 |
| **Total cost/user/month** | **~$14.50** |
| **Revenue (Starter)** | **$29.00** |
| **Gross margin** | **$14.50 (~50%)** |

- At 2+ digests/day (Pro tier): cost rises to ~$19/month, revenue $49 → 61% margin
- Power user check: 5 on-demand + 2 scheduled = 7 digests/day = $2.17/day → $65/month cost. Pro tier ($49) loses money → daily cap of $2 AI cost prevents this.
- **Supabase free tier is dev-only.** Production requires Pro ($25/month). Storage grows at ~1.5MB/user/month for digest_emails.

### Email Body Truncation & Dynamic Batching
- Each email body is truncated to **4,000 characters** before storage and AI processing
- Long threads: extract only the **most recent 2-3 messages** (strip quoted replies)
- Token estimation: ~1 token per 4 characters → max ~1,000 tokens per email
- **Dynamic batching:** group emails by cumulative token count (target ~30K tokens per batch), not a fixed count. This handles a mix of short and long emails gracefully.
- If a single email exceeds 4,000 chars after truncation (shouldn't happen), it gets its own batch.

---

## Digest Scheduling System

### How it works
- Users configure one or more digest schedules via the Settings page or during onboarding
- Each schedule is stored as a row in `digest_schedules` with a `time` (time of day) and `days` (array of weekdays)
- The Vercel Cron runs every 15 minutes, converts each schedule to the user's local time, and checks if it falls in the current window
- Deduplication uses `last_triggered_at` (not date-based) for robustness across DST transitions
- Users can also trigger a digest on demand anytime via the "Digest now" button (rate-limited)

### DST Handling
- **Spring-forward:** If the scheduled time is skipped (e.g., 02:30 doesn't exist), the digest is delivered at the next valid time in that window.
- **Fall-back:** If the scheduled time occurs twice, the digest is delivered only on the first occurrence. The `last_triggered_at` column prevents double delivery.

### Presets (offered in UI)
Users pick from presets or build a custom schedule:

| Preset | Description | Rows created |
|--------|-------------|--------------|
| Once daily (afternoon) | One digest at 14:00 | 1 row: 14:00, all days |
| Twice daily | Morning + evening | 2 rows: 08:00 + 17:00, all days |
| Every morning | Daily at 08:00 | 1 row: 08:00, all days |
| Weekdays only | Mon-Fri at 08:00 | 1 row: 08:00, Mon-Fri |
| Weekly summary | Monday at 09:00 | 1 row: 09:00, Monday |
| Custom | Pick days + times | User-defined |

### UI for custom schedules
- Multi-select for days of the week (Mon-Sun, pill toggles)
- Time picker (hour + minute, 15-min increments)
- "Add another time" button for multiple daily digests
- Preview text: "You'll receive digests: Mon-Fri at 08:00 and 17:00"

---

## Authentication & Session Security

### Auth Implementation
- **Supabase Auth** with `@supabase/ssr` using **HTTP-only cookies** (not localStorage) to prevent XSS token theft
- Google OAuth (primary) + email/password (alternative)
- Auth middleware (`middleware.ts`) validates Supabase JWT on every request to protected routes
- User profile row created in `users` table on first sign up via Supabase trigger or post-login check

### Gmail OAuth Security
- Gmail OAuth flow includes a **`state` parameter** tied to the user's session to prevent CSRF
- Callback validates `state` before exchanging the auth code
- On error (user denies permission, Workspace restriction, etc.), redirect to onboarding with clear error message

### API Route Protection
- All `/api/*` routes (except `/api/cron/*`) validate the Supabase JWT via `createServerClient` and reject unauthenticated requests with 401
- `/api/cron/digest` validates `CRON_SECRET` header
- `/api/digest/process/[id]` validates an internal API key (not user-accessible)
- All state-changing API routes use POST/PUT/DELETE (Supabase's SameSite=Lax cookies prevent CSRF for non-GET requests)

---

## GDPR & Consent

Since the primary market is Sweden/EU:

### Consent Flow (in onboarding)
- After connecting Gmail (Step 1) and before the first digest (Step 3), show a consent screen:
  > "To create your digest, we'll send your email content to our AI provider (Anthropic) for summarization. We never store full email bodies — only AI-generated summaries. [Read our privacy policy]"
  > **[I consent and want to continue]** / **[No thanks, disconnect my inbox]**
- Record consent: `users.consent_given_at` = now, `users.consent_version` = "v1.0"
- No email processing occurs until consent is given
- Consent can be withdrawn in Settings (separate from account deletion — withdrawing consent disconnects inboxes and stops processing, but preserves the account)

### Privacy Requirements
- **Privacy policy** required before launch — disclose what email data is stored and how
- **Data retention:** Email body previews stored only in `digest_emails.body_preview` (truncated to 4000 chars). Full email bodies are never stored — only AI-generated summaries.
- **Right to deletion:** "Delete my account" in Settings cascade-deletes all user data (inboxes, digests, digest_emails, reply_patterns, schedules)
- **Consent withdrawal:** "Stop processing my emails" in Settings disconnects inboxes and stops digest generation without deleting historical data
- **Data processing agreements (DPA):** Required for Supabase, Anthropic, Resend, Vercel. Verify Anthropic's DPA covers GDPR requirements (API data not used for training).
- **Token storage:** Encrypted at rest, never logged or exposed in error messages
- **AI processing disclosure:** Consent screen + privacy policy

---

## Pages & UI (Mobile-First)

### 1. Landing / Login (`/`)
- Simple hero: "Your messages, on autopilot."
- "Sign in with Google" button (prominent, recommended in v1)
- Email + password form (alternative)
- "Sign in with Microsoft" button (added in Phase 2)

### 2. Onboarding (`/onboarding`)
- Step 1: "Connect your first inbox" — Gmail button
- Step 2: "We need your consent" — GDPR consent screen (see Consent Flow above)
- Step 3: "When do you want your digests?" — preset picker (default: "Once daily at 14:00"), with option to customize
- Step 4: "Here's your first digest!" — triggers an instant preview digest so the user sees value immediately (no waiting)
- 4 steps, ~90 seconds total

### Error states for onboarding:
- **Permission denied:** "We need read access to your inbox to create digests. [Try again] [Learn more about permissions]"
- **OAuth error:** "Something went wrong connecting your Gmail. [Try again] [Contact support]"
- **Workspace restriction:** "Your organization may have restricted third-party app access. Contact your IT admin or try a personal Gmail account."

### 3. Dashboard (`/dashboard`) — secondary experience
Most users interact via the digest email. The dashboard is for editing replies, browsing history, and managing settings. Built as a **PWA (Progressive Web App)** so users can "Add to home screen" for app-like access without a native app.

- "Digest now" button (always visible, top right) — triggers on-demand digest
  - Shows cooldown timer after use (rate-limited: 5/hour)
  - When processing: shows progress indicator ("Processing 47 emails...")
  - Uses polling for status updates until digest completes
- Today's latest digest at top (summary card)
- List of emails sorted by urgency (high = red dot, medium = yellow, low = gray)
- Each email card shows:
  - From, Subject, AI Summary (2-3 lines)
  - Suggested reply (expandable)
  - "Copy reply" / "Open in Gmail" / "Skip" buttons
- "Past digests" section — browse previous digests by date
- Bottom nav: Dashboard | Inboxes | Settings

### UI states:
- **Loading:** Skeleton cards while digest loads
- **Empty (no digests yet):** "Your first digest is being prepared..." (during onboarding) or "No new emails since your last digest. Everything's under control."
- **Error (digest failed):** "Something went wrong generating your digest. [Retry] We've been notified and are looking into it."
- **Partial (some emails failed AI processing):** Show successfully processed emails, note "X emails couldn't be summarized"

### 4. Email Detail (`/dashboard/[emailId]`)
- Full email thread view (sanitized HTML — see Security section)
- AI summary at top
- Suggested reply in editable text area (user can tweak before copying)
- **"Copy reply" button** (primary action — clipboard API + toast confirmation)
- **"Open in Gmail" button** (secondary — uses Gmail compose URL: `https://mail.google.com/mail/?view=cm&to=...&su=...&body=...`, NOT mailto)
  - Falls back to mailto for non-Gmail users (Phase 2)
  - Long replies: truncated in URL with "Full reply copied to clipboard" fallback

### 5. Inboxes (`/inboxes`)
- List of connected inboxes with status indicator (connected / token expired / error)
- "Add inbox" button
- Alert banner if any inbox needs reconnection
- Per-inbox auto-reply toggle (disabled in MVP, shown as "Coming soon")

### 6. Settings (`/settings`)
- **Digest schedule** — manage schedules (add/edit/remove), preset picker + custom builder
- Timezone
- Notification preferences
- **Consent management** — "Stop processing my emails" (withdraws consent, disconnects inboxes)
- "Delete my account" (cascade-deletes all data, GDPR)
- Billing section (placeholder in MVP, Stripe portal link in Phase 3)

---

## Digest Summary Email (Primary Experience)

The digest email IS the product for most users. They should be able to handle 80% of their replies without ever opening the dashboard.

### Template structure
1. **Header:** "DigestPilot — [X] new messages" + date
2. **Quick stats:** "[X] emails, [Y] urgent, [Z] replies suggested"
3. **Email list, sorted by urgency.** Each email shows:
   - Urgency indicator (red/yellow/gray dot)
   - From + subject (sanitized, no raw HTML)
   - AI summary (2-3 sentences — enough to decide without reading the original)
   - **Suggested reply text** (shown inline, fully visible)
   - Two action buttons:
     - **[Reply with this →]** — Gmail compose URL (`https://mail.google.com/mail/?view=cm&to={from_email}&su=Re: {subject}&body={suggested_reply}`) pre-filled with correct recipient, subject, and reply. One tap → Gmail opens → send. The user can also edit before sending in Gmail.
     - **[Edit & reply →]** — deep link to `/dashboard/[emailId]` where user can edit the reply text before copying/composing
   - If the suggested reply is too long for a URL (>1500 chars), the "Reply with this" button links to the dashboard instead, with a note: "Reply is too long for quick send — tap to edit & send"
4. **Footer:** "Open full dashboard" link, "Digest now" link, "Change schedule" link, unsubscribe link

### Example email card (in digest):
```
🔴 Anna Lindström (anna@company.se)
   Q2 Budget Review
   
   Anna wants your input on the Q2 budget before Friday.
   She's attached the spreadsheet and needs sign-off on
   the marketing line items.
   
   Suggested reply:
   "Hi Anna, I'll review the numbers and get back to you
   by Thursday. Thanks for flagging the deadline."
   
   [Reply with this →]  [Edit & reply →]
```

### Key design decisions
- **Suggested reply shown in full** — not hidden behind a "View reply" link. The user should see the reply and tap send without extra clicks.
- **Each email has its own Gmail compose link** — different `to`, `su`, and `body` parameters per email. Users can reply to 5 different people from one digest email.
- **Gmail compose URL, not mailto** — `mailto:` opens the default email client (might be Apple Mail). The Gmail compose URL opens Gmail specifically in the browser, which is what Gmail users expect.

### Deliverability
- **Domain authentication:** Configure SPF, DKIM, and DMARC for `digestpilot.com` before launch
- **Resend setup:** Verify sending domain in Resend dashboard
- **Onboarding hint:** After first digest, show: "Check your spam folder and mark DigestPilot as safe"
- **Bounce/complaint handling:** Monitor Resend delivery webhooks. If a digest email bounces or gets marked as spam, surface a warning in the dashboard: "Your digest emails may be going to spam. [How to fix]"
- **Warm-up:** Start with a small number of users and gradually increase volume

### Design principles
- Mobile-first HTML email (single column, large tap targets)
- Plain text fallback
- Renders well in Gmail, Apple Mail, Outlook
- Use React Email for templating — avoids hand-writing HTML email tables

---

## Reply Learning & Auto-Reply System

### How it learns (MVP):
1. On each digest run (or on-demand digest), **before** fetching new inbox emails, scan the user's sent folder since `sent_sync_cursor`
2. Match each sent email to a `digest_email` by `thread_id` — this pairs the original email with what the user actually replied
3. **Matching strategy:**
   - Primary: match by `thread_id` (Gmail always provides this)
   - Fallback: if thread_id match fails, try subject-line matching (strip `Re:`, `Fwd:`, `SV:`, `VS:` prefixes and compare)
   - Multiple replies in same thread: match to the most recent unmatched `digest_email` in that thread
   - Unmatched sent emails (replies to non-digest emails): skip gracefully, do not create orphaned patterns
4. Store the match: `email_context_summary` (AI summary of the original), `suggested_reply` (what we suggested), `user_reply` (what they actually sent), and `language` (detected language) in `reply_patterns`
5. Update `digest_emails.user_reply` and `reply_matched_at` for tracking
6. When generating new suggestions, include the 10 most recent `reply_patterns` as few-shot examples in the Claude prompt, **filtered by the detected language** of the incoming email
7. If insufficient same-language examples exist (<3), fall back to all examples but instruct Claude to reply in the detected language
8. Track metrics: how often users send replies as-is vs. edit them, common corrections
9. Prune `reply_patterns` to last 200 per user via a scheduled cleanup job

### Key detail: this works with read-only scope
The `gmail.readonly` scope grants access to the sent folder. We never send on behalf of the user — we just observe what they sent and learn from it.

### Auto-reply flow (Phase 3 — requires gmail.send scope):
1. User enables auto-reply per inbox (requires 30+ reply patterns minimum)
2. When digest runs, high-confidence replies are auto-sent
3. Lower-confidence replies are queued for review
4. User gets digest email: "3 replies sent automatically, 5 need your review"
5. Dashboard shows auto-sent replies (can undo within 5 minutes via delayed sending)

### Confidence scoring (Phase 3):
- Based on: similarity to past email patterns, reply pattern consistency, urgency level
- Auto-reply threshold: 85%+ confidence
- Show confidence badge on each suggestion

---

## Content Security

### Email Content Sanitization
- All email HTML is sanitized before storage and rendering using **DOMPurify** (server-side)
- `body_preview` stores sanitized, truncated plain text (max 4,000 chars)
- Email subjects and sender names are HTML-escaped before rendering in the dashboard
- AI-generated summaries are inherently safe (generated text, not user HTML), but are still escaped on render
- Digest emails (via Resend) only contain AI-generated summaries — never raw email HTML

---

## Build Phases

### Phase 1: MVP (what we build now)
1. **Project setup** — Next.js 15, Tailwind, shadcn/ui, Supabase, Sentry, Vitest
2. **Auth** — Supabase Auth with `@supabase/ssr` (HTTP-only cookies), Google SSO + email/password
3. **Gmail OAuth (read-only)** — Connect Gmail, fetch emails, store tokens (encrypted with key versioning)
4. **Digest scheduling + cron** — Simple time+days picker, cron fan-out architecture, DST handling
5. **AI Digest** — Claude summarizes emails (dynamic batching by token count), classifies urgency, suggests replies
6. **Reply learning** — Sync sent folder, match replies by thread ID with fallback, store patterns with language tags, use as few-shot examples
7. **Dashboard** — Mobile-first UI to view digest, browse history, copy/Gmail-compose replies, "Digest now" button with rate limiting
8. **Summary email** — Send via Resend with React Email template, SPF/DKIM/DMARC, deep links
9. **Onboarding** — 4-step flow with GDPR consent and instant preview digest
10. **Inbox health monitoring** — Detect expired tokens, notify user to reconnect
11. **Monitoring** — Sentry Crons, cron_runs table, per-digest AI cost tracking, health endpoint

### Phase 2: Multi-provider + Send + Filters
12. **Send replies from dashboard** — Upgrade to Gmail send scope (requires Google security audit)
13. **Microsoft Graph** — Connect Outlook/365 inboxes
14. **Multiple inboxes UI** — Unified digest across inboxes
15. **Email categories / filters** — Let users exclude newsletters, filter by sender domain
16. **Urgent email alerts** — Real-time notification for high-urgency emails outside digest schedule
17. **Token encryption key rotation** — Run re-encryption with V2 key using existing `token_key_version` column

### Phase 3: Auto-reply + Billing
18. **Auto-reply** — Confidence-based auto-sending with undo
19. **Stripe integration** — Per-inbox subscription billing with tier-based digest caps
20. **Usage tracking** — Track emails processed per user for billing and limits
21. **IMAP/SMTP support** — Connect any email provider via credentials

---

## Phase 1 (MVP) Implementation Order

### Step 1: Project scaffolding
- `npx create-next-app@latest` with App Router, TypeScript, Tailwind
- Install shadcn/ui, configure theme
- Set up Supabase project + environment variables
- Initialize database schema (migrations) with RLS policies and indexes
- Set up Sentry for error tracking (including Crons monitoring)
- Create `lib/encryption.ts` for token encryption (with key version support)
- Set up Vitest for unit testing
- Create `/api/health` endpoint for uptime monitoring
- Configure PWA: `next-pwa`, `manifest.json`, app icons — enables "Add to home screen"

### Step 2: Authentication
- Supabase Auth with `@supabase/ssr` (HTTP-only cookies)
- Google OAuth (primary) + email/password (alternative)
- Sign up / sign in page (`/`) with "Sign in with Google" button prominent
- Auth middleware (`middleware.ts`) to protect routes — validates Supabase JWT
- User profile creation on first sign up

### Step 3: Gmail Integration (read-only)
- Google Cloud Console: OAuth2 credentials with `gmail.readonly` scope
- OAuth flow: `/api/auth/gmail` → Google consent → callback
  - Include `state` parameter tied to user session (CSRF protection)
  - Handle error states: permission denied, OAuth error, Workspace restriction
- Store tokens in `inboxes` table (encrypted via AES-256-GCM with version tag)
- Token refresh logic with exponential backoff
- API helper to fetch recent emails using `sync_cursor` (Gmail historyId)
- API helper to fetch sent emails using `sent_sync_cursor`
- Detect and handle expired tokens (mark inbox inactive, notify user)
- Email body truncation: max 4,000 chars, strip quoted replies in long threads
- HTML sanitization via DOMPurify before storage

### Step 4: Digest Scheduling + Cron Architecture
- `digest_schedules` CRUD API with rate limiting
- Schedule matching logic: convert to user's local time, check 15-min window, DST handling
- Deduplication via `last_triggered_at` (not date-based)
- **Cron fan-out:** `/api/cron/digest` identifies due users → creates queued digests → fans out to `/api/digest/process/[digestId]`
- `/api/digest/process/[digestId]` — per-user processing in separate function invocation
- Cron run logging to `cron_runs` table
- For initial development: hardcode a test schedule. Full scheduling UI in Step 8.

### Step 5: AI Summarization Engine
- Dynamic batching by cumulative token count (~30K tokens/batch)
- Haiku: classify urgency (low/medium/high) in batch
- Sonnet: summarize each email (2-3 sentences) + generate suggested reply in batch
- Include last 10 `reply_patterns` as few-shot examples, filtered by language
- Track AI cost per digest (`digests.ai_cost_cents`)
- Per-user daily AI cost cap ($2/day)
- Per-digest email cap (100 emails max)
- Versioned prompts in `lib/prompts/`

### Step 6: Reply Learning
- Sent-folder scan during each digest run (before inbox fetch)
- Thread ID matching with subject-line fallback
- Handle edge cases: multiple replies, unmatched emails, missing thread IDs
- Store patterns with detected language tag
- Language-aware few-shot selection (filter by language, fallback to all)
- Retention: prune to last 200 per user

### Step 7: Dashboard UI
- Mobile-first responsive layout
- "Digest now" button with rate limiting (5/hour), cooldown timer, progress indicator
- Today's digest view with email cards (loading, empty, error, partial states)
- Past digest history (browse by date)
- Email detail with editable reply text (sanitized rendering)
- "Copy reply" button (primary — clipboard API + toast confirmation)
- "Open in Gmail" button (secondary — Gmail compose URL with fallback)
- Skip/dismiss actions
- Idempotency: disable "Digest now" if a digest is already processing; backend checks for existing `processing` status

### Step 8: Digest Schedule UI + Onboarding
- Settings UI: preset picker + custom schedule builder (day pills + time picker)
- Onboarding flow: Connect Gmail → GDPR consent → Set schedule → Instant preview digest
- GDPR consent screen with recorded consent (timestamp + version)

### Step 9: Digest Summary Email (email-first)
- HTML email template via React Email (mobile-first, single column)
- **Email-first design:** each email shows full AI summary + suggested reply text inline
- Per-email action buttons: "Reply with this" (Gmail compose URL) + "Edit & reply" (dashboard deep link)
- Gmail compose URL per email: `https://mail.google.com/mail/?view=cm&to={from}&su=Re: {subject}&body={reply}`
- Long reply fallback: if reply >1500 chars, "Reply with this" links to dashboard instead
- Send via Resend with verified domain (SPF/DKIM/DMARC)
- Plain text fallback (summaries + replies as text, dashboard links for actions)
- Bounce/complaint webhook monitoring

### Step 10: Inbox Health + Monitoring
- Detect expired Gmail tokens, mark inbox inactive, email user to reconnect
- Sentry Crons monitoring for cron health
- `/api/health` endpoint
- Alerts: cron not running for 30+ min, digest failure rate > 10%, daily AI spend > $50

---

## Key Files Structure

```
/app
  /page.tsx                    -- Landing + login
  /onboarding/page.tsx         -- Onboarding flow (4 steps with GDPR consent)
  /dashboard/page.tsx          -- Main digest view + history
  /dashboard/[emailId]/page.tsx -- Email detail + reply
  /inboxes/page.tsx            -- Manage inboxes
  /settings/page.tsx           -- User settings + digest schedule + consent management
  /api
    /health/route.ts           -- Health check endpoint
    /auth/gmail/route.ts       -- Gmail OAuth initiation (with state parameter)
    /auth/gmail/callback/route.ts -- Gmail OAuth callback (validates state)
    /cron/digest/route.ts      -- Scheduled digest cron (CRON_SECRET, fan-out only)
    /digest/process/[digestId]/route.ts -- Per-user digest processing (internal API key)
    /digests/now/route.ts      -- On-demand "Digest now" (authenticated, rate-limited)
    /inboxes/route.ts          -- CRUD inboxes
    /schedules/route.ts        -- CRUD digest schedules
  /middleware.ts               -- Auth middleware (Supabase JWT validation)
/lib
  /supabase.ts                 -- Supabase client (server + browser)
  /encryption.ts               -- AES-256-GCM encrypt/decrypt with key versioning
  /gmail.ts                    -- Gmail API helpers (read-only: inbox + sent folder)
  /reply-matcher.ts            -- Match sent emails to digest threads, store reply patterns
  /sanitize.ts                 -- DOMPurify email content sanitization
  /ai.ts                       -- Claude API summarization (dynamic batching)
  /prompts/                    -- Versioned prompt templates
    /summarize.ts              -- Summarization prompt
    /classify.ts               -- Urgency classification prompt
    /suggest-reply.ts          -- Reply suggestion prompt (with few-shot examples)
  /email-sender.ts             -- Send digest emails via Resend
  /scheduler.ts                -- Evaluate which schedules are due (timezone + DST aware)
  /rate-limit.ts               -- Per-user rate limiting helpers
/components
  /email-card.tsx              -- Email summary card
  /reply-editor.tsx            -- Editable reply text area
  /reply-actions.tsx           -- "Copy reply" + "Open in Gmail" buttons
  /digest-summary.tsx          -- Digest overview card
  /digest-history.tsx          -- Past digests browser
  /digest-status.tsx           -- Loading, empty, error, partial states
  /inbox-connector.tsx         -- Gmail OAuth connect button
  /inbox-status.tsx            -- Inbox health indicator
  /schedule-picker.tsx         -- Digest schedule preset + custom builder
  /consent-screen.tsx          -- GDPR consent screen for onboarding
  /ui/                         -- shadcn components
/public
  /manifest.json               -- PWA manifest (app name, icons, theme color)
  /icons/                      -- PWA icons (192x192, 512x512)
/emails
  /digest.tsx                  -- React Email template for digest summary (email-first with inline replies + Gmail compose links)
/scripts
  /rotate-encryption-key.ts   -- Emergency encryption key rotation script
/__tests__
  /lib/
    /encryption.test.ts        -- Encrypt/decrypt + key versioning
    /scheduler.test.ts         -- Schedule matching + DST edge cases
    /reply-matcher.test.ts     -- Thread matching + fallback logic
    /rate-limit.test.ts        -- Rate limit enforcement
  /e2e/
    /onboarding.spec.ts        -- Auth + Gmail connect + consent + first digest
```

---

## Environment Variables

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Google OAuth (for Gmail, read-only scope)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Claude AI
ANTHROPIC_API_KEY=

# Token encryption
ENCRYPTION_KEY=               # Generated via: openssl rand -hex 32

# Cron security
CRON_SECRET=                  # Vercel cron job authentication

# Internal API (for digest processing fan-out)
INTERNAL_API_KEY=             # Shared secret for internal service-to-service calls

# Email sending
RESEND_API_KEY=

# Error tracking
SENTRY_DSN=

# Stripe (Phase 3, reserve early)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# App URL (for deep links in emails)
NEXT_PUBLIC_APP_URL=          # e.g. https://digestpilot.com
```

---

## Google OAuth Verification Notes

**MVP uses `gmail.readonly` scope (sensitive, not restricted):**
- Requires Google OAuth verification, but NOT the expensive third-party security audit
- Verification process: submit app for review with privacy policy, homepage, demo video
- Timeline: typically 1-3 weeks
- During development: add up to 100 test users manually in Google Cloud Console

**Phase 2 adds `gmail.send` scope (restricted):**
- Triggers mandatory third-party security audit (CASA Tier 2)
- Cost: $15K-75K depending on auditor
- Only pursue once MVP is validated with paying customers

---

## Testing Strategy

### Unit Tests (Vitest)
- `lib/encryption.ts` — encrypt/decrypt round-trip, key versioning, invalid key handling
- `lib/scheduler.ts` — schedule matching, 15-min window boundary, DST spring-forward/fall-back, timezone conversion
- `lib/reply-matcher.ts` — thread ID matching, subject-line fallback, multiple replies, unmatched emails
- `lib/rate-limit.ts` — rate limit enforcement, cooldown, per-user isolation

### Integration Tests (Vitest)
- Digest pipeline with mocked Gmail API responses — verify emails are fetched, summarized, stored
- Sent-folder scan with mocked sent emails — verify reply matching and pattern storage
- Cron fan-out — verify queued digests are created and process endpoints are called

### E2E Tests (Playwright)
- Auth flow: Google SSO → onboarding → consent → schedule → first digest
- Dashboard: view digest, copy reply, open in Gmail, browse history
- Settings: change schedule, withdraw consent, delete account

---

## Monitoring & Observability

### Cron Health
- **Sentry Crons:** monitors that `/api/cron/digest` runs every 15 minutes. Alerts if missed for 30+ minutes.
- **`cron_runs` table:** logs each cron execution (users evaluated, digests queued/completed/failed, total AI cost, duration)

### Operational Alerts (via Sentry)
- Cron not running for 30+ minutes
- Digest failure rate > 10% in any cron run
- Daily AI spend exceeds $50
- Inbox token expiration rate spike (>5 in 1 hour)
- Health endpoint (`/api/health`) returns non-200

### Dashboards (simple, using cron_runs table)
- Digests sent/failed per day
- Average processing time per digest
- Daily/weekly AI cost trends
- Active users and inboxes count

---

## Verification Plan

1. **Auth flow**: Sign up with Google SSO or email/password → land on onboarding
2. **Gmail connect**: Click "Connect Gmail" → Google consent (read-only) → redirect back → inbox shows in DB with encrypted tokens (verify state parameter validated)
3. **Gmail connect error**: Deny permission on consent screen → verify clear error message and retry option
4. **GDPR consent**: Consent screen shown before first digest → verify `consent_given_at` and `consent_version` recorded
5. **Email fetch**: Trigger "Digest now" → verify emails fetched, sync_cursor updated, bodies truncated to 4000 chars, HTML sanitized
6. **AI summary**: Check digest_emails for AI summaries, urgency labels, and suggested replies. Verify dynamic batching by token count.
7. **AI cost tracking**: After digest, verify `digests.ai_cost_cents` is populated
8. **Dashboard**: Open on mobile viewport → verify responsive layout, email cards, copy/Gmail-compose flow, digest history
9. **Dashboard states**: Verify loading, empty, error, and partial states render correctly
10. **Copy reply**: Tap "Copy reply" → verify clipboard contains suggested reply text, toast shown
11. **Open in Gmail**: Tap "Open in Gmail" → verify Gmail compose URL opens with pre-filled reply
12. **Digest email**: Trigger digest → verify Resend email received with correct template, deep links work, SPF/DKIM pass
13. **Scheduling**: Create schedule for current 15-min window → verify cron triggers digest, `last_triggered_at` updated
14. **DST handling**: Test schedule at DST transition time → verify no duplicate or missed digests
15. **Digest now rate limit**: Trigger 6 on-demand digests in 1 hour → verify 6th is rejected with rate limit message
16. **Digest now idempotency**: Double-tap "Digest now" → verify only one digest is created
17. **Error handling**: Revoke Gmail token → verify inbox marked inactive, user notified via email
18. **Reply learning**: Send a reply to a digest email via Gmail → trigger next digest → verify sent reply detected, matched to digest_email by thread_id, stored in reply_patterns with language tag
19. **Reply matching fallback**: Reply with modified subject → verify subject-line fallback matching works
20. **Improved suggestions**: After 5+ reply_patterns exist → trigger digest → verify suggested replies reflect user's writing style (few-shot examples included in prompt, filtered by language)
21. **Cron fan-out**: Trigger cron with 3 due users → verify 3 separate process invocations, each within timeout
22. **Cron security**: Call `/api/cron/digest` without CRON_SECRET → verify 401 rejection
23. **Consent withdrawal**: Withdraw consent in Settings → verify inboxes disconnected, processing stops, historical data preserved
24. **Account deletion**: Click "Delete my account" → verify all user data cascade-deleted
25. **Monitoring**: Verify cron_runs table populated after each cron, Sentry Crons check-in received

---

## Native App — Not Needed

The email-first approach means the user's email app IS the product interface. For the dashboard, the PWA provides:
- "Add to home screen" on iOS and Android — looks and feels like a native app
- Instant loading, app icon, full-screen mode, no browser chrome
- Zero App Store review process, zero React Native complexity
- If demand for native push notifications or offline mode emerges later, evaluate React Native then — the API routes already serve as the backend

---

## Future Ideas (Backlog)

- **Email categories / filters** — "only digest emails from unknown senders", skip newsletters, filter by sender domain. Reduces noise and AI costs.
- **Urgent email alerts** — real-time push notification for high-urgency emails between digest windows. Don't let a critical email sit for 5 hours.
- **Chrome extension / Gmail add-on** — show AI summaries + suggested replies inside Gmail sidebar. Avoids the "go to a separate dashboard" friction entirely.
- **SMS digest** — same concept applied to text messages. The architecture is provider-agnostic (inboxes table with provider enum), so SMS would be another provider type.
- **Team/shared inboxes** — multiple users digest the same inbox with role-based replies.
- **Haiku-only tier** — cheaper summarization for price-sensitive users (lower quality but ~$0.05/digest instead of $0.31).
- **Native mobile app** — only if PWA proves insufficient. API routes already serve as backend.

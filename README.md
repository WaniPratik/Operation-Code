# Anonymous Voice Match Platform

Foundation repository for a web-first, mobile-responsive platform inspired by the category of anonymous/random voice matching between strangers.

This repository now includes the MVP foundation plus a first LiveKit-based voice handoff for matched users. The current goal is to keep the stack easy to audit while shipping only the narrowest real functionality needed for testing:

- a clean repo structure
- product and engineering source-of-truth documents
- persisted guest, queue, match, and moderation flows
- match-scoped MVP voice rooms for active matches
- clear MVP boundaries and explicit assumptions

## Product Intent

The product is centered on lightweight, anonymous voice-based matching. Users should eventually be able to:

- enter a queue
- get matched with another user
- talk by voice
- end a session quickly
- report or block unsafe users

Future paid features may allow filtering into compatible cohorts before joining the queue, but those filters are **not** part of the initial MVP build unless later approved.

## Current Status

This repo now includes a Phase 3 MVP shell with persisted backend flows built around Next.js route handlers, Supabase/Postgres, and LiveKit. It includes:

- a responsive landing page and onboarding flow
- guest-session-first onboarding with 18+ self-attestation
- persisted queue join/leave state with country include/exclude filters
- tiered server-side non-realtime matching with polling-based UI updates
- transactional match claiming with Postgres row locks
- persisted match lifecycle, report/block actions, and audit events
- match-scoped LiveKit token issuance and room cleanup on match end
- a matched screen that transitions into a live audio room after the existing two-second handoff
- a simple password-protected admin moderation dashboard for active matches, reports, blocks, and audit logs
- initial Supabase/Postgres migrations and seed data
- unit and integration tests for matching, session flow, and core route behavior

It still does **not** include:

- premium filters or payments
- voice recordings, transcription, or advanced moderation tooling
- full staff RBAC and deeper moderation workflows
- cross-region scaling or worker-based queue partitioning
- production-grade observability around media quality and room health

## Repo Structure

```text
.
├── AGENTS.md
├── ARCHITECTURE.md
├── MVP_SCOPE.md
├── PRD.md
├── README.md
├── ROADMAP.md
├── USER_FLOWS.md
├── public/
├── src/
│   ├── app/
│   ├── components/
│   ├── features/
│   ├── lib/
│   ├── server/
│   └── types/
├── supabase/
│   └── migrations/
└── tests/
    ├── e2e/
    └── unit/
```

## Recommended Intended Stack

- Frontend: Next.js App Router + TypeScript + Tailwind CSS
- Backend-for-web: Next.js route handlers / server actions for MVP, with service boundaries kept explicit
- Database: Postgres via Supabase
- Auth later: Supabase Auth for upgraded identity paths, while MVP access is guest-session-first
- Session model now: guest-session-first, server-validated through an httpOnly cookie and guest session table
- Payments later: Stripe
- Voice now: LiveKit for MVP room-based voice, with room access tied to the persisted active match

See [ARCHITECTURE.md](ARCHITECTURE.md) for rationale and tradeoffs.

## Core Principles

- Web-first for fastest validation, auditability, and moderation review
- Mobile-responsive from day one
- MVP first, without disguised placeholder systems
- Safety, moderation, and auditability are first-class design concerns
- Product assumptions must be documented, not implied
- Clean architecture over premature complexity

## Documents

- [PRD.md](PRD.md): product definition and MVP framing
- [ARCHITECTURE.md](ARCHITECTURE.md): recommended technical architecture
- [USER_FLOWS.md](USER_FLOWS.md): end-to-end user journey mapping
- [ROADMAP.md](ROADMAP.md): phased delivery plan
- [MVP_SCOPE.md](MVP_SCOPE.md): explicit now/later/not-yet boundaries
- [AGENTS.md](AGENTS.md): engineering operating rules for future contributors
- [BETA_CHECKLIST.md](BETA_CHECKLIST.md): founder-facing private beta launch checklist
- [BETA_ISSUE_INTAKE.md](BETA_ISSUE_INTAKE.md): lightweight founder bug and issue intake template
- [BETA_TESTING_SCRIPT.md](BETA_TESTING_SCRIPT.md): closed-beta runbook for a 3 to 5 tester live session

## Product Decisions Currently Locked

- Minimum age: 18+
- Age gate: self-attestation only for MVP
- Auth direction: guest session first
- Requeue: allowed instantly
- Reconnect/rematch: not included in MVP
- No voice recordings
- Moderation metadata retention is intentionally limited to user id, anonymous handle, session id, match id, report id, block records, timestamps, anonymized device/session fingerprint where appropriate, and audit events

## Local Development

Prerequisites:

- Node.js 20+
- npm 10+
- Supabase project credentials
- LiveKit server or LiveKit Cloud project credentials for voice testing
- an internal admin password for /admin access

Install dependencies:

```bash
npm install
```

Set environment variables:

```bash
cp .env.example .env.local
```

Fill in the Supabase values plus these LiveKit values before testing voice:

- `NEXT_PUBLIC_APP_URL`: public app origin such as `http://localhost:3000` or `https://beta.example.com`
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project root URL such as `https://your-project.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: optional Supabase anon/publishable key used only for the Google sign-in foundation
- `SUPABASE_SERVICE_ROLE_KEY`: server-side `service_role` key from Supabase
- `NEXT_PUBLIC_LIVEKIT_URL`: websocket URL, such as `wss://your-project.livekit.cloud` or `ws://localhost:7880`
- `LIVEKIT_API_KEY`: server-side API key used to mint room tokens
- `LIVEKIT_API_SECRET`: server-side API secret used to mint room tokens and delete rooms on match end
- `ADMIN_ACCESS_PASSWORD`: shared internal password used to unlock the MVP admin dashboard

Run the app:

```bash
npm run dev
```

Run unit tests:

```bash
npm run test
```

Check startup readiness:

```bash
curl http://localhost:3000/api/health
```

What good looks like:

- HTTP `200`
- JSON `status: "ok"`
- each check reports `status: "ready"`

If something is wrong:

- the route returns HTTP `503`
- the JSON response tells you exactly which variable is missing or malformed
- no secrets are returned in the response

Before inviting private beta testers, review [BETA_CHECKLIST.md](BETA_CHECKLIST.md), [BETA_ISSUE_INTAKE.md](BETA_ISSUE_INTAKE.md), and [BETA_TESTING_SCRIPT.md](BETA_TESTING_SCRIPT.md), then confirm your local or staging environment uses the correct Supabase, LiveKit, and admin credentials for that environment.

The main MVP routes are:

- `/`
- `/onboarding`
- `/queue`
- `/match`
- `/session/complete`
- `/admin` (password-protected internal moderation dashboard)
- `/api/health` (safe readiness check for local or staging verification)

Optional Google sign-in setup:

- Guest chat does not require Google sign-in and remains the primary beta path.
- To test the Google button, add `NEXT_PUBLIC_SUPABASE_ANON_KEY`, enable Google OAuth in Supabase Auth, and add the app callback URL in the Supabase dashboard.
- If Google OAuth is not configured, the button safely returns to the landing page and does not affect guest access.

## Startup Validation

The server now validates configuration more clearly so local and staging mistakes fail fast with founder-readable messages.

Examples:

- missing `SUPABASE_SERVICE_ROLE_KEY` tells you the exact variable name and where to find it
- malformed `NEXT_PUBLIC_SUPABASE_URL` tells you to use the project root URL
- malformed `NEXT_PUBLIC_LIVEKIT_URL` tells you to use the websocket origin without a path
- placeholder values copied from `.env.example` are treated as invalid until replaced

## Staging Verification

Before inviting testers into staging:

1. Set these exact variables in the staging environment:
   - `NEXT_PUBLIC_APP_URL`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` if you want the Google sign-in button to start Supabase OAuth
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_LIVEKIT_URL`
   - `LIVEKIT_API_KEY`
   - `LIVEKIT_API_SECRET`
   - `ADMIN_ACCESS_PASSWORD`
2. Open `/api/health` on the staging URL and confirm it returns HTTP `200` with `status: "ok"`.
3. Open `/admin` and confirm the admin password works.
4. Run a two-browser smoke test through onboarding, queue, match, voice, and end session.

Supabase schema files live in:

- [supabase/migrations/202604140001_phase1_schema.sql](supabase/migrations/202604140001_phase1_schema.sql)
- [supabase/migrations/202604140002_phase2_refinements.sql](supabase/migrations/202604140002_phase2_refinements.sql)
- [supabase/migrations/202604140003_tiered_matching.sql](supabase/migrations/202604140003_tiered_matching.sql)
- [supabase/migrations/202604140004_atomic_match_claiming.sql](supabase/migrations/202604140004_atomic_match_claiming.sql)
- [supabase/migrations/202604290001_supabase_security_hardening.sql](supabase/migrations/202604290001_supabase_security_hardening.sql)
- [supabase/migrations/202605210001_beta_feedback_auth_controls.sql](supabase/migrations/202605210001_beta_feedback_auth_controls.sql)
- [supabase/seed.sql](supabase/seed.sql)

These SQL files now define the backend persistence layer expected by the route handlers.

## Supabase Security

The app does not use direct browser-to-Supabase data access for MVP flows. All database reads and writes go through the Next.js server using the service-role key.

The security migration [supabase/migrations/202604290001_supabase_security_hardening.sql](supabase/migrations/202604290001_supabase_security_hardening.sql) now codifies that posture by:

- enabling RLS on internal tables
- revoking table access from `anon` and `authenticated` roles
- revoking execute access on internal matching RPCs
- setting an explicit `search_path` on custom matchmaking functions to satisfy Supabase security linting

If a new Supabase environment shows public-access warnings, apply the repo migrations instead of fixing permissions only in the dashboard.

## Atomic Claiming

Matching is now hardened through database functions rather than application-side claim orchestration.

- `claim_tiered_match(...)` locks the initiator queue entry, finds a candidate with `FOR UPDATE SKIP LOCKED`, inserts the match, claims both participants, updates queue rows, and writes `match_created` audit events in one transaction
- `end_match_transactional(...)` ends the match, clears active participants, and writes `match_ended` in one transaction
- `active_match_participants` provides a database-level uniqueness guard so one user cannot be active in multiple matches at once
- `queue_entries_active_user_idx` prevents a user from owning multiple queued entries at the same time

Why row locking is used:

- it prevents two concurrent requests from claiming the same queue row
- it keeps the claim path DB-driven instead of relying on app-server memory
- it makes repeated frontend polling safe because an existing active match is returned instead of creating a duplicate

Risks now solved:

- duplicate claims on the same candidate queue entry
- duplicate active matches for the same user through the intended claim path
- audit records claiming a match that never committed

Scaling risks still remaining:

- a single queue table can still become a hotspot under much larger traffic
- fairness and throughput tuning may require worker-based claim orchestration later
- very high concurrency may benefit from queue partitioning or sharded matching lanes

## Suggested Next Step

After reviewing the current MVP voice flow, the recommended next implementation step is:

1. lock down admin access with real authentication and authorization
2. add observability around claim retries, match latency, and failed transaction paths
3. harden admin auth, audit review tools, and operator workflows before real beta traffic
4. evaluate queue partitioning or worker-based matching if throughput grows sharply

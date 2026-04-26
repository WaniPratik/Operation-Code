# Architecture Recommendation

## Architecture Goals

- web-first and mobile-responsive
- easy for external developers to audit
- minimal moving parts for MVP
- clear boundaries for future voice, billing, moderation, and analytics
- strong support for safety and operational visibility

## Recommended Stack

### Frontend

Recommendation:

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui-style component patterns only if needed later, not as a dependency requirement on day one

Rationale:

- Next.js is conventional, well-supported, and suited to web-first product development.
- App Router provides a modern model for server/client separation.
- TypeScript improves long-term maintainability and external contributor confidence.
- Tailwind supports rapid responsive UI implementation without introducing heavy design-system overhead too early.

Tradeoffs:

- Next.js can blur frontend/backend boundaries if discipline is weak.
- Tailwind can become inconsistent without component conventions.

### Backend

Recommendation:

- Use the Next.js application as the initial backend-for-frontend
- Implement route handlers and server-side domain services for MVP
- Keep business logic in explicit service modules under `src/server`
- Use polling/fetch for match updates in MVP instead of adding websockets before voice

Rationale:

- Fewer deployables makes MVP iteration faster.
- A single repo simplifies onboarding and auditing.
- Service separation keeps future extraction possible if scaling needs change.

Tradeoffs:

- If realtime needs or asynchronous workloads expand quickly, some logic may later move to dedicated services.
- Discipline is required to prevent route handlers from becoming the entire backend.

### Database

Recommendation:

- Postgres via Supabase

Rationale:

- Mature relational model is a strong fit for users, blocks, reports, queue state, subscriptions, and audit events.
- Supabase accelerates setup while preserving a standard Postgres core.
- Future row-level security can help reduce accidental overexposure.

Tradeoffs:

- Supabase convenience can encourage direct client-database coupling if not controlled.
- Queueing and realtime presence patterns need careful design; not every “realtime” use case should depend on database subscriptions.

### Auth

Recommendation:

- Guest-session-first onboarding in Phase 1
- Supabase Auth later when the placeholder shell is replaced by real backend-backed identity

Recommended current planning stance:

- use a real internal user record from the start
- avoid public profile requirements
- use an httpOnly guest-session cookie validated against a persisted guest session table
- document anonymity as user-facing anonymity, not platform invisibility

Tradeoffs:

- True guest flows reduce friction but make enforcement harder.
- Stronger identity verification improves moderation leverage but may reduce conversion.

### Subscriptions

Recommendation:

- Stripe for future paid plans
- Store subscription status and feature entitlements in Postgres

Rationale:

- Stripe is conventional and easy for outside developers to audit.
- Entitlements should live in application-controlled tables, not only in webhook payload memory.

Tradeoffs:

- Billing integration introduces compliance, support, and entitlement-sync complexity.
- Premium filters raise fairness, disclosure, and policy questions beyond payments alone.

### Realtime Voice Later

Recommendation:

- Add a dedicated voice provider later behind a provider abstraction
- Evaluate LiveKit first, with Daily and Twilio as alternatives

Why this direction:

- Voice is the core product, but building it too early creates avoidable complexity.
- A provider boundary allows experimentation without rewriting product logic.

Suggested future architecture boundary:

- matchmaking service decides match
- session service creates conversation/session record
- voice adapter provisions provider-specific room/session
- client joins provider only after server-side authorization

Tradeoffs:

- Each provider has different pricing, moderation hooks, and browser quality characteristics.
- Some providers are easier for room orchestration; others are easier for enterprise support.

### Moderation / Admin Tools

Recommendation:

- Build a separate protected admin surface inside the same repo initially
- Keep moderation data models first-class from the beginning

Core later capabilities:

- report review queue
- user moderation history
- block relationship inspection
- enforcement actions
- audit event timeline

Tradeoffs:

- Putting admin in the same repo is efficient early, but requires strong route protection and role separation.
- Moderation tooling often grows into a product of its own; the MVP should avoid pretending otherwise.

## Proposed Application Boundaries

### Web App Layer

Responsibilities:

- landing page
- onboarding UI
- queue status UI
- future session UI
- report/block actions

### Domain Services Layer

Responsibilities:

- identity lifecycle
- queue lifecycle
- match eligibility rules
- tiered match relaxation based on queue wait time
- report intake
- block enforcement
- subscription entitlement checks later

### Persistence Layer

Responsibilities:

- Postgres schema
- migrations
- audit event persistence
- moderation records
- transactional queue claiming and active participant integrity

Recommended matching integrity pattern:

- claim matches inside Postgres, not in application memory
- use `SELECT ... FOR UPDATE SKIP LOCKED` to avoid duplicate row claims under concurrency
- keep match insert, queue updates, participant claiming, and `match_created` audit writes in one transaction
- maintain a dedicated `active_match_participants` table so the database can enforce one active match per user

### External Provider Layer

Responsibilities:

- auth provider integration details
- billing provider integration details
- voice provider integration details later

## Data Model Direction

Core entities to expect:

- users
- user_profiles or anonymous_handles
- queue_entries
- matches
- sessions
- reports
- blocks
- moderation_actions
- subscriptions
- audit_events

Important note:

- “Anonymous” should describe the user-facing experience, not the absence of internal records.
- The first schema should store only moderation-relevant metadata and should not store voice recordings.

## Auditability Recommendations

- Log key state transitions for queue and session lifecycle
- Record moderation actions with actor, timestamp, and reason
- Keep sensitive payload retention intentionally narrow
- Separate operational telemetry from user-visible product events
- Capture anonymized device/session fingerprinting only where it is justified for abuse tracing
- For match creation and match end, write audit rows inside the same DB transaction as the lifecycle change

## Security Recommendations

- Use server-side authorization for all sensitive actions
- Avoid direct client writes to privileged moderation tables
- Plan row-level security carefully before exposing direct data access patterns
- Use environment-based config separation from the beginning
- Lock down admin routes before any public deployment

## Why This Stack Is Recommended

This stack is modern, conventional, and understandable to outside engineers. It reduces MVP complexity while preserving clean seams for the hard parts that come later: voice quality, safety tooling, subscriptions, and moderation operations.

## Remaining Scaling Risks

- The current queue design is appropriate for beta traffic, but a single queue table may become a contention point at larger scale.
- If traffic grows materially beyond the current target, consider queue partitioning, regional lanes, or dedicated background workers for claim orchestration.
- Polling is acceptable before realtime voice, but it is not the final shape for large-scale session transitions.

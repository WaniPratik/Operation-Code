# Product Requirements Document

## Product Summary

Build a web-first platform where strangers can be matched into anonymous voice conversations. The product should feel lightweight and fast to enter, while preserving future options for moderation, reporting, premium subscriptions, and policy enforcement.

The first milestone is a bare-bones MVP foundation, not a full production launch.

## Product Goals

- Validate demand for anonymous/random voice matching
- Keep onboarding light enough to reduce drop-off
- Design for mobile web usage from day one
- Preserve strong future moderation and auditability options
- Avoid overcommitting to voice infrastructure before core product mechanics are validated

## Non-Goals For This First Pass

- Building realtime voice
- Building native mobile apps
- Implementing advanced personalization
- Building a full trust-and-safety program
- Building full billing or premium access enforcement

## Target User Problem

Users want a quick, low-friction way to talk to a new person without the overhead of profiles, feeds, or long setup. The product should reduce friction while keeping enough structure to support safety controls and platform learning later.

## Locked Phase 1 Product Decisions

- Minimum age is 18+.
- The age gate is self-attestation only for MVP.
- Auth starts with guest sessions first.
- Anonymous identity still maps to an internal user record.
- Requeue is allowed instantly.
- Reconnect/rematch is not part of MVP.
- Reporting and blocking are mandatory even in a minimal MVP.
- Premium filters are future monetization only.
- Voice recordings are not stored.
- Moderation metadata retention is limited to user id, anonymous handle, session id, match id, report id, block records, timestamps, anonymized device/session fingerprint where appropriate, and audit events.

## Locked Phase 2 Product Decisions

- The system remains anonymous-first. Names and editable identity are not part of MVP.
- Guest session is required for all users.
- Country filtering is the only queue filter in MVP.
- Users can select up to 2 preferred countries and up to 2 excluded countries.
- No language filter in MVP.
- No gender filter in MVP.
- A pre-connection screen exists for 2 seconds before future voice handoff.
- Reporting or blocking a user ends the session immediately.
- Cooldown logic is logged only and not enforced yet.
- Admin moderation backend is required in MVP.

## MVP Definition

### 1. Landing Page

Purpose:

- explain the product simply
- establish trust and safety positioning
- guide a new user into onboarding

Should include:

- concise value proposition
- safety and anonymity explanation
- basic CTA to start
- high-level moderation/reporting positioning
- mobile-responsive layout

### 2. Simple Signup / Age Gate Placeholder Plan

The MVP should use a lightweight onboarding path with the following locked decisions:

- user enters through the web app
- user confirms they are 18+ through a self-attested age gate step
- user creates or receives a minimal account/session identity
- the session is guest-first for MVP

Important:

- This step must not be represented as compliant age verification beyond self-attestation.
- Jurisdiction-specific policy and stronger verification requirements remain future decisions.

### 3. Anonymous User Identity Concept

The user experience should feel anonymous, but the system still needs internal identity primitives for:

- queue membership
- block relationships
- reports
- subscription state later
- moderation actions

Recommended concept:

- internal user ID
- generated anonymous handle
- no public profile requirement for MVP
- no editable identity fields in MVP

### 4. Queue / Matchmaking Concept

Users should be able to:

- enter a waiting state
- be matched with another available user
- eventually enter a voice session

For this first pass, the product definition focuses on the lifecycle and rules rather than the voice implementation.

Core matchmaking requirements:

- user can join queue
- user can leave queue
- user should not match with blocked users
- user state transitions should be traceable
- avoid immediate rematch with the same user when possible
- country include/exclude filters must be respected
- premium filter hooks should be possible later without rewriting the core system

### 5. Report / Block Concept

Required for MVP planning:

- user can report another user after a session
- user can block another user
- a blocked relationship should affect future match eligibility
- reports should create moderation-reviewable records
- reporting or blocking should end the session immediately if it is still active

Locked report reasons:

- harassment
- sexual content
- hate or abuse
- spam or scam
- underage concern
- other

Locked metadata retention:

- user id
- anonymous handle
- session id
- match id
- report id
- block records
- timestamps
- anonymized device/session fingerprint where appropriate
- audit events

### 6. Subscription Concept For Future Premium Filters

Premium is out of MVP scope for implementation, but it must be anticipated in the product model.

Planned future concept:

- free tier joins the general queue
- paid tier may apply optional cohort filters before entering queue
- filters should narrow eligibility, not create misleading guarantees

Future premium filters remain out of scope. The earlier examples under discussion were:

- gender
- country or region
- language

They remain future-only and are not implemented in MVP.

### 7. Admin / Moderation Console Concept

Not part of the first shipping MVP, but should exist in the architecture plan.

The admin surface should eventually allow:

- review of reports
- review of user-level moderation history
- blocklist and enforcement actions
- queue/session audit inspection
- subscription support visibility later

## Success Criteria For Early MVP

- users can understand the product quickly
- onboarding friction is low
- queue entry and match lifecycle are clearly defined
- moderation primitives exist in the product model
- the engineering foundation can support safe iteration

## Risks

- anonymous products can attract abuse quickly
- age-related compliance decisions may materially affect onboarding design
- voice provider choice may influence architecture later
- premium filters may create policy and fairness concerns

## Remaining Open Questions

- Which jurisdictions, if any, require a stronger age or identity flow before launch?
- Should reporting also be available during a future live voice session, not only after it?
- What admin roles and moderation permissions will exist in the first protected console?
- Which premium filter combinations are acceptable from a fairness and policy perspective?

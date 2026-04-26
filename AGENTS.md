# AGENTS.md

This file defines the operating rules for engineers and AI agents working in this repository.

## Mission

Build a web-first, mobile-responsive anonymous voice matching platform with strong safety, auditability, and clean architectural boundaries.

This repo should optimize for:

- clarity for non-technical stakeholders
- external auditability
- fast MVP iteration
- safe extension into moderation, subscriptions, and realtime voice

## Non-Negotiable Product Rules

- Ask before assuming product behavior when a decision affects trust, safety, payments, moderation, privacy, or legal exposure.
- Document every material product assumption in the relevant doc or pull request.
- Do not present unfinished systems as complete.
- Do not add fake implementations, misleading mocks, or placeholder logic disguised as production-ready behavior.
- If functionality is stubbed for interface development, label it clearly as non-production and non-complete.

## Coding Rules

- Use TypeScript for application and server code.
- Use Next.js conventions unless there is a documented reason to diverge.
- Prefer small, explicit modules over clever abstractions.
- Keep business logic out of UI components when possible.
- Validate all external inputs at system boundaries.
- Favor readability and auditability over premature optimization.
- Keep naming consistent with the product language used in the docs.
- Avoid dead scaffolding. If a module exists, it should have a clear planned purpose.

## Architecture Constraints

- The web app is the primary client for the MVP.
- Mobile responsiveness is required from the start, even before native apps exist.
- The system must be designed so queueing, moderation, reporting, and audit events can be traced later.
- Realtime voice is a later integration and must remain replaceable behind a clear provider boundary.
- Payment and premium filtering logic must be isolated from core matchmaking so pricing experiments do not destabilize the platform.
- Admin and moderation functions must be separated from end-user surfaces.
- Database access patterns should support future row-level security and audit-friendly event trails.

## Security Expectations

- Treat moderation, abuse prevention, and user safety as core requirements, not add-ons.
- Minimize collection of personally identifying information in the MVP.
- Avoid storing unnecessary voice or session content by default.
- Record moderation-relevant metadata intentionally and transparently.
- Use least-privilege credentials and environment separation.
- Never expose secrets to the client.
- Require explicit review before implementing sensitive data retention behavior.
- Plan for rate limiting, abuse controls, and suspicious-behavior monitoring before public launch.

## Testing Expectations

- Add automated tests for business-critical logic as it is introduced.
- Prioritize tests for matchmaking state transitions, reporting, blocking, authorization, and billing gates.
- Add integration tests around API boundaries and persistence behavior.
- Add end-to-end coverage for core user journeys once the MVP shell exists.
- Do not rely on manual testing alone for safety-critical or billing-related behavior.
- If a feature is not tested yet, state that clearly.

## Documentation Expectations

- Keep docs aligned with the codebase.
- Update product docs when major behavior changes.
- Record open questions instead of silently resolving them in code.
- Prefer explicit tradeoff notes when choosing vendors, auth models, or moderation strategies.

## Ask Before Assuming Product Behavior

Agents and engineers must pause and ask for clarification before deciding:

- minimum age policy and jurisdiction handling
- whether anonymous users must verify email or phone
- what metadata is retained for moderation
- what counts as a reportable offense category set
- what subscription filters will eventually be offered
- whether cohort filters affect only discovery or also match eligibility
- whether users can reconnect, favorite, or friend each other later

If a temporary assumption is necessary to continue planning work, it must be labeled as an assumption in the relevant document.

## No Fake Completeness

The following are prohibited:

- mock flows described as if they are secure
- placeholder moderation dashboards implied to be operational
- queue logic that pretends to be fair or abuse-resistant without the real rules being defined
- fake subscription enforcement
- fake safety checks presented as production-ready protection

Allowed:

- clearly labeled scaffolds
- interface-only placeholders
- documented future integration points
- non-production examples used for discussion

## Preferred Delivery Order

1. Product clarity
2. Architecture boundaries
3. Data model and audit model
4. MVP web shell
5. Queue and matching
6. Safety controls
7. Voice integration
8. Premium expansion


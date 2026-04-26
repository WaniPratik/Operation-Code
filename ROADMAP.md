# Roadmap

## Overview

The roadmap prioritizes fast validation without compromising long-term architecture. Each phase should end with a review before the next phase begins.

## Phase 0: Repo And Planning

Goals:

- establish repository structure
- define product requirements
- document architecture and tradeoffs
- define MVP boundaries
- document user flows and open questions

Outputs:

- root documentation set
- agreed assumptions list
- approved next implementation slice

Exit criteria:

- founder understands MVP boundaries
- engineering direction is approved
- unresolved decisions are clearly listed

## Phase 1: Web MVP Shell

Goals:

- scaffold the Next.js application
- implement responsive landing page
- implement basic onboarding shell
- define initial design tokens and layout conventions
- establish testing and CI baseline

Outputs:

- deployable web shell
- basic route structure
- placeholder-ready but honestly labeled onboarding experience

Exit criteria:

- landing page works on desktop and mobile
- codebase conventions are established
- initial schema direction is ready for implementation

## Phase 2: Queue And Matching

Goals:

- implement internal user identity model
- implement queue join/leave flow
- implement eligibility checks
- implement match creation lifecycle
- implement report and block primitives
- implement audit logging
- implement admin backend read APIs

Outputs:

- functioning queue state machine
- auditable match records
- report/block data model and APIs
- basic moderation/admin backend access to reports, users, matches, and audit logs

Exit criteria:

- a user can join queue, be matched, end, report, and block at the product level
- safety-critical state transitions are test-covered

## Phase 3: Voice Integration

Goals:

- choose provider
- implement provider abstraction
- provision voice sessions after a successful match
- add session authorization and reliability handling

Outputs:

- working voice session handoff
- session lifecycle instrumentation
- operational playbook for provider issues

Exit criteria:

- matched users can successfully enter and leave a voice session
- provider integration is observable and replaceable

## Phase 4: Premium Filters And Moderation Expansion

Goals:

- integrate subscriptions
- implement entitlement-aware queue preferences
- expand admin/moderation tooling
- improve abuse prevention and support workflows

Outputs:

- premium plan model
- filter application flow
- moderation review console
- stronger enforcement and audit tools

Exit criteria:

- premium features are gated correctly
- moderation team can review and act on reports
- filter behavior is measurable and supportable

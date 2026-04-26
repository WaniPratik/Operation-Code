# User Flows

## Purpose

These flows describe the intended product behavior at a conceptual level. They are not yet implementation specs. Open decisions are called out where needed.

## 1. New User Enters Platform

1. User lands on the marketing/home page.
2. User reads a concise explanation of anonymous voice matching and platform safety posture.
3. User taps the primary CTA to begin.
4. User is presented with an age gate and lightweight onboarding step.
5. Platform creates or restores an internal user identity.
6. User reaches the ready state where they can join the queue.

Locked Phase 1 behavior:

- Auth is guest-session-first.
- The age gate is 18+ self-attestation only and must be labeled honestly as such.
- Identity is generated and anonymous-first, not user-editable.

## 2. User Joins Queue

1. User reviews the queue entry screen.
2. User optionally sees any future eligibility or safety reminders.
3. User taps “Join Queue”.
4. Platform creates a queue state record for the user.
5. Platform marks the user as actively waiting.
6. User sees waiting status and can leave the queue.
7. Queue preferences may include up to 2 preferred countries and up to 2 excluded countries.

Rules:

- A blocked user should not be eligible for matching with someone they blocked or who blocked them.
- Queue entry and exit should be auditable.

## 3. User Gets Matched

1. Matchmaking logic identifies another eligible waiting user.
2. Platform reserves the match and prevents duplicate concurrent assignment.
3. Both users are moved out of general waiting state.
4. A match/session record is created.
5. Users are shown that a match has been found.
6. User sees a 2-second pre-connection screen.
7. In a later phase, the voice session provider would be initialized.

Important:

- This repo foundation does not implement realtime voice yet.
- Match lifecycle should still be defined clearly before voice is added.

## 4. User Ends Session

1. User chooses to end the conversation, or the session ends for both sides.
2. Platform marks the active session as ended.
3. User is returned to a post-session state.
4. User can choose to rejoin the queue or leave the platform.
5. Platform presents report and block actions where appropriate.

Open questions:

- Should post-session feedback be required, optional, or absent in MVP?
- Post-session feedback remains undecided.

Locked behavior:

- The user can instantly requeue.

## 5. User Reports Another User

1. User selects “Report”.
2. Platform presents a reason selection flow.
3. User optionally adds freeform context if allowed by policy.
4. If the session is still active, the platform ends it immediately.
5. Report record is created and linked to relevant session/match metadata.
6. User receives confirmation that the report was submitted.
7. Moderation queue receives a reviewable case later through the admin console.

Rules:

- Reporting should not depend on the other user still being online.
- Report creation must be traceable.
- Reconnect/rematch is not offered in MVP.

## 6. User Blocks Another User

1. User selects “Block”.
2. Platform confirms the action if needed.
3. If the session is still active, the platform ends it immediately.
4. Block relationship is persisted.
5. Future matchmaking excludes the blocked pairing.
6. User is returned to a safe next step, such as leaving or rejoining queue.

Rules:

- Blocking should affect future eligibility without requiring moderation review first.
- The exact symmetry of block visibility should be a product decision, not an implementation guess.

## 7. Future Premium User Applies A Filter

1. Premium user opens queue preferences.
2. User selects one or more allowed cohort filters.
3. Platform validates entitlement and filter availability.
4. User joins a filtered eligibility pool.
5. Matchmaking considers both the user’s filters and platform-wide eligibility rules.
6. User either receives a filtered match or waits longer.

Future-only premium filters under discussion:

- gender
- country or region
- language

Important guardrails:

- Filters narrow eligibility but should not imply guaranteed outcomes.
- Filter design must be reviewed for fairness, safety, legal, and moderation impact before launch.

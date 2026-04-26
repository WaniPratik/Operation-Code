# Beta Issue Intake

This is a lightweight founder workflow for a very small closed beta.

There is no full ticketing system yet. For now, use one shared place such as:

- a Notion table
- a Google Sheet
- a private doc called `Beta Issues`

## What A Tester Should Send

Ask testers to send these six fields when something breaks:

- anonymous handle
- approximate time
- screen where it happened
- what they expected
- what actually happened
- whether refreshing once fixed it

## Suggested Intake Template

Copy this into your tracker for each issue:

- `Reported by:`
- `Anonymous handle:`
- `Approximate time:`
- `Screen:`
- `Expected result:`
- `Actual result:`
- `Did refresh fix it?`
- `Severity:` blocker / high / medium / low
- `Linked match ID:` if known
- `Linked report/block ID:` if known
- `Founder notes:`
- `Status:` new / investigating / fixed / follow-up needed

## Minimum Founder Triage Rules

Use these simple rules during beta:

- `Blocker`: tester cannot onboard, queue, match, join voice, or leave a broken state
- `High`: moderation, report, block, or admin visibility is wrong
- `Medium`: user can recover, but the flow is confusing or unreliable
- `Low`: copy, layout, or minor polish issue

## When To Pause The Beta

Pause the session if any of these happen repeatedly:

- users are matched but cannot join voice
- report or block does not end the live session
- admin no longer shows reports, blocks, or ended matches clearly
- multiple testers get stuck and cannot recover with refresh or requeue

## Founder Shortcut

If you are overloaded during a tiny beta, capture only this:

- handle
- time
- screen
- one-sentence description

That is enough to let engineering trace most MVP issues later.

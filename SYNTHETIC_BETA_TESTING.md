# Synthetic Beta Testing

This repo includes two safe synthetic test paths so Echotalk.live can be checked before inviting real testers.

These tests create real guest sessions, queue entries, matches, feedback, reports, and blocks in the environment you point them at. Use a local or staging Supabase project. Do not run them against production.

## Safety Defaults

- Tests require `ALLOW_STRESS_TEST=true`.
- API stress tests default to `http://127.0.0.1:3000`.
- Remote API stress tests require `ALLOW_REMOTE_STRESS_TEST=true`.
- The script refuses the public `echotalk.live` domain unless it looks like a staging or preview host.
- No secrets are printed.
- The default API load is small: `10` users.

## Browser-Level Synthetic Flow

This uses Playwright with two synthetic browser users. It checks the human-facing flow:

- open app
- Jump In
- confirm 18+
- join queue
- match with another synthetic user
- reach the live screen
- End & Find Next
- submit feedback
- report and skip
- block when available

First install the browser runtime once:

```bash
npx playwright install chromium
```

Run locally:

```bash
ALLOW_STRESS_TEST=true npm run test:e2e
```

Run against a staging URL:

```bash
ALLOW_STRESS_TEST=true PLAYWRIGHT_BASE_URL=https://your-staging-url.example npm run test:e2e
```

## API Stress Flow

This uses normal HTTP requests and cookie sessions. It does not bypass the app APIs for user actions. It only uses the Supabase service-role key at the end to verify beta-critical invariants.

It checks:

- sessions can be created
- onboarding completes
- users can join queue
- users get matched
- End & Find Next can requeue
- feedback can be submitted
- report/block can end sessions
- no duplicate active queue entries exist
- no stuck active matches remain after cleanup
- no self-matches were created
- blocked pairs did not rematch during the run

Run a small local test while the app is running:

```bash
ALLOW_STRESS_TEST=true STRESS_USERS=10 npm run stress:api
```

Run a larger local test:

```bash
ALLOW_STRESS_TEST=true STRESS_USERS=25 npm run stress:api
```

Run against staging only when intentionally approved:

```bash
ALLOW_STRESS_TEST=true ALLOW_REMOTE_STRESS_TEST=true STRESS_BASE_URL=https://your-staging-url.example STRESS_USERS=10 npm run stress:api
```

Optional higher counts:

```bash
ALLOW_STRESS_TEST=true STRESS_USERS=50 npm run stress:api
```

Use `100` users only after `10`, `25`, and `50` pass cleanly.

## What Good Looks Like

The API script prints:

- users simulated
- sessions created
- queue joins
- matches created
- successful end/find-next loops
- reports submitted
- blocks submitted
- feedback submitted
- failures by endpoint
- average and max response time
- stuck queue count
- stuck match count
- duplicate active queue users
- self matches
- blocked rematches

A beta-ready small run should have:

- at least one match for 2+ users
- `0` duplicate active queue users
- `0` self matches
- `0` blocked rematches
- `0` stuck active matches after cleanup

Some stuck queue rows can appear if a run is interrupted. Re-run the app briefly and use normal queue cleanup, or inspect staging with the admin dashboard before inviting testers.

# Local Setup Guide

This guide explains how to run the project on your own computer in plain English.

The app is a Next.js web app that uses Supabase/Postgres for data storage and LiveKit for the MVP voice room. You do not need to understand the code to follow these steps, but you do need a few tools installed first.

## 1. What You Need On Your Machine

Before starting, make sure your computer has:

- `Git`
- `Node.js` version `20` or newer
- `npm` version `10` or newer
- access to a Supabase project
- access to a LiveKit project or local LiveKit server

If you are not sure whether these are installed:

1. Open your Terminal app.
2. Run these commands one at a time:

```bash
git --version
node -v
npm -v
```

What you want to see:

- Git prints a version number
- Node prints something like `v20.x.x` or newer
- npm prints something like `10.x.x` or newer

If `node` or `npm` says “command not found”, Node is not installed yet.

## 2. Install Node.js If Needed

The easiest approach is:

1. Go to [nodejs.org](https://nodejs.org/)
2. Install the current `LTS` version
3. After installation finishes, close and reopen Terminal
4. Run:

```bash
node -v
npm -v
```

Again, make sure Node is at least version `20`.

## 3. Get the Project Code

If the project is already on your machine, open Terminal and go into the project folder.

Example:

```bash
cd "/Users/pratikwani/Desktop/Code"
```

If the project is not on your machine yet, clone it first using Git, then `cd` into the folder.

## 4. Install Project Dependencies

Once you are inside the project folder, run:

```bash
npm install
```

This downloads all the packages the app needs.

The first run may take a few minutes.

## 5. Create Your Local Environment File

This project includes a template file called `.env.example`.

You need to make your own local copy called `.env.local`.

Run:

```bash
cp .env.example .env.local
```

This creates the file.

Then open `.env.local` in a text editor and fill in the real values.

## 6. Which Supabase Keys You Need

You need these values from your Supabase project and your LiveKit setup:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` if you want to test the optional Google sign-in entry point
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `ADMIN_ACCESS_PASSWORD`

What each one means:

- `NEXT_PUBLIC_SUPABASE_URL`: the web address of your Supabase project
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: the public Supabase anon or publishable key used only to start Google sign-in
- `SUPABASE_SERVICE_ROLE_KEY`: a powerful backend key used by the server
- `NEXT_PUBLIC_APP_URL`: the local address where the app runs, usually `http://localhost:3000`
- `NEXT_PUBLIC_LIVEKIT_URL`: the LiveKit websocket address, usually `wss://...` for LiveKit Cloud or `ws://localhost:7880` for a local LiveKit server
- `LIVEKIT_API_KEY`: the server-side key used to create room tokens
- `LIVEKIT_API_SECRET`: the server-side secret used to create room tokens and clean up rooms when a match ends
- `ADMIN_ACCESS_PASSWORD`: the shared internal password that unlocks the admin dashboard at `/admin`

Your `.env.local` should look like this:

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-or-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your-livekit-api-key
LIVEKIT_API_SECRET=your-livekit-api-secret
ADMIN_ACCESS_PASSWORD=change-this-local-admin-password
```

Important:

- Do not share `SUPABASE_SERVICE_ROLE_KEY`
- Do not share `LIVEKIT_API_SECRET`
- Do not post either one in chat, screenshots, or public docs
- They give broad backend access

## 7. How To Find These Values In Supabase

In Supabase:

1. Open your project dashboard
2. Go to `Project Settings`
3. Go to `API`
4. Copy:
   - the project URL
   - the `anon` or publishable key if you want to test Google sign-in
   - the `service_role` key

In LiveKit:

1. Open your LiveKit project or server dashboard
2. Copy the websocket server URL
3. Copy the API key
4. Copy the API secret

Choose your own internal admin password and add that too.

Paste all of those into `.env.local`

Founder-safe reminder:

- `NEXT_PUBLIC_SUPABASE_URL` must be the project root URL like `https://your-project.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` is optional for the anonymous guest flow; add it only when you are ready to test Supabase Google OAuth
- `NEXT_PUBLIC_LIVEKIT_URL` must be the websocket server origin like `wss://your-project.livekit.cloud`
- do not leave any `.env.example` placeholder value unchanged, or the app will now fail readiness checks on purpose

Optional Google sign-in reminder:

- Guest access works without Google.
- To make Google sign-in complete, enable Google as a provider in Supabase Auth and add the correct callback URL in the Supabase dashboard.
- Until that dashboard setup is done, use `Continue as guest` for beta testing.

## 8. Run Database Migrations

The project includes SQL migration files in:

- `supabase/migrations/202604140001_phase1_schema.sql`
- `supabase/migrations/202604140002_phase2_refinements.sql`
- `supabase/migrations/202604140003_tiered_matching.sql`
- `supabase/migrations/202604140004_atomic_match_claiming.sql`
- `supabase/migrations/202604290001_supabase_security_hardening.sql`
- `supabase/migrations/202605210001_beta_feedback_auth_controls.sql`
- `supabase/migrations/202605210002_feedback_optional_text.sql`

There are two common ways to run them.

### Option A: Use the Supabase SQL Editor

This is the easiest option for a non-technical founder.

For each migration file:

1. Open the file
2. Copy all of its SQL
3. In Supabase, open `SQL Editor`
4. Paste the SQL
5. Click `Run`

Run them in this exact order:

1. `202604140001_phase1_schema.sql`
2. `202604140002_phase2_refinements.sql`
3. `202604140003_tiered_matching.sql`
4. `202604140004_atomic_match_claiming.sql`
5. `202604290001_supabase_security_hardening.sql`
6. `202605210001_beta_feedback_auth_controls.sql`
7. `202605210002_feedback_optional_text.sql`

### Option B: Use the Supabase CLI

If you already use the Supabase CLI, you can run migrations from the command line instead.

That workflow depends on your Supabase CLI setup, so if you are not comfortable with it, use Option A above.

Security note:

- This MVP does not read or write Supabase directly from the browser.
- Do not add public table access for `anon` or `authenticated` just to make local testing easier.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` is only for the optional Supabase Google OAuth entry point; product data still flows through server routes.
- The migration `202604290001_supabase_security_hardening.sql` is the repo-owned source of truth for RLS, locked-down table access, and private matching RPC permissions.
- If a future Supabase project shows security warnings, re-run the repo migrations instead of patching permissions only in the dashboard.

## 9. Seed the Database

This project includes sample seed data in:

- `supabase/seed.sql`

To load it:

1. Open `supabase/seed.sql`
2. Copy the SQL
3. Open the Supabase `SQL Editor`
4. Paste it
5. Click `Run`

This creates sample records that make manual testing easier.

## 10. Start the App

Inside the project folder, run:

```bash
npm run dev
```

If everything works, the terminal will show a local web address, usually:

- [http://localhost:3000](http://localhost:3000)

Open that link in your browser.

## 11. Quick Readiness Check

Before testing the full product flow, confirm the app sees the right configuration.

Open this URL in your browser:

- [http://localhost:3000/api/health](http://localhost:3000/api/health)

What you want to see:

- HTTP status `200`
- JSON with `"status": "ok"`
- checks for:
  - app boot
  - app URL
  - Supabase config
  - LiveKit config
  - admin password

If something is wrong:

- the route returns HTTP `503`
- the JSON explains which variable is missing or malformed
- no secret values are shown in the response

Before inviting anyone into a private beta, also review `BETA_CHECKLIST.md` in the repo. It gives a short founder-friendly launch checklist for local and staging smoke tests.

## 12. Run the Tests

To run the automated tests:

```bash
npm run test
```

This checks the matching logic and some queue/match/report flow behavior.

If tests pass, you should see a success summary in Terminal.

## 13. Open Two Local User Sessions For Manual Testing

Because the app uses guest sessions stored in cookies, the easiest way to simulate two different users is to use two separate browser contexts.

### Easiest method

1. Open the app in your normal browser window
2. Open the app again in a private/incognito window

These will usually behave like two separate guest users.

### Even better method

Use two different browsers, for example:

- Chrome
- Safari

Then:

1. Open [http://localhost:3000](http://localhost:3000) in Browser 1
2. Open [http://localhost:3000](http://localhost:3000) in Browser 2
3. Complete onboarding in both
4. Join the queue in both
5. Watch for the match flow

### Good manual test flow

1. Open two separate sessions
2. Complete onboarding in both
3. Pick compatible country filters
4. Join the queue in both sessions
5. Confirm they match
6. Wait for the matched screen to enter the live voice room
7. Speak from one browser and confirm the other can hear it
8. End the match in one session
9. Submit a report or block
10. Open `/admin`, enter the admin password, and inspect live moderation data

## 13. Common Setup Errors And Fixes

### Error: `node: command not found`

Cause:

- Node.js is not installed

Fix:

- Install Node.js LTS from [nodejs.org](https://nodejs.org/)

### Error: `npm: command not found`

Cause:

- Node.js was not installed correctly

Fix:

- Reinstall Node.js and reopen Terminal

### Error: `Missing required environment variable`

Cause:

- `.env.local` is missing
- or one of the required values is blank

Fix:

1. Make sure `.env.local` exists
2. Check that these are filled in:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_APP_URL`

### Error: app starts but API requests fail

Cause:

- Supabase credentials are wrong
- LiveKit credentials are wrong
- migrations were not run
- tables/functions are missing

Fix:

1. Double-check `.env.local`
2. Re-run the migrations in order
3. Re-run `supabase/seed.sql` if needed
4. Make sure `NEXT_PUBLIC_LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, and `ADMIN_ACCESS_PASSWORD` are filled in

### Error: onboarding works but queue never matches

Cause:

- only one user session is active
- country filters are incompatible
- migrations for tiered/atomic matching were not run

Fix:

1. Open a second browser session
2. Make sure countries are compatible
3. Verify these migrations ran successfully:
   - `202604140003_tiered_matching.sql`
   - `202604140004_atomic_match_claiming.sql`

### Error: `/admin` shows empty data

Cause:

- no user activity has happened yet
- seed data was not loaded

Fix:

1. Run through onboarding and queue flows first
2. Or load `supabase/seed.sql`

### Error: the match happens but voice does not connect

Cause:

- LiveKit URL/key/secret are missing or wrong
- the browser blocked microphone permission
- the browser blocked audio playback until you click once

Fix:

1. Double-check `NEXT_PUBLIC_LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET`
2. When the browser asks for microphone access, click `Allow`
3. If the page shows `Enable audio`, click it once
4. If you are using a local LiveKit server, confirm it is actually running

### Error: duplicate or strange session behavior while testing

Cause:

- the same browser profile is reusing the same guest cookie

Fix:

- use an incognito window
- or use a different browser
- or clear site data for `localhost:3000`

## 14. If You Want The Simplest Possible Checklist

1. Install Node.js 20+
2. Open Terminal in the project folder
3. Run `npm install`
4. Run `cp .env.example .env.local`
5. Fill in Supabase URL and service role key
6. Run all migration SQL files in Supabase, in order
7. Run `supabase/seed.sql`
8. Run `npm run dev`
9. Open [http://localhost:3000](http://localhost:3000)
10. Use two browser sessions to test matching and voice

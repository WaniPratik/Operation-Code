# Private Beta Checklist

This checklist is for the founder before inviting a small group of real testers. It focuses on the current MVP only.

## 1. Confirm the Environment Is Pointing at the Right Services

Make sure the app is using the correct `.env.local` or staging values for:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `ADMIN_ACCESS_PASSWORD`

For staging, double-check that you are not accidentally pointing at local services.

## 2. Run the Two-User Product Smoke Test

Use two separate browser sessions, such as:

- normal browser window
- private/incognito window

Then confirm both users can:

1. load the landing page
2. complete onboarding
3. join the queue
4. get matched
5. enter voice successfully
6. end the session cleanly

## 3. Run the Safety Smoke Test

During an active match, confirm that one user can:

- submit a report
- block the other user
- end the live session immediately as part of that action

Then confirm the other user is removed from the live match experience instead of staying stuck in voice.

## 4. Check the Founder Admin Dashboard

Open `/admin` and confirm you can:

- sign in with `ADMIN_ACCESS_PASSWORD`
- see active matches
- see recent ended matches
- see reports
- see blocks
- see audit events
- end an active match from the dashboard

## 5. Confirm Beta Support Basics Before Inviting People

Before you invite testers, make sure you know:

- who will watch reports and blocks during the beta
- how testers can contact you if they get stuck
- what message you will send if you pause the beta
- how to remove or rotate secrets if a staging environment is exposed

The goal is not to have perfect operations yet. The goal is to avoid being surprised during a small private beta.

For day-of-beta support, use `BETA_ISSUE_INTAKE.md` to capture issues and `BETA_TESTING_SCRIPT.md` to run the live session in a consistent way.

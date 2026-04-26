insert into public.users (id, auth_provider)
values
  ('11111111-1111-1111-1111-111111111111', 'guest'),
  ('22222222-2222-2222-2222-222222222222', 'guest')
on conflict (id) do nothing;

insert into public.anonymous_profiles (
  user_id,
  anonymous_handle,
  age_attested_over_18,
  onboarding_completed_at,
  device_fingerprint_hash,
  country_code
)
values
  (
    '11111111-1111-1111-1111-111111111111',
    'QuietHarbor321',
    true,
    timezone('utc', now()),
    'fp_demo_alpha',
    'US'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'VelvetEcho654',
    true,
    timezone('utc', now()),
    'fp_demo_beta',
    'CA'
  )
on conflict (user_id) do nothing;

insert into public.guest_sessions (
  id,
  user_id,
  token_hash,
  fingerprint_hash
)
values
  (
    '99999999-9999-9999-9999-999999999999',
    '11111111-1111-1111-1111-111111111111',
    'token_seed_alpha',
    'fp_demo_alpha'
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '22222222-2222-2222-2222-222222222222',
    'token_seed_beta',
    'fp_demo_beta'
  )
on conflict (id) do nothing;

insert into public.queue_entries (
  id,
  user_id,
  status,
  queue_channel,
  preferred_country_codes,
  excluded_country_codes
)
values
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'matched', 'general', '{CA}', '{}'),
  ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 'matched', 'general', '{US}', '{}')
on conflict (id) do nothing;

insert into public.matches (
  id,
  session_id,
  user_a_id,
  user_b_id,
  queue_entry_a_id,
  queue_entry_b_id,
  status,
  matched_at
)
values
  (
    '55555555-5555-5555-5555-555555555555',
    '66666666-6666-6666-6666-666666666666',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333',
    '44444444-4444-4444-4444-444444444444',
    'ended',
    timezone('utc', now()) - interval '5 minutes'
  )
on conflict (id) do nothing;

update public.matches
set ended_at = timezone('utc', now()) - interval '1 minute',
    end_reason = 'demo_seed'
where id = '55555555-5555-5555-5555-555555555555';

insert into public.reports (
  id,
  reporter_user_id,
  reported_user_id,
  match_id,
  session_id,
  reason,
  details
)
values
  (
    '77777777-7777-7777-7777-777777777777',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '55555555-5555-5555-5555-555555555555',
    '66666666-6666-6666-6666-666666666666',
    'spam or scam',
    'Seed record for local moderation workflow demos.'
  )
on conflict (id) do nothing;

insert into public.blocks (
  id,
  blocker_user_id,
  blocked_user_id,
  match_id
)
values
  (
    '88888888-8888-8888-8888-888888888888',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '55555555-5555-5555-5555-555555555555'
  )
on conflict (id) do nothing;

insert into public.audit_events (
  actor_user_id,
  entity_type,
  entity_id,
  event_name,
  metadata
)
values
  (
    '11111111-1111-1111-1111-111111111111',
    'match',
    '55555555-5555-5555-5555-555555555555',
    'match.created',
    '{"placeholder": true}'
  ),
  (
    '11111111-1111-1111-1111-111111111111',
    'report',
    '77777777-7777-7777-7777-777777777777',
    'report.created',
    '{"reason": "spam or scam"}'
  );

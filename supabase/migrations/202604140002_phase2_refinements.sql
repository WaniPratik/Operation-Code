alter table public.users
  add column if not exists deleted_at timestamptz;

alter table public.guest_profiles rename to anonymous_profiles;

alter table public.anonymous_profiles
  add column if not exists country_code text,
  add column if not exists deleted_at timestamptz;

create index if not exists anonymous_profiles_country_code_idx
  on public.anonymous_profiles (country_code)
  where deleted_at is null;

create table if not exists public.guest_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token_hash text not null unique,
  fingerprint_hash text,
  created_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz,
  revoked_at timestamptz
);

create index if not exists guest_sessions_user_id_idx on public.guest_sessions (user_id, revoked_at);

alter table public.queue_entries
  add column if not exists preferred_country_codes text[] not null default '{}',
  add column if not exists excluded_country_codes text[] not null default '{}',
  add column if not exists matched_at timestamptz,
  add column if not exists deleted_at timestamptz;

create index if not exists queue_entries_status_entered_at_idx
  on public.queue_entries (status, entered_at)
  where deleted_at is null;

alter table public.matches
  add column if not exists ended_by_user_id uuid references public.users(id) on delete set null;

alter table public.audit_events
  add column if not exists target_user_id uuid references public.users(id) on delete set null,
  add column if not exists match_id uuid references public.matches(id) on delete set null;

create index if not exists audit_events_actor_created_idx
  on public.audit_events (actor_user_id, created_at desc);

create index if not exists audit_events_target_created_idx
  on public.audit_events (target_user_id, created_at desc);

comment on table public.guest_sessions is 'Server-validated guest session records keyed by an httpOnly cookie token hash.';
comment on column public.queue_entries.preferred_country_codes is 'MVP country include filters. Maximum 2 enforced in application logic.';
comment on column public.queue_entries.excluded_country_codes is 'MVP country exclude filters. Maximum 2 enforced in application logic.';

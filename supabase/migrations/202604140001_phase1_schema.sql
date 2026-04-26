create extension if not exists pgcrypto;

create type public.queue_entry_status as enum ('queued', 'matched', 'left');
create type public.match_status as enum ('matched', 'ended');
create type public.report_reason as enum (
  'harassment',
  'sexual content',
  'hate or abuse',
  'spam or scam',
  'underage concern',
  'other'
);
create type public.report_status as enum ('submitted', 'reviewing', 'resolved', 'dismissed');

create table public.users (
  id uuid primary key default gen_random_uuid(),
  auth_provider text not null default 'guest',
  auth_subject text unique,
  created_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now())
);

create table public.guest_profiles (
  user_id uuid primary key references public.users(id) on delete cascade,
  anonymous_handle text not null unique,
  age_attested_over_18 boolean not null default false,
  onboarding_completed_at timestamptz,
  device_fingerprint_hash text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.queue_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  status public.queue_entry_status not null default 'queued',
  queue_channel text not null default 'general',
  entered_at timestamptz not null default timezone('utc', now()),
  exited_at timestamptz,
  exit_reason text,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique default gen_random_uuid(),
  user_a_id uuid not null references public.users(id) on delete restrict,
  user_b_id uuid not null references public.users(id) on delete restrict,
  queue_entry_a_id uuid references public.queue_entries(id) on delete set null,
  queue_entry_b_id uuid references public.queue_entries(id) on delete set null,
  status public.match_status not null default 'matched',
  matched_at timestamptz not null default timezone('utc', now()),
  ended_at timestamptz,
  end_reason text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint matches_distinct_users check (user_a_id <> user_b_id)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references public.users(id) on delete restrict,
  reported_user_id uuid not null references public.users(id) on delete restrict,
  match_id uuid references public.matches(id) on delete set null,
  session_id uuid,
  reason public.report_reason not null,
  details text not null default '',
  status public.report_status not null default 'submitted',
  created_at timestamptz not null default timezone('utc', now()),
  constraint reports_distinct_users check (reporter_user_id <> reported_user_id),
  constraint reports_details_length check (char_length(details) <= 400)
);

create table public.blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_user_id uuid not null references public.users(id) on delete cascade,
  blocked_user_id uuid not null references public.users(id) on delete cascade,
  match_id uuid references public.matches(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint blocks_distinct_users check (blocker_user_id <> blocked_user_id),
  constraint blocks_unique_pair unique (blocker_user_id, blocked_user_id)
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.users(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  event_name text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index queue_entries_user_status_idx on public.queue_entries (user_id, status);
create index matches_status_matched_at_idx on public.matches (status, matched_at desc);
create index reports_status_created_at_idx on public.reports (status, created_at desc);
create index reports_reported_user_idx on public.reports (reported_user_id, created_at desc);
create index blocks_blocker_user_idx on public.blocks (blocker_user_id, created_at desc);
create index audit_events_entity_idx on public.audit_events (entity_type, entity_id, created_at desc);

comment on table public.users is 'Internal platform user records. Guest-first auth is used for MVP Phase 1.';
comment on table public.guest_profiles is 'Anonymous guest-facing identity records. Public profiles are intentionally excluded from MVP.';
comment on table public.matches is 'Match lifecycle records. Session ID exists now so later voice integrations can bind to a session without redesigning the schema.';
comment on table public.reports is 'Moderation report intake records. Voice recordings are not stored.';
comment on table public.audit_events is 'Audit log for queue, match, moderation, and admin lifecycle events.';

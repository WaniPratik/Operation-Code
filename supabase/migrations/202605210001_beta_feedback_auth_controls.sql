do $$
begin
  create type public.feedback_type as enum (
    'bug',
    'suggestion',
    'audio issue',
    'matching issue',
    'safety issue',
    'other'
  );
exception
  when duplicate_object then null;
end;
$$;

create table if not exists public.feedback_submissions (
  id uuid primary key default gen_random_uuid(),
  feedback_type public.feedback_type not null,
  feedback_text text not null,
  user_id uuid references public.users(id) on delete set null,
  match_id uuid references public.matches(id) on delete set null,
  user_agent text,
  fingerprint_hash text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint feedback_text_length check (char_length(feedback_text) between 1 and 1000)
);

create table if not exists public.beta_rate_limits (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  rate_key text not null,
  window_started_at timestamptz not null,
  count integer not null default 1,
  updated_at timestamptz not null default timezone('utc', now()),
  unique (action, rate_key, window_started_at)
);

create table if not exists public.beta_user_cooldowns (
  user_id uuid primary key references public.users(id) on delete cascade,
  reason text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists feedback_submissions_created_idx
  on public.feedback_submissions (created_at desc);

create index if not exists feedback_submissions_user_created_idx
  on public.feedback_submissions (user_id, created_at desc);

create index if not exists beta_rate_limits_lookup_idx
  on public.beta_rate_limits (action, rate_key, window_started_at);

create index if not exists beta_user_cooldowns_expires_idx
  on public.beta_user_cooldowns (expires_at);

alter table public.feedback_submissions enable row level security;
alter table public.beta_rate_limits enable row level security;
alter table public.beta_user_cooldowns enable row level security;

revoke all on table
  public.feedback_submissions,
  public.beta_rate_limits,
  public.beta_user_cooldowns
from public, anon, authenticated;

grant all on table
  public.feedback_submissions,
  public.beta_rate_limits,
  public.beta_user_cooldowns
to service_role;

alter default privileges in schema public revoke all on tables from public, anon, authenticated;
alter default privileges in schema public revoke all on sequences from public, anon, authenticated;
alter default privileges in schema public revoke all on functions from public, anon, authenticated;

comment on table public.feedback_submissions
  is 'Controlled-beta feedback intake linked to guest users and matches when available.';

comment on table public.beta_rate_limits
  is 'Lightweight server-side beta abuse controls keyed by action and fingerprint/user.';

comment on table public.beta_user_cooldowns
  is 'Temporary beta cooldowns applied after repeated reports or abuse signals.';

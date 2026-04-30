-- Codifies the intended server-only Supabase access pattern for the MVP.
-- The Next.js app talks to Supabase through the service-role key on the server.
-- Browser clients should not query these tables or RPCs directly.

alter table if exists public.users enable row level security;
alter table if exists public.anonymous_profiles enable row level security;
alter table if exists public.guest_sessions enable row level security;
alter table if exists public.queue_entries enable row level security;
alter table if exists public.matches enable row level security;
alter table if exists public.active_match_participants enable row level security;
alter table if exists public.reports enable row level security;
alter table if exists public.blocks enable row level security;
alter table if exists public.audit_events enable row level security;

revoke all on table
  public.users,
  public.anonymous_profiles,
  public.guest_sessions,
  public.queue_entries,
  public.matches,
  public.active_match_participants,
  public.reports,
  public.blocks,
  public.audit_events
from public, anon, authenticated;

revoke execute on function public.find_tiered_match_candidate(uuid, uuid, text, text[], text[], integer)
  from public, anon, authenticated;
revoke execute on function public.claim_tiered_match(uuid)
  from public, anon, authenticated;
revoke execute on function public.end_match_transactional(uuid, uuid, text)
  from public, anon, authenticated;
revoke execute on function public.admin_end_match_transactional(uuid, text)
  from public, anon, authenticated;

alter function public.find_tiered_match_candidate(uuid, uuid, text, text[], text[], integer)
  set search_path = public, pg_temp;
alter function public.claim_tiered_match(uuid)
  set search_path = public, pg_temp;
alter function public.end_match_transactional(uuid, uuid, text)
  set search_path = public, pg_temp;
alter function public.admin_end_match_transactional(uuid, text)
  set search_path = public, pg_temp;

alter default privileges in schema public revoke all on tables from public, anon, authenticated;
alter default privileges in schema public revoke all on sequences from public, anon, authenticated;
alter default privileges in schema public revoke all on functions from public, anon, authenticated;

comment on function public.find_tiered_match_candidate(uuid, uuid, text, text[], text[], integer)
  is 'Tiered queue matcher with explicit search_path for Supabase security linting and server-side RPC use only.';

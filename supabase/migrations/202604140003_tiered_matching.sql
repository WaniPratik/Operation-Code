create index if not exists matches_user_a_matched_at_idx
  on public.matches (user_a_id, matched_at desc);

create index if not exists matches_user_b_matched_at_idx
  on public.matches (user_b_id, matched_at desc);

create index if not exists blocks_blocked_user_idx
  on public.blocks (blocked_user_id, created_at desc);

create or replace function public.find_tiered_match_candidate(
  requester_user_id uuid,
  requester_queue_entry_id uuid,
  requester_country_code text,
  requester_preferred_country_codes text[],
  requester_excluded_country_codes text[],
  requester_wait_seconds integer
)
returns table (
  candidate_queue_entry_id uuid,
  candidate_user_id uuid
)
language sql
stable
as $$
  with requester_phase as (
    select
      case
        when requester_wait_seconds < 3 then 1
        when requester_wait_seconds < 6 then 2
        else 3
      end as phase
  ),
  recent_matches as (
    select
      case
        when m.user_a_id = requester_user_id then m.user_b_id
        else m.user_a_id
      end as matched_user_id
    from public.matches m
    where m.user_a_id = requester_user_id
       or m.user_b_id = requester_user_id
    order by m.matched_at desc
    limit 5
  )
  select
    qe.id as candidate_queue_entry_id,
    qe.user_id as candidate_user_id
  from public.queue_entries qe
  join public.anonymous_profiles ap
    on ap.user_id = qe.user_id
   and ap.deleted_at is null
  cross join requester_phase rp
  where qe.status = 'queued'
    and qe.deleted_at is null
    and qe.id <> requester_queue_entry_id
    and qe.user_id <> requester_user_id
    and not exists (
      select 1
      from public.blocks b
      where (b.blocker_user_id = requester_user_id and b.blocked_user_id = qe.user_id)
         or (b.blocker_user_id = qe.user_id and b.blocked_user_id = requester_user_id)
    )
    and (
      requester_country_code is null
      or coalesce(ap.country_code, '') = ''
      or not (requester_country_code = any(coalesce(qe.excluded_country_codes, '{}')))
    )
    and (
      ap.country_code is null
      or coalesce(ap.country_code, '') = ''
      or not (ap.country_code = any(coalesce(requester_excluded_country_codes, '{}')))
    )
    and (
      rp.phase > 1
      or (
        (cardinality(coalesce(requester_preferred_country_codes, '{}')) = 0 or ap.country_code = any(requester_preferred_country_codes))
        and
        (requester_country_code is null or cardinality(coalesce(qe.preferred_country_codes, '{}')) = 0 or requester_country_code = any(qe.preferred_country_codes))
      )
    )
    and (
      rp.phase > 1
      or not exists (
        select 1
        from recent_matches rm
        where rm.matched_user_id = qe.user_id
      )
    )
  order by qe.entered_at asc
  limit 1;
$$;

comment on function public.find_tiered_match_candidate(uuid, uuid, text, text[], text[], integer)
  is 'Tiered queue matcher: 0-3s enforces preferred countries, exclusions, and recent-match avoidance; 3-6s relaxes preferred countries; 6+s matches any valid user while still enforcing blocks and exclusions.';

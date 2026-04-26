create unique index if not exists queue_entries_active_user_idx
  on public.queue_entries (user_id)
  where status = 'queued' and deleted_at is null;

create table if not exists public.active_match_participants (
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (match_id, user_id),
  unique (user_id)
);

create index if not exists active_match_participants_created_idx
  on public.active_match_participants (created_at desc);

create or replace function public.claim_tiered_match(
  requester_user_id uuid
)
returns table (
  match_id uuid,
  session_id uuid,
  matched_at timestamptz,
  user_a_id uuid,
  user_b_id uuid,
  phase_used integer,
  existing_match boolean
)
language plpgsql
as $$
declare
  initiator_queue public.queue_entries%rowtype;
  candidate_queue public.queue_entries%rowtype;
  active_match public.matches%rowtype;
  requester_country_code text;
  requester_wait_seconds integer;
  requester_phase integer;
  new_match public.matches%rowtype;
begin
  select m.*
    into active_match
  from public.matches m
  join public.active_match_participants amp
    on amp.match_id = m.id
  where amp.user_id = requester_user_id
    and m.status = 'matched'
  order by m.matched_at desc
  limit 1;

  if found then
    return query
    select
      active_match.id,
      active_match.session_id,
      active_match.matched_at,
      active_match.user_a_id,
      active_match.user_b_id,
      0,
      true;
    return;
  end if;

  select qe.*
    into initiator_queue
  from public.queue_entries qe
  where qe.user_id = requester_user_id
    and qe.status = 'queued'
    and qe.deleted_at is null
  order by qe.entered_at asc
  limit 1
  for update;

  if not found then
    return;
  end if;

  select ap.country_code
    into requester_country_code
  from public.anonymous_profiles ap
  where ap.user_id = requester_user_id
    and ap.deleted_at is null;

  requester_wait_seconds :=
    greatest(0, floor(extract(epoch from (timezone('utc', now()) - initiator_queue.entered_at)))::integer);

  requester_phase :=
    case
      when requester_wait_seconds < 3 then 1
      when requester_wait_seconds < 6 then 2
      else 3
    end;

  with recent_matches as (
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
  select qe.*
    into candidate_queue
  from public.queue_entries qe
  join public.anonymous_profiles ap
    on ap.user_id = qe.user_id
   and ap.deleted_at is null
  where qe.status = 'queued'
    and qe.deleted_at is null
    and qe.user_id <> requester_user_id
    and qe.id <> initiator_queue.id
    and not exists (
      select 1
      from public.blocks b
      where (b.blocker_user_id = requester_user_id and b.blocked_user_id = qe.user_id)
         or (b.blocker_user_id = qe.user_id and b.blocked_user_id = requester_user_id)
    )
    and not exists (
      select 1
      from public.active_match_participants amp
      where amp.user_id = qe.user_id
    )
    and (
      requester_country_code is null
      or ap.country_code is null
      or not (ap.country_code = any(coalesce(initiator_queue.excluded_country_codes, '{}')))
    )
    and (
      ap.country_code is null
      or requester_country_code is null
      or not (requester_country_code = any(coalesce(qe.excluded_country_codes, '{}')))
    )
    and (
      requester_phase > 1
      or (
        (cardinality(coalesce(initiator_queue.preferred_country_codes, '{}')) = 0 or ap.country_code = any(initiator_queue.preferred_country_codes))
        and
        (requester_country_code is null or cardinality(coalesce(qe.preferred_country_codes, '{}')) = 0 or requester_country_code = any(qe.preferred_country_codes))
      )
    )
    and (
      requester_phase > 1
      or not exists (
        select 1
        from recent_matches rm
        where rm.matched_user_id = qe.user_id
      )
    )
  order by qe.entered_at asc
  limit 1
  for update of qe skip locked;

  if not found then
    return;
  end if;

  insert into public.matches (
    user_a_id,
    user_b_id,
    queue_entry_a_id,
    queue_entry_b_id
  )
  values (
    requester_user_id,
    candidate_queue.user_id,
    initiator_queue.id,
    candidate_queue.id
  )
  returning *
    into new_match;

  insert into public.active_match_participants (match_id, user_id)
  values
    (new_match.id, requester_user_id),
    (new_match.id, candidate_queue.user_id);

  update public.queue_entries
     set status = 'matched',
         matched_at = timezone('utc', now()),
         exited_at = timezone('utc', now()),
         exit_reason = 'matched'
   where id in (initiator_queue.id, candidate_queue.id);

  insert into public.audit_events (
    actor_user_id,
    target_user_id,
    match_id,
    entity_type,
    entity_id,
    event_name,
    metadata
  )
  values
    (
      requester_user_id,
      candidate_queue.user_id,
      new_match.id,
      'match',
      new_match.id,
      'match_created',
      jsonb_build_object(
        'matchingPhase', requester_phase,
        'queueEntryId', initiator_queue.id,
        'counterpartQueueEntryId', candidate_queue.id,
        'cooldownLoggedOnly', true
      )
    ),
    (
      candidate_queue.user_id,
      requester_user_id,
      new_match.id,
      'match',
      new_match.id,
      'match_created',
      jsonb_build_object(
        'matchingPhase', requester_phase,
        'queueEntryId', candidate_queue.id,
        'counterpartQueueEntryId', initiator_queue.id,
        'cooldownLoggedOnly', true
      )
    );

  return query
  select
    new_match.id,
    new_match.session_id,
    new_match.matched_at,
    new_match.user_a_id,
    new_match.user_b_id,
    requester_phase,
    false;
end;
$$;

create or replace function public.end_match_transactional(
  actor_user_id uuid,
  target_match_id uuid,
  end_reason_input text
)
returns table (
  match_id uuid,
  ended_at timestamptz
)
language plpgsql
as $$
declare
  target_match public.matches%rowtype;
  target_user_id uuid;
begin
  select m.*
    into target_match
  from public.matches m
  where m.id = target_match_id
  for update;

  if not found then
    return;
  end if;

  if target_match.user_a_id <> actor_user_id and target_match.user_b_id <> actor_user_id then
    raise exception 'Actor is not a participant in this match.';
  end if;

  if target_match.status = 'matched' then
    update public.matches
       set status = 'ended',
           ended_at = timezone('utc', now()),
           end_reason = end_reason_input,
           ended_by_user_id = actor_user_id
     where id = target_match_id
     returning *
      into target_match;

    delete from public.active_match_participants
     where match_id = target_match_id;

    target_user_id :=
      case
        when target_match.user_a_id = actor_user_id then target_match.user_b_id
        else target_match.user_a_id
      end;

    insert into public.audit_events (
      actor_user_id,
      target_user_id,
      match_id,
      entity_type,
      entity_id,
      event_name,
      metadata
    )
    values (
      actor_user_id,
      target_user_id,
      target_match.id,
      'match',
      target_match.id,
      'match_ended',
      jsonb_build_object(
        'reason', end_reason_input,
        'cooldownLoggedOnly', true
      )
    );
  end if;

  return query
  select
    target_match.id,
    target_match.ended_at;
end;
$$;

comment on table public.active_match_participants
  is 'Database-level guardrail to ensure a user can appear in at most one active match at a time.';

comment on function public.claim_tiered_match(uuid)
  is 'Atomically claims a tiered match using row-level locks and SKIP LOCKED. Prevents duplicate claims and writes match_created audit events only if the match commits.';

comment on function public.end_match_transactional(uuid, uuid, text)
  is 'Atomically ends a match, clears active participants, and writes a match_ended audit event in the same transaction.';

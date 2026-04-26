create or replace function public.admin_end_match_transactional(
  target_match_id uuid,
  end_reason_input text default 'admin_end'
)
returns table (
  match_id uuid,
  ended_at timestamptz
)
language plpgsql
as $$
declare
  target_match public.matches%rowtype;
begin
  select m.*
    into target_match
  from public.matches m
  where m.id = target_match_id
  for update;

  if not found then
    return;
  end if;

  if target_match.status = 'matched' then
    update public.matches
       set status = 'ended',
           ended_at = timezone('utc', now()),
           end_reason = end_reason_input,
           ended_by_user_id = null
     where id = target_match_id
     returning *
      into target_match;

    delete from public.active_match_participants
     where match_id = target_match_id;

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
      null,
      null,
      target_match.id,
      'match',
      target_match.id,
      'match_ended',
      jsonb_build_object(
        'reason', end_reason_input,
        'adminAction', true,
        'userAId', target_match.user_a_id,
        'userBId', target_match.user_b_id,
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

comment on function public.admin_end_match_transactional(uuid, text)
  is 'Atomically ends a match from the admin surface, clears active participants, and writes a match_ended audit event with adminAction metadata.';

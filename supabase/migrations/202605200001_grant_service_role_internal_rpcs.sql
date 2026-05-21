-- Keep internal RPCs server-only while allowing the Next.js service-role client to execute them.
-- Browser roles remain revoked by the security hardening migration.

grant execute on function public.find_tiered_match_candidate(uuid, uuid, text, text[], text[], integer)
  to service_role;

grant execute on function public.claim_tiered_match(uuid)
  to service_role;

grant execute on function public.end_match_transactional(uuid, uuid, text)
  to service_role;

grant execute on function public.admin_end_match_transactional(uuid, text)
  to service_role;

comment on function public.end_match_transactional(uuid, uuid, text)
  is 'Atomically ends a match from the server service role, clears active participants, and writes match_ended audit events.';

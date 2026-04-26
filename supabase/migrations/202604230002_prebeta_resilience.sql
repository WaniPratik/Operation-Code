create unique index if not exists queue_entries_active_user_idx
  on public.queue_entries (user_id)
  where status = 'queued' and deleted_at is null;

create index if not exists queue_entries_status_user_idx
  on public.queue_entries (status, user_id)
  where deleted_at is null;

create index if not exists users_last_seen_active_idx
  on public.users (last_seen_at)
  where deleted_at is null;

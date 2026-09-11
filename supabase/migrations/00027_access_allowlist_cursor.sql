-- Give admin pagination a stable, opaque URL identity without exposing email addresses.

alter table lighthouse.access_allowlist_entries
  add column if not exists cursor_id uuid not null default gen_random_uuid();

create unique index if not exists access_allowlist_entries_cursor_id_idx
  on lighthouse.access_allowlist_entries (cursor_id);

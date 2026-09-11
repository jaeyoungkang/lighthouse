-- Current invited external product users.

create table if not exists lighthouse.access_allowlist_entries (
  email text primary key,
  updated_by text not null,
  updated_at timestamptz not null default now(),
  constraint access_allowlist_entries_normalized_email_check check (
    email = lower(btrim(email))
    and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    and email not like '%@corca.ai'
  ),
  constraint access_allowlist_entries_updated_by_check check (
    updated_by = lower(btrim(updated_by))
    and updated_by ~ '^[^[:space:]@]+@corca\.ai$'
  )
);

alter table lighthouse.access_allowlist_entries enable row level security;

revoke all on table lighthouse.access_allowlist_entries
  from public, anon, authenticated, service_role;
grant select, insert, update, delete on table lighthouse.access_allowlist_entries
  to service_role;

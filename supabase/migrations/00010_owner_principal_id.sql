-- 00010_owner_principal_id.sql
-- #183 K1: stateless owner key. owner_principal_id (text) holds the authenticated
-- principal (Moonlight token sub OR Supabase user id). Ownership moves off the
-- app_users FK and off RLS, onto explicit server-side WHERE owner_principal_id = $principal
-- run through the service-role client. user_id retained nullable for lazy backfill
-- mapping and dropped in a later cleanup migration.

-- 1) Add the principal column.
alter table lighthouse.documents               add column if not exists owner_principal_id text;
alter table lighthouse.interaction_events       add column if not exists owner_principal_id text;
alter table lighthouse.reviewed_papers          add column if not exists owner_principal_id text;
alter table lighthouse.paper_inline_analysis_cache add column if not exists owner_principal_id text;

-- 2) Migration-time backfill (Supabase-owned rows: user_id == app_users.id == auth.users.id == principal).
update lighthouse.documents               set owner_principal_id = user_id::text
  where owner_principal_id is null and user_id in (select id from auth.users);
update lighthouse.interaction_events       set owner_principal_id = user_id::text
  where owner_principal_id is null and user_id in (select id from auth.users);
update lighthouse.reviewed_papers          set owner_principal_id = user_id::text
  where owner_principal_id is null and user_id in (select id from auth.users);
update lighthouse.paper_inline_analysis_cache set owner_principal_id = user_id::text
  where owner_principal_id is null and user_id in (select id from auth.users);

-- 3) Indexes on the new hot-path key (keep legacy user_id indexes during transition).
-- Checked-in Supabase migrations run through a transaction-wrapped apply path in
-- production; `CREATE INDEX CONCURRENTLY` fails there with SQLSTATE 25001.
create index if not exists idx_documents_owner          on lighthouse.documents(owner_principal_id);
create index if not exists idx_documents_owner_type     on lighthouse.documents(owner_principal_id, type);
create index if not exists idx_documents_owner_status   on lighthouse.documents(owner_principal_id, status) where status <> 'ready';
create index if not exists idx_interaction_events_owner on lighthouse.interaction_events(owner_principal_id);
create index if not exists idx_reviewed_papers_owner    on lighthouse.reviewed_papers(owner_principal_id);
create index if not exists idx_paper_inline_cache_owner_version on lighthouse.paper_inline_analysis_cache(owner_principal_id, version);

-- 4) Upsert onConflict targets for the new key.
create unique index if not exists reviewed_papers_owner_paper_key
  on lighthouse.reviewed_papers(owner_principal_id, paper_id);
create unique index if not exists paper_inline_cache_owner_paper_key
  on lighthouse.paper_inline_analysis_cache(owner_principal_id, paper_id);
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'reviewed_papers_owner_paper_key'
      and conrelid = 'lighthouse.reviewed_papers'::regclass
  ) then
    alter table lighthouse.reviewed_papers
      add constraint reviewed_papers_owner_paper_key unique using index reviewed_papers_owner_paper_key;
  end if;
end $$;
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'paper_inline_cache_owner_paper_key'
      and conrelid = 'lighthouse.paper_inline_analysis_cache'::regclass
  ) then
    alter table lighthouse.paper_inline_analysis_cache
      add constraint paper_inline_cache_owner_paper_key unique using index paper_inline_cache_owner_paper_key;
  end if;
end $$;

-- 5) Sever app_users as ownership FK target + relax NOT NULL.
alter table lighthouse.documents               drop constraint if exists documents_user_id_fkey;
alter table lighthouse.interaction_events       drop constraint if exists interaction_events_user_id_fkey;
alter table lighthouse.reviewed_papers          drop constraint if exists reviewed_papers_user_id_fkey;
alter table lighthouse.paper_inline_analysis_cache drop constraint if exists paper_inline_analysis_cache_user_id_fkey;
alter table lighthouse.documents               alter column user_id drop not null;
alter table lighthouse.interaction_events       alter column user_id drop not null;
alter table lighthouse.reviewed_papers          alter column user_id drop not null;
alter table lighthouse.paper_inline_analysis_cache alter column user_id drop not null;

-- 6) Neutralize RLS ownership policies (00001_init.sql:174-217). Keep RLS ENABLED (default-deny).
drop policy if exists "documents_select_own"   on lighthouse.documents;
drop policy if exists "documents_insert_own"   on lighthouse.documents;
drop policy if exists "documents_update_own"   on lighthouse.documents;
drop policy if exists "documents_delete_own"   on lighthouse.documents;
drop policy if exists "interaction_events_select_own" on lighthouse.interaction_events;
drop policy if exists "interaction_events_insert_own" on lighthouse.interaction_events;
drop policy if exists "interaction_events_delete_own" on lighthouse.interaction_events;
drop policy if exists "reviewed_papers_select_own" on lighthouse.reviewed_papers;
drop policy if exists "reviewed_papers_insert_own" on lighthouse.reviewed_papers;
drop policy if exists "reviewed_papers_update_own" on lighthouse.reviewed_papers;
drop policy if exists "reviewed_papers_delete_own" on lighthouse.reviewed_papers;
drop policy if exists "paper_inline_analysis_cache_select_own" on lighthouse.paper_inline_analysis_cache;
drop policy if exists "paper_inline_analysis_cache_insert_own" on lighthouse.paper_inline_analysis_cache;
drop policy if exists "paper_inline_analysis_cache_update_own" on lighthouse.paper_inline_analysis_cache;
drop policy if exists "paper_inline_analysis_cache_delete_own" on lighthouse.paper_inline_analysis_cache;

-- 7) app_users → operational/display snapshot.
alter table public.app_users add column if not exists last_seen           timestamptz;
alter table public.app_users add column if not exists owner_principal_id  text;
alter table public.app_users add column if not exists principal_linked_at timestamptz;

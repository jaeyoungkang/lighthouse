-- Inline analysis is a shared paper artifact. Authentication still gates the
-- API and attributes real generation usage, but it is not part of cache identity.

create temporary table migrated_paper_inline_analysis_cache on commit drop as
select distinct on (paper_id, version)
  paper_id,
  version,
  repeat('0', 32) || replace(id::text, '-', '') as input_fingerprint,
  analysis,
  case when source = 'abstract' then 'abstract' else null end as source,
  created_at,
  updated_at
from lighthouse.paper_inline_analysis_cache
where analysis is not null
  and not (
    analysis ->> 'confidence' = 'low'
    and nullif(btrim(analysis #>> '{semanticProfile,claim}'), '') is null
    and coalesce(jsonb_array_length(analysis #> '{semanticProfile,topics}'), 0) = 0
    and nullif(btrim(analysis #>> '{semanticProfile,method}'), '') is null
  )
order by paper_id, version, updated_at desc, created_at desc;

drop table lighthouse.paper_inline_analysis_cache cascade;

create table lighthouse.paper_inline_analysis_cache (
  id uuid primary key default gen_random_uuid(),
  paper_id text not null,
  version integer not null,
  input_fingerprint text not null check (input_fingerprint ~ '^[0-9a-f]{64}$'),
  analysis jsonb,
  source text check (source in ('abstract')),
  status text not null default 'pending' check (status in ('pending', 'ready')),
  lease_token text,
  lease_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint paper_inline_analysis_cache_input_key unique (
    paper_id,
    version,
    input_fingerprint
  ),
  constraint paper_inline_analysis_cache_state_check check (
    (status = 'ready' and analysis is not null and lease_token is null and lease_expires_at is null)
    or
    (status = 'pending' and analysis is null and lease_token is not null and lease_expires_at is not null)
  )
);

insert into lighthouse.paper_inline_analysis_cache (
  paper_id,
  version,
  input_fingerprint,
  analysis,
  source,
  status,
  created_at,
  updated_at
)
select
  paper_id,
  version,
  input_fingerprint,
  analysis,
  source,
  'ready',
  created_at,
  updated_at
from migrated_paper_inline_analysis_cache;

create index paper_inline_analysis_cache_ready_version_idx
  on lighthouse.paper_inline_analysis_cache (version, paper_id, input_fingerprint)
  where status = 'ready';

create index paper_inline_analysis_cache_pending_lease_idx
  on lighthouse.paper_inline_analysis_cache (lease_expires_at)
  where status = 'pending';

create trigger set_paper_inline_analysis_cache_updated_at
before update on lighthouse.paper_inline_analysis_cache
for each row execute function public.update_updated_at();

alter table lighthouse.paper_inline_analysis_cache enable row level security;

revoke all on table lighthouse.paper_inline_analysis_cache
  from public, anon, authenticated, service_role;

create or replace function lighthouse.list_paper_inline_analysis_cache(
  p_entries jsonb
)
returns table (
  paper_id text,
  version integer,
  input_fingerprint text,
  analysis jsonb,
  source text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, lighthouse
as $$
  with requested as (
    select distinct on (entry.paper_id, entry.version, entry.input_fingerprint)
      entry.paper_id,
      entry.version,
      entry.input_fingerprint
    from jsonb_to_recordset(p_entries) as entry(
      paper_id text,
      version integer,
      input_fingerprint text
    )
    where entry.paper_id is not null
      and entry.paper_id <> ''
      and entry.version is not null
      and entry.input_fingerprint ~ '^[0-9a-f]{64}$'
  )
  select
    cache.paper_id,
    cache.version,
    cache.input_fingerprint,
    cache.analysis,
    cache.source,
    cache.created_at,
    cache.updated_at
  from requested
  join lighthouse.paper_inline_analysis_cache as cache
    on cache.paper_id = requested.paper_id
    and cache.version = requested.version
    and cache.input_fingerprint = requested.input_fingerprint
  where cache.status = 'ready';
$$;

create or replace function lighthouse.claim_paper_inline_analysis_generation(
  p_entries jsonb,
  p_lease_token text,
  p_lease_seconds integer default 50
)
returns table (paper_id text, version integer, input_fingerprint text)
language sql
security definer
set search_path = pg_catalog, lighthouse
as $$
  with requested as (
    select distinct on (entry.paper_id, entry.version, entry.input_fingerprint)
      entry.paper_id,
      entry.version,
      entry.input_fingerprint
    from jsonb_to_recordset(p_entries) as entry(
      paper_id text,
      version integer,
      input_fingerprint text
    )
    where entry.paper_id is not null
      and entry.paper_id <> ''
      and entry.version is not null
      and entry.input_fingerprint ~ '^[0-9a-f]{64}$'
  )
  insert into lighthouse.paper_inline_analysis_cache (
    paper_id,
    version,
    input_fingerprint,
    status,
    lease_token,
    lease_expires_at
  )
  select
    requested.paper_id,
    requested.version,
    requested.input_fingerprint,
    'pending',
    p_lease_token,
    now() + make_interval(secs => greatest(1, least(p_lease_seconds, 300)))
  from requested
  on conflict (paper_id, version, input_fingerprint) do update
  set
    analysis = null,
    source = null,
    status = 'pending',
    lease_token = excluded.lease_token,
    lease_expires_at = excluded.lease_expires_at,
    updated_at = now()
  where lighthouse.paper_inline_analysis_cache.status = 'pending'
    and lighthouse.paper_inline_analysis_cache.lease_expires_at <= now()
  returning
    lighthouse.paper_inline_analysis_cache.paper_id,
    lighthouse.paper_inline_analysis_cache.version,
    lighthouse.paper_inline_analysis_cache.input_fingerprint;
$$;

create or replace function lighthouse.complete_paper_inline_analysis_generation(
  p_entries jsonb,
  p_lease_token text
)
returns table (paper_id text, version integer, input_fingerprint text)
language sql
security definer
set search_path = pg_catalog, lighthouse
as $$
  update lighthouse.paper_inline_analysis_cache as cache
  set
    analysis = entry.analysis,
    source = entry.source,
    status = 'ready',
    lease_token = null,
    lease_expires_at = null,
    updated_at = now()
  from jsonb_to_recordset(p_entries) as entry(
    paper_id text,
    version integer,
    input_fingerprint text,
    analysis jsonb,
    source text
  )
  where cache.paper_id = entry.paper_id
    and cache.version = entry.version
    and cache.input_fingerprint = entry.input_fingerprint
    and cache.status = 'pending'
    and cache.lease_token = p_lease_token
    and entry.analysis is not null
  returning cache.paper_id, cache.version, cache.input_fingerprint;
$$;

create or replace function lighthouse.release_paper_inline_analysis_generation(
  p_entries jsonb,
  p_lease_token text
)
returns table (paper_id text, version integer, input_fingerprint text)
language sql
security definer
set search_path = pg_catalog, lighthouse
as $$
  delete from lighthouse.paper_inline_analysis_cache as cache
  using jsonb_to_recordset(p_entries) as entry(
    paper_id text,
    version integer,
    input_fingerprint text
  )
  where cache.paper_id = entry.paper_id
    and cache.version = entry.version
    and cache.input_fingerprint = entry.input_fingerprint
    and cache.status = 'pending'
    and cache.lease_token = p_lease_token
  returning cache.paper_id, cache.version, cache.input_fingerprint;
$$;

revoke all on function lighthouse.list_paper_inline_analysis_cache(jsonb)
  from public;
revoke all on function lighthouse.claim_paper_inline_analysis_generation(jsonb, text, integer)
  from public;
revoke all on function lighthouse.complete_paper_inline_analysis_generation(jsonb, text)
  from public;
revoke all on function lighthouse.release_paper_inline_analysis_generation(jsonb, text)
  from public;

grant execute on function lighthouse.list_paper_inline_analysis_cache(jsonb)
  to service_role;
grant execute on function lighthouse.claim_paper_inline_analysis_generation(jsonb, text, integer)
  to service_role;
grant execute on function lighthouse.complete_paper_inline_analysis_generation(jsonb, text)
  to service_role;
grant execute on function lighthouse.release_paper_inline_analysis_generation(jsonb, text)
  to service_role;

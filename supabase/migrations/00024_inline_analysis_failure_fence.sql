-- #435: cooldown expiry never starts work; only an explicit user retry can
-- reclaim a failed canonical analysis identity.
alter table lighthouse.paper_inline_analysis_cache
  drop constraint if exists paper_inline_analysis_cache_state_check;
alter table lighthouse.paper_inline_analysis_cache
  drop constraint if exists paper_inline_analysis_cache_status_check;
alter table lighthouse.paper_inline_analysis_cache
  add column if not exists failure_count integer not null default 0
    check (failure_count >= 0),
  add column if not exists failure_class text,
  add column if not exists cooldown_until timestamptz,
  add column if not exists retry_requires_explicit boolean not null default false,
  add column if not exists generation_epoch integer not null default 0
    check (generation_epoch >= 0);
alter table lighthouse.paper_inline_analysis_cache
  add constraint paper_inline_analysis_cache_status_check
  check (status in ('pending', 'ready', 'cooldown_failed', 'terminal_failed'));
alter table lighthouse.paper_inline_analysis_cache
  add constraint paper_inline_analysis_cache_state_check
  check (
    (status = 'ready' and analysis is not null
      and lease_token is null and lease_expires_at is null and cooldown_until is null)
    or
    (status = 'pending' and analysis is null
      and lease_token is not null and lease_expires_at is not null)
    or
    (status = 'cooldown_failed' and analysis is null
      and lease_token is null and lease_expires_at is null
      and cooldown_until is not null and failure_count > 0)
    or
    (status = 'terminal_failed' and analysis is null
      and lease_token is null and lease_expires_at is null and retry_requires_explicit)
  );
create index if not exists paper_inline_analysis_cache_cooldown_idx
  on lighthouse.paper_inline_analysis_cache (cooldown_until)
  where status = 'cooldown_failed';
create or replace function lighthouse.list_paper_inline_analysis_generation_state(p_entries jsonb)
returns table (
  paper_id text, version integer, input_fingerprint text, status text,
  cooldown_until timestamptz, retry_requires_explicit boolean
)
language sql
stable
security definer
set search_path = pg_catalog, lighthouse
as $$
  select cache.paper_id, cache.version, cache.input_fingerprint,
    cache.status, cache.cooldown_until, cache.retry_requires_explicit
  from jsonb_to_recordset(p_entries) as entry(
    paper_id text, version integer, input_fingerprint text
  )
  join lighthouse.paper_inline_analysis_cache as cache
    on cache.paper_id = entry.paper_id
    and cache.version = entry.version
    and cache.input_fingerprint = entry.input_fingerprint;
$$;
drop function if exists lighthouse.claim_paper_inline_analysis_generation(jsonb, text, integer);
create function lighthouse.claim_paper_inline_analysis_generation(
  p_entries jsonb, p_lease_token text, p_lease_seconds integer default 30,
  p_retry_command text default 'automatic')
returns table (paper_id text, version integer, input_fingerprint text)
language sql
security definer
set search_path = pg_catalog, lighthouse
as $$
  with requested as (
    select distinct on (entry.paper_id, entry.version, entry.input_fingerprint)
      entry.paper_id, entry.version, entry.input_fingerprint
    from jsonb_to_recordset(p_entries) as entry(
      paper_id text, version integer, input_fingerprint text
    )
    where entry.paper_id is not null and entry.paper_id <> '' and entry.version is not null
      and entry.input_fingerprint ~ '^[0-9a-f]{64}$'
  )
  insert into lighthouse.paper_inline_analysis_cache
    (paper_id, version, input_fingerprint, status, lease_token, lease_expires_at, generation_epoch)
  select requested.paper_id, requested.version, requested.input_fingerprint, 'pending', p_lease_token,
    now() + make_interval(secs => greatest(1, least(p_lease_seconds, 30))),
    1
  from requested
  on conflict (paper_id, version, input_fingerprint) do update
  set analysis = null, source = null, status = 'pending',
    lease_token = excluded.lease_token,
    lease_expires_at = excluded.lease_expires_at,
    generation_epoch = lighthouse.paper_inline_analysis_cache.generation_epoch + 1,
    updated_at = now()
  where (
    lighthouse.paper_inline_analysis_cache.status = 'pending'
    and lighthouse.paper_inline_analysis_cache.lease_expires_at <= now()
    and p_retry_command = 'explicit_retry'
  ) or (
    lighthouse.paper_inline_analysis_cache.status = 'cooldown_failed'
    and lighthouse.paper_inline_analysis_cache.cooldown_until <= now()
    and p_retry_command = 'explicit_retry'
  ) or (
    lighthouse.paper_inline_analysis_cache.status = 'terminal_failed'
    and p_retry_command = 'explicit_retry'
  )
  returning lighthouse.paper_inline_analysis_cache.paper_id,
    lighthouse.paper_inline_analysis_cache.version,
    lighthouse.paper_inline_analysis_cache.input_fingerprint;
$$;
create or replace function lighthouse.fail_paper_inline_analysis_generation(
  p_entries jsonb, p_lease_token text, p_failure_class text,
  p_retry_after_seconds integer default 0)
returns table (
  paper_id text, version integer, input_fingerprint text, failure_count integer,
  cooldown_until timestamptz, retry_requires_explicit boolean
)
language sql
security definer
set search_path = pg_catalog, lighthouse
as $$
  update lighthouse.paper_inline_analysis_cache as cache
  set failure_count = cache.failure_count + 1,
    failure_class = p_failure_class, status = 'cooldown_failed',
    cooldown_until = now() + make_interval(
      secs => greatest(
        case
          when cache.failure_count + 1 = 1 then 300
          when cache.failure_count + 1 = 2 then 900
          else 3600
        end,
        greatest(0, least(p_retry_after_seconds, 86400))
      )
    ),
    retry_requires_explicit = true, lease_token = null, lease_expires_at = null,
    updated_at = now()
  from jsonb_to_recordset(p_entries) as entry(
    paper_id text, version integer, input_fingerprint text
  )
  where (cache.paper_id, cache.version, cache.input_fingerprint) =
      (entry.paper_id, entry.version, entry.input_fingerprint)
    and cache.status = 'pending'
    and cache.lease_token = p_lease_token
  returning cache.paper_id, cache.version, cache.input_fingerprint,
    cache.failure_count, cache.cooldown_until, cache.retry_requires_explicit;
$$;
create or replace function lighthouse.terminal_fail_paper_inline_analysis_generation(
  p_entries jsonb, p_lease_token text, p_failure_class text)
returns table (paper_id text, version integer, input_fingerprint text)
language sql
security definer
set search_path = pg_catalog, lighthouse
as $$
  update lighthouse.paper_inline_analysis_cache as cache
  set failure_count = cache.failure_count + 1,
    failure_class = p_failure_class, status = 'terminal_failed', cooldown_until = null,
    retry_requires_explicit = true, lease_token = null, lease_expires_at = null,
    updated_at = now()
  from jsonb_to_recordset(p_entries) as entry(
    paper_id text, version integer, input_fingerprint text
  )
  where (cache.paper_id, cache.version, cache.input_fingerprint) =
      (entry.paper_id, entry.version, entry.input_fingerprint)
    and cache.status = 'pending'
    and cache.lease_token = p_lease_token
  returning cache.paper_id, cache.version, cache.input_fingerprint;
$$;
create or replace function lighthouse.complete_paper_inline_analysis_generation(
  p_entries jsonb, p_lease_token text)
returns table (paper_id text, version integer, input_fingerprint text)
language sql
security definer
set search_path = pg_catalog, lighthouse
as $$
  update lighthouse.paper_inline_analysis_cache as cache
  set analysis = entry.analysis, source = entry.source, status = 'ready',
    lease_token = null, lease_expires_at = null, failure_count = 0,
    failure_class = null, cooldown_until = null, retry_requires_explicit = false,
    updated_at = now()
  from jsonb_to_recordset(p_entries) as entry(
    paper_id text, version integer, input_fingerprint text, analysis jsonb, source text
  )
  where (cache.paper_id, cache.version, cache.input_fingerprint) =
      (entry.paper_id, entry.version, entry.input_fingerprint)
    and cache.status = 'pending'
    and cache.lease_token = p_lease_token
    and entry.analysis is not null
  returning cache.paper_id, cache.version, cache.input_fingerprint;
$$;
create or replace function lighthouse.release_paper_inline_analysis_generation(
  p_entries jsonb, p_lease_token text)
returns table (paper_id text, version integer, input_fingerprint text)
language sql
security definer
set search_path = pg_catalog, lighthouse
as $$
  with restored as (
    update lighthouse.paper_inline_analysis_cache as cache
    set
      status = case
        when cache.failure_class = 'terminal_generation_failure' then 'terminal_failed'
        else 'cooldown_failed'
      end,
      cooldown_until = case
        when cache.failure_class = 'terminal_generation_failure' then null
        else greatest(coalesce(cache.cooldown_until, now()), now())
      end,
      retry_requires_explicit = true, lease_token = null, lease_expires_at = null,
      updated_at = now()
    from jsonb_to_recordset(p_entries) as entry(
      paper_id text, version integer, input_fingerprint text
    )
    where (cache.paper_id, cache.version, cache.input_fingerprint) =
        (entry.paper_id, entry.version, entry.input_fingerprint)
      and cache.status = 'pending'
      and cache.lease_token = p_lease_token
      and cache.failure_count > 0
    returning cache.paper_id, cache.version, cache.input_fingerprint
  ),
  removed as (
    delete from lighthouse.paper_inline_analysis_cache as cache
    using jsonb_to_recordset(p_entries) as entry(
      paper_id text, version integer, input_fingerprint text
    )
    where (cache.paper_id, cache.version, cache.input_fingerprint) =
        (entry.paper_id, entry.version, entry.input_fingerprint)
      and cache.status = 'pending'
      and cache.lease_token = p_lease_token
      and cache.failure_count = 0
    returning cache.paper_id, cache.version, cache.input_fingerprint
  )
  select * from restored
  union all
  select * from removed;
$$;
revoke all on function lighthouse.claim_paper_inline_analysis_generation(jsonb, text, integer, text) from public, anon, authenticated;
revoke all on function lighthouse.fail_paper_inline_analysis_generation(jsonb, text, text, integer) from public, anon, authenticated;
revoke all on function lighthouse.terminal_fail_paper_inline_analysis_generation(jsonb, text, text) from public, anon, authenticated;
revoke all on function lighthouse.list_paper_inline_analysis_generation_state(jsonb) from public, anon, authenticated;
grant execute on function lighthouse.claim_paper_inline_analysis_generation(jsonb, text, integer, text) to service_role;
grant execute on function lighthouse.fail_paper_inline_analysis_generation(jsonb, text, text, integer) to service_role;
grant execute on function lighthouse.terminal_fail_paper_inline_analysis_generation(jsonb, text, text) to service_role;
grant execute on function lighthouse.list_paper_inline_analysis_generation_state(jsonb) to service_role;

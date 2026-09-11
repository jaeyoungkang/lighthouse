-- Retention cleanup is an operator-owned maintenance capability. Runtime roles
-- cannot call it, and current/future versions plus explicit rollback versions
-- are structurally excluded from deletion.

set local lock_timeout = '3s';
set local statement_timeout = '30s';

create index if not exists paper_inline_analysis_cache_retention_idx
  on lighthouse.paper_inline_analysis_cache (version, updated_at, id)
  where status = 'ready';

create or replace function lighthouse.cleanup_paper_inline_analysis_cache(
  p_current_version integer,
  p_preserved_versions integer[],
  p_delete_version integer,
  p_updated_before timestamptz,
  p_batch_size integer default 200
)
returns integer
language plpgsql
set search_path = pg_catalog, lighthouse
as $$
declare
  deleted_rows integer;
begin
  if p_current_version is null or p_current_version < 1 then
    raise exception 'p_current_version must be positive';
  end if;

  if p_batch_size is null or p_batch_size < 1 or p_batch_size > 500 then
    raise exception 'p_batch_size must be between 1 and 500';
  end if;

  if p_updated_before is null or p_updated_before > now() - interval '30 days' then
    raise exception 'p_updated_before must preserve at least 30 days';
  end if;

  if p_preserved_versions is null then
    raise exception 'p_preserved_versions must be explicit';
  end if;

  if exists (
    select 1
    from unnest(p_preserved_versions) as preserved(version)
    where preserved.version is null
      or preserved.version < 1
      or preserved.version >= p_current_version
  ) then
    raise exception 'preserved versions must be positive and older than current';
  end if;

  if p_delete_version is null or p_delete_version < 1 then
    raise exception 'p_delete_version must be positive';
  end if;

  if p_delete_version >= p_current_version
    or p_delete_version = any(p_preserved_versions) then
    raise exception 'p_delete_version must be older than current and outside preserved versions';
  end if;

  with candidates as (
    select cache.id
    from lighthouse.paper_inline_analysis_cache as cache
    where cache.status = 'ready'
      and cache.version = p_delete_version
      and cache.updated_at < p_updated_before
    order by cache.updated_at, cache.id
    for update skip locked
    limit p_batch_size
  )
  delete from lighthouse.paper_inline_analysis_cache as cache
  using candidates
  where cache.id = candidates.id;

  get diagnostics deleted_rows = row_count;
  return deleted_rows;
end;
$$;

revoke all on function lighthouse.cleanup_paper_inline_analysis_cache(
  integer,
  integer[],
  integer,
  timestamptz,
  integer
) from public, anon, authenticated, service_role;

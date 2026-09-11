\set ON_ERROR_STOP on
\pset pager off

\if :{?current_version}
\else
\set current_version 7
\endif

\if :{?preserved_versions_csv}
\else
\set preserved_versions_csv '6'
\endif

\if :{?cleanup_age_days}
\else
\set cleanup_age_days 30
\endif

begin transaction read only;
set local statement_timeout = '8s';

-- Aggregate-only evidence for Issue #305. The query does not emit paper ids,
-- prompt inputs, analyses, or principal data.
select exists (
  select 1
  from information_schema.columns
  where table_schema = 'lighthouse'
    and table_name = 'paper_inline_analysis_cache'
    and column_name = 'input_fingerprint'
) and exists (
  select 1
  from information_schema.columns
  where table_schema = 'lighthouse'
    and table_name = 'paper_inline_analysis_cache'
    and column_name = 'status'
) as shared_cache_schema
\gset

select
  now() as observed_at,
  case
    when :'shared_cache_schema'::boolean then 'shared-cache'
    else 'legacy-principal-cache'
  end as schema_state,
  pg_database_size(current_database()) as database_bytes,
  pg_size_pretty(pg_database_size(current_database())) as database_size,
  pg_total_relation_size('lighthouse.paper_inline_analysis_cache') as total_relation_bytes,
  pg_size_pretty(pg_total_relation_size('lighthouse.paper_inline_analysis_cache'))
    as total_relation_size,
  round(
    100 * pg_total_relation_size('lighthouse.paper_inline_analysis_cache')::numeric
      / nullif(pg_database_size(current_database()), 0),
    2
  ) as relation_database_percent;

\if :shared_cache_schema
with cache_size as (
  select
    count(*) as total_rows,
    count(*) filter (where status = 'ready') as ready_rows,
    count(*) filter (where status = 'pending') as pending_rows,
    coalesce(sum(pg_column_size(cache)), 0)::bigint as approximate_row_bytes,
    coalesce(
      sum(pg_column_size(cache)) filter (where status = 'ready'),
      0
    )::bigint as approximate_ready_bytes
  from lighthouse.paper_inline_analysis_cache as cache
)
select
  total_rows,
  ready_rows,
  pending_rows,
  approximate_row_bytes,
  pg_size_pretty(approximate_row_bytes) as approximate_row_size,
  approximate_ready_bytes,
  pg_size_pretty(approximate_ready_bytes) as approximate_ready_size,
  round(
    100 * approximate_ready_bytes::numeric
      / nullif(pg_database_size(current_database()), 0),
    2
  ) as approximate_ready_database_percent
from cache_size;

select
  version,
  status,
  count(*) as rows,
  count(distinct paper_id) as papers,
  min(created_at) as oldest_created_at,
  max(created_at) as newest_created_at,
  min(updated_at) as oldest_updated_at,
  max(updated_at) as newest_updated_at,
  pg_size_pretty(
    coalesce(sum(pg_column_size(cache)), 0)::bigint
  ) as approximate_row_size
from lighthouse.paper_inline_analysis_cache as cache
group by version, status
order by version desc, status;

with ready_age as (
  select
    case
      when updated_at >= now() - interval '7 days' then '00-07d'
      when updated_at >= now() - interval '30 days' then '08-30d'
      when updated_at >= now() - interval '90 days' then '31-90d'
      else '91d+'
    end as updated_age_bucket,
    pg_column_size(cache) as row_bytes
  from lighthouse.paper_inline_analysis_cache as cache
  where status = 'ready'
)
select
  updated_age_bucket,
  count(*) as rows,
  pg_size_pretty(coalesce(sum(row_bytes), 0)::bigint) as approximate_row_size
from ready_age
group by updated_age_bucket
order by updated_age_bucket;

with policy as (
  select
    :'current_version'::integer as current_version,
    string_to_array(:'preserved_versions_csv', ',')::integer[] as preserved_versions,
    :'cleanup_age_days'::integer as cleanup_age_days
), eligible as (
  select pg_column_size(cache) as row_bytes
  from lighthouse.paper_inline_analysis_cache as cache
  cross join policy
  where cache.status = 'ready'
    and cache.version < policy.current_version
    and cache.version <> all(policy.preserved_versions)
    and cache.updated_at < now() - make_interval(days => policy.cleanup_age_days)
)
select
  current_version,
  preserved_versions,
  cleanup_age_days,
  count(eligible.*) as cleanup_eligible_rows,
  coalesce(sum(eligible.row_bytes), 0)::bigint as cleanup_eligible_bytes,
  pg_size_pretty(
    coalesce(sum(eligible.row_bytes), 0)::bigint
  ) as cleanup_eligible_size
from policy
left join eligible on true
group by current_version, preserved_versions, cleanup_age_days;

with per_paper as (
  select
    paper_id,
    count(*) as ready_identities,
    count(distinct version) as ready_versions,
    count(distinct input_fingerprint) as ready_fingerprints
  from lighthouse.paper_inline_analysis_cache
  where status = 'ready'
  group by paper_id
)
select
  count(*) as papers,
  max(ready_identities) as max_ready_identities_per_paper,
  percentile_cont(0.5) within group (order by ready_identities) as p50_ready_identities_per_paper,
  percentile_cont(0.95) within group (order by ready_identities) as p95_ready_identities_per_paper,
  max(ready_versions) as max_ready_versions_per_paper,
  max(ready_fingerprints) as max_ready_fingerprints_per_paper
from per_paper;

with recent_ready as (
  select
    count(*) as rows,
    coalesce(sum(pg_column_size(cache)), 0)::bigint as row_bytes
  from lighthouse.paper_inline_analysis_cache as cache
  where status = 'ready'
    and created_at >= now() - interval '30 days'
)
select
  rows as ready_rows_created_30d,
  row_bytes as approximate_ready_bytes_created_30d,
  pg_size_pretty(row_bytes) as approximate_ready_size_created_30d,
  round(
    100 * row_bytes::numeric / nullif(pg_database_size(current_database()), 0),
    2
  ) as approximate_ready_created_30d_database_percent
from recent_ready;

select
  date_trunc('day', created_at) as day,
  count(*) filter (where status = 'ready') as ready_rows_created,
  pg_size_pretty(
    coalesce(sum(pg_column_size(cache)) filter (where status = 'ready'), 0)::bigint
  ) as approximate_ready_bytes_created
from lighthouse.paper_inline_analysis_cache as cache
where created_at >= now() - interval '30 days'
group by date_trunc('day', created_at)
order by day;

\else
-- Before migration 00020 the production table is principal-keyed. These
-- aggregates are deployment evidence only and must not be presented as a
-- baseline for the shared identity or used to authorize shared-cache cleanup.
select
  count(*) as legacy_total_rows,
  count(*) filter (where analysis is not null) as legacy_success_rows,
  count(distinct paper_id) as legacy_papers,
  coalesce(sum(pg_column_size(cache)), 0)::bigint as approximate_row_bytes,
  pg_size_pretty(
    coalesce(sum(pg_column_size(cache)), 0)::bigint
  ) as approximate_row_size
from lighthouse.paper_inline_analysis_cache as cache;

select
  version,
  count(*) as legacy_rows,
  count(distinct paper_id) as legacy_papers,
  min(created_at) as oldest_created_at,
  max(created_at) as newest_created_at,
  pg_size_pretty(
    coalesce(sum(pg_column_size(cache)), 0)::bigint
  ) as approximate_row_size
from lighthouse.paper_inline_analysis_cache as cache
group by version
order by version desc;

select
  date_trunc('day', created_at) as day,
  count(*) as legacy_rows_created,
  pg_size_pretty(
    coalesce(sum(pg_column_size(cache)), 0)::bigint
  ) as approximate_bytes_created
from lighthouse.paper_inline_analysis_cache as cache
where created_at >= now() - interval '30 days'
group by date_trunc('day', created_at)
order by day;
\endif

rollback;

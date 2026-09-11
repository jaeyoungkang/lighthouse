-- #417: a principal may own at most one active Gap build across reports.
-- The row is a short admission lease, not a durable job queue. The report row
-- continues to own build state and attempt fencing.

create table lighthouse.gap_build_principal_admissions (
  principal_id text primary key check (btrim(principal_id) <> ''),
  gap_report_id uuid not null references lighthouse.gap_reports(id) on delete cascade,
  report_version_at_claim integer not null check (report_version_at_claim >= 0),
  lease_token text not null check (btrim(lease_token) <> ''),
  lease_expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index gap_build_principal_admissions_expiry_idx
  on lighthouse.gap_build_principal_admissions (lease_expires_at);

drop trigger if exists set_gap_build_principal_admissions_updated_at
  on lighthouse.gap_build_principal_admissions;
create trigger set_gap_build_principal_admissions_updated_at
before update on lighthouse.gap_build_principal_admissions
for each row execute function public.update_updated_at();

alter table lighthouse.gap_build_principal_admissions enable row level security;
revoke all on table lighthouse.gap_build_principal_admissions
  from public, anon, authenticated, service_role;

create function lighthouse.claim_gap_build_principal_admission(
  p_principal_id text,
  p_gap_report_id uuid,
  p_lease_token text,
  p_lease_seconds integer default 70
)
returns table (
  outcome text,
  active_gap_report_id uuid,
  acquired_lease_token text,
  lease_expires_at timestamptz,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = pg_catalog, lighthouse
as $$
declare
  current_admission lighthouse.gap_build_principal_admissions%rowtype;
  current_report_terminal boolean := false;
  requested_report_version integer;
  bounded_lease_seconds integer := greatest(1, least(p_lease_seconds, 120));
  claimed_until timestamptz := now() + make_interval(secs => bounded_lease_seconds);
begin
  if p_principal_id is null or btrim(p_principal_id) = '' then
    raise exception 'principal id is required' using errcode = '22023';
  end if;
  if p_lease_token is null or btrim(p_lease_token) = '' then
    raise exception 'lease token is required' using errcode = '22023';
  end if;

  select report.version into requested_report_version
  from lighthouse.gap_reports as report
  where report.id = p_gap_report_id
  for share;
  if not found then
    raise exception 'gap report is required' using errcode = '23503';
  end if;

  loop
    insert into lighthouse.gap_build_principal_admissions (
      principal_id,
      gap_report_id,
      report_version_at_claim,
      lease_token,
      lease_expires_at
    ) values (
      p_principal_id,
      p_gap_report_id,
      requested_report_version,
      p_lease_token,
      claimed_until
    )
    on conflict (principal_id) do nothing
    returning * into current_admission;

    if found then
      return query select
        'acquired'::text,
        p_gap_report_id,
        p_lease_token,
        claimed_until,
        0;
      return;
    end if;

    select * into current_admission
    from lighthouse.gap_build_principal_admissions
    where principal_id = p_principal_id
    for update;

    exit when found;
  end loop;

  select exists (
    select 1
    from lighthouse.gap_reports as report
    where report.id = current_admission.gap_report_id
      and (
        report.status = 'failed'
        or report.metadata #>> '{gapNetworkBuild,phase}' in ('complete', 'failed')
      )
      and report.version > current_admission.report_version_at_claim
  ) into current_report_terminal;

  if current_admission.lease_expires_at <= now() or current_report_terminal then
    update lighthouse.gap_build_principal_admissions
    set gap_report_id = p_gap_report_id,
      report_version_at_claim = requested_report_version,
      lease_token = p_lease_token,
      lease_expires_at = claimed_until,
      updated_at = now()
    where principal_id = p_principal_id
    returning * into current_admission;

    return query select
      'acquired'::text,
      current_admission.gap_report_id,
      current_admission.lease_token,
      current_admission.lease_expires_at,
      0;
    return;
  end if;

  if current_admission.gap_report_id = p_gap_report_id then
    return query select
      'same_report'::text,
      current_admission.gap_report_id,
      null::text,
      current_admission.lease_expires_at,
      greatest(1, ceil(extract(epoch from current_admission.lease_expires_at - now())))::integer;
    return;
  end if;

  return query select
    'blocked'::text,
    current_admission.gap_report_id,
    null::text,
    current_admission.lease_expires_at,
    greatest(1, ceil(extract(epoch from current_admission.lease_expires_at - now())))::integer;
end;
$$;

create function lighthouse.release_gap_build_principal_admission(
  p_principal_id text,
  p_gap_report_id uuid,
  p_lease_token text
)
returns boolean
language sql
security definer
set search_path = pg_catalog, lighthouse
as $$
  with released as (
    delete from lighthouse.gap_build_principal_admissions
    where principal_id = p_principal_id
      and gap_report_id = p_gap_report_id
      and lease_token = p_lease_token
    returning 1
  )
  select exists(select 1 from released);
$$;

revoke all on function lighthouse.claim_gap_build_principal_admission(text, uuid, text, integer)
  from public, anon, authenticated;
revoke all on function lighthouse.release_gap_build_principal_admission(text, uuid, text)
  from public, anon, authenticated;
grant execute on function lighthouse.claim_gap_build_principal_admission(text, uuid, text, integer)
  to service_role;
grant execute on function lighthouse.release_gap_build_principal_admission(text, uuid, text)
  to service_role;

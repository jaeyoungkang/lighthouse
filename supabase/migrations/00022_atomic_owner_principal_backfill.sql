-- Move the remaining legacy app-user ownership rows as one transaction. A
-- reviewed-paper identity that already exists for the target principal wins;
-- its legacy duplicate is removed before the remaining rows are remapped.

drop function if exists lighthouse.backfill_owner_principal_for_app_user(uuid, text);

create function lighthouse.backfill_owner_principal_for_app_user(
  p_user_id uuid,
  p_owner_principal_id text
)
returns text[]
language plpgsql
set search_path = pg_catalog, public, lighthouse
set lock_timeout = '3s'
set statement_timeout = '10s'
as $$
declare
  linked_at timestamptz;
  linked_principal text;
  previous_principal_ids text[];
  affected_rows integer;
  did_change boolean := false;
begin
  if p_user_id is null then
    raise exception 'p_user_id must be present';
  end if;
  if p_owner_principal_id is null or btrim(p_owner_principal_id) = '' then
    raise exception 'p_owner_principal_id must be present';
  end if;

  select app_user.principal_linked_at, app_user.owner_principal_id
    into linked_at, linked_principal
  from public.app_users as app_user
  where app_user.id = p_user_id
  for update;

  if not found then
    return '{}'::text[];
  end if;
  if linked_at is not null and linked_principal is distinct from p_owner_principal_id then
    raise exception 'app user is already linked to a different owner principal';
  end if;
  if exists (
    select 1
    from lighthouse.reviewed_papers as paper
    where paper.user_id = p_user_id
      and paper.owner_principal_id is not null
      and paper.owner_principal_id <> p_user_id::text
      and paper.owner_principal_id is distinct from p_owner_principal_id
  ) then
    raise exception 'reviewed paper owner backfill found a non-legacy principal';
  end if;
  if exists (
    select 1
    from lighthouse.interaction_events as event
    where event.user_id = p_user_id
      and event.owner_principal_id is not null
      and event.owner_principal_id <> p_user_id::text
      and event.owner_principal_id is distinct from p_owner_principal_id
  ) then
    raise exception 'interaction event owner backfill found a non-legacy principal';
  end if;

  select coalesce(array_agg(distinct candidate.principal_id), '{}'::text[])
    into previous_principal_ids
  from (
    select coalesce(paper.owner_principal_id, p_user_id::text) as principal_id
    from lighthouse.reviewed_papers as paper
    where paper.user_id = p_user_id
      and (paper.owner_principal_id is null or paper.owner_principal_id = p_user_id::text)
      and paper.owner_principal_id is distinct from p_owner_principal_id
    union all
    select coalesce(event.owner_principal_id, p_user_id::text) as principal_id
    from lighthouse.interaction_events as event
    where event.user_id = p_user_id
      and (event.owner_principal_id is null or event.owner_principal_id = p_user_id::text)
      and event.owner_principal_id is distinct from p_owner_principal_id
    union all
    select linked_principal
    where linked_at is not null
      and linked_principal is distinct from p_owner_principal_id
    union all
    select p_user_id::text
    where linked_at is null
  ) as candidate;

  delete from lighthouse.reviewed_papers as legacy
  using lighthouse.reviewed_papers as current
  where legacy.user_id = p_user_id
    and (legacy.owner_principal_id is null or legacy.owner_principal_id = p_user_id::text)
    and legacy.owner_principal_id is distinct from p_owner_principal_id
    and current.owner_principal_id = p_owner_principal_id
    and current.paper_id = legacy.paper_id
    and current.id <> legacy.id;
  get diagnostics affected_rows = row_count;
  did_change := did_change or affected_rows > 0;

  update lighthouse.interaction_events as event
  set owner_principal_id = p_owner_principal_id
  where event.user_id = p_user_id
    and (event.owner_principal_id is null or event.owner_principal_id = p_user_id::text)
    and event.owner_principal_id is distinct from p_owner_principal_id;
  get diagnostics affected_rows = row_count;
  did_change := did_change or affected_rows > 0;

  update lighthouse.reviewed_papers as paper
  set owner_principal_id = p_owner_principal_id
  where paper.user_id = p_user_id
    and (paper.owner_principal_id is null or paper.owner_principal_id = p_user_id::text)
    and paper.owner_principal_id is distinct from p_owner_principal_id;
  get diagnostics affected_rows = row_count;
  did_change := did_change or affected_rows > 0;

  if exists (
    select 1
    from lighthouse.reviewed_papers as paper
    where paper.user_id = p_user_id
      and paper.owner_principal_id is distinct from p_owner_principal_id
  ) then
    raise exception 'reviewed paper owner backfill left legacy rows';
  end if;
  if exists (
    select 1
    from lighthouse.interaction_events as event
    where event.user_id = p_user_id
      and event.owner_principal_id is distinct from p_owner_principal_id
  ) then
    raise exception 'interaction event owner backfill left legacy rows';
  end if;

  if linked_at is null or linked_principal is distinct from p_owner_principal_id then
    update public.app_users as app_user
    set principal_linked_at = now(),
        owner_principal_id = p_owner_principal_id
    where app_user.id = p_user_id;
    did_change := true;
  end if;

  return case when did_change then previous_principal_ids else '{}'::text[] end;
end;
$$;

revoke all on function lighthouse.backfill_owner_principal_for_app_user(uuid, text)
  from public, anon, authenticated;
grant execute on function lighthouse.backfill_owner_principal_for_app_user(uuid, text)
  to service_role;

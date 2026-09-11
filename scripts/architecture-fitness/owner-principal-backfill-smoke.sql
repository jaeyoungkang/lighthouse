-- Run only against an isolated/local database with migration 00022 applied.
-- The transaction proves a colliding reviewed paper does not strand a distinct
-- legacy paper or stamp the app-user link before both ownership moves settle.

\set ON_ERROR_STOP on

\if :{?local_smoke}
\else
\echo 'refusing owner-principal backfill smoke without --set local_smoke=1'
\quit 3
\endif

\if :local_smoke
\else
\echo 'refusing owner-principal backfill smoke unless local_smoke is truthy'
\quit 3
\endif

begin;

do $$
declare
  legacy_user_id uuid := gen_random_uuid();
  target_principal text := 'owner-principal-backfill-smoke';
  rotated_principal text := 'owner-principal-backfill-smoke-rotated';
  previous_principal_ids text[];
begin
  insert into public.app_users (id, email)
  values (legacy_user_id, 'owner-principal-backfill-smoke@example.invalid');

  insert into lighthouse.reviewed_papers
    (user_id, owner_principal_id, paper_id, title)
  values
    (legacy_user_id, legacy_user_id::text, 'collision-paper', 'legacy collision'),
    (legacy_user_id, legacy_user_id::text, 'distinct-paper', 'legacy distinct'),
    (null, target_principal, 'collision-paper', 'current collision');

  insert into lighthouse.interaction_events
    (user_id, owner_principal_id, event_type)
  values (legacy_user_id, legacy_user_id::text, 'owner-principal-backfill-smoke');

  previous_principal_ids := lighthouse.backfill_owner_principal_for_app_user(
    legacy_user_id,
    target_principal
  );
  if not legacy_user_id::text = any(previous_principal_ids) then
    raise exception 'initial owner principal backfill omitted the legacy principal';
  end if;

  if (select count(*) from lighthouse.reviewed_papers where paper_id = 'collision-paper') <> 1 then
    raise exception 'reviewed paper collision was not reconciled';
  end if;
  if not exists (
    select 1 from lighthouse.reviewed_papers
    where paper_id = 'distinct-paper' and owner_principal_id = target_principal
  ) then
    raise exception 'non-colliding reviewed paper was not moved';
  end if;
  if not exists (
    select 1 from lighthouse.interaction_events
    where user_id = legacy_user_id and owner_principal_id = target_principal
  ) then
    raise exception 'interaction event was not moved';
  end if;
  if not exists (
    select 1 from public.app_users
    where id = legacy_user_id
      and owner_principal_id = target_principal
      and principal_linked_at is not null
  ) then
    raise exception 'app user link was not stamped after the ownership move';
  end if;

  -- Reproduce the historical 23505-skip damage: the app-user link is already
  -- stamped, but a non-colliding row remains under the Supabase principal.
  insert into lighthouse.reviewed_papers
    (user_id, owner_principal_id, paper_id, title)
  values
    (legacy_user_id, legacy_user_id::text, 'historically-stranded-paper', 'stranded');

  previous_principal_ids := lighthouse.backfill_owner_principal_for_app_user(
    legacy_user_id,
    target_principal
  );
  if not legacy_user_id::text = any(previous_principal_ids) then
    raise exception 'same-principal repair omitted the stranded legacy principal';
  end if;
  if not exists (
    select 1 from lighthouse.reviewed_papers
    where paper_id = 'historically-stranded-paper'
      and owner_principal_id = target_principal
  ) then
    raise exception 'same-principal repair did not move the stranded row';
  end if;

  -- Verified email continuity alone is not authority to transfer private rows
  -- between two token subjects. A mismatched linked principal fails closed.
  begin
    perform lighthouse.backfill_owner_principal_for_app_user(
      legacy_user_id,
      rotated_principal
    );
    raise exception 'principal mismatch was accepted';
  exception
    when others then
      if sqlerrm = 'principal mismatch was accepted' then
        raise;
      end if;
      if sqlerrm <> 'app user is already linked to a different owner principal' then
        raise exception 'principal mismatch failed for an unexpected reason: %', sqlerrm;
      end if;
  end;

  if not exists (
    select 1 from public.app_users
    where id = legacy_user_id and owner_principal_id = target_principal
  ) then
    raise exception 'principal mismatch changed the authoritative link';
  end if;

  if cardinality(lighthouse.backfill_owner_principal_for_app_user(
    legacy_user_id,
    target_principal
  )) <> 0 then
    raise exception 'fully reconciled owner principal backfill was not a no-op';
  end if;

  -- user_id is only legacy provenance for NULL or the historical app_users.id
  -- owner. It cannot authorize transfer from another token subject.
  insert into lighthouse.reviewed_papers
    (user_id, owner_principal_id, paper_id, title)
  values
    (legacy_user_id, 'untrusted-nonlegacy-owner', 'nonlegacy-owner-paper', 'untrusted');

  begin
    perform lighthouse.backfill_owner_principal_for_app_user(
      legacy_user_id,
      target_principal
    );
    raise exception 'non-legacy reviewed-paper principal was accepted';
  exception
    when others then
      if sqlerrm = 'non-legacy reviewed-paper principal was accepted' then
        raise;
      end if;
      if sqlerrm <> 'reviewed paper owner backfill found a non-legacy principal' then
        raise exception 'non-legacy reviewed-paper check failed unexpectedly: %', sqlerrm;
      end if;
  end;

  if not exists (
    select 1 from lighthouse.reviewed_papers
    where paper_id = 'nonlegacy-owner-paper'
      and owner_principal_id = 'untrusted-nonlegacy-owner'
  ) then
    raise exception 'non-legacy reviewed-paper owner was transferred';
  end if;

  delete from lighthouse.reviewed_papers
  where paper_id = 'nonlegacy-owner-paper';

  insert into lighthouse.interaction_events
    (user_id, owner_principal_id, event_type)
  values
    (legacy_user_id, 'untrusted-nonlegacy-owner', 'nonlegacy-owner-event');

  begin
    perform lighthouse.backfill_owner_principal_for_app_user(
      legacy_user_id,
      target_principal
    );
    raise exception 'non-legacy interaction principal was accepted';
  exception
    when others then
      if sqlerrm = 'non-legacy interaction principal was accepted' then
        raise;
      end if;
      if sqlerrm <> 'interaction event owner backfill found a non-legacy principal' then
        raise exception 'non-legacy interaction check failed unexpectedly: %', sqlerrm;
      end if;
  end;

  if not exists (
    select 1 from lighthouse.interaction_events
    where event_type = 'nonlegacy-owner-event'
      and owner_principal_id = 'untrusted-nonlegacy-owner'
  ) then
    raise exception 'non-legacy interaction owner was transferred';
  end if;
end;
$$;

rollback;

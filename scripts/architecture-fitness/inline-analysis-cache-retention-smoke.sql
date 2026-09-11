\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned

\if :{?local_smoke}
\else
\echo 'refusing retention smoke without --set local_smoke=1'
\quit 3
\endif

\if :local_smoke
\else
\echo 'refusing retention smoke unless local_smoke is truthy'
\quit 3
\endif

begin;

insert into lighthouse.paper_inline_analysis_cache (
  paper_id,
  version,
  input_fingerprint,
  analysis,
  source,
  status,
  updated_at
)
select
  'retention-smoke-eligible-' || value,
  1,
  lpad(value::text, 64, 'a'),
  '{}'::jsonb,
  'abstract',
  'ready',
  now() - interval '100 years'
from generate_series(1, 3) as value;

insert into lighthouse.paper_inline_analysis_cache (
  paper_id,
  version,
  input_fingerprint,
  analysis,
  source,
  status,
  updated_at
)
values
  (
    'retention-smoke-current',
    7,
    repeat('b', 64),
    '{}'::jsonb,
    'abstract',
    'ready',
    now() - interval '100 years'
  ),
  (
    'retention-smoke-rollback',
    6,
    repeat('c', 64),
    '{}'::jsonb,
    'abstract',
    'ready',
    now() - interval '100 years'
  ),
  (
    'retention-smoke-recent',
    1,
    repeat('d', 64),
    '{}'::jsonb,
    'abstract',
    'ready',
    now() - interval '29 days'
  );

insert into lighthouse.paper_inline_analysis_cache (
  paper_id,
  version,
  input_fingerprint,
  status,
  lease_token,
  lease_expires_at,
  updated_at
)
values (
  'retention-smoke-pending',
  1,
  repeat('e', 64),
  'pending',
  'retention-smoke-lease',
  now() + interval '1 minute',
  now() - interval '100 years'
);

create temporary table retention_smoke_results (
  sequence integer primary key,
  deleted_rows integer not null
) on commit drop;

insert into retention_smoke_results
values (
  1,
  lighthouse.cleanup_paper_inline_analysis_cache(
    7,
    array[6],
    1,
    now() - interval '99 years',
    2
  )
);

insert into retention_smoke_results
values (
  2,
  lighthouse.cleanup_paper_inline_analysis_cache(
    7,
    array[6],
    1,
    now() - interval '99 years',
    2
  )
);

insert into retention_smoke_results
values (
  3,
  lighthouse.cleanup_paper_inline_analysis_cache(
    7,
    array[6],
    1,
    now() - interval '99 years',
    2
  )
);

do $$
declare
  actual integer[];
begin
  select array_agg(deleted_rows order by sequence)
  into actual
  from retention_smoke_results;

  if actual <> array[2, 1, 0] then
    raise exception 'cleanup batch/idempotency assertion failed: %', actual;
  end if;

  if exists (
    select 1
    from lighthouse.paper_inline_analysis_cache
    where paper_id like 'retention-smoke-eligible-%'
  ) then
    raise exception 'eligible old ready rows survived cleanup';
  end if;

  if (
    select count(*)
    from lighthouse.paper_inline_analysis_cache
    where paper_id in (
      'retention-smoke-current',
      'retention-smoke-rollback',
      'retention-smoke-recent',
      'retention-smoke-pending'
    )
  ) <> 4 then
    raise exception 'a protected current/rollback/recent/pending row was deleted';
  end if;

  if has_function_privilege(
    'anon',
    'lighthouse.cleanup_paper_inline_analysis_cache(integer,integer[],integer,timestamptz,integer)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'lighthouse.cleanup_paper_inline_analysis_cache(integer,integer[],integer,timestamptz,integer)',
    'EXECUTE'
  ) or has_function_privilege(
    'service_role',
    'lighthouse.cleanup_paper_inline_analysis_cache(integer,integer[],integer,timestamptz,integer)',
    'EXECUTE'
  ) then
    raise exception 'a runtime role can execute the operator cleanup function';
  end if;
end;
$$;

insert into lighthouse.paper_inline_analysis_cache (
  paper_id,
  version,
  input_fingerprint,
  analysis,
  source,
  status,
  updated_at
)
values (
  'retention-smoke-forced-failure',
  2,
  repeat('f', 64),
  '{}'::jsonb,
  'abstract',
  'ready',
  now() - interval '200 years'
);

create or replace function pg_temp.fail_retention_smoke_delete()
returns trigger
language plpgsql
as $$
begin
  if old.paper_id = 'retention-smoke-forced-failure' then
    raise exception 'retention smoke forced delete failure';
  end if;
  return old;
end;
$$;

create trigger retention_smoke_forced_delete_failure
after delete on lighthouse.paper_inline_analysis_cache
for each row execute function pg_temp.fail_retention_smoke_delete();

do $$
declare
  caught_message text;
  fixed_cutoff constant timestamptz := now() - interval '99 years';
  retried_rows integer;
begin
  begin
    perform lighthouse.cleanup_paper_inline_analysis_cache(
      7,
      array[6],
      2,
      fixed_cutoff,
      1
    );
    raise exception 'smoke assertion: cleanup did not surface the forced delete failure';
  exception when others then
    get stacked diagnostics caught_message = message_text;
    if caught_message =
      'smoke assertion: cleanup did not surface the forced delete failure' then
      raise;
    end if;
    if caught_message <> 'retention smoke forced delete failure' then
      raise exception 'unexpected forced cleanup error: %', caught_message;
    end if;
  end;

  if not exists (
    select 1
    from lighthouse.paper_inline_analysis_cache
    where paper_id = 'retention-smoke-forced-failure'
      and status = 'ready'
  ) then
    raise exception 'failed cleanup did not roll back its ready-row delete';
  end if;

  if not exists (
    select 1
    from lighthouse.paper_inline_analysis_cache
    where paper_id = 'retention-smoke-pending'
      and status = 'pending'
  ) then
    raise exception 'failed cleanup changed a pending lease row';
  end if;

  execute 'drop trigger retention_smoke_forced_delete_failure '
    'on lighthouse.paper_inline_analysis_cache';

  retried_rows := lighthouse.cleanup_paper_inline_analysis_cache(
    7,
    array[6],
    2,
    fixed_cutoff,
    1
  );
  if retried_rows <> 1 then
    raise exception 'same-cutoff cleanup retry deleted % rows instead of 1', retried_rows;
  end if;

  if exists (
    select 1
    from lighthouse.paper_inline_analysis_cache
    where paper_id = 'retention-smoke-forced-failure'
  ) then
    raise exception 'same-cutoff cleanup retry left the eligible ready row';
  end if;
end;
$$;

do $$
declare
  caught_message text;
begin
  begin
    perform lighthouse.cleanup_paper_inline_analysis_cache(
      7,
      array[6],
      1,
      now() - interval '29 days',
      200
    );
    raise exception 'smoke assertion: accepted a cutoff newer than 30 days';
  exception when others then
    get stacked diagnostics caught_message = message_text;
    if caught_message = 'smoke assertion: accepted a cutoff newer than 30 days' then
      raise;
    end if;
    if caught_message <> 'p_updated_before must preserve at least 30 days' then
      raise exception 'unexpected cutoff validation error: %', caught_message;
    end if;
  end;

  begin
    perform lighthouse.cleanup_paper_inline_analysis_cache(
      7,
      array[6],
      1,
      now() - interval '30 days',
      501
    );
    raise exception 'smoke assertion: accepted a batch larger than 500';
  exception when others then
    get stacked diagnostics caught_message = message_text;
    if caught_message = 'smoke assertion: accepted a batch larger than 500' then
      raise;
    end if;
    if caught_message <> 'p_batch_size must be between 1 and 500' then
      raise exception 'unexpected batch validation error: %', caught_message;
    end if;
  end;

  begin
    perform lighthouse.cleanup_paper_inline_analysis_cache(
      7,
      array[6],
      1,
      now() - interval '30 days',
      null
    );
    raise exception 'smoke assertion: accepted a null batch';
  exception when others then
    get stacked diagnostics caught_message = message_text;
    if caught_message = 'smoke assertion: accepted a null batch' then
      raise;
    end if;
    if caught_message <> 'p_batch_size must be between 1 and 500' then
      raise exception 'unexpected null-batch validation error: %', caught_message;
    end if;
  end;

  begin
    perform lighthouse.cleanup_paper_inline_analysis_cache(
      7,
      array[7],
      1,
      now() - interval '30 days',
      200
    );
    raise exception 'smoke assertion: accepted current as a preserved rollback version';
  exception when others then
    get stacked diagnostics caught_message = message_text;
    if caught_message = 'smoke assertion: accepted current as a preserved rollback version' then
      raise;
    end if;
    if caught_message <> 'preserved versions must be positive and older than current' then
      raise exception 'unexpected preserved-version validation error: %', caught_message;
    end if;
  end;

  begin
    perform lighthouse.cleanup_paper_inline_analysis_cache(
      7,
      array[6, null],
      1,
      now() - interval '30 days',
      200
    );
    raise exception 'smoke assertion: accepted a null preserved version';
  exception when others then
    get stacked diagnostics caught_message = message_text;
    if caught_message = 'smoke assertion: accepted a null preserved version' then
      raise;
    end if;
    if caught_message <> 'preserved versions must be positive and older than current' then
      raise exception 'unexpected null-preserved-version validation error: %', caught_message;
    end if;
  end;

  begin
    perform lighthouse.cleanup_paper_inline_analysis_cache(
      7,
      null,
      1,
      now() - interval '30 days',
      200
    );
    raise exception 'smoke assertion: accepted a null preserved-version list';
  exception when others then
    get stacked diagnostics caught_message = message_text;
    if caught_message = 'smoke assertion: accepted a null preserved-version list' then
      raise;
    end if;
    if caught_message <> 'p_preserved_versions must be explicit' then
      raise exception 'unexpected null-preserved-list validation error: %', caught_message;
    end if;
  end;

  begin
    perform lighthouse.cleanup_paper_inline_analysis_cache(
      7,
      array[6],
      6,
      now() - interval '30 days',
      200
    );
    raise exception 'smoke assertion: accepted a preserved delete version';
  exception when others then
    get stacked diagnostics caught_message = message_text;
    if caught_message = 'smoke assertion: accepted a preserved delete version' then
      raise;
    end if;
    if caught_message <>
      'p_delete_version must be older than current and outside preserved versions' then
      raise exception 'unexpected preserved-delete validation error: %', caught_message;
    end if;
  end;

  begin
    perform lighthouse.cleanup_paper_inline_analysis_cache(
      7,
      array[6],
      7,
      now() - interval '30 days',
      200
    );
    raise exception 'smoke assertion: accepted the current delete version';
  exception when others then
    get stacked diagnostics caught_message = message_text;
    if caught_message = 'smoke assertion: accepted the current delete version' then
      raise;
    end if;
    if caught_message <>
      'p_delete_version must be older than current and outside preserved versions' then
      raise exception 'unexpected current-delete validation error: %', caught_message;
    end if;
  end;
end;
$$;

select 'inline-analysis cache retention smoke: OK';

rollback;

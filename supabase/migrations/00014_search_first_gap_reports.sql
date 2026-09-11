create table if not exists lighthouse.gap_reports (
  id uuid primary key default gen_random_uuid(),
  owner_principal_id text not null,
  source_snapshot_id text not null,
  title text not null,
  content text not null default '',
  created_by text not null check (created_by in ('user', 'agent')),
  metadata jsonb not null,
  reaction jsonb,
  reaction_history jsonb not null default '[]'::jsonb,
  refs text[] not null default '{}',
  status text not null default 'ready' check (status in ('pending', 'ready', 'failed')),
  version integer not null default 0,
  reaction_version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gap_reports_metadata_type_check check (metadata ->> 'type' = 'gap_network'),
  constraint gap_reports_metadata_source_check check (
    metadata ->> 'sourceSnapshotId' = source_snapshot_id
  )
);

create index if not exists gap_reports_owner_idx
  on lighthouse.gap_reports (owner_principal_id);

create index if not exists gap_reports_owner_source_idx
  on lighthouse.gap_reports (owner_principal_id, source_snapshot_id, created_at);

create index if not exists gap_reports_owner_pending_idx
  on lighthouse.gap_reports (owner_principal_id, status, updated_at desc)
  where status <> 'ready';

create index if not exists gap_reports_owner_updated_idx
  on lighthouse.gap_reports (owner_principal_id, updated_at desc);

drop trigger if exists set_gap_reports_updated_at on lighthouse.gap_reports;
create trigger set_gap_reports_updated_at
before update on lighthouse.gap_reports
for each row execute function public.update_updated_at();

alter table lighthouse.gap_reports enable row level security;

grant select, insert, update, delete on lighthouse.gap_reports to authenticated;
grant select, insert, update, delete on lighthouse.gap_reports to service_role;

insert into lighthouse.gap_reports (
  id,
  owner_principal_id,
  source_snapshot_id,
  title,
  content,
  created_by,
  metadata,
  reaction,
  reaction_history,
  refs,
  status,
  version,
  reaction_version,
  created_at,
  updated_at
)
select
  id,
  owner_principal_id,
  metadata ->> 'sourceSnapshotId',
  title,
  content,
  created_by,
  metadata,
  reaction,
  coalesce(reaction_history, '[]'::jsonb),
  refs,
  status,
  version,
  reaction_version,
  created_at,
  updated_at
from lighthouse.documents
where type = 'gap_network'
  and owner_principal_id is not null
  and metadata ->> 'type' = 'gap_network'
  and metadata ->> 'sourceSnapshotId' is not null
on conflict (id) do nothing;

delete from lighthouse.documents as d
where type = 'gap_network'
  and exists (
    select 1
    from lighthouse.gap_reports as gap_report
    where gap_report.id = d.id
  );

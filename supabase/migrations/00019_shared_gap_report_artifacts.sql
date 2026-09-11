-- Gap reports are authenticated-member shared artifacts, not creator-owned rows.
-- The service is pre-launch with no external users, so replace the disposable
-- owner-scoped tables instead of carrying compatibility reads or backfills.

drop table if exists lighthouse.gap_report_reactions;
drop table if exists lighthouse.gap_reports cascade;

create table lighthouse.gap_reports (
  id uuid primary key default gen_random_uuid(),
  source_snapshot_id text not null,
  source_input_digest text not null check (source_input_digest ~ '^[0-9a-f]{64}$'),
  title text not null,
  content text not null default '',
  created_by text not null check (created_by in ('user', 'agent')),
  metadata jsonb not null,
  refs text[] not null default '{}',
  status text not null default 'ready' check (status in ('pending', 'ready', 'failed')),
  version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gap_reports_source_input_digest_unique unique (source_input_digest),
  constraint gap_reports_metadata_type_check check (metadata ->> 'type' = 'gap_network'),
  constraint gap_reports_metadata_source_check check (
    metadata ->> 'sourceSnapshotId' = source_snapshot_id
  )
);

create index gap_reports_source_snapshot_idx
  on lighthouse.gap_reports (source_snapshot_id, created_at);

create index gap_reports_pending_idx
  on lighthouse.gap_reports (status, updated_at desc)
  where status <> 'ready';

drop trigger if exists set_gap_reports_updated_at on lighthouse.gap_reports;
create trigger set_gap_reports_updated_at
before update on lighthouse.gap_reports
for each row execute function public.update_updated_at();

create table lighthouse.gap_report_reactions (
  gap_report_id uuid not null references lighthouse.gap_reports(id) on delete cascade,
  viewer_principal_id text not null,
  artifact_version integer not null check (artifact_version >= 0),
  reaction jsonb,
  reaction_history jsonb not null default '[]'::jsonb
    check (jsonb_typeof(reaction_history) = 'array'),
  reaction_version integer not null default 0 check (reaction_version >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (gap_report_id, viewer_principal_id)
);

drop trigger if exists set_gap_report_reactions_updated_at on lighthouse.gap_report_reactions;
create trigger set_gap_report_reactions_updated_at
before update on lighthouse.gap_report_reactions
for each row execute function public.update_updated_at();

alter table lighthouse.gap_reports enable row level security;
alter table lighthouse.gap_report_reactions enable row level security;

grant select, insert, update, delete on lighthouse.gap_reports to service_role;
grant select, insert, update, delete on lighthouse.gap_report_reactions to service_role;

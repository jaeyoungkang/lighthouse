-- Gap report source snapshot schema repair.
--
-- Issue #221 renames gap report provenance from source search document ids to
-- source snapshot ids. Local/preview databases may already have run the older
-- 00014/00016 migrations with source_search_doc_id, and old gap report artifacts
-- are disposable for this migration. Clear the table, then force the durable
-- schema and indexes to the current route-snapshot contract.

delete from lighthouse.gap_reports;

drop index if exists lighthouse.gap_reports_owner_source_scope_unique;
drop index if exists lighthouse.gap_reports_owner_source_idx;

alter table lighthouse.gap_reports
  drop constraint if exists gap_reports_metadata_source_check;

alter table lighthouse.gap_reports
  add column if not exists source_snapshot_id text;

alter table lighthouse.gap_reports
  alter column source_snapshot_id set not null;

alter table lighthouse.gap_reports
  drop column if exists source_search_doc_id;

alter table lighthouse.gap_reports
  add column if not exists source_paper_ids_key text not null default '';

alter table lighthouse.gap_reports
  add constraint gap_reports_metadata_source_check check (
    metadata ->> 'sourceSnapshotId' = source_snapshot_id
  );

create index gap_reports_owner_source_idx
  on lighthouse.gap_reports (owner_principal_id, source_snapshot_id, created_at);

create unique index gap_reports_owner_source_scope_unique
  on lighthouse.gap_reports (owner_principal_id, source_snapshot_id, source_paper_ids_key);

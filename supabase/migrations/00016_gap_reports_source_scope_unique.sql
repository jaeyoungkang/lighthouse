-- Gap report source-scope uniqueness.
--
-- `POST /api/gap-reports` reserves a pending row before expensive core work so
-- `/gap/:id` can own the only progress surface. The application dedupes with a
-- read-then-insert check, but separate server processes can still race through
-- that check. Store the ordered source paper scope as a database key and make
-- owner + source snapshot + scope unique so the losing reserver can re-read the
-- winning report instead of creating a second artifact.
--
-- Existing gap report artifacts are disposable during this migration. Clear
-- them instead of backfilling/preserving older scopes so the new invariant starts
-- from a clean table.

alter table lighthouse.gap_reports
  add column if not exists source_paper_ids_key text not null default '';

delete from lighthouse.gap_reports;

create unique index if not exists gap_reports_owner_source_scope_unique
  on lighthouse.gap_reports (owner_principal_id, source_snapshot_id, source_paper_ids_key);

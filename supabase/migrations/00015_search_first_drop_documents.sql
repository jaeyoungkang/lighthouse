-- Search-first reset S4.
--
-- Preconditions:
-- - 00014_search_first_gap_reports.sql has copied the only remaining persisted
--   gap_network artifacts into lighthouse.gap_reports.
-- - Search, citation lineage, similar-paper, and gap creation now operate from
--   route/view snapshots and no longer use lighthouse.documents as a product
--   model.
--
-- Stance:
-- - Legacy reserve/search/citation/graph rows in lighthouse.documents have no
--   product meaning after ephemeral execution, so the table is removed.
-- - interaction_events.document_id and error_logs.document_id are retained as
--   read-only historical columns for old rows, but their documents foreign keys
--   are dropped before the table removal.

alter table if exists lighthouse.interaction_events
  drop constraint if exists interaction_events_document_id_fkey;

alter table if exists public.error_logs
  drop constraint if exists error_logs_document_id_fkey;

-- Safety assertion: 00014 must have migrated every gap_network artifact.
-- Non-gap legacy rows (reserve/search/citation/graph era) are an intentional
-- remove-stance deletion, but a remaining gap_network row means 00014's copy
-- conditions missed a product artifact — abort instead of losing it.
do $$
declare
  remaining_gap_rows integer;
begin
  if to_regclass('lighthouse.documents') is not null then
    select count(*) into remaining_gap_rows
    from lighthouse.documents
    where type = 'gap_network';

    if remaining_gap_rows > 0 then
      raise exception
        'lighthouse.documents still holds % gap_network row(s); run/fix the 00014 gap_reports migration before dropping the table',
        remaining_gap_rows;
    end if;
  end if;
end $$;

drop table if exists lighthouse.documents;

-- document_collections never appears in this repo's checked-in migration
-- history, but older environments may still have it from the pre-owner-principal
-- model. Drop it only if it exists and has no remaining dependencies.
drop table if exists lighthouse.document_collections;

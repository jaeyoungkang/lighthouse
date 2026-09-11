-- Stage 5 (render re-architecture): documents become URL-addressable resources
-- reserved at submit time. Add a persisted lifecycle status so a document can
-- exist as a real `pending` resource before its results land, a document
-- version for enrichment revalidation, and a monotonic reaction version for
-- fetch-merge reconciliation. The `pdf` type removal rides a later slice.

alter table lighthouse.documents
  add column if not exists status text not null default 'ready'
    check (status in ('pending', 'ready', 'failed'));

alter table lighthouse.documents
  add column if not exists version integer not null default 0;

alter table lighthouse.documents
  add column if not exists reaction_version integer not null default 0;

-- Cheap lookup of in-flight (reserved or failed) documents per owner.
create index if not exists idx_documents_status
  on lighthouse.documents (user_id, status)
  where status <> 'ready';

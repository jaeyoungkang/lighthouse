-- #645: owner-scoped library reads use one deterministic latest-first order.
-- The composite index replaces the owner-only index because the leading column
-- still supports owner filtering while reviewed_at/id match the repository order.

drop index if exists lighthouse.idx_reviewed_papers_owner;

create index idx_reviewed_papers_owner_reviewed_at_id
  on lighthouse.reviewed_papers (owner_principal_id, reviewed_at desc, id desc);

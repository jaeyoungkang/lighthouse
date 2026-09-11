-- Seed-identity dedup for search follow-up documents.
--
-- The reserve path dedups follow-up documents with a check-then-insert
-- (findOwnedSearchFollowupDocument → createDocumentUnchecked), which leaves a
-- concurrent-duplicate window: two clicks racing past the check both insert.
-- With the `/search?q=` entry route owning reserves (aspect:immediate-navigation)
-- the race also covers double navigations, so the identity moves into the
-- database: a generated key over the seed-identity fields plus the personalize
-- basis, and a unique index per owner. The key mirrors matchesSearchFollowupSeed
-- + searchMetadataMatchesFollowupBasis exactly (identity keys only — termSeed
-- supportCount and differentPositionSeed sourcePosition are display context;
-- personalize defaults to false like the JS `?? false`). Rows without a seed
-- keep a NULL key, and NULLs never collide, so plain searches are unaffected.
-- seedPaper takes precedence over termSeed over differentPositionSeed, matching
-- the JS matcher's precedence.

alter table lighthouse.documents
  add column if not exists search_followup_seed_key text generated always as (
    case
      when type = 'search' and metadata ? 'seedPaper' then
        'paper:' || md5(
          (metadata -> 'seedPaper' ->> 'paperId')
          || '|' || coalesce(metadata -> 'abstractHydration' ->> 'personalize', 'false')
        )
      when type = 'search' and metadata ? 'termSeed' then
        'term:' || md5(
          (metadata -> 'termSeed' ->> 'sourceQuery')
          || '|' || (metadata -> 'termSeed' ->> 'term')
          || '|' || (metadata -> 'termSeed' ->> 'candidateType')
          || '|' || coalesce(metadata -> 'abstractHydration' ->> 'personalize', 'false')
        )
      when type = 'search' and metadata ? 'differentPositionSeed' then
        'position:' || md5(
          (metadata -> 'differentPositionSeed' ->> 'sourcePaperId')
          || '|' || (metadata -> 'differentPositionSeed' ->> 'query')
          || '|' || coalesce(metadata -> 'abstractHydration' ->> 'personalize', 'false')
        )
      else null
    end
  ) stored;

-- Existing duplicate follow-up search documents can predate the unique index.
-- Preserve the earliest row, matching repository candidate ordering, and remove
-- later duplicates so production migration apply cannot fail on backfill data.
with ranked_followup_documents as (
  select
    id,
    row_number() over (
      partition by owner_principal_id, search_followup_seed_key
      order by created_at asc, id asc
    ) as duplicate_rank
  from lighthouse.documents
  where owner_principal_id is not null
    and search_followup_seed_key is not null
)
delete from lighthouse.documents as documents
using ranked_followup_documents as ranked
where documents.id = ranked.id
  and ranked.duplicate_rank > 1;

create unique index if not exists documents_search_followup_seed_key_unique
  on lighthouse.documents (owner_principal_id, search_followup_seed_key);

alter table lighthouse.documents
  add column if not exists reaction_history jsonb not null default '[]'::jsonb;

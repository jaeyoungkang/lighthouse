-- Remove retired document vector retrieval storage and RPC.

do $$
declare
  match_documents_signature record;
begin
  for match_documents_signature in
    select pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'lighthouse'
      and p.proname = 'match_documents'
  loop
    execute format(
      'drop function if exists lighthouse.match_documents(%s)',
      match_documents_signature.args
    );
  end loop;
end $$;

alter table lighthouse.documents
  drop column if exists embedding;

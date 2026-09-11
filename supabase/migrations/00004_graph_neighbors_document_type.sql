-- Allow persisted graph-neighbor documents.
alter table lighthouse.documents
  drop constraint if exists documents_type_check;

alter table lighthouse.documents
  add constraint documents_type_check
  check (type in ('search', 'pdf', 'gap_network', 'citation_lineage', 'graph_neighbors'));

-- Remove retired internal PDF document records and disallow future pdf documents.

delete from lighthouse.documents
where type = 'pdf';

alter table lighthouse.documents
  drop constraint if exists documents_type_check;

alter table lighthouse.documents
  add constraint documents_type_check
  check (type in ('search', 'gap_network', 'citation_lineage', 'graph_neighbors'));

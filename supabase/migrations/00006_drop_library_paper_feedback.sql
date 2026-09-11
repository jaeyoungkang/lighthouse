-- Remove retired per-paper library mismatch feedback storage.

drop table if exists lighthouse.library_paper_feedback;

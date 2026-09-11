-- Reader feedback that a paper does not match the library-reflected research basis.

create table lighthouse.library_paper_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  paper_id text not null,
  kind text not null check (kind in ('library_mismatch')),
  created_at timestamptz not null default now(),
  unique(user_id, paper_id, kind)
);

create index idx_library_paper_feedback_user
  on lighthouse.library_paper_feedback(user_id);
create index idx_library_paper_feedback_paper
  on lighthouse.library_paper_feedback(paper_id);

grant select, insert, update, delete on table lighthouse.library_paper_feedback to authenticated;
grant select, insert, update, delete on table lighthouse.library_paper_feedback to service_role;

alter table lighthouse.library_paper_feedback enable row level security;

create policy "library_paper_feedback_select_own" on lighthouse.library_paper_feedback
  for select using (auth.uid() = user_id);

create policy "library_paper_feedback_insert_own" on lighthouse.library_paper_feedback
  for insert with check (auth.uid() = user_id);

create policy "library_paper_feedback_update_own" on lighthouse.library_paper_feedback
  for update using (auth.uid() = user_id);

create policy "library_paper_feedback_delete_own" on lighthouse.library_paper_feedback
  for delete using (auth.uid() = user_id);

-- Light House baseline schema
-- Hard-cut rewrite for the workspace-centric prototype.

create schema if not exists lighthouse;

grant usage on schema lighthouse to anon, authenticated, service_role;

create table public.app_users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  onboarding_completed boolean not null default false,
  onboarding_responses jsonb,
  agent_name text,
  created_at timestamptz not null default now()
);

create index idx_app_users_email on public.app_users(email);

create table lighthouse.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  type text not null check (type in ('search', 'pdf', 'gap_network', 'citation_lineage')),
  title text not null,
  content text not null default '',
  created_by text not null default 'agent' check (created_by in ('user', 'agent')),
  metadata jsonb not null default '{}'::jsonb,
  reaction jsonb,
  refs text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_documents_user on lighthouse.documents(user_id);
create index idx_documents_user_type on lighthouse.documents(user_id, type);
create unique index documents_id_user_idx on lighthouse.documents(id, user_id);

create table lighthouse.interaction_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  document_id uuid references lighthouse.documents(id) on delete set null,
  event_type text not null,
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_interaction_events_user on lighthouse.interaction_events(user_id);
create index idx_interaction_events_document
  on lighthouse.interaction_events(document_id)
  where document_id is not null;
create index idx_interaction_events_type on lighthouse.interaction_events(event_type);
create index idx_interaction_events_created on lighthouse.interaction_events(created_at);

create table lighthouse.reviewed_papers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  paper_id text not null,
  title text not null default '',
  url text,
  authors jsonb not null default '[]'::jsonb,
  year integer,
  citation_count integer,
  reviewed_at timestamptz not null default now(),
  unique(user_id, paper_id)
);

create index idx_reviewed_papers_user on lighthouse.reviewed_papers(user_id);
create index idx_reviewed_papers_paper on lighthouse.reviewed_papers(paper_id);

create table lighthouse.paper_inline_analysis_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  paper_id text not null,
  version integer not null,
  analysis jsonb not null default '{}'::jsonb,
  source text check (source in ('pdf', 'abstract')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, paper_id)
);

create index idx_paper_inline_analysis_cache_user_paper
  on lighthouse.paper_inline_analysis_cache(user_id, paper_id);
create index idx_paper_inline_analysis_cache_user_version
  on lighthouse.paper_inline_analysis_cache(user_id, version);

create table public.error_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.app_users(id) on delete set null,
  document_id uuid references lighthouse.documents(id) on delete set null,
  source text not null check (source in ('server', 'client', 'llm', 'tool')),
  category text not null check (
    category in ('api_error', 'llm_fallback', 'tool_failure', 'client_error', 'memory_error')
  ),
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_error_logs_created_at on public.error_logs(created_at);
create index idx_error_logs_category on public.error_logs(category);
create index idx_error_logs_document_id on public.error_logs(document_id);

create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_documents_updated_at
  before update on lighthouse.documents
  for each row execute function public.update_updated_at();

create trigger set_paper_inline_analysis_cache_updated_at
  before update on lighthouse.paper_inline_analysis_cache
  for each row execute function public.update_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.app_users (id, email)
  values (new.id, new.email)
  on conflict (email) do update set id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

grant select, insert, update on table public.app_users to authenticated;
grant select, insert, update on table public.app_users to service_role;

grant select, insert, update, delete on table lighthouse.documents to authenticated;
grant select, insert, update, delete on table lighthouse.documents to service_role;

grant select, insert, update, delete on table lighthouse.interaction_events to authenticated;
grant select, insert, update, delete on table lighthouse.interaction_events to service_role;

grant select, insert, update, delete on table lighthouse.reviewed_papers to authenticated;
grant select, insert, update, delete on table lighthouse.reviewed_papers to service_role;

grant select, insert, update, delete on table lighthouse.paper_inline_analysis_cache to authenticated;
grant select, insert, update, delete on table lighthouse.paper_inline_analysis_cache to service_role;

grant select, insert on table public.error_logs to authenticated;
grant select, insert on table public.error_logs to service_role;

alter table public.app_users enable row level security;
alter table lighthouse.documents enable row level security;
alter table lighthouse.interaction_events enable row level security;
alter table lighthouse.reviewed_papers enable row level security;
alter table lighthouse.paper_inline_analysis_cache enable row level security;
alter table public.error_logs enable row level security;

create policy "app_users_select_own" on public.app_users
  for select using (auth.uid() = id);

create policy "app_users_insert_own" on public.app_users
  for insert with check (auth.uid() = id);

create policy "app_users_update_own" on public.app_users
  for update using (auth.uid() = id);

create policy "documents_select_own" on lighthouse.documents
  for select using (auth.uid() = user_id);

create policy "documents_insert_own" on lighthouse.documents
  for insert with check (auth.uid() = user_id);

create policy "documents_update_own" on lighthouse.documents
  for update using (auth.uid() = user_id);

create policy "documents_delete_own" on lighthouse.documents
  for delete using (auth.uid() = user_id);

create policy "interaction_events_select_own" on lighthouse.interaction_events
  for select using (auth.uid() = user_id);

create policy "interaction_events_insert_own" on lighthouse.interaction_events
  for insert with check (auth.uid() = user_id);

create policy "interaction_events_delete_own" on lighthouse.interaction_events
  for delete using (auth.uid() = user_id);

create policy "reviewed_papers_select_own" on lighthouse.reviewed_papers
  for select using (auth.uid() = user_id);

create policy "reviewed_papers_insert_own" on lighthouse.reviewed_papers
  for insert with check (auth.uid() = user_id);

create policy "reviewed_papers_update_own" on lighthouse.reviewed_papers
  for update using (auth.uid() = user_id);

create policy "reviewed_papers_delete_own" on lighthouse.reviewed_papers
  for delete using (auth.uid() = user_id);

create policy "paper_inline_analysis_cache_select_own" on lighthouse.paper_inline_analysis_cache
  for select using (auth.uid() = user_id);

create policy "paper_inline_analysis_cache_insert_own" on lighthouse.paper_inline_analysis_cache
  for insert with check (auth.uid() = user_id);

create policy "paper_inline_analysis_cache_update_own" on lighthouse.paper_inline_analysis_cache
  for update using (auth.uid() = user_id);

create policy "paper_inline_analysis_cache_delete_own" on lighthouse.paper_inline_analysis_cache
  for delete using (auth.uid() = user_id);

create policy "error_logs_select_own" on public.error_logs
  for select using (auth.uid() = user_id);

create policy "error_logs_insert_own" on public.error_logs
  for insert with check (auth.uid() = user_id or user_id is null);

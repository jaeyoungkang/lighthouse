-- Append-only LLM usage events.
--
-- This table is the durable source for cumulative and recent-window provider
-- usage reports. It stores billing metadata only; prompts and generated output
-- stay out of the persistence boundary.

create table if not exists lighthouse.llm_usage_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  owner_principal_id text,
  action text not null check (char_length(action) between 1 and 120),
  status text not null check (status in ('success', 'empty', 'aborted')),
  model text not null check (char_length(model) between 1 and 120),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  total_tokens integer not null default 0 check (total_tokens >= 0),
  reasoning_tokens integer not null default 0 check (reasoning_tokens >= 0),
  cached_input_tokens integer not null default 0 check (cached_input_tokens >= 0),
  cost_usd_micros bigint check (cost_usd_micros is null or cost_usd_micros >= 0),
  priced boolean not null default false,
  usage_measured boolean not null default false,
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists llm_usage_events_occurred_at_idx
  on lighthouse.llm_usage_events (occurred_at desc);

create index if not exists llm_usage_events_owner_occurred_at_idx
  on lighthouse.llm_usage_events (owner_principal_id, occurred_at desc)
  where owner_principal_id is not null;

create index if not exists llm_usage_events_action_model_occurred_at_idx
  on lighthouse.llm_usage_events (action, model, occurred_at desc);

grant select, insert on table lighthouse.llm_usage_events to service_role;

alter table lighthouse.llm_usage_events enable row level security;

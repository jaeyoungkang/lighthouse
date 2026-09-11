# Light House — Infrastructure State Map

This file is the canonical current-state inventory for persistent and client
state. Implementation navigation and code entrypoints belong in
`docs/implementation.md`; product promises belong in Story Chain; runtime
procedures belong in `docs/runtime-flows/`.

The Search-first reset close-out matrix is preserved at
`docs/archive/search-first-reset-closeout.md` as historical migration evidence.
The archived matrix is not a current state map. Use this file for current state
ownership and `docs/implementation.md` for code entrypoints.

## Persistent State

| Table | Role |
| --- | --- |
| `public.app_users` | Auth profile and onboarding fields |
| `lighthouse.access_allowlist_entries` | Current normalized external email membership; row presence grants product access and row absence denies it. Stable `cursor_id` is an opaque admin-list navigation identity, while `email` remains the membership and global-order owner. |
| `lighthouse.gap_reports` | Shared research-gap artifacts keyed by a versioned source-input digest |
| `lighthouse.gap_report_reactions` | Viewer-scoped gap reaction preferences keyed by report and principal |
| `lighthouse.interaction_events` | Historical route/view behavior events only; current app code has no public write path |
| `lighthouse.llm_usage_events` | Append-only LLM provider usage events for cumulative and recent-window admin cost reports; stores token/cost metadata only |
| `lighthouse.reviewed_papers` | Reviewed-paper tracking |
| `lighthouse.paper_inline_analysis_cache` | Shared successful inline analysis keyed by paper id, analysis version, and the canonical normalized title/abstract/year fingerprint; pending rows are expiring single-generator leases, and runtime access is limited to security-definer cache RPCs rather than direct service-role table DML |
| local JSONL analytics store | Canonical event local audit sink (`app/server/repository/analytics-events.ts` — serverless temp-path JSONL, not a Supabase table); Amplitude is the durable sink |
| `public.error_logs` | Runtime error logs; legacy `document_id` is historical read-only data |

## Client State

| Store | Role |
| --- | --- |
| `research-route-store` | Route-owned `currentView`, AI comment lifecycle, and search visible-window state |
| `background-task-store` | Inline-analysis and term-discovery background task lifecycle |
| `reaction-action-store` | Registered user/system message dispatchers |
| `library-availability-store` | Server-seeded library context availability |
| `library-papers-store` | Internal library paper list and revision |
| `debug-store` | localStorage-backed debug flag |

## Research Route Types

```ts
type ResearchRouteKind =
  | "search"
  | "gap_network"
  | "citation_lineage"
  | "graph_neighbors";
```

`ResearchRoutePayload` is the UI/domain payload shape for route executions and
gap report artifacts. URL and payload contracts use route/snapshot terminology;
`Document` / `DocumentType` domain aliases are no longer exported as product
concepts. The physical persistence model is no longer one table per visible view type. Research-gap reports are stored in
`lighthouse.gap_reports` and adapted back to `ResearchRoutePayload` at the
domain-access boundary.

## Change Rule

New persistent fields must close the full path:

```text
domain schema -> DB/repository mapping -> server/client creation -> UI consumption -> test/evidence
```

TypeScript success alone does not prove the data flows.

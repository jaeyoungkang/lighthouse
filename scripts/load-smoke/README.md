# load-smoke

Operational load-smoke harness that reproduces **incident #183**: _N concurrent
first-session users, each doing one search_. It is **measurement-only** tooling —
it does not change any product behavior, so it has no Story Chain / Promise
coupling. It only drives the existing HTTP surface and reports latency/error
shape so we can see _where_ the stack collapses under concurrency.

## What it does

The runner has four explicit workload modes:

- `one-shot` starts one journey for each concurrent synthetic user.
- `ramp` runs a sequence of one-shot cohorts and finds the first complete SLO
  break.
- `sustained-closed` keeps a fixed number of synthetic users active. Each user
  starts its next journey only after its previous journey completes.
- `sustained-open` schedules journeys at a fixed rate independently of
  completion. It admits only up to `--max-in-flight`; excess arrivals are
  counted as client-side shed instead of entering an unbounded backlog.

Each admitted journey carries a self-signed session cookie and replays the real
first-session sequence:

1. `GET /search` — authenticated RSC render (owner-principal auth + library reads).
2. `GET /search?q=<query>&entry=route-bar` — query-canonical execution
   (aspect:immediate-navigation); the same URL renders the search result.
3. `GET /search?q=<term>&entry=term&termSourceQuery=...` — seeded follow-up
   execution (연구 용어 클릭 hot path) at the same canonical query surface.

Every request is wrapped in an `AbortController` timeout (`--timeout-ms`, default 30000) so a hung call is recorded as `timeout`, never a silent hang.

## Prerequisites

- **Local Supabase running**: `supabase start`
- **Dev server running**: `npm run dev` (serves `http://localhost:3000`)
- **Env**: `MOONLIGHT_SCHOLAR_AUTH_JWT_SECRET` must be set and must match the
  running server's value (the npm script loads `.env.local` via
  `tsx --env-file=.env.local`). If it is unset the runner fails fast — and the
  server would reject every request with `503` anyway.
  Optional: `MOONLIGHT_SCHOLAR_AUTH_TOKEN_ISSUER` (default `moonlight`),
  `MOONLIGHT_SCHOLAR_AUTH_TOKEN_AUDIENCE` (default `moonlight-scholar`).

> The harness only **builds** the load. Running it against a server is a separate
> step. It deliberately does not start Supabase or the dev server.

### Deterministic local provider fixture

Use the checked-in loopback fixture when the goal is to exercise the real local
Next.js SSR and Supabase path without sending load to Episteme. Start the
fixture first, then point the dev server at it:

```bash
# terminal 1 — choose healthy, delay, 429, or 500; this example requests 3 papers
npm run load-smoke:provider-fixture -- --profile healthy --paper-count 3

# terminal 2 — the override is read when the Next.js process starts
EPISTEME3_LITERATURE_API_URL=http://127.0.0.1:43123 npm run dev

# terminal 3 — declare the fixture behavior in the report identity
npm run load-smoke -- --mode sustained-open --arrival-rate 5 \
  --max-in-flight 10 --duration 30 \
  --input-profile deterministic-3-paper-v1 \
  --provider-profile local-fixture-healthy-v1 \
  --provider-stats-url http://127.0.0.1:43123/__stats \
  --topology-profile local-single-next-process \
  --run-owner architecture-fitness-local
```

The fixture always binds to `127.0.0.1` and serves the native Episteme 3
`POST /api/v3/search/papers` contract. `healthy` returns the configured number
of deterministic Episteme-compatible papers. The omitted `--paper-count`
default is owned by `DEFAULT_PROVIDER_PAPER_COUNT`; its accepted maximum is
derived from `SEARCH_DOCUMENT_FETCH_LIMIT` through
`MAX_PROVIDER_PAPER_COUNT`. Check `--help` for their current numeric values.
`delay` returns the same window after `--delay-ms` (default 350ms), and `429` /
`500` return the named provider status. Use an explicit 3 papers for the
representative profile. For a maximum-cardinality run, read the current bound
from `--help` and pass it explicitly. Restart the fixture with the selected
profile between scenarios so breaker state and provider behavior are
attributable to one run.

`GET http://127.0.0.1:43123/__stats` reports configured paper count, provider
request count, response classes, and maximum in-flight fixture work. Pass that
exact loopback URL with `--provider-stats-url` to bind the stats to report v5.
The fixture caps each POST body at `MAX_PROVIDER_FIXTURE_REQUEST_BODY_BYTES`;
oversized bodies return 413. Malformed or oversized healthy-profile requests
increment `serverError`, never `success`, so evidence cannot count a rejected
request as a successful provider response.
The runner requires a fresh zero baseline, reads final stats only after all
admitted work drains, and records requests per completed journey. A reused
fixture or incomplete response count aborts attribution. Restart the fixture
before every bound run.

This fixture proves only local, single-process behavior. It does not prove real
provider allowance, provider-side queues, multi-instance breaker behavior, or
production capacity.

### Auth model

Each user presents an HS256 JWT as the cookie
`lighthouse_moonlight_scholar_session`, signed with
`MOONLIGHT_SCHOLAR_AUTH_JWT_SECRET` (claims: `sub`, `email`, `plan: "pro"`,
`isAdmin: false`; issuer `moonlight`; audience `moonlight-scholar`; 15-min
expiry). Identities are distinct per user: `sub = loadtest-user-<i>`,
`email = loadtest-<i>@corca.ai`. The `@corca.ai` domain passes the email
allowlist (`isInternalEmail`), and a local Supabase URL bypasses the allowlist
entirely — either way the synthetic users authenticate. The server re-verifies
the cookie on every call, so there is no `POST /session` step.

## Running

```bash
# single cohort of 10 concurrent users (default)
npm run load-smoke

# pick the concurrency
npm run load-smoke -- --users 20

# ramp: run cohorts sequentially and print a "where does it break" table
npm run load-smoke -- --ramp 5,10,20,40

# sustained closed model: 20 active users for a five-minute admission window
npm run load-smoke -- --mode sustained-closed --users 20 --duration 300 \
  --input-profile typical-first-session-v1 \
  --provider-profile live-provider-approved-window \
  --topology-profile local-single-process \
  --run-owner operational-readiness

# sustained open model: two arrivals/s, with at most 20 admitted in flight
npm run load-smoke -- --mode sustained-open --arrival-rate 2 \
  --max-in-flight 20 --duration 300 \
  --input-profile typical-first-session-v1 \
  --provider-profile live-provider-approved-window \
  --topology-profile local-single-process \
  --run-owner operational-readiness

# tune target / query / timeout / report name
npm run load-smoke -- --base-url http://localhost:3000 --query "graph neural network" --timeout-ms 20000 --run-label incident-183-rerun
```

Pass args after `--` so npm forwards them to the script.

### Flags

| Flag                         | Default                 | Meaning                                                                   |
| ---------------------------- | ----------------------- | ------------------------------------------------------------------------- |
| `--mode <mode>`              | `one-shot`              | `one-shot`, `sustained-closed`, or `sustained-open`.                      |
| `--users <N>`                | `10`                    | One-shot users or sustained-closed concurrency.                           |
| `--ramp 5,10,20,40`          | —                       | Run one-shot cohort sizes sequentially.                                   |
| `--duration <seconds>`       | —                       | Sustained admission window. Required for sustained modes.                 |
| `--arrival-rate <n>`         | —                       | Sustained-open arrivals per second.                                       |
| `--max-in-flight <N>`        | —                       | Sustained-open client admission ceiling.                                  |
| `--input-profile <id>`       | —                       | Declared query/cardinality/personalization profile. Required sustained.   |
| `--provider-profile <id>`    | —                       | Declared live or controlled provider behavior. Required sustained.        |
| `--provider-stats-url <url>` | —                       | Exact loopback fixture `/__stats`; requires an explicit provider profile. |
| `--topology-profile <id>`    | —                       | Declared target topology. Required sustained.                             |
| `--run-owner <id>`           | —                       | Owner of provider allowance and stop decision. Required sustained.        |
| `--base-url <url>`           | `http://localhost:3000` | Target server.                                                            |
| `--query <text>`             | `transformer attention` | Search query each user submits.                                           |
| `--timeout-ms <n>`           | `30000`                 | Per-request abort timeout.                                                |
| `--run-label <label>`        | timestamp               | JSON report filename stem.                                                |
| `--allow-remote`             | off                     | Required (with the flag below) to target a non-loopback host.             |
| `--i-understand-not-prod`    | off                     | Required (with `--allow-remote`) to target a non-loopback host.           |
| `-h`, `--help`               | —                       | Usage.                                                                    |

Sustained profile values are evidence labels, not runtime controls. For
example, naming a profile `controlled-429` does not inject 429 responses. The
operator must link the label to the actual provider fixture or approved live
window used for that run. The runner requires the fields so an unlabeled run
cannot be mistaken for a complete workload envelope.

When `--provider-stats-url` is present, the actual fixture profile, delay,
paper count, request/response counts and maximum in-flight work are bound as
machine-readable evidence. The declared profile remains a scenario label; the
fixture stats are the observed provider behavior.

## Production-safety guard

The runner refuses to touch anything but your local machine unless you very
explicitly opt out:

- **Default**: only loopback hosts are allowed — `localhost`, `127.0.0.1`, `::1`.
- **Non-loopback host**: requires **BOTH** `--allow-remote` **and**
  `--i-understand-not-prod`. Missing either is a hard error.
- **Always refused** (even with both flags): any host containing `vercel.app`,
  `themoonlight.io`, `borca.ai`, or `supabase.co` — these look like production or
  managed infrastructure.

So `npm run load-smoke` with no override can only hit your local dev server, and
no flag combination can point it at production.

## Reading the output

The runner prints, per cohort:

- **Per-endpoint** table: count, outcome breakdown (`2xx` / `4xx` / `5xx` /
  `t/o` = timeout / `err` = network-error), and latency `p50` / `p95` / `p99` /
  `max`. Latency percentiles include every attempt; a timeout contributes
  roughly `--timeout-ms`.
- **`/search?q=` Server-Timing phases**: aggregated `p50` / `p95` / `max` for
  server-side phases the route emits, when present. This is how you see whether
  the collapse is provider-bound or auth-bound.
- **Search readiness outcome**: `ready-with-papers` only when the successful
  SSR response contains at least one unique rendered `data-paper-id` card;
  otherwise the result is `ready-empty` or `error`. The report records the
  ordered unique rendered paper IDs for each user. `null` means the query
  response was unreadable, `[]` means a successful empty result, and a
  non-empty list means `ready-with-papers` under the existing transport
  verdict. The identity list makes exact-result observation possible; by
  itself it does not prove an expected-item match or topic relevance.
- **First request failure**: the endpoint that first produced a `5xx`,
  `timeout`, or `network-error` within that cohort, ordered by wall-clock
  offset from cohort start.

In `--ramp` mode a final summary table shows each cohort's wall-clock,
`5xx+timeout+network-error` count, go/no-go verdict, and first request failure.
It then reports the **first workload break**: the first ramp step whose complete
go/no-go verdict fails, including ready-with-papers and search p95 failures that
do not produce an HTTP error.

Sustained modes additionally report the configured arrival model and admission
window, scheduled/admitted/completed journeys, client-side shed arrivals,
maximum admitted in-flight work, drain-inclusive wall-clock, and achieved
journey throughput. Their go/no-go combines the existing search outcome and
latency verdict with complete admitted-journey drain and zero client shed.
Client-side in-flight and shed metrics do not reveal server queue depth or
real-provider retries. A bound loopback fixture does reveal its own request
amplification, response classes and maximum in-flight work.

A machine-readable copy of every cohort is written to
`reports/load-smoke/<run-label>.json` (the directory is created if needed and is
git-ignored, matching `reports/mutation/`). After a successful write, the runner
keeps the current report and the nine most recently modified reports, then
removes older JSON reports. Non-JSON files, directories, and symlinks are not
part of retention. Ramp reports also include the top-level
`firstWorkloadBreak` object.

The current report format declares `schemaVersion: "5"`. It records the exact
Git revision, working-tree dirty state, run owner, input/provider/topology
profiles, and the explicit workload mode. Sustained reports declare zero
warm-up and a `drain-admitted` cool-down policy, then include a
`sustainedWorkload` object. The measurement window starts with the first
arrival; the runner waits for admitted work to drain after the admission
duration. A dirty report is useful for development but cannot serve as
exact-revision baseline evidence. If HEAD or the clean/dirty state changes
while the workload is running, report generation aborts instead of attributing
mixed-source measurements to the final revision.

When a fixture stats URL is supplied, v4 added `providerFixtureEvidence` with
the zero baseline, final counters, configuration, completed-journey count and
derived requests per completed journey. Without that flag the field is absent;
the runner never invents provider evidence for a live path.

Historical reports without `schemaVersion` are v1: they used aggregate
`searchOutcomes` and `firstBreak`. V2 replaced those fields with per-user `searchReadiness`
(`userIndex`, `paperCount`), cohort `firstRequestFailure`, and the ramp-level
`firstWorkloadBreak`. V3 added workload identity and sustained arrival evidence.
V4 adds optional, attributable loopback provider evidence without restoring
compatibility aliases. V5 replaces the count-only readiness field with ordered
`paperIds`, while preserving the existing non-empty transport verdict. It does
not add a historical alias or dual reader. No repository consumer reads the
historical aliases. The Q3 Architecture Fitness adapter keeps an explicit v4
reader for its immutable locked reports and a separate v5 identity reader for
new evidence; it rejects a v5 artifact that carries the retired count field.

## Note on local vs. production thresholds

This reproduces the _shape_ of the incident locally. Absolute thresholds differ
from production (local Supabase has no connection pooler, a different DB pool,
no CDN/edge). Use it to find _which endpoint_ collapses first and the relative
break point, not to predict production-absolute numbers. A sustained local PASS
does not close provider allowance, multi-instance fleet capacity, production
p99/5xx, server queue depth, retry amplification, or cancellation evidence.

---
name: analytics-event-steward
description: Use when implementing, debugging, reviewing, or validating Light House analytics/event collection, including Amplitude, workspace behavior events, canonical events, docs/analytics/events.yaml, track(...), trackCanonicalEvent(...), /api/analytics-events, event-router, local analytics store, external vendor sink fan-out, session replay identity, or real collected event data. Use after Mission Control scopes the Story Chain/event-contract impact.
compatibility: Claude Code, Codex, Cursor-style agents in the Light House repository.
---

# Analytics Event Steward

Use this skill for the implementation layer of Light House analytics events. It
does not replace Mission Control or Story Chain stewardship. It keeps the event
contract, emit path, router/store/sink behavior, and real vendor data aligned.

## Rollout Dependency

The lower-snake naming and primary/related Promise-ref rules below depend on the
issue #577 feature change that updates `docs/analytics/README.md`,
`docs/analytics/events.yaml`, and the runtime event contract. Land this process
change only after, or stacked on, that feature change. If the feature change is
not present, the checked-out analytics README and runtime contract remain the
authority and this skill version must not be activated.

## Route First

- If the work mentions `analytics`, `Amplitude`, `events.yaml`,
  `trackCanonicalEvent`, event collection, or workspace behavior events, enter
  Mission Control first.
- Use `story-chain-contract-steward` for Promise, Acceptance Check, Evidence
  Ledger, Sufficiency Review, and run evidence changes.
- Use `quality-gate-steward` only when changing gate wiring, package scripts,
  CI, or validation documentation.

## Read Order

1. `docs/analytics/README.md`
2. `docs/analytics/events.yaml`
3. `app/server/services/analytics/event-contract-validation.ts` for the exact
   legacy compatibility inventory and naming enforcement
4. `docs/contracts/story-chain/promises/story-chain-event-contract.md`
5. `docs/contracts/story-chain/evidence-ledgers/story-chain-event-contract.ledger.yaml`
6. Relevant emitters and bridge files:
   - `app/lib/track.ts`
   - `app/lib/analytics/client.ts`
   - `app/api/analytics-events/route.ts`
   - `app/server/services/analytics/event-router.ts`
   - `app/server/services/analytics/amplitude-sink.ts`
   - `app/server/domain-access/analytics-event-access.ts`
   - `app/server/repository/analytics-events.ts`

## Workflow

1. Freeze the measurement question and journey before naming events:
   - write the smallest journey as `event | event | final reached event` with
     the properties used to join each step;
   - classify each row as Experience Journey, Product Outcome, or System
     Delivery Trace; do not count queue/provider/sink delivery as user action;
   - state the decision that each property supports. A description that merely
     says a property is collected for measurement is not a purpose.
2. Classify the event problem:
   - missing contract entry;
   - emitter not firing;
   - client bridge identity missing;
   - route/schema rejection;
   - router validation failure;
   - local store failure;
   - external sink fan-out failure;
   - vendor data interpretation issue.
3. Choose or review the canonical event name using
   `docs/analytics/README.md` as the naming authority:
   - name the stable user/operator behavior, not the current implementation
     destination, provider, Promise name, or internal state;
   - keep an existing event name when the user's recognized action is still the
     same and the historical measurement remains comparable;
   - new or rebuilt product events use `<object>_<past_tense_action>` lowercase
     `snake_case`; `sinks.amplitude` uses the exact same identity;
   - analytics subject keys, property keys, and enum taxonomy tokens use
     lowercase `snake_case`. TypeScript/domain names may remain `camelCase`,
     but the emitter must translate at the analytics boundary;
   - move implementation boundaries such as provider, handoff destination,
     internal/external target, and Promise linkage into `storyRefs`,
     `measurement`, and properties such as `open_target` or `source_surface`;
   - create a new event name only when the user-facing action or lifecycle
     meaning changes enough that old and new counts should not be compared;
   - use `clicked` for user commands whose downstream completion is not
     confirmed, and reserve `viewed`/`committed` for visible or persisted
     outcomes at a declared boundary.
4. Decide compatibility before editing a legacy writer:
   - inventory each previous canonical id, runtime writer, Promise coverage,
     stored/read compatibility, and vendor history;
   - classify every id as `preserve`, `migrate-read-only`, or `remove` using
     the Concept Shift meanings in `docs/agent-skills.md`;
   - keep legacy dotted names only when they are already in the repository's
     exact compatibility inventory. Never grant a new event the exception by
     prefix alone;
   - prevent accidental dual counting. Follow the recorded compatibility
     verdict and CAIR/Propagation Map for any intentional transition window;
     record historical comparison breaks, saved chart implications, writer
     ownership, and the cutover point;
   - run `npm run mc:event-impact` and require zero uncovered current product
     Promise impacts. When one behavior supports several current Promises, use
     the event contract's declared primary/related Promise refs instead of
     emitting semantic duplicates.
5. Trace one canonical event end to end:
   - `events.yaml` name, required properties, `privacy.allowExternalSinks`,
     and `sinks.amplitude`;
   - Promise `requiredEvents`, primary `storyRefs.promiseRef`, and any declared
     related Promise refs;
   - `track(...)` or direct `trackCanonicalEvent(...)` call site;
   - client `deviceId` / `sessionId` enrichment;
   - `/api/analytics-events` schema acceptance;
   - router composition, store insert, privacy filter, and sink capture.
6. Verify journey identity, cardinality, and minimization:
   - every event needed for a funnel must carry the same declared journey and
     search context at the actual navigation/retry/new-tab boundary;
   - exercise reopen, rerender, retry, and repeated navigation cases against
     `emission.cardinality` and `identityKeys`;
   - require subject/property copies of an identity to agree at the router;
   - remove a property when an existing stable identity answers the decision.
     Published titles and other high-cardinality metadata require a concrete
     use that cannot be served by `paper_id` or another declared identity;
   - keep raw query, query hash, PDF URL/text, AI output, and token outside
     external payloads unless a separately approved privacy contract says
     otherwise. Do not add a user identifier to event subject/properties;
     actor identity follows the current Story Chain's server-normalized
     external identity contract.
7. When checking real data:
   - separate internal testers from beta/external users;
   - distinguish SDK/session replay events from product behavior events;
   - report the exact time window and excluded users;
   - compare vendor data with `.local/analytics-events.jsonl` only when that
     file exists for the same environment. Local JSONL is not the external
     vendor source of truth.
8. For fixes:
   - preserve validation failures for malformed or undeclared events;
   - keep local store failures from suppressing eligible external sink fan-out;
   - keep external sink failures fire-and-forget but observable through
     `sinkErrors`;
   - do not send raw query, PDF text, tokens, or AI output unless the contract
     explicitly allows it and external sink policy is decided.
9. Close through Story Chain:
   - update the relevant Evidence Ledger row when the executable evidence
     changes;
   - add or update a dated Sufficiency Review when a reviewed AC failure mode is
     closed;
   - run the targeted test named by the ledger.

## Boundaries

- Do not add ad hoc vendor-only event names from call sites. Runtime code emits
  canonical event names and payloads; the router maps vendor names from
  `events.yaml`.
- Do not treat Amplitude Session Replay as product behavior evidence by itself.
  Product behavior comes from declared canonical product events.
- Do not expose Amplitude secret keys through `NEXT_PUBLIC_*`. Client bundles
  may use the public API key; secrets belong in server-only env vars.
- Do not mark collection fixed from local tests alone when the user asked about
  real vendor data. Verify the vendor export/query path when credentials are
  available.

## Validation

Use the smallest honest set for the touched path:

```bash
npx vitest run app/lib/analytics/__tests__/event-router.test.ts
npx vitest run app/lib/analytics/__tests__/client.test.ts app/server/services/analytics/__tests__/amplitude-sink.test.ts app/api/analytics-events/__tests__/route.test.ts
npx vitest run app/lib/__tests__/track.test.ts app/server/domain-access/__tests__/server-analytics.test.ts
npm run quality:contract
```

`quality:contract` is the canonical contract closeout alias; it owns the Story
Chain, event contract, and ledger dry-run gate list (issue #193).

If review YAML changed, also run:

```bash
npx vitest run app/server/services/story-chain/__tests__/review-parser.test.ts
```

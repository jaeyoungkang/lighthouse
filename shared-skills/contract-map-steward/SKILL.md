---
name: contract-map-steward
description: Use when creating, editing, reviewing, or repairing derived Contract Maps / wiki-style reading maps under docs/contract-maps, including LLM wiki guidance, map indexes, source links, read paths, quality-gate maps, Story Chain authority maps, runtime maps, provider transition maps, or contract-map validation failures. Keeps maps derived from canonical sources and prevents stale navigation guidance.
compatibility: Claude Code, Codex, Cursor-style agents in the Light House repository.
---

# Contract Map Steward Skill

Use this skill for `docs/contract-maps/**` work. Contract Maps are derived
reading maps. They help agents choose source files; they do not create product
meaning, release criteria, or new validation obligations.

This is the Light House form of wiki-style contract writing. Treat the map as a
navigation layer over living sources, not as a second product wiki with its own
truth.

## Boundaries

- Do not use Contract Maps as approval artifacts.
- Do not let maps contradict Story Chain, Evidence Ledger, Mission Control, or
  Project Knowledge.
- Do not mark release status in a map without running the status command named
  by the map.
- Do not copy long contract prose into a map. Link to the owning file and
  summarize only the relationship needed for navigation.

## Read First

- `docs/contract-maps/README.md`
- the specific map being changed
- every canonical source the map claims to summarize
- `scripts/contract-maps/check.ts` when validation fails

## Workflow

1. Identify the reader question the map answers.
2. Read the canonical source before editing the map.
3. Keep the map short and navigational.
4. Link to owning files instead of restating long policy.
5. Do not add a gate, Promise, Aspect, or runtime rule in a map. Add it to the
   canonical source first, then map it.
6. Update `docs/contract-maps/README.md` when adding or retiring a map.
7. Run the validation block below for the change shape.

## Writing Rules

- State early what reader question the map answers and what it does not answer.
- Use section names that describe product concerns, not file-system tours.
- Prefer compact tables for authority, source, and gate relationships.
- Put `Sources:` directly under the claim cluster they support.
- Use repo-relative links to the nearest owning source file.
- Name computed state as computed state. For release, verdict, or Aspect status,
  cite the command used to read it.
- Record uncertainty as a read path or blocker, not as a new conclusion.
- When a map discovers stale source text, missing evidence, or a product
  contradiction, stop mapping and route the fix through Mission Control or the
  owning steward.

## Anti-Patterns

- "This map says the product now promises..." The map cannot create a Promise.
- "Frontmatter says unknown, so current status is unknown." Use the computed
  Mission Control status when the map discusses current status.
- "Provider X is trusted." Map the provider, loaded window, visible metadata,
  citation basis, and limits that the source contract already names.
- "We should add a validation gate here." Add or change gates through the
  quality-gate steward first, then map the relationship.

## Validation

For docs-only map work:

```bash
npm run contract-maps:check
npm run format:check -- docs/contract-maps
npm run mc:validate-story-chain
npm run pk:validate
```

If the map claims current release status, also run:

```bash
npm run mc:status
```

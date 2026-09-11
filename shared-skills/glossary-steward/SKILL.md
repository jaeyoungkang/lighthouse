---
name: glossary-steward
description: Use when adding, editing, reviewing, or retiring Light House contract terminology, especially Story Chain concept terms, repeated product-surface vocabulary, term grouping, owning-surface hints, or Promise/Evidence Ledger references. Keeps terminology aligned with Story Chain concepts, owning contracts, runtime-flow docs, and tests.
compatibility: Claude Code, Codex, Cursor-style agents in the Light House repository.
---

# Glossary Steward Skill

Use this skill when terminology work affects Story Chain concept wording,
product-surface vocabulary, or the references that explain where a term is
owned. Also use it when Story Chain
contract prose introduces a repeated product surface term, state name, source
owner, user-visible behavior label, or possible synonym for an existing
contract behavior.

Terminology guidance is derived from current contracts; it does not create
product meaning by itself.

## Read First

Read only the files needed for the target term, but start from these anchors:

- `docs/glossary/terms.json` for canonical ids, Korean/English names, aliases,
  kinds, and reference edges.
- `docs/glossary/README.md` for the generated readable index. Do not edit it
  directly.
- `docs/contracts/story-chain/concepts.md` for Story Chain concept terms.
- The owning Promise, Evidence Ledger, runtime-flow doc, code surface, and test
  for the target product-surface term.

If the request changes product meaning, Promise scope, Acceptance Checks,
Evidence Ledger coverage, or Story Chain concept definitions, use Mission
Control and the relevant steward skill before editing.

## Workflow

1. Classify the term.
   - `Story Chain concept`: Experience, Moment, Promise, Aspect, Acceptance
     Check, Intent Check, Evidence Ledger, verdict, stage, and related
     governance terms.
   - `Product surface vocabulary`: Light House-specific surface terms such as
     AI comment body, visual navigator, reactionPreparation, first card, owning
     UI/code surfaces, and related Promise/Evidence Ledger refs.
   - `Status / verdict vocabulary`: met, not-met, unknown, unverified, next,
     reality, 검증 근거, and similar state labels.
2. Choose the authority.
   - Story Chain concept meaning comes from `concepts.md`.
   - Product surface vocabulary comes from the owning Promise, Evidence Ledger,
     runtime-flow doc, code surface, or test.
   - User-visible labels live in the owning i18n namespace.
3. Keep grouping explicit.
   - Do not mix Story Chain concepts and product surface vocabulary in one
     unlabelled list.
   - Include owning surface hints and contract refs for product surface terms.
   - Keep short definitions in the owning contract map or source contract.
4. Preserve canonical names.
   - Do not rename canonical glossary terms for style.
   - Treat aliases as lookup-only. Do not emit them into generated docs or code
     names as if they were canonical.
   - Do not introduce aliases unless the source contract explicitly requires
     migration wording.
   - Do not expose implementation details as product promises. Explain their
     owning surface and contract reference.
   - Mechanical code-name and code-reference conformance is a separate
     workstream. Do not infer implementation identifiers from this core
     registry until that workstream's restart conditions are satisfied.
5. Decide what to do with new words in contract prose.
   - Lookup first: before drafting new Promise/Aspect prose or introducing a
     repeated product-surface word, run `npm run glossary -- lookup "<word>"`
     and use the canonical term it returns instead of coining a variant.
   - If the word is a synonym for an existing glossary or contract term, replace
     it with the canonical term in the contract prose.
   - If it is a repeated product surface vocabulary term, add it to the
     appropriate contract map or source contract with an owning surface hint
     and related Promise/Evidence Ledger, runtime-flow, or code-surface refs.
   - If it creates or changes product meaning, stop for Mission Control and
     Human authority before registering it as current vocabulary.
   - If it is only ordinary prose and will not be used as a contract handle,
     leave it out of the glossary.
6. Update evidence when contract terminology changes.
   - Update the relevant Promise Acceptance Check only when the contract changes.
   - Add or refresh a Sufficiency Review entry when Acceptance Check meaning or
     evidence coverage changes.
7. Validate the owning contract and surface.
   - Run `npm run glossary -- generate` after editing
     `docs/glossary/terms.json`.
   - Run `npm run guard:glossary` to validate lookup collisions, authority and
     reference edges, i18n values, and generated projections.
   - Use `npm run glossary -- lookup "<id|ko|en|alias>"` for mechanical lookup.
   - Run `npm run quality:contract` (the canonical contract closeout alias)
     when Story Chain or Evidence Ledger files change.
   - Run `npm run format:check` for edited docs/code.

## Boundaries

- Do not use the glossary to approve a new product concept. Route new meaning to
  Mission Control first.
- Do not hand-edit generated glossary projections or duplicate the registry in
  another format.
- Do not duplicate long Story Chain definitions in derived docs; point to the
  canonical concept or contract.
- Do not collapse product surface vocabulary into Story Chain concept terms.
  Keep their authority sources distinct.

## Reporting

In the final response, name the changed terms, the authority source used, and
the validation commands run. If no contract files changed, say that terminology
cleanup did not alter Story Chain meaning.

---
name: about-prose
description: Use when creating or updating public /about commitment prose (`app/about/**`, `app/i18n/messages/commitment.ts`, `docs/contracts/story-chain/evidence-ledgers/commitment-pages.ledger.yaml`) so prose stays aligned with the latest Story Chain docs and reads naturally. For Story Chain concepts or repeated product-surface vocabulary, use glossary-steward instead.
---

# About Prose Skill

Use this skill for `/about` and `/about/promises` prose work.
The goal is not to shorten text. The goal is to keep the prose human-readable,
aligned with the latest Story Chain source, and validated against the rendered
pages.

This skill owns commitment prose, not terminology governance. If the work is
about Story Chain concept terms, product surface vocabulary, term grouping, or
glossary-linked refs, switch to `glossary-steward` before editing.

This skill depends on Story Chain source-of-truth files. If those files are not
available or are stale, stop and refresh them first. `/about` prose is derived
from Story Chain; it is not authored from scratch in isolation.

`/about/promises` is the page that explains what value the service delivers to
the user. Write it as a value explanation page, not as a feature list.
For `/about/promises`, the page title and description must let the reader infer
the user value at a glance. Keep the summary compact, but keep every claim
grounded in Story Chain source wording.

## Read First

Before editing, read:

- `docs/contracts/story-chain/README.md`
- the relevant `docs/contracts/story-chain/experiences/*.md`
- the relevant `docs/contracts/story-chain/moments/*.md`
- the relevant `docs/contracts/story-chain/promises/*.md`
- the relevant `docs/contracts/story-chain/aspects/*.md`
- `docs/contracts/story-chain/concepts.md` when Story Chain vocabulary or
  review explanation changes
- `docs/contracts/story-chain/evidence-ledgers/commitment-pages.ledger.yaml`
- `app/about/page.tsx`
- `app/about/promises/page.tsx`
- `app/i18n/messages/commitment.ts`

## Procedure

1. Identify the target public `/about` surface.
2. Read the matching Story Chain source files first.
3. Match the text to the latest Story Chain source of truth.
4. If the work changes Story Chain concepts, repeated product-surface
   vocabulary, or glossary-linked refs, switch to `glossary-steward`.
5. Keep one sentence to one job. If a sentence mixes target, action, and result, split it.
6. Prefer natural Korean prose over compressed slogans or internal jargon.
7. Keep user-facing prose and spec expectations in sync.
8. For `/about/promises`, update the value coverage metadata when a paragraph
   is added, removed, or changes purpose.
9. If the visible contract changes, update the Evidence Ledger and tests in the same change.

## Writing Rules

- Use `glossary-steward` for Story Chain concepts, product-surface vocabulary,
  and glossary-linked refs.
- Do not introduce new product concepts in `/about` copy; reflect the existing Story Chain only.
- Do not draft `/about` prose without reading the matching Story Chain docs.
- Do not use shortening as the only fix. Make the sentence readable first.
- For `/about/promises` title and description, avoid noun-only summaries or
  awkward "X의 약속이다" phrasing. Write a compact but complete clause that
  a reader can understand at a glance.
- Avoid vague words like "주제" when Story Chain gives a clearer noun such as
  연구 영역, 클러스터, 공백, 대표 논문, or 갭 분석.
- Do not say a summary is "한 줄" unless the source explicitly says so.
- Do not place `promise:` refs in visible `/about/promises` body prose. Use
  footnotes or hidden trace markers instead.
- Do not repeat the section title verbatim in `/about/promises` footnotes.
  Use the original `promise:` key exactly as the visible footnote tag. The
  footnote is a locator, not a paraphrase.
- For `/about/promises`, lead with the value the service gives the user, then
  use Story Chain details to support that value.
- For `/about/promises`, keep the required value list in
  `REQUIRED_PROMISE_VALUE_FACETS` aligned with the paragraph `valueFacetIds`.
  A core value is covered only when the source promise is footnoted, the
  paragraph explains that value, and the paragraph carries the matching
  `data-value-facets` metadata through render.
- Prefer source-anchored wording over composite summaries. If a Story Chain
  sentence already says the point clearly, reuse that wording closely instead of
  inventing a new abstraction.
- Do not claim ordering like "first", "before", or "already" unless the source
  doc or promise explicitly says it.
- Treat `/about/promises` as external researcher-facing prose.
- Keep historical IDs in the prose where the spec requires them.
- Anonymize feedback sources. Never name a specific user, beta tester,
  reviewer, internal teammate, GitHub handle, or "베타 테스터 / 한 베타
  테스터 / Donggyu" in `/about/changes` body, summary, or detail bullets.
  Refer to the source as "사용자들 의견" / "user feedback" or by the
  neutral identifier (PR/issue number, plan path). The same rule applies
  to the entry id and i18n key prefix — pick a content-based slug
  (e.g. `2026-05-15-search-and-gap-feedback`) instead of embedding a name.
- For `/about/changes` title fields, write a researcher-facing outcome title.
  Never reuse PR titles, branch names, commit subjects, Conventional Commit
  prefixes (`feat(...)`, `fix:`), issue bundle labels (`bundles #...`), or bot
  labels like `[codex]`. The title should name what changed on screen or in
  the research workflow.

## Update Order

When prose and contract drift:

1. Update the Story Chain source doc if the contract itself changed.
2. Update `app/i18n/messages/commitment.ts`.
3. Update `app/about/promises/promise-paragraphs.ts` when `/about/promises`
   value coverage changes.
4. Update the Evidence Ledger at `docs/contracts/story-chain/evidence-ledgers/commitment-pages.ledger.yaml` if the visible behavior changed.
5. Update or tighten the relevant `app/about/__tests__/*` tests.

## Validation

Run the relevant checks after editing:

- `npx vitest run app/about/__tests__/promises-page.test.tsx app/about/__tests__/about-page.test.tsx`
- `npm run mc:validate-story-chain`
- `npm run mc:audit-surface`
- `npm run mc:audit-story-surface`

## Stop Conditions

Stop and ask before:

- changing glossary terms, tooltip definitions, product surface vocabulary, or
  glossary-linked refs without loading `glossary-steward`
- changing the audit surface contract
- changing the Evidence Ledger shape
- inventing a new about-page concept that is not in Story Chain

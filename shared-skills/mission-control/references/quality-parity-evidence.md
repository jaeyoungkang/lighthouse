---
name: mission-control-quality-parity-evidence
description: When two surfaces feed the same builder, name the parity invariant in the Acceptance Check and lock it with fixture-based or Intent Check evidence, not just deterministic helper tests.
---

# Quality Parity Evidence

Use this when an Acceptance Check claims that two product surfaces deliver
results of comparable quality — for example, when two different sources feed
the same downstream builder, when a fallback path is supposed to match the
primary path, or when a refactored pipeline must keep the same output shape
the previous pipeline produced.

The recent citation-lineage gap-analysis case is the canonical example. The
AC promised that the 인용 계보 source uses the same `gap_network` pipeline
as the search-result source. Three different code paths were involved, and
each path had a deterministic unit test. All tests passed. But the actual
analysis still produced ~0 paper-to-paper edges on the 인용 계보 side because
the upstream batch fetch dropped `references.paperId` / `citations.paperId`
fields. The Evidence Ledger never compared the two surfaces against each
other, so a helper-level green gate let a user-visible quality collapse
ship.

## When parity is in play

Apply this guide whenever **any** of these is true:

- An AC body says two paths "do the same thing" or "use the same pipeline".
- A new source/feature is added to an existing builder.
- A pipeline refactor swaps a helper but is supposed to keep equivalent output.
- A fallback path is meant to be indistinguishable from the primary path
  when the primary path is available.
- A live judge or Intent Check would be answering "is the result good in the
  same way the other surface's result is good?"

If none of the above, you do not need parity evidence — but you still need
the per-path evidence rule in `references/promise-modification.md`.

## What "helper-level tests are not enough" means

A deterministic helper test asserts that a specific function does what its
name says. Three helper tests can each pass on their own while the
end-to-end output still diverges, because the helpers run in different
upstream contexts (different SS field sets, different inline-analysis
maturity, different cap windows). Helpers prove only that the wiring is
correct given identical input — they do not prove the inputs are identical
in the first place.

Quality parity needs evidence that crosses the boundary the helpers do not
cross. Two viable shapes:

### Fixture-based parity evidence

A single deterministic test feeds the same logical scenario into both paths
and asserts that the user-visible output metric is comparable. For the
citation-lineage case, this would look like:

- Build a fixture: a mock SS response that exposes the same paper set with
  full adjacency metadata for both `FIELDS` (search) and `BATCH_FIELDS`
  (citation-lineage batch).
- Run the gap-network builder against both inputs.
- Assert `report.metrics.totalEdgeCount` is within the same order of
  magnitude. The exact threshold belongs to the test, not this guide —
  pick what the AC body claims.

The Evidence Ledger row should call this fixture out by file name and the
test name so a reviewer sees that the parity invariant is locked, not just
that two helpers work in isolation.

### Intent Check (live judge) evidence

Use an Intent Check when the parity question is qualitative — "does the
citation-lineage gap report read as a real research-gap analysis the same
way the search-result one does?" — and a deterministic numeric assertion
would over-fit. The live judge runs against actual rendered output and
returns a verdict.

This is heavier than the fixture form. Use it only when the AC body really
is making a qualitative claim ("comparable depth", "same kind of
explanation") and not a structural one ("same input fields", "same edge
count order of magnitude").

## Authoring checklist

When you are touching an AC where parity is in play, work through this
list before declaring the change done:

1. **Name the parity invariant in the AC body.** Do not leave it implicit
   in "uses the same pipeline". Write the invariant that, if broken, would
   make the surface diverge. Example phrasing: "분석 입력 paper는 검색
   결과 paper와 동일하게 references/citations adjacency를 함께 가져,
   gap-network builder가 두 source에서 같은 quality의 paper-to-paper edge를
   계산할 수 있다."
2. **Decide fixture or Intent Check.** Use the rules above.
3. **Write the evidence and name it in the ledger row.** A row that names
   only the per-path helper tests does not lock the parity invariant.
4. **If you went with an Intent Check, register it on the Promise.** Add
   the Intent Check entry, link the live judge, and add a verdict to the
   covering Sufficiency Review.
5. **Update the simulation / fixture environment if applicable.** If the
   parity test needs a mock provider response, add the mock to the existing
   `s2-fetch` / inline-analysis / gap-network fixture surface so the test
   is reproducible. Do not invent a separate mocking style for a one-off
   test.

## What this is not

- This is not a license to add a live judge for every Promise. Most
  Acceptance Checks remain deterministic and structural; parity evidence
  applies only to the parity claim itself.
- This is not a replacement for the per-path multi-evidence rule in
  `references/promise-modification.md`. The two rules stack: every named
  path needs its own evidence, **and** the parity claim across paths needs
  its own.
- This is not a contract policy change. Existing Promises do not retroactively
  require parity evidence unless their AC body actually claims parity.

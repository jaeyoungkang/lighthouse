---
name: mission-control-live-judge-authoring
description: Current live judge authoring workflow for closing Intent Checks against actual runtime output or rendered DOM.
---

# Live Judge Authoring

Live judges answer Intent Checks. They must evaluate what the user would
actually see: runtime AI response output or rendered component DOM. Simulation
prompts and hand-authored ideal outputs are not valid evidence.

## Interfaces

- `app/server/ai-generation/intent-qualitative-judge.ts` accepts `IntentQuestion[]` and returns
  an `IntentJudgeReport`.
- `app/server/ai-generation/judgment.ts` calls the configured Gemini judge and requires
  `GEMINI_API_KEY` for live execution.

## Pattern

1. Convert each `### intent-check:<slug>` block into an `IntentQuestion`.
   Keep the canonical `intent-check:<slug>` id.
2. Build the runtime fixture through the real service path:
   - runtime AI response payload from the active response channel;
   - server service output used by the surface;
   - component props produced by the actual preparation layer.
3. Render the real component when the Promise is UI-facing.
4. Pass `container.textContent` or the actual runtime AI response content to
   `judgeIntentQualitative`.
5. Assert `report.verdict === "met"` and `unansweredCritical` is empty.
6. Add the test path as the Evidence Ledger Intent Check evidence.

## Evidence Ledger Update

For each Intent Check evidence path, update:

- `## Intent Checks` with `intent-check:<slug>`, evidence, and source Promise.
- `## Acceptance Checks` with deterministic checks that support the same
  Promise.
- a structured execution if evidence-ledger should execute the evidence path.
- the review/verdict section when a dated qualitative verdict is required.

## Failure Modes

- **Simulation wrapper**: invalid. Replace with actual runtime output.
- **DOM omission**: if the judge cannot see it in rendered text, expose the
  relevant user-visible state or adjust the test interaction.
- **Weak answer criteria**: strengthen the Intent Check rubric rather than
  weakening the judge.
- **Flaky verdict**: collect repeated runs before declaring a stable `met`.

# LLM Usage Observability — Sufficiency Reviews

### Sufficiency Review

#### 2026-07-21 — write-only trusted usage accounting

```yaml
date: 2026-07-21
acs:
  - acceptance-check:llm-usage-observability-execute-judgment-ledger
acReviewedRevision:
  - 1
fixtureRef: app/lib/__tests__/llm-judgment.test.ts; app/server/domain-access/__tests__/llm-usage-access.test.ts; app/server/repository/__tests__/llm-usage-events.test.ts
runCommitSha: 27bd7a64d150+worktree
observedOutput: Trusted DB/principal owners still append best-effort provider-returned usage with allowlisted metadata and without prompt/output bodies; the global admin aggregation read path and dashboard are retired.
gaps:
  - adopt: Durable usage writes remain available for future operational queries outside this application surface.
  - reject: A single-operator dashboard does not justify a global read capability in the web application.
verdict: met
```

- Verdict: met

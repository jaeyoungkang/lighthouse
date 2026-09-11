# UX Writing Voice and Tone — Sufficiency Reviews

This file stores the dated Sufficiency Review log for
[ux-writing-voice-and-tone.ledger.yaml](../ux-writing-voice-and-tone.ledger.yaml).
The ledger keeps executable coverage and the review pointer; release and Mission
Control readers treat this file as part of the same Evidence Ledger review
source.

## Reviews

### Sufficiency Review

Dated log of judging `aspect:ux-writing-voice-and-tone` against the fixed-copy
registry deterministic track and the qualitative live-judge track.

#### 2026-07-27 — invited-access admin and auth failure copy follow the direct-user track

```yaml
date: 2026-07-27
acs:
  - acceptance-check:search-results-fast-window-result-basis-visible
  - intent-check:search-reaction-ux-writing-voice
  - acceptance-check:invited-user-access-management-admin-surface
acReviewedRevision:
  - 17
  - 1
fixtureRef: scripts/mission-control/check-message-registry-contract.ts; app/components/research-route-renderers/__tests__/search-view-content.test.tsx; app/server/services/__tests__/search-awareness-intent-qualitative.live.test.ts; app/admin/__tests__/admin-access.test.tsx; app/api/auth/magic-link/__tests__/route.test.ts
runCommitSha: 6e3ac3829439+worktree
observedOutput: The aspect:ux-writing-voice-and-tone deterministic result-basis and recorded qualitative search-reaction tracks remain current. The invited-access registry group additionally classifies admin.access.* and invitedAccess.* as direct-user microcopy. The deterministic contract rejects developer jargon and raw error codes, while rendered tests keep result-naming add/remove actions, explicit empty and failure states, and a plain-language retry instruction when the DB decision is unavailable.
gaps:
  - adopt: The access actions name their outcomes and the failure states explain what happened without exposing implementation terms.
  - reject: The administrative audience does not make operational error codes or raw DB wording acceptable user-facing copy.
verdict: met
```

- Verdict: met

#### 2026-06-29 — `aspect:ux-writing-voice-and-tone` introduced with phased verdict

```yaml
date: 2026-06-29
acs:
  - acceptance-check:search-results-fast-window-result-basis-visible
  - intent-check:search-reaction-ux-writing-voice
acReviewedRevision:
  - 9
fixtureRef: scripts/mission-control/check-message-registry-contract.ts; docs/contracts/story-chain/aspects/ux-writing-voice-and-tone.md; docs/contracts/story-chain/evidence-ledgers/ux-writing-voice-and-tone.ledger.md; app/server/services/__tests__/search-awareness-intent-qualitative.live.test.ts
runCommitSha: pending
observedOutput: Historical pre-Scholar-rename evidence: the deterministic UX-writing track was wired and green — every registry owner group declared aspect:ux-writing-voice-and-tone, and the fixed-copy registry contract rejected developer jargon and raw error codes in direct-user microcopy groups (search/agent/gap/citation/document/auth-onboarding) while keeping the existing direct-user ending rules. The pre-auth rendered copy explained Moonlight Search through the user's query plus Moonlight library context at that time; current Scholar naming is reviewed on the search-entry result-basis surface.
gaps:
  - adopt: Machine-checkable UX-writing rules (no dev jargon / error codes in direct-user microcopy, consistent direct-user endings) are deterministic contract evidence across the whole fixed-copy registry, with current Scholar source naming covered on the search-entry result-basis surface.
  - adopt: The qualitative craft principles (weed-cutting, active/positive phrasing, result-naming CTAs, suggestion over force, empathy) remain covered only by an authored live judge that has not yet produced a recorded verdict — tracked as the open propagation path. Until intent-check:search-reaction-ux-writing-voice is run with GEMINI_API_KEY and stamped here, aspect:ux-writing-voice-and-tone stays unknown and may leave release blocked.
  - reject: Internal audit/decision-log and public about document prose are not forced into microcopy jargon rules; they remain document-style 다체 surfaces governed by the voice principles, not the deterministic jargon scan.
verdict: unknown
```

- Input: Human direction on 2026-06-29: UX 라이팅 원칙(토스 기반 voice·tone)을
  전체 계약에 걸치는 cross-cutting Aspect로 추가하되, 기계검증 가능한 규칙은
  결정적으로 닫고 정성 규칙은 live judge로 닫는 혼합 검증으로, 단계적 판정을
  허용한다.
- Evidence: α Deterministic track — `npm run mc:check-message-registry` now
  enforces UX-writing machine-checkable rules in the direct-user microcopy
  groups and requires every owner group to declare
  `aspect:ux-writing-voice-and-tone`. β Aspect declaration — the four-section
  Aspect file weaves voice·tone craft over the language governance track. γ
  Reciprocal weaving — all 15 appliesTo promises declare the Aspect, and this
  covering ledger weaves a representative source-promise subset with real
  evidence.
- Gaps observed:
  - Adopt-resolved — fixed-copy UX-writing rules are deterministic registry
    evidence.
  - Unknown — qualitative craft principles await a recorded live-judge run; the
    Aspect verdict is intentionally `unknown` (phased), not forced green.
  - Reject — document-style internal/about prose keeps 다체 and explanatory
    technical terms; it is not collapsed into the microcopy jargon rule.
- Verdict: unknown

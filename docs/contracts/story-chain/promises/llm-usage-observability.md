---
id: promise:llm-usage-observability
slug: llm-usage-observability
title: Trusted generation usage is recorded without prompt content
moment: moment:alignment-relation-observability
lane: admin
status: propagated
acRulesEnforced: true
acceptanceChecks:
  - acceptance-check:llm-usage-observability-execute-judgment-ledger
analyticsExempt: internal LLM usage cost accounting is observed by the llm_usage_events ledger tests, not product analytics
verdict: met
---

CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/553#contract-architecture-impact-review

# Trusted generation usage is recorded without prompt content

## Promise

Light House가 신뢰 경로에서 실행한 LLM provider 사용량을 원장에 기록한다. Prompt나
생성 결과 전문을 저장하지 않고 token, cost, model, action, owner, duration 같은
운영 metadata만 남긴다.

원장의 durable source는 `lighthouse.llm_usage_events`다. Route AI comment처럼
structured gateway를 직접 쓰는 호출과 `executeJudgment` 공통 판단 실행기를 지나는
호출은 같은 원장 schema로 기록된다. DB와 owner principal을 이미 가진 route 또는
domain-access 경계가 usage ledger를 주입하고, 공통 실행기는 provider 결과가 돌아온
호출만 success, empty, aborted 상태로 기록한다. Provider 결과 없이 실패한 시도는
token usage row를 만들지 않는다.

이 Promise는 비용 hard cap을 약속하지 않는다. 운영자는 실제 지출을 차단하기 전에
어떤 action/model/owner가 token과 비용을 만들었는지 먼저 볼 수 있어야 한다.

## Intent Checks

명시적 Intent Check는 없다. 원장 기록과 metadata allowlist를 deterministic
evidence로 닫는다.

## Acceptance Checks

### acceptance-check:llm-usage-observability-execute-judgment-ledger

- description: `executeJudgment`는 선택적 usage ledger를 받으면 provider 결과가 돌아온 판단 호출의 `label`을 action으로 사용해 `llm_usage_events` recorder에 token/cost usage를 넘긴다. 정상 파싱·검증은 `success`, provider output이 소비 가능한 결과가 되지 못한 fallback/parse 실패는 `empty`, provider 결과 뒤 caller signal이 끊긴 상태는 `aborted`로 기록한다. 인라인 분석, 연구 용어 추출, gap network narrative enrichment처럼 DB와 owner principal을 이미 가진 trusted route/domain-access 경계는 이 usage ledger를 내려보낸다. Prompt 본문과 생성 output 본문은 원장 metadata에 넣지 않는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 1

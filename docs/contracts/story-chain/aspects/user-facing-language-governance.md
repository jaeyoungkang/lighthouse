---
id: aspect:user-facing-language-governance
slug: user-facing-language-governance
title: User-facing language governance
appliesTo:
  - promise:search-empty-results-next-action
  - promise:search-results-fast-window
  - promise:search-spelling-correction
  - promise:search-results-suggest-english-terms
  - promise:researcher-prose-promises-page
  - promise:search-reaction-summarizes-terrain
  - promise:citation-lineage
  - promise:gap-network-detection-from-search
  - promise:gap-report-prepared-reaction
  - promise:gap-overlay-decision-evidence
  - promise:search-query-route-transition
  - promise:search-result-library-add
  - promise:invited-user-access-management
coveringLedger: docs/contracts/story-chain/evidence-ledgers/user-facing-language.ledger.yaml
verdict: met
---

CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/553#contract-architecture-impact-review

# User-facing language governance

## Why

사용자에게 전달되는 말은 제품 동작의 일부다. 같은 기능도 문구가 다르면
사용자는 검색 기반, AI 반응, 데이터 한계, 다음 행동을 다르게 이해한다.
따라서 사용자-facing 언어는 구현 뒤에 붙는 설명이 아니라 Promise를 닫는
검증 대상이다.

이 Aspect는 모든 사용자-facing 말을 두 트랙 중 하나로 보낸다. 고정 문구는
`app/i18n/messages*` registry의 key로 모으고, registry owner와 DOM evidence로
닫는다. 생성 문구는 structured generation prompt, schema, live judge,
fixture evidence로 닫는다. 어느 트랙에도 속하지 않은 새 문구는 계약 전파가
끝난 상태가 아니다.

## Pointcut

사용자가 제품을 이해하거나 판단하는 데 쓰는 모든 문구가 대상이다. 공개 검색
시작 화면, 결과 기준 문구, 공개 about 안내, 버튼 주변 설명,
상태·오류·fallback 안내, AI 반응 title/body와 guided action description이
여기에 포함된다.

단순 아이콘의 접근성 label처럼 정보 구조나 제품 이해를 만들지 않는 짧은
기계적 label은 local Promise의 i18n 관리 규칙으로 닫을 수 있다. 그러나 그
label이 source, 근거, 한계, 다음 행동, 제품 작동방식 설명을 담으면 이
Aspect의 적용 대상이다.

## Advice

- 새 사용자-facing 문구는 고정 문구 트랙 또는 생성 문구 트랙 중 하나로
  분류한다.
- 고정 문구 트랙은 `app/i18n/messages*` registry에 들어가야 하며, registry
  owner group이 Promise와 Aspect를 가진다. rendered DOM test, tone
  consistency test, 또는 ledger inspection evidence는 registry key가 실제
  surface에 닿는지를 닫는다.
- 고정 문구 registry는 의미론적 tone policy도 가진다. 직접 방문자에게 말하는
  auth/onboarding 문구는 존댓말 종결을 유지한다. 공개 about 안내는 문서형
  다체를 쓸 수 있지만, 같은 surface 안에서 두 말투가 섞이면
  Aspect 위반이다. `[system]` event 문구는 직접 사용자에게 말하는 존댓말이
  아니라 시스템 관찰문으로 유지한다.
- 생성 문구 트랙은 prompt contract, structured generation schema,
  deterministic fixture, live judge evidence 중 해당 surface에 맞는 evidence로
  닫는다.
- 직접 사용자를 향한 onboarding·auth 문구는 존댓말을 기본으로 한다. 공개
  about 안내는 문서형 다체를 쓸 수 있다. 같은 surface 안에서
  두 말투를 섞지 않는다.
- 사용자가 모를 수 있는 provider나 내부 색인 이름은 설명 없이 신뢰 근거처럼
  쓰지 않는다.
- 부정형으로 먼저 방어하지 않는다. AI가 고르지 않는다는 식의 방어 문장보다
  "Google Scholar처럼 검색어로 논문을 직접 찾는다"처럼 제품이 실제로 하는 일을 먼저
  쓴다.
- "AI 추천", "추천 목록", "없음"처럼 사용자가 생성·편집 판단이나 실제 빈 결과로
  오해할 수 있는 말은 source, input scope, 확인 범위와 함께 쓴다.

## Verification

`user-facing-language.ledger.yaml`가 이 Aspect의 트랙 분류를 닫는다. 고정 문구
트랙은 `app/i18n/messages*` registry contract, registry-level semantic tone
policy와 target-owning ledger의 rendered evidence로 공개 검색 시작 화면,
결과 기준, 라이브러리 action, admin 접속 관리, 공개 about 안내를 검증한다.
생성 문구 트랙은 structured generation 형식과 reaction tone evidence를 통해
검증한다. Prompt presence fixture는 지시와 입력 경계가 generation gateway까지
전달됐다는 사실만 증명한다. 생성된 문구가 source, 한계, tone과 의미를 실제로
지켰다는 판단은 structured output fixture 또는 real-output live judge가 별도로
닫는다.

`aspect:visible-explanation-sufficiency`는 source/input/limit 정보 구조를
맡는다. `aspect:reaction-prefers-load-bearing-facts`는 생성 AI 반응 문장의
정보 밀도와 표현 우선순위를 맡는다. 이 Aspect는 두 규칙 위에서 모든
사용자-facing 언어가 어느 트랙으로 검증되는지 정한다.

CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/355#issuecomment-5125404747

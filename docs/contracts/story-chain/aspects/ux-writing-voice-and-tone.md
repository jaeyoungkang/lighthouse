---
id: aspect:ux-writing-voice-and-tone
slug: ux-writing-voice-and-tone
title: UX writing voice and tone
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
  - promise:invited-user-access-management
coveringLedger: docs/contracts/story-chain/evidence-ledgers/ux-writing-voice-and-tone.ledger.yaml
verdict: met
---

CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/553#contract-architecture-impact-review

# UX writing voice and tone

## Why

같은 정보도 문장이 어떻게 쓰였는지에 따라 사용자가 느끼는 신뢰, 이해 속도,
다음 행동이 달라진다. `aspect:user-facing-language-governance`가 사용자-facing
말이 **어느 트랙에서 검증되는지**(고정 문구 registry / 생성 문구 structured generation·live
judge)를 정한다면, 이 Aspect는 그 트랙 안의 문구가 **실제로 어떻게 읽히는지**를
잠근다. voice(브랜드 정체성으로서 변하지 않는 말투)와 tone(상황별 태도)을
craft 수준에서 일관되게 유지해, 어느 화면에서나 같은 사람이 말하는 것처럼 들리게
한다.

이 Aspect는 구현 뒤에 붙이는 문구 다듬기가 아니라 Promise를 닫는 검증 대상이다.
기계로 판별 가능한 규칙(개발 용어·에러 코드 노출, 직접-사용자 문구의 말투
종결)은 고정 문구 registry 계약이 결정적으로 닫고, 사람의 판단이 필요한 정성
규칙(군더더기, 능동·긍정형, 한자어 나열, 권유, 공감)은 live judge가 닫는다.

## Pointcut

사용자가 읽는 모든 제품 문구가 대상이다 — 버튼·CTA 레이블, 빈 상태, 오류·실패
안내, 로딩·상태·fallback 문구, 입력 힌트, AI 반응 title/body, guided action
description, 공개 about 안내 prose가 여기에
포함된다.

문구는 두 결로 나뉜다. **직접-사용자 microcopy**(검색·반응·gap·citation·문서
공용 surface의 버튼·상태·오류·빈 상태)는 해요체와 일상어를 기본으로 하고,
개발 용어·에러 코드·영문 jargon 노출을 금지한다. **문서형 prose**(공개 about
안내)는 문서형 다체를 쓸 수 있고 기술 개념을
설명상 언급할 수 있으므로 microcopy jargon 금지 규칙의 결정적 대상이 아니지만,
능동·긍정형·보편적 단어·공감이라는 voice 원칙은 동일하게 따른다.

순수하게 기계적인 접근성 label(정보 구조나 제품 이해를 만들지 않는 짧은
아이콘 label)은 이 Aspect의 결정적 대상이 아니다. 그 label이 상태·결과·다음
행동을 설명하면 microcopy로서 대상이 된다.

## Advice

- 직접-사용자 microcopy는 해요체로 통일한다. `~했습니다` / 하십시오체 같은
  격식 종결과 반말형 종결을 직접-사용자 문구에 섞지 않는다. (말투 트랙 분리는
  `aspect:user-facing-language-governance`의 정책을 공유한다.)
- 개발 관점의 기술 용어와 에러 코드를 직접-사용자 microcopy에 노출하지 않는다.
  `Error 500`, `timeout`, `Unauthorized`, `Fetching...` 같은 표현은 무슨 일이
  일어났는지와 다음 행동을 담은 일상어로 번역한다.
- 군더더기와 의미 없는 반복을 제거한다. 한 화면 안에서 같은 의미를 다른 문장으로
  되풀이하지 않고, 생략해도 뜻이 통하는 단어는 덜어낸다.
- 능동·긍정형으로 쓴다. 제약("~할 수 없습니다")을 먼저 방어하기보다 가능한
  대안("~에서 할 수 있어요")과 동작 주체를 먼저 보여준다.
- 한자어 명사를 무미건조하게 나열하기보다 동사로 풀어 친근하게 서술한다
  ("활성화/비활성화" 대신 "켜기/끄기").
- CTA·버튼은 사용자가 얻게 될 결과를 명시한다. "확인", "제출"처럼 결과가 모호한
  레이블 대신 그 동작이 무엇을 끝내는지 드러낸다.
- 오류 메시지는 무엇이 잘못됐는지 사용자 언어로 설명하고, 즉시 할 수 있는 다음
  행동을 함께 제시한다. 빈 상태는 방치하지 않고 다음 행동을 권한다.
- 강요·공포로 밀어붙이지 않고 권유하며 최종 선택권이 사용자에게 있음을 남긴다.
  연령·배경과 무관하게 누구나 아는 보편적 단어를 쓰고, 유행어·밈은 피하며, 그
  순간 사용자가 느낄 감정에 공감하는 문장을 설계한다.

## Verification

`ux-writing-voice-and-tone.ledger.yaml`가 이 Aspect를 두 트랙으로 닫는다.

- **결정적 트랙**: 고정 문구 registry 계약(`check-message-registry-contract.ts`)이
  직접-사용자 microcopy 그룹에서 개발 용어·에러 코드 노출을 거부하고, 직접-사용자
  문구의 말투 종결을 강제한다. 이 트랙은 registry 전체를 스캔하므로 owner 그룹에
  속한 모든 고정 microcopy에 한 번에 적용된다.
- **정성 트랙**: live judge Intent Check가 군더더기·능동·긍정형·한자어 나열·CTA
  결과 명시·권유·공감 같은 사람의 판단이 필요한 원칙을 렌더된 문구에 대해
  채점한다. 이 트랙이 실제 judge run으로 닫히기 전까지 Aspect verdict는 단계적
  `unknown`으로 둔다 — 미검증 정성 규칙을 met로 선언하지 않는다.

`aspect:user-facing-language-governance`는 문구가 어느 트랙에서 검증되는지와
고정/생성 트랙의 말투 분리를 맡는다. `aspect:visible-explanation-sufficiency`는
source·input·limit 정보 구조를, `aspect:reaction-prefers-load-bearing-facts`는
생성 반응 문장의 정보 밀도를 맡는다. 이 Aspect는 그 위에서 문구가 voice·tone
craft 기준으로 어떻게 읽히는지를 잠근다.

CAIR record: `docs/contracts/story-chain/promises/invited-user-access-management.md#contract-architecture-impact-review`

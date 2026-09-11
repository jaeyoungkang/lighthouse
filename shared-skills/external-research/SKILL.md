---
name: external-research
description: Use when Light House work needs external material research — 외부 자료 리서치, 외부 자료 조사, desk research, web research, 웹 검색 조사, 논문·표준·공식 문서·오픈소스 저장소·경쟁 제품 조사, landscape/competitor survey, 외부 근거 수집, source pinning(URL·접근일·exact revision·DOI), or deciding where research output lands (moonlight-project-knowledge research/, durable issue/PR, local Project Knowledge). Owns the execution procedure and citation discipline for sources outside this repository. It does not own product feedback triage (product-discovery-steward), research disposition or contract meaning (mission-control), product decisions (jaeyoung-think), report storage structure (moonlight-project-knowledge README), or recall of existing internal decisions (Project Knowledge, git/issue/PR history).
compatibility: Claude Code, Codex, Cursor-style agents in the Light House repository.
---

# External Research Skill

리포지토리와 제품 밖의 외부 자료를 조사하는 실행 절차를 소유한다. 대상은 공식
문서, 표준, 논문, 오픈소스 저장소, 경쟁 제품·유사 서비스, 그리고 해당 분야
권위자의 공개 의견이다. 목표는 재현 가능한 근거다. 다른 agent나 Human이 같은
근거를 같은 revision에서 다시 확인할 수 있어야 하고, 산출물은 agent가 개별
단위로 재사용할 수 있는 의미 단위 조각으로 구성한다.

## Boundaries

- 제품 피드백, 인터뷰 노트, ideation, surface 비교에서 출발하는 발견 작업은
  `product-discovery-steward`가 소유한다. 이 skill은 그 작업이 요구하는 외부
  근거의 수집 절차만 제공한다.
- Service Policy Coverage Review에 공급된 research의
  `owned / rejected / unresolved` disposition과 계약 의미는 `mission-control`이
  소유한다.
- 조사가 제품 결정을 드러내면 이 skill 안에서 결정하지 않는다. 스코프가
  정리된 제품 선택은 `jaeyoung-think` proposal과 Human 승인으로 라우팅한다.
- 리서치 산출물의 보관 구조(`research/`·`knowledge/`·`archive/`)와 파일 배치
  규칙은 moonlight-project-knowledge `README.md`가 소유한다. 이 skill은 산출물
  내용의 조각 구성과 배치 분기 판정을 소유하고, 저장소의 보관 구조를
  재정의하지 않는다. 두 규칙이 충돌하면 보관 구조는 README를, 내용 구성은 이
  skill을 따른다.
- 기존 내부 결정과 그 이유의 회상은 외부 리서치가 아니다. Project Knowledge,
  정본 문서, `rg`, `git log`/`git show`, issue/PR history로 간다.
- 조사 결과는 advisory 근거다. 그 자체로 Story Chain, 계약, 코드를 바꾸지
  않는다.

## 실행 절차

1. **질문과 소비자 고정** — 조사 질문을 한 문장으로 적고, 그 답을 소비할
   결정을 함께 적는다. 소비자는 구현 선택, product discovery, coverage
   review, 운영 판단처럼 구체적인 결정이어야 한다. 소비자가 없는 조사는
   시작하지 않는다.
2. **소스 선택** — 1차 소스(공식 문서, 표준·논문 원문, 소스 저장소, 로컬 설치
   패키지)를 2차 소스(블로그, 요약 글, 모델의 과거 학습)보다 우선한다. 검색
   도구는 소스 발견에 쓰고, 인용은 원문으로 한다. 설치된 패키지·repo가
   기억과 충돌하면 설치본이 이긴다. 해당 분야를 앞서가는 권위자를 식별하고
   그들의 공개 의견(논문, 발표, 공개 글, 인터뷰)도 소스로 수집한다. 권위의
   근거(역할, 이력, 해당 분야 기여)를 조각에 함께 적는다.
3. **근거 고정** — 채택한 모든 주장에 소스를 고정한다. 웹 문서는 URL과
   접근일, 저장소·패키지는 exact commit·버전, 논문은 DOI 또는 arXiv id를
   적는다. 고정할 수 없는 주장은 미확인으로 표시하거나 버린다.
4. **관찰과 해석 분리** — 소스가 말한 내용과 Light House에 갖는 의미를 같은
   문장에 섞지 않는다. 권위자 의견은 누가 무엇을 말했다는 관찰로 기록하고
   사실 주장과 구분한다. 상충하는 소스는 숨기지 않고 함께 기록한다.
5. **정보 조각 구성** — 수집한 정보를 서사형 문서가 아니라 의미 단위 조각으로
   구성한다. 한 조각은 한 주장이나 발견을 담고, 고정된 소스, 관찰/해석 구분,
   관련 조각 연결을 가진다. 리포트가 필요한 자리에서도 본문을 조각의 배열로
   구성해 agent가 개별 조각을 찾고 재사용할 수 있게 한다.
6. **산출물 배치 분기** — 산출물의 소비 범위로 위치를 정한다. 조각 구조를
   그대로 보존할 수 있는 저장이 가능하면 산문 요약보다 우선한다.
   - Moonlight 전반이 재사용할 리포트는 moonlight-project-knowledge
     `research/`에 dated 파일로 남긴다. Lighthouse 문서·PR과의 commit 고정
     링크 왕복은 AGENTS.md 규칙을 따른다.
   - 하나의 workstream만 소비하는 근거는 그 작업의 durable issue/PR/plan
     본문에 남긴다.
   - 반복 절차가 아닌 유용한 기억은 `npm run pk:remember`로 남긴다.
7. **owner 이관** — 조사가 제품 결정, 계약 의미 변경, 구조 변경을 드러내면 그
   지점에서 멈추고 위 Boundaries의 owner로 라우팅한다.

## Validation

외부 리서치 자체에는 결정적 게이트가 없다. 최소 검증은 다음과 같다.

- 채택한 주장 전수에 고정된 소스가 있는지 산출물 안에서 점검한다.
- 산출물이 조각 구조(한 조각 한 주장, 소스 고정, 관찰/해석 구분, 관련 조각
  연결)를 갖췄는지 점검한다.
- 산출물이 Lighthouse 문서를 수정하면 `npm run format:check`와 해당 문서
  owner의 게이트를 실행한다.
- moonlight-project-knowledge에 기록하면 그 저장소 README의 배치 규칙을
  따랐는지 확인한다.

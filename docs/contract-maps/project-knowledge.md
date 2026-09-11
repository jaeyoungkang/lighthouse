# Project Knowledge Contract Map

이 map은 작업 이어받기 기억과 Light House 설명 지식, 현재 제품 정본을 어디서
읽어야 하는지 안내한다. Project Knowledge가 현재 Promise, runtime, release verdict를
정하지는 않는다.

## 기억과 지식

| 질문 | 읽을 곳 | 역할 |
| --- | --- | --- |
| 이 clone에서 무슨 작업을 이어가야 하는가? | `.project-knowledge-local/work-memory.md`, `work-memory-log.jsonl` | `local-episodic` handoff와 append-only evidence |
| 제품은 왜 이런 개념·행동·구조를 갖는가? | [`knowledge-objects.md`](../project-knowledge/knowledge-objects.md)의 `plane: product` | review된 `shared-consolidated` 설명 |
| 팀은 왜 이런 방식으로 제품을 만드는가? | [`knowledge-objects.md`](../project-knowledge/knowledge-objects.md)의 `plane: product-making` | 제작 체계의 배경과 실제 사례 |
| 과거 narrative가 아직 이관되지 않았는가? | [`shared-memory.md`](../project-knowledge/shared-memory.md) | byte-preserved legacy read와 lazy migration 후보 |
| 지금 무엇을 해야 하는가? | 객체의 `authority_refs` | 현재 명령·상태·verdict의 owner |

Sources:

- [`docs/project-knowledge/README.md`](../project-knowledge/README.md)
- [`docs/project-knowledge/knowledge-objects.md`](../project-knowledge/knowledge-objects.md)

## Authority 경계

Project Knowledge는 정본이 각각만으로 설명하기 어려운 형성 배경, 긴장, 기각 대안,
관계와 사례를 연결한다. 현재값과 행동은 복제하지 않는다.

| 현재 질문 | Authority |
| --- | --- |
| 제품 정체성과 원칙 | [`docs/product-identity.md`](../product-identity.md) |
| Experience, Moment, Promise, Aspect 의미 | [`docs/contracts/story-chain/`](../contracts/story-chain/) |
| 실행 evidence와 release state | Evidence Ledger와 `npm run mc:status` |
| runtime 처리 순서 | [`docs/runtime-flows/`](../runtime-flows/) |
| 상태·데이터 구조 | [`docs/infrastructure.md`](../infrastructure.md), code/schema |
| SLO와 rollout verdict | [`docs/operational-readiness.md`](../operational-readiness.md), dated records |
| 반복 계약 용어와 canonical naming | [`docs/glossary/`](../glossary/) |
| agent 행동과 workflow | [`docs/agent-skills.md`](../agent-skills.md), owning skill |
| 사용자 연구·외부·일반 지식 | [Moonlight Research @ `361a2a1d`](https://github.com/corca-ai/moonlight-research/tree/361a2a1d3f116452d84c97ec9ab1eccb4fc5d6c3) |

객체와 authority가 충돌하면 authority가 이긴다. 충돌은 객체를 refresh하거나 제품
결정을 Human과 다시 열 신호다. PK를 따라 현재 동작을 바꿀 근거는 아니다.

## 객체 읽기

각 객체는 하나의 `product | product-making` plane과 `concept | model | case` kind를
갖는다. `current | disputed | historical | superseded` 상태를 함께 읽는다. relation은
`produced_by`, `serves`, `evidenced_by`, `challenged_by`, `supersedes`만 사용한다.

예를 들어 Search-first route의 수명 모델은 제품 객체가 설명한다. 전환 과정은
product-making case가 설명하고 `produced_by`로 연결한다. 현재 route 동작을 주장할
때는 두 객체가 아니라 Product Identity와 Story Chain을 다시 읽는다.

## Legacy 읽기

`shared-memory.md`는 일괄 변환하지 않는다. `pk:recall`이 legacy narrative를 실제로
찾았을 때만 current authority와 source를 재검증한다. 이 review는 narrative를
0개로 비승격하거나 하나 이상의 객체로 분할·보강한다. `legacy_refs`가 생기면 recall은
forward target을 표시하지만 legacy bytes를 수정하지 않는다.

## 명령

```bash
npm run pk:start
npm run pk:remember -- --note "<한국어 narrative>"
npm run pk:checkpoint
npm run pk:review -- --approve .project-knowledge-local/candidate.md
npm run pk:recall -- <query>
npm run pk:recall -- --plane product-making --kind model --status current <query>
npm run pk:validate
```

Source:

- [`docs/project-knowledge/README.md`](../project-knowledge/README.md)

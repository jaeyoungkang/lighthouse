# Search quality evaluation

기존 `load-smoke` schema v5의 ordered `paperIds`를 읽어 transport 성공과 결과 품질
판정을 분리한다. 검색을 직접 실행하거나 report를 저장하지 않는다.

- `deterministic-wiring`은 synthetic DOI·title·topic의 actual-path identity와 0–3
  judgment 연결만 검증하며 release는 언제나 `not-applicable`이다.
- `bounded-live`는 승인 후보 policy와 지표를 진단할 수 있지만, 이 로컬 evaluator는
  release authority가 아니다. Protected exact-main 수집과 attestation이 생기기 전에는
  모든 bounded-live 결과가 `no-go`다.
- p95는 query별 p95의 최댓값, error rate는 non-2xx 비율, known-item recall@K는
  expected ID 전체 중 top K에서 찾은 비율, topic relevance는 평균 nDCG@10이다.
  0–3은 `무관·주변 맥락·일부 직접 관련·핵심 결과`이며 unjudged는 0이다.

네 지표는 합성하지 않는다. v1–v4, missing query, dirty·mixed revision, query 불일치,
unreadable·inconsistent ranking은 complete evidence가 아니다. Live 판정은 policy
부재·set 불일치·승인 전·stale·future evidence도 `no-go`다.

Clean revision에서 local Supabase, query-bound provider fixture, 그 fixture를 바라보는
Next.js를 시작한다. Set의 세 query를 각각 one-shot `load-smoke`로 실행하고 매번
fixture를 재시작해 fresh stats를 report에 결속한다. 이후 다음 형식으로 세 report를
반복해 넘긴다.

`npm run eval:search-quality -- --set <set.json> --expected-target-revision <git-sha> --report <query-id>=<v5.json>`

Expected target revision은 policy 유무와 무관하게 모든 report에 대조한다. 정상
deterministic wiring은 exit 0이어도 release `not-applicable`이다. Known-item identity,
topic judgment order, query transport가 exact하지 않으면 wiring evidence도 실패한다.

Bounded-live set은 synthetic provenance와 provider fixture evidence를 사용할 수 없다.
Policy field가 존재한다는 사실도 승인이나 신뢰된 실행을 증명하지 않는다. 승인된
수치·표본과 protected collection/attestation, dated readiness record가 모두 생긴 뒤에만
별도 release owner가 `go`를 만들 수 있다. Identifier 의미와 arXiv·PMID 범위는
[#717](https://github.com/jaeyoungkang/lighthouse/issues/717)이 소유한다. Result는 aggregate와
입력 reference의 단방향 `sha256:` projection만 출력한다. v1의 set·policy·rollout field
shape는 유지하되 해당 값은 원문이 아니다. Query ID를 포함한 입력값은 finding에 싣지 않으며
raw query·paper identity가 든 v5 report는 계속 local-only다.

## 승인 전 decision packet

`decision-packet.ts`는 bounded-live 수집을 구현하기 전에 빠짐없이 확정해야 하는 정책
입력을 검사한다. 근거는 Moonlight Research의
[bounded-live 검색 평가 정책 사전 조사](https://github.com/corca-ai/moonlight-research/blob/bbb2e0090fed2fc9c79e3cca82479d5e8320fc6e/research/scholar-search-policy/2026-09-01-bounded-live-evaluation-policy-research.md)다.
이 자료는 proposal이며 Lighthouse의 제품 계약이나 출시 판정을 직접 바꾸지 않는다.

Packet은 다음 열한 결정을 각각 `pending` 또는 content-addressed `resolved` reference로
구분한다.

- query strata와 분포
- 평가 source·privacy·표본 산정 근거
- canonical paper identity·alias·version 관계
- topic rubric·assessor·이견 조정·judgment coverage
- known-item와 topic cutoff·반복 순위 처리
- 네 metric의 threshold 방식과 값
- uncertainty·tie·missing·attrition 처리
- provider·corpus·index identity
- freshness와 변경 기반 무효화
- pause·rollback·resume·known-good·재개 조건
- raw evidence retention과 aggregate 공개 범위

Human, Operational Readiness, evaluation methodology, privacy/security, pause, rollback,
resume 책임은 하나의 authority assignment graph에 둔다. Methodology와 privacy/security는
이 packet에서 빠지면 안 되는 검토 책임을 뜻하며, Lighthouse 조직의 새 mandate를 만든다는
뜻이 아니다. Human과 Operational Readiness가 기존 owner에게 맡길지 별도 담당자를 둘지
결정할 때까지 해당 assignment와 signoff는 `pending`이다.

같은 canonical principal reference가 여러 책임을 맡으면 그 principal의 전체 정렬 role
set과 정확히 일치하는 전역 overlap 결정 하나가 필요하다. 역할 영역마다 별도 overlap
boolean을 두지 않는다. Overlap approver도 같은 graph의 지정된 책임과 principal에
결속하고, overlap 및 네 signoff는 각 승인 payload digest로 decision reference·시각·graph와
body identity를 고정한다. Overlap 승인은 자기 `approvalSha256`만 제외한 immutable body
projection 전체를 결속하므로 lifecycle·createdAt 변경에도 재사용할 수 없다. Principal
registry와 revocation basis도 graph digest에 포함한다.

Reference ID는 raw query·paper ID·이름·이메일을 담을 수 없는 고정 길이 opaque token만
허용한다. Body와 graph digest는 `json-object-keys-lexicographic-utf8-v1`로 이름 붙인 UTF-8
canonical serialization을 사용하며, 조사 근거는 위 commit·path와 현재 파일 SHA-256의
정확한 tuple로 고정한다.

`structurally-complete-unverified`는 필수 슬롯, assignment graph, overlap 결정, 네
signoff의 로컬 구조와 digest·시간 순서만 맞는다는 뜻이다. Principal alias, registry 내용,
revocation과 approval 진위는 local parser가 알 수 없으므로 향후 protected verifier가
확인한다. 그 전에는 referenced content, principal registry, approval이 계속 `unavailable`이고
execution·currentness·attestation·release authority는 모두 `false`다. 실제 threshold, K,
provider, corpus, 담당 principal을 이 모듈이 선택하지 않으며, 기존
`SearchQualityReleasePolicy` v1으로 자동 materialize하지도 않는다. 기존 evaluator 결과 v1,
deterministic `not-applicable`, bounded-live `no-go`, local synthetic workflow와 Matrix
52–54의 `unresolved` 상태도 바뀌지 않는다.

## Local synthetic candidate evidence

`.github/workflows/search-quality-evidence.yml`은 protected `main`의 exact target에서만
수동 실행한다. 실제 `/search` 세 report를 runner-local로 수집하며 exact loopback base URL,
request path와 redirect 뒤 final URL을 함께 검증한다. 수집 process와 DB를 종료한 뒤 target
code가 raw byte digest와 aggregate를 다시 계산해 명시된 candidate·self-check 두 파일만 14일
보존한다. Raw query·paper identity는 artifact로 올리지 않는다.

이 로컬 self-check에는 attestation·execution·currentness·release authority가 모두 없고 release는
`not-applicable`이다. 외부 attestor repository·protected Environment·HMAC key는 구성하지 않는다.

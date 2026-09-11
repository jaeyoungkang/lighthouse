# Deferred Verification Triggers

이 문서는 지금 당장 들여오지 않는 검증 아이디어의 트리거를 보관한다. 현재
프로토타입은 Evidence Ledger runner와 Story Chain validator를 직접 강화하는
쪽을 선택한다.

## Adapter Protocol

지금은 strict YAML v2의 폐쇄형 `vitest`, `contract-check`, `guard`,
`registered-script` execution을 binary와 argv로 컴파일한다. Adapter protocol은
아래 중 하나가 발생하면 도입한다.

- 세 개 이상의 Evidence Ledger가 exit code를 넘어 같은 구조화 입력·출력이나
  artifact 회수를 필요로 한다.
- 서로 무관한 registered script가 반복 추가되어 폐쇄형 registry가 사실상
  범용 실행 wrapper가 된다.
- `contract-check` registry가 서로 무관한 protocol을 흡수해 typed result와
  artifact identity를 안정적으로 표현하지 못한다.

도입 시 원칙: ledger는 `adapter:name`과 입력만 선언하고, adapter는
NDJSON이든 typed function이든 repo-owned protocol로 결과를 반환한다.
사람이 읽는 HTML/JSON report를 되살리는 목적은 아니다.

## Alloy-Style Model Checking

현재 cardinality는 직접 count validation으로 충분하다. Alloy-style model
checking은 아래 중 하나가 발생하면 도입한다.

- H/A/E/S authority, verdict, removal workflow가 단순 count가 아니라
  상태 전이 조합의 불가능성을 증명해야 한다.
- cycle, transitive closure, mutually exclusive transition 같은 불변식이 세
  개 이상의 테스트나 validator 분기로 반복된다.
- Story Chain 변경 중 “가능해 보이지만 실제로는 불가능해야 하는 상태”가
  두 번 이상 회귀한다.
- cardinality policy가 `1 -> 1..*` 같은 직접 관계 수를 넘어 조건부 관계,
  reachability, acyclic graph를 요구한다.

도입 시 원칙: Alloy model은 Story Chain의 보조 증명 도구다. Promise와
Evidence Ledger의 정본 의미를 대체하지 않는다.

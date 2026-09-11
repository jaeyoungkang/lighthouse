# API 오류 응답과 클라이언트 복구

이 문서는 Light House API가 실패 의미를 전달하고 클라이언트가 다음 행동을
결정하는 공통 절차를 소유한다. 요청 진입 전 인증·body·schema·admission 순서와
상한은 `route-ingress-policy.json`이 소유한다. 이 문서는 그 결과를 포함한 HTTP
응답 의미와 재시도 경계를 다룬다.

## 정본

- `app/domain/api-error-contract.ts`: status fallback과 stable action
- `app/server/http/api-error-response.ts`: 서버 오류 envelope와 `Retry-After`
- `app/lib/api-error-response.ts`: 브라우저 응답 검증과 backoff 해석
- `app/server/operational/api-response-contract.json`: 19개 route의 success,
  degraded success, correctable/auth/conflict/overload/transient inventory
- `scripts/quality/check-api-response-contract.mjs`: 모든 `app/**/route.ts`를 스캔해
  inventory와 route drift를 차단. redirect-only `app/auth/confirm/route.ts`는 이
  guard에 이유·책임 owner·재검토 조건을 갖춘 명시적 예외로 등록한다.

`ERROR_CATALOG`는 제품·domain 오류 코드와 사용자 메시지의 정본으로 유지한다.
`AppError`를 HTTP로 옮길 때 catalog의 `httpStatus`와 `retryable`을 envelope에
연결한다. Route-local validation과 모든 HTTP status를 Error Catalog에 등록하지는
않는다.

## 서버 응답

오류 응답은 기존 client 호환 필드인 `error`를 유지하고 다음 필드를 함께 보낸다.

```json
{
  "error": "사용자 또는 호출자에게 보여 줄 메시지",
  "code": "STABLE_MACHINE_CODE",
  "action": "correct-request",
  "retryable": false
}
```

Route가 필요한 진단 metadata를 더할 수 있지만, client 제어 흐름은 `error`
문자열을 비교하지 않는다. `429`는 body의 `retryAfterSeconds`와 HTTP
`Retry-After`를 같은 값으로 보낸다. 예상하지 못한 route 오류는 기록한 뒤
`API_INTERNAL_ERROR` retryable `500`으로 닫는다. Public telemetry의 `204` 흡수
계약은 예외이며 inventory에 `absorbed-204`로 선언한다.

Moonlight Scholar 인증 API처럼 기존 `error: { code, message }` consumer가 있는
경로는 그 중첩 필드를 보존하고 stable `code`, `action`, `retryable`을 최상위에
추가한다. 공통 client parser는 문자열과 이 중첩 호환 형태를 모두 읽는다.

| status | action | 같은 payload 자동 반복 |
| --- | --- | --- |
| `400`, `422` | `correct-request` | 금지 |
| `401` | `authenticate` | 금지 |
| `403` | `request-permission` | 금지 |
| `404`, `410` | `clear-missing-state` | 금지 |
| `409` | `refresh-and-rebase` | 최신 상태를 읽은 뒤 새 command 판단 |
| `413` | `reduce-request` | 금지 |
| `429` | `wait-and-retry` | `Retry-After`와 attempt budget 안에서만 허용 |
| `5xx` | `retry` | idempotency와 attempt budget 안에서만 허용 |

`ERROR_CATALOG`가 같은 `5xx` status를 non-retryable로 선언하면 catalog의 결정이
우선하며 action은 `stop`이다. 이 예외도 envelope에 명시되므로 client는 status만
보고 반복하지 않는다.

## 클라이언트 결정 순서

1. Non-2xx body를 읽어 stable envelope인지 검증한다.
2. 검증되면 body의 `code`와 메시지를 읽되, status가 허용하는 action과
   retryability보다 넓은 권한은 주지 않는다. 예를 들어 body가 `400/retryable`
   이라고 주장해도 같은 payload를 반복하지 않는다.
3. `5xx` body가 non-retryable Error Catalog 결정을 선언하면 더 보수적인
   `stop`으로 좁힐 수 있다.
4. 이전 배포처럼 envelope가 없으면 status fallback을 사용한다.
5. `Retry-After`는 초 또는 HTTP date를 읽고 기본 최대 60초로 제한한다. 단,
   `GAP_BUILD_PRINCIPAL_ADMISSION_LIMIT`은 서버의 bounded admission lease와 같은
   최대 120초를 보존해 UI가 lease 만료 전에 command를 다시 열지 않게 한다.
6. 실제 transport가 idempotency, attempt 수, 전체 deadline을 확인한 뒤에만
   재시도한다. 공통 parser는 요청을 직접 반복하지 않는다.

Transport loss와 timeout은 서버가 commit했는지 알 수 없는 별도 상태다.
읽기·idempotent 보강은 bounded retry할 수 있다. Non-idempotent write는 server
rejection과 응답 유실을 구분하고, 응답 유실에는 read-back 또는 idempotency
identity가 있을 때만 다시 보낸다.

## 현재 자동 복구 owner

- Search card hydration과 graph-neighbor hydration은 최대 3회다. `429`, `5xx`,
  timeout, transport loss만 예산을 사용한다. Terminal status는 첫 응답에서
  lightweight 결과를 보존한 terminal ready로 닫는다.
- Spelling correction은 best-effort 침묵을 유지한다. `400/401/403/413/422`는
  해당 execution에서 해결된 terminal 결과로 기억한다. `429`, `5xx`, timeout,
  transport loss, malformed success만 다음 mount에서 다시 평가한다.
- Gap reaction write는 `422`를 terminal rejection으로 닫는다. `409`는 현재
  viewer preference를 한 번 읽고 최신 `reactionVersion`에서 새 command를 보낸다.
  `5xx`와 transport loss는 commit 여부가 모호하므로 기존 bounded same-payload
  retry와 read-back을 사용한다.
- Gap build command의 `GAP_BUILD_PRINCIPAL_ADMISSION_LIMIT` 429는 같은 principal의
  다른 report 계산이 active임을 뜻한다. 새 report의 detached 창은 metadata의
  `activeGapReportId`로 현재 계산 화면을 열어 상태와 저장 결과를 계속 보여 준다.
  Enrichment retry는 현재 core graph를 유지하고 안내를 표시한다. 어느 경로도
  `Retry-After`만으로 command를 자동 반복하지 않는다.
- Inline analysis는 이 공통 envelope를 받더라도 durable claim/cooldown과 사용자
  explicit retry 계약이 재시도 권위다. 공통 parser가 provider 호출을 자동으로
  다시 열지 않는다.

## Degraded 2xx

Degraded success는 HTTP failure가 아니다. Library bootstrap의 unavailable,
route AI comment의 `reaction:null`, spelling correction의 `correctedQuery:null`,
search/graph의 lightweight terminal metadata처럼 route payload가 제한된 결과와
완료 상태를 명시한다. Client는 이를 오류 envelope로 파싱하거나 transport
재시도로 바꾸지 않는다.

## 변경 규칙

Route 추가·삭제, status/code/action, degraded payload, `Retry-After`, client attempt
budget, write idempotency 또는 read-back 순서가 바뀌면 이 문서와
`api-response-contract.json`, 관련 route/client test를 같은 변경에서 갱신한다.
API response/retry Architecture Fitness lens는 현재 활성 profile이 없으므로
machine verdict는 `unknown`이다.

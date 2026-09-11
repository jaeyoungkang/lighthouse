# LLM 요청 안전장치 감사 — 2026-07

이 문서는 #239 감사 리포트다. 코드 경로를 점검해 현재 LLM 요청 안전장치와
우선순위 gap을 남긴다. Story Chain 정본은 아니다. 사용자-facing 의미가 바뀌는
gap만 별도 Mission Control 작업으로 승격한다.

## 감사 범위

LLM 호출은 `app/server/ai-generation/gateway.ts`의 structured generation 관문을 지난다.
직접 호출자는 route AI comment 생성과 `executeJudgment` 두 축이다. 검색 용어 추출,
맞춤법 교정, 인라인 분석, gap narrative 계열은 `executeJudgment`를 경유한다.

## 인벤토리

| # | 카테고리 | 상태 | 근거 |
| --- | --- | --- | --- |
| 1 | Timeout | 있음 | gateway는 request timeout과 AbortController deadline을 함께 건다. route AI comment는 10초 structured generation deadline과 15초 client timeout을 쓴다. |
| 2 | Retry | 꺼짐 | OpenAI branch는 `maxRetries: 0`, Gemini branch는 `retryOptions: { attempts: 1 }`를 쓴다. |
| 3 | Rate limit / concurrency | 부분 | route AI comment는 process-local in-flight coalescing을 한다. 인증 사용자 요청량 cap은 없다. |
| 4 | 입력 크기 제한 | 있음 | `viewSnapshotSchema`와 route request schema가 snapshot 입력을 제한한다. |
| 5 | 출력 bound | 있음 | route AI comment는 768 max output token cap, title/body/chips schema, runtime trim을 함께 쓴다. |
| 6 | 비용 가시성 | 있음 | gateway가 provider usage를 정규화하고, known Gemini model은 `costUsdMicros`를 계산한다. route AI comment provider 결과는 prompt/output 없이 `after()` 예약 best-effort insert로 `lighthouse.llm_usage_events`에 append되어 `/admin/llm-usage` 누적/최근 report로 읽힌다. |
| 7 | Hard cost cap | 보류 | 정상 사용량이 작고 기존 timeout/output cap이 있어 daily budget enforcement는 현재 복잡도 대비 이득이 작다. |
| 8 | 에러 처리 / fallback | 있음 | provider timeout, abort, invalid output, no-output은 `reaction:null` 또는 caller fallback으로 닫는다. |
| 9 | 인증 / 남용 | 인증 있음, parse-before-auth gap 있음 | route AI comment route는 현재 사용자 인증 뒤 generation을 진행한다. 다만 raw JSON body parse는 auth보다 먼저 실행되므로 schema 제한은 oversized unauthenticated body parse 자체를 막지 못한다. |
| 10 | Dedup / idempotency | 부분 | route AI comment in-flight dedupe는 같은 인스턴스 안에서 중복 provider call을 줄인다. cross-instance 총량 dedupe는 없다. |
| 11 | 출력 검증 | 있음 | route AI comment는 JSON parse 후 domain schema를 통과한 title/body/chips만 반영한다. |

## 우선순위

1. 비용 가시성은 route AI comment durable usage event와 console observation으로 닫는다.
   운영자는 `/admin/llm-usage`에서 `inputTokens`, `outputTokens`, `totalTokens`,
   `reasoningTokens`, `cachedInputTokens`, `costUsdMicros`를 누적/최근 window로 관측할 수 있다.
2. hard cost cap은 지금 만들지 않는다. 비정상 사용 증거가 쌓이기 전에는 hot path
   DB counter와 budget gate가 시스템을 불필요하게 복잡하게 만든다.
3. 요청량 남용은 cost cap보다 rate limit / abuse guard로 다루는 편이 맞다. 같은
   사용자의 반복 호출이 실제로 비용을 올린다는 관측이 생기면 별도 작업으로 연다.
4. auth 순서 조정은 낮은 우선순위지만 schema 제한으로 닫힌 위험은 아니다. 현재 route는
   raw JSON body를 auth 전에 parse한다. public attack surface가 커지거나 oversized
   body 시도가 관측되면 auth-first parse 구조, body size guard, source-window abuse guard를
   함께 본다.

## 재검토 트리거

- route AI comment generation 비용 telemetry가 `/admin/llm-usage`에서 사용자별 또는 전체 기준으로 급증한다.
- 멀티 인스턴스 상시화와 함께 in-flight dedupe 희석으로 provider call 수가 늘어난다.
- 새 LLM feature가 route/view fan-out으로 추가되어 현재 structured generation 상한을 벗어난다.
- `priced:false` 또는 `costUsdMicros:null` observation이 반복된다. missing pricing warning은
  model별 process-local 1회 warning이므로 빈도 증거가 아니라 발견 신호로만 쓴다.

## 결론

현재 결정은 usage/cost metering과 운영 관측까지다. route AI comment는 append-only DB
event를 durable source로 쓰되 provider 결과 없이 throw된 실패 시도는 usage row로 세지
않는다. 일별 aggregate counter와 budget enforcement는 구현하지 않는다. 비용 문제가 실제
운영 증거로 드러나면 관측값을 기준으로 rate limit / abuse guard, provider fan-out
control, hard cap 재검토 순서로 판단한다.

# Light House 온보딩

이 문서는 처음 클론한 기여자가 프로젝트를 실행하고, 구조를 이해하고, 첫 작업을
시작하기 위한 짧은 경로다. 자세한 제품 규칙과 운영 절차는 각 정본 문서를 따른다.

## 1. 로컬 도구 설치

필수 도구:

- Node.js 20 이상
- npm
- Docker Desktop 또는 호환 Docker daemon
- Supabase CLI

의존성을 설치한다.

```bash
npm install
```

온보딩 체크를 실행한다.

```bash
npm run onboard:check
```

이 명령은 로컬 도구, `.env.local`, Docker 실행 상태, Supabase 로컬 포트를
확인한다.

## 2. 로컬 DB 시작

Light House는 로컬 개발에서 Supabase를 사용한다. Supabase는 Docker 컨테이너로
Postgres, Auth, Storage, Studio, 이메일 inbox를 실행한다.

Docker를 먼저 켠 뒤 Supabase를 시작한다.

```bash
supabase start
```

DB를 migration 기준으로 다시 만들어야 하면 다음 명령을 실행한다.

```bash
npm run db:reset:local
```

예상 로컬 서비스:

| 서비스 | 위치 |
| --- | --- |
| API | `http://127.0.0.1:54321` |
| Postgres | `127.0.0.1:54322` |
| Studio | `http://127.0.0.1:54323` |
| Email inbox | `http://127.0.0.1:54324` |

`supabase status`를 실행해 local anon key와 service_role key를 확인한다. 이 값을
`.env.local`에 넣어야 앱과 서버 코드가 같은 로컬 DB를 본다.

## 3. 환경 변수 설정

`.env.local`을 만든다.

```bash
cp .env.local.example .env.local
```

로컬 Docker Supabase 기준 필수 값:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase status의 local anon key>
SUPABASE_SERVICE_ROLE_KEY=<supabase status의 service_role key>
```

선택 값:

- 외부 초대 이메일은 환경변수가 아니라 `lighthouse.access_allowlist_entries`와
  내부 `/admin/access`에서 관리한다. 기존 `LIGHTHOUSE_ALLOWED_EMAILS` 값은 배포
  전에 DB에 입력한다. 새 runtime은 이 값을 읽지 않지만 구 revision rollback
  window가 닫힐 때까지 설정 자체는 보존한다. `@corca.ai` 사용자는 외부
  allowlist와 무관하게 항상 접속 가능하고 admin으로 취급된다.
- `GOOGLE_GENERATIVE_AI_API_KEY`: Vercel AI SDK 기반 상위 에이전트 경로
- `GEMINI_API_KEY`: `@google/genai` 직접 호출 경로

기존 외부 초대 이메일을 DB-only 정책으로 전환할 때는 migration 적용 뒤 app
배포 전에 SQL Editor에서 현재 값을 입력하고 건수를 확인한다.

```sql
insert into lighthouse.access_allowlist_entries (email, updated_by)
values
  ('pilot@example.com', 'admin@corca.ai')
on conflict (email) do update
set updated_by = excluded.updated_by,
    updated_at = now();

select email
from lighthouse.access_allowlist_entries
order by email;
```

`updated_by`에는 실제 이관을 수행한 `@corca.ai` 이메일을 쓴다. 현재 환경변수
목록과 조회 결과가 일치한 뒤 app을 배포한다. 새 revision 안정화와 구 revision
rollback window 종료를 확인한 뒤에만 `LIGHTHOUSE_ALLOWED_EMAILS` 설정을
제거한다. 그 전에 rollback해야 하면 설정값이 여전히 유효한지 먼저 확인하고 구
revision으로 전환한다.

## 4. 프로젝트 이해

처음에는 아래 순서로 읽는다.

1. `docs/product-identity.md`
2. `docs/project-knowledge/README.md`
3. `docs/implementation.md`

`docs/implementation.md`에서 수정할 runtime zone과 obligation을 찾고, 연결된
원리·코딩 규칙·상태·runtime-flow 정본만 추가로 읽는다.

사용자-facing 동작, Promise, 계약, 의도, AC, Evidence Ledger를 바꾸는 작업이면
추가로 읽는다.

1. `docs/mission-control.md`
2. `docs/contracts/story-chain/README.md`

## 5. 작업 시작

agent와 함께 작업하는 세션에서는 먼저 Project Knowledge를 로드한다.

```bash
npm run pk:start
```

앱을 실행한다.

```bash
npm run dev
```

PR 형태의 일반 변경 전 로컬 검증:

```bash
npm run quality:fast
```

Story Chain 문서만 바꾼 경우에도 contract closeout 정본 alias로 닫는다 —
게이트 목록은 `package.json`의 alias 정의가 소유하므로 일부만 골라 돌리지
않는다(issue #193):

```bash
npm run quality:contract
```

## 6. 작업 루프

- 사용자-facing 동작은 Promise, Aspect, Evidence Ledger, code, test를 같은 변경
  안에서 닫는다.
- runtime 처리 순서가 바뀌면 `docs/runtime-flows/`도 함께 갱신한다.
- 작업 기억은 기본적으로 로컬에 둔다. 이어받을 맥락은 `npm run pk:remember --
  --note "<한국어 narrative>"`로 남긴다.
- repo 차원의 반복 판단만 Project Knowledge review를 거쳐 공유 기억으로
  승격한다.

## 7. 로컬 생성물 정리

테스트와 운영 레일이 만드는 로컬 파일은 Git에 포함되지 않지만 자동으로 모두
사라지지는 않는다. `coverage/`는 언제든 다시 만들 수 있는 검사 결과이고,
`reports/load-smoke/`는 실행할 때마다 최신 10개 JSON 보고서만 유지한다. 현재
`storage/pdfs/`는 활성 애플리케이션 경로가 쓰지 않는 과거 내부 PDF 저장물과 timing
probe 파일이지만, 필요한 로컬 조사 증거일 수 있으므로 기본 정리 대상이 아니다.

먼저 삭제 예정 항목만 확인한다.

```bash
npm run clean:artifacts
```

생성된 coverage와 오래된 load-smoke 보고서에 정리를 적용한다.

```bash
npm run clean:artifacts -- --apply
```

과거 로컬 PDF 저장물까지 초기화하려면 데이터가 불필요한지 확인한 뒤 명시적으로
포함한다. 이 옵션은 `storage/` 전체가 아니라 현재 확인된 `storage/pdfs/`만 지운다.

```bash
npm run clean:artifacts -- --apply --include-pdf-storage
```

이 명령은 repo 밖을 따라가는 심볼릭 링크나 정해진 디렉터리가 아닌 경로를 삭제하지
않는다.

# Light House

Light House는 학술 논문 탐색을 돕는 문서 document collection다. 연구자가 검색, 읽기,
gap 찾기를 주도하고, 시스템은 현재 document collection 맥락에 짧고 구조화된 코멘트로
반응한다.

## 최초 클론

먼저 의존성을 설치한다.

```bash
npm install
```

로컬 개발은 Docker 위의 Supabase DB를 사용한다. Docker를 실행한 뒤 Supabase
로컬 서비스를 띄운다.

```bash
supabase start
```

필요하면 migration 기준으로 로컬 DB를 다시 만든다.

```bash
npm run db:reset:local
```

`supabase status`에서 local anon key와 service_role key를 확인해 `.env.local`에
넣는다. 기본 로컬 URL은 다음과 같다.

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
```

설정 상태를 확인한다.

```bash
npm run onboard:check
```

자세한 최초 셋업과 작업 루프는 `docs/onboarding.md`를 읽는다.

## 로컬 DB

Supabase는 Docker 컨테이너로 Postgres, Auth, Storage, Studio, 이메일 inbox를
실행한다.

| 서비스      | 위치                     |
| ----------- | ------------------------ |
| API         | `http://127.0.0.1:54321` |
| Postgres    | `127.0.0.1:54322`        |
| Studio      | `http://127.0.0.1:54323` |
| Email inbox | `http://127.0.0.1:54324` |

DB가 떠 있지 않으면 로그인, 문서 저장, PDF 저장, document collection state 검증이 정상
동작하지 않는다.

## 일상 작업

```bash
npm run pk:start
npm run dev
npm run quality:fast
```

주요 문서:

- `docs/onboarding.md` - 최초 셋업과 작업 루프
- `docs/product-identity.md` - 제품 정체성
- `docs/project-knowledge/README.md` - Project Knowledge 운영
- `docs/implementation.md` - 구현 위치, workflow owner, 완료 순서의 단일 진입점
- `docs/mission-control.md` - Story Chain 운영 모델

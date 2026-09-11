# Inline-analysis cache retention runbook

이 문서는 inline-analysis shared cache의 operator 실행 절차와 dated baseline을
소유한다. 운영 상태와 rollout 판정은
[`docs/operational-readiness.md`](../operational-readiness.md)의
`inline-analysis-shared-cache` 등록 행이 소유하고, cache lifecycle policy는
[`docs/architecture-fitness/q5-cache-policy.md`](../architecture-fitness/q5-cache-policy.md)가
소유한다.

Issue #305의 storage lifecycle은 current version의 모든 fingerprint와 명시적인 rollback
version을 보존한다. 그 밖의 `ready`, `version < current`, rollback 목록 밖, 최소 30일 이전
identity만 DB operator가 정리한다. `pending`, current/future, rollback version은 age와 무관하게
제외한다. Version 8의 현재 rollback version은 7이며 2026-08-16까지 보존한다.

Migration `00021_inline_analysis_cache_retention.sql`의 maintenance function은 호출당 한 삭제
version만 받고 기본 200, 최대 500 rows를 `FOR UPDATE SKIP LOCKED`로 처리한다. Runtime role과
scheduled job에는 execute를 주지 않는다. Operator는 한 batch를 다음 timeout transaction으로
실행한다.

Cleanup은 `ready` row 삭제만 수행하며 cache claim·lease·provider generation 경로에서 호출되지
않는다. Lock/statement timeout, operator 중단 또는 함수 오류가 나면 해당 maintenance
transaction만 rollback된다. `pending` 전이나 miss 신호를 만들지 않으므로 cleanup 실패가
provider stampede로 전파되지 않는다. 첫 batch 전에 baseline에서 cutoff timestamp를 하나의
literal로 고정한다. 오류·취소 시에는 실패한 transaction을 `ROLLBACK`하거나 연결을 닫은 뒤,
같은 version과 같은 literal cutoff로 batch를 다시 실행한다.

```sql
\set ON_ERROR_STOP on
\set cleanup_cutoff '2026-07-01T00:44:32Z'

begin;
set local lock_timeout = '1s';
set local statement_timeout = '5s';
select lighthouse.cleanup_paper_inline_analysis_cache(
  8,
  array[7],
  3,
  :'cleanup_cutoff'::timestamptz,
  200
);
commit;
```

Aggregate-only baseline은 paper id, prompt, analysis, principal을 출력하지 않는다. Migration
`00020` 이전 schema는 `legacy-principal-cache`로 표시하며 그 수치를 shared-cache 삭제 근거로
사용하지 않는다.

```bash
psql "$DATABASE_URL" -X \
  --set current_version=8 \
  --set preserved_versions_csv=7 \
  --set cleanup_age_days=30 \
  --file scripts/architecture-fitness/inline-analysis-cache-storage-baseline.sql

eval "$(supabase status -o env)"
psql "$DB_URL" -X --set local_smoke=1 \
  --file scripts/architecture-fitness/inline-analysis-cache-retention-smoke.sql
```

Production deployment `5450077796`은 application revision
`4f6c2513b17442fe7ad3b300badd67ff03f9b9d7`을 2026-07-15T01:01:18Z에 배포했다.
2026-07-15T01:36:04Z post-migration baseline은 migration state `00022`에서 3,739 `ready`,
0 `pending`, 8,728 kB relation을 확인했다. Database는 25,635,987 bytes였고
`pg_size_pretty`가 24 MB로 반올림해 표시했다. Approximate ready는 6,952,280 bytes
(6,789 kB, database의 27.12%)였다.
최근 30일은 1,041 rows와 2,080,728 bytes(2,032 kB, 8.12%)였고, 3,704 papers의
identity p95는 1,
최대값은 2였다. Version별 rows는 v7 23, v6 2,780, v5 333, v4 222, v3 381이다.
현재 eligible row는 0이다. v3~v5의 관측된 최신 `updated_at` 이후 30일이 되는
2026-07-31T00:44:32Z 뒤 #319에서 다시 측정한다. 그때도 current 8, rollback `[7]`,
cutoff 30일, batch 200을 유지하고 v3, v4, v5를 각각 별도 호출한다.

Approximate ready bytes/database 10%, 최근 30일 ready bytes/database 5%, paper별 identity p95
2 초과 또는 최대 8 초과에서 cadence와 rollback window를 다시 검토한다. Relation size가 두
번의 vacuum 뒤에도 database size의 15% 이상이면 bloat maintenance를 연다. 배포 직후와
cleanup 전후, 첫 4주간 매주, 이후 매월 같은 aggregate를 exact application revision과
migration state에 연결한다.

2026-07-15에 production의 `00016`~`00022` schema·function·ACL 효과를 확인했다. Migration
SQL은 재실행하지 않고 remote migration ledger만 `00022`까지 `applied`로 정합화했다.
후속 `supabase migration list`는 local/remote가 `00022`까지 일치했다. Retention function은
runtime/service role에 execute 권한이 없고, atomic owner-principal backfill은 service role만
실행할 수 있다. #319의 cutoff 뒤 cleanup 전후 DB lock/5xx·baseline evidence와 #321의
multi-instance evidence가 남아 있었다. 2026-07-15 확인 당시 등록부 상태는
`evidence-needed`였으며, 현재 상태는
[`inline-analysis-shared-cache` 등록 행](../operational-readiness.md#현재-등록부)에서
확인한다.

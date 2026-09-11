# Engineering Health와 System Topology Health 구조 검토

- 상태: 구조 검토 완료. 구현·측정 미착수
- 작성일: 2026-07-10
- 추적 이슈: [#267](https://github.com/jaeyoungkang/lighthouse/issues/267)
- 범위: Vercel serverless runtime, service dependency, critical request path를 제품 밖에서 관리하는 Engineering Health control plane
- 성격: 구현 전 구조 리포트. 코드, CI, DB, 제품 동작을 변경하지 않는다.

## 결론

Engineering Health는 제품 밖의 control plane으로 둔다. 같은 repository의 비제품 영역에서
시작하되 product runtime과 단방향으로 분리한다.

이 control plane의 중심은 generic complexity dashboard가 아니다. 현재 Vercel serverless node,
Episteme·Supabase·AI provider edge, 향후 Moonlight server edge, 사용자 critical request path를
명시하고 각 node·edge·path의 health evidence를 연결하는 **System Topology Health**다.

코드 복잡도와 CI 비용은 이 topology를 만들고 변경하는 Engineering Health의 다른 축으로 남긴다.
서로 다른 값을 한 점수로 합치지 않는다.

초기 surface는 GitHub Job Summary와 normalized artifact다. 제품 `/admin` 화면, 제품 DB, product
analytics event, 별도 repository/package, 새 Promise, 새 skill은 만들지 않는다.

## 범위

이 문서는 구조만 결정한다.

- metric collector를 구현하지 않는다.
- 현재 시스템의 건강도나 production 성능에 verdict를 내리지 않는다.
- 새 runtime instrumentation을 추가하지 않는다.
- 새 CI blocking gate나 threshold를 만들지 않는다.
- 외부 장기 저장소와 dashboard 제품을 선택하지 않는다.
- Episteme나 Moonlight API contract를 변경하지 않는다.

현재 코드와 운영 문서는 topology와 evidence owner를 파악하는 배경 근거다. 실제 측정, baseline,
connector, rollout은 별도 작업이다.

## 용어

용어를 다음처럼 분리한다.

| 용어 | 다루는 대상 |
| --- | --- |
| Engineering Health | code, delivery, system topology health를 함께 관리하는 상위 control plane |
| Code Health | complexity, dependency, duplication, test·coverage·mutation evidence |
| Delivery Health | CI, build, deploy duration과 실패 상태 |
| Deployment Topology | Vercel deployment, region, serverless function, instance 수명 |
| Service Dependency Topology | Vercel runtime이 호출하는 Episteme, Supabase, AI provider, Moonlight server 관계 |
| Critical Request Path | 사용자 요청이 node와 edge를 지나 결과에 도달하는 순서와 병렬 구간 |
| System Topology Health | deployment node, service edge, request path의 성능·용량·실패 상태 |

`Infrastructure Health`는 external application service를 충분히 설명하지 못한다. `Architecture
Health`는 코드 구조까지 포함해 범위가 넓다. 이 문서는 배포와 service 관계를 가리킬 때
`System Topology Health`를 사용한다.

## 현재와 계획 topology

현재와 계획된 service graph는 다음 모양이다.

```text
Browser
   |
   v
Vercel / Next.js Serverless
   |
   +--> Episteme                 active
   +--> Supabase                active
   +--> AI Providers            active
   +--> Moonlight Server        planned
```

이 diagram은 실행 순서를 뜻하지 않는다. 실제 순서와 병렬 구간은 runtime-flow가 소유하며,
Critical Path catalog는 그 정본을 projection한다.

### Node

node는 독립된 runtime 또는 managed service다.

- browser client
- Vercel deployment와 serverless function family
- Episteme
- Supabase
- AI provider
- Moonlight server

### Edge

edge는 한 node가 다른 node를 호출하는 contract boundary다.

- browser → Vercel route
- Vercel → Episteme
- Vercel → Supabase
- Vercel → AI provider
- Vercel → Moonlight server

edge health에는 latency뿐 아니라 auth, timeout, retry, concurrency, payload, fallback, data
classification이 포함된다.

### Path

path는 사용자가 체감하는 end-to-end 작업이다.

- 빈 search entry 렌더
- query search와 first result reveal
- citation·similar follow-up
- route-view AI comment generation
- gap report 예약·background build·ready 관찰
- 향후 Moonlight context를 포함하는 작업

path는 edge를 직렬 목록으로만 표현하지 않는다. 병렬 fan-out, background handoff, persisted job,
degraded completion을 함께 기록한다.

## 제품 밖에 두는 이유

Engineering Health는 product source와 운영 evidence를 read-only로 읽는다. 제품은 Engineering
Health를 import하거나 호출하지 않는다.

```text
Product runtime / CI / provider dashboards
                    |
                    v read-only evidence
          Engineering Health control plane
                    |
                    v
      GitHub Summary / normalized artifact
```

초기 구조는 다음 경계를 지킨다.

- `app/**`가 `scripts/engineering-health/**`를 import하지 않는다.
- Engineering Health가 제품 DB나 analytics sink에 write하지 않는다.
- PR과 fork에는 production read·write credential을 주지 않는다.
- trusted main 또는 schedule만 external aggregate evidence를 읽을 수 있다.
- product service-role credential을 collector에 재사용하지 않는다.
- 필요한 runtime evidence가 없으면 `missing`으로 남기고 instrumentation 작업을 별도로 연다.

## System topology가 지켜야 할 구조

### Serverless instance는 fleet이 아니다

Vercel function instance의 memory, cache, queue, circuit breaker, in-flight dedupe는 process-local이다.
한 instance의 상태를 fleet 전체 상태로 해석하지 않는다.

topology evidence는 가능한 범위에서 deployment id, function, region, instance 또는 aggregation
window를 구분한다. fleet concurrency와 provider allowance를 per-instance limit의 단순 합으로
추정하지 않는다.

### Deadline budget은 path와 edge가 나눠 가진다

route `maxDuration`은 request-bound path 상한이다. 그 안에서 실행되는 external edge는 route보다
작은 timeout·queue·retry budget을 가져야 한다. request-bound 직렬 edge의 timeout 합이 route
deadline보다 커지는 구조를 건강하다고 표시하지 않는다.

background-handoff edge는 route deadline 안에 durable handoff를 끝내고, 이후 작업은 별도의
`jobDeadlinePolicyRef`, lease, handoff guarantee가 상한을 소유한다. observer request도 자기 request
budget을 가진다. background 작업 전체를 route `maxDuration` 아래에 두지 않는다.

Engineering Health가 budget 숫자를 새로 소유하지 않는다. route, gateway, Operational Readiness의
기존 policy source를 연결한다.

### External work는 gateway를 통과한다

Episteme와 AI provider 호출은 현재 canonical gateway 경계를 유지한다. 향후 Moonlight server
호출도 purpose-named gateway 또는 domain-access boundary를 가져야 한다. route와 UI가 external
SDK나 raw endpoint를 직접 호출하는 shape를 topology edge로 승인하지 않는다.

### Failure는 edge와 path에서 분리해 읽는다

edge timeout이나 provider 5xx가 발생해도 path는 deterministic core 또는 degraded state로 끝날
수 있다. edge failure와 user-visible path outcome을 같은 metric으로 합치지 않는다.

반대로 HTTP 2xx만으로 path success를 판정하지 않는다. path마다 ready, failed, degraded처럼 실제
완료 의미를 source owner가 선언해야 한다.

### Background job은 화면 수명과 분리한다

gap build처럼 durable work는 browser polling이나 Vercel request 생존에 의존하지 않아야 한다.
예약, runner, persistence, observer의 owner를 path에 명시한다.

### Topology change에는 transition 상태가 있다

새 edge는 바로 healthy가 되지 않는다. Moonlight server처럼 contract가 아직 정해지지 않은 edge는
`planned`다. 실제 traffic과 evidence source가 생기기 전에는 `unknown`이나 `healthy`로 표시하지
않는다.

## Topology Catalog

catalog는 새로운 architecture authority가 아니다. product identity, runtime-flow, Operational
Readiness boundary, gateway와 repository 정책에서 계산한 **derived control-plane index**다.
node, edge, path의 의미를 복사하지 않고 definition source를 가리킨다.

catalog row에는 `definitionSourceRef`, `lifecycleOwner`, `transitionRef`를 둔다. planned row는 승인된
issue나 decision ref가 없으면 만들지 않는다. 승인 전 traffic은 active 전환이 아니라 topology
drift다.

runtime-flow와 Operational Readiness는 topology 의미와 policy의 authority를 유지한다. Engineering
Health는 projection schema와 source sync validation만 소유한다. `topologyCatalogVersion`은 수동
번호가 아니라 canonical catalog input과 projection schema version으로 계산한 deterministic
digest다. 첫 구현 issue가 canonical input 위치를 하나로 고정하며, source ref나 schema가 바뀌면
digest도 반드시 바뀐다.

### Node 계약

```ts
interface TopologyNode {
  id: string;
  status: "active" | "planned" | "transitioning" | "retired";
  kind:
    | "browser"
    | "serverless-runtime"
    | "database"
    | "external-service"
    | "ai-provider";
  lifecycleOwner: string;
  definitionSourceRef: string;
  transitionRef?: string;
  environments: string[];
  identityDimensions: string[];
  policyRefs: string[];
  evidenceSourceRefs: string[];
  activationGateRefs?: string[];
  retirementRef?: string;
}
```

### Edge 계약

```ts
interface TopologyEdge {
  id: string;
  status: "active" | "planned" | "transitioning" | "retired";
  from: string;
  to: string;
  operationId: string;
  contractVersion: string;
  purpose: string;
  protocol: string;
  lifecycleOwner: string;
  definitionSourceRef: string;
  transitionRef?: string;
  criticality: "required" | "degradable" | "background";
  authPolicyRef?: string;
  deadlinePolicyRef?: string;
  retryPolicyRef?: string;
  concurrencyPolicyRef?: string;
  fallbackPolicyRef?: string;
  dataClassificationRef?: string;
  evidenceSourceRefs: string[];
  activationGateRefs?: string[];
  retirementRef?: string;
}
```

### Critical Path 계약

```ts
interface CriticalPath {
  id: string;
  status: "active" | "planned" | "transitioning" | "retired";
  entrypoint: string;
  lifecycleOwner: string;
  definitionSourceRef: string;
  transitionRef?: string;
  activationGateRefs?: string[];
  retirementRef?: string;
  phases: Array<{
    id: string;
    dependsOnPhaseIds: string[];
    edgeRefs: string[];
    mode: "serial" | "parallel" | "background-handoff" | "observer";
    executionOwner: string;
    fanoutPolicyRef?: string;
    completionBoundary: string;
    handoffGuaranteeRef?: string;
    persistenceRef?: string;
    jobDeadlinePolicyRef?: string;
  }>;
  outcomePolicyRef: string;
  deadlinePolicyRef?: string;
  evidenceSourceRefs: string[];
}
```

catalog의 policy field는 기존 정본을 가리킨다. timeout, SLO, concurrency 숫자를 catalog에 다시
적지 않는다.

같은 `from`과 `to`를 사용해도 operation과 policy 묶음이 다르면 별도 semantic edge다. Episteme
search, batch hydration, graph request는 하나의 service-pair metric으로 합치지 않는다. endpoint
문자열과 코드 파일명은 edge identity가 아니다.

request-bound serial phase만 route deadline 합성 대상이다. parallel phase는 가장 늦은 leg와 join
boundary를 보고, background phase는 handoff 이후 별도 job budget을 본다.

### Evidence source 정의

assembler는 도착한 artifact만 보고 source missing을 추론하지 않는다. catalog는 기대하는 producer를
별도 정의한다.

```ts
interface EvidenceSourceDefinition {
  id: string;
  family: "code" | "delivery" | "local-runtime" | "production-runtime";
  owner: string;
  producerRef: string;
  expectedCadence: string;
  subjectSelector: string;
  fragmentSchemaVersion: string;
  freshnessPolicyRef?: string;
  policySource?: string;
  privacyProfileRef: string;
}
```

assembler는 definition과 실제 artifact를 대조한다. 해당 cadence에서 source가 기대되는데 도착하지
않았을 때만 missing envelope를 만든다. 비대상 source를 missing으로 표시하지 않는다. source
owner가 `freshnessPolicyRef`로 window를 정의한 경우에만 `stale`을 판정한다. 해당 policy가 없으면
assembler가 cadence로 시간 threshold를 추측하지 않고 freshness를 `unknown`으로 둔다.

### 비교 맥락 정의

비교 dimension은 free-form series id 안에 숨기지 않는다. snapshot은 catalog allowlist로 검증한
immutable context를 포함하고 observation은 그 context를 참조한다.

```ts
interface ComparisonContextDefinition {
  id: string;
  family: "code" | "delivery" | "local-runtime" | "production-runtime";
  definitionHash: string;
  dimensions: Array<{
    key: string;
    value: string | number | boolean;
  }>;
}
```

family별 허용 key와 값 형식은 schema가 소유한다. context의 dimension이나 definition이 바뀌면
기존 id를 고치지 않고 새 id와 hash를 만든다.

## Health evidence 구조

### Snapshot

snapshot은 여러 시점과 환경의 fragment를 조립할 수 있다. top-level commit이나 environment로
모든 fragment를 덮지 않는다.

```ts
interface EngineeringHealthSnapshot {
  schemaVersion: string;
  snapshotId: string;
  repository: string;
  topologyCatalogVersion: string;
  assembledAt: string;
  comparisonContexts: ComparisonContextDefinition[];
  fragments: HealthEvidenceFragment[];
  freshnessEvaluations: FreshnessEvaluation[];
  comparisons: HealthComparison[];
  assessments: DelegatedTopologyAssessment[];
}
```

### Fragment

fragment는 한 source execution의 provenance를 소유한다.

```ts
interface HealthEvidenceFragment {
  id: string;
  sourceDefinitionRef: string;
  fragmentSchemaVersion: string;
  family: "code" | "delivery" | "local-runtime" | "production-runtime";
  cadence: "pull-request" | "main" | "nightly" | "manual" | "production-window";
  subject:
    | { kind: "commit"; commitSha: string }
    | {
        kind: "deployment-window";
        windowStart: string;
        windowEnd: string;
        deploymentSlices: Array<{
          deploymentRef: string;
          contractVersion: string;
          sampleCount?: number;
          trafficShare?: number;
          functionRefs: string[];
          regionRefs: string[];
        }>;
      }
    | {
        kind: "manual-scenario";
        scenarioId: string;
        scenarioDefinitionRef: string;
        scenarioDefinitionHash: string;
        commitSha?: string;
      };
  execution: {
    capturedAt: string;
    workflowRunRef?: string;
    jobRef?: string;
    runner?: string;
    operatingSystem?: string;
    nodeVersion?: string;
    toolVersions: Record<string, string>;
    artifactDigest?: string;
  };
  sourceEvaluation: {
    outcome: "passed" | "failed" | "cancelled" | "skipped" | "unknown";
    exitCode?: number;
    evaluatedAt?: string;
    policyHash?: string;
    policySource?: string;
  };
  sourceStatus: "measured" | "missing" | "invalid";
  reasonCode?: string;
  sampleCount?: number;
  coverage?: number;
  observations: HealthObservation[];
}
```

Production window는 여러 deployment를 포함할 수 있다. assembler 실행 SHA를 production 결과의
원인으로 붙이지 않는다. deployment slice마다 contract version과 traffic·function·region coverage를
보존한다. 호환되지 않는 contract version이 한 fragment에 섞이면 fragment를 나누거나 invalid로
표시한다.

fragment `id`는 source execution마다 생기는 occurrence id다. assembler는
`sourceDefinitionRef`로 expected producer를 찾고 `fragmentSchemaVersion`을
`EvidenceSourceDefinition.fragmentSchemaVersion`과 대조한다.

freshness는 producer artifact의 불변 provenance가 아니다. 같은 fragment도 snapshot 조립 시각에
따라 fresh 또는 stale이 될 수 있으므로 assembler가 별도 evaluation을 만든다.

```ts
type FreshnessEvaluation = {
  id: string;
  fragmentRef: string;
  evaluatedAt: string;
} &
  (
    | {
        status: "fresh" | "stale";
        policyRef: string;
        policyHash: string;
      }
    | {
        status: "not-applicable";
        policyRef: string;
        policyHash: string;
        reasonCode: string;
      }
    | {
        status: "unknown";
        policyRef?: string;
        policyHash?: string;
        reasonCode: string;
      }
  );
```

producer fragment의 timestamp와 artifact digest는 바꾸지 않는다. snapshot마다 적용 policy와 판정
시각을 기록한 `FreshnessEvaluation`만 새로 만든다. `not-applicable`은 authority policy가 해당
evidence에 freshness가 필요 없다고 명시한 경우에만 허용한다.

### Observation

observation은 gate verdict, 숫자, 구조 transition을 구분한다.

```ts
type HealthObservation = MetricObservation | TopologyObservation;

interface MetricBase {
  kind: "metric";
  id: string;
  sourceType: "gate-verdict" | "observed-value" | "derived-delta";
  seriesId: string;
  definitionVersion: string;
  comparisonContextRef: string;
  unit?: string;
  value?: number;
  direction: "higher-is-better" | "lower-is-better" | "neutral";
  policySource?: string;
}

interface CampaignMetadata {
  campaignRef: string;
  phaseRef: string;
  owner: string;
  scope: string;
  entryConditionRef: string;
  exitConditionRef: string;
  retireOn: string;
}

type MetricObservation = MetricBase &
  (
    | {
        metricClass: "campaign";
        campaign: CampaignMetadata;
        advisory: "observe";
        enforcement: "none";
      }
    | {
        metricClass: "invariant" | "trend";
        campaign?: never;
        advisory: "observe" | "warn";
        enforcement: "none" | "delegated";
      }
  );

interface TopologyObservation {
  kind: "topology";
  targetType: "node" | "edge" | "path";
  targetId: string;
  lifecycleState: "active" | "planned" | "transitioning" | "retired";
  evidenceRefs: string[];
  reasonCode?: string;
  transitionRef?: string;
}
```

`healthy`, `watch`, `degraded`는 source owner가 판정한 값만 투영한다. Engineering Health가 새
운영 verdict를 계산하지 않는다.

```ts
interface DelegatedTopologyAssessment {
  targetRef: string;
  subjectRef: string;
  authorityState: "healthy" | "watch" | "degraded" | "unknown";
  projectionState: "healthy" | "watch" | "degraded" | "unknown";
  projectionReasonCode?: string;
  authorityRef: string;
  policySource: string;
  assessedAt: string;
  assessmentWindow: {
    start: string;
    end: string;
    definitionRef: string;
  };
  requiredEvidenceRefs: string[];
  observedEvidenceRefs: string[];
  missingEvidenceRefs: string[];
  sourceFragmentRefs: string[];
  requiredSourceFragmentRefs: string[];
  evidenceWindowCompatibility: Array<{
    evidenceRef: string;
    status: "compatible" | "not-compatible" | "unknown";
    reasonCode?: string;
  }>;
  freshnessEvaluations: Array<{
    sourceFragmentRef: string;
    evaluationRef: string;
  }>;
  coverage?: number;
}
```

`authorityState`는 source owner의 원 verdict를 보존한다. `projectionState`는 현재 snapshot에서 그
verdict를 사용할 수 있는지 나타낸다. 필수 evidence가 missing·invalid이거나 authority policy가
요구한 window overlap·coverage를 충족하지 못하면 `healthy` projection을 금지한다.

production topology assessment의 `requiredSourceFragmentRefs`와 freshness mapping은 같은 fragment
집합을 이루며, 각 필수 fragment에는 정확히 하나의 evaluation만 있어야 한다. mapping의
`sourceFragmentRef`는 evaluation의 `fragmentRef`와 일치해야 한다. aggregate freshness status를
별도 입력으로 받지 않고 이 집합에서 파생한다.

모든 evaluation이 `fresh`이거나 authority policy로 증명한 `not-applicable`일 때만 `healthy`를
projection한다. 하나라도 `stale`·`unknown`이거나 evaluation이 빠지면 원 verdict는 바꾸지 않고
current projection만 `unknown`으로 낮추며 `projectionReasonCode`와 해당 source를 함께 보여준다.

authority는 다음처럼 유지한다.

| 판정 | authority |
| --- | --- |
| path 순서·fallback·persistence owner | runtime-flow |
| SLO·capacity·cohort go/no-go | Operational Readiness |
| code·contract blocking | canonical quality gate |
| topology lifecycle planned·transitioning·active | owning transition record |
| evidence missing·invalid, freshness evaluation | Engineering Health assembler using source owner policy |

ESLint처럼 기존 gate가 threshold 위반과 exit code만 주는 source는 `gate-verdict`다. 통과 함수의
복잡도 분포를 제공한다고 가정하지 않는다. 별도 분포가 필요하면 알고리즘 owner를 후속 작업에서
정한다.

module, edge, LOC, fan-in/fan-out은 기본적으로 `trend + neutral`이다. 방향값만으로 warning을
만들지 않는다.

## Evidence 상태

상태 축을 섞지 않는다.

| 축 | 값 | 의미 |
| --- | --- | --- |
| source status | `measured` | 기대한 source가 정상적으로 수집됨 |
| source status | `missing` | 해당 cadence에서 기대한 source가 도착하지 않음 |
| source status | `invalid` | source는 있으나 parse·schema·coverage 조건을 충족하지 못함 |
| freshness | `fresh` | source owner의 freshness policy budget 안에 있음 |
| freshness | `stale` | source owner의 freshness policy budget을 넘음 |
| freshness | `unknown` | source owner가 freshness policy를 정의하지 않았거나 판정 evidence가 없음 |
| freshness | `not-applicable` | authority policy가 해당 evidence에 freshness가 불필요하다고 선언함 |
| comparison | `comparable` | metric definition과 비교 dimension이 호환됨 |
| comparison | `no-baseline` | exact base evidence가 없음 |
| comparison | `not-comparable` | 값은 유효하지만 definition 또는 environment가 호환되지 않음 |
| advisory | `observe` | 변화와 missing을 표시하지만 경고하지 않음 |
| advisory | `warn` | owner와 대응 행동이 있는 비차단 경고 |
| enforcement | `delegated` | 기존 canonical gate가 blocking verdict를 소유함 |

schema 위반은 Engineering Health job failure다. source missing·invalid와 freshness stale·unknown은
health evidence로 표시한다. missing을 값 0이나 green으로 바꾸지 않는다.

comparison은 snapshot과 별도 record다.

```ts
type FragmentComparisonBase = {
  seriesId: string;
  headDefinitionVersion: string;
  headComparisonContextRef: string;
  baseSubjectRef: string;
  headSubjectRef: string;
  headFragmentRef: string;
};

type FragmentBaseEvidence = { kind: "fragment"; fragmentRef: string };

type VcsTreeBaseEvidence = {
  kind: "vcs-tree";
  repository: string;
  commitSha: string;
  treeRef: string;
};

type HealthComparison = FragmentComparisonBase &
  (
    | {
        status: "comparable";
        baseDefinitionVersion: string;
        baseComparisonContextRef: string;
        baseEvidence: FragmentBaseEvidence;
        result: {
          kind: "paired-values";
          baseValue: number;
          headValue: number;
          delta: number;
        };
        reasonCode?: never;
      }
    | {
        status: "comparable";
        baseDefinitionVersion: string;
        baseComparisonContextRef: string;
        baseEvidence: VcsTreeBaseEvidence;
        result: {
          kind: "vcs-derived-delta";
          delta: number;
        };
        reasonCode?: never;
      }
    | {
        status: "not-comparable";
        baseDefinitionVersion: string;
        baseComparisonContextRef: string;
        baseEvidence: FragmentBaseEvidence | VcsTreeBaseEvidence;
        result?: never;
        reasonCode: string;
      }
    | {
        status: "no-baseline";
        baseDefinitionVersion?: never;
        baseComparisonContextRef?: never;
        baseEvidence?: never;
        result?: never;
        reasonCode: string;
      }
  );
```

PR comparison의 base는 GitHub PR merge-base SHA다. 일반 metric history는 exact base fragment만
허용하고 없으면 `no-baseline`으로 남긴다. 1a transport smoke의 VCS-derived delta만 exact
merge-base SHA의 tree를 `vcs-tree` evidence로 사용할 수 있다. 이 경우 Git object에서 직접 계산한
diff는 `comparable`이며, 임의의 최신 main tree나 artifact로 대체하지 않는다.

`comparable`과 `not-comparable`은 base evidence, base·head definition version, base·head context를
모두 요구한다. definition version이나 context id·hash가 일치하지 않으면 `not-comparable`이다.
일반 metric은 paired value 결과만, transport smoke는 VCS-derived delta 결과만 사용한다.
`no-baseline`은 base definition, context, evidence, result를 금지하고 head 정보만 남긴다.

## Comparability 계약

metric series는 `seriesId`, base·head `definitionVersion`, base·head `comparisonContextRef`가 가리키는
family별 allowlisted dimension으로 비교한다. assembler는 context의 `definitionHash`까지 일치하는지
검증하며 collector가 free-form key를 만들지 않는다.

| fragment | 비교 dimension |
| --- | --- |
| code | metric definition, source scope, tool compatibility |
| delivery | workflow/job, OS, Node, lockfile, cache mode, shard |
| local runtime | scenario id, target class, users, timeout, runtime version |
| production runtime | environment, route·cohort, aggregation window definition, contract version |

policy hash는 당시 verdict를 복원하는 source evaluation이다. measurement comparability key가 아니다.
threshold가 바뀌어도 같은 scenario 값은 비교할 수 있다.

관측된 provider degraded 상태도 diagnostic observation이다. provider가 나빴다는 이유로 사용자가
겪은 path latency를 다른 series로 숨기지 않는다. provider contract나 API version이 바뀌었을
때만 compatibility를 다시 판정한다.

일반 metric comparison에서 exact base SHA fragment가 없으면 `no-baseline`이다. 최신 main artifact로
임의 대체하지 않는다. transport smoke의 exact VCS tree 예외를 metric history에 확대하지 않는다.

## Node·Edge·Path health

### Vercel node

후보 evidence는 deployment·function·region별 duration, cold-start signal, memory, timeout, 5xx,
concurrency다. 실제 source가 없으면 unknown으로 남긴다.

### External service edge

후보 evidence는 request count, p50/p95/p99, timeout, error, retry, queue wait, load-shed, circuit state,
response size, auth failure다. collector가 없는 값을 추론하지 않는다.

### Supabase node와 edge

Vercel → Supabase API edge는 request latency, status, timeout을 본다. Supabase managed DB node는
pool occupancy, DB error, statement timeout을 본다. ownership-checked access는 performance metric이
아니라 repository·security invariant다.

platform 전체 pool 값을 Light House edge 값으로 귀속하지 않는다. dashboard scraping은 source로
인정하지 않는다. 반복 가능한 aggregate source가 없으면 manual 또는 missing이다.

### Critical path

path는 end-to-end latency와 실제 outcome을 함께 본다. edge phase를 합산해 end-to-end 값을
재구성하지 않는다. serial·parallel·background 구조 때문에 합산값이 실제 사용자 시간을
대표하지 않을 수 있다.

## Moonlight server planned edge

Moonlight server는 `planned` node와 edge로 등록한다. 다음 정보가 정해지기 전에는 health metric을
요구하지 않는다.

- purpose와 owning use case
- endpoint와 protocol
- service authentication과 principal 전달 경계
- timeout·retry·concurrency budget owner
- request·response schema와 version compatibility
- data classification과 log policy
- fallback과 degraded user outcome
- deployment identity와 health evidence source
- activation과 retirement 조건

첫 canary나 shadow traffic이 생기면 planned edge를 `transitioning`으로 바꾼다. traffic 자체가
active 승격 조건은 아니다. `transitionRef`가 대상 cohort, required evidence, rollback owner를
소유하고 `activationGateRefs`가 모두 닫힌 뒤 owning transition record가 active를 선언한다.

activate change는 canonical gateway, runtime-flow, auth·data classification, deadline·fallback
owner, Operational Readiness boundary review, 반복 가능한 evidence source를 함께 닫는다. 승인 전
traffic은 topology drift다.

## Workflow와 artifact handoff

### Producer가 fragment를 만든다

기존 quality, build, mutation, load workflow가 자기 실행 결과를 fragment로 내보낸다. Engineering
Health가 같은 command를 다시 실행하지 않는다.

정상 종료한 producer는 성공·실패 exit code와 실제 partial evidence를 fragment에 기록한다. 원래
실패를 완화하거나 덮지 않는다.

runner cancellation, timeout, process kill에서는 producer payload를 보장하지 않는다. workflow
finalizer가 `always` 성격으로 source evaluation envelope를 만든다. payload가 없으면
`sourceStatus: missing`, `reasonCode: producer-interrupted`를 기록한다. 존재하지 않는 partial
evidence를 만들지 않는다.

### 1a. Artifact transport smoke

첫 slice는 `git diff`만 읽는 repository change fragment 하나로 제한한다. 이 slice는 topology
health를 증명하지 않는다. schema, finalizer, artifact, Summary transport만 검증한다.

- changed file과 changed line
- commit·base SHA
- fragment schema validation
- GitHub Job Summary
- normalized artifact upload

duplication, dependency graph, build, test는 첫 slice에서 다시 실행하지 않는다. 기존 producer가
normalized fragment를 배출하게 된 뒤에 연결한다.

### 1b. Topology proof slice

전체 topology inventory를 먼저 작성하지 않는다. 현재 정본과 evidence가 있는 critical path 하나와
active semantic edge 하나만 catalog에 등록한다. 기존 producer evidence 하나를 연결해 다음 흐름을
끝까지 검증한다.

```text
definition source
  -> topology catalog ref
  -> expected evidence source
  -> fragment 또는 missing envelope
  -> delegated availability/assessment projection
  -> GitHub Summary
```

이 흐름이 검증된 뒤에만 다른 path와 edge를 등록한다. Moonlight planned edge는 transition ref만
먼저 두고 active inventory 확장과 섞지 않는다.

### Pull request

PR과 fork에는 external read·write credential을 주지 않는다. checkout과 current workflow evidence만
사용한다. 초기 check는 advisory이며 branch protection required 목록에 넣지 않는다.

### Main과 nightly

main은 exact commit snapshot을 만든다. nightly는 coverage, mutation, dependency audit처럼 느린
producer fragment를 연결한다. workflow run id와 artifact digest로 조립하며 최신 파일명으로
추측하지 않는다.

### Production window

production connector는 trusted main 또는 schedule에서만 실행한다. source에서 aggregate한 값만
받는다. raw log, query, user row는 transient memory 밖에 저장하지 않는다.

필요한 evidence가 없으면 Engineering Health 작업에서 product counter, header, log, DB field를
추가하지 않는다. metric을 missing으로 남기고 별도 runtime/Operational Readiness 작업으로 연다.

## Report surface

GitHub Summary는 다음 순서로 읽는다.

1. degraded·unknown topology node, edge, path
2. missing·invalid·stale evidence와 unknown freshness
3. comparable regression과 campaign 진행
4. source evaluation과 기존 policy owner
5. raw evidence reference와 edit target

전체 metric 목록을 첫 화면에 펼치지 않는다. single health score도 만들지 않는다.

## 저장과 보안

### 초기 저장

- local output은 `reports/engineering-health/`에 두고 gitignore한다.
- normalized JSON만 GitHub artifact로 보존한다.
- 초기 retention은 mutation workflow의 30일 패턴을 따른다.
- checked-in snapshot을 만들지 않는다.

### Privacy validator

assembler는 catalog가 허용한 dimension key와 bounded value만 받는다.

- absolute path는 repository-relative path로 바꾼다.
- source content와 code snippet을 저장하지 않는다.
- raw query는 scenario id로 바꾼다.
- user id, owner principal, email, device/session id, cookie, token을 저장하지 않는다.
- raw error, stack, log line을 artifact에 넣지 않는다.
- free-form `reason` 대신 allowlisted `reasonCode`를 사용한다.
- unknown 또는 high-cardinality dimension은 upload 전에 거부한다.

### Durable store 승격

다음 중 하나가 실제로 발생할 때만 별도 object 또는 time-series store를 연다.

- 30일보다 긴 topology trend가 반복적으로 필요하다.
- 운영자가 cross-repository 또는 cross-deployment history를 한 질의·판정에서 반복적으로 결합한다.
- artifact 만료 때문에 필요한 baseline을 잃은 사례가 발생한다.

제품 DB는 사용하지 않는다. durable write credential은 trusted main 또는 schedule에만 둔다.

두 번째 repository가 같은 schema를 사용하는 사실은 package 추출 trigger일 수 있지만 durable
store의 충분조건은 아니다. 각 repository artifact만으로 충분하면 외부 store를 만들지 않는다.

## Issue #265와의 관계

#265는 Vercel·Episteme·Moonlight service topology를 바꾸는 작업이 아니다. 내부 research route
state ownership과 execution lifetime을 바꾸는 Code Health·Architecture Fitness campaign이다.

Engineering Health는 #265에서 다음을 지킨다.

- service edge와 critical path의 semantic id를 파일명과 store field에서 분리한다.
- module·edge·LOC 변화는 diagnostic이며 자동 warning을 만들지 않는다.
- stale completion rejection, gap artifact ownership, analytics identity 같은 invariant는 기존
  test와 contract owner를 가리킨다.
- `*ByViewId` 잔존 shape와 legacy caller는 #265의 해당 atomic transition phase에서만 campaign
  observation이 된다.
- campaign observation은 phase entry condition을 충족할 때 시작하고 phase exit condition과 함께
  retire한다. issue 전체 close를 기다리지 않는다.
- #265 전후 runtime path는 contract version과 scenario가 호환될 때 계속 비교한다.

이 규칙이 있으면 #265의 원자적 migration이 일시적으로 파일과 edge를 늘려도 Engineering Health가
구조 악화로 오판하지 않는다.

campaign observation은 `observe`만 허용한다. stale completion rejection, gap artifact ownership
같은 stable invariant는 campaign으로 옮기지 않고 기존 test와 contract owner를 계속 가리킨다.

## Policy 승격과 retire

### Observe에서 warn

동일 series의 비교 가능한 snapshot이 누적되고 owner와 대응 행동이 있을 때만 올린다. direction만
보고 warning을 만들지 않는다.

### Warn에서 blocking

실제 false pass를 설명하고 negative fixture로 재현될 때 검토한다. blocking threshold는
Engineering Health에 만들지 않는다. 기존 canonical gate로 편입하고 `quality-gate-steward`가
CI와 validation docs를 동기화한다.

### Pilot record

구현 issue는 다음 값을 소유한다.

- `pilotOwner`
- `pilotStartedAt`
- `reviewAfter` 날짜 또는 최소 snapshot 수
- `reviewRecord`
- `adoptOrRetireDecision`

### Metric retire

source가 사라졌거나 정기 review 동안 어떤 판단에도 쓰이지 않은 metric은 retire 후보가 된다.
campaign metric은 연결된 atomic phase의 exit condition이 충족되면 즉시 retire한다. 장기
invariant로 바꾸려면 owner와 policy source를 다시 정한다.

pilot 동안 report가 실제 architecture·performance 판단을 바꾸지 못하면 workflow를 제거하고
기존 owner만 유지한다.

## 단계별 구조

### 0단계. Topology catalog proof 범위 확정

- 현재 정본과 evidence가 있는 critical path 하나와 active semantic edge 하나만 등록한다.
- Moonlight server는 transition ref가 있는 planned node·edge만 등록한다.
- policy와 evidence source는 기존 정본을 참조한다.
- 현재 source가 없는 health 항목은 unknown으로 기록한다.

### 1a단계. Artifact transport smoke

- git diff fragment 하나로 snapshot·artifact·Summary 흐름을 검증한다.
- 외부 credential과 product instrumentation을 사용하지 않는다.
- metric 값으로 PR을 차단하지 않는다.

### 1b단계. Topology proof slice

- 0단계의 path와 edge에 existing producer evidence 하나를 연결한다.
- expected source가 없을 때 missing envelope가 생기는지 확인한다.
- delegated assessment와 Summary가 기존 authority를 다시 계산하지 않는지 확인한다.
- 이 흐름이 닫힌 뒤에만 다른 node·edge·path를 등록한다.

### 2단계. Existing producer fragment 연결

- quality, build, test, mutation workflow가 같은 실행에서 fragment를 배출한다.
- canonical failure와 실제로 생성된 partial evidence를 보존한다.
- interrupted producer는 workflow finalizer가 missing envelope로 닫는다.
- exact subject와 run id로 artifact를 조립한다.

### 3단계. Local runtime evidence 연결

- load scenario를 manual fragment family로 연결한다.
- actual outcome과 latency를 함께 요구한다.
- production series와 합치지 않는다.

### 4단계. Trusted production connector 재판정

- 반복 가능한 aggregate source가 있는 node·edge·path만 연결한다.
- connector가 없으면 missing을 유지한다.
- 새 instrumentation은 별도 Operational Readiness 작업으로 분리한다.

### 5단계. Durable storage와 package 추출 재판정

- retention 승격 조건을 만족할 때만 외부 store를 선택한다.
- 두 번째 repository consumer가 생길 때만 package/repository 추출을 검토한다.
- product admin UI가 필요해지면 별도 Mission Control을 연다.

## 초기 채택 판정

Concept Shift의 `preserve / migrate-read-only / remove`는 기존 active shape에만 사용한다. 이 표는
새 Engineering Health 후보를 `adopt / defer / exclude`로 판단한다.

| 후보 | 판정 | 이유 |
| --- | --- | --- |
| same-repo 비제품 control plane | `adopt` | source와 workflow owner에 가깝고 product dependency를 만들지 않는다. |
| topology catalog와 normalized snapshot | `adopt` | node·edge·path와 evidence provenance를 연결한다. |
| GitHub Summary와 30일 artifact | `adopt` | 첫 소비자와 existing pattern에 맞는다. |
| Moonlight planned edge | `adopt` | health를 가장하지 않고 activation prerequisite를 관리한다. |
| trusted production connector | `defer` | 반복 가능한 aggregate source와 credential boundary가 먼저 필요하다. |
| durable external store | `defer` | retention 필요가 입증되지 않았다. |
| 별도 package/repository | `defer` | 두 번째 consumer가 없다. |
| 제품 `/admin` surface | `exclude` | product auth·bundle·Story Chain 책임이 불필요하다. |
| 제품 DB write | `exclude` | engineering evidence와 product artifact ownership을 섞는다. |
| single health score | `exclude` | node·edge·path 원인과 owner를 숨긴다. |
| 즉시 blocking metric | `exclude` | history, false-pass evidence, 대응 owner가 없다. |
| 새 Engineering Health skill | `exclude` | 반복되는 별도 agent workflow가 아직 없다. |

기존 ESLint, jscpd, dependency, load-smoke, Operational Readiness owner는 현재 역할을
`preserve`한다. 기존 raw report도 source owner의 현재 수명만 유지한다. Engineering Health가
보존 기간을 암묵적으로 늘리지 않는다. 아직 active EH legacy shape는 없으므로 `remove` verdict
대상도 없다.

## 구조 완료 기준

- Vercel, Episteme, Supabase, AI provider, Moonlight node와 edge 상태가 active, planned,
  transitioning으로 구분된다.
- critical path가 dependency, join, fan-out, execution owner, completion, durable handoff를 표현한다.
- serverless process-local state와 fleet aggregate를 혼동하지 않는다.
- path deadline과 edge policy source가 연결된다.
- production window를 단일 commit에 잘못 귀속하지 않는다.
- policy hash와 measurement comparability를 분리한다.
- family별 comparison context와 manual scenario definition을 재현할 수 있다.
- delegated assessment의 원 verdict와 현재 projection, assessment window를 분리한다.
- missing, invalid, stale, no-baseline을 green으로 표시하지 않는다.
- canonical failure와 실제 partial evidence가 snapshot에서 사라지지 않는다.
- PR과 fork에 production read·write credential이 없다.
- raw log, query, identity, stack이 normalized artifact에 없다.
- 필요한 runtime evidence가 없어도 EH 작업에 instrumentation을 섞지 않는다.
- #265 campaign metric이 현재 구조를 영구 목표로 만들지 않는다.
- blocking 승격은 기존 canonical gate와 quality-gate workflow에서만 일어난다.

## 1차 구조 리뷰 반영 기록

| ID | 분류 | 반영 내용 |
| --- | --- | --- |
| R-01 | `valid` | fragment별 subject, 실행 환경, 시각, tool version, artifact digest를 추가했다. |
| R-02 | `valid` | 일반 metric base는 exact SHA fragment만 사용하고 없으면 no-baseline으로 두었다. |
| R-03 | `valid` | canonical failure에도 fragment를 남기고 partial snapshot을 조립하게 했다. |
| R-04 | `valid` | source, comparison, advisory, enforcement 상태를 분리했다. |
| R-05 | `valid` | 첫 slice를 git diff fragment 하나로 줄였다. |
| R-06 | `valid` | series·definition version과 campaign retire 조건을 추가했다. |
| R-07 | `valid` | gate verdict, observed value, derived delta source를 구분했다. |
| R-08 | `valid` | production window가 deployment 집합과 observation window를 소유하게 했다. |
| R-09 | `valid` | policy hash와 measurement comparability key를 분리했다. |
| R-10 | `valid` | code, delivery, local runtime, production family를 schema에서 구분했다. |
| R-11 | `valid` | source evaluation에 당시 outcome, exit code, policy source를 보존했다. |
| R-12 | `valid` | missing, invalid, stale, no-baseline 의미를 고정했다. |
| R-13 | `valid` | production connector를 trusted workflow로 제한하고 privacy allowlist를 추가했다. |
| R-14 | `valid` | 새 runtime instrumentation을 EH 범위 밖으로 분리했다. |
| R-15 | `valid` | Concept verdict 오용을 제거하고 초기 채택 판정 용어를 분리했다. |
| R-16 | `valid` | pilot owner, review 시점, adopt/retire record를 명시했다. |
| R-17 | `valid` | #265 stable invariant와 campaign observation 수명을 분리했다. |
| R-18 | 사용자 방향 수정 | 중심 구조를 System Topology Health의 node·edge·path 모델로 재정의했다. |

## 2차 구조 리뷰 반영 기록

| ID | 분류 | 반영 내용 |
| --- | --- | --- |
| R2-01 | `valid` | expected producer registry를 추가해 비대상 source와 missing을 구분했다. |
| R2-02 | `valid` | exact base·head evidence를 소유하는 comparison 계약을 추가했다. |
| R2-03 | `valid` | producer payload와 workflow finalizer failure envelope를 분리했다. |
| R2-04 | `valid` | git diff를 transport smoke로 한정하고 topology proof slice를 추가했다. |
| R2-05 | `valid` | topology health를 delegated assessment로 정의하고 authority를 분리했다. |
| R2-06 | `valid` | critical path에 dependency, join, fan-out, owner, handoff, completion boundary를 추가했다. |
| R2-07 | `valid` | production window를 contract·traffic·function·region별 deployment slice로 나눴다. |
| R2-08 | `valid` | service pair가 아니라 operation·contract별 semantic edge를 등록하게 했다. |
| R2-09 | `valid` | Supabase API edge, managed DB node, ownership invariant를 분리했다. |
| R2-10 | `valid` | planned와 active 사이에 transitioning·cohort·rollback activation 단계를 추가했다. |
| R2-11 | `valid` | topology catalog를 기존 정본에서 계산한 derived index로 한정했다. |
| R2-12 | `valid` | multi-repository consumer와 durable store 승격 조건을 분리했다. |
| R2-13 | `valid` | #265 campaign을 atomic phase별 entry·exit·retire 계약으로 좁혔다. |
| R2-14 | `invalid` | fragment schema의 `cadence` 중복은 현재 반영본에 존재하지 않았다. |

## 3차 구조 리뷰 반영 기록

| ID | 분류 | 반영 내용 |
| --- | --- | --- |
| R3-01 | `valid` | fragment occurrence와 expected source definition을 분리하고 schema version 대조를 추가했다. |
| R3-02 | `valid` | VCS-derived transport delta에만 exact merge-base tree evidence를 허용했다. |
| R3-03 | `valid` | authority 원 verdict와 current projection state·reason을 분리했다. |
| R3-04 | `valid` | immutable comparison context와 family별 typed dimension reference를 추가했다. |
| R3-05 | `valid` | delegated assessment에 assessment window와 evidence window compatibility를 추가했다. |
| R3-06 | `valid` | route deadline 규칙을 request-bound phase로 한정하고 background job deadline을 분리했다. |
| R3-07 | `valid` | critical path 순서 authority는 runtime-flow이며 catalog는 projection임을 바로잡았다. |
| R3-08 | `valid` | campaign observation을 phase metadata 필수·observe-only discriminated union으로 고정했다. |
| R3-09 | `valid` | catalog projection owner와 canonical input·schema의 deterministic digest 규칙을 추가했다. |

## 4차 구조 리뷰 반영 기록

| ID | 분류 | 반영 내용 |
| --- | --- | --- |
| R4-01 | `valid` | source owner의 freshness policy가 있을 때만 stale을 판정하고 없으면 unknown으로 두었다. |
| R4-02 | `valid` | critical path에도 transition·activation gate·retirement reference를 추가했다. |

## 5차 구조 리뷰 반영 기록

| ID | 분류 | 반영 내용 |
| --- | --- | --- |
| R5-01 | `valid` | freshness를 producer fragment에서 snapshot별 evaluation으로 분리하고 policy·판정 시각을 보존했다. |
| R5-02 | `valid` | production healthy projection을 fresh 또는 authority가 선언한 not-applicable로 제한했다. |
| R5-03 | 자체 검토 `valid` | comparison이 base와 head context를 각각 보존해 incompatibility를 설명하게 했다. |
| R5-04 | 자체 검토 `valid` | Moonlight activation prose를 catalog의 transition·activation gate field와 일치시켰다. |

## 6차 구조 리뷰 반영 기록

| ID | 분류 | 반영 내용 |
| --- | --- | --- |
| R6-01 | `valid` | comparison을 status·base evidence·result별 union으로 만들어 invalid comparable shape를 금지했다. |
| R6-02 | `valid` | 필수 source fragment와 freshness evaluation의 일대일 mapping에서 projection 조건을 파생했다. |
| R6-03 | 자체 검토 `valid` | comparison이 base와 head의 definition version을 각각 보존하게 했다. |

## 재검토 기록

| 역할 | 상태 | 확인 범위 | 결과 |
| --- | --- | --- | --- |
| code·delivery integration | 7차 완료 | existing producer, fragment handoff, CI 비용, failure evidence | 새 `valid` finding 없음 |
| serverless·service topology | 7차 완료 | Vercel fleet, Episteme·Moonlight edge, request path, comparability | 새 `valid` finding 없음 |
| governance·security·과설계 | 7차 완료 | product 밖 경계, credential, storage, policy owner, retire | 새 `valid` finding 없음 |

finding은 `valid`, `invalid`, `already-fixed`, `needs-human-decision`으로 분류했다. 유효 finding을
반영한 뒤 같은 관점으로 재검토했으며, 7차 최종 패스에서 세 관점 모두 새 `valid` finding이 없었다.

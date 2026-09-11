/** 시드 데이터·글로벌 공유 노드의 소유자 ID. 사용자에 귀속되지 않는 데이터에 사용한다. */
export const GLOBAL_SEED_OWNER_ID = "00000000-0000-0000-0000-000000000000";

/** 사용자 검색 결과 실행에 기본으로 적재할 결과 수. UI는 이중 일부만 먼저 보여준다. */
export const SEARCH_DOCUMENT_FETCH_LIMIT = 40;

/**
 * 라이브러리 anchor-set blend에서 folder(coherent anchor set)당 E3 discovery로
 * 받아올 그래프 이웃 후보 상한. bounded latency를 위해 40으로 제한한다.
 * @aspect aspect:library-grounded-research
 */
export const SEARCH_LIBRARY_ANCHOR_CANDIDATE_LIMIT = 40;

/**
 * 라이브러리 graph preflight에서 상세 정보를 미리 hydrate할 후보 예산. 현재
 * combined result membership은 이 후보 풀에서 paper-id/title-family 중복과 연도 범위
 * 밖 후보를 제거한 뒤 남은 전부를 사용한다. 이 값은 graph leg의 결과 멤버십 상한이며
 * 고정 삽입 슬롯을 뜻하지 않는다.
 * @aspect aspect:library-grounded-research
 */
export const SEARCH_LIBRARY_NEAR_BAND_LIMIT = 40;

/**
 * 검색 producer가 한 route-owned result pool에 실을 수 있는 paper 상한.
 * Keyword와 library-near band는 중복 제거 전에 모두 합류하므로 API ingress는
 * 어느 한쪽 leg의 한도가 아니라 이 combined capacity를 수용해야 한다.
 */
export const SEARCH_RESULT_POOL_PAPER_LIMIT =
  SEARCH_DOCUMENT_FETCH_LIMIT + SEARCH_LIBRARY_NEAR_BAND_LIMIT;

/** Search background command에서 paper identity 하나가 차지할 수 있는 문자 상한. */
export const SEARCH_BACKGROUND_PAPER_ID_MAX_CHARS = 512;

/** 연구 용어 LLM 추출 프롬프트가 표본으로 나열하는 논문 수. */
export const TERM_CANDIDATE_LLM_PAPER_LIMIT = 12;
export const TERM_CANDIDATE_PROMPT_ABSTRACT_CHARS = 300;
export const TERM_CANDIDATE_PROMPT_FIELD_CHARS = 300;

/**
 * gap 분석은 사용자가 선택한 정렬·필터가 적용된 검색 결과 중 상위 N편만 입력으로
 * 읽는다. 40으로 둔 이유: 이보다 훨씬 큰 풀은 클러스터링 입력으로 과해서 군집이 흐려지고,
 * 40 아래로 내리면 관계 근거가 부족해 dogfooding(#101)에서 본 40-result 검색의
 * "근거 없음" 빈 상태로 떨어질 위험이 커진다. 40은 클러스터가 의미 있게 갈라질
 * 만큼은 많고, 군집을 흐리지는 않는 표본 크기다.
 */
// @check-removes-fails: acceptance-check:gap-network-detection-from-search-analysis-input-cap
// AC says gap 입력 표본은 현재 정렬된 검색 결과 상위 40편으로 캡된다 — value-as-promise.
// `__tests__/graph-paper-snapshots.test.ts` asserts the literal `40` plus the
// slice behavior, so changing the value (e.g. back to 100) breaks vitest.
export const MAX_GRAPH_SOURCE_PAPERS = 40;

/** Deterministic gap core and enrichment may expose at most this many clusters. */
export const GAP_NETWORK_CLUSTER_LIMIT = 5;

/** Deterministic gap core and gap-pair enrichment may expose at most this many gaps. */
export const GAP_NETWORK_GAP_PAIR_LIMIT = 10;

/** 검색 결과 view 본문에 포함할 요약 preview 수. */
export const SEARCH_RESULTS_CONTENT_PREVIEW_LIMIT = 20;

/**
 * Legacy snapshot compatibility reader가 과거 keyword-spine payload를 재현할 때만
 * 사용하는 first-screen interleave cap. 현재 `combined_score` 검색은 이 값을 읽지 않고
 * 모든 결과를 한 pool에서 정렬한다.
 * @aspect aspect:library-grounded-research
 * @check acceptance-check:search-nonascii-library-relevance-korean-overlap
 */
export const SEARCH_LIBRARY_FIRST_SCREEN_SUPPLEMENT_LIMIT = 3;

/** 검색 결과 UI가 최초에 노출하는 논문 수. */
// @aspect aspect:paper-card-list-windowing
// @check-removes-fails: acceptance-check:search-results-fast-window-initial-dom-window
// AC says "정확히 10편" — value-encoded promise to the user. Negative test in
// `__tests__/constants.contract.test.ts` asserts the literal `10` so changing
// it (e.g., to 9 or 11) breaks vitest. Sibling tests that reference the
// symbol name (not the literal) cannot catch this — both sides shift
// together and stay green. Per `hardening-tier-policy.md` §3.
export const SEARCH_RESULTS_INITIAL_VISIBLE_COUNT = 10;

/**
 * AI 검색 반응(comment) 입력 맥락에 논문 상세로 넣는 최대 상위 편수. 정렬된 결과
 * 풀의 앞쪽 N편만 route-view reaction `viewSnapshot` prompt context에 들어간다 — 기본 검색
 * 풀이나 anchor-blend 주입으로 커진 풀 전체를 반응 입력에 싣지 않는다.
 * provider의 total 값이나 candidate-window size는 corpus 사실처럼 전달하지 않고,
 * size 라벨은 실제 번호로 제공된 현재 결과 수만 말한다.
 */
// @check-removes-fails: acceptance-check:search-reaction-summarizes-terrain-input-paper-cap
// AC says 반응 입력은 상위 N편으로 캡된다 — value-as-promise. The negative test in
// `__tests__/constants.contract.test.ts` asserts the literal `20` plus this
// marker, and `__tests__/view-snapshot.test.ts` asserts the slice boundary, so
// changing the value breaks vitest.
export const SEARCH_REACTION_INPUT_PAPER_LIMIT = 20;

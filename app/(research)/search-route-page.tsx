// @promise promise:search-url-restores-search
// @promise promise:search-results-fast-window
// @promise promise:research-route-cap-feedback
// @aspect aspect:first-paint-persistence-independence
// @check acceptance-check:search-results-fast-window-publication-year-range-filter
// @check acceptance-check:research-route-cap-feedback-condition-overflow

import { Suspense } from "react";
import { SearchResearchRouteRuntime } from "@/app/(research)/research-route-runtimes";
import { ConditionUrlRejectedState } from "@/app/components/research/ConditionUrlRejectedState";
import { resolveCurrentUser } from "@/app/server/auth/identity";
import {
  buildPendingSearchViewFromInput,
  buildSearchExecutionFromUrlParams,
  executeSearchFromUrl,
  validateSearchExecutionUrlParams,
  type SearchExecutionUrlParams,
  type SearchExecutionInput,
} from "@/app/server/services/search-execution";
import type { CurrentUser } from "@/app/server/auth/identity";

/** 세션이 생기기 전 검색 entry가 쓰는 익명 runtime 키. 소유 resource는 없다. */
const ANONYMOUS_RUNTIME_ID = "anonymous";

interface SearchPageProps {
  searchParams: Promise<
    SearchExecutionUrlParams & {
      entry?: string | string[];
    }
  >;
}

async function ResolvedSearchRoute({
  input,
  userPromise,
}: {
  input: SearchExecutionInput;
  userPromise: Promise<CurrentUser | null>;
}) {
  const user = await userPromise;
  if (!user) {
    // The shared ResearchRouteShell owns the post-mount 401 auth surface.
    return null;
  }

  const searchResult = executeSearchFromUrl({
    ownerPrincipalId: user.id,
    userEmail: user.email,
    input,
  });
  const { view: document } = await searchResult;

  return <SearchResearchRouteRuntime runtimeId={user.id} initialView={document} />;
}

export async function SearchRoutePage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const conditionValidation = validateSearchExecutionUrlParams(params);
  if (!conditionValidation.ok) {
    return <ConditionUrlRejectedState />;
  }
  const input = buildSearchExecutionFromUrlParams(params);

  // Search-first: 쿼리 없는 검색 entry는 server auth 왕복 전에 먼저 렌더된다.
  // runtimeId는 세션이 생기기 전까지 익명 키고, shell bootstrap 401은 인증 화면으로 전환한다.
  // @check acceptance-check:search-results-fast-window-bootstrap-auth-challenge
  if (!input) {
    return <SearchResearchRouteRuntime runtimeId={ANONYMOUS_RUNTIME_ID} initialSearchEntry />;
  }

  // @promise promise:search-url-restores-search
  // @check acceptance-check:search-url-restores-search-no-precreated-record
  const userPromise = resolveCurrentUser();
  const pendingDocument = buildPendingSearchViewFromInput({
    ownerPrincipalId: ANONYMOUS_RUNTIME_ID,
    input,
  });

  return (
    <Suspense
      fallback={
        <SearchResearchRouteRuntime
          runtimeId={ANONYMOUS_RUNTIME_ID}
          initialView={pendingDocument}
        />
      }
    >
      <ResolvedSearchRoute input={input} userPromise={userPromise} />
    </Suspense>
  );
}

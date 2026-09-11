import type { Metadata } from "next";

// @promise promise:search-results-fast-window
// @check acceptance-check:search-results-fast-window-bootstrap-auth-challenge

import { ResearchRouteShell } from "./research-route-shell";

// `absolute`로 research route 탭 타이틀을 정확히 "Moonlight Search"로 둔다.
// 루트 template(`%s | Moonlight Search`)을 상속하면 브랜드가 두 번 들어가
// "Moonlight Search | Moonlight Search"로 중복되므로 template을 우회한다.
export const metadata: Metadata = {
  title: { absolute: "Moonlight Search" },
};

export const dynamic = "force-dynamic";

// Search-first: 검색 entry first paint는 게이트·session-status 왕복·redirect를 기다리지 않는다.
// layout은 current user를 해석하지 않고 shell/children을 먼저 반환한다.
// 계정 chrome과 library bootstrap은 shell의 post-paint client bootstrap이 뒤따라
// 붙는다. bootstrap 401은 같은 content slot을 기존 인증 화면으로 전환한다.
export default function ResearchLayout({ children }: { children: React.ReactNode }) {
  return <ResearchRouteShell>{children}</ResearchRouteShell>;
}

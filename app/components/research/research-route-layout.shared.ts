export const INITIAL_SEARCH_PANEL_MAX_WIDTH_CLASS = "lg:max-w-[1180px]";
export const INITIAL_SEARCH_CONTENT_SHELL_CLASS =
  "mx-auto w-full max-w-[1040px] px-4 py-4 sm:px-6 lg:px-8";

export const RESEARCH_ROUTE_ROUTE_PANEL_MAX_WIDTH_CLASS = "lg:max-w-[1280px]";

// 읽기 rail 폭(max-w-[1080px])은 본문 한 줄 길이를 지속 읽기에 맞춘 값이다.
// 폭의 기준과 유도: docs/design-standards.md#reading-measure
// 값은 자유롭게 튜닝할 수 있다. 단일 출처와 시각화 rail과의 관계(넓이 순서)는
// __tests__/research-route-layout.shared.test.ts가 잠근다.
export const DOCUMENT_CONTENT_RAIL_MAX_WIDTH_CLASS = "max-w-[1080px]";
export const RESEARCH_ROUTE_ROUTE_CONTENT_SHELL_CLASS =
  "mx-auto w-full max-w-[1080px] pt-1 pb-4 sm:pt-2";
export const RESEARCH_ROUTE_BODY_RAIL_CLASS = "mx-auto w-full max-w-[1080px] pt-2 pb-5";
// 시각화 rail은 읽기 rail보다 넓다 (gap network 그래프 폭).
export const GAP_VIEW_CONTENT_SHELL_CLASS = "mx-auto w-full max-w-[1500px] pt-1 pb-4 sm:pt-2";

export const CENTERED_PANEL_MAX_WIDTH_CLASS = "lg:max-w-[1960px]";
export const CENTERED_PANEL_GRID_CLASS = "lg:grid-cols-[28rem_minmax(0,1fr)_28rem]";
export const CENTERED_PANEL_MAIN_CLASS = "min-w-0 lg:col-start-2";
export const CENTERED_PANEL_ASIDE_CLASS =
  "mt-4 min-w-0 lg:sticky lg:top-14 lg:col-start-3 lg:mt-0 lg:w-[28rem] lg:self-start";

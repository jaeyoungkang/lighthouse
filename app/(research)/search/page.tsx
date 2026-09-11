// @promise promise:research-route-cap-feedback
// @promise promise:search-results-fast-window
// @aspect aspect:search-first-url-model
// @check acceptance-check:research-route-cap-feedback-canonical-url

import { SearchRoutePage } from "@/app/(research)/search-route-page";

// 첫 공개는 keyword window와 discovery preflight를 함께 기다린다.
// @check acceptance-check:search-results-fast-window-library-first-response — worst
// case는 provider 병렬 30s + discovery `/papers/batch` 30s 수준이므로, 플랫폼 기본
// 300s에 맡기지 않고 페이지 데드라인을 명시적으로 등록한다.
export const maxDuration = 120;

export default SearchRoutePage;

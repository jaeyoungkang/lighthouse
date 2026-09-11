// @promise promise:search-results-fast-window
// @check acceptance-check:search-results-fast-window-bootstrap-auth-challenge
// @check acceptance-check:search-results-fast-window-result-basis-visible

// Search-first: 루트 `/`는 server gate·redirect 없이 빈 검색 entry를 먼저 렌더한다.
// 빈 `/search`와 같은 경로를 쓰고, post-mount bootstrap 401은 shell이 인증 화면으로 바꾼다.
import { SearchRoutePage } from "@/app/(research)/search-route-page";

export default SearchRoutePage;

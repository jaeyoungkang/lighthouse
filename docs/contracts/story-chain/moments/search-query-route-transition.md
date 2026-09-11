---
id: moment:search-query-route-transition
slug: search-query-route-transition
title: Search query route transition
experience: experience:research-and-discovery
---

# Search query route transition

연구자가 검색 결과를 검토하다가 다른 키워드로 탐색 방향을 바꾸려 한다.
이때 현재 결과와 AI 반응이 이미 판단 흐름을 만들고 있으므로, 새 검색이
그 흐름과 섞이면 안 된다.

Light House는 검색 query를 `/search?q=...` route 상태로 다룬다. 결과가 있는
검색 화면에서 새 query를 제출하면 주소가 새 조건으로 바뀌고 새 결과가 같은
주소에서 실행된다. 직전 결과로는 브라우저 뒤로가기로 돌아간다 — 각 검색이
자기 조건 주소를 가지므로 뒤로가기가 직전 검색 조건을 복원하고 그 검색이
다시 실행된다.

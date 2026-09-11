---
id: experience:operator-alignment-audit
slug: operator-alignment-audit
title: Operator alignment audit
scope: governance
---

CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/702#issuecomment-5446971384

# Operator alignment audit

Light House 운영자가 release 직전이나 정기 점검 중인 순간. 제품이
약속한 것과 실제로 닫힌 검증 사이에 빈틈이 없는지 확인한다. Promise는
늘어 가고 Aspect는 횡단한다. Evidence Ledger와 verdict는 여러 갈래로
흩어져 있다. 어디까지 닫혔고 어디가 열려 있는지를 한 사람의 머릿속에
다 담을 수 없다.

운영자는 alignment chain을 한 흐름으로 따라간다. Experience, Moment,
Promise, Aspect, Evidence Ledger, 실행 증거, 코드 surface의 연결이
검증 명령과 내부 문서 surface에 남는다. release
준비 상태는 Intent, AC trace, Service Policy Coverage, Aspect 네 차원으로
나뉜다. ledger에서
실행 명령과 app/ 증거까지 추적된다. Promise 옆에는 적용된 Aspect가
함께 읽힌다. 어떤 규칙이 어느 약속에 붙는지 확인할 수 있다. 의미
일치는 자동 게이트가 PR마다 잡아낸다. 근거가 stale이면 사람이 verdict만
바꿔 release를 통과시킬 수 없다.

이 경험은 이미 선언된 chain의 상태를 읽고 release 준비를 판정하는 일에
한정한다. 새 Promise나 Aspect의 의미를 정하는 것은 Mission Control 작업
자체이고 이 Experience 바깥이다. 약속을 외부·내부 청중에게 드러내는
표면은 `product-commitment-surface`로 분리된다.

이 항목을 `governance`로 분류한 이유는, 연구자가 논문을 다루는 핵심
제품 경험이 아니라 제품 약속을 운영하는 내부 governance experience이기
때문이다.

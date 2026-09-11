// gap-network builder content markdown messages — extracted to keep messages.ts under 700 lines.

const gapNetworkBuilderMessages = {
  "gapNetwork.label.gap-network-builder.section.domain": "## 분석된 분야",
  "gapNetwork.label.gap-network-builder.section.clusters": "## 클러스터 배경과 차이",
  "gapNetwork.label.gap-network-builder.section.gapInference": "## 공백 추론 방법",
  "gapNetwork.label.gap-network-builder.domain.intro":
    "이 보고서는 **{domainLabel}** 영역을 다룬다.",
  "gapNetwork.label.gap-network-builder.cluster.heading": "### {clusterLabel} ({paperCount}편)",
  "gapNetwork.label.gap-network-builder.cluster.fallbackWithConcepts":
    "{clusterLabel} 결을 공유하는 묶음. 주요 개념: {concepts}.",
  "gapNetwork.label.gap-network-builder.cluster.fallbackPlain":
    "{clusterLabel} 결을 공유하는 묶음.",
  "gapNetwork.label.gap-network-builder.gapInference.fallback":
    "클러스터 크기로 기대 교차 연결 수를 추정하고 실제 연결 수와 비교해 공백을 계산했다. 매개 개념과 인접 클러스터 신호를 보조로 활용한다.",
} as const;

export default gapNetworkBuilderMessages;

"use client";

// @promise promise:gap-report-prepared-reaction
//   AC4 — 수직 stack 페이지 구성의 본문 리포트 surface.
//   metadata.gapNetworkReport.domainLabel + contentNarrative를 React로 직접 렌더해
//   '## 분석된 분야' / '## 클러스터 배경과 차이' / '## 공백 추론 방법' 3 섹션을 노출한다.
// @aspect aspect:user-facing-language-governance
// @aspect aspect:visible-explanation-sufficiency
// @aspect aspect:ai-generated-content-feedback
// @aspect aspect:research-route-visual-hierarchy
// @check intent-check:cluster-background-and-comparison
// @check intent-check:gap-inference-method-traceable

import type { GapNetworkReport } from "@/app/domain/research-route-payload";
import { AiContentFeedback } from "@/app/components/ai-content-feedback";
import { t } from "@/app/i18n/message-access";

interface GapNetworkContentReportProps {
  documentId?: string | null;
  report: GapNetworkReport;
}

export function GapNetworkContentReport({
  documentId = null,
  report,
}: GapNetworkContentReportProps) {
  const domainLabel = report.domainLabel ?? null;
  const narrative = report.contentNarrative ?? {
    overview: "",
    clusterParagraphs: [],
    gapInferenceParagraph: "",
  };
  const paragraphByClusterId = new Map(
    narrative.clusterParagraphs.map((entry) => [entry.clusterId, entry.paragraph]),
  );
  const feedbackBody = [
    narrative.overview,
    ...report.clusters
      .map((cluster) => paragraphByClusterId.get(cluster.id) ?? cluster.narrative ?? "")
      .filter((paragraph) => paragraph.trim().length > 0),
    narrative.gapInferenceParagraph,
  ]
    .filter((paragraph) => paragraph.trim().length > 0)
    .join("\n\n");

  return (
    <article
      className="lh-tone-primary max-w-none px-1 py-6"
      data-testid="gap-network-content-report"
    >
      <section data-testid="gap-network-content-report-domain">
        <h2 className="lh-type-section-heading mt-0">
          {t("gapNetwork.label.gap-network-builder.section.domain").replace(/^##\s*/, "")}
        </h2>
        {domainLabel ? (
          <p
            className="lh-type-paper-title mt-2 mb-3"
            data-testid="gap-network-content-report-domain-label"
          >
            {domainLabel}
          </p>
        ) : null}
        {narrative.overview ? (
          <p className="lh-type-reading-body mt-2">{narrative.overview}</p>
        ) : null}
      </section>

      <section data-testid="gap-network-content-report-clusters" className="mt-6">
        <h2 className="lh-type-section-heading">
          {t("gapNetwork.label.gap-network-builder.section.clusters").replace(/^##\s*/, "")}
        </h2>
        {report.clusters.map((cluster) => {
          const paragraph = paragraphByClusterId.get(cluster.id) ?? cluster.narrative ?? null;
          return (
            <div
              key={cluster.id}
              data-testid="gap-network-content-report-cluster"
              data-cluster-id={cluster.id}
              className="mt-4"
            >
              <h3 className="lh-type-paper-title">
                {cluster.label}
                <span className="lh-type-metadata lh-tone-secondary">
                  {" "}
                  ({cluster.paperCount}편)
                </span>
              </h3>
              {paragraph ? <p className="lh-type-reading-body mt-1">{paragraph}</p> : null}
            </div>
          );
        })}
      </section>

      <section data-testid="gap-network-content-report-gap-inference" className="mt-6">
        <h2 className="lh-type-section-heading">
          {t("gapNetwork.label.gap-network-builder.section.gapInference").replace(/^##\s*/, "")}
        </h2>
        {narrative.gapInferenceParagraph ? (
          <>
            <p className="lh-type-reading-body mt-2">{narrative.gapInferenceParagraph}</p>
          </>
        ) : (
          <p className="lh-type-reading-body mt-2">
            {t("gapNetwork.label.gap-network-builder.gapInference.fallback")}
          </p>
        )}
      </section>
      {feedbackBody ? (
        <AiContentFeedback
          target={{
            documentId,
            documentType: "gap_network",
            surfaceId: "gap-content:report",
            surfaceKind: "gap_content_report",
            promiseRef: "promise:gap-report-prepared-reaction",
            outputSnapshot: {
              title: domainLabel ?? t("gapNetwork.label.gap-network-builder.section.domain"),
              body: feedbackBody,
            },
          }}
        />
      ) : null}
    </article>
  );
}

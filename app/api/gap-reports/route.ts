// @promise promise:gap-network-detection-from-search
// @promise promise:research-route-cap-feedback
// @promise promise:shared-gap-report-member-access
// @aspect aspect:search-first-url-model
// @aspect aspect:gap-build-principal-admission
// @check acceptance-check:gap-network-detection-from-search-entry-from-ai-comment
// @check acceptance-check:gap-network-detection-from-search-top-result-input-set
// @check acceptance-check:gap-network-detection-from-search-principal-build-limit
// @check acceptance-check:shared-gap-report-member-access-authenticated-sharing

import { after, NextResponse } from "next/server";
import { z } from "zod";
import { searchGraphSupportMetadataSchema } from "@/app/domain/research-route-payload-schema";
import {
  queueGapNetworkBuildRetryIfFailed,
  reserveGapNetworkViewFromSnapshot,
  startGapNetworkBuildJob,
} from "@/app/server/domain-access/gap-network-view-access";
import { requireOwnerPrincipalAuth } from "@/app/server/auth/identity";
import { withRouteGuard } from "@/app/server/guards/route-guard";
import { apiErrorResponse } from "@/app/server/http/api-error-response";
import { t } from "@/app/i18n/message-access";
import { isGapNetworkViewReadyForDisplay } from "@/app/lib/gap-network-view-core";
import {
  GAP_REPORT_INGRESS_LIMITS,
  GAP_REPORT_REQUEST_MAX_BYTES,
} from "@/app/lib/gap-report-input-budget";
import { normalizeGraphSourcePaperIds } from "@/app/lib/graph-source-paper-ids";
import { MAX_GRAPH_SOURCE_PAPERS } from "@/app/lib/constants";
import { findGapNetworkView } from "@/app/server/domain-access/gap-report-access";
import { readBoundedJsonBody, RequestBodyTooLargeError } from "@/app/server/lib/bounded-json-body";
import {
  admitGapBuildForPrincipal,
  releaseGapBuildForPrincipalSafely,
} from "@/app/server/domain-access/gap-build-principal-admission";

export const maxDuration = 60;

function hasDuplicates(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}

const GAP_PAPER_INPUT_FIELDS = new Set([
  "paperId",
  "title",
  "abstract",
  "year",
  "citationCount",
  "url",
  "authors",
  "openAccessPdf",
  "doi",
  "referenceIds",
  "citationIds",
]);
const GAP_AUTHOR_INPUT_FIELDS = new Set(["authorId", "name"]);
const GAP_OPEN_ACCESS_PDF_INPUT_FIELDS = new Set(["url", "status"]);
const GAP_REPORT_POST_INPUT_FIELDS = new Set([
  "gapReportId",
  "sourceSnapshotId",
  "sourceQuery",
  "sourcePaperIds",
  "papers",
  "graphSupport",
]);
const GAP_GRAPH_SUPPORT_COMMON_INPUT_FIELDS = [
  "version",
  "source",
  "basis",
  "status",
  "samplePaperIds",
  "paperScores",
  "generatedAt",
] as const;
const GAP_GRAPH_SUPPORT_V1_INPUT_FIELDS = new Set(GAP_GRAPH_SUPPORT_COMMON_INPUT_FIELDS);
const GAP_GRAPH_SUPPORT_LIBRARY_INPUT_FIELDS = new Set([
  ...GAP_GRAPH_SUPPORT_COMMON_INPUT_FIELDS,
  "anchorPaperCount",
  "candidateCounts",
]);
const GAP_GRAPH_SUPPORT_SNAPSHOT_INPUT_FIELDS = new Set(GAP_GRAPH_SUPPORT_COMMON_INPUT_FIELDS);
const GAP_GRAPH_SUPPORT_SCORE_INPUT_FIELDS = new Set([
  "defaultScore",
  "graphScore",
  "semanticScore",
  "sharedCiters",
  "sharedRefs",
  "seedCount",
  "sources",
]);
const GAP_GRAPH_SUPPORT_CANDIDATE_COUNT_INPUT_FIELDS = new Set([
  "providerReturned",
  "hydrated",
  "keywordOverlap",
  "admittedSupplement",
  "deferredByQueryRelevance",
  "filteredOut",
]);
const GAP_GRAPH_SUPPORT_FILTERED_COUNT_INPUT_FIELDS = new Set([
  "candidateCap",
  "hydrationUnavailable",
  "publicationYear",
  "nonPositiveScore",
  "titleFamilyDuplicate",
]);

const boundedGapPaperSchema = z
  .object({
    paperId: z.string(),
    title: z.string(),
    abstract: z.string().nullable(),
    year: z.number().nullable(),
    citationCount: z.number(),
    url: z.string(),
    authors: z.array(z.object({ authorId: z.string().optional(), name: z.string() }).strict()),
    openAccessPdf: z
      .object({ url: z.string(), status: z.string().nullable().optional() })
      .strict()
      .nullable()
      .optional(),
    doi: z.string().nullable().optional(),
    referenceIds: z.array(z.string()).nullable().optional(),
    citationIds: z.array(z.string()).nullable().optional(),
  })
  .strict()
  .superRefine((paper, ctx) => {
    const reject = (path: PropertyKey[], message: string) => {
      ctx.addIssue({ code: "custom", message, path });
    };
    if (paper.paperId.length > GAP_REPORT_INGRESS_LIMITS.paperIdChars) {
      reject(["paperId"], "paper id is too long");
    }
    if (paper.title.length > GAP_REPORT_INGRESS_LIMITS.paperTitleChars) {
      reject(["title"], "paper title is too long");
    }
    if ((paper.abstract?.length ?? 0) > GAP_REPORT_INGRESS_LIMITS.paperAbstractChars) {
      reject(["abstract"], "paper abstract is too long");
    }
    if (paper.url.length > GAP_REPORT_INGRESS_LIMITS.paperUrlChars) {
      reject(["url"], "paper url is too long");
    }
    if (paper.authors.length > GAP_REPORT_INGRESS_LIMITS.paperAuthors) {
      reject(["authors"], "too many authors");
    }
    paper.authors.forEach((author, index) => {
      if (author.name.length > GAP_REPORT_INGRESS_LIMITS.authorNameChars) {
        reject(["authors", index, "name"], "author name is too long");
      }
      if ((author.authorId?.length ?? 0) > GAP_REPORT_INGRESS_LIMITS.paperIdChars) {
        reject(["authors", index, "authorId"], "author id is too long");
      }
    });
    for (const [field, values] of [
      ["referenceIds", paper.referenceIds],
      ["citationIds", paper.citationIds],
    ] as const) {
      if ((values?.length ?? 0) > GAP_REPORT_INGRESS_LIMITS.paperRelationIds) {
        reject([field], `${field} is too large`);
      }
      if (values?.some((value) => value.length > GAP_REPORT_INGRESS_LIMITS.paperIdChars)) {
        reject([field], `${field} contains an oversized id`);
      }
      if (values && hasDuplicates(values)) reject([field], `${field} must be unique`);
    }
  });

const boundedGraphSupportSchema = searchGraphSupportMetadataSchema.superRefine((support, ctx) => {
  if (support.samplePaperIds.length > MAX_GRAPH_SOURCE_PAPERS) {
    ctx.addIssue({ code: "custom", message: "graph support sample is too large" });
  }
  if (Object.keys(support.paperScores).length > MAX_GRAPH_SOURCE_PAPERS) {
    ctx.addIssue({ code: "custom", message: "graph support score set is too large" });
  }
  if (hasDuplicates(support.samplePaperIds)) {
    ctx.addIssue({ code: "custom", message: "graph support sample ids must be unique" });
  }
  support.samplePaperIds.forEach((paperId, index) => {
    if (paperId.length > GAP_REPORT_INGRESS_LIMITS.paperIdChars) {
      ctx.addIssue({
        code: "custom",
        message: "graph support paper id is too long",
        path: ["samplePaperIds", index],
      });
    }
  });
  Object.entries(support.paperScores).forEach(([paperId, score]) => {
    if (paperId.length > GAP_REPORT_INGRESS_LIMITS.paperIdChars) {
      ctx.addIssue({ code: "custom", message: "graph support score id is too long" });
    }
    if (
      score.sources.length > GAP_REPORT_INGRESS_LIMITS.graphScoreSources ||
      hasDuplicates(score.sources)
    ) {
      ctx.addIssue({ code: "custom", message: "graph support sources are invalid" });
    }
    if (score.sources.some((source) => source.length > GAP_REPORT_INGRESS_LIMITS.paperIdChars)) {
      ctx.addIssue({ code: "custom", message: "graph support source is too long" });
    }
  });
});

const createGapNetworkViewSchema = z
  .object({
    sourceSnapshotId: z.string().trim().min(1).max(GAP_REPORT_INGRESS_LIMITS.sourceSnapshotIdChars),
    sourceQuery: z.string().trim().min(1).max(GAP_REPORT_INGRESS_LIMITS.sourceQueryChars),
    sourcePaperIds: z
      .array(z.string().trim().min(1).max(GAP_REPORT_INGRESS_LIMITS.paperIdChars))
      .max(MAX_GRAPH_SOURCE_PAPERS)
      .optional(),
    papers: z.array(boundedGapPaperSchema).min(1).max(MAX_GRAPH_SOURCE_PAPERS),
    graphSupport: boundedGraphSupportSchema.optional(),
  })
  .strict()
  .superRefine((input, ctx) => {
    const paperIds = input.papers.map((paper) => paper.paperId);
    if (new Set(paperIds).size !== paperIds.length) {
      ctx.addIssue({ code: "custom", message: "paper ids must be unique", path: ["papers"] });
    }
    if (input.sourcePaperIds) {
      if (new Set(input.sourcePaperIds).size !== input.sourcePaperIds.length) {
        ctx.addIssue({
          code: "custom",
          message: "source paper ids must be unique",
          path: ["sourcePaperIds"],
        });
      }
      const availablePaperIds = new Set(paperIds);
      if (input.sourcePaperIds.some((paperId) => !availablePaperIds.has(paperId))) {
        ctx.addIssue({
          code: "custom",
          message: "source paper ids must belong to papers",
          path: ["sourcePaperIds"],
        });
      }
    }
  });

const recoverGapNetworkViewSchema = z.object({ gapReportId: z.uuid() }).strict();
const gapNetworkPostSchema = z.union([recoverGapNetworkViewSchema, createGapNetworkViewSchema]);

const MAX_GAP_REPORT_VALIDATION_ISSUES = 50;
type GapReportValidationIssue = { path: string; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function findUnknownFieldIssue(
  record: Record<string, unknown>,
  allowedFields: ReadonlySet<string>,
  path: string,
  message: string,
): GapReportValidationIssue | null {
  for (const field in record) {
    if (Object.hasOwn(record, field) && !allowedFields.has(field)) {
      return { path: `${path}.${field}`, message };
    }
  }
  return null;
}

function findStringArrayShapeIssue(
  value: unknown,
  path: string,
  limit: number,
  tooLargeMessage: string,
  invalidMessage: string,
): GapReportValidationIssue | null {
  if (!Array.isArray(value)) return null;
  if (value.length > limit) return { path, message: tooLargeMessage };
  if (value.some((item) => typeof item !== "string")) {
    return { path, message: invalidMessage };
  }
  return null;
}

function findAuthorIssue(authors: unknown, paperIndex: number): GapReportValidationIssue | null {
  if (!Array.isArray(authors)) return null;
  const path = `papers.${String(paperIndex)}.authors`;
  if (authors.length > GAP_REPORT_INGRESS_LIMITS.paperAuthors) {
    return { path, message: "too many authors" };
  }
  for (const [authorIndex, author] of authors.entries()) {
    if (!isRecord(author)) return { path, message: "authors are invalid" };
    const issue = findUnknownFieldIssue(
      author,
      GAP_AUTHOR_INPUT_FIELDS,
      `${path}.${String(authorIndex)}`,
      "author field is not allowed",
    );
    if (issue) return issue;
  }
  return null;
}

function findPaperIssue(paper: unknown, paperIndex: number): GapReportValidationIssue | null {
  const path = `papers.${String(paperIndex)}`;
  if (!isRecord(paper)) return { path, message: "paper is invalid" };
  const fieldIssue = findUnknownFieldIssue(
    paper,
    GAP_PAPER_INPUT_FIELDS,
    path,
    "paper field is not allowed",
  );
  if (fieldIssue) return fieldIssue;
  const authorIssue = findAuthorIssue(paper.authors, paperIndex);
  if (authorIssue) return authorIssue;
  if (isRecord(paper.openAccessPdf)) {
    const pdfIssue = findUnknownFieldIssue(
      paper.openAccessPdf,
      GAP_OPEN_ACCESS_PDF_INPUT_FIELDS,
      `${path}.openAccessPdf`,
      "open access PDF field is not allowed",
    );
    if (pdfIssue) return pdfIssue;
  }
  for (const field of ["referenceIds", "citationIds"] as const) {
    const relationIssue = findStringArrayShapeIssue(
      paper[field],
      `${path}.${field}`,
      GAP_REPORT_INGRESS_LIMITS.paperRelationIds,
      `${field} is too large`,
      `${field} contains an invalid id`,
    );
    if (relationIssue) return relationIssue;
  }
  return null;
}

function findPapersIssue(papers: unknown): GapReportValidationIssue | null {
  if (!Array.isArray(papers)) return null;
  if (papers.length > MAX_GRAPH_SOURCE_PAPERS) {
    return { path: "papers", message: "too many papers" };
  }
  for (const [paperIndex, paper] of papers.entries()) {
    const issue = findPaperIssue(paper, paperIndex);
    if (issue) return issue;
  }
  return null;
}

function hasMoreThanOwnFields(record: Record<string, unknown>, limit: number): boolean {
  let scoreCount = 0;
  for (const field in record) {
    if (!Object.hasOwn(record, field)) continue;
    if (scoreCount >= limit) return true;
    scoreCount += 1;
  }
  return false;
}

function findPaperScoresIssue(paperScores: unknown): GapReportValidationIssue | null {
  if (!isRecord(paperScores)) return null;
  if (hasMoreThanOwnFields(paperScores, MAX_GRAPH_SOURCE_PAPERS)) {
    return { path: "graphSupport.paperScores", message: "graph support score set is too large" };
  }
  let scoreIndex = 0;
  for (const paperId in paperScores) {
    if (!Object.hasOwn(paperScores, paperId)) continue;
    const score = paperScores[paperId];
    if (!isRecord(score)) {
      return {
        path: `graphSupport.paperScores.${String(scoreIndex)}`,
        message: "graph support score is invalid",
      };
    }
    const fieldIssue = findUnknownFieldIssue(
      score,
      GAP_GRAPH_SUPPORT_SCORE_INPUT_FIELDS,
      `graphSupport.paperScores.${String(scoreIndex)}`,
      "graph support score field is not allowed",
    );
    if (fieldIssue) return fieldIssue;
    if (!Array.isArray(score.sources)) {
      return {
        path: `graphSupport.paperScores.${String(scoreIndex)}.sources`,
        message: "graph support sources are invalid",
      };
    }
    if (
      score.sources.length > GAP_REPORT_INGRESS_LIMITS.graphScoreSources ||
      score.sources.some((source) => typeof source !== "string")
    ) {
      return {
        path: `graphSupport.paperScores.${String(scoreIndex)}.sources`,
        message: "graph support sources are invalid",
      };
    }
    scoreIndex += 1;
  }
  return null;
}

function findCandidateCountsIssue(candidateCounts: unknown): GapReportValidationIssue | null {
  if (!isRecord(candidateCounts)) return null;
  const fieldIssue = findUnknownFieldIssue(
    candidateCounts,
    GAP_GRAPH_SUPPORT_CANDIDATE_COUNT_INPUT_FIELDS,
    "graphSupport.candidateCounts",
    "graph support candidate count field is not allowed",
  );
  if (fieldIssue) return fieldIssue;
  if (!isRecord(candidateCounts.filteredOut)) return null;
  return findUnknownFieldIssue(
    candidateCounts.filteredOut,
    GAP_GRAPH_SUPPORT_FILTERED_COUNT_INPUT_FIELDS,
    "graphSupport.candidateCounts.filteredOut",
    "graph support filtered count field is not allowed",
  );
}

function findGraphSupportIssue(graphSupport: unknown): GapReportValidationIssue | null {
  if (!isRecord(graphSupport)) return null;
  const allowedFields =
    graphSupport.version === 1 && graphSupport.basis === "loaded_result_sample"
      ? GAP_GRAPH_SUPPORT_V1_INPUT_FIELDS
      : graphSupport.version === 2 && graphSupport.basis === "library_anchor_neighborhood"
        ? GAP_GRAPH_SUPPORT_LIBRARY_INPUT_FIELDS
        : GAP_GRAPH_SUPPORT_SNAPSHOT_INPUT_FIELDS;
  const fieldIssue = findUnknownFieldIssue(
    graphSupport,
    allowedFields,
    "graphSupport",
    "graph support field is not allowed",
  );
  if (fieldIssue) return fieldIssue;
  const candidateCountsIssue = findCandidateCountsIssue(graphSupport.candidateCounts);
  if (candidateCountsIssue) return candidateCountsIssue;
  const sampleIssue = findStringArrayShapeIssue(
    graphSupport.samplePaperIds,
    "graphSupport.samplePaperIds",
    MAX_GRAPH_SOURCE_PAPERS,
    "graph support sample is too large",
    "graph support sample ids are invalid",
  );
  if (sampleIssue) return sampleIssue;
  return findPaperScoresIssue(graphSupport.paperScores);
}

function listCollectionLimitIssues(body: unknown): GapReportValidationIssue[] {
  if (!isRecord(body)) return [];
  const fieldIssue = findUnknownFieldIssue(
    body,
    GAP_REPORT_POST_INPUT_FIELDS,
    "$",
    "request field is not allowed",
  );
  if (fieldIssue) return [fieldIssue];
  const sourcePaperIssue = findStringArrayShapeIssue(
    body.sourcePaperIds,
    "sourcePaperIds",
    MAX_GRAPH_SOURCE_PAPERS,
    "too many source paper ids",
    "source paper ids are invalid",
  );
  if (sourcePaperIssue) return [sourcePaperIssue];
  const papersIssue = findPapersIssue(body.papers);
  if (papersIssue) return [papersIssue];
  const graphSupportIssue = findGraphSupportIssue(body.graphSupport);
  return graphSupportIssue ? [graphSupportIssue] : [];
}

function listValidationIssues(error: z.ZodError): GapReportValidationIssue[] {
  return error.issues.slice(0, MAX_GAP_REPORT_VALIDATION_ISSUES).map((issue) => ({
    path: issue.path.map(String).join(".") || "$",
    message: issue.message,
  }));
}

export const POST = withRouteGuard(async (req: Request) => {
  const { db, user } = await requireOwnerPrincipalAuth();
  let body: unknown;
  try {
    body = await readBoundedJsonBody(req, { maxBytes: GAP_REPORT_REQUEST_MAX_BYTES });
  } catch (error) {
    if (!(error instanceof RequestBodyTooLargeError)) throw error;
    return apiErrorResponse({
      status: 413,
      code: "GAP_REPORT_REQUEST_TOO_LARGE",
      message: t("common.error.request-body-too-large"),
    });
  }
  const collectionLimitIssues = listCollectionLimitIssues(body);
  if (collectionLimitIssues.length > 0) {
    return apiErrorResponse({
      status: 400,
      code: "GAP_REPORT_COLLECTION_LIMIT_INVALID",
      message: "invalid gap report payload",
      extensions: { issues: collectionLimitIssues },
    });
  }
  const parsed = gapNetworkPostSchema.safeParse(body);

  if (!parsed.success) {
    return apiErrorResponse({
      status: 400,
      code: "GAP_REPORT_PAYLOAD_INVALID",
      message: "invalid gap report payload",
      extensions: { issues: listValidationIssues(parsed.error) },
    });
  }

  let doc =
    "gapReportId" in parsed.data
      ? await findGapNetworkView(parsed.data.gapReportId)
      : await reserveGapNetworkViewFromSnapshot({
          sourceSnapshotId: parsed.data.sourceSnapshotId,
          sourceQuery: parsed.data.sourceQuery,
          sourcePaperIds: normalizeGraphSourcePaperIds(parsed.data.sourcePaperIds),
          papers: parsed.data.papers,
          graphSupport: parsed.data.graphSupport,
        });
  if (!doc) {
    return apiErrorResponse({
      status: 404,
      code: "GAP_REPORT_NOT_FOUND",
      message: "gap report not found",
    });
  }
  let isDisplayReady = isGapNetworkViewReadyForDisplay(doc);

  if (!isDisplayReady) {
    const admission = await admitGapBuildForPrincipal({
      db,
      principalId: user.id,
      gapReportId: doc.id,
    });
    if (admission.outcome === "blocked") {
      return apiErrorResponse({
        status: 429,
        code: "GAP_BUILD_PRINCIPAL_ADMISSION_LIMIT",
        message: "another gap report is still being calculated",
        action: "wait-and-retry",
        retryable: true,
        retryAfterSeconds: admission.retryAfterSeconds,
        metadata: { activeGapReportId: admission.activeGapReportId },
      });
    }
    if (admission.outcome === "same_report") {
      return NextResponse.json({ gapReportId: doc.id, status: "pending" }, { status: 202 });
    }

    try {
      doc = await queueGapNetworkBuildRetryIfFailed({
        db,
        runtimePrincipalId: user.id,
        document: doc,
      });
    } catch (error) {
      await releaseGapBuildForPrincipalSafely({
        db,
        principalId: user.id,
        gapReportId: doc.id,
        leaseToken: admission.leaseToken,
      });
      throw error;
    }
    isDisplayReady = isGapNetworkViewReadyForDisplay(doc);
    if (isDisplayReady) {
      await releaseGapBuildForPrincipalSafely({
        db,
        principalId: user.id,
        gapReportId: doc.id,
        leaseToken: admission.leaseToken,
      });
      return NextResponse.json({ gapReportId: doc.id, status: "ready" }, { status: 201 });
    }
    const scheduledGapReportId = doc.id;
    const runBuildJob = () =>
      startGapNetworkBuildJob({
        db,
        runtimePrincipalId: user.id,
        gapReportId: scheduledGapReportId,
        admission,
      });

    try {
      after(runBuildJob);
    } catch {
      void runBuildJob();
    }
  }

  return NextResponse.json(
    {
      gapReportId: doc.id,
      status: isDisplayReady ? "ready" : "pending",
    },
    { status: isDisplayReady ? 201 : 202 },
  );
});

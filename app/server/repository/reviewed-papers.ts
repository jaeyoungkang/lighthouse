import type { RepositoryDbHandle } from "./db";
import { getLighthouseDbFor } from "./db";
import { parseRows } from "./row-parsers";
import { z } from "zod";

export interface ReviewedPaperInput {
  paperId: string;
  title: string;
  url?: string;
  authors?: { name: string }[];
  year?: number | null;
  citationCount?: number;
}

export interface ReviewedPaper {
  id: string;
  userId: string;
  paperId: string;
  title: string;
  url: string | null;
  authors: { name: string }[];
  year: number | null;
  citationCount: number | null;
  reviewedAt: string;
}

const reviewedStatusRowSchema = z.object({
  paper_id: z.string(),
  reviewed_at: z.string(),
});

const reviewedPaperAuthorSchema = z.object({
  name: z.string(),
});

const reviewedPaperRowSchema = z.object({
  id: z.string(),
  user_id: z.string().nullable().optional(),
  owner_principal_id: z.string(),
  paper_id: z.string(),
  title: z.string(),
  url: z.string().nullable(),
  authors: z.array(reviewedPaperAuthorSchema),
  year: z.number().nullable(),
  citation_count: z.number().nullable(),
  reviewed_at: z.string(),
});

export const REVIEWED_STATUS_REF_QUERY_BUDGET = 6_000;
export const REVIEWED_STATUS_MAX_REF_CHARACTERS = 256;
export const REVIEWED_STATUS_MAX_REFS = 2_048;
export const REVIEWED_STATUS_MAX_CONCURRENCY = 4;

function postgrestEncodedRefSize(paperId: string): number {
  const parameter = new URLSearchParams({ paper_id: paperId }).toString();
  return parameter.length - "paper_id=".length + 16;
}

export function chunkReviewedStatusPaperRefs(paperIds: readonly string[]): string[][] {
  const chunks: string[][] = [];
  let current: string[] = [];
  let currentSize = 0;
  const boundedPaperIds = Array.from(new Set(paperIds))
    .filter((paperId) => Array.from(paperId).length <= REVIEWED_STATUS_MAX_REF_CHARACTERS)
    .slice(0, REVIEWED_STATUS_MAX_REFS);
  for (const paperId of boundedPaperIds) {
    // PostgREST transports `.in(...)` through the query string. Account for
    // percent encoding plus the comma/quote syntax while staying below the
    // common 8 KiB request-line boundary.
    const encodedSize = postgrestEncodedRefSize(paperId);
    if (current.length > 0 && currentSize + encodedSize > REVIEWED_STATUS_REF_QUERY_BUDGET) {
      chunks.push(current);
      current = [];
      currentSize = 0;
    }
    current.push(paperId);
    currentSize += encodedSize;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

/** 논문을 검토 완료로 마킹 (upsert) */
export async function markAsReviewed(
  db: RepositoryDbHandle,
  userId: string,
  paper: ReviewedPaperInput,
): Promise<void> {
  const { error } = await getLighthouseDbFor(db)
    .from("reviewed_papers")
    .upsert(
      {
        owner_principal_id: userId,
        paper_id: paper.paperId,
        title: paper.title,
        url: paper.url ?? null,
        authors: paper.authors ?? [],
        year: paper.year ?? null,
        citation_count: paper.citationCount ?? null,
        reviewed_at: new Date().toISOString(),
      },
      { onConflict: "owner_principal_id,paper_id" },
    );

  if (error) throw error;
}

/** paperId 배열 → 검토 여부 맵 (paperId → reviewedAt) */
export async function getReviewedStatus(
  db: RepositoryDbHandle,
  userId: string,
  paperIds: string[],
): Promise<Map<string, Date>> {
  if (paperIds.length === 0) return new Map();

  const map = new Map<string, Date>();
  const chunks = chunkReviewedStatusPaperRefs(paperIds);
  for (let index = 0; index < chunks.length; index += REVIEWED_STATUS_MAX_CONCURRENCY) {
    const results = await Promise.all(
      chunks
        .slice(index, index + REVIEWED_STATUS_MAX_CONCURRENCY)
        .map((paperIdChunk) =>
          getLighthouseDbFor(db)
            .from("reviewed_papers")
            .select("paper_id, reviewed_at")
            .eq("owner_principal_id", userId)
            .in("paper_id", paperIdChunk),
        ),
    );
    for (const { data, error } of results) {
      if (error) throw error;
      for (const row of parseRows(reviewedStatusRowSchema, data, "reviewed_papers status")) {
        map.set(row.paper_id, new Date(row.reviewed_at));
      }
    }
  }
  return map;
}

/** 검토한 논문 전체 목록 (최신순) */
export async function listReviewedPapers(
  db: RepositoryDbHandle,
  userId: string,
  options: { limit?: number } = {},
): Promise<ReviewedPaper[]> {
  const query = getLighthouseDbFor(db)
    .from("reviewed_papers")
    .select("*")
    .eq("owner_principal_id", userId)
    .order("reviewed_at", { ascending: false })
    .order("id", { ascending: false });
  const { data, error } = options.limit ? await query.limit(options.limit) : await query;

  if (error) throw error;

  return parseRows(reviewedPaperRowSchema, data, "reviewed_papers list").map((row) => ({
    id: row.id,
    userId: row.owner_principal_id,
    paperId: row.paper_id,
    title: row.title,
    url: row.url,
    authors: row.authors as { name: string }[],
    year: row.year,
    citationCount: row.citation_count,
    reviewedAt: row.reviewed_at,
  }));
}

/** 검토 해제 */
export async function unmarkReviewed(
  db: RepositoryDbHandle,
  userId: string,
  paperId: string,
): Promise<void> {
  const { error } = await getLighthouseDbFor(db)
    .from("reviewed_papers")
    .delete()
    .eq("owner_principal_id", userId)
    .eq("paper_id", paperId);

  if (error) throw error;
}

/**
 * 현재 사용자 기준 reviewed papers 접근.
 * route → domain-access → repository 경로에서 사용한다.
 */

import { requireOwnerPrincipalAuth } from "@/app/server/auth/identity";
import type { AuthContext } from "@/app/server/auth/identity";
import type { LibraryContextUserSource } from "@/app/server/services/library-context-source";
import { MOONLIGHT_LIBRARY_MAX_PAPERS } from "@/app/server/services/library-context-source";
import {
  listReviewedPapers,
  markAsReviewed,
  unmarkReviewed,
  type ReviewedPaper,
  type ReviewedPaperInput,
} from "@/app/server/repository/reviewed-papers";

/** 현재 사용자의 검토 논문 목록 */
export async function listMyReviewedPapers(authContext?: AuthContext): Promise<ReviewedPaper[]> {
  const { db, user } = authContext ?? (await requireOwnerPrincipalAuth());
  return listReviewedPapers(db, user.id);
}

export async function resolveMyReviewedPapersLibraryContextSource(): Promise<LibraryContextUserSource> {
  const { db, user } = await requireOwnerPrincipalAuth();
  const reviewedPapers = await listReviewedPapers(db, user.id, {
    limit: MOONLIGHT_LIBRARY_MAX_PAPERS,
  });
  return { reviewedPapers };
}

/** 현재 사용자의 논문 검토 마킹 */
export async function markMyReviewedPaper(
  paper: ReviewedPaperInput,
  authContext?: AuthContext,
): Promise<void> {
  const { db, user } = authContext ?? (await requireOwnerPrincipalAuth());
  await markAsReviewed(db, user.id, paper);
}

/** 현재 사용자의 논문 검토 해제 */
export async function unmarkMyReviewedPaper(
  paperId: string,
  authContext?: AuthContext,
): Promise<void> {
  const { db, user } = authContext ?? (await requireOwnerPrincipalAuth());
  await unmarkReviewed(db, user.id, paperId);
}

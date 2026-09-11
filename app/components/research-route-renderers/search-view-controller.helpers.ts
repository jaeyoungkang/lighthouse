import { researchRoutePayloadSchema } from "@/app/domain/research-route-payload-schema";
import {
  type ResearchRoutePayload,
  type SearchMetadata,
} from "@/app/domain/research-route-payload";

export function buildSearchResultWindowKey(metadata: SearchMetadata): string {
  const paperIds = metadata.papers.map((paper) => paper.paperId);
  return JSON.stringify([metadata.query, metadata.papers.length, paperIds]);
}

export async function parseDocumentResponse(
  response: Response,
): Promise<ResearchRoutePayload | null> {
  const raw: unknown = await response.json().catch((): unknown => null);
  const parsed = researchRoutePayloadSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

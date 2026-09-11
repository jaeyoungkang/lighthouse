import { describe, expect, it } from "vitest";
import {
  buildKnowledgeMapFailedTitle,
  buildKnowledgeMapPendingTitle,
  buildKnowledgeMapTitle,
  getKnowledgeMapDisplayName,
  getKnowledgeMapLensChipLabel,
  getKnowledgeMapLensTitle,
} from "@/app/lib/knowledge-map-lens";

describe("buildKnowledgeMapTitle", () => {
  it("E2 branch uses derived domain label when provided", () => {
    const title = buildKnowledgeMapTitle("E2", "AI agents memory retrieval", {
      domainLabel: "자율 LLM 에이전트와 메모리/검색 보강",
    });
    expect(title).toBe("연구 공백 리포트: 자율 LLM 에이전트와 메모리/검색 보강");
    expect(title).not.toContain("AI agents memory retrieval");
  });

  it("falls back to query when domain label is missing", () => {
    expect(buildKnowledgeMapTitle("E2", "AI agents")).toBe("연구 공백 리포트: AI agents");
    expect(buildKnowledgeMapTitle("E2", "AI agents", { domainLabel: undefined })).toBe(
      "연구 공백 리포트: AI agents",
    );
  });

  it("does not change behaviour when domainLabel is an empty string", () => {
    expect(buildKnowledgeMapTitle("E2", "AI agents", { domainLabel: "" })).toBe(
      "연구 공백 리포트: AI agents",
    );
  });

  it("keeps display, chip, pending, and failed titles on the same E2 label", () => {
    expect(getKnowledgeMapDisplayName("E2")).toBe("연구 공백 리포트");
    expect(getKnowledgeMapLensTitle("E2")).toBe("연구 공백 리포트");
    expect(getKnowledgeMapLensChipLabel("E2")).toBe("연구 공백 리포트");
    expect(buildKnowledgeMapPendingTitle("E2")).toBe("연구 공백 리포트 생성 중");
    expect(buildKnowledgeMapFailedTitle("E2")).toBe("연구 공백 리포트 생성 실패");
  });
});

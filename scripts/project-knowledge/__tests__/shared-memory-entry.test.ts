import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  lookupSharedReviewId,
  renderSharedMemoryEntry,
  sharedMemoryAppendSeparator,
  validateSharedMemoryFrames,
} from "../shared-memory-entry.mjs";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const PROCESS_ID = "22222222-2222-4222-8222-222222222222";

function entry(reviewId: string, lane: "project" | "process", narrative: string): string {
  return renderSharedMemoryEntry({
    reviewId,
    date: "2026-08-10",
    sourcePath: ".project-knowledge-local/candidate.md",
    candidate: `---
status: candidate
knowledge_lane: ${lane}
authority_refs:
  - docs/agent-skills.md
source_refs:
  - commit: 60a9d7781ded06374b15212d01b6a609a9811424
---

# Narrative

${narrative}`,
  });
}

function rewriteHeaderLane(frame: string, lane: "project" | "process"): string {
  const headerEnd = frame.indexOf("\n") + 1;
  const header = frame.slice(0, headerEnd);
  const match = /id=([0-9a-f-]+) lane=(project|process) bytes=([0-9]+)/.exec(header);
  if (!match) throw new Error("frame header not found");
  const [, reviewId, previousLane, byteLengthText] = match;
  const source = Buffer.from(frame, "utf8");
  const payload = source.subarray(
    Buffer.byteLength(header, "utf8"),
    Buffer.byteLength(header, "utf8") + Number(byteLengthText),
  );
  const digest = createHash("sha256")
    .update(Buffer.from(`v1\0${reviewId}\0${lane}\0`, "utf8"))
    .update(payload)
    .digest("hex");
  return frame
    .replace(`lane=${previousLane}`, `lane=${lane}`)
    .replace(/sha256=[0-9a-f]{64}/, `sha256=${digest}`);
}

function rewritePayload(frame: string, transform: (payload: Buffer) => Buffer): string {
  const headerEnd = frame.indexOf("\n") + 1;
  const header = frame.slice(0, headerEnd);
  const match = /id=([0-9a-f-]+) lane=(project|process) bytes=([0-9]+)/.exec(header);
  if (!match) throw new Error("frame header not found");
  const [, reviewId, lane, byteLengthText] = match;
  const source = Buffer.from(frame, "utf8");
  const payloadStart = Buffer.byteLength(header, "utf8");
  const payload = transform(source.subarray(payloadStart, payloadStart + Number(byteLengthText)));
  const digest = createHash("sha256")
    .update(Buffer.from(`v1\0${reviewId}\0${lane}\0`, "utf8"))
    .update(payload)
    .digest("hex");
  const rewrittenHeader = header
    .replace(/bytes=[0-9]+/, `bytes=${String(payload.length)}`)
    .replace(/sha256=[0-9a-f]{64}/, `sha256=${digest}`);
  return `${rewrittenHeader}${payload.toString("utf8")}<!-- /project-knowledge-entry:v1 id=${reviewId} -->\n`;
}

describe("Project Knowledge shared-memory entry framing", () => {
  it("validates project and process frames while preserving legacy residue", () => {
    const legacy = "# Shared memory\n\n기존 한글·emoji 🧭·e\u0301 기억\n";
    const markdown = `${legacy}${entry(PROJECT_ID, "project", "프로젝트 판단")}${entry(
      PROCESS_ID,
      "process",
      "process rationale",
    )}`;

    expect(markdown.startsWith(legacy)).toBe(true);
    expect(validateSharedMemoryFrames(markdown)).toEqual({ valid: true, reasons: [] });
    expect(lookupSharedReviewId(markdown, PROJECT_ID)).toEqual({
      completeCount: 1,
      legacyCount: 0,
      malformedMention: false,
      documentValid: true,
    });
  });

  it("recognizes a canonical frame at byte zero", () => {
    const framed = entry(PROJECT_ID, "project", "project at byte zero");

    expect(validateSharedMemoryFrames(framed).valid).toBe(true);
    expect(lookupSharedReviewId(framed, PROJECT_ID).completeCount).toBe(1);
  });

  it("uses exactly one LF only when the existing memory lacks a final LF", () => {
    expect(sharedMemoryAppendSeparator("")).toBe("");
    expect(sharedMemoryAppendSeparator("already terminated\n")).toBe("");
    expect(sharedMemoryAppendSeparator("not terminated")).toBe("\n");
    expect(sharedMemoryAppendSeparator(Buffer.from([0xff, 0x0a]))).toBe("");
  });

  it("keeps a complete frame-shaped narrative example inert", () => {
    const nested = entry(PROCESS_ID, "process", "nested process example");
    const outer = entry(
      PROJECT_ID,
      "project",
      `아래 문자열은 설명용 예시다.\n${nested}\n## 2026-08-10 공유 기억\n---`,
    );

    expect(validateSharedMemoryFrames(outer).valid).toBe(true);
    expect(lookupSharedReviewId(outer, PROJECT_ID).completeCount).toBe(1);
    expect(lookupSharedReviewId(outer, PROCESS_ID).completeCount).toBe(0);
  });

  it.each([
    ["negative length", "bytes=-1"],
    ["non-decimal length", "bytes=abc"],
    ["oversized length", "bytes=999999999"],
    ["unsupported version", "project-knowledge-entry:v2"],
  ])("rejects a %s frame", (_name, replacement) => {
    const valid = entry(PROJECT_ID, "project", "project");
    const malformed = replacement.startsWith("bytes=")
      ? valid.replace(/bytes=[0-9]+/, replacement)
      : valid.replace("project-knowledge-entry:v1", replacement);

    expect(validateSharedMemoryFrames(malformed).valid).toBe(false);
  });

  it("rejects a digest-valid payload with a non-canonical prefix", () => {
    const forged = rewritePayload(entry(PROJECT_ID, "project", "forged prefix"), (payload) =>
      Buffer.concat([Buffer.from("ARBITRARY PREFIX\n", "utf8"), payload]),
    );

    expect(validateSharedMemoryFrames(forged).valid).toBe(false);
    expect(lookupSharedReviewId(forged, PROJECT_ID)).toEqual(
      expect.objectContaining({ completeCount: 0, documentValid: false }),
    );
  });

  it("rejects a framed authority ref that does not resolve in the repository", () => {
    const missingAuthority = renderSharedMemoryEntry({
      reviewId: PROJECT_ID,
      date: "2026-08-10",
      sourcePath: ".project-knowledge-local/candidate.md",
      candidate: `---
knowledge_lane: project
authority_refs:
  - docs/definitely-missing-authority.md
---

# Missing authority`,
    });

    expect(validateSharedMemoryFrames(missingAuthority).valid).toBe(false);
    expect(lookupSharedReviewId(missingAuthority, PROJECT_ID).completeCount).toBe(0);
  });

  it("rejects digest and trailer damage", () => {
    const valid = entry(PROJECT_ID, "project", "project");
    const digestMismatch = valid.replace(/sha256=[0-9a-f]{64}/, `sha256=${"0".repeat(64)}`);
    const missingTrailer = valid.replace(
      `<!-- /project-knowledge-entry:v1 id=${PROJECT_ID} -->`,
      "",
    );

    expect(validateSharedMemoryFrames(digestMismatch).valid).toBe(false);
    expect(validateSharedMemoryFrames(missingTrailer).valid).toBe(false);
  });

  it("rejects unsupported and mismatched lanes", () => {
    const unsupported = entry(PROJECT_ID, "project", "project").replace(
      "lane=project",
      "lane=unknown",
    );
    const mismatched = rewriteHeaderLane(entry(PROJECT_ID, "process", "mismatch"), "project");

    expect(validateSharedMemoryFrames(unsupported).valid).toBe(false);
    expect(validateSharedMemoryFrames(mismatched).valid).toBe(false);
  });

  it("requires authority metadata before rendering a canonical frame", () => {
    expect(() =>
      renderSharedMemoryEntry({
        reviewId: PROJECT_ID,
        date: "2026-08-10",
        sourcePath: ".project-knowledge-local/candidate.md",
        candidate: `---\nknowledge_lane: project\n---\n\n# Missing authority`,
      }),
    ).toThrow("authority_refs");
  });

  it("does not synthesize a legacy review marker across residue boundaries", () => {
    const framedProject = entry(PROJECT_ID, "project", "separator");
    const splitLegacy = `Project Knowledge review id: \n${framedProject}${PROCESS_ID}\n`;

    expect(lookupSharedReviewId(splitLegacy, PROCESS_ID).legacyCount).toBe(0);
  });

  it("rejects duplicate review identities", () => {
    const first = entry(PROJECT_ID, "project", "first");
    const second = entry(PROJECT_ID, "project", "second");

    expect(validateSharedMemoryFrames(`${first}${second}`).valid).toBe(false);
  });

  it("resynchronizes after malformed legacy but keeps the document invalid", () => {
    const malformed = `<!-- project-knowledge-entry:v1 id=${PROJECT_ID} lane=project bytes=999 sha256=${"0".repeat(64)} -->\npartial\n`;
    const later = entry(PROCESS_ID, "process", "later valid frame");

    expect(validateSharedMemoryFrames(`${malformed}${later}`).valid).toBe(false);
    expect(lookupSharedReviewId(`${malformed}${later}`, PROCESS_ID)).toEqual(
      expect.objectContaining({ completeCount: 1, documentValid: false }),
    );
  });

  it("looks up only complete framed identities and flags malformed mentions", () => {
    const complete = entry(PROCESS_ID, "process", "complete");
    const fakeLegacyMarker = entry(
      PROJECT_ID,
      "project",
      `Project Knowledge review id: ${PROCESS_ID}`,
    );
    const malformed = complete.replace(/sha256=[0-9a-f]{64}/, `sha256=${"f".repeat(64)}`);

    expect(lookupSharedReviewId(complete, PROCESS_ID)).toEqual({
      completeCount: 1,
      legacyCount: 0,
      malformedMention: false,
      documentValid: true,
    });
    expect(lookupSharedReviewId(malformed, PROCESS_ID)).toEqual({
      completeCount: 0,
      legacyCount: 0,
      malformedMention: true,
      documentValid: false,
    });
    expect(lookupSharedReviewId(fakeLegacyMarker, PROCESS_ID)).toEqual({
      completeCount: 0,
      legacyCount: 0,
      malformedMention: false,
      documentValid: true,
    });
  });
});

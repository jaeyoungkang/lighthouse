import { createHash } from "node:crypto";
import { existsSync, lstatSync, realpathSync } from "node:fs";
import path from "node:path";

import { isMap, isScalar, isSeq, parseDocument as parseYamlDocument } from "yaml";

const FRAME_START = Buffer.from("<!-- project-knowledge-entry:", "utf8");
const CANDIDATE_BOUNDARY = Buffer.from("\n<!-- project-knowledge-candidate:v1 -->\n", "utf8");
const PAYLOAD_PREFIX_RE =
  /^---\n\n## ([0-9]{4}-[0-9]{2}-[0-9]{2}) 공유 기억\n\n출처: `([^`\r\n]+)`\n\n<!-- project-knowledge-candidate:v1 -->\n/;
const CANONICAL_SOURCE_PATH = ".project-knowledge-local/candidate.md";
const HEADER_RE =
  /^<!-- project-knowledge-entry:v1 id=([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}) lane=(project|process) bytes=(0|[1-9][0-9]*) sha256=([0-9a-f]{64}) -->\n$/;
const REVIEW_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const COMMIT_SHA_RE = /^[0-9a-f]{7,40}$/;

function digestFrame(reviewId, lane, payload) {
  return createHash("sha256")
    .update(Buffer.from(`v1\0${reviewId}\0${lane}\0`, "utf8"))
    .update(payload)
    .digest("hex");
}

function digestBytes(value) {
  return createHash("sha256").update(value).digest("hex");
}

function validDate(value) {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function nextFrameStart(source, offset) {
  let cursor = offset;
  while (cursor < source.length) {
    const start = source.indexOf(FRAME_START, cursor);
    if (start === -1) return -1;
    if (start === 0 || source[start - 1] === 0x0a) return start;
    cursor = start + FRAME_START.length;
  }
  return -1;
}

export function parseSharedCandidateMetadata(markdown) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(markdown);
  if (!match?.[1]) throw new Error("Shared Project Knowledge candidate requires YAML frontmatter.");

  const document = parseYamlDocument(match[1]);
  if (document.errors.length > 0) throw document.errors[0];
  const parsed = document.toJS();
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Shared Project Knowledge candidate frontmatter must be a mapping.");
  }
  const lane = parsed.knowledge_lane;
  if (lane !== "project" && lane !== "process") {
    throw new Error(
      "Shared Project Knowledge candidate knowledge_lane must be 'project' or 'process'.",
    );
  }
  if (
    !Array.isArray(parsed.authority_refs) ||
    parsed.authority_refs.length === 0 ||
    parsed.authority_refs.some((value) => typeof value !== "string" || value.trim().length === 0)
  ) {
    throw new Error("Shared Project Knowledge candidate authority_refs must be non-empty strings.");
  }
  if (lane === "process") {
    const sourceRefs = document.get("source_refs", true);
    const evidenceCommits = isSeq(sourceRefs)
      ? sourceRefs.items.flatMap((sourceRef) => {
          if (!isMap(sourceRef)) return [];
          const commit = sourceRef.get("commit", true);
          if (!isScalar(commit)) return [];
          const lexicalCommit = String(commit.source ?? commit.value).trim();
          return COMMIT_SHA_RE.test(lexicalCommit) ? [lexicalCommit] : [];
        })
      : [];
    if (evidenceCommits.length === 0) {
      throw new Error(
        "Shared Project Knowledge process candidate source_refs must include an evidence commit SHA.",
      );
    }
  }
  return {
    knowledgeLane: lane,
    authorityRefs: parsed.authority_refs.map((value) => value.trim()),
  };
}

export function validateSharedAuthorityRef(authorityRef, authorityRoot = process.cwd()) {
  if (typeof authorityRef !== "string" || authorityRef.trim().length === 0) return false;
  const [fileRef] = authorityRef.trim().split("#", 1);
  if (!fileRef || path.isAbsolute(fileRef)) return false;
  const resolvedRoot = path.resolve(authorityRoot);
  const authorityPath = path.resolve(resolvedRoot, fileRef);
  const relativePath = path.relative(resolvedRoot, authorityPath);
  if (
    relativePath === ".." ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath) ||
    !existsSync(authorityPath)
  ) {
    return false;
  }
  try {
    const authorityStat = lstatSync(authorityPath);
    if (!authorityStat.isFile() || authorityStat.isSymbolicLink()) return false;
    const realRelativePath = path.relative(realpathSync(resolvedRoot), realpathSync(authorityPath));
    return (
      realRelativePath !== ".." &&
      !realRelativePath.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(realRelativePath)
    );
  } catch {
    return false;
  }
}

function toBuffer(value) {
  return Buffer.isBuffer(value) ? value : Buffer.from(value, "utf8");
}

function parseDocument(markdown) {
  const source = toBuffer(markdown);
  const tokens = [];
  const anomalies = [];
  const entries = [];
  let cursor = 0;

  function pushResidue(start, end) {
    if (end > start)
      tokens.push({ kind: "residue", bytes: source.subarray(start, end), start, end });
  }

  function pushAnomaly(reason, start, end, reviewId) {
    const anomaly = {
      kind: "anomaly",
      reason,
      bytes: source.subarray(start, end),
      reviewId,
      start,
      end,
    };
    tokens.push(anomaly);
    anomalies.push(anomaly);
  }

  while (cursor < source.length) {
    const start = nextFrameStart(source, cursor);
    if (start === -1) {
      pushResidue(cursor, source.length);
      break;
    }
    pushResidue(cursor, start);

    const lineEnd = source.indexOf(0x0a, start);
    const fallbackEnd = nextFrameStart(source, start + FRAME_START.length);
    const anomalyEnd = fallbackEnd === -1 ? source.length : fallbackEnd;
    if (lineEnd === -1 || lineEnd >= anomalyEnd) {
      pushAnomaly("truncated-header", start, anomalyEnd);
      cursor = anomalyEnd;
      continue;
    }

    const header = source.subarray(start, lineEnd + 1).toString("utf8");
    const match = HEADER_RE.exec(header);
    if (!match) {
      pushAnomaly("unsupported-or-malformed-header", start, anomalyEnd);
      cursor = anomalyEnd;
      continue;
    }

    const [, reviewId, lane, byteLengthText, declaredDigest] = match;
    const byteLength = Number(byteLengthText);
    const payloadStart = lineEnd + 1;
    const payloadEnd = payloadStart + byteLength;
    const trailer = Buffer.from(`<!-- /project-knowledge-entry:v1 id=${reviewId} -->\n`, "utf8");
    const trailerEnd = payloadEnd + trailer.length;
    const frameFits =
      Number.isSafeInteger(byteLength) &&
      byteLength >= 0 &&
      payloadEnd >= payloadStart &&
      trailerEnd <= source.length;
    const payload = frameFits ? source.subarray(payloadStart, payloadEnd) : undefined;
    const trailerMatches = frameFits && source.subarray(payloadEnd, trailerEnd).equals(trailer);
    const digestMatches =
      payload !== undefined && digestFrame(reviewId, lane, payload) === declaredDigest;

    if (!frameFits || !trailerMatches || !digestMatches) {
      const resync = nextFrameStart(source, lineEnd + 1);
      const end = resync === -1 ? source.length : resync;
      pushAnomaly(
        !frameFits
          ? "invalid-byte-length"
          : !trailerMatches
            ? "missing-or-mismatched-trailer"
            : "digest-mismatch",
        start,
        end,
        reviewId,
      );
      cursor = end;
      continue;
    }

    let metadata;
    try {
      const payloadText = payload.toString("utf8");
      if (!Buffer.from(payloadText, "utf8").equals(payload)) {
        throw new Error("candidate payload must be canonical UTF-8");
      }
      const prefix = PAYLOAD_PREFIX_RE.exec(payloadText);
      if (!prefix) throw new Error("invalid canonical payload prefix");
      if (!validDate(prefix[1]) || prefix[2] !== CANONICAL_SOURCE_PATH) {
        throw new Error("invalid canonical payload source metadata");
      }
      const candidate = payloadText.slice(prefix[0].length);
      metadata = parseSharedCandidateMetadata(candidate);
      if (metadata.knowledgeLane !== lane)
        throw new Error("frame lane does not match candidate lane");
    } catch {
      pushAnomaly("invalid-or-mismatched-candidate-metadata", start, trailerEnd, reviewId);
      cursor = trailerEnd;
      continue;
    }

    const entry = {
      kind: "entry",
      reviewId,
      lane,
      authorityRefs: metadata.authorityRefs,
      digest: declaredDigest,
      payload: payload.toString("utf8"),
      start,
      end: trailerEnd,
    };
    tokens.push(entry);
    entries.push(entry);
    cursor = trailerEnd;
  }

  const idCounts = new Map();
  for (const entry of entries) {
    idCounts.set(entry.reviewId, (idCounts.get(entry.reviewId) ?? 0) + 1);
  }
  const duplicateIds = [...idCounts]
    .filter(([, count]) => count > 1)
    .map(([reviewId, count]) => `${reviewId}:${count}`)
    .sort();

  return { tokens, anomalies, entries, duplicateIds };
}

function anomalySignatures(document) {
  return [
    ...document.anomalies.map(
      ({ reason, reviewId, bytes }) => `${reason}:${reviewId ?? "none"}:${digestBytes(bytes)}`,
    ),
    ...document.duplicateIds.map((duplicate) => `duplicate-review-id:${duplicate}`),
  ];
}

function authorityRefSignatures(document, authorityRoot, authorityRefValidator) {
  const validate =
    authorityRefValidator ??
    ((authorityRef) => validateSharedAuthorityRef(authorityRef, authorityRoot));
  return document.entries.flatMap((entry) =>
    entry.authorityRefs
      .filter((authorityRef) => !validate(authorityRef))
      .map((authorityRef) => `invalid-authority-ref:${entry.reviewId}:${authorityRef}`),
  );
}

export function renderSharedMemoryEntry({ reviewId, date, sourcePath, candidate }) {
  if (!REVIEW_ID_RE.test(reviewId)) {
    throw new Error(`Invalid Project Knowledge review id: ${reviewId}`);
  }
  if (!validDate(date) || sourcePath !== CANONICAL_SOURCE_PATH) {
    throw new Error("Invalid Project Knowledge frame source metadata.");
  }
  const metadata = parseSharedCandidateMetadata(candidate);
  const lane = metadata.knowledgeLane;
  const payload = Buffer.from(
    `---\n\n## ${date} 공유 기억\n\n출처: \`${sourcePath}\`\n${CANDIDATE_BOUNDARY.toString("utf8")}${candidate.trim()}\n`,
    "utf8",
  );
  const digest = digestFrame(reviewId, lane, payload);
  return `<!-- project-knowledge-entry:v1 id=${reviewId} lane=${lane} bytes=${payload.length} sha256=${digest} -->\n${payload.toString("utf8")}<!-- /project-knowledge-entry:v1 id=${reviewId} -->\n`;
}

export function sharedMemoryAppendSeparator(base) {
  const bytes = toBuffer(base);
  return bytes.length === 0 || bytes[bytes.length - 1] === 0x0a ? "" : "\n";
}

export function lookupSharedReviewId(markdown, reviewId, options = {}) {
  if (!REVIEW_ID_RE.test(reviewId)) {
    return { completeCount: 0, legacyCount: 0, malformedMention: true, documentValid: false };
  }
  const document = parseDocument(markdown);
  const authorityRoot = options.authorityRoot ?? process.cwd();
  const invalidAuthorityRefs = authorityRefSignatures(document, authorityRoot);
  const targetEntries = document.entries.filter((entry) => entry.reviewId === reviewId);
  const targetInvalidAuthorityRefs = invalidAuthorityRefs.filter((signature) =>
    signature.startsWith(`invalid-authority-ref:${reviewId}:`),
  );
  const completeCount = targetEntries.filter((entry) =>
    entry.authorityRefs.every((authorityRef) =>
      validateSharedAuthorityRef(authorityRef, authorityRoot),
    ),
  ).length;
  const legacyMarker = `Project Knowledge review id: ${reviewId}`;
  const legacyCount = document.tokens
    .filter((token) => token.kind === "residue")
    .flatMap((token) => token.bytes.toString("utf8").split("\n"))
    .filter((line) => line.trim() === legacyMarker).length;
  const malformedMention = document.anomalies.some(({ bytes }) =>
    bytes.includes(Buffer.from(reviewId, "utf8")),
  );
  const documentValid =
    options.validationScope === "target"
      ? document.anomalies.length === 0 &&
        targetEntries.length <= 1 &&
        targetInvalidAuthorityRefs.length === 0
      : anomalySignatures(document).length === 0 && invalidAuthorityRefs.length === 0;
  return {
    completeCount,
    legacyCount,
    malformedMention,
    documentValid,
  };
}

export function validateSharedMemoryFrames(markdown, options = {}) {
  const document = parseDocument(markdown);
  const reasons = [
    ...anomalySignatures(document),
    ...authorityRefSignatures(document, options.authorityRoot ?? process.cwd()),
  ];
  return reasons.length === 0 ? { valid: true, reasons: [] } : { valid: false, reasons };
}

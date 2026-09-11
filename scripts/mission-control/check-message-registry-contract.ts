import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import messages from "../../app/i18n/messages";

interface RegistryOwnerGroup {
  id: string;
  prefixes: readonly string[];
  track: "fixed-copy";
  // direct-user microcopy follows the UX-writing jargon/error-code rules;
  // document-style internal/about prose is exempt from the jargon scan but
  // still declares aspect:ux-writing-voice-and-tone for the voice principles.
  craftScope: "direct-user" | "document-style";
  owners: readonly string[];
  aspects: readonly string[];
}

const UX_WRITING_ASPECT = "aspect:ux-writing-voice-and-tone";

const REGISTRY_OWNER_GROUPS: readonly RegistryOwnerGroup[] = [
  {
    id: "auth-and-onboarding",
    prefixes: ["auth.", "onboarding."],
    track: "fixed-copy",
    craftScope: "direct-user",
    owners: ["promise:search-results-fast-window"],
    aspects: [
      "aspect:user-facing-language-governance",
      "aspect:ux-writing-voice-and-tone",
      "aspect:visible-explanation-sufficiency",
    ],
  },
  {
    id: "search-and-citation",
    prefixes: ["search.", "citationLineage.", "graphNeighbors."],
    track: "fixed-copy",
    craftScope: "direct-user",
    owners: [
      "promise:search-results-fast-window",
      "promise:search-spelling-correction",
      "promise:citation-lineage",
      "promise:graph-neighbor-papers",
    ],
    aspects: [
      "aspect:user-facing-language-governance",
      "aspect:ux-writing-voice-and-tone",
      "aspect:visible-explanation-sufficiency",
    ],
  },
  {
    id: "gap-and-knowledge-map",
    prefixes: ["gapNetwork.", "knowledgeMap.", "communityMap.", "narrative."],
    track: "fixed-copy",
    craftScope: "direct-user",
    owners: [
      "promise:gap-network-detection-from-search",
      "promise:gap-report-prepared-reaction",
      "promise:gap-overlay-decision-evidence",
    ],
    aspects: [
      "aspect:user-facing-language-governance",
      "aspect:ux-writing-voice-and-tone",
      "aspect:visible-explanation-sufficiency",
    ],
  },
  {
    id: "reaction-and-agent-surfaces",
    prefixes: ["agent.", "surface.", "tool."],
    track: "fixed-copy",
    craftScope: "direct-user",
    owners: [
      "promise:search-reaction-summarizes-terrain",
      "promise:citation-lineage",
      "promise:gap-report-prepared-reaction",
    ],
    aspects: [
      "aspect:user-facing-language-governance",
      "aspect:ux-writing-voice-and-tone",
      "aspect:reaction-prefers-load-bearing-facts",
      "aspect:ai-generated-content-feedback",
    ],
  },
  {
    id: "research-route-and-document-shared",
    prefixes: ["common.", "document."],
    track: "fixed-copy",
    craftScope: "direct-user",
    owners: [
      "promise:search-results-fast-window",
      "promise:research-route-cap-feedback",
      "promise:search-query-route-transition",
      "promise:citation-lineage",
    ],
    aspects: [
      "aspect:user-facing-language-governance",
      "aspect:ux-writing-voice-and-tone",
      "aspect:visible-explanation-sufficiency",
    ],
  },
  {
    id: "public-commitment",
    prefixes: ["commitment."],
    track: "fixed-copy",
    craftScope: "document-style",
    owners: ["promise:researcher-prose-promises-page"],
    aspects: ["aspect:user-facing-language-governance", "aspect:ux-writing-voice-and-tone"],
  },
  {
    id: "admin-invited-access",
    prefixes: ["admin.access.", "invitedAccess."],
    track: "fixed-copy",
    craftScope: "direct-user",
    owners: ["promise:invited-user-access-management"],
    aspects: ["aspect:user-facing-language-governance", "aspect:ux-writing-voice-and-tone"],
  },
] as const;

// UX-writing deterministic rule: direct-user microcopy must not leak developer
// jargon or raw error codes. ResearchRoutePayload-style internal/about prose is exempt (it
// may name technical concepts explanatorily) and is filtered out by craftScope.
const UX_WRITING_DIRECT_USER_JARGON_PATTERNS = [
  /\bError\s*\d/i,
  /\bError\s+Code\b/i,
  /\b(?:timeout|Unauthorized|Forbidden|Fetching|NaN|undefined)\b/,
  /\bInternal Server Error\b/i,
  /\bBad Request\b/i,
  /\bService Unavailable\b/i,
  /\bNetwork (?:error|timeout)\b/i,
  /\bseed(?:Paper)?\b/i,
  /\b(?:cluster|gap pair|bridge concept|burst)\b/i,
] as const;

const TRUST_SOURCE_FORBIDDEN_PATTERNS = [
  /AI가\s*임의로\s*고르는/,
  /AI가\s*임의로\s*고른/,
  /AI\s*추천\s*목록이\s*아니라/,
] as const;

const DIRECT_VISITOR_HONORIFIC_PREFIXES = ["auth."] as const;

const DIRECT_VISITOR_HONORIFIC_KEYS = ["onboarding.label.onboarding.7"] as const;

const DIRECT_VISITOR_DIRECT_COPY_PREFIXES = ["auth.", "onboarding.label.onboarding.7"] as const;

const HONORIFIC_ENDING_RE =
  /(?:요|주세요|십시오|세요|입니다|합니다|됩니다|했습니다|있습니다|없습니다|이에요|예요)(?:[.!?。]|$)/m;
const PLAIN_ENDING_RE =
  /(?:이다|한다|했다|된다|있다|없다|본다|건다|둔다|맡는다|닫는다|검증한다|확인한다|필요하다|가능하다|못했다|수 없다|중이다|보자)(?:[.!?。]|$)/m;

const messageEntries = Object.entries(messages).sort(([left], [right]) =>
  left.localeCompare(right),
);
const failures: string[] = [];

const groupByKey = new Map<string, RegistryOwnerGroup>();
for (const [key] of messageEntries) {
  const groups = REGISTRY_OWNER_GROUPS.filter((group) =>
    group.prefixes.some((prefix) => key.startsWith(prefix)),
  );
  if (groups.length === 0) {
    failures.push(`unowned message key: ${key}`);
    continue;
  }
  if (groups.length > 1) {
    failures.push(
      `message key has multiple owner groups: ${key} -> ${groups.map((g) => g.id).join(", ")}`,
    );
    continue;
  }
  groupByKey.set(key, groups[0]);
}

for (const [key, value] of messageEntries) {
  if (key.includes(".contractDiff.")) continue;
  for (const pattern of TRUST_SOURCE_FORBIDDEN_PATTERNS) {
    if (pattern.test(value)) {
      failures.push(`trust-source defensive wording in ${key}: ${pattern.toString()}`);
    }
  }
}

for (const [key, value] of messageEntries) {
  if (key.includes(".contractDiff.")) continue;
  const hasHonorificEnding = HONORIFIC_ENDING_RE.test(value);
  const hasPlainEnding = PLAIN_ENDING_RE.test(value);
  const isDirectVisitorHonorificCopy =
    DIRECT_VISITOR_HONORIFIC_KEYS.includes(key as (typeof DIRECT_VISITOR_HONORIFIC_KEYS)[number]) ||
    DIRECT_VISITOR_HONORIFIC_PREFIXES.some((prefix) => key.startsWith(prefix));
  if (isDirectVisitorHonorificCopy && hasHonorificEnding && hasPlainEnding) {
    failures.push(`mixed honorific/plain endings in one message: ${key}`);
  }
  if (isDirectVisitorHonorificCopy && hasPlainEnding) {
    failures.push(`direct visitor copy uses plain ending: ${key}`);
  }
  if (value.startsWith("[system]") && hasHonorificEnding) {
    failures.push(`system event copy uses direct-user honorific ending: ${key}`);
  }
}

for (const [key, value] of messageEntries) {
  if (!DIRECT_VISITOR_DIRECT_COPY_PREFIXES.some((prefix) => key.startsWith(prefix))) continue;
  if (PLAIN_ENDING_RE.test(value)) {
    failures.push(`direct visitor copy tone mismatch in ${key}: plain ending`);
  }
}

// UX-writing voice·tone deterministic rule (aspect:ux-writing-voice-and-tone):
// direct-user microcopy must not expose developer jargon or raw error codes.
for (const [key, value] of messageEntries) {
  if (key.includes(".contractDiff.")) continue;
  const group = groupByKey.get(key);
  if (!group || group.craftScope !== "direct-user") continue;
  for (const pattern of UX_WRITING_DIRECT_USER_JARGON_PATTERNS) {
    if (pattern.test(value)) {
      failures.push(
        `ux-writing: direct-user microcopy exposes developer jargon / error code in ${key}: ${pattern.toString()}`,
      );
    }
  }
}

const groupsWithMessages = new Map<string, number>();
for (const group of groupByKey.values()) {
  groupsWithMessages.set(group.id, (groupsWithMessages.get(group.id) ?? 0) + 1);
}

// Every owner group must name Promises that still exist. Without this check a
// retirement can delete a Promise while the registry keeps pointing 100+ live
// keys at the gone slug, and the failure stays silent (issue: search-first
// landing left `promise:pre-auth-intro-explains-search-source` as a dangling
// owner while the tree was green).
const promisesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../docs/contracts/story-chain/promises",
);
const existingPromiseSlugs = new Set(
  readdirSync(promisesDir)
    .filter((entry) => entry.endsWith(".md"))
    .map((entry) => `promise:${entry.replace(/\.md$/, "")}`),
);

for (const group of REGISTRY_OWNER_GROUPS) {
  if (!groupsWithMessages.has(group.id)) {
    failures.push(`registry owner group has no message keys: ${group.id}`);
  }
  for (const owner of group.owners) {
    if (!existingPromiseSlugs.has(owner)) {
      failures.push(
        `registry owner group ${group.id} names a promise that does not exist: ${owner}`,
      );
    }
  }
  if (!group.aspects.includes("aspect:user-facing-language-governance")) {
    failures.push(`registry owner group missing language governance aspect: ${group.id}`);
  }
  if (!group.aspects.includes(UX_WRITING_ASPECT)) {
    failures.push(`registry owner group missing ux-writing voice/tone aspect: ${group.id}`);
  }
}

if (failures.length > 0) {
  console.error("message-registry-contract failed");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("message-registry-contract — fixed-copy registry green");
console.log(`  messages      ${messageEntries.length.toString()}`);
for (const group of REGISTRY_OWNER_GROUPS) {
  console.log(
    `  ${group.id.padEnd(30)} ${String(groupsWithMessages.get(group.id) ?? 0).padStart(4)} keys  owners=${group.owners.join(", ")}`,
  );
}
console.log("  semantic tone policies");
console.log("  - direct-visitor-honorific: direct auth/onboarding copy rejects plain endings");
console.log("  - system-event-observation: [system] copy rejects direct-user honorific endings");
console.log("  ux-writing voice/tone policies (aspect:ux-writing-voice-and-tone)");
console.log("  - direct-user-jargon: direct-user microcopy rejects developer jargon / error codes");
console.log("  - voice-aspect-ownership: every owner group declares the ux-writing aspect");

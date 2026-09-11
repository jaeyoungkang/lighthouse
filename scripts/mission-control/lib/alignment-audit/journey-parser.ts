import type {
  AlignmentJourneyChipKind,
  AlignmentJourneyLaneId,
  AlignmentJourneyScenarioType,
} from "@/scripts/mission-control/lib/alignment-audit-types";
import { parseScenarioHeading } from "@/app/server/services/story-chain/scenario-catalog";

export interface ParsedJourneyChip {
  label: string;
  kind: AlignmentJourneyChipKind;
}

export interface ParsedJourneyScenario {
  id: string;
  lane: AlignmentJourneyLaneId;
  label: string;
  type: AlignmentJourneyScenarioType;
  situation: string;
  reactionTitle: string;
  reactionBody: string;
  chips: ParsedJourneyChip[];
  selectedChipLabel: string | null;
  destinationLane: AlignmentJourneyLaneId | null;
}

const JOURNEY_LANE_ALIASES: Record<string, AlignmentJourneyLaneId> = {
  search: "search",
  citation_lineage: "citation_lineage",
  citation: "citation_lineage",
  gap_network: "gap",
  gap: "gap",
  pdf: "pdf",
  web: "web",
};

const JOURNEY_LANE_PREFIX: Record<string, AlignmentJourneyLaneId> = {
  S: "search",
  C: "citation_lineage",
  G: "gap",
  P: "pdf",
  W: "web",
};

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeJourneyLane(value: string | undefined): AlignmentJourneyLaneId | null {
  if (!value) {
    return null;
  }

  return JOURNEY_LANE_ALIASES[value.trim().toLowerCase()] ?? null;
}

function normalizeScenarioBody(value: string): string {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractReactionBody(block: string): string {
  const bodyMatch = block.match(/body:\s*([\s\S]*?)(?:\nsurface:|$)/);
  return normalizeScenarioBody(bodyMatch?.[1] ?? "");
}

function parseJourneyChips(block: string): ParsedJourneyChip[] {
  return [...block.matchAll(/^\s*-\s*(explore|navigate|recover):\s*(.+)$/gm)]
    .map((match) => {
      const kind = match[1];
      const label = match[2];
      if (!kind || !label) {
        return null;
      }

      return {
        kind: kind as AlignmentJourneyChipKind,
        label: normalizeWhitespace(label),
      } satisfies ParsedJourneyChip;
    })
    .filter((chip): chip is ParsedJourneyChip => chip !== null);
}

function parseSelectedChipLabel(situation: string): string | null {
  const directMatch = situation.match(
    /(?:사용자가|유저가).{0,24}["“]?([^"”]+?)["”]?(?:을|를)\s+(?:눌렀|클릭했)/,
  );
  if (directMatch?.[1]) {
    return normalizeWhitespace(directMatch[1]);
  }

  const quotedMatch = situation.match(/["“]([^"”]+?)["”]/);
  return quotedMatch?.[1] ? normalizeWhitespace(quotedMatch[1]) : null;
}

function inferScenarioType(params: {
  title: string;
  body: string;
  chips: ParsedJourneyChip[];
  situation: string;
}): AlignmentJourneyScenarioType {
  const corpus = `${params.title} ${params.body} ${params.situation}`;

  if (/분석 중|진행 중/.test(corpus)) {
    return "progress";
  }

  if (
    params.chips.some((chip) => chip.kind === "recover") ||
    /타임아웃|일부|부분|제한적|실패했지만|다시/.test(corpus)
  ) {
    return "recoverable";
  }

  if (
    params.chips.some((chip) => chip.kind === "navigate") ||
    /새 화면을|화면이 생성|포커스가 이동|화면 포커스가 이동|전환/.test(corpus)
  ) {
    return "navigation";
  }

  if (/실패|불러올 수 없|열 수 없|결과가 없습니다|없습니다|불가|어렵다/.test(corpus)) {
    return "hard_error";
  }

  return "normal";
}

function inferJourneyDestination(params: {
  lane: AlignmentJourneyLaneId;
  chips: ParsedJourneyChip[];
  selectedChipLabel: string | null;
  situation: string;
}): AlignmentJourneyLaneId | null {
  const selected = params.selectedChipLabel ?? "";
  const chipCorpus = params.chips.map((chip) => chip.label).join(" ");
  const corpus = `${selected} ${chipCorpus} ${params.situation}`;

  if (params.lane === "search" && /갭/.test(corpus)) {
    return "gap";
  }

  if (params.lane === "web" && /PDF/.test(corpus)) {
    return "pdf";
  }

  return null;
}

function inferJourneyLane(
  sectionLane: AlignmentJourneyLaneId | null,
  scenarioRef: string,
): AlignmentJourneyLaneId {
  if (sectionLane) {
    return sectionLane;
  }

  return JOURNEY_LANE_PREFIX[scenarioRef.charAt(0) || "S"] ?? "search";
}

export function parseReactionScenarios(content: string): ParsedJourneyScenario[] {
  const scenarios: ParsedJourneyScenario[] = [];
  const lines = content.split(/\r?\n/);
  let currentLane: AlignmentJourneyLaneId | null = null;
  let currentHeader: string | null = null;
  let currentBuffer: string[] = [];

  const flushScenario = () => {
    if (!currentHeader) {
      currentBuffer = [];
      return;
    }

    const heading = parseScenarioHeading(`### 시나리오 ${currentHeader}`);
    if (!heading) {
      currentHeader = null;
      currentBuffer = [];
      return;
    }
    const { id, label } = heading;

    const block = currentBuffer.join("\n").trim();
    const situationMatch = block.match(/상황:\s*([\s\S]*?)(?:\n```|$)/);
    const situation = normalizeScenarioBody(situationMatch?.[1] ?? "");
    const reactionBlockMatch = block.match(/```txt\s*([\s\S]*?)```/);
    const reactionBlock = reactionBlockMatch?.[1] ?? "";
    const reactionTitle = normalizeWhitespace(reactionBlock.match(/title:\s*(.+)$/m)?.[1] ?? "");
    const reactionBody = extractReactionBody(reactionBlock);
    const chips = parseJourneyChips(reactionBlock);
    const selectedChipLabel = parseSelectedChipLabel(situation);
    const lane = inferJourneyLane(currentLane, id);

    scenarios.push({
      id,
      lane,
      label: normalizeWhitespace(label),
      type: inferScenarioType({
        title: reactionTitle || label,
        body: reactionBody,
        chips,
        situation,
      }),
      situation,
      reactionTitle,
      reactionBody,
      chips,
      selectedChipLabel,
      destinationLane: inferJourneyDestination({
        lane,
        chips,
        selectedChipLabel,
        situation,
      }),
    });

    currentHeader = null;
    currentBuffer = [];
  };

  for (const line of lines) {
    const laneMatch = line.match(/^##\s+\d+\.\s+.+\(([^)]+)\)\s*$/);
    if (laneMatch) {
      flushScenario();
      currentLane = normalizeJourneyLane(laneMatch[1]);
      continue;
    }

    const scenarioMatch = line.match(/^###\s+시나리오\s+(.+)$/);
    if (scenarioMatch) {
      flushScenario();
      currentHeader = scenarioMatch[1].trim();
      continue;
    }

    if (currentHeader) {
      currentBuffer.push(line);
    }
  }

  flushScenario();
  return scenarios;
}

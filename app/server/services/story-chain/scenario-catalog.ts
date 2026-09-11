import { isScenarioRef, type StoryChainScenario } from "@/app/domain/story-chain";

import { StoryChainParseError } from "./parser-shared";

const SCENARIO_HEADING_MARKER = /^### 시나리오 /;
const SCENARIO_HEADING_PATTERN = /^### 시나리오 (scenario:[A-Za-z0-9][A-Za-z0-9_-]*):\s*(.+)$/;
const SCENARIO_REFERENCE_PATTERN = /\bscenario:[A-Za-z0-9][A-Za-z0-9_-]*\b/g;

export function parseScenarioHeading(
  line: string,
): { id: StoryChainScenario["id"]; label: string } | null {
  const match = line.match(SCENARIO_HEADING_PATTERN);
  const id = match?.[1];
  const label = match?.[2]?.trim();
  if (!id || !label || !isScenarioRef(id)) return null;
  return { id, label };
}

export function parseScenarioCatalog(source: string, file: string): StoryChainScenario[] {
  const scenarios: StoryChainScenario[] = [];
  const lines = source.split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    if (!SCENARIO_HEADING_MARKER.test(line)) continue;
    const scenario = parseScenarioHeading(line);
    if (!scenario) {
      throw new StoryChainParseError(
        `${file}:${String(index + 1)}: scenario heading must use "scenario:<semantic-slug>: <label>"`,
      );
    }
    scenarios.push(scenario);
  }

  const activeScenarioIds = new Set(scenarios.map((scenario) => scenario.id));
  for (const [index, line] of lines.entries()) {
    for (const scenarioRef of line.match(SCENARIO_REFERENCE_PATTERN) ?? []) {
      if (activeScenarioIds.has(scenarioRef as StoryChainScenario["id"])) continue;
      throw new StoryChainParseError(
        `${file}:${String(index + 1)}: scenario reference "${scenarioRef}" is not declared by an active scenario heading`,
      );
    }
  }
  return scenarios;
}

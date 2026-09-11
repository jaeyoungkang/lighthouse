import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIR, "../..");
const DEFAULT_CONFIG_PATH = path.join(SCRIPT_DIR, "config.json");
const VALID_LANES = ["process", "search"];

export function loadConfig(configPath = DEFAULT_CONFIG_PATH) {
  return JSON.parse(readFileSync(configPath, "utf8"));
}

export function validateConfig(config, repositoryRoot = REPOSITORY_ROOT) {
  const errors = [];

  if (config?.schemaVersion !== 1) errors.push("schemaVersion must be 1");
  if (!/^[^/]+\/[^/]+$/.test(config?.repository ?? "")) {
    errors.push("repository must use owner/name form");
  }
  if (typeof config?.label !== "string" || config.label.length === 0) {
    errors.push("label must be a non-empty string");
  }
  if (typeof config?.milestone !== "string" || config.milestone.length === 0) {
    errors.push("milestone must be a non-empty string");
  }

  for (const field of ["start", "end"]) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(config?.period?.[field] ?? "")) {
      errors.push(`period.${field} must use YYYY-MM-DD`);
    }
  }
  if (
    /^\d{4}-\d{2}-\d{2}$/.test(config?.period?.start ?? "") &&
    /^\d{4}-\d{2}-\d{2}$/.test(config?.period?.end ?? "") &&
    config.period.start > config.period.end
  ) {
    errors.push("period.start must not be after period.end");
  }
  if (config?.period?.reviewWeekday !== "Tuesday") {
    errors.push("period.reviewWeekday must be Tuesday for the active pilot");
  }

  const trackerNumbers = new Set();
  for (const lane of VALID_LANES) {
    const tracker = config?.trackers?.[lane];
    if (!tracker) {
      errors.push(`trackers.${lane} is required`);
      continue;
    }
    if (!Number.isInteger(tracker.issueNumber) || tracker.issueNumber <= 0) {
      errors.push(`trackers.${lane}.issueNumber must be a positive integer`);
    } else if (trackerNumbers.has(tracker.issueNumber)) {
      errors.push(`tracker issue number ${tracker.issueNumber} is duplicated`);
    } else {
      trackerNumbers.add(tracker.issueNumber);
    }

    if (!Array.isArray(tracker.linkedIssues) || tracker.linkedIssues.length === 0) {
      errors.push(`trackers.${lane}.linkedIssues must be a non-empty array`);
    } else {
      const unique = new Set();
      for (const issueNumber of tracker.linkedIssues) {
        if (!Number.isInteger(issueNumber) || issueNumber <= 0) {
          errors.push(`trackers.${lane}.linkedIssues contains an invalid issue number`);
        }
        if (unique.has(issueNumber)) {
          errors.push(`trackers.${lane}.linkedIssues duplicates #${issueNumber}`);
        }
        if (issueNumber === tracker.issueNumber) {
          errors.push(`trackers.${lane} cannot link to its own tracker issue`);
        }
        unique.add(issueNumber);
      }
    }

    if (!Array.isArray(tracker.sourcePaths) || tracker.sourcePaths.length === 0) {
      errors.push(`trackers.${lane}.sourcePaths must be a non-empty array`);
    } else {
      for (const sourcePath of tracker.sourcePaths) {
        if (typeof sourcePath !== "string" || !existsSync(path.join(repositoryRoot, sourcePath))) {
          errors.push(`trackers.${lane}.sourcePaths is missing ${JSON.stringify(sourcePath)}`);
        }
      }
    }
  }

  return errors;
}

export function calendarDateKst(now = new Date()) {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function validateActivePeriod(config, now = new Date()) {
  const currentDate = calendarDateKst(now);
  if (currentDate < config.period.start) {
    return [`active tracker period has not started: ${config.period.start}`];
  }
  if (currentDate > config.period.end) {
    return [`active tracker period ended: ${config.period.end}; rollover or retire it before sync`];
  }
  return [];
}

export function markerFor(lane, edge) {
  if (!VALID_LANES.includes(lane)) throw new Error(`Unknown lane: ${lane}`);
  if (edge !== "start" && edge !== "end") throw new Error(`Unknown marker edge: ${edge}`);
  return `<!-- project-status:generated:${lane}:${edge} -->`;
}

export function replaceGeneratedBlock(body, lane, generatedBlock) {
  const start = markerFor(lane, "start");
  const end = markerFor(lane, "end");
  const startIndex = body.indexOf(start);
  const endIndex = body.indexOf(end);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error(`Tracker body must contain one ordered ${lane} marker pair`);
  }
  if (
    body.indexOf(start, startIndex + start.length) !== -1 ||
    body.indexOf(end, endIndex + end.length) !== -1
  ) {
    throw new Error(`Tracker body must contain exactly one ${lane} marker pair`);
  }

  const before = body.slice(0, startIndex);
  const after = body.slice(endIndex + end.length);
  return `${before}${generatedBlock}${after}`;
}

function escapeTableCell(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}

export function buildGeneratedBlock({
  lane,
  checkpointDate,
  headSha,
  issueInventory,
  linkedIssues,
}) {
  const lines = [
    markerFor(lane, "start"),
    "### 기계적 checkpoint",
    "",
    `- 기준 주: ${checkpointDate} KST`,
    `- 기본 branch head: \`${headSha}\``,
  ];

  if (lane === "process") {
    lines.push(
      `- 열린 issue: ${issueInventory.open}`,
      `- \`operations\`: ${issueInventory.operations}`,
      `- assignee 없음: ${issueInventory.unassigned}`,
      `- milestone 없음: ${issueInventory.noMilestone}`,
    );
  }

  lines.push(
    "",
    "| Child issue | 상태 | 최근 갱신 | 제목 |",
    "| --- | --- | --- | --- |",
    ...linkedIssues.map(
      (issue) =>
        `| #${issue.number} | \`${issue.state.toLowerCase()}\` | ${issue.updatedAt.slice(0, 10)} | ${escapeTableCell(issue.title)} |`,
    ),
    "",
    "> 이 block은 GitHub의 기계적 사실만 갱신한다. 의미 행과 owning verdict는 담당자가 정본을 읽고 갱신한다.",
    markerFor(lane, "end"),
  );

  return lines.join("\n");
}

export function checkpointDateKst(now = new Date()) {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const dateOnly = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()));
  const daysSinceTuesday = (dateOnly.getUTCDay() - 2 + 7) % 7;
  dateOnly.setUTCDate(dateOnly.getUTCDate() - daysSinceTuesday);
  return dateOnly.toISOString().slice(0, 10);
}

function resolveToken() {
  const environmentToken = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  if (environmentToken) return environmentToken;
  try {
    return execFileSync("gh", ["auth", "token"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function parseArgs(argv) {
  const [command = "check", ...rest] = argv;
  let lane = "all";
  for (let index = 0; index < rest.length; index += 1) {
    if (rest[index] === "--lane") lane = rest[index + 1];
  }
  if (!["check", "dry-run", "sync"].includes(command)) {
    throw new Error(`Unknown command: ${command}`);
  }
  if (![...VALID_LANES, "all"].includes(lane)) throw new Error(`Unknown lane: ${lane}`);
  return { command, lane };
}

async function githubRequest(repository, apiPath, { method = "GET", body, token } = {}) {
  const response = await fetch(`https://api.github.com/repos/${repository}${apiPath}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "lighthouse-project-status",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    throw new Error(
      `GitHub ${method} ${apiPath} failed: ${response.status} ${await response.text()}`,
    );
  }
  return response.status === 204 ? null : response.json();
}

async function listAll(repository, apiPath, token) {
  const results = [];
  for (let page = 1; ; page += 1) {
    const separator = apiPath.includes("?") ? "&" : "?";
    const batch = await githubRequest(
      repository,
      `${apiPath}${separator}per_page=100&page=${page}`,
      {
        token,
      },
    );
    results.push(...batch);
    if (batch.length < 100) return results;
  }
}

async function collectSnapshot(config, lane, token) {
  const repository = await githubRequest(config.repository, "", { token });
  const ref = await githubRequest(
    config.repository,
    `/git/ref/heads/${repository.default_branch}`,
    {
      token,
    },
  );
  const openItems = await listAll(config.repository, "/issues?state=open", token);
  const openIssues = openItems.filter((item) => item.pull_request === undefined);
  const linkedIssues = await Promise.all(
    config.trackers[lane].linkedIssues.map((number) =>
      githubRequest(config.repository, `/issues/${number}`, { token }),
    ),
  );

  return {
    checkpointDate: checkpointDateKst(),
    headSha: ref.object.sha,
    issueInventory: {
      open: openIssues.length,
      operations: openIssues.filter((issue) =>
        issue.labels.some((label) => label.name === "operations"),
      ).length,
      unassigned: openIssues.filter((issue) => issue.assignees.length === 0).length,
      noMilestone: openIssues.filter((issue) => issue.milestone === null).length,
    },
    linkedIssues: linkedIssues.map((issue) => ({
      number: issue.number,
      state: issue.state,
      title: issue.title,
      updatedAt: issue.updated_at,
    })),
  };
}

export async function syncLane(config, lane, token, dryRun) {
  const trackerConfig = config.trackers[lane];
  const tracker = await githubRequest(config.repository, `/issues/${trackerConfig.issueNumber}`, {
    token,
  });
  const labelNames = tracker.labels.map((label) => label.name);
  const errors = [];
  if (tracker.state !== "open") errors.push(`tracker #${tracker.number} must be open`);
  if (!labelNames.includes(config.label))
    errors.push(`tracker #${tracker.number} must have ${config.label}`);
  if (tracker.assignees.length === 0)
    errors.push(`tracker #${tracker.number} must have an assignee`);
  if (tracker.milestone?.title !== config.milestone) {
    errors.push(`tracker #${tracker.number} must use milestone ${config.milestone}`);
  }
  if (errors.length > 0) throw new Error(errors.join("\n"));

  const snapshot = await collectSnapshot(config, lane, token);
  const generatedBlock = buildGeneratedBlock({ lane, ...snapshot });
  const nextBody = replaceGeneratedBlock(tracker.body, lane, generatedBlock);
  let bodyChanged = nextBody !== tracker.body;

  if (dryRun) {
    process.stdout.write(
      `${lane}: tracker #${tracker.number}; bodyChanged=${bodyChanged}\n${generatedBlock}\n`,
    );
    return;
  }

  if (bodyChanged) {
    const latestTracker = await githubRequest(
      config.repository,
      `/issues/${trackerConfig.issueNumber}`,
      { token },
    );
    const rebasedBody = replaceGeneratedBlock(latestTracker.body, lane, generatedBlock);
    bodyChanged = rebasedBody !== latestTracker.body;
    if (!bodyChanged) {
      process.stdout.write(`${lane}: tracker #${tracker.number} already changed during sync\n`);
    } else {
      await githubRequest(config.repository, `/issues/${tracker.number}`, {
        method: "PATCH",
        body: { body: rebasedBody },
        token,
      });
    }
  }

  process.stdout.write(`${lane}: tracker #${tracker.number} synced; bodyChanged=${bodyChanged}\n`);
}

// `check` exit codes. The push-triggered workflow skips only on an inactive
// tracker period (2); any config regression (1) must stay visible.
export const INACTIVE_PERIOD_EXIT_CODE = 2;

export function checkExitCode(config, now = new Date()) {
  if (validateConfig(config).length > 0) return 1;
  if (validateActivePeriod(config, now).length > 0) return INACTIVE_PERIOD_EXIT_CODE;
  return 0;
}

async function main() {
  const { command, lane } = parseArgs(process.argv.slice(2));
  const config = loadConfig();
  const exitCode = checkExitCode(config);
  if (exitCode !== 0) {
    const errors = [...validateConfig(config), ...validateActivePeriod(config)];
    const error = new Error(errors.join("\n"));
    error.exitCode = exitCode;
    throw error;
  }
  if (command === "check") {
    process.stdout.write(
      `Project status config valid: ${Object.keys(config.trackers).length} trackers, ${config.period.start}..${config.period.end}\n`,
    );
    return;
  }

  const token = resolveToken();
  if (!token) throw new Error(`${command} requires GITHUB_TOKEN or GH_TOKEN`);
  const lanes = lane === "all" ? VALID_LANES : [lane];
  for (const selectedLane of lanes) {
    await syncLane(config, selectedLane, token, command === "dry-run");
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = error.exitCode ?? 1;
  });
}

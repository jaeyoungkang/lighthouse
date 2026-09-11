const PILOT_SECTION_HEADING = "## 다음 관련 작업 10건";

export type PilotObservationStatus = {
  completed: number;
  pending: number;
  total: number;
};

export function parsePilotObservationStatus(markdown: string): PilotObservationStatus | undefined {
  const lines = markdown.split("\n");
  const sectionStart = lines.findIndex((line) => line.trim() === PILOT_SECTION_HEADING);
  if (sectionStart === -1) {
    return undefined;
  }

  const sectionLines: string[] = [];
  for (const line of lines.slice(sectionStart + 1)) {
    if (line.startsWith("## ")) {
      break;
    }
    sectionLines.push(line);
  }

  const rows = sectionLines
    .filter((line) => /^\|\s*\d+\s*\|/.test(line))
    .map((line) =>
      line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim()),
    );
  if (rows.length === 0) {
    return undefined;
  }

  const completed = rows.filter((cells) => {
    const recordedCells = cells.slice(1);
    const validRecall = cells[3]?.toLowerCase();
    return (
      recordedCells.length === 6 &&
      recordedCells.every((cell) => cell.length > 0 && cell.toLowerCase() !== "pending") &&
      (validRecall === "yes" || validRecall === "no")
    );
  }).length;
  return {
    completed,
    pending: rows.length - completed,
    total: rows.length,
  };
}

export function formatPilotObservationReminder(status: PilotObservationStatus): string {
  if (status.pending === 0) {
    return `PK bounded pilot: ${String(status.completed)}/${String(status.total)} recorded. Agent는 행을 더 만들지 않고 Human의 유지·축소·폐기 결정을 기다린다.`;
  }

  return `PK bounded pilot: ${String(status.completed)}/${String(status.total)} recorded. Agent가 Human 확인 없이 다음 authorized workstream의 적격성·valid recall·drift를 판정하고, 적격하면 다음 pending 행을 같은 변경에 기록한다.`;
}

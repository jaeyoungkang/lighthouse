import { describe, expect, it } from "vitest";

import { formatPilotObservationReminder, parsePilotObservationStatus } from "../pilot-observation";

function evaluation(rows: string): string {
  return `# Pilot

## 다음 관련 작업 10건

| task | date | query/object | valid recall | saved reconstruction time | drift/misread | note |
| --- | --- | --- | --- | --- | --- | --- |
${rows}

## 독립 실패 신호
`;
}

describe("Project Knowledge bounded-pilot observation reminder", () => {
  it("counts complete and pending task rows without treating the header as evidence", () => {
    const status = parsePilotObservationStatus(
      evaluation(`| 1 | 2026-08-14 | query / \`product.source-basis\` | yes | 5m | none | useful |
| 2 | pending | pending | pending | pending | pending | 실제 후속 작업에서 기록 |`),
    );

    expect(status).toEqual({ completed: 1, pending: 1, total: 2 });
    if (!status) throw new Error("expected pilot observation status");
    expect(formatPilotObservationReminder(status)).toContain(
      "Agent가 Human 확인 없이 다음 authorized workstream의 적격성",
    );
  });

  it("hands only the final structure decision to the Human after every row is recorded", () => {
    const status = parsePilotObservationStatus(
      evaluation("| 1 | 2026-08-14 | query / object | no | unknown | stale authority | not used |"),
    );

    expect(status).toEqual({ completed: 1, pending: 0, total: 1 });
    if (!status) throw new Error("expected pilot observation status");
    expect(formatPilotObservationReminder(status)).toContain(
      "Human의 유지·축소·폐기 결정을 기다린다",
    );
  });

  it("keeps partially recorded or invalid-verdict rows pending", () => {
    const status = parsePilotObservationStatus(
      evaluation(`| 1 | 2026-08-14 | query / object | pending | 5m | none | useful |
| 2 | 2026-08-14 | query / object | maybe | 5m | none | useful |`),
    );

    expect(status).toEqual({ completed: 0, pending: 2, total: 2 });
  });

  it("stays silent when the evaluation section is absent", () => {
    expect(parsePilotObservationStatus("# Project Knowledge\n")).toBeUndefined();
  });
});

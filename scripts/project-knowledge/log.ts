import { existsSync } from "node:fs";
import { listArchivedLogJsonFiles, readText, relativePath, workMemoryLogJsonPath } from "./common";

type Record = {
  id?: string;
  date?: string;
  summary?: string;
  context_hint?: string;
  role?: string;
  domain_tags?: string[];
  entities?: string[];
  goal_links?: string[];
  source_refs?: {
    branch?: string;
    head?: string;
    session?: string;
    pid?: number;
    recordedAt?: string;
  };
};

function extractFlag(args: string[], name: string): boolean {
  const index = args.indexOf(name);
  if (index === -1) return false;
  args.splice(index, 1);
  return true;
}

function extractValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1 || index + 1 >= args.length) return undefined;
  const value = args[index + 1];
  args.splice(index, 2);
  return value;
}

function readRecords(file: string, since?: string): Record[] {
  if (!existsSync(file)) return [];
  return readText(file)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map<Record | undefined>((line) => {
      try {
        return JSON.parse(line) as Record;
      } catch {
        return undefined;
      }
    })
    .filter((record): record is Record => {
      if (!record) return false;
      if (!since) return true;
      const recordedAt = record.source_refs?.recordedAt ?? record.date;
      return !recordedAt || recordedAt >= since;
    });
}

function renderRecord(record: Record): string {
  const refs = record.source_refs ?? {};
  const recordedAt = refs.recordedAt ?? record.date ?? "unknown";
  const meta: string[] = [];
  if (refs.branch) meta.push(`- branch: ${refs.branch}`);
  if (refs.head) meta.push(`- head: ${refs.head}`);
  if (refs.session) meta.push(`- session: ${refs.session}`);
  if (record.context_hint) meta.push(`- context_hint: ${record.context_hint}`);
  if (record.role) meta.push(`- role: ${record.role}`);
  if (record.domain_tags && record.domain_tags.length > 0) {
    meta.push(`- domain_tags: ${record.domain_tags.join(", ")}`);
  }
  if (record.entities && record.entities.length > 0) {
    meta.push(`- entities: ${record.entities.join(", ")}`);
  }
  if (record.goal_links && record.goal_links.length > 0) {
    meta.push(`- goal_links: ${record.goal_links.join(", ")}`);
  }

  return `## ${recordedAt}\n\n${meta.join("\n")}\n\n${record.summary ?? "(no summary)"}\n`;
}

function main(): void {
  const args = process.argv.slice(2);
  const all = extractFlag(args, "--all");
  const since = extractValue(args, "--since");
  const tailRaw = extractValue(args, "--tail");
  const tail = tailRaw ? Number.parseInt(tailRaw, 10) : 10;

  const files = [workMemoryLogJsonPath(), ...(all ? listArchivedLogJsonFiles() : [])];
  const records: Record[] = files.flatMap((file) => readRecords(file, since));

  records.sort((a, b) => {
    const aAt = a.source_refs?.recordedAt ?? a.date ?? "";
    const bAt = b.source_refs?.recordedAt ?? b.date ?? "";
    return aAt.localeCompare(bAt);
  });

  const sliced = Number.isFinite(tail) && tail > 0 ? records.slice(-tail) : records;

  if (sliced.length === 0) {
    console.log("로컬 작업 기억 로그가 비어있다.");
    return;
  }

  const live = workMemoryLogJsonPath();
  console.log(
    `로컬 작업 기억 로그 (${relativePath(live)}${all ? " + archive" : ""}, ${String(sliced.length)} entries)`,
  );
  console.log("");
  for (const record of sliced) {
    console.log(renderRecord(record));
  }
}

main();

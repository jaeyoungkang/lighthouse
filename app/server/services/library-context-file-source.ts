import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";

export interface LibraryContextFileSnapshot {
  raw: string;
  sourceKey: string;
}

function hashContent(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export async function readLibraryContextFile(
  pilotPath: string,
): Promise<LibraryContextFileSnapshot | null> {
  try {
    const fileStat = await stat(pilotPath);
    const raw = await readFile(pilotPath, "utf8");
    return {
      raw,
      sourceKey: `file:${pilotPath}:${String(fileStat.mtimeMs)}:${String(fileStat.size)}:${hashContent(raw)}`,
    };
  } catch {
    return null;
  }
}

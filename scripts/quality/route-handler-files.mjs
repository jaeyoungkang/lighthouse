import { readdir, stat } from "node:fs/promises";
import path from "node:path";

export async function collectRouteHandlerPaths(root = process.cwd()) {
  const routeFiles = [];
  await collectRouteFiles(path.join(root, "app"), routeFiles);
  return routeFiles.map((file) => path.relative(root, file)).sort();
}

async function collectRouteFiles(targetPath, routeFiles) {
  let targetStat;
  try {
    targetStat = await stat(targetPath);
  } catch {
    return;
  }

  if (targetStat.isDirectory()) {
    const entries = await readdir(targetPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name === "node_modules") continue;
      await collectRouteFiles(path.join(targetPath, entry.name), routeFiles);
    }
    return;
  }

  if (path.basename(targetPath) === "route.ts") routeFiles.push(targetPath);
}

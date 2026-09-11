export function extractFunctionSource(source: string, functionName: string): string {
  const startMatch = new RegExp(
    `(?:^|\\n)(?:async\\s+)?function\\s+${functionName}\\s*\\(`,
    "m",
  ).exec(source);
  if (!startMatch) {
    return "";
  }

  const startsWithNewline = startMatch[0].startsWith("\n");
  const startIndex = startMatch.index + (startsWithNewline ? 1 : 0);
  const remaining = source.slice(startIndex + 1);
  const nextMatch = /\n(?:async\s+)?function\s+[A-Za-z0-9_]+\s*\(/m.exec(remaining);
  const endIndex = nextMatch ? startIndex + 1 + nextMatch.index : source.length;

  return source.slice(startIndex, endIndex);
}

export function extractSubcaseBlock(functionSource: string, subcase: string): string {
  const marker = `if (subcase === "all" || subcase === "${subcase}") {`;
  const start = functionSource.indexOf(marker);
  if (start === -1) {
    return "";
  }

  let cursor = start + marker.length;
  let depth = 1;
  while (cursor < functionSource.length && depth > 0) {
    const char = functionSource[cursor];
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
    }
    cursor += 1;
  }

  return functionSource.slice(start + marker.length, cursor - 1);
}

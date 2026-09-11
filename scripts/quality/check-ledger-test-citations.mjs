// guard:ledger-citations — keep Story Chain test-name citations honest.
//
// Why this gate exists: Story Chain contract prose (Evidence Ledgers, Promise
// evidence lines, Aspect verification prose) cites specific tests in the form
// `path/to/file.test.tsx` ("exact test name"; "another name"). The
// Evidence Ledger citations and executions are read from the shared YAML v2
// graph, but a quoted test title still needs a direct source check. When a test is
// renamed or its assertion is flipped to describe new behavior, the file still
// passes and every gate stays green while the prose keeps citing a name that
// no longer exists — exactly the drift that let the knowledge-map-followup
// contract describe a removed AgentPanel gap-synthesis for two releases, and
// that let promise:search-reaction-summarizes-terrain cite a live-judge test
// title missing its "(runtime gateway path)" segment (issue #193).
//
// This check ties a prose claim to a real code artifact: every test name
// quoted right after a `*.test.ts(x)` path must exist as a quoted literal in
// that file. A renamed/removed test now fails the gate, forcing the author
// back into the prose — the moment to also re-check the behavior description.
//
// Scope: every .md under docs/contracts/story-chain/** — the citation grammar
// is self-identifying, so scoping by grammar instead of by directory closes
// the gap where Promise/Aspect citations went unchecked (issue #193). Only
// machine-checkable facts are enforced (cited file exists, quoted name present
// as a literal). Whether the behavior DESCRIPTION matches the code is still
// the author's responsibility under Mission Control review; this gate only
// removes the silent-rename class.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import storyChainLoader from "../../app/server/services/story-chain/loader.ts";

const { loadStoryChain } = storyChainLoader;

const ROOT = process.cwd();
const CONTRACT_DIR = "docs/contracts/story-chain";

// Recursively collect every *.md under the Story Chain contract tree.
function listContractDocs(dirRel) {
  const out = [];
  const abs = path.join(ROOT, dirRel);
  if (!existsSync(abs)) return out;
  for (const entry of readdirSync(abs)) {
    const relPath = `${dirRel}/${entry}`;
    const absPath = path.join(ROOT, relPath);
    if (statSync(absPath).isDirectory()) {
      out.push(...listContractDocs(relPath));
    } else if (entry.endsWith(".md")) {
      out.push(relPath);
    }
  }
  return out;
}

function lineAt(source, index) {
  return source.slice(0, index).split("\n").length;
}

// From `afterPath` (index just past the closing backtick of a cited file),
// skip whitespace and, if a balanced parenthetical follows, return its inner
// text. Depth counting tolerates nested balanced parens inside test names such
// as `getCitationLineageGapInputPapers (server) — ...`.
function followingParen(text, afterPath) {
  let i = afterPath;
  while (i < text.length && /\s/.test(text[i])) i += 1;
  if (text[i] !== "(") return null;
  let depth = 0;
  for (let j = i; j < text.length; j += 1) {
    const ch = text[j];
    if (ch === "(") depth += 1;
    else if (ch === ")") {
      depth -= 1;
      if (depth === 0) return { inner: text.slice(i + 1, j), parenStart: i };
    } else if (ch === "\n" && depth === 0) {
      return null;
    }
  }
  return null;
}

// Extract the quoted test-name list from a parenthetical. Ledgers separate
// names with `;` OR `,` inconsistently and may append trailing prose, so treat
// the double quote itself as the delimiter: every `"..."` run is one cited
// name. Escaped inner quotes (`\"`, for test names that themselves contain
// double quotes) are part of the name, not delimiters.
function extractNames(inner) {
  return [...inner.matchAll(/"((?:\\.|[^"\\])*)"/g)]
    .map((q) => q[1].replace(/\\"/g, '"')) // only the markdown-escaped quote; keep literal \d etc.
    .filter((name) => name.trim().length > 0);
}

// The cited name must appear as the START of a string literal in the file
// (double, single, or backtick quoted). Prefix — not exact — match, because
// ledgers routinely cite a faithful prefix of a longer test name
// (e.g. `"X is literally 40"` for `it("X is literally 40 — changing ...")`).
// A genuine rename diverges from the prefix and still fails.
function literalPrefixPresent(fileText, name) {
  return (
    fileText.includes(`"${name}`) || fileText.includes(`'${name}`) || fileText.includes(`\`${name}`)
  );
}

// `it.each(...)` tests use printf placeholders (`%s`, `%d`, …) in the title;
// the ledger cites the expanded title. Accept when a quoted template literal in
// the file matches the cited name once placeholders are treated as wildcards.
function printfTemplateMatch(fileText, name) {
  for (const m of fileText.matchAll(/(["'`])((?:\\.|(?!\1).)*?%[sdifjoO#](?:\\.|(?!\1).)*?)\1/g)) {
    const tmpl = m[2];
    const pattern =
      "^" + tmpl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%[sdifjoO#]/g, ".+") + "$";
    try {
      if (new RegExp(pattern).test(name)) return true;
    } catch {
      /* malformed template — ignore */
    }
  }
  return false;
}

// Ledgers sometimes cite a `describe — it` (or `describe > it`) pair as one
// string; when the whole string is not a literal prefix, accept the most
// specific trailing segment (the it() name).
function nameExistsInFile(fileText, name) {
  if (literalPrefixPresent(fileText, name)) return true;
  if (printfTemplateMatch(fileText, name)) return true;
  for (const sep of [" — ", " › ", " > "]) {
    const idx = name.lastIndexOf(sep);
    if (idx !== -1) {
      const tail = name.slice(idx + sep.length).trim();
      if (tail.length > 0 && literalPrefixPresent(fileText, tail)) return true;
    }
  }
  return false;
}

const errors = [];
const contractDocs = listContractDocs(CONTRACT_DIR);
const ledgerSources = loadStoryChain(ROOT).evidenceLedgers.map((ledger) => ({
  docRel: path.relative(ROOT, ledger.path).replace(/\\/g, "/"),
  source: [
    ...ledger.intentCheckEntries.map((entry) => entry.evidence),
    ...ledger.acceptanceCheckEntries.map((entry) => entry.evidence),
  ].join("\n"),
}));
const contractSources = [
  ...contractDocs.map((docRel) => ({
    docRel,
    source: readFileSync(path.join(ROOT, docRel), "utf8"),
  })),
  ...ledgerSources,
];
const fileCache = new Map();
let checkedCitations = 0;

const PATH_RE = /`((?:app|packages|scripts)\/[^`\s]+\.test\.tsx?)`/g;
const EMPTY_CITATION_RE = /(?:vitest\s*@|\+|,)\s*``(?=\s*(?:\(|\+|,|\.|\||$))/g;
const EMPTY_CITATION_LINE_RE = /^[ \t]*(?:[-*][ \t]+|>[ \t]*)?``[ \t]*(?:[.|]|$)/gm;

function readFileTextCached(rel) {
  if (!fileCache.has(rel)) {
    const abs = path.join(ROOT, rel);
    fileCache.set(rel, existsSync(abs) ? readFileSync(abs, "utf8") : null);
  }
  return fileCache.get(rel);
}

for (const { docRel, source } of contractSources) {
  for (const empty of [
    ...source.matchAll(EMPTY_CITATION_RE),
    ...source.matchAll(EMPTY_CITATION_LINE_RE),
  ]) {
    const inlineStart = (empty.index ?? 0) + empty[0].indexOf("``");
    errors.push(
      `${docRel}:${lineAt(source, inlineStart)} — 빈 inline code citation \`\` (실제 파일/명령을 인용하거나 제거하라)`,
    );
  }
  const pathMatches = [...source.matchAll(PATH_RE)].map((m) => ({
    file: m[1],
    start: m.index,
    end: m.index + m[0].length,
  }));

  for (let i = 0; i < pathMatches.length; ) {
    // Group `A.test.tsx` and `B.test.tsx` (shared name list) — a cited name
    // need only exist in ONE of the grouped files.
    const group = [pathMatches[i]];
    while (
      i + 1 < pathMatches.length &&
      /^\s+and\s+$/.test(source.slice(pathMatches[i].end, pathMatches[i + 1].start))
    ) {
      group.push(pathMatches[i + 1]);
      i += 1;
    }
    i += 1;

    const paren = followingParen(source, group[group.length - 1].end);
    if (!paren) continue; // file(s) cited without a quoted-name list — nothing to verify
    const names = extractNames(paren.inner);

    // Continuation parentheticals: `("name1") + ("name2")` cites more names
    // for the SAME file group. Only the first parenthetical used to be
    // checked, which let a renamed second citation pass silently (issue #193
    // review finding). Stop when the next parenthetical belongs to a new
    // cited path (`+ \`b.test.ts\` ("...")`).
    let cursor = paren.parenStart + paren.inner.length + 2;
    for (;;) {
      const joiner = /^\s*\+\s*/.exec(source.slice(cursor));
      if (!joiner) break;
      const next = followingParen(source, cursor + joiner[0].length);
      if (!next) break;
      const nextPathStart = i < pathMatches.length ? pathMatches[i].start : Infinity;
      if (next.parenStart > nextPathStart) break;
      names.push(...extractNames(next.inner));
      cursor = next.parenStart + next.inner.length + 2;
    }

    if (names.length === 0) continue; // parenthetical is prose, not a name list

    const line = lineAt(source, group[0].start);
    for (const g of group) {
      if (readFileTextCached(g.file) === null) {
        errors.push(`${docRel}:${line} — 인용한 테스트 파일 없음: \`${g.file}\` (이동/리네임?)`);
      }
    }
    const present = group.filter((g) => readFileTextCached(g.file) !== null);
    if (present.length === 0) continue;

    const label = group.map((g) => g.file).join(" and ");
    for (const name of names) {
      checkedCitations += 1;
      if (!present.some((g) => nameExistsInFile(readFileTextCached(g.file), name))) {
        errors.push(
          `${docRel}:${line} — \`${label}\`가 인용한 테스트 이름이 파일에 없음: "${name}" (리네임/삭제된 테스트를 계약 산문이 그대로 인용 중)`,
        );
      }
    }
  }
}

if (errors.length > 0) {
  console.error("[guard:ledger-citations] Story Chain 테스트 인용 drift:");
  for (const e of errors) console.error(`  • ${e}`);
  console.error(
    `\n${errors.length}건. 계약 산문의 \`*.test.ts(x)\` ("이름") 인용이 실제 테스트와 어긋남 — 산문을 현재 동작으로 갱신하라.`,
  );
  process.exit(1);
}

console.log(
  `[guard:ledger-citations] OK (${contractDocs.length}개 Markdown 계약 문서 + ${ledgerSources.length}개 YAML 원장, ${checkedCitations}개 테스트 인용 확인).`,
);

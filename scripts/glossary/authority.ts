import { readFile } from "node:fs/promises";
import path from "node:path";

import GithubSlugger from "github-slugger";
import { fromMarkdown } from "mdast-util-from-markdown";
import { toString } from "mdast-util-to-string";

import { assertCurrentAuthorityFile } from "./file-ownership";
import type { GlossaryRegistry } from "./model";

export async function validateAuthorityReferences(
  registry: GlossaryRegistry,
  repositoryRoot = process.cwd(),
): Promise<void> {
  const anchorsByFile = new Map<string, Set<string>>();

  for (const term of registry.terms) {
    const [relativeFile, anchor] = term.authorityRef.split("#");
    let anchors = anchorsByFile.get(relativeFile);
    if (!anchors) {
      const authorityPath = path.join(repositoryRoot, relativeFile);
      await assertCurrentAuthorityFile(authorityPath, repositoryRoot);
      anchors = await readAnchors(authorityPath);
      anchorsByFile.set(relativeFile, anchors);
    }
    if (!anchors.has(anchor)) {
      throw new Error(`broken glossary authorityRef: ${term.authorityRef}`);
    }
  }
}

async function readAnchors(filePath: string): Promise<Set<string>> {
  const markdown = await readFile(filePath, "utf8");
  const tree = fromMarkdown(markdown);
  const slugger = new GithubSlugger();
  const anchors = new Set<string>();

  visit(tree);
  return anchors;

  function visit(node: { type: string; children?: readonly unknown[] }): void {
    if (node.type === "heading") {
      anchors.add(slugger.slug(toString(node, { includeHtml: false })));
    }
    for (const child of node.children ?? []) {
      visit(child as { type: string; children?: readonly unknown[] });
    }
  }
}

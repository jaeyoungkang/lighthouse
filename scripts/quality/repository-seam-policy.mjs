import ts from "typescript";

const TABLE_CAPABILITY_NAMES = new Set(["from", "rpc"]);
const BUILT_IN_ARRAY_FACTORIES = new Set([
  "Array",
  "BigInt64Array",
  "BigUint64Array",
  "Float32Array",
  "Float64Array",
  "Int8Array",
  "Int16Array",
  "Int32Array",
  "Uint8Array",
  "Uint8ClampedArray",
  "Uint16Array",
  "Uint32Array",
]);

function sourceFile(fileName, contents) {
  return ts.createSourceFile(
    fileName,
    contents,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function lineOf(source, node) {
  return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
}

function forEachBoundIdentifier(name, visit) {
  if (ts.isIdentifier(name)) {
    visit(name);
    return;
  }
  for (const element of name.elements) {
    if (ts.isBindingElement(element)) forEachBoundIdentifier(element.name, visit);
  }
}

function collectStaticStringDeclarations(source) {
  const declarations = new Map();
  function addBinding(name, initializer) {
    const bindings = declarations.get(name.text) ?? [];
    bindings.push(initializer);
    declarations.set(name.text, bindings);
  }
  function visit(node) {
    if (ts.isVariableDeclaration(node)) {
      if (ts.isIdentifier(node.name)) {
        const isConst =
          ts.isVariableDeclarationList(node.parent) &&
          (node.parent.flags & ts.NodeFlags.Const) !== 0;
        addBinding(node.name, isConst && node.initializer ? node.initializer : null);
      } else {
        forEachBoundIdentifier(node.name, (name) => addBinding(name, null));
      }
    } else if (ts.isParameter(node)) {
      forEachBoundIdentifier(node.name, (name) => addBinding(name, null));
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return declarations;
}

function unwrapTransparentExpression(node) {
  let expression = node;
  while (
    ts.isParenthesizedExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isTypeAssertionExpression(expression) ||
    ts.isNonNullExpression(expression) ||
    ts.isSatisfiesExpression(expression)
  ) {
    expression = expression.expression;
  }
  return expression;
}

function resolveStaticString(node, declarations, seen = new Set()) {
  const expression = unwrapTransparentExpression(node);
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
    return expression.text;
  }
  if (ts.isIdentifier(expression)) {
    if (seen.has(expression.text)) return null;
    const bindings = declarations.get(expression.text);
    if (bindings?.length !== 1 || !bindings[0]) return null;
    const nextSeen = new Set(seen);
    nextSeen.add(expression.text);
    return resolveStaticString(bindings[0], declarations, nextSeen);
  }
  if (
    ts.isBinaryExpression(expression) &&
    expression.operatorToken.kind === ts.SyntaxKind.PlusToken
  ) {
    const left = resolveStaticString(expression.left, declarations, seen);
    const right = resolveStaticString(expression.right, declarations, seen);
    return left == null || right == null ? null : `${left}${right}`;
  }
  return null;
}

function resolvePossibleStaticStrings(node, declarations, seen = new Set()) {
  const expression = unwrapTransparentExpression(node);
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
    return new Set([expression.text]);
  }
  if (ts.isIdentifier(expression)) {
    if (seen.has(expression.text)) return new Set();
    const nextSeen = new Set(seen);
    nextSeen.add(expression.text);
    const values = new Set();
    for (const binding of declarations.get(expression.text) ?? []) {
      if (!binding) continue;
      for (const value of resolvePossibleStaticStrings(binding, declarations, nextSeen)) {
        values.add(value);
      }
    }
    return values;
  }
  if (
    ts.isBinaryExpression(expression) &&
    expression.operatorToken.kind === ts.SyntaxKind.PlusToken
  ) {
    const values = new Set();
    for (const left of resolvePossibleStaticStrings(expression.left, declarations, seen)) {
      for (const right of resolvePossibleStaticStrings(expression.right, declarations, seen)) {
        values.add(`${left}${right}`);
      }
    }
    return values;
  }
  return new Set();
}

function memberCapabilityName(node, declarations) {
  const expression = unwrapTransparentExpression(node);
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  if (ts.isElementAccessExpression(expression) && expression.argumentExpression) {
    const staticName = resolveStaticString(expression.argumentExpression, declarations);
    if (staticName) return staticName;
    const possibleCapabilityNames = resolvePossibleStaticStrings(
      expression.argumentExpression,
      declarations,
    );
    if (possibleCapabilityNames.has("rpc")) return "rpc";
    if (possibleCapabilityNames.has("from")) return "from";
  }
  return null;
}

function memberReceiver(node) {
  const expression = unwrapTransparentExpression(node);
  return ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)
    ? expression.expression
    : null;
}

function isBuiltInArrayFrom(node, capabilityName) {
  if (capabilityName !== "from") return false;
  const receiver = memberReceiver(node);
  if (!receiver) return false;
  if (ts.isIdentifier(receiver)) return BUILT_IN_ARRAY_FACTORIES.has(receiver.text);
  return (
    ts.isPropertyAccessExpression(receiver) &&
    ts.isIdentifier(receiver.expression) &&
    receiver.expression.text === "globalThis" &&
    BUILT_IN_ARRAY_FACTORIES.has(receiver.name.text)
  );
}

function capabilityMember(node, declarations) {
  const expression = unwrapTransparentExpression(node);
  if (!ts.isPropertyAccessExpression(expression) && !ts.isElementAccessExpression(expression)) {
    return null;
  }
  const capabilityName = memberCapabilityName(expression, declarations);
  if (
    !TABLE_CAPABILITY_NAMES.has(capabilityName) ||
    isBuiltInArrayFrom(expression, capabilityName)
  ) {
    return null;
  }
  return { node: expression, capabilityName };
}

function bindingCapabilityName(node, declarations) {
  if (!ts.isBindingElement(node)) return null;
  const property = node.propertyName ?? node.name;
  if (ts.isIdentifier(property)) return property.text;
  if (ts.isStringLiteral(property) || ts.isNoSubstitutionTemplateLiteral(property)) {
    return property.text;
  }
  if (ts.isComputedPropertyName(property)) {
    return resolveStaticString(property.expression, declarations);
  }
  return null;
}

function isTableClientName(value) {
  return /(?:^|_)(?:db|client|supabase)$/i.test(value) || /(?:Db|Client)$/.test(value);
}

function isLikelyTableClientExpression(node, aliases = new Set()) {
  const expressionNode = unwrapTransparentExpression(node);
  if (ts.isIdentifier(expressionNode)) {
    return aliases.has(expressionNode.text) || isTableClientName(expressionNode.text);
  }
  if (ts.isPropertyAccessExpression(expressionNode)) {
    return isLikelyTableClientExpression(expressionNode.name, aliases);
  }
  if (ts.isCallExpression(expressionNode)) {
    const expression = expressionNode.expression;
    return (
      (ts.isIdentifier(expression) && isTableClientName(expression.text)) ||
      (ts.isPropertyAccessExpression(expression) && isTableClientName(expression.name.text))
    );
  }
  return false;
}

function resolveCapabilityResourceName(useNode, kind, declarations) {
  if (!ts.isCallExpression(useNode)) return null;
  if (kind === "forwarded-call" || kind === "extracted-alias-forwarding") {
    const expression = unwrapTransparentExpression(useNode.expression);
    if (
      (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) &&
      ["call", "bind"].includes(memberCapabilityName(expression, declarations))
    ) {
      const resource = useNode.arguments[1];
      return resource ? resolveStaticString(resource, declarations) : null;
    }
    return null;
  }
  const resource = useNode.arguments[0];
  return resource ? resolveStaticString(resource, declarations) : null;
}

export function findRepositoryTableCapabilityUses(contents, fileName) {
  const source = sourceFile(fileName, contents);
  const declarations = collectStaticStringDeclarations(source);
  const aliases = new Map();
  const tableClientAliases = new Set();
  const direct = [];

  function collect(node) {
    if (ts.isVariableDeclaration(node) && node.initializer) {
      if (ts.isIdentifier(node.name)) {
        if (isLikelyTableClientExpression(node.initializer, tableClientAliases)) {
          tableClientAliases.add(node.name.text);
        }
        const member = capabilityMember(node.initializer, declarations);
        if (member) {
          aliases.set(node.name.text, { ...member, acquisitionNode: node });
          direct.push({
            ...member,
            useNode: node,
            kind: "extracted-capability",
          });
        } else if (ts.isIdentifier(node.initializer)) {
          aliases.set(node.name.text, { aliasRef: node.initializer.text, node });
        }
      } else if (ts.isObjectBindingPattern(node.name)) {
        for (const element of node.name.elements) {
          const capabilityName = bindingCapabilityName(element, declarations);
          if (isTableClientName(String(capabilityName)) && ts.isIdentifier(element.name)) {
            tableClientAliases.add(element.name.text);
          }
          if (TABLE_CAPABILITY_NAMES.has(capabilityName) && ts.isIdentifier(element.name)) {
            aliases.set(element.name.text, {
              node: element,
              acquisitionNode: element,
              capabilityName,
            });
            const renamed =
              element.propertyName != null &&
              (!ts.isIdentifier(element.propertyName) ||
                element.propertyName.text !== element.name.text);
            if (renamed || isLikelyTableClientExpression(node.initializer, tableClientAliases)) {
              direct.push({
                node: element,
                capabilityName,
                useNode: element,
                kind: "extracted-capability",
              });
            }
          }
        }
      }
    }

    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isIdentifier(node.left)
    ) {
      const member = capabilityMember(node.right, declarations);
      if (isLikelyTableClientExpression(node.right, tableClientAliases)) {
        tableClientAliases.add(node.left.text);
      }
      if (member) {
        aliases.set(node.left.text, { ...member, acquisitionNode: node });
        direct.push({
          ...member,
          useNode: node,
          kind: "extracted-capability",
        });
      }
    }

    if (ts.isCallExpression(node)) {
      const member = capabilityMember(node.expression, declarations);
      if (member) direct.push({ ...member, useNode: node, kind: "direct-call" });
      if (
        ts.isPropertyAccessExpression(node.expression) &&
        ["call", "apply", "bind"].includes(node.expression.name.text)
      ) {
        const forwarded = capabilityMember(node.expression.expression, declarations);
        if (forwarded) direct.push({ ...forwarded, useNode: node, kind: "forwarded-call" });
      }
    }
    ts.forEachChild(node, collect);
  }
  collect(source);

  let changed = true;
  while (changed) {
    changed = false;
    for (const [name, item] of aliases) {
      if (!item.aliasRef) continue;
      const target = aliases.get(item.aliasRef);
      if (target?.capabilityName) {
        aliases.set(name, {
          node: item.node,
          acquisitionNode: item.node,
          capabilityName: target.capabilityName,
        });
        changed = true;
      }
    }
  }

  function collectAliasCalls(node) {
    if (ts.isCallExpression(node)) {
      let aliasName = ts.isIdentifier(node.expression) ? node.expression.text : null;
      let kind = "extracted-alias-call";
      if (
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        ["call", "apply", "bind"].includes(node.expression.name.text)
      ) {
        aliasName = node.expression.expression.text;
        kind = "extracted-alias-forwarding";
      } else if (
        ts.isElementAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        node.expression.argumentExpression &&
        ["call", "apply", "bind"].includes(
          resolveStaticString(node.expression.argumentExpression, declarations),
        )
      ) {
        aliasName = node.expression.expression.text;
        kind = "extracted-alias-forwarding";
      } else if (
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        node.expression.expression.text === "Reflect" &&
        node.expression.name.text === "apply" &&
        ts.isIdentifier(node.arguments[0])
      ) {
        aliasName = node.arguments[0].text;
        kind = "extracted-alias-forwarding";
      }
      const alias = aliasName ? aliases.get(aliasName) : null;
      if (alias?.capabilityName) {
        direct.push({
          node: alias.node,
          capabilityName: alias.capabilityName,
          useNode: alias.acquisitionNode ?? alias.node,
          kind: "extracted-capability",
        });
        direct.push({
          node: alias.node,
          capabilityName: alias.capabilityName,
          useNode: node,
          kind,
        });
      }
    }
    ts.forEachChild(node, collectAliasCalls);
  }
  collectAliasCalls(source);

  const seen = new Set();
  return direct.flatMap((item) => {
    const key = `${item.useNode.pos}:${item.capabilityName}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [
      {
        capabilityName: item.capabilityName,
        resourceName: resolveCapabilityResourceName(item.useNode, item.kind, declarations),
        kind: item.kind,
        line: lineOf(source, item.useNode),
        text: item.useNode.getText(source),
      },
    ];
  });
}

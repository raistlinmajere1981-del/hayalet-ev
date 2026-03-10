import { readFileSync, existsSync } from "fs";
import { join, extname } from "path";
import type { NodePath } from "@babel/traverse";
import type * as t from "@babel/types";
import { createMcpTranslatorSync } from "../../utils/i18n/index.js";

type TraverseFn = (...args: unknown[]) => unknown;

function structureVizT(key: string, params?: Record<string, string | number | boolean>): string {
  return createMcpTranslatorSync()(`mcpServer.devTools.structureVisualizer.${key}`, params);
}

export async function visualizeStructure(
  projectRoot: string,
  filePath: string,
  options: {
    showScopes?: boolean;
    showBrackets?: boolean;
    showComments?: boolean;
    showStrings?: boolean;
    maxDepth?: number;
  } = {}
): Promise<{
  success: boolean;
  output: string;
  tree?: unknown;
  errors: string[];
}> {
  const {
    showScopes = true,
    showBrackets = true,
    showComments = true,
    showStrings: _showStrings = false,
    maxDepth = 10,
  } = options;

  const fullPath = join(projectRoot, filePath);
  const errors: string[] = [];
  const output: string[] = [];

  if (!existsSync(fullPath)) {
    return {
      success: false,
      output: structureVizT("runtime.fileNotFound", { filePath }),
      errors: [structureVizT("runtime.fileNotFoundShort")],
    };
  }

  const content = readFileSync(fullPath, "utf-8");
  const ext = extname(filePath);
  const lines = content.split("\n");

  output.push(structureVizT("runtime.title", { filePath }));
  output.push("═".repeat(50));
  output.push("");

  let scopeCount = 0;
  let astParseSuccess = false;

  if ([".js", ".ts", ".jsx", ".tsx", ".mjs", ".cjs"].includes(ext)) {
    try {
      const { parse } = await import("@babel/parser");
      const traverseImport = await import("@babel/traverse");
      // NOTE: Support both CommonJS and ESM Babel traverse exports.
      interface TraverseModule {
        default?: TraverseFn | { default?: TraverseFn };
      }
      const traverseModule = traverseImport as TraverseModule;
      const fallbackTraverse: TraverseFn = (): void => {};
      const traverse: TraverseFn =
        typeof traverseImport === "function"
          ? (traverseImport as TraverseFn)
          : typeof traverseModule.default === "function"
            ? traverseModule.default
            : (traverseModule.default?.default ?? fallbackTraverse);

      const ast = parse(content, {
        sourceType: "module",
        plugins: [
          "typescript",
          "jsx",
          "decorators-legacy",
          "classProperties",
          "objectRestSpread",
          "optionalChaining",
          "nullishCoalescingOperator",
        ],
      });

      astParseSuccess = true;

      if (showScopes) {
        output.push(structureVizT("runtime.scopeHierarchyTitle"));
        output.push("━".repeat(50));

        const scopes: Array<{
          type: string;
          name: string;
          start: number;
          end: number;
          startLine: number;
          endLine: number;
          parent?: string;
        }> = [];

        traverse(ast, {
          FunctionDeclaration(path: NodePath<t.FunctionDeclaration>) {
            const node = path.node;
            if (node.start != null && node.end != null && node.loc) {
              scopes.push({
                type: "function",
                name: node.id?.name ?? "anonymous",
                start: node.start,
                end: node.end,
                startLine: node.loc.start.line,
                endLine: node.loc.end.line,
              });
            }
          },
          FunctionExpression(path: NodePath<t.FunctionExpression>) {
            const node = path.node;
            if (node.start != null && node.end != null && node.loc) {
              scopes.push({
                type: "function",
                name: node.id?.name ?? "anonymous",
                start: node.start,
                end: node.end,
                startLine: node.loc.start.line,
                endLine: node.loc.end.line,
              });
            }
          },
          ArrowFunctionExpression(path: NodePath<t.FunctionExpression>) {
            const node = path.node;
            if (node.start != null && node.end != null && node.loc) {
              scopes.push({
                type: "arrow",
                name: "arrow function",
                start: node.start,
                end: node.end,
                startLine: node.loc.start.line,
                endLine: node.loc.end.line,
              });
            }
          },
          ClassDeclaration(path: NodePath<t.ClassDeclaration>) {
            const node = path.node;
            if (node.start != null && node.end != null && node.loc) {
              scopes.push({
                type: "class",
                name: node.id?.name ?? "anonymous",
                start: node.start,
                end: node.end,
                startLine: node.loc.start.line,
                endLine: node.loc.end.line,
              });
            }
          },
          IfStatement(path: NodePath<t.IfStatement>) {
            const node = path.node;
            if (node.start != null && node.end != null && node.loc) {
              scopes.push({
                type: "if",
                name: "if statement",
                start: node.start,
                end: node.end,
                startLine: node.loc.start.line,
                endLine: node.loc.end.line,
              });
            }
          },
          ForStatement(path: NodePath<t.ForStatement>) {
            const node = path.node;
            if (node.start != null && node.end != null && node.loc) {
              scopes.push({
                type: "for",
                name: "for loop",
                start: node.start,
                end: node.end,
                startLine: node.loc.start.line,
                endLine: node.loc.end.line,
              });
            }
          },
          WhileStatement(path: NodePath<t.WhileStatement>) {
            const node = path.node;
            if (node.start != null && node.end != null && node.loc) {
              scopes.push({
                type: "while",
                name: "while loop",
                start: node.start,
                end: node.end,
                startLine: node.loc.start.line,
                endLine: node.loc.end.line,
              });
            }
          },
          TryStatement(path: NodePath<t.TryStatement>) {
            const node = path.node;
            if (node.start != null && node.end != null && node.loc) {
              scopes.push({
                type: "try",
                name: "try block",
                start: node.start,
                end: node.end,
                startLine: node.loc.start.line,
                endLine: node.loc.end.line,
              });
            }
          },
          SwitchStatement(path: NodePath<t.SwitchStatement>) {
            const node = path.node;
            if (node.start != null && node.end != null && node.loc) {
              scopes.push({
                type: "switch",
                name: "switch statement",
                start: node.start,
                end: node.end,
                startLine: node.loc.start.line,
                endLine: node.loc.end.line,
              });
            }
          },
        });

        scopes.sort((a, b) => a.startLine - b.startLine);

        const rootScopes = scopes.filter(
          (s) =>
            !scopes.some((parent) => parent.start < s.start && parent.end > s.end && parent !== s)
        );

        const renderScope = (
          scope: (typeof scopes)[0],
          depth: number = 0,
          prefix: string = ""
        ): void => {
          if (depth > maxDepth) return;

          const indent = "  ".repeat(depth);
          const lineRange = `${scope.startLine}-${scope.endLine}`;
          const icon =
            scope.type === "function"
              ? "⚡"
              : scope.type === "class"
                ? "🏛️"
                : scope.type === "if"
                  ? "🔀"
                  : scope.type === "for" || scope.type === "while"
                    ? "🔁"
                    : scope.type === "try"
                      ? "🛡️"
                      : scope.type === "switch"
                        ? "🎛️"
                        : "📦";

          const status =
            scope.endLine !== 0
              ? structureVizT("runtime.scopeStatus.closed")
              : structureVizT("runtime.scopeStatus.unclosed");

          output.push(
            `${indent}${lineRange.padEnd(8)} │ ${prefix}${icon} ${scope.name.padEnd(25)} ${status}`
          );

          const children = scopes.filter(
            (child) =>
              child.start > scope.start &&
              child.end < scope.end &&
              !scopes.some(
                (between) =>
                  between.start > scope.start &&
                  between.end < scope.end &&
                  between.start < child.start &&
                  between.end > child.end &&
                  between !== child
              )
          );

          children.forEach((child, idx) => {
            const isLast = idx === children.length - 1;
            const childPrefix = isLast ? "└─ " : "├─ ";
            renderScope(child, depth + 1, childPrefix);
          });
        };

        rootScopes.forEach((scope) => {
          renderScope(scope);
        });

        output.push("━".repeat(50));
        output.push("");

        scopeCount = scopes.length;
      }

      output.push(structureVizT("runtime.astParseSuccess", { scopeCount }));
    } catch (err) {
      const error = err as Error;
      errors.push(structureVizT("runtime.astParseError", { message: error.message }));
      output.push(structureVizT("runtime.astParseFallback"));
      output.push("");
    }
  }

  if (showBrackets) {
    output.push("");
    output.push(structureVizT("runtime.bracketAnalysisTitle"));
    output.push("━".repeat(50));

    if (astParseSuccess) {
      output.push(structureVizT("runtime.bracketsBalancedAst"));
      output.push("━".repeat(50));
    } else {
      const bracketCounts = countBracketsContextAware(content);
      const unclosedBrackets: Array<{ char: string; line: number; col: number }> = [];
      const extraBrackets: Array<{ char: string; line: number; col: number }> = [];

      const bracketPairs = { "(": ")", "{": "}", "[": "]" };

      for (const [openChar, closeChar] of Object.entries(bracketPairs)) {
        const openList = bracketCounts.open[openChar];
        const closeList = bracketCounts.close[closeChar];

        if (!openList || !closeList) continue;

        if (openList.length > closeList.length) {
          const diff = openList.length - closeList.length;
          unclosedBrackets.push(...openList.slice(-diff).map((b) => ({ char: openChar, ...b })));
        } else if (closeList.length > openList.length) {
          const diff = closeList.length - openList.length;
          extraBrackets.push(...closeList.slice(-diff).map((b) => ({ char: closeChar, ...b })));
        }
      }

      if (unclosedBrackets.length === 0 && extraBrackets.length === 0) {
        output.push(structureVizT("runtime.bracketsBalanced"));
      } else {
        if (unclosedBrackets.length > 0) {
          output.push(
            structureVizT("runtime.unclosedBracketsTitle", { count: unclosedBrackets.length })
          );
          unclosedBrackets.slice(0, 5).forEach((b) => {
            output.push(
              structureVizT("runtime.unclosedBracketLine", {
                line: b.line,
                col: b.col,
                char: b.char,
              })
            );
          });
          if (unclosedBrackets.length > 5) {
            output.push(
              structureVizT("runtime.moreBracketIssues", { count: unclosedBrackets.length - 5 })
            );
          }
        }

        if (extraBrackets.length > 0) {
          output.push(structureVizT("runtime.extraBracketsTitle", { count: extraBrackets.length }));
          extraBrackets.slice(0, 5).forEach((b) => {
            output.push(
              structureVizT("runtime.extraBracketLine", {
                line: b.line,
                col: b.col,
                char: b.char,
              })
            );
          });
          if (extraBrackets.length > 5) {
            output.push(
              structureVizT("runtime.moreBracketIssues", { count: extraBrackets.length - 5 })
            );
          }
        }
      }

      output.push("━".repeat(50));
    }
  }

  if (showComments) {
    output.push("");
    output.push(structureVizT("runtime.commentBlocksTitle"));
    output.push("━".repeat(50));

    const commentBlocks: Array<{ type: string; start: number; end?: number }> = [];
    let inMultilineComment = false;
    let multilineStart = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line == null || line === "") continue;

      if (line.includes("//")) {
        commentBlocks.push({ type: "single", start: i + 1 });
      }

      if (line.includes("/*")) {
        inMultilineComment = true;
        multilineStart = i + 1;
      }

      if (inMultilineComment && line.includes("*/")) {
        commentBlocks.push({ type: "multi", start: multilineStart, end: i + 1 });
        inMultilineComment = false;
      }
    }

    if (inMultilineComment) {
      commentBlocks.push({ type: "multi", start: multilineStart });
      errors.push(structureVizT("runtime.unclosedCommentError", { startLine: multilineStart }));
    }

    if (commentBlocks.length === 0) {
      output.push(structureVizT("runtime.noCommentBlocks"));
    } else {
      const singleComments = commentBlocks.filter((c) => c.type === "single");
      const multiComments = commentBlocks.filter((c) => c.type === "multi");

      output.push(structureVizT("runtime.singleLineComments", { count: singleComments.length }));
      output.push(structureVizT("runtime.multiLineComments", { count: multiComments.length }));

      multiComments.slice(0, 5).forEach((c) => {
        if (c.end != null && c.end > 0) {
          output.push(structureVizT("runtime.commentBlockClosed", { start: c.start, end: c.end }));
        } else {
          output.push(structureVizT("runtime.commentBlockUnclosed", { start: c.start }));
        }
      });
    }

    output.push("━".repeat(50));
  }

  output.push("");
  output.push(structureVizT("runtime.totalLines", { count: lines.length }));

  if (errors.length > 0) {
    output.push("");
    output.push(structureVizT("runtime.issuesDetected"));
    errors.forEach((err) => output.push(`   • ${err}`));
  }

  return {
    success: errors.length === 0,
    output: output.join("\n"),
    errors,
  };
}

export function countBracketsContextAware(content: string): {
  open: { [key: string]: Array<{ line: number; col: number }> };
  close: { [key: string]: Array<{ line: number; col: number }> };
  balanced: boolean;
} {
  const lines = content.split("\n");
  const open: { [key: string]: Array<{ line: number; col: number }> } = {
    "(": [],
    "{": [],
    "[": [],
  };
  const close: { [key: string]: Array<{ line: number; col: number }> } = {
    ")": [],
    "}": [],
    "]": [],
  };

  let inString = false;
  let stringChar = "";
  let inRegex = false;
  let inSingleLineComment: boolean;
  let inMultiLineComment = false;

  const templateLiteralStack: number[] = [];

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    if (line == null || line === "") continue;
    inSingleLineComment = false;

    for (let col = 0; col < line.length; col++) {
      const char = line[col];
      const nextChar = col < line.length - 1 ? line[col + 1] : "";

      if (inSingleLineComment) continue;

      if (!inString && !inRegex && char === "/" && nextChar === "*") {
        inMultiLineComment = true;
        col++;
        continue;
      }
      if (inMultiLineComment && char === "*" && nextChar === "/") {
        inMultiLineComment = false;
        col++;
        continue;
      }
      if (inMultiLineComment) continue;

      if (!inString && !inRegex && char === "/" && nextChar === "/") {
        inSingleLineComment = true;
        continue;
      }

      if ((char === '"' || char === "'" || char === "`") && !inRegex) {
        let bsCount = 0;
        let bsPos = col - 1;
        while (bsPos >= 0 && line[bsPos] === "\\") {
          bsCount++;
          bsPos--;
        }
        const isEscapedQuote = bsCount % 2 === 1;

        if (!isEscapedQuote) {
          if (!inString) {
            inString = true;
            stringChar = char;
          } else if (char === stringChar) {
            inString = false;
            stringChar = "";
          }
        }
        continue;
      }

      if (inString && stringChar === "`") {
        if (char === "$" && nextChar === "{") {
          templateLiteralStack.push(0);
          inString = false;
          stringChar = "";
          col++;
          continue;
        }
        continue;
      }

      if (inString) continue;

      if (templateLiteralStack.length > 0) {
        if (char === "{") {
          const lastIdx = templateLiteralStack.length - 1;
          templateLiteralStack[lastIdx] = (templateLiteralStack[lastIdx] ?? 0) + 1;
          open[char]?.push({ line: lineIdx + 1, col: col + 1 });
          continue;
        }
        if (char === "}") {
          const lastIdx = templateLiteralStack.length - 1;
          const depth = templateLiteralStack[lastIdx] ?? 0;
          if (depth === 0) {
            templateLiteralStack.pop();
            inString = true;
            stringChar = "`";
            continue;
          } else {
            templateLiteralStack[lastIdx] = depth - 1;
            close[char]?.push({ line: lineIdx + 1, col: col + 1 });
            continue;
          }
        }
      }

      if (char === "/" && !inRegex) {
        let backslashCount = 0;
        let checkPos = col - 1;
        while (checkPos >= 0 && line[checkPos] === "\\") {
          backslashCount++;
          checkPos--;
        }
        const isEscaped = backslashCount % 2 === 1;

        if (!isEscaped) {
          let prevTokenEnd = col - 1;
          while (
            prevTokenEnd >= 0 &&
            line[prevTokenEnd] != null &&
            line[prevTokenEnd] !== "" &&
            /\s/.test(line[prevTokenEnd] ?? "")
          ) {
            prevTokenEnd--;
          }

          const prevTokenChar =
            prevTokenEnd >= 0 && line[prevTokenEnd] != null && line[prevTokenEnd] !== ""
              ? line[prevTokenEnd]
              : "";
          const isDivision =
            prevTokenChar != null && prevTokenChar !== "" ? /[\w$)\]]/.test(prevTokenChar) : false;

          if (!isDivision) {
            const beforeChars = [
              "=",
              "(",
              ",",
              ":",
              "[",
              "{",
              ";",
              "!",
              "&",
              "|",
              "?",
              "+",
              "-",
              "*",
              "%",
              "~",
              "^",
            ];
            // NOTE: Use prevTokenEnd (whitespace-skipped) instead of checkPos (backslash-skipped).
            const prevChar = prevTokenEnd >= 0 ? line[prevTokenEnd] : undefined;
            const charBefore = typeof prevChar === "string" ? prevChar : "";
            const isRegexStart =
              col === 0 || (charBefore !== "" && beforeChars.includes(charBefore));

            if (isRegexStart) {
              inRegex = true;
              continue;
            }
          }
        }
      } else if (char === "/" && inRegex) {
        let backslashCount = 0;
        let checkPos = col - 1;
        while (checkPos >= 0 && line[checkPos] === "\\") {
          backslashCount++;
          checkPos--;
        }
        const isEscaped = backslashCount % 2 === 1;

        if (!isEscaped) {
          const regexFlags = ["i", "g", "m", "s", "u", "y", ".", " ", ")", ";", ",", "}", "]"];
          const isRegexEnd =
            (nextChar != null && nextChar !== "" && regexFlags.includes(nextChar)) ||
            col === line.length - 1;

          if (isRegexEnd) {
            inRegex = false;
            continue;
          }
        }
      }

      if (inRegex) continue;

      let isGenericType = false;
      if (char === "<" || char === ">") {
        const prevWord = line.substring(Math.max(0, col - 10), col).match(/[A-Za-z_$][\w$]*$/);
        const nextWord = line
          .substring(col + 1, Math.min(line.length, col + 11))
          .match(/^[A-Za-z_$][\w$]*/);

        if ((prevWord ?? nextWord) || (char === ">" && line[col + 1] === ">")) {
          isGenericType = true;
        }
      }

      if (!isGenericType) {
        if (char === "(" || char === "{" || char === "[") {
          open[char]?.push({ line: lineIdx + 1, col: col + 1 });
        } else if (char === ")" || char === "}" || char === "]") {
          close[char]?.push({ line: lineIdx + 1, col: col + 1 });
        }
      }
    }
  }

  const balanced =
    (open["("]?.length ?? 0) === (close[")"]?.length ?? 0) &&
    (open["{"]?.length ?? 0) === (close["}"]?.length ?? 0) &&
    (open["["]?.length ?? 0) === (close["]"]?.length ?? 0);

  return { open, close, balanced };
}

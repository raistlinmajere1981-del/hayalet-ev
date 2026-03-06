/**
 * Development Tools - Structure Visualizer
 *
 * Dosya yapısını görselleştir: AST tree, scope hierarchy, bracket analysis
 */

import { readFileSync, existsSync } from "fs";
import { join, extname } from "path";
import type { NodePath } from "@babel/traverse";
import type * as t from "@babel/types";

type TraverseFn = (...args: unknown[]) => unknown;

// Copy full implementation from dev-tools.ts lines 1293-1785
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
      output: `❌ Dosya bulunamadı: ${filePath}`,
      errors: ["File not found"],
    };
  }

  const content = readFileSync(fullPath, "utf-8");
  const ext = extname(filePath);
  const lines = content.split("\n");

  output.push(`🔍 Dosya Yapısı: ${filePath}`);
  output.push("═".repeat(50));
  output.push("");

  let scopeCount = 0; // Track scope count outside try block
  let astParseSuccess = false; // Track AST parse success for bracket validation

  // Try AST parsing for JS/TS files
  if ([".js", ".ts", ".jsx", ".tsx", ".mjs", ".cjs"].includes(ext)) {
    try {
      const { parse } = await import("@babel/parser");
      const traverseImport = await import("@babel/traverse");
      // Handle both CommonJS and ESM imports
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

      // AST parse successful means brackets are balanced
      astParseSuccess = true;

      if (showScopes) {
        output.push("📦 SCOPE HIERARCHY:");
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

        // Sort by start line
        scopes.sort((a, b) => a.startLine - b.startLine);

        // Build hierarchy
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

          const status = scope.endLine !== 0 ? "✅" : "❌ UNCLOSED";

          output.push(
            `${indent}${lineRange.padEnd(8)} │ ${prefix}${icon} ${scope.name.padEnd(25)} ${status}`
          );

          // Find children
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

        scopeCount = scopes.length; // Save count before leaving scope
      }

      output.push(`✅ AST parse başarılı (${scopeCount} scope bulundu)`);
    } catch (err) {
      const error = err as Error;
      errors.push(`AST parse error: ${error.message}`);
      output.push(`⚠️  AST parse başarısız, fallback mod kullanılıyor...`);
      output.push("");
    }
  }

  // Bracket analysis (always run, context-aware)
  if (showBrackets) {
    output.push("");
    output.push("🔗 BRACKET ANALYSIS:");
    output.push("━".repeat(50));

    // If AST parse was successful, brackets are guaranteed to be balanced
    if (astParseSuccess) {
      output.push("✅ Tüm parantezler dengeli (Babel AST parse başarılı)");
      output.push("━".repeat(50));
      // Skip manual counting, AST parse guarantees correctness
    } else {
      // Fallback to manual bracket counting for non-JS files or parse failures
      const bracketCounts = countBracketsContextAware(content);
      const unclosedBrackets: Array<{ char: string; line: number; col: number }> = [];
      const extraBrackets: Array<{ char: string; line: number; col: number }> = [];

      // Calculate unclosed and extra brackets
      const bracketPairs = { "(": ")", "{": "}", "[": "]" };

      for (const [openChar, closeChar] of Object.entries(bracketPairs)) {
        const openList = bracketCounts.open[openChar];
        const closeList = bracketCounts.close[closeChar];

        if (!openList || !closeList) continue;

        if (openList.length > closeList.length) {
          // More opens than closes - some are unclosed
          const diff = openList.length - closeList.length;
          unclosedBrackets.push(...openList.slice(-diff).map((b) => ({ char: openChar, ...b })));
        } else if (closeList.length > openList.length) {
          // More closes than opens - some are extra
          const diff = closeList.length - openList.length;
          extraBrackets.push(...closeList.slice(-diff).map((b) => ({ char: closeChar, ...b })));
        }
      }

      if (unclosedBrackets.length === 0 && extraBrackets.length === 0) {
        output.push("✅ Tüm parantezler dengeli");
      } else {
        if (unclosedBrackets.length > 0) {
          output.push(`❌ Kapanmamış parantezler (${unclosedBrackets.length}):`);
          unclosedBrackets.slice(0, 5).forEach((b) => {
            output.push(`   Line ${b.line}, Col ${b.col}: '${b.char}' kapanmamış`);
          });
          if (unclosedBrackets.length > 5) {
            output.push(`   ... ve ${unclosedBrackets.length - 5} tane daha`);
          }
        }

        if (extraBrackets.length > 0) {
          output.push(`❌ Fazla kapanış parantezleri (${extraBrackets.length}):`);
          extraBrackets.slice(0, 5).forEach((b) => {
            output.push(`   Line ${b.line}, Col ${b.col}: '${b.char}' açılış yok`);
          });
          if (extraBrackets.length > 5) {
            output.push(`   ... ve ${extraBrackets.length - 5} tane daha`);
          }
        }
      }

      output.push("━".repeat(50));
    } // End of else block (fallback manual counting)
  }

  // Comment analysis
  if (showComments) {
    output.push("");
    output.push("💬 COMMENT BLOCKS:");
    output.push("━".repeat(50));

    const commentBlocks: Array<{ type: string; start: number; end?: number }> = [];
    let inMultilineComment = false;
    let multilineStart = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line == null || line === "") continue;

      // Single line comments
      if (line.includes("//")) {
        commentBlocks.push({ type: "single", start: i + 1 });
      }

      // Multi-line comments
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
      errors.push(`Unclosed multi-line comment starting at line ${multilineStart}`);
    }

    if (commentBlocks.length === 0) {
      output.push("   (Yorum bloğu yok)");
    } else {
      const singleComments = commentBlocks.filter((c) => c.type === "single");
      const multiComments = commentBlocks.filter((c) => c.type === "multi");

      output.push(`   Single-line: ${singleComments.length}`);
      output.push(`   Multi-line: ${multiComments.length}`);

      multiComments.slice(0, 5).forEach((c) => {
        if (c.end != null && c.end > 0) {
          output.push(`   Line ${c.start}-${c.end}: /* ... */ ✅`);
        } else {
          output.push(`   Line ${c.start}: /* ... ❌ UNCLOSED`);
        }
      });
    }

    output.push("━".repeat(50));
  }

  output.push("");
  output.push(`📊 Total Lines: ${lines.length}`);

  if (errors.length > 0) {
    output.push("");
    output.push("⚠️  ISSUES DETECTED:");
    errors.forEach((err) => output.push(`   • ${err}`));
  }

  return {
    success: errors.length === 0,
    output: output.join("\n"),
    errors,
  };
}

/**
 * Context-aware bracket counting (ignores brackets inside strings and regexes)
 */
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

  // Stack for template literal interpolation: ${...} içindeki kodu doğru parse etmek için
  // Her eleman bir template literal context'i temsil eder (nested template literal desteği)
  // Stack'e push: ${ görüldüğünde (template literal içindeyken)
  // Stack'ten pop: } görüldüğünde ve stack boş değilken
  const templateLiteralStack: number[] = []; // stores brace depth at each template level

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    if (line == null || line === "") continue;
    inSingleLineComment = false; // Reset at start of each line

    for (let col = 0; col < line.length; col++) {
      const char = line[col];
      const nextChar = col < line.length - 1 ? line[col + 1] : "";

      // Skip if in single-line comment
      if (inSingleLineComment) continue;

      // Multi-line comment detection
      if (!inString && !inRegex && char === "/" && nextChar === "*") {
        inMultiLineComment = true;
        col++; // Skip next char
        continue;
      }
      if (inMultiLineComment && char === "*" && nextChar === "/") {
        inMultiLineComment = false;
        col++; // Skip next char
        continue;
      }
      if (inMultiLineComment) continue;

      // Single-line comment detection
      if (!inString && !inRegex && char === "/" && nextChar === "/") {
        inSingleLineComment = true;
        continue;
      }

      // String detection (with proper escape handling via backslash counting)
      if ((char === '"' || char === "'" || char === "`") && !inRegex) {
        // Count preceding backslashes to handle escaped quotes correctly
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

      // Template literal ${...} interpolation handling
      if (inString && stringChar === "`") {
        if (char === "$" && nextChar === "{") {
          // Entering interpolation — pause template literal, start counting code
          templateLiteralStack.push(0); // push brace depth counter
          inString = false;
          stringChar = "";
          col++; // skip the '{' after '$'
          continue;
        }
        continue; // skip other chars inside template literal
      }

      // Skip if in regular string (single/double quote)
      if (inString) continue;

      // Template literal interpolation brace tracking
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
            // This } closes the interpolation — back to template literal
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
        // Other chars inside interpolation are normal code — fall through to bracket counting below
      }

      // Regex detection with proper escape handling
      if (char === "/" && !inRegex) {
        // Check if this / is escaped by counting preceding backslashes
        let backslashCount = 0;
        let checkPos = col - 1;
        while (checkPos >= 0 && line[checkPos] === "\\") {
          backslashCount++;
          checkPos--;
        }
        // If odd number of backslashes, the / is escaped
        const isEscaped = backslashCount % 2 === 1;

        if (!isEscaped) {
          // Check if previous non-whitespace token suggests division operator
          let prevTokenEnd = col - 1;
          while (
            prevTokenEnd >= 0 &&
            line[prevTokenEnd] != null &&
            line[prevTokenEnd] !== "" &&
            /\s/.test(line[prevTokenEnd] ?? "")
          ) {
            prevTokenEnd--;
          }

          // If previous token ends with identifier, digit, or closing bracket, it's division
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
            // Use prevTokenEnd (whitespace-skipped) instead of checkPos (backslash-skipped)
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
        // Check if regex-ending / is escaped
        let backslashCount = 0;
        let checkPos = col - 1;
        while (checkPos >= 0 && line[checkPos] === "\\") {
          backslashCount++;
          checkPos--;
        }
        const isEscaped = backslashCount % 2 === 1;

        if (!isEscaped) {
          // Verify this is truly regex end by checking next char (flags or delimiter)
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

      // Skip if in regex
      if (inRegex) continue;

      // Skip generic types (< and >)
      // TypeScript: Map<string, number>, Record<K, V>, Array<T>
      let isGenericType = false;
      if (char === "<" || char === ">") {
        // Check if this is likely a generic type
        // Pattern: word< or >, or <word
        const prevWord = line.substring(Math.max(0, col - 10), col).match(/[A-Za-z_$][\w$]*$/);
        const nextWord = line
          .substring(col + 1, Math.min(line.length, col + 11))
          .match(/^[A-Za-z_$][\w$]*/);

        if ((prevWord ?? nextWord) || (char === ">" && line[col + 1] === ">")) {
          isGenericType = true;
        }
      }

      // Count brackets (only outside strings, regexes, comments, and generic types)
      if (!isGenericType) {
        if (char === "(" || char === "{" || char === "[") {
          open[char]?.push({ line: lineIdx + 1, col: col + 1 });
        } else if (char === ")" || char === "}" || char === "]") {
          close[char]?.push({ line: lineIdx + 1, col: col + 1 });
        }
      }
    }
  }

  // Check balance
  const balanced =
    (open["("]?.length ?? 0) === (close[")"]?.length ?? 0) &&
    (open["{"]?.length ?? 0) === (close["}"]?.length ?? 0) &&
    (open["["]?.length ?? 0) === (close["]"]?.length ?? 0);

  return { open, close, balanced };
}

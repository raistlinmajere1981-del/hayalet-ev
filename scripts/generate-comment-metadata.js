#!/usr/bin/env node
import { fileURLToPath } from "url";
import { dirname, extname, join, relative } from "path";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, "..");
const METADATA_DIR = join(PROJECT_ROOT, ".rovo", "_metadata");
const MARKDOWN_OUTPUT = join(METADATA_DIR, "COMMENT-INDEX.md");
const JSON_OUTPUT = join(METADATA_DIR, "COMMENT-INDEX.json");

const SOURCE_DIRS = ["src", "electron"];
const ALLOWED_EXTENSIONS = new Set([".ts", ".js", ".cjs", ".mjs"]);
const IGNORED_DIRS = new Set([
  ".git",
  ".rovo",
  ".sisyphus",
  ".vite",
  "dist",
  "logs",
  "node_modules",
  "coverage",
]);
const EXCLUDED_PATH_PREFIXES = [
  "ghost-agent/",
];
const EXCLUDED_PATHS = new Set([
  "src/js/pages/shared/provider-test-presentation.ts",
  "src/js/pages/assistant/test-results-modal.ts",
]);
const DIRECTIVE_PATTERNS = [
  /^eslint-/i,
  /^prettier-ignore/i,
  /^@ts-/i,
  /^istanbul /i,
  /^c8 /i,
  /^v8 ignore/i,
];
const LOW_SIGNAL_PATTERNS = [
  /^noop$/i,
  /^ignore$/i,
  /^\d+\.\s/,
  /^(ms|mb|kb|gb|seconds?|minutes?|hours?|days?)$/i,
  /^(types|constants|imports|public api|helper functions|tool definitions)$/i,
  /^(base directories|account-specific paths|electron-specific paths|provider paths|utility methods)$/i,
  /^(stats|category filter|result object|connect to the webview|enable the runtime|test each selector)$/i,
];
const STANDARD_PREFIXES = ["AI", "NOTE", "WARNING", "TODO"];
const SYMBOL_PATTERNS = [
  { type: "class", regex: /^\s*export\s+class\s+([A-Za-z_$][\w$]*)/ },
  { type: "class", regex: /^\s*class\s+([A-Za-z_$][\w$]*)/ },
  { type: "function", regex: /^\s*export\s+async\s+function\s+([A-Za-z_$][\w$]*)/ },
  { type: "function", regex: /^\s*export\s+function\s+([A-Za-z_$][\w$]*)/ },
  { type: "function", regex: /^\s*async\s+function\s+([A-Za-z_$][\w$]*)/ },
  { type: "function", regex: /^\s*function\s+([A-Za-z_$][\w$]*)/ },
  {
    type: "function",
    regex:
      /^\s*export\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/,
  },
  {
    type: "function",
    regex: /^\s*const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/,
  },
  {
    type: "function",
    regex: /^\s*export\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?function\b/,
  },
  { type: "function", regex: /^\s*const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?function\b/ },
  { type: "interface", regex: /^\s*export\s+interface\s+([A-Za-z_$][\w$]*)/ },
  { type: "interface", regex: /^\s*interface\s+([A-Za-z_$][\w$]*)/ },
  { type: "type", regex: /^\s*export\s+type\s+([A-Za-z_$][\w$]*)\s*=/ },
  { type: "type", regex: /^\s*type\s+([A-Za-z_$][\w$]*)\s*=/ },
  { type: "enum", regex: /^\s*export\s+enum\s+([A-Za-z_$][\w$]*)/ },
  { type: "enum", regex: /^\s*enum\s+([A-Za-z_$][\w$]*)/ },
];

function shouldSkipPath(relPath) {
  if (EXCLUDED_PATHS.has(relPath)) return true;
  return EXCLUDED_PATH_PREFIXES.some((prefix) => relPath.startsWith(prefix));
}

function walkFiles(dirPath, acc = []) {
  const entries = readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".rovo") continue;
    if (IGNORED_DIRS.has(entry.name)) continue;

    const fullPath = join(dirPath, entry.name);
    const relPath = relative(PROJECT_ROOT, fullPath).replace(/\\/g, "/");
    if (shouldSkipPath(relPath)) continue;

    if (entry.isDirectory()) {
      walkFiles(fullPath, acc);
      continue;
    }

    if (!entry.isFile()) continue;
    if (!ALLOWED_EXTENSIONS.has(extname(entry.name).toLowerCase())) continue;
    acc.push({ fullPath, relPath });
  }
  return acc;
}

function buildLineStarts(source) {
  const starts = [0];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "\n") {
      starts.push(index + 1);
    }
  }
  return starts;
}

function positionToLine(lineStarts, position) {
  let low = 0;
  let high = lineStarts.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const start = lineStarts[mid];
    const next = lineStarts[mid + 1] ?? Number.POSITIVE_INFINITY;
    if (position >= start && position < next) {
      return mid + 1;
    }
    if (position < start) high = mid - 1;
    else low = mid + 1;
  }
  return 1;
}

function cleanCommentText(raw) {
  const normalized = raw
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/^\s*\*\s?/, "").trimEnd())
    .join("\n")
    .trim();
  return normalized.replace(/\n{3,}/g, "\n\n").trim();
}

function isMeaningfulComment(text, classification) {
  if (text === "") return false;
  if (/^[-=*_#/\\\s]+$/.test(text)) return false;
  if (DIRECTIVE_PATTERNS.some((pattern) => pattern.test(text))) return false;
  if (LOW_SIGNAL_PATTERNS.some((pattern) => pattern.test(text))) return false;
  if (classification.kind === "note") {
    if (text.length < 24) return false;
    if (/^\d+\.\s/.test(text)) return false;
    if (!/[.:]/.test(text) && text.split(/\s+/).length < 5) return false;
  }
  return true;
}

function classifyComment(text) {
  const firstLine = text.split("\n")[0]?.trim() ?? "";
  const prefixMatch = firstLine.match(/^(AI|NOTE|WARNING|TODO)\s*:/);
  const prefix = prefixMatch?.[1] ?? null;
  if (prefix) return { prefix, kind: prefix.toLowerCase() };
  if (text.includes("@param") || text.includes("@returns") || text.includes("@module")) {
    return { prefix: null, kind: "jsdoc" };
  }
  if (/\bfallback\b/i.test(text)) return { prefix: null, kind: "fallback" };
  if (/\b(invariant|must|cannot|do not|avoid|ordering|race|durable|circular|safety)\b/i.test(text)) {
    return { prefix: null, kind: "constraint" };
  }
  return { prefix: null, kind: "note" };
}

function extractComments(source) {
  const comments = [];
  const lineStarts = buildLineStarts(source);
  let index = 0;
  let state = "code";

  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];

    if (state === "line-comment") {
      const start = comments[comments.length - 1].startOffset;
      let end = index;
      while (end < source.length && source[end] !== "\n") end += 1;
      const raw = source.slice(start + 2, end);
      comments[comments.length - 1].raw = raw;
      comments[comments.length - 1].endOffset = end;
      comments[comments.length - 1].endLine = positionToLine(lineStarts, Math.max(start, end - 1));
      state = "code";
      index = end;
      continue;
    }

    if (state === "block-comment") {
      if (char === "*" && next === "/") {
        const record = comments[comments.length - 1];
        const rawStart = record.startOffset + (record.kind === "jsdoc" ? 3 : 2);
        const raw = source.slice(rawStart, index);
        record.raw = raw;
        record.endOffset = index + 2;
        record.endLine = positionToLine(lineStarts, index);
        state = "code";
        index += 2;
        continue;
      }
      index += 1;
      continue;
    }

    if (state === "'" || state === '"' || state === "`") {
      if (char === "\\") {
        index += 2;
        continue;
      }
      if (char === state) {
        state = "code";
      }
      index += 1;
      continue;
    }

    if (char === "'" || char === '"' || char === "`") {
      state = char;
      index += 1;
      continue;
    }

    if (char === "/" && next === "/") {
      comments.push({
        kind: "line",
        startOffset: index,
        startLine: positionToLine(lineStarts, index),
        endOffset: index,
        endLine: positionToLine(lineStarts, index),
        raw: "",
      });
      state = "line-comment";
      index += 2;
      continue;
    }

    if (char === "/" && next === "*") {
      const isJsdoc = source[index + 2] === "*";
      comments.push({
        kind: isJsdoc ? "jsdoc" : "block",
        startOffset: index,
        startLine: positionToLine(lineStarts, index),
        endOffset: index,
        endLine: positionToLine(lineStarts, index),
        raw: "",
      });
      state = "block-comment";
      index += 2;
      continue;
    }

    index += 1;
  }

  return comments
    .map((comment) => {
      const text = cleanCommentText(comment.raw);
      const classification = classifyComment(text);
      if (!isMeaningfulComment(text, classification)) return null;
      return {
        kind: classification.kind,
        startLine: comment.startLine,
        endLine: comment.endLine,
        text,
        prefix: classification.prefix,
      };
    })
    .filter(Boolean);
}

function extractSymbols(source) {
  const symbols = [];
  const lines = source.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    for (const pattern of SYMBOL_PATTERNS) {
      const match = line.match(pattern.regex);
      if (!match?.[1]) continue;
      symbols.push({
        type: pattern.type,
        name: match[1],
        line: index + 1,
      });
      break;
    }
  }
  return symbols;
}

function resolveScope(comment, symbols) {
  if (symbols.length === 0) {
    return { scopeType: "file", scopeName: null };
  }

  const nextSymbol = symbols.find((symbol) => symbol.line >= comment.endLine);
  if (nextSymbol && nextSymbol.line - comment.endLine <= 5) {
    return { scopeType: nextSymbol.type, scopeName: nextSymbol.name };
  }

  const previousSymbol = [...symbols]
    .reverse()
    .find((symbol) => symbol.line <= comment.startLine);
  if (previousSymbol && comment.startLine - previousSymbol.line <= 3) {
    return { scopeType: previousSymbol.type, scopeName: previousSymbol.name };
  }

  const firstSymbol = symbols[0];
  if (firstSymbol && comment.endLine < firstSymbol.line) {
    return { scopeType: "file", scopeName: null };
  }

  return { scopeType: "file", scopeName: null };
}

function createPrefixCounts(comments) {
  return comments.reduce((acc, comment) => {
    const key = comment.prefix ?? "none";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, { none: 0, AI: 0, NOTE: 0, WARNING: 0, TODO: 0 });
}

function summarizeFiles(fileEntries) {
  return fileEntries.map((file) => ({
    path: file.path,
    totalComments: file.comments.length,
    byKind: file.comments.reduce((acc, comment) => {
      acc[comment.kind] = (acc[comment.kind] ?? 0) + 1;
      return acc;
    }, {}),
    byPrefix: createPrefixCounts(file.comments),
    symbols: [...new Set(file.comments.map((comment) => comment.scopeName).filter(Boolean))].slice(0, 10),
  }));
}

function generateMarkdown(payload) {
  const lines = [];
  lines.push("# Comment Index");
  lines.push("");
  lines.push(`> **Generated:** ${payload.generatedAt}`);
  lines.push("> **Auto-generated by:** `scripts/generate-comment-metadata.js`");
  lines.push("");
  lines.push("## Scope");
  lines.push("");
  lines.push(`- Included roots: ${payload.scope.included.join(", ")}`);
  lines.push(`- Excluded prefixes: ${payload.scope.excludedPrefixes.join(", ")}`);
  lines.push("");
  lines.push("## Stats");
  lines.push("");
  lines.push(`- Files scanned: ${payload.stats.filesScanned}`);
  lines.push(`- Files with comments: ${payload.stats.filesWithComments}`);
  lines.push(`- Indexed comments: ${payload.stats.commentsIndexed}`);
  lines.push(`- File-level comments: ${payload.stats.fileLevelComments}`);
  lines.push(`- Symbol-level comments: ${payload.stats.symbolLevelComments}`);
  lines.push("");
  lines.push("## Prefix Stats");
  lines.push("");
  lines.push(`- AI: ${payload.stats.prefixCounts.AI}`);
  lines.push(`- NOTE: ${payload.stats.prefixCounts.NOTE}`);
  lines.push(`- WARNING: ${payload.stats.prefixCounts.WARNING}`);
  lines.push(`- TODO: ${payload.stats.prefixCounts.TODO}`);
  lines.push(`- Unprefixed: ${payload.stats.prefixCounts.none}`);
  lines.push("");
  lines.push("## File Map");
  lines.push("");

  for (const file of payload.files) {
    lines.push(`### \`${file.path}\``);
    lines.push("");
    lines.push(`- Comments: ${file.totalComments}`);
    const filePrefixSummary = STANDARD_PREFIXES.filter((prefix) => (file.byPrefix[prefix] ?? 0) > 0)
      .map((prefix) => `${prefix}:${file.byPrefix[prefix]}`)
      .concat(file.byPrefix.none > 0 ? [`none:${file.byPrefix.none}`] : []);
    if (filePrefixSummary.length > 0) {
      lines.push(`- Prefixes: ${filePrefixSummary.join(", ")}`);
    }
    if (file.symbols.length > 0) {
      lines.push(`- Symbols: ${file.symbols.map((symbol) => `\`${symbol}\``).join(", ")}`);
    }
    lines.push("");
    for (const comment of file.comments) {
      const scopeLabel =
        comment.scopeName != null ? `${comment.scopeType} \`${comment.scopeName}\`` : comment.scopeType;
      const preview = comment.text.replace(/\n+/g, " ").slice(0, 220);
      lines.push(
        `- L${comment.startLine} [${comment.kind}] [${scopeLabel}]${comment.prefix ? ` [${comment.prefix}]` : ""}: ${preview}`
      );
    }
    lines.push("");
  }

  lines.push("## Symbol Map");
  lines.push("");
  for (const symbol of payload.symbols) {
    lines.push(`### \`${symbol.name}\` (${symbol.type})`);
    lines.push("");
    lines.push(`- File: \`${symbol.file}\``);
    lines.push(`- Comment count: ${symbol.comments.length}`);
    lines.push("");
    for (const comment of symbol.comments) {
      lines.push(`- L${comment.startLine} [${comment.kind}]: ${comment.text.replace(/\n+/g, " ").slice(0, 220)}`);
    }
    lines.push("");
  }

  return `${lines.join("\n").trim()}\n`;
}

function buildPayload() {
  const scannedFiles = [];
  for (const root of SOURCE_DIRS) {
    const fullPath = join(PROJECT_ROOT, root);
    try {
      if (!statSync(fullPath).isDirectory()) continue;
    } catch {
      continue;
    }
    walkFiles(fullPath, scannedFiles);
  }

  const fileEntries = [];
  for (const file of scannedFiles) {
    const source = readFileSync(file.fullPath, "utf-8");
    const symbols = extractSymbols(source);
    const comments = extractComments(source).map((comment) => ({
      ...comment,
      ...resolveScope(comment, symbols),
    }));
    if (comments.length === 0) continue;
    fileEntries.push({
      path: file.relPath,
      comments,
      symbols,
    });
  }

  const summarizedFiles = summarizeFiles(fileEntries).map((summary) => {
    const file = fileEntries.find((entry) => entry.path === summary.path);
    return {
      ...summary,
      comments: file?.comments ?? [],
    };
  });

  const symbolMap = new Map();
  for (const file of fileEntries) {
    for (const comment of file.comments) {
      if (!comment.scopeName) continue;
      const key = `${file.path}:${comment.scopeType}:${comment.scopeName}`;
      if (!symbolMap.has(key)) {
        symbolMap.set(key, {
          file: file.path,
          type: comment.scopeType,
          name: comment.scopeName,
          comments: [],
        });
      }
      symbolMap.get(key).comments.push({
        startLine: comment.startLine,
        kind: comment.kind,
        text: comment.text,
      });
    }
  }

  const symbols = [...symbolMap.values()].sort((a, b) => {
    if (b.comments.length !== a.comments.length) return b.comments.length - a.comments.length;
    if (a.file !== b.file) return a.file.localeCompare(b.file);
    return a.name.localeCompare(b.name);
  });

  const commentsIndexed = summarizedFiles.reduce((sum, file) => sum + file.totalComments, 0);
  const fileLevelComments = summarizedFiles.reduce(
    (sum, file) => sum + file.comments.filter((comment) => comment.scopeType === "file").length,
    0
  );
  const symbolLevelComments = commentsIndexed - fileLevelComments;
  const prefixCounts = createPrefixCounts(fileEntries.flatMap((file) => file.comments));

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    generator: "scripts/generate-comment-metadata.js",
    scope: {
      included: SOURCE_DIRS,
      excludedPrefixes: EXCLUDED_PATH_PREFIXES,
      excludedPaths: [...EXCLUDED_PATHS],
    },
    stats: {
      filesScanned: scannedFiles.length,
      filesWithComments: summarizedFiles.length,
      commentsIndexed,
      fileLevelComments,
      symbolLevelComments,
      prefixCounts,
    },
    files: summarizedFiles.sort((a, b) => a.path.localeCompare(b.path)),
    symbols,
  };
}

function main() {
  const payload = buildPayload();
  mkdirSync(METADATA_DIR, { recursive: true });
  writeFileSync(JSON_OUTPUT, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
  writeFileSync(MARKDOWN_OUTPUT, generateMarkdown(payload), "utf-8");

  console.log(`✅ Comment metadata generated: ${MARKDOWN_OUTPUT}`);
  console.log(`🧠 Indexed comments: ${payload.stats.commentsIndexed}`);
  console.log(`📁 Files with comments: ${payload.stats.filesWithComments}`);
  console.log(`🔧 Symbols with comments: ${payload.symbols.length}`);
}

main();

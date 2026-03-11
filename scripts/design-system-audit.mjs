#!/usr/bin/env node
import { readdirSync, readFileSync } from "fs";
import { dirname, extname, join, relative } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, "..");
const SRC_ROOT = join(PROJECT_ROOT, "src");

const SCAN_EXTENSIONS = new Set([".css", ".html", ".js", ".ts"]);
const IGNORED_DIRS = new Set(["node_modules", "dist", ".git", ".vite", "coverage", "logs"]);
const HEX_COLOR_RE = /#[0-9A-Fa-f]{3,8}\b/g;
const INLINE_STYLE_RE = /\bstyle\s*=\s*["']/g;
const EXTERNAL_ASSET_RE = /\b(?:href|src)\s*=\s*["']https?:\/\//g;
const CSS_VAR_DEFINE_RE = /(^|[\s{;])(--[A-Za-z0-9_-]+)\s*:/gm;
const CSS_VAR_USE_RE = /var\(\s*(--[A-Za-z0-9_-]+)\b/g;
const CUSTOM_MEDIA_DEFINE_RE = /@custom-media\s+(--[A-Za-z0-9_-]+)\s+([^;]+);/g;
const CUSTOM_MEDIA_USE_RE = /@media[^{]*\(\s*(--[A-Za-z0-9_-]+)\s*\)/g;
const RAW_MEDIA_QUERY_RE = /@media\s*\((?:max-width|min-width):\s*[0-9]+px\)/g;
const RAW_CSS_UNIT_RE = /(^|[^\w-])(-?\d*\.?\d+(?:px|rem|em))\b/g;
const CUSTOM_PROP_DECL_RE = /--[A-Za-z0-9_-]+\s*:\s*[^;]+;/g;

const issues = [];

function walkFiles(dirPath, acc = []) {
  const entries = readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const fullPath = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, acc);
      continue;
    }

    if (!entry.isFile()) continue;
    if (!SCAN_EXTENSIONS.has(extname(entry.name).toLowerCase())) continue;
    acc.push(fullPath);
  }
  return acc;
}

function toProjectPath(filePath) {
  return relative(PROJECT_ROOT, filePath).replaceAll("\\", "/");
}

function isTokenOrThemeFile(projectPath) {
  return (
    projectPath.startsWith("src/styles/design-system/tokens/") ||
    projectPath.startsWith("src/styles/design-system/themes/")
  );
}

function pushIssue(filePath, line, rule, detail) {
  issues.push({
    filePath: toProjectPath(filePath),
    line,
    rule,
    detail,
  });
}

function getLineNumber(content, offset) {
  let line = 1;
  for (let index = 0; index < offset; index += 1) {
    if (content.charCodeAt(index) === 10) line += 1;
  }
  return line;
}

function collectPatternIssues(filePath, content, regex, rule, detailFactory) {
  regex.lastIndex = 0;
  let match = regex.exec(content);
  while (match !== null) {
    pushIssue(filePath, getLineNumber(content, match.index), rule, detailFactory(match[0], match));
    match = regex.exec(content);
  }
}

function maskCustomPropertyDeclarations(content) {
  return content.replace(CUSTOM_PROP_DECL_RE, (match) => match.replace(/[^\n]/g, " "));
}

function collectDefinedCssVars(cssFiles) {
  const definedVars = new Set();
  for (const filePath of cssFiles) {
    const content = readFileSync(filePath, "utf8");
    CSS_VAR_DEFINE_RE.lastIndex = 0;
    let match = CSS_VAR_DEFINE_RE.exec(content);
    while (match !== null) {
      definedVars.add(match[2]);
      match = CSS_VAR_DEFINE_RE.exec(content);
    }
  }
  return definedVars;
}

function collectDefinedCustomMedia(cssFiles) {
  const definedMedia = new Set();
  for (const filePath of cssFiles) {
    const content = readFileSync(filePath, "utf8");
    CUSTOM_MEDIA_DEFINE_RE.lastIndex = 0;
    let match = CUSTOM_MEDIA_DEFINE_RE.exec(content);
    while (match !== null) {
      definedMedia.add(match[1]);
      match = CUSTOM_MEDIA_DEFINE_RE.exec(content);
    }
  }
  return definedMedia;
}

function collectUndefinedVarIssues(cssFiles, definedVars) {
  for (const filePath of cssFiles) {
    const content = readFileSync(filePath, "utf8");
    CSS_VAR_USE_RE.lastIndex = 0;
    let match = CSS_VAR_USE_RE.exec(content);
    while (match !== null) {
      const variableName = match[1];
      if (!definedVars.has(variableName)) {
        pushIssue(
          filePath,
          getLineNumber(content, match.index),
          "undefined-css-var",
          `Undefined custom property ${variableName}`
        );
      }
      match = CSS_VAR_USE_RE.exec(content);
    }
  }
}

function collectUndefinedCustomMediaIssues(cssFiles, definedMedia) {
  for (const filePath of cssFiles) {
    const content = readFileSync(filePath, "utf8");
    CUSTOM_MEDIA_USE_RE.lastIndex = 0;
    let match = CUSTOM_MEDIA_USE_RE.exec(content);
    while (match !== null) {
      const mediaName = match[1];
      if (!definedMedia.has(mediaName)) {
        pushIssue(
          filePath,
          getLineNumber(content, match.index),
          "undefined-custom-media",
          `Undefined custom media token ${mediaName}`
        );
      }
      match = CUSTOM_MEDIA_USE_RE.exec(content);
    }
  }
}

function formatIssue(issue) {
  return `${issue.filePath}:${issue.line} [${issue.rule}] ${issue.detail}`;
}

function main() {
  const files = walkFiles(SRC_ROOT);
  const cssFiles = files.filter((filePath) => extname(filePath).toLowerCase() === ".css");
  const htmlFiles = files.filter((filePath) => extname(filePath).toLowerCase() === ".html");
  const scriptFiles = files.filter((filePath) => {
    const extension = extname(filePath).toLowerCase();
    return extension === ".js" || extension === ".ts";
  });

  const definedVars = collectDefinedCssVars(cssFiles);
  const definedCustomMedia = collectDefinedCustomMedia(cssFiles);
  collectUndefinedVarIssues(cssFiles, definedVars);
  collectUndefinedCustomMediaIssues(cssFiles, definedCustomMedia);

  for (const filePath of cssFiles) {
    const projectPath = toProjectPath(filePath);
    if (isTokenOrThemeFile(projectPath)) continue;

    const content = readFileSync(filePath, "utf8");
    collectPatternIssues(filePath, content, RAW_MEDIA_QUERY_RE, "raw-breakpoint-media", (value) => {
      return `Raw responsive media query must use breakpoint token syntax: ${value}`;
    });
    collectPatternIssues(
      filePath,
      maskCustomPropertyDeclarations(content),
      RAW_CSS_UNIT_RE,
      "raw-unit-token",
      (_, match) => `Raw CSS unit must be promoted to a token: ${match[2]}`
    );
  }

  for (const filePath of [...cssFiles, ...scriptFiles]) {
    const projectPath = toProjectPath(filePath);
    if (isTokenOrThemeFile(projectPath)) continue;

    const content = readFileSync(filePath, "utf8");
    collectPatternIssues(filePath, content, HEX_COLOR_RE, "hardcoded-color", (value) => {
      return `Hardcoded color token ${value}`;
    });
  }

  for (const filePath of htmlFiles) {
    const content = readFileSync(filePath, "utf8");
    collectPatternIssues(filePath, content, INLINE_STYLE_RE, "inline-style", () => {
      return "Inline style attribute is not allowed";
    });
    collectPatternIssues(filePath, content, EXTERNAL_ASSET_RE, "external-asset", (value) => {
      return `External asset reference ${value}`;
    });
  }

  if (issues.length > 0) {
    console.error("Design system audit failed.\n");
    for (const issue of issues.sort((left, right) => {
      if (left.filePath === right.filePath) return left.line - right.line;
      return left.filePath.localeCompare(right.filePath);
    })) {
      console.error(formatIssue(issue));
    }
    console.error(`\nFound ${issues.length} issue(s).`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `Design system audit passed. Scanned ${files.length} files, ${definedVars.size} custom properties.`
  );
}

main();

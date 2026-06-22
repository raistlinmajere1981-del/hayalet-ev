import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import {
  PROJECT_ROOT,
  SRC_ROOT,
  ROOMS_ROOT,
  BASELINE_PATH,
  SCAN_EXTENSIONS,
  IGNORED_DIRS,
  CUSTOM_PROP_DECL_RE,
} from "./design-audit-config.mjs";

export function isIgnoredDirectory(dirPath) {
  const projectPath = toProjectPath(dirPath);
  return (
    projectPath === "rooms/.build" ||
    projectPath.startsWith("rooms/.build/") ||
    projectPath.endsWith("/shared/vendor") ||
    projectPath.includes("/shared/vendor/")
  );
}

export function walkFiles(dirPath, acc = []) {
  const entries = readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name) || isIgnoredDirectory(fullPath)) continue;
      walkFiles(fullPath, acc);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!SCAN_EXTENSIONS.has(extname(entry.name).toLowerCase())) continue;
    acc.push(fullPath);
  }
  return acc;
}

export function resolveScanRoots(scope) {
  if (scope === "all") return [SRC_ROOT, ROOMS_ROOT];
  if (scope === "rooms") return [ROOMS_ROOT];
  return [SRC_ROOT];
}

export function toProjectPath(filePath) {
  return relative(PROJECT_ROOT, filePath).replaceAll("\\", "/");
}

export function isTokenFile(projectPath) {
  return (
    projectPath.startsWith("src/styles/design-system/tokens/") ||
    /^rooms\/[^/]+\/ui\/tokens\.css$/.test(projectPath) ||
    /^rooms\/[^/]+\/ui\/styles\/[^/]*tokens\.css$/.test(projectPath)
  );
}

export function isThemeFile(projectPath) {
  return projectPath.startsWith("src/styles/design-system/themes/");
}

export function isInfrastructureStyleFile(projectPath) {
  return (
    projectPath.startsWith("src/styles/scene-system/") ||
    projectPath.startsWith("src/styles/scene-editor/")
  );
}

export function isTokenOrThemeFile(projectPath) {
  return isTokenFile(projectPath) || isThemeFile(projectPath) || isInfrastructureStyleFile(projectPath);
}

export function getLineNumber(content, offset) {
  let line = 1;
  for (let index = 0; index < offset; index += 1) {
    if (content.charCodeAt(index) === 10) line += 1;
  }
  return line;
}

export function maskCustomPropertyDeclarations(content) {
  return content.replace(CUSTOM_PROP_DECL_RE, (match) => match.replace(/[^\n]/g, " "));
}

export function normalizeCssValue(value) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

export function getEnclosingCssSelector(content, offset) {
  let cursor = offset;
  while (cursor >= 0) {
    const openIndex = content.lastIndexOf("{", cursor);
    if (openIndex === -1) return null;

    const closeIndex = content.lastIndexOf("}", cursor);
    if (closeIndex > openIndex) {
      cursor = openIndex - 1;
      continue;
    }

    const previousBoundary = content.lastIndexOf("}", openIndex - 1);
    const selector = content
      .slice(previousBoundary + 1, openIndex)
      .replace(/\s+/g, " ")
      .trim();
    return selector === "" ? null : selector;
  }
  return null;
}

export function isGlobalCssOverrideSelector(selector) {
  if (selector === null) return true;
  return (
    selector.startsWith(":root") ||
    selector.startsWith("html") ||
    selector.startsWith("body") ||
    selector.startsWith("[data-theme=") ||
    selector.startsWith("[data-theme-surface=")
  );
}

export function isIntentionalScopedDuplicateVar(varName, selector) {
  if (selector !== null && selector.includes('data-presentation-mode="scene-view"]') && varName.startsWith("--tt-")) {
    return true;
  }
  if (isGlobalCssOverrideSelector(selector)) return false;
  if (varName.startsWith("--field-")) return true;
  if (varName.startsWith("--ds-choice-")) return true;
  if (varName.startsWith("--modal-")) return true;
  if (varName.startsWith("--app-shell-") && selector?.includes(".app-shell--")) return true;
  return false;
}

export function formatIssue(issue) {
  return `${issue.filePath}:${issue.line} [${issue.rule}] ${issue.detail}`;
}

export function issueFingerprint(issue) {
  return `${issue.rule}|${issue.filePath}|${issue.line}|${issue.detail}`;
}

export function sortIssues(inputIssues) {
  return [...inputIssues].sort((left, right) => {
    if (left.filePath === right.filePath) {
      if (left.line === right.line) {
        if (left.rule === right.rule) {
          return left.detail.localeCompare(right.detail);
        }
        return left.rule.localeCompare(right.rule);
      }
      return left.line - right.line;
    }
    return left.filePath.localeCompare(right.filePath);
  });
}

export function summarizeIssues(inputIssues) {
  const byRule = {};
  for (const issue of inputIssues) {
    byRule[issue.rule] = (byRule[issue.rule] ?? 0) + 1;
  }
  return byRule;
}

export function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return null;
  return JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
}

export function writeBaseline(sortedIssues) {
  mkdirSync(dirname(BASELINE_PATH), { recursive: true });
  const payload = {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    totalIssues: sortedIssues.length,
    byRule: summarizeIssues(sortedIssues),
    issues: sortedIssues.map((issue) => ({
      ...issue,
      fingerprint: issueFingerprint(issue),
    })),
  };
  writeFileSync(BASELINE_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

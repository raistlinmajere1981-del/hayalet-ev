#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { extname } from "node:path";
import {
  BASELINE_PATH,
  HEX_COLOR_RE,
  COLOR_FUNCTION_RE,
  INLINE_STYLE_RE,
  EXTERNAL_ASSET_RE,
  RAW_MEDIA_QUERY_RE,
  RAW_CSS_UNIT_RE,
} from "./lib/design-audit-config.mjs";
import {
  walkFiles,
  resolveScanRoots,
  toProjectPath,
  isTokenOrThemeFile,
  formatIssue,
  issueFingerprint,
  sortIssues,
  summarizeIssues,
  loadBaseline,
  writeBaseline,
  maskCustomPropertyDeclarations,
  normalizeCssValue,
} from "./lib/design-audit-utils.mjs";
import {
  collectDefinedCssVars,
  collectDefinedCustomMedia,
  collectUndefinedVarIssues,
  collectUndefinedCustomMediaIssues,
  collectDuplicateGradientIssues,
  collectDuplicateVarDefinitionIssues,
  collectSceneScaleConsumerIssues,
  collectPatternIssues,
} from "./lib/design-audit-rules.mjs";

function parseArgs(argv) {
  const options = {
    format: "text",
    scope: "src",
    updateBaseline: false,
    useBaseline: true,
  };

  for (const arg of argv) {
    if (arg === "--format=json") { options.format = "json"; continue; }
    if (arg === "--update-baseline") { options.updateBaseline = true; continue; }
    if (arg === "--no-baseline") { options.useBaseline = false; continue; }
    if (arg.startsWith("--scope=")) {
      const scope = arg.slice("--scope=".length);
      if (!["all", "rooms", "src"].includes(scope)) {
        throw new Error(`Unknown design audit scope: ${scope}`);
      }
      options.scope = scope;
    }
  }
  return options;
}

function emitJson(payload) {
  console.log(JSON.stringify(payload, null, 2));
}

function emitTextPass(files, definedVars, sortedIssues, baselineMatched) {
  const summary = summarizeIssues(sortedIssues);
  const summaryText = Object.entries(summary)
    .sort(([leftRule], [rightRule]) => leftRule.localeCompare(rightRule))
    .map(([rule, count]) => `${rule}=${count}`)
    .join(", ");

  if (sortedIssues.length === 0) {
    console.log(`Design system audit passed. Scanned ${files.length} files, ${definedVars.size} custom properties.`);
    return;
  }

  const baselineText = baselineMatched ? "baselined" : "tracked";
  console.log(
    `Design system audit passed with ${sortedIssues.length} ${baselineText} issue(s). Scanned ${files.length} files, ${definedVars.size} custom properties.`
  );
  console.log(summaryText === "" ? "No issue summary available." : `Issue summary: ${summaryText}`);
}

function emitTextFailure(header, diffs, sortedIssues) {
  console.error(`${header}\n`);

  if (diffs.added.length > 0) {
    console.error("Added issues:");
    for (const issue of diffs.added) {
      console.error(`+ ${formatIssue(issue)}`);
    }
    console.error("");
  }

  if (diffs.removed.length > 0) {
    console.error("Removed baseline issues:");
    for (const issue of diffs.removed) {
      console.error(`- ${formatIssue(issue)}`);
    }
    console.error("");
  }

  if (sortedIssues.length > 0) {
    console.error("Current issue summary:");
    for (const issue of sortedIssues) {
      console.error(formatIssue(issue));
    }
    console.error(`\nFound ${sortedIssues.length} issue(s).`);
  }
}

function main() {
  const issues = [];
  const options = parseArgs(process.argv.slice(2));
  const files = resolveScanRoots(options.scope).flatMap((rootPath) =>
    existsSync(rootPath) ? walkFiles(rootPath) : []
  );
  const cssFiles = files.filter((filePath) => extname(filePath).toLowerCase() === ".css");
  const htmlFiles = files.filter((filePath) => extname(filePath).toLowerCase() === ".html");
  const scriptFiles = files.filter((filePath) => {
    const extension = extname(filePath).toLowerCase();
    return extension === ".js" || extension === ".ts";
  });

  const definedVars = collectDefinedCssVars(cssFiles);
  const definedCustomMedia = collectDefinedCustomMedia(cssFiles);
  collectUndefinedVarIssues(issues, cssFiles, definedVars);
  collectUndefinedCustomMediaIssues(issues, cssFiles, definedCustomMedia);
  collectDuplicateGradientIssues(issues, cssFiles);
  collectDuplicateVarDefinitionIssues(issues, cssFiles);
  collectSceneScaleConsumerIssues(issues, cssFiles);

  for (const filePath of cssFiles) {
    const projectPath = toProjectPath(filePath);
    if (isTokenOrThemeFile(projectPath)) continue;

    const content = readFileSync(filePath, "utf8");
    collectPatternIssues(issues, filePath, content, RAW_MEDIA_QUERY_RE, "raw-breakpoint-media", (value) =>
      `Raw responsive media query must use breakpoint token syntax: ${value}`
    );
    collectPatternIssues(
      issues, filePath, maskCustomPropertyDeclarations(content), RAW_CSS_UNIT_RE,
      "raw-unit-token",
      (_, match) => `Raw CSS unit must be promoted to a token: ${match[2]}`
    );
    collectPatternIssues(issues, filePath, content, HEX_COLOR_RE, "hardcoded-color", (value) =>
      `Hardcoded color token ${value}`
    );
    collectPatternIssues(issues, filePath, content, COLOR_FUNCTION_RE, "hardcoded-color", (value) =>
      `Hardcoded color function ${normalizeCssValue(value)}`
    );
  }

  for (const filePath of scriptFiles) {
    const projectPath = toProjectPath(filePath);
    if (isTokenOrThemeFile(projectPath)) continue;

    const content = readFileSync(filePath, "utf8");
    collectPatternIssues(issues, filePath, content, HEX_COLOR_RE, "hardcoded-color", (value) =>
      `Hardcoded color token ${value}`
    );
  }

  for (const filePath of htmlFiles) {
    const content = readFileSync(filePath, "utf8");
    collectPatternIssues(issues, filePath, content, INLINE_STYLE_RE, "inline-style", () =>
      "Inline style attribute is not allowed"
    );
    collectPatternIssues(issues, filePath, content, EXTERNAL_ASSET_RE, "external-asset", (value) =>
      `External asset reference ${value}`
    );
  }

  const sortedIssues = sortIssues(issues);

  if (options.updateBaseline) {
    writeBaseline(sortedIssues);
    if (options.format === "json") {
      emitJson({
        updatedBaseline: true,
        baselinePath: toProjectPath(BASELINE_PATH),
        totalIssues: sortedIssues.length,
        byRule: summarizeIssues(sortedIssues),
      });
      return;
    }
    console.log(`Design system audit baseline updated at ${toProjectPath(BASELINE_PATH)} with ${sortedIssues.length} issue(s).`);
    return;
  }

  if (options.useBaseline) {
    const baseline = loadBaseline();
    if (baseline !== null) {
      const currentByFingerprint = new Map(
        sortedIssues.map((issue) => [issueFingerprint(issue), issue])
      );
      const baselineByFingerprint = new Map(
        (baseline.issues ?? []).map((issue) => [issue.fingerprint, issue])
      );

      const added = [...currentByFingerprint.entries()]
        .filter(([fingerprint]) => !baselineByFingerprint.has(fingerprint))
        .map(([, issue]) => issue);
      const removed = [...baselineByFingerprint.entries()]
        .filter(([fingerprint]) => !currentByFingerprint.has(fingerprint))
        .map(([, issue]) => issue);

      if (options.format === "json") {
        emitJson({
          passed: added.length === 0 && removed.length === 0,
          baselinePath: toProjectPath(BASELINE_PATH),
          totalIssues: sortedIssues.length,
          byRule: summarizeIssues(sortedIssues),
          added, removed,
        });
        process.exitCode = added.length === 0 && removed.length === 0 ? 0 : 1;
        return;
      }

      if (added.length === 0 && removed.length === 0) {
        emitTextPass(files, definedVars, sortedIssues, true);
        return;
      }

      emitTextFailure("Design system audit baseline drift detected.", { added, removed }, sortedIssues);
      process.exitCode = 1;
      return;
    }
  }

  if (options.format === "json") {
    emitJson({
      passed: sortedIssues.length === 0,
      totalIssues: sortedIssues.length,
      byRule: summarizeIssues(sortedIssues),
      issues: sortedIssues.map((issue) => ({
        ...issue,
        fingerprint: issueFingerprint(issue),
      })),
    });
    process.exitCode = sortedIssues.length === 0 ? 0 : 1;
    return;
  }

  if (sortedIssues.length > 0) {
    console.error("Design system audit failed.\n");
    for (const issue of sortedIssues) {
      console.error(formatIssue(issue));
    }
    console.error(`\nFound ${sortedIssues.length} issue(s).`);
    process.exitCode = 1;
    return;
  }

  emitTextPass(files, definedVars, sortedIssues, false);
}

main();

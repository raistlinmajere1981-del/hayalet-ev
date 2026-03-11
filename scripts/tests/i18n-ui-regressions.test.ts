import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { getBuiltInLanguagePack } from "../../shared/i18n/bundled-languages.ts";
import type { TranslationCatalog } from "../../src/types/i18n.ts";

type AllowlistEntry = { file: string; value: string };

type HtmlAllowlist = {
  text: AllowlistEntry[];
  title: AllowlistEntry[];
  placeholder: AllowlistEntry[];
  aria: AllowlistEntry[];
  alt: AllowlistEntry[];
};

const TOAST_ALLOWLIST: AllowlistEntry[] = [];
const HTML_ALLOWLIST: HtmlAllowlist = {
  text: [],
  title: [],
  placeholder: [],
  aria: [],
  alt: [],
};

function isAllowlisted(list: AllowlistEntry[], file: string, value: string): boolean {
  return list.some((entry) => entry.file === file && entry.value === value);
}

function normalizeText(value: string): string {
  return value.replace(/&nbsp;/g, " ").trim();
}

function collectHtmlFiles(): string[] {
  const pagesDir = "src/pages";
  const pageFiles = readdirSync(pagesDir)
    .filter((name) => name.endsWith(".html"))
    .map((name) => join(pagesDir, name));

  return ["src/index.html", ...pageFiles];
}

function collectSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "ghost-agent") continue;
      files.push(...collectSourceFiles(fullPath));
      continue;
    }

    if (entry.isFile()) {
      if (!/\.(ts|js)$/.test(entry.name)) continue;
      if (entry.name.endsWith(".d.ts")) continue;
      files.push(fullPath);
    }
  }

  return files;
}

function findHtmlTextFallbacks(file: string, html: string): string[] {
  const issues: string[] = [];
  const regex = /<[^>]*data-(?:shell-)?i18n-text="[^"]+"[^>]*>([^<]*)/g;

  for (const match of html.matchAll(regex)) {
    const rawText = normalizeText(match[1] ?? "");
    if (rawText === "") continue;
    if (isAllowlisted(HTML_ALLOWLIST.text, file, rawText)) continue;
    issues.push(`${file}: data-i18n-text fallback "${rawText}"`);
  }

  return issues;
}

function findHtmlAttributeFallbacks(
  file: string,
  html: string,
  dataAttr: string,
  attrName: string,
  allowlist: AllowlistEntry[]
): string[] {
  const issues: string[] = [];
  const tagRegex = new RegExp(`<[^>]*${dataAttr}="[^"]+"[^>]*>`, "g");
  const attrRegex = new RegExp(`${attrName}="([^"]*)"`, "i");

  for (const match of html.matchAll(tagRegex)) {
    const tag = match[0];
    const attrMatch = tag.match(attrRegex);
    if (!attrMatch) continue;
    const value = normalizeText(attrMatch[1] ?? "");
    if (value === "") continue;
    if (isAllowlisted(allowlist, file, value)) continue;
    issues.push(`${file}: ${dataAttr} fallback ${attrName}="${value}"`);
  }

  return issues;
}

function getCatalogString(
  catalog: TranslationCatalog | null | undefined,
  path: string[]
): string | undefined {
  let current: string | TranslationCatalog | undefined = catalog ?? undefined;

  for (const segment of path) {
    if (current === undefined || typeof current === "string") {
      return undefined;
    }
    current = current[segment];
  }

  return typeof current === "string" ? current : undefined;
}

function getLineNumber(source: string, index: number): number {
  return source.slice(0, Math.max(0, index)).split("\n").length;
}

test("hardcoded user-facing strings are blocked (allowlist-aware)", () => {
  const htmlIssues: string[] = [];

  for (const file of collectHtmlFiles()) {
    const html = readFileSync(file, "utf8");
    htmlIssues.push(...findHtmlTextFallbacks(file, html));
    htmlIssues.push(
      ...findHtmlAttributeFallbacks(file, html, "data-(?:shell-)?i18n-title", "title", HTML_ALLOWLIST.title)
    );
    htmlIssues.push(
      ...findHtmlAttributeFallbacks(
        file,
        html,
        "data-(?:shell-)?i18n-placeholder",
        "placeholder",
        HTML_ALLOWLIST.placeholder
      )
    );
    htmlIssues.push(
      ...findHtmlAttributeFallbacks(file, html, "data-(?:shell-)?i18n-aria", "aria-label", HTML_ALLOWLIST.aria)
    );
    htmlIssues.push(
      ...findHtmlAttributeFallbacks(file, html, "data-(?:shell-)?i18n-alt", "alt", HTML_ALLOWLIST.alt)
    );
  }

  const toastIssues: string[] = [];
  const toastRegex = /Toast\.(success|error|warning|info|loading)\(\s*(["'])(.*?)\2/g;

  for (const file of collectSourceFiles("src/js")) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(toastRegex)) {
      const value = match[3] ?? "";
      if (value === "") continue;
      if (isAllowlisted(TOAST_ALLOWLIST, file, value)) continue;
      const line = getLineNumber(source, match.index ?? 0);
      toastIssues.push(`${file}:${line} Toast.${match[1]} uses literal "${value}"`);
    }
  }

  const issues = [...htmlIssues, ...toastIssues];
  assert.equal(issues.length, 0, `Hardcoded i18n fallbacks found:\n${issues.join("\n")}`);
});

test("html bootstrap uses neutral lang and empty title", () => {
  const indexHtml = readFileSync("src/index.html", "utf8");
  const opencodeHtml = readFileSync("src/pages/opencode-ui.html", "utf8");

  assert.match(indexHtml, /<html[^>]*lang="und"/);
  assert.match(opencodeHtml, /<html[^>]*lang="und"/);
  assert.match(indexHtml, /<title>\s*<\/title>/);
  assert.match(opencodeHtml, /<title>\s*<\/title>/);
});

test("mixed-locale smoke test covers key UI strings", () => {
  const enPack = getBuiltInLanguagePack("en");
  const trPack = getBuiltInLanguagePack("tr");

  assert.ok(enPack?.catalog, "Expected English catalog to be available");
  assert.ok(trPack?.catalog, "Expected Turkish catalog to be available");

  const pairs = [
    { path: ["app", "documentTitle"], label: "app.documentTitle" },
    { path: ["app", "startup", "starting"], label: "app.startup.starting" },
    { path: ["shell", "assistant", "opencodeDoctor", "indicatorMissing"], label: "shell.assistant.opencodeDoctor.indicatorMissing" },
    { path: ["opencodeUi", "workspace", "mainLabel"], label: "opencodeUi.workspace.mainLabel" },
    { path: ["opencodeUi", "message", "patchTitle"], label: "opencodeUi.message.patchTitle" },
    { path: ["opencodeUi", "message", "stepStartTitle"], label: "opencodeUi.message.stepStartTitle" },
    { path: ["opencodeUi", "chat", "attachmentFallbackName"], label: "opencodeUi.chat.attachmentFallbackName" },
  ];

  for (const item of pairs) {
    const enValue = getCatalogString(enPack?.catalog, item.path);
    const trValue = getCatalogString(trPack?.catalog, item.path);

    assert.ok(enValue, `${item.label} should exist in EN catalog`);
    assert.ok(trValue, `${item.label} should exist in TR catalog`);
    assert.notEqual(enValue, trValue, `${item.label} should differ between EN/TR`);
  }
});

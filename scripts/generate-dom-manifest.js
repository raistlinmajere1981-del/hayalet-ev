#!/usr/bin/env node
import { fileURLToPath } from "url";
import { dirname, extname, join } from "path";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, "..");
const OUTPUT_PATH = join(PROJECT_ROOT, ".rovo", "_metadata", "DOM-MANIFEST.json");

const SOURCE_DIRS = ["src", "electron", "ghost-agent"];
const ALLOWED_EXTENSIONS = new Set([".html", ".ts", ".js", ".tsx", ".jsx"]);
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

function walkFiles(dirPath, acc = []) {
  const entries = readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".rovo") continue;
    if (IGNORED_DIRS.has(entry.name)) continue;

    const fullPath = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, acc);
      continue;
    }

    if (!entry.isFile()) continue;
    if (!ALLOWED_EXTENSIONS.has(extname(entry.name).toLowerCase())) continue;
    acc.push(fullPath);
  }
  return acc;
}

function cleanToken(value) {
  if (typeof value !== "string") return null;
  const token = value.trim();
  if (token === "" || token.includes("${")) return null;
  return token;
}

function addId(rawId, idSet) {
  const id = cleanToken(rawId);
  if (id === null) return;
  idSet.add(id);
}

function addTestId(rawTestId, testIdSet) {
  const testId = cleanToken(rawTestId);
  if (testId === null) return;
  testIdSet.add(testId);
}

function addSelector(rawSelector, selectorSet) {
  const selector = cleanToken(rawSelector);
  if (selector === null) return;
  selectorSet.add(selector);
}

function collectMatches(content, regex, onMatch) {
  let match = regex.exec(content);
  while (match !== null) {
    onMatch(match);
    match = regex.exec(content);
  }
}

function collectSelectorConfigStrings(content, selectorSet) {
  collectMatches(
    content,
    /\b[A-Za-z0-9_$-]*selector[A-Za-z0-9_$-]*\s*:\s*["'`]([^"'`\n]+)["'`]/gi,
    (m) => addSelector(m[1], selectorSet)
  );

  collectMatches(
    content,
    /\bconst\s+[A-Za-z0-9_$]*selector[A-Za-z0-9_$]*\s*=\s*["'`]([^"'`\n]+)["'`]/gi,
    (m) => addSelector(m[1], selectorSet)
  );

  collectMatches(
    content,
    /\b[A-Za-z0-9_$-]*selectors[A-Za-z0-9_$-]*\s*:\s*\[([\s\S]*?)\]/gi,
    (m) => {
      const block = m[1];
      collectMatches(block, /["'`]([^"'`\n]+)["'`]/g, (s) => addSelector(s[1], selectorSet));
    }
  );

  collectMatches(content, /'([^'\n]*data-testid[^'\n]*)'/gi, (m) => addSelector(m[1], selectorSet));
  collectMatches(content, /"([^"\n]*data-testid[^"\n]*)"/gi, (m) => addSelector(m[1], selectorSet));
  collectMatches(content, /`([^`\n]*data-testid[^`\n]*)`/gi, (m) => addSelector(m[1], selectorSet));
}

function extractSelectorsFromContent(content, filePath, idSet, testIdSet, selectorSet) {
  const isHtml = filePath.endsWith(".html");

  if (isHtml) {
    collectMatches(content, /\bid\s*=\s*["']([^"']+)["']/g, (m) => addId(m[1], idSet));
    collectMatches(content, /\bdata-testid\s*=\s*["']([^"']+)["']/g, (m) =>
      addTestId(m[1], testIdSet)
    );
  }

  collectMatches(content, /getElementById\(\s*["'`]([^"'`]+)["'`]\s*\)/g, (m) =>
    addId(m[1], idSet)
  );

  collectMatches(content, /querySelector(?:All)?\(\s*"([^"\n]+)"\s*\)/g, (m) =>
    addSelector(m[1], selectorSet)
  );
  collectMatches(content, /querySelector(?:All)?\(\s*'([^'\n]+)'\s*\)/g, (m) =>
    addSelector(m[1], selectorSet)
  );
  collectMatches(content, /querySelector(?:All)?\(\s*`([^`\n]+)`\s*\)/g, (m) =>
    addSelector(m[1], selectorSet)
  );

  collectMatches(content, /getElementsByClassName\(\s*["'`]([^"'`]+)["'`]\s*\)/g, (m) => {
    const className = cleanToken(m[1]);
    if (className === null) return;
    addSelector(`.${className}`, selectorSet);
  });

  collectSelectorConfigStrings(content, selectorSet);
}

function enrichFromSelector(selector, idSet, testIdSet) {
  collectMatches(selector, /#([A-Za-z][A-Za-z0-9_-]*)/g, (m) => addId(m[1], idSet));
  collectMatches(selector, /\[id\s*=\s*["']([^"']+)["']\]/g, (m) => addId(m[1], idSet));
  collectMatches(selector, /\[data-testid(?:[*^$|~]?=)\s*["']([^"']+)["']\]/g, (m) =>
    addTestId(m[1], testIdSet)
  );
}

function selectorToKey(selector, usedKeys) {
  let base = selector
    .toLowerCase()
    .replace(/\[data-testid\s*=\s*["']?([^"'`\]]+)["']?\]/g, "testid_$1")
    .replace(/#([a-z0-9_-]+)/g, "id_$1")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (base === "") base = "selector";
  if (base.length > 80) {
    base = base.slice(0, 80).replace(/_+$/g, "");
  }

  if (!usedKeys.has(base)) {
    usedKeys.add(base);
    return base;
  }

  let index = 2;
  let candidate = `${base}_${index}`;
  while (usedKeys.has(candidate)) {
    index += 1;
    candidate = `${base}_${index}`;
  }
  usedKeys.add(candidate);
  return candidate;
}

function mapFromEntries(entries) {
  return Object.fromEntries(entries);
}

function generateManifest() {
  const idSet = new Set();
  const testIdSet = new Set();
  const selectorSet = new Set();
  const scannedFiles = [];

  for (const sourceDir of SOURCE_DIRS) {
    const fullPath = join(PROJECT_ROOT, sourceDir);
    try {
      if (!statSync(fullPath).isDirectory()) continue;
    } catch {
      continue;
    }
    walkFiles(fullPath, scannedFiles);
  }

  for (const filePath of scannedFiles) {
    const content = readFileSync(filePath, "utf-8");
    extractSelectorsFromContent(content, filePath, idSet, testIdSet, selectorSet);
  }

  for (const selector of selectorSet) {
    enrichFromSelector(selector, idSet, testIdSet);
  }

  const idEntries = [...idSet].sort((a, b) => a.localeCompare(b));
  const testIdEntries = [...testIdSet].sort((a, b) => a.localeCompare(b));
  const selectorEntries = [...selectorSet].sort((a, b) => a.localeCompare(b));

  const selectorKeySet = new Set();
  const queryEntries = selectorEntries.map((selector) => [selectorToKey(selector, selectorKeySet), selector]);

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    generator: "scripts/generate-dom-manifest.js",
    mode: "static-scan",
    scope: SOURCE_DIRS,
    stats: {
      filesScanned: scannedFiles.length,
      ids: idEntries.length,
      testIds: testIdEntries.length,
      querySelectors: selectorEntries.length,
      totalSelectors: idEntries.length + testIdEntries.length + selectorEntries.length,
    },
    lookup: {
      id: mapFromEntries(idEntries.map((id) => [id, `#${id}`])),
      testid: mapFromEntries(
        testIdEntries.map((testId) => [testId, `[data-testid="${testId}"]`])
      ),
      query: mapFromEntries(queryEntries),
    },
  };
}

function main() {
  const manifest = generateManifest();
  mkdirSync(join(PROJECT_ROOT, ".rovo", "_metadata"), { recursive: true });
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");

  console.log(`✅ DOM manifest generated: ${OUTPUT_PATH}`);
  console.log(`📊 Files scanned: ${manifest.stats.filesScanned}`);
  console.log(`🆔 IDs: ${manifest.stats.ids}`);
  console.log(`🏷️ data-testid: ${manifest.stats.testIds}`);
  console.log(`🔎 Query selectors: ${manifest.stats.querySelectors}`);
}

main();

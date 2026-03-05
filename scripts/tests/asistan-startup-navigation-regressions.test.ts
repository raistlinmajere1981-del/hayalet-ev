import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());

function read(filePath: string): string {
  return readFileSync(resolve(root, filePath), "utf-8");
}

test("index does not include temporary test page button", () => {
  const indexHtml = read("src/index.html");
  assert.doesNotMatch(indexHtml, /data-page="test"/);
});

test("page-init does not wire temporary test page assets", () => {
  const pageInit = read("src/js/app/page-init.ts");

  assert.doesNotMatch(pageInit, /pages\/test\.js/);
  assert.doesNotMatch(pageInit, /pages\/test\.html\?raw/);
  assert.doesNotMatch(pageInit, /controllers\["test"\]/);
});

test("navigation allows asistan page to activate side-nav item", () => {
  const navigation = read("src/js/app/navigation.ts");

  assert.match(navigation, /const SPECIAL_PAGES = \["settings", "archives", "webview"\];/);
});

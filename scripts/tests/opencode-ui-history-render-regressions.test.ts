import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("opencode-ui history renderer uses a tool host when assistant text is empty", () => {
  const content = readFileSync("src/js/pages/opencode-ui/app.ts", "utf8");

  assert.match(content, /function createHistoricAssistantToolHost\(\): HTMLElement \| null {/);
  assert.match(
    content,
    /const toolTarget =\s*bubble\?\.parentElement \?\? \(toolCalls\.length > 0 \? createHistoricAssistantToolHost\(\) : null\);/
  );
});

test("opencode-ui history renderer binds todo panel to session detail", () => {
  const content = readFileSync("src/js/pages/opencode-ui/app.ts", "utf8");

  assert.match(content, /function renderTodoPanel\(todos: OpencodeUiTodoItem\[\]\): void {/);
  assert.match(content, /renderTodoPanel\(Array\.isArray\(detail\.todos\) \? detail\.todos : \[\]\);/);
});

test("opencode-ui history renderer binds files panel to session detail", () => {
  const content = readFileSync("src/js/pages/opencode-ui/app.ts", "utf8");

  assert.match(content, /function renderFilesPanel\(files: string\[\], workspacePath: string\): void {/);
  assert.match(
    content,
    /renderFilesPanel\(\s*Array\.isArray\(detail\.changed_files\) \? detail\.changed_files : \[\],\s*detail\.workspace_path\s*\);/
  );
});

test("opencode-ui live snapshot key tracks tool call changes", () => {
  const content = readFileSync("src/js/pages/opencode-ui/app.ts", "utf8");

  assert.match(content, /const toolCalls = Array\.isArray\(message\.toolCalls\) \? message\.toolCalls : \[\];/);
  assert.match(content, /toolCalls\s*\.\s*slice\(-2\)/);
});

test("chat utils skip rendering empty assistant bubbles", () => {
  const content = readFileSync("src/js/pages/opencode-ui/chat-utils.ts", "utf8");

  assert.match(
    content,
    /if \(role === "assistant" && text\.trim\(\) === "" && hasFiles !== true\) {\s*return null;\s*}/
  );
});

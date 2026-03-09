import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("opencode-ui history renderer uses a tool host when assistant text is empty", () => {
  const historyContent = readFileSync("src/js/pages/opencode-ui/history-actions.ts", "utf8");
  const appContent = readFileSync("src/js/pages/opencode-ui/app.ts", "utf8");

  assert.match(appContent, /function createHistoricAssistantToolHost\(\): HTMLElement \| null {/);
  assert.match(
    historyContent,
    /const toolTarget =\s*bubble\?\.parentElement instanceof HTMLElement\s*\?\s*bubble\.parentElement\s*:\s*toolCalls\.length > 0\s*\?\s*context\.createHistoricAssistantToolHost\(\)\s*:\s*null;/
  );
});

test("opencode-ui history renderer binds todo panel to session detail", () => {
  const historyContent = readFileSync("src/js/pages/opencode-ui/history-actions.ts", "utf8");
  const appContent = readFileSync("src/js/pages/opencode-ui/app.ts", "utf8");

  assert.match(appContent, /function renderTodoPanel\(todos: OpencodeUiTodoItem\[\]\): void {/);
  assert.match(
    historyContent,
    /context\.renderTodoPanel\(Array\.isArray\(detail\.todos\) \? detail\.todos : \[\]\);/
  );
});

test("opencode-ui history renderer binds files panel to session detail", () => {
  const historyContent = readFileSync("src/js/pages/opencode-ui/history-actions.ts", "utf8");
  const appContent = readFileSync("src/js/pages/opencode-ui/app.ts", "utf8");

  assert.match(appContent, /function renderFilesPanel\(files: string\[\], workspacePath: string\): void {/);
  assert.match(
    historyContent,
    /context\.renderFilesPanel\(\s*Array\.isArray\(detail\.changed_files\) \? detail\.changed_files : \[\],\s*detail\.workspace_path\s*\);/
  );
});

test("opencode-ui live snapshot key tracks tool call changes", () => {
  const content = readFileSync("src/js/pages/opencode-ui/message-content.ts", "utf8");

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

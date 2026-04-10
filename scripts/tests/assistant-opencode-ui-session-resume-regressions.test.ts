import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const assistantIndexPath = "src/js/pages/assistant/assistant.ts";
const assistantBindingsPath = "src/js/pages/assistant/webview-bindings.ts";

function readAssistantIndex(): string {
  return readFileSync(assistantIndexPath, "utf8");
}

function readAssistantBindings(): string {
  return readFileSync(assistantBindingsPath, "utf8");
}

test("assistant listens opencode-ui session change event and persists last session id", () => {
  const bindingsContent = readAssistantBindings();
  const indexContent = readAssistantIndex();

  assert.match(bindingsContent, /event\.channel === "opencode-ui-session-changed"/);
  assert.match(bindingsContent, /onOpencodeSessionChanged\(sessionId\)/);
  assert.match(indexContent, /_saveLastOpencodeUiSessionId\(sessionId\)/);
  assert.match(
    indexContent,
    /SettingsManager\.set\("assistants\.lastOpencodeUiSessionId", sessionId\)/
  );
});

test("opencode-ui connect url resolver injects resumeSessionId from settings", () => {
  const content = readAssistantIndex();

  assert.match(content, /providerId === "opencode-ui"/);
  assert.match(content, /assistants\?\.lastOpencodeUiSessionId/);
  assert.match(content, /parsed\.searchParams\.set\("resumeSessionId", resumeSessionId\)/);
});

test("opencode-ui connect url resolver injects active theme and assistant syncs live theme updates", () => {
  const content = readAssistantIndex();

  assert.match(content, /parsed\.searchParams\.set\("theme", ThemeManager\.current\)/);
  assert.match(content, /ThemeManager\.onChange\(\(theme\) =>/);
  assert.match(content, /buildInlineThemeSyncScript/);
  assert.match(content, /isOpencodeUiThemeHost/);
});

test("opencode-ui connect url resolver converts packaged file routes into absolute page URLs", () => {
  const content = readAssistantIndex();

  assert.match(content, /window\.location\.protocol === "file:" && baseUrl\.startsWith\("\/"\)/);
  assert.match(content, /new URL\("\.", window\.location\.href\)/);
  assert.match(content, /if \(isPackagedFileRoute\) \{\s*return parsed\.toString\(\);/s);
});

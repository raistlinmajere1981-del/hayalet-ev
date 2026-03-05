import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const asistanIndexPath = "src/js/pages/asistan/index.ts";

function readAsistanIndex(): string {
  return readFileSync(asistanIndexPath, "utf8");
}

test("asistan listens opencode-ui session change event and persists last session id", () => {
  const content = readAsistanIndex();

  assert.match(content, /event\.channel === "opencode-ui-session-changed"/);
  assert.match(content, /_saveLastOpencodeUiSessionId\(sessionId\)/);
  assert.match(content, /SettingsManager\.set\("assistants\.lastOpencodeUiSessionId", sessionId\)/);
});

test("opencode-ui connect url resolver injects resumeSessionId from settings", () => {
  const content = readAsistanIndex();

  assert.match(content, /providerId === "opencode-ui"/);
  assert.match(content, /assistants\?\.lastOpencodeUiSessionId/);
  assert.match(content, /parsed\.searchParams\.set\("resumeSessionId", resumeSessionId\)/);
});

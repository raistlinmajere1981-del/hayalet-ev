import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createGhostHandoffRuntimePatch,
  shouldAutoEnableKeepServersOnClose,
} from "../../src/js/pages/assistant/ghost-handoff.ts";

const assistantHtmlPath = "src/pages/assistant.html";
const assistantControllerPath = "src/js/pages/assistant/assistant.ts";

test("ghost handoff auto-enables keep-servers toggle when checkbox is unchecked", () => {
  const shouldEnable = shouldAutoEnableKeepServersOnClose(false);

  assert.equal(shouldEnable, true);
});

test("ghost handoff does not rewrite keep-servers toggle when already enabled", () => {
  const shouldEnable = shouldAutoEnableKeepServersOnClose(true);

  assert.equal(shouldEnable, false);
});

test("ghost handoff runtime patch switches to preparing ghost mode", () => {
  const patch = createGhostHandoffRuntimePatch("wf-ghost-001");

  assert.deepEqual(patch, {
    workflowSessionId: "wf-ghost-001",
    desiredMode: "ghost-agent",
    phase: "preparing-handoff",
  });
});

test("ghost handoff patch remains transition-only", () => {
  const patch = createGhostHandoffRuntimePatch("wf-ghost-002");

  assert.equal("provider" in patch, false);
  assert.equal("autoStart" in patch, false);
  assert.equal("port" in patch, false);
});

test("assistant page moves ghost-agent into the topbar mode dropdown", () => {
  const assistantHtml = readFileSync(assistantHtmlPath, "utf8");
  const assistantController = readFileSync(assistantControllerPath, "utf8");

  assert.match(assistantHtml, /data-assistant-mode-dropdown="true"/);
  assert.match(assistantHtml, /data-assistant-mode-option="ghost-agent"/);
  assert.match(assistantHtml, /assistant\.page\.modeMenuTitle/);
  assert.doesNotMatch(assistantHtml, /assistant-ghost-agent-btn/);
  assert.doesNotMatch(assistantController, /assistant-ghost-agent-btn/);
  assert.doesNotMatch(assistantController, /ghostAgentBtn/);
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  extractExampleArgsFromDescription,
  buildCommandTestMessage,
  buildInlineCommandSnippet,
  parseCommandExecutionInput,
} from "../../src/js/pages/server-command-utils.ts";

test("extractExampleArgsFromDescription picks matching command args from detail text", () => {
  const detail = [
    "📌 Asistanin son cevabini hedef AI slotuna tek sefer gonderir.",
    "",
    "Ornek:",
    "++cmd:AsistanAISend(ai1) Mesaji AI1'e ilet",
  ].join("\n");

  const args = extractExampleArgsFromDescription("AsistanAISend", detail);

  assert.equal(args, "ai1");
});

test("extractExampleArgsFromDescription returns empty for no-arg command", () => {
  const detail = "++cmd:AIAIChatStop()";

  const args = extractExampleArgsFromDescription("AIAIChatStop", detail);

  assert.equal(args, "");
});

test("extractExampleArgsFromDescription ignores other command examples", () => {
  const detail = "++cmd:AsistanAISend(ai2) hedefe gonder";

  const args = extractExampleArgsFromDescription("AIAsistanSend", detail);

  assert.equal(args, "");
});

test("buildInlineCommandSnippet formats command with args", () => {
  const snippet = buildInlineCommandSnippet("PlayMusic", "classic");

  assert.equal(snippet, "++cmd:PlayMusic(classic)");
});

test("buildInlineCommandSnippet formats command without args", () => {
  const snippet = buildInlineCommandSnippet("AIAIChatStop", "");

  assert.equal(snippet, "++cmd:AIAIChatStop()");
});

test("parseCommandExecutionInput parses inline command input", () => {
  const parsed = parseCommandExecutionInput("++cmd:AsistanAISend(ai2)", "PlayMusic");

  assert.equal(parsed.commandName, "AsistanAISend");
  assert.equal(parsed.args, "ai2");
  assert.equal(parsed.inputWasInlineCommand, true);
});

test("parseCommandExecutionInput falls back to selected command with plain args", () => {
  const parsed = parseCommandExecutionInput("classic", "PlayMusic");

  assert.equal(parsed.commandName, "PlayMusic");
  assert.equal(parsed.args, "classic");
  assert.equal(parsed.inputWasInlineCommand, false);
});

test("buildCommandTestMessage formats command with args", () => {
  const message = buildCommandTestMessage("PlayMusic", "classic");

  assert.equal(message, "++cmd:PlayMusic(classic) Komut paneli test mesaji");
});

test("buildCommandTestMessage formats command without args", () => {
  const message = buildCommandTestMessage("AIAIChatStop", "");

  assert.equal(message, "++cmd:AIAIChatStop() Komut paneli test mesaji");
});

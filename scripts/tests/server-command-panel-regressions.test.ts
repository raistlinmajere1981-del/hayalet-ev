import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSettingsWithDisabledCommands,
  getDisabledCommandsForSlot,
  normalizeSlot,
  resolveCategoryForSlot,
  splitCommandCatalogBySource,
} from "../../src/js/pages/server/command-helpers.ts";
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
    "++cmd:AssistantAISend(ai1) Mesaji AI1'e ilet",
  ].join("\n");

  const args = extractExampleArgsFromDescription("AssistantAISend", detail);

  assert.equal(args, "ai1");
});

test("extractExampleArgsFromDescription returns empty for no-arg command", () => {
  const detail = "++cmd:AIAIChatStop()";

  const args = extractExampleArgsFromDescription("AIAIChatStop", detail);

  assert.equal(args, "");
});

test("extractExampleArgsFromDescription ignores other command examples", () => {
  const detail = "++cmd:AssistantAISend(ai2) hedefe gonder";

  const args = extractExampleArgsFromDescription("AIAssistantSend", detail);

  assert.equal(args, "");
});

test("buildInlineCommandSnippet formats command with args", () => {
  const snippet = buildInlineCommandSnippet("WhisperManager", "demo");

  assert.equal(snippet, "++cmd:WhisperManager(demo)");
});

test("buildInlineCommandSnippet formats command without args", () => {
  const snippet = buildInlineCommandSnippet("AIAIChatStop", "");

  assert.equal(snippet, "++cmd:AIAIChatStop()");
});

test("parseCommandExecutionInput parses inline command input", () => {
  const parsed = parseCommandExecutionInput("++cmd:AssistantAISend(ai2)", "WhisperManager");

  assert.equal(parsed.commandName, "AssistantAISend");
  assert.equal(parsed.args, "ai2");
  assert.equal(parsed.inputWasInlineCommand, true);
});

test("parseCommandExecutionInput keeps balanced SlotBridge JSON payloads intact", () => {
  const inline =
    '++cmd:SlotBridge({"action":"message.send","toSlot":"ai1","payload":{"text":"https://example.com/path_(demo)"}})';

  const parsed = parseCommandExecutionInput(inline, "WhisperManager");

  assert.equal(parsed.commandName, "SlotBridge");
  assert.match(parsed.args, /path_\(demo\)/);
  assert.equal(parsed.inputWasInlineCommand, true);
});

test("parseCommandExecutionInput falls back to selected command with plain args", () => {
  const parsed = parseCommandExecutionInput("demo", "WhisperManager");

  assert.equal(parsed.commandName, "WhisperManager");
  assert.equal(parsed.args, "demo");
  assert.equal(parsed.inputWasInlineCommand, false);
});

test("buildCommandTestMessage formats command with args", () => {
  const message = buildCommandTestMessage("WhisperManager", "demo");

  assert.equal(message, "++cmd:WhisperManager(demo) Komut paneli test mesaji");
});

test("buildCommandTestMessage formats command without args", () => {
  const message = buildCommandTestMessage("AIAIChatStop", "");

  assert.equal(message, "++cmd:AIAIChatStop() Komut paneli test mesaji");
});

test("normalizeSlot keeps us1 selection", () => {
  assert.equal(normalizeSlot("us1"), "us1");
});

test("resolveCategoryForSlot maps us1 to us1 category", () => {
  assert.equal(resolveCategoryForSlot("us1"), "us1");
});

test("getDisabledCommandsForSlot reads us1 disabled commands", () => {
  const disabled = getDisabledCommandsForSlot(
    {
      slots: {
        ai1: { disabledCommands: [] },
        ai2: { disabledCommands: [] },
      },
      us1Slot: { selectedRemoteUserId: null, disabledCommands: ["GameRoomXoxRemoteMove"] },
      assistantSlot: { disabledCommands: [] },
    } as never,
    "us1"
  );

  assert.deepEqual(disabled, ["GameRoomXoxRemoteMove"]);
});

test("buildSettingsWithDisabledCommands stores disabled commands under us1 slot", () => {
  const next = buildSettingsWithDisabledCommands(
    {
      slots: {
        ai1: { disabledCommands: [] },
        ai2: { disabledCommands: [] },
      },
      us1Slot: { selectedRemoteUserId: null, disabledCommands: [] },
      assistantSlot: { disabledCommands: [] },
    } as never,
    "us1",
    ["GameRoomXoxRemoteMove"]
  );

  assert.deepEqual(next.us1Slot?.disabledCommands, ["GameRoomXoxRemoteMove"]);
});

test("splitCommandCatalogBySource separates system and room commands", () => {
  const grouped = splitCommandCatalogBySource([
    { name: "SlotBridge", category: "us1", isCustom: false, supportsTestMode: true },
    { name: "GameRoomXoxRemoteMove", category: "us1", isCustom: true, supportsTestMode: false },
  ]);

  assert.deepEqual(grouped.systemCommands.map((item) => item.name), ["SlotBridge"]);
  assert.deepEqual(grouped.roomCommands.map((item) => item.name), ["GameRoomXoxRemoteMove"]);
});

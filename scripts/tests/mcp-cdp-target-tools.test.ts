import assert from "node:assert/strict";
import test from "node:test";

import { createCdpTools } from "../../src/mcp-server/core/handlers/cdp-handlers.ts";
import { handleSuggestTool } from "../../src/mcp-server/tools/tool-discovery.ts";
import { getCdpTargetInfo, sendCdpCommand } from "../../src/mcp-server/tools/cdp-tools.ts";

test("cdp tool registry includes target-aware CDP tools", () => {
  const entries = createCdpTools();
  const names = entries.map((entry) => entry.definition.name);

  assert.ok(names.includes("hev_list_cdp_targets"));
  assert.ok(names.includes("hev_get_cdp_target_info"));
  assert.ok(names.includes("hev_send_cdp_command"));
});

test("tool discovery recommends advanced CDP tools for raw CDP intents", () => {
  const result = handleSuggestTool({ intent: "send raw cdp command to a target" });
  const text = result.content[0]?.type === "text" ? result.content[0].text : "";

  assert.match(text, /hev_list_cdp_targets/);
  assert.match(text, /hev_get_cdp_target_info/);
  assert.match(text, /hev_send_cdp_command/);
});

test("target info requires a target id", async () => {
  const result = await getCdpTargetInfo({});

  assert.equal(result.isError, true);
});

test("raw CDP command requires domain and method", async () => {
  const result = await sendCdpCommand({});

  assert.equal(result.isError, true);
});

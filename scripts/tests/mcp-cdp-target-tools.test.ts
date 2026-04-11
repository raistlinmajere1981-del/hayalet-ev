import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { createCdpTools } from "../../mcp-server/core/handlers/cdp-handlers.ts";
import { handleSuggestTool } from "../../mcp-server/tools/tool-discovery.ts";
import { getCdpTargetInfo, sendCdpCommand } from "../../mcp-server/tools/cdp-tools.ts";

test("cdp tool registry includes target-aware CDP tools", () => {
  const entries = createCdpTools();
  const names = entries.map((entry) => entry.definition.name);

  assert.ok(names.includes("hev_list_cdp_instances"));
  assert.ok(names.includes("hev_list_cdp_targets"));
  assert.ok(names.includes("hev_get_cdp_target_info"));
  assert.ok(names.includes("hev_send_cdp_command"));
});

test("cdp tool schemas expose port-aware multi-instance routing", () => {
  const entries = createCdpTools();
  const definitions = new Map(
    entries.map((entry) => [entry.definition.name, entry.definition] as const)
  );

  const listInstances = definitions.get("hev_list_cdp_instances");
  const checkConnection = definitions.get("hev_check_electron_connection");
  const listTargets = definitions.get("hev_list_cdp_targets");
  const sendCommand = definitions.get("hev_send_command_to_electron");
  const sendRaw = definitions.get("hev_send_cdp_command");
  const screenshot = definitions.get("hev_take_cdp_screenshot");
  const targetInfo = definitions.get("hev_get_cdp_target_info");
  const inspectElement = definitions.get("hev_inspect_element");
  const queryElements = definitions.get("hev_query_elements");
  const toggleMcpPanel = definitions.get("hev_toggle_mcp_panel_servers");

  assert.equal(listInstances?.inputSchema?.properties?.startPort?.type, "number");
  assert.equal(listInstances?.inputSchema?.properties?.endPort?.type, "number");
  assert.equal(checkConnection?.inputSchema?.properties?.port?.type, "number");
  assert.equal(listTargets?.inputSchema?.properties?.port?.type, "number");
  assert.equal(sendCommand?.inputSchema?.properties?.port?.type, "number");
  assert.equal(sendRaw?.inputSchema?.properties?.port?.type, "number");
  assert.equal(screenshot?.inputSchema?.properties?.port?.type, "number");
  assert.equal(targetInfo?.inputSchema?.properties?.port?.type, "number");
  assert.equal(inspectElement?.inputSchema?.properties?.port?.type, "number");
  assert.equal(queryElements?.inputSchema?.properties?.port?.type, "number");
  assert.equal(toggleMcpPanel?.inputSchema?.properties?.port?.type, "number");
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

test("packaged electron defaults to the next CDP port while dev keeps 9222", async () => {
  const projectRoot = process.cwd();
  const mainSource = await readFile(join(projectRoot, "electron", "main.ts"), "utf8");
  const packagedWrapperSource = await readFile(
    join(projectRoot, "electron", "packaged-wrapper-main.ts"),
    "utf8"
  );

  assert.match(mainSource, /process\.env\["CDP_PORT"\] \?\? \(app\.isPackaged \? 9223 : 9222\)/);
  assert.match(packagedWrapperSource, /return cdpPort !== "" \? cdpPort : "9223"/);
  assert.match(
    packagedWrapperSource,
    /args\.push\(`--remote-debugging-port=\$\{resolvePackagedCdpPort\(\)\}`\)/
  );
});

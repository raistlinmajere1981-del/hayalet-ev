import assert from "node:assert/strict";
import test from "node:test";

import {
  ASSISTANT_DOCTOR_TOOL,
  ASSISTANT_VERIFY_COMPLETION_TOOL,
  createAssistantTools,
} from "../../mcp-server/tools/assistant-tools.ts";

function parseToolText(result: unknown): Record<string, unknown> {
  const payload = result as { content?: Array<{ type?: string; text?: string }> };
  const text = payload.content?.[0]?.text;
  assert.equal(typeof text, "string");
  return JSON.parse(text);
}

test("assistant MCP tools expose AI-facing doctor and verification names", () => {
  const entries = createAssistantTools(process.cwd());
  const names = entries.map((entry) => (entry.definition as { name: string }).name);

  assert.deepEqual(names, ["hev_assistant_doctor", "hev_assistant_verify_completion"]);
  assert.equal(ASSISTANT_DOCTOR_TOOL.metadata.category, "assistant");
  assert.equal(ASSISTANT_VERIFY_COMPLETION_TOOL.metadata.subcategory, "verification");
});

test("assistant verify completion can report explicit evidence without shell checks", async () => {
  const verifyEntry = createAssistantTools(process.cwd()).find(
    (entry) => (entry.definition as { name: string }).name === "hev_assistant_verify_completion"
  );
  assert.ok(verifyEntry);

  const report = parseToolText(
    await verifyEntry.handler({
      changed_files: [],
      evidence: ["npm run mcp:build passed"],
      run_syntax: false,
    })
  );

  assert.equal(report["success"], true);
  assert.equal(report["readyToReport"], true);
  assert.equal(report["status"], "verified");
});

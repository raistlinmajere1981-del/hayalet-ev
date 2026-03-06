import assert from "node:assert/strict";
import test from "node:test";

import { buildMessageRequestBody } from "../../src/js/pages/opencode-ui/app.ts";

test("buildMessageRequestBody sends model as provider+model object", () => {
  const body = buildMessageRequestBody({
    text: "merhaba",
    modelId: "gpt-5.3-codex",
    providerId: "openai",
    agentId: "sisyphus",
  });

  assert.deepEqual(body, {
    parts: [{ type: "text", text: "merhaba" }],
    model: {
      providerID: "openai",
      modelID: "gpt-5.3-codex",
    },
    agent: "sisyphus",
  });
});

test("buildMessageRequestBody adds reasoning effort when selected", () => {
  const body = buildMessageRequestBody({
    text: "test",
    modelId: "gpt-5.3-codex",
    providerId: "openai",
    reasoningEffort: "xhigh",
  });

  assert.deepEqual(body, {
    parts: [{ type: "text", text: "test" }],
    model: {
      providerID: "openai",
      modelID: "gpt-5.3-codex",
      options: {
        reasoningEffort: "xhigh",
      },
    },
  });
});

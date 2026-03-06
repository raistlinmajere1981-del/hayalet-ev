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

test("buildMessageRequestBody preserves provider-specific variant options", () => {
  const body = buildMessageRequestBody({
    text: "anthropic thinking test",
    modelId: "antigravity-claude-opus-4-6-thinking",
    providerId: "google",
    reasoningEffort: "max",
    modelOptions: {
      thinkingConfig: {
        thinkingBudget: 32768,
      },
    },
  });

  assert.deepEqual(body, {
    parts: [{ type: "text", text: "anthropic thinking test" }],
    model: {
      providerID: "google",
      modelID: "antigravity-claude-opus-4-6-thinking",
      options: {
        thinkingConfig: {
          thinkingBudget: 32768,
        },
      },
    },
  });
});

test("buildMessageRequestBody appends staged attachments as file parts", () => {
  const body = buildMessageRequestBody({
    text: "ekleri incele",
    modelId: null,
    providerId: null,
    attachments: [
      {
        id: "att_1",
        name: "note.txt",
        mimeType: "text/plain",
        base64: "bm90ZQ==",
        size: 4,
        source: "clipboard",
      },
    ],
  });

  assert.deepEqual(body, {
    parts: [
      { type: "text", text: "ekleri incele" },
      {
        type: "file",
        filename: "note.txt",
        name: "note.txt",
        mime: "text/plain",
        media_type: "text/plain",
        url: "data:text/plain;base64,bm90ZQ==",
        data: "bm90ZQ==",
        base64: "bm90ZQ==",
      },
    ],
  });
});

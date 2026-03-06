import assert from "node:assert/strict";
import test from "node:test";

import { normalizeModelItems } from "../../src/js/pages/opencode-ui/app.ts";

test("normalizeModelItems supports provider.models object-map payload", () => {
  const payload = {
    providers: [
      {
        id: "openai",
        models: {
          "gpt-5.3-codex": {
            id: "gpt-5.3-codex",
            name: "GPT-5.3 Codex",
          },
          "gpt-5-codex": {
            modelID: "gpt-5-codex",
            name: "GPT-5 Codex",
          },
        },
      },
    ],
  };

  const items = normalizeModelItems(payload);

  assert.equal(items.length, 2);
  assert.deepEqual(items.map((item) => item.value).sort(), ["gpt-5-codex", "gpt-5.3-codex"]);
});

test("normalizeModelItems keeps provider and reasoning effort variants", () => {
  const payload = {
    providers: [
      {
        id: "openai",
        models: {
          "gpt-5.3-codex": {
            id: "gpt-5.3-codex",
            name: "GPT-5.3 Codex",
            variants: {
              low: { reasoningEffort: "low" },
              medium: { reasoningEffort: "medium" },
              high: { reasoningEffort: "high" },
              xhigh: { reasoningEffort: "xhigh" },
            },
          },
        },
      },
    ],
  };

  const items = normalizeModelItems(payload);
  assert.equal(items.length, 1);

  const item = items[0] as unknown as { providerId?: string; reasoningEfforts?: string[] };
  assert.equal(item.providerId, "openai");
  assert.deepEqual(item.reasoningEfforts, ["low", "medium", "high", "xhigh"]);
});

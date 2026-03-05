import assert from "node:assert/strict";
import test from "node:test";

import {
  defaultSettings,
  normalizeSettings,
} from "../../src/js/modules/settings/settings-schema.ts";

test("default settings scaffold assistants.lastOpencodeUiSessionId as null", () => {
  const settings = defaultSettings();

  assert.equal(settings.assistants?.lastOpencodeUiSessionId, null);
});

test("normalize settings backfills missing assistants.lastOpencodeUiSessionId", () => {
  const normalized = normalizeSettings({
    assistants: {
      preferred: "opencode",
    },
  });

  assert.equal(normalized.assistants?.lastOpencodeUiSessionId, null);
});

test("normalize settings keeps opencode-ui as assistants.preferred", () => {
  const normalized = normalizeSettings({
    assistants: {
      preferred: "opencode-ui",
    },
  });

  assert.equal(normalized.assistants?.preferred, "opencode-ui");
});

test("normalize settings coerces invalid assistants.preferred to opencode", () => {
  const normalized = normalizeSettings({
    assistants: {
      preferred: "invalid-provider",
    },
  });

  assert.equal(normalized.assistants?.preferred, "opencode");
});

test("normalize settings preserves string assistants.lastOpencodeUiSessionId", () => {
  const normalized = normalizeSettings({
    assistants: {
      lastOpencodeUiSessionId: "session-opencode-ui-123",
    },
  });

  assert.equal(normalized.assistants?.lastOpencodeUiSessionId, "session-opencode-ui-123");
});

test("normalize settings coerces invalid assistants.lastOpencodeUiSessionId to null", () => {
  const normalized = normalizeSettings({
    assistants: {
      lastOpencodeUiSessionId: 123,
    },
  });

  assert.equal(normalized.assistants?.lastOpencodeUiSessionId, null);
});

test("normalize settings backfills opencode-ui assistant account", () => {
  const normalized = normalizeSettings({
    asistanAccounts: [],
  });

  const providers = (normalized.asistanAccounts ?? []).map((account) => account.provider);
  assert.ok(providers.includes("opencode-ui"));
});

test("default settings include opencode-ui db path binding", () => {
  const settings = defaultSettings();
  const opencodeUiAccount = (settings.asistanAccounts ?? []).find(
    (account) => account.provider === "opencode-ui"
  );

  assert.equal(opencodeUiAccount?.dbPath, "~/.local/share/opencode/opencode.db");
});

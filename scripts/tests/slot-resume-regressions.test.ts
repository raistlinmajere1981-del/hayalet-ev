import assert from "node:assert/strict";
import test from "node:test";

import {
  defaultSettings,
  normalizeSettings,
} from "../../src/js/modules/settings/settings-schema.ts";

test("default settings enable slot resume for AI1 and AI2", () => {
  const settings = defaultSettings();

  assert.equal(settings.slots.ai1.resumeLastSession, true);
  assert.equal(settings.slots.ai2.resumeLastSession, true);
});

test("normalize settings backfills missing slot resume flag", () => {
  const normalized = normalizeSettings({
    slots: {
      ai1: {
        accountId: null,
        catchCommands: true,
        messageMethod: "injection",
        fileMethod: "dragdrop",
      },
      ai2: {
        accountId: null,
        catchCommands: true,
        messageMethod: "injection",
        fileMethod: "dragdrop",
      },
    },
    accounts: [],
    asistanAccounts: [],
  });

  assert.equal(normalized.slots.ai1.resumeLastSession, true);
  assert.equal(normalized.slots.ai2.resumeLastSession, true);
});

test("normalize settings preserves account lastSessionUrl", () => {
  const normalized = normalizeSettings({
    accounts: [
      {
        id: "chatgpt_demo",
        provider: "chatgpt",
        email: "demo@example.com",
        lastSessionUrl: "https://chatgpt.com/c/abc123",
      },
    ],
    asistanAccounts: [],
    slots: {
      ai1: {
        accountId: "chatgpt_demo",
        catchCommands: true,
        messageMethod: "injection",
        fileMethod: "dragdrop",
      },
      ai2: {
        accountId: null,
        catchCommands: true,
        messageMethod: "injection",
        fileMethod: "dragdrop",
      },
    },
  });

  assert.equal(normalized.accounts[0]?.lastSessionUrl, "https://chatgpt.com/c/abc123");
});

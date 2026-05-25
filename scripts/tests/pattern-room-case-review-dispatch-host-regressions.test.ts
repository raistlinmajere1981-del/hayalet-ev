import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { RoomCommandRegistry } from "../../src/js/modules/rooms/room-command-registry.ts";
import {
  flattenRoomCommandSpecs,
  validateRoomManifest,
  type InstalledRoomRecord,
  type RoomManifest,
} from "../../src/types/rooms.ts";
import createPatternRoomHostRuntime from "../../rooms/pattern-room/host/runtime.ts";
import { createPatternRoomCaseReviewDispatchDraft } from "../../rooms/pattern-room/shared/adapters/pattern-room-case-review-dispatch-adapter.ts";
import type { PatternRoomCasePacket } from "../../rooms/pattern-room/shared/types/pattern-room-case-packet.ts";
import {
  PATTERN_ROOM_CASE_REVIEW_DISPATCH_COMMAND,
  PATTERN_ROOM_CASE_REVIEW_DISPATCH_FAILED_EVENT,
  PATTERN_ROOM_CASE_REVIEW_DISPATCHED_EVENT,
  type PatternRoomCaseReviewDispatchDraft,
} from "../../rooms/pattern-room/shared/types/pattern-room-case-review-dispatch.ts";
import { PATTERN_ROOM_SNAPSHOT_VERSION } from "../../rooms/pattern-room/shared/types/pattern-room-snapshot.ts";
import type { PatternRoomStorageAdapter } from "../../rooms/pattern-room/shared/types/pattern-room-storage.ts";

type PatternRoomNotification = {
  payload: Record<string, unknown>;
  type: string;
};

const PATTERN_ROOM_RECORD: InstalledRoomRecord = {
  id: "pattern-room",
  name: "Pattern Room",
  version: "2.0.0",
  installedDir: "/workspace/rooms/.build/pattern-room/runtime",
  sourceDir: "/workspace/rooms/pattern-room",
  manifestPath: "/workspace/rooms/.build/pattern-room/runtime/manifest.json",
  runtimeEntryPath: "/workspace/rooms/.build/pattern-room/runtime/ui/index.html",
  hostEntryPath: "/workspace/rooms/.build/pattern-room/runtime/host/index.js",
  defaultFeatureId: "pattern-workbench",
  features: [{ id: "pattern-workbench", name: "Pattern Workbench" }],
  commandSpecs: [],
  installedAt: "2026-05-21T00:00:00.000Z",
  updatedAt: "2026-05-21T00:00:00.000Z",
};

function createCasePacketFixture(extraText = ""): PatternRoomCasePacket {
  return {
    packetVersion: 1,
    roomId: "pattern-room",
    topicLabel: "Yerel vaka",
    generatedFrom: "local-view-model",
    caution:
      "Bu paket kullanıcı tarafından eklenen ve henüz dışarıdan denetlenmemiş yerel araştırma izlerinden hazırlanmıştır; sonuç veya doğrulama beyanı içermez.",
    sources: [
      {
        id: "source-001",
        label: "Seyir defteri",
        typeLabel: "Yerel Kaynak",
        origin: "Kullanıcı arşivi",
        status: "unverified",
        preview: `Kısa kaynak önizlemesi. ${extraText}`.trim(),
        segmentCount: 2,
      },
    ],
    evidence: [
      {
        id: "evidence-001",
        label: "Seçili alıntı",
        sourceLabel: "Seyir defteri",
        excerptPreview: `Alıntı önizlemesi. ${extraText}`.trim(),
        interpretationPreview: "Kullanıcı yorumu ayrı kalır.",
        layer: "evidence",
      },
    ],
    boardNotes: [
      {
        id: "note-001",
        label: "Belirsizlik",
        type: "Belirsizlik",
        layer: "uncertainty",
        contentPreview: "Eksik bağlam notu.",
      },
    ],
    connections: [
      {
        id: "edge-001",
        sourceLabel: "Seçili alıntı",
        edgeTypeLabel: "soru doğuruyor",
        targetLabel: "Belirsizlik",
        notePreview: "Yerel ilişki notu.",
      },
    ],
    debate: {
      phaseLabel: "pending",
      statusLabel: "Hazır değil",
      referenceCount: 1,
      turnCount: 0,
      verdictPreview: null,
      turnPreviews: [],
    },
    openQuestions: ["Hangi kaynaklar yeniden okunmalı?"],
    limits: {
      maxSources: 20,
      maxEvidence: 30,
      maxBoardNotes: 30,
      maxConnections: 30,
      excerptMaxLength: 500,
    },
  };
}

function createDispatchDraft(): PatternRoomCaseReviewDispatchDraft {
  return createPatternRoomCaseReviewDispatchDraft({
    casePacket: createCasePacketFixture(),
    roleSlot: "AI2",
    taskPrompt: "Karşı argümanları ve açık soruları çıkar.",
    options: { page: "ui/index.html" },
  });
}

function createMockStorageAdapter(): PatternRoomStorageAdapter {
  return {
    async delete(_snapshotId: string): Promise<void> {
      return undefined;
    },
    async list(): Promise<[]> {
      return [];
    },
    async load(_topicId: string): Promise<null> {
      return null;
    },
    async save(): Promise<void> {
      return undefined;
    },
  };
}

function activateHost(
  options: {
    dispatchBridge?: (payload: Record<string, unknown>) => Promise<unknown>;
    registerWithRegistry?: boolean;
  } = {}
): {
  activation: ReturnType<ReturnType<typeof createPatternRoomHostRuntime>["activate"]>;
  dispatchCalls: Record<string, unknown>[];
  notifications: PatternRoomNotification[];
} {
  const dispatchCalls: Record<string, unknown>[] = [];
  const notifications: PatternRoomNotification[] = [];
  const activation = createPatternRoomHostRuntime({
    storageAdapter: createMockStorageAdapter(),
  }).activate({
    async dispatchBridge(payload) {
      dispatchCalls.push(payload);
      return await (options.dispatchBridge?.(payload) ?? Promise.resolve({ success: true }));
    },
    notifyRoom(type, payload = {}) {
      notifications.push({ payload, type });
    },
    registerCommand(commandName, handler, commandOptions = {}) {
      if (options.registerWithRegistry === true) {
        RoomCommandRegistry.registerHandler(
          PATTERN_ROOM_RECORD.id,
          commandName,
          handler,
          commandOptions
        );
      }
    },
  });

  return { activation, dispatchCalls, notifications };
}

function readPatternRoomManifest(): RoomManifest {
  const manifest = JSON.parse(readFileSync(resolve("rooms/pattern-room/manifest.json"), "utf8"));
  const result = validateRoomManifest(manifest);

  assert.equal(result.valid, true, result.errors.join("\n"));
  assert.ok(result.manifest);

  return result.manifest;
}

test("pattern-room case review dispatch command contract literals stay stable", () => {
  assert.equal(PATTERN_ROOM_CASE_REVIEW_DISPATCH_COMMAND, "pattern:case-review-dispatch");
  assert.equal(PATTERN_ROOM_CASE_REVIEW_DISPATCHED_EVENT, "pattern:case-review-dispatched");
  assert.equal(
    PATTERN_ROOM_CASE_REVIEW_DISPATCH_FAILED_EVENT,
    "pattern:case-review-dispatch-failed"
  );
});

test("pattern-room case review dispatch command registers as internal room-ui only", async () => {
  RoomCommandRegistry.reset();

  try {
    RoomCommandRegistry.syncInstalledRooms([PATTERN_ROOM_RECORD]);
    activateHost({ registerWithRegistry: true });

    const metadata = RoomCommandRegistry.getMetadata(
      PATTERN_ROOM_CASE_REVIEW_DISPATCH_COMMAND,
      PATTERN_ROOM_RECORD.id
    );

    assert.equal(metadata?.scope, "room-ui");
    assert.equal(metadata?.exposure, "internal");
    assert.equal(
      RoomCommandRegistry.listPublicCommands().includes(PATTERN_ROOM_CASE_REVIEW_DISPATCH_COMMAND),
      false
    );
    assert.equal(
      RoomCommandRegistry.getCatalog().some(
        (entry) => entry.name === PATTERN_ROOM_CASE_REVIEW_DISPATCH_COMMAND
      ),
      false
    );
    assert.equal(
      RoomCommandRegistry.getCatalog("ai0").some(
        (entry) => entry.name === PATTERN_ROOM_CASE_REVIEW_DISPATCH_COMMAND
      ),
      false
    );
    assert.equal(
      RoomCommandRegistry.getCatalog("ai1-ai2").some(
        (entry) => entry.name === PATTERN_ROOM_CASE_REVIEW_DISPATCH_COMMAND
      ),
      false
    );
    assert.equal(
      RoomCommandRegistry.getCatalog("us1").some(
        (entry) => entry.name === PATTERN_ROOM_CASE_REVIEW_DISPATCH_COMMAND
      ),
      false
    );
  } finally {
    RoomCommandRegistry.reset();
  }
});

test("pattern-room case review dispatch command stays out of manifest command specs", () => {
  const manifest = readPatternRoomManifest();

  assert.equal(
    flattenRoomCommandSpecs(manifest).some((spec) => {
      return spec.name === PATTERN_ROOM_CASE_REVIEW_DISPATCH_COMMAND;
    }),
    false
  );
});

test("pattern-room case review dispatch rejects non room-ui providers and wrong rooms", async () => {
  RoomCommandRegistry.reset();
  const draft = createDispatchDraft();
  const { dispatchCalls } = activateHost({ registerWithRegistry: true });

  try {
    for (const provider of ["ai0", "ai1", "ai2", "us1", "system", "provider"]) {
      const result = (await RoomCommandRegistry.run(PATTERN_ROOM_CASE_REVIEW_DISPATCH_COMMAND, {
        provider,
        roomId: PATTERN_ROOM_RECORD.id,
        roomPayload: { draft },
      })) as { success?: boolean };

      assert.equal(result.success, false, `provider ${provider} should be rejected`);
    }

    const wrongRoomResult = (await RoomCommandRegistry.run(
      PATTERN_ROOM_CASE_REVIEW_DISPATCH_COMMAND,
      {
        provider: "room-ui",
        roomId: "forge-room",
        roomPayload: { draft },
      }
    )) as { success?: boolean };

    assert.equal(wrongRoomResult.success, false);
    assert.deepEqual(dispatchCalls, []);
  } finally {
    RoomCommandRegistry.reset();
  }
});

test("pattern-room case review dispatch command forwards the prepared draft payload", async () => {
  RoomCommandRegistry.reset();
  const draft = createDispatchDraft();
  const { dispatchCalls, notifications } = activateHost({ registerWithRegistry: true });

  try {
    const result = await RoomCommandRegistry.run(PATTERN_ROOM_CASE_REVIEW_DISPATCH_COMMAND, {
      provider: "room-ui",
      roomId: PATTERN_ROOM_RECORD.id,
      roomPayload: { draft },
    });

    assert.deepEqual(result, { success: true });
    assert.deepEqual(dispatchCalls, [draft.payload]);
    assert.equal(dispatchCalls[0]?.["action"], "message.send");
    assert.deepEqual((dispatchCalls[0]?.["payload"] as Record<string, unknown>)["protocol"], {
      room: "pattern-room",
      scenario: "case-review",
      protocolKey: "pattern-room-case-review",
    });
    assert.match(
      String((dispatchCalls[0]?.["payload"] as Record<string, unknown>)["text"] ?? ""),
      /Bu paket kullanıcı tarafından eklenen/
    );
    assert.deepEqual(notifications, [
      {
        payload: {
          roleSlot: "AI2",
          success: true,
          targetSlot: "ai2",
          warnings: [],
        },
        type: PATTERN_ROOM_CASE_REVIEW_DISPATCHED_EVENT,
      },
    ]);
  } finally {
    RoomCommandRegistry.reset();
  }
});

test("pattern-room case review dispatch rejects malformed drafts before bridge dispatch", async () => {
  const draft = createDispatchDraft();
  const malformedDrafts: unknown[] = [
    null,
    { ...draft, targetSlot: "ai0" },
    { ...draft, payload: { ...draft.payload, action: "message.sendWait" } },
    {
      ...draft,
      payload: {
        ...draft.payload,
        payload: {
          ...draft.payload.payload,
          protocol: { ...draft.payload.payload.protocol, context: { casePacket: "nope" } },
        },
      },
    },
    { ...draft, payload: { ...draft.payload, payload: { ...draft.payload.payload, text: " " } } },
  ];
  const { activation, dispatchCalls, notifications } = activateHost();

  for (const malformedDraft of malformedDrafts) {
    const result = await activation.commands[PATTERN_ROOM_CASE_REVIEW_DISPATCH_COMMAND]({
      draft: malformedDraft,
    });

    assert.equal(result.success, false);
  }

  assert.deepEqual(dispatchCalls, []);
  assert.equal(
    notifications.every((notification) => {
      return notification.type === PATTERN_ROOM_CASE_REVIEW_DISPATCH_FAILED_EVENT;
    }),
    true
  );
});

test("pattern-room case review dispatch reports bridge failures and accepts the next command", async () => {
  const draft = createDispatchDraft();
  let shouldFail = true;
  const { activation, dispatchCalls, notifications } = activateHost({
    async dispatchBridge(): Promise<Record<string, unknown>> {
      if (shouldFail) {
        shouldFail = false;
        throw new Error("dispatch temporary failure");
      }
      return { success: true };
    },
  });

  const failedResult = await activation.commands[PATTERN_ROOM_CASE_REVIEW_DISPATCH_COMMAND]({
    draft,
  });
  const successResult = await activation.commands[PATTERN_ROOM_CASE_REVIEW_DISPATCH_COMMAND]({
    draft,
  });

  assert.equal(failedResult.success, false);
  assert.deepEqual(successResult, { success: true });
  assert.deepEqual(dispatchCalls, [draft.payload, draft.payload]);
  assert.deepEqual(
    notifications.map((notification) => notification.type),
    [PATTERN_ROOM_CASE_REVIEW_DISPATCH_FAILED_EVENT, PATTERN_ROOM_CASE_REVIEW_DISPATCHED_EVENT]
  );
  assert.deepEqual(notifications[0]?.payload, {
    error: "dispatch temporary failure",
    success: false,
  });
});

test("pattern-room host lifecycle does not dispatch during ready/load restore", async () => {
  const { activation, dispatchCalls, notifications } = activateHost();

  await activation.onRoomReady();

  assert.deepEqual(dispatchCalls, []);
  assert.deepEqual(
    notifications.map((notification) => notification.type),
    ["pattern:loaded"]
  );
});

test("pattern-room case review dispatch host stays renderer-safe and UI-free", async () => {
  const hostSource = await readFile(resolve("rooms/pattern-room/host/runtime.ts"), "utf8");
  const uiRuntimeSource = await readFile(
    resolve("rooms/pattern-room/ui/pattern-room-ui-runtime.ts"),
    "utf8"
  );
  const tenthManPanelSource = await readFile(
    resolve("rooms/pattern-room/ui/panels/pattern-tenth-man-panel.ts"),
    "utf8"
  );

  assert.doesNotMatch(hostSource, /from\s+["']node:(?:fs|path)["']/);
  assert.doesNotMatch(hostSource, /pattern-room-json-store/);
  assert.doesNotMatch(hostSource, /message\.sendWait|sendWait|protocolDelivered/);
  assert.equal(PATTERN_ROOM_SNAPSHOT_VERSION, 1);

  for (const uiSource of [uiRuntimeSource, tenthManPanelSource]) {
    assert.doesNotMatch(uiSource, /PATTERN_ROOM_CASE_REVIEW_DISPATCH_COMMAND/);
    assert.doesNotMatch(uiSource, /pattern:case-review-dispatch|case-review-dispatch/);
  }
});

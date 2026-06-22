import type { FakeElement } from "./forge-room-ui-smoke.helpers.ts";
import { assert, createMinimalForgeUiEnvironment, createRoomInstalledCopy, fireEvent, pathToFileURL, readTreeText, resolve, test } from "./forge-room-ui-smoke.helpers.ts";
import { PATTERN_ROOM_DOMAIN_MOCK } from "../../rooms/pattern-room/shared/data/pattern-room-domain.mock.ts";
import { createLocalState } from "../../rooms/pattern-room/shared/state/pattern-room-local-state.ts";
import { createSnapshot } from "../../rooms/pattern-room/shared/state/pattern-room-snapshot.ts";
import {
  PATTERN_ROOM_LOADED_EVENT,
  PATTERN_ROOM_SAVE_COMMAND,
  PATTERN_ROOM_SAVE_FAILED_EVENT,
} from "../../rooms/pattern-room/shared/types/pattern-room-persistence.ts";

const PATTERN_FOCUSED_VIEWS = ["board", "desk", "archive", "tenth-man", "report"] as const;
type PatternFocusedViewId = (typeof PATTERN_FOCUSED_VIEWS)[number];
type PatternRoomFakeApp = FakeElement;
type PatternRoomUiRuntimeModule = {
  createPatternRoomUiRuntime: () => {
    createSnapshot: () => PatternRoomSessionSnapshot;
    dispose: () => void;
    start: () => void;
  };
};

function assertTextIncludes(text: string, expectedValues: string[]): void {
  expectedValues.forEach((expectedValue) => {
    assert.match(text, new RegExp(expectedValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });
}

function openFocusedView(app: PatternRoomFakeApp, viewId: PatternFocusedViewId): void {
  const hotspot = app.querySelector(`[data-pattern-hotspot='${viewId}']`);
  assert.ok(hotspot);
  fireEvent(hotspot, "click");
  assert.ok(app.querySelector(`[data-pattern-view='${viewId}']`));
}

function returnToOverview(app: PatternRoomFakeApp): void {
  const backButton = app.querySelector("[data-pattern-back='true']");
  assert.ok(backButton);
  fireEvent(backButton, "click");
  assert.ok(app.querySelector("[data-pattern-view='overview']"));
}

function installFormReset(form: FakeElement): void {
  (form as FakeElement & { reset: () => void }).reset = () => {};
}

function submitForm(form: {
  eventListeners: Map<string, Array<(event?: Record<string, unknown>) => void>>;
  reset?: () => void;
}): void {
  let defaultPrevented = false;
  const handlers = form.eventListeners.get("submit") ?? [];

  handlers.forEach((handler) => {
    handler({
      preventDefault() {
        defaultPrevented = true;
      },
    });
  });

  assert.equal(defaultPrevented, true);
}

function submitUserTextSource(
  app: PatternRoomFakeApp,
  titleText: string,
  sourceText: string
): void {
  const form = app.querySelector("[data-pattern-user-text-source-form='true']");
  const titleInput = app.querySelector("[data-pattern-user-text-source-title='true']");
  const textInput = app.querySelector("[data-pattern-user-text-source-text='true']");
  assert.ok(form);
  assert.ok(titleInput);
  assert.ok(textInput);
  titleInput.value = titleText;
  textInput.value = sourceText;
  submitForm(form);
}

function submitLongTextSource(
  app: PatternRoomFakeApp,
  input: {
    title: string;
    origin: string;
    text: string;
    sourceKind?:
      | "book"
      | "article"
      | "newspaper"
      | "religious_text"
      | "archive_text"
      | "personal_note";
    chapter?: string;
    page?: string;
  }
): void {
  const form = app.querySelector("[data-pattern-long-text-source-form='true']");
  const titleInput = app.querySelector("[data-pattern-long-text-source-title='true']");
  const originInput = app.querySelector("[data-pattern-long-text-source-origin='true']");
  const kindSelect = app.querySelector("[data-pattern-long-text-source-kind='true']");
  const chapterInput = app.querySelector("[data-pattern-long-text-source-chapter='true']");
  const pageInput = app.querySelector("[data-pattern-long-text-source-page='true']");
  const textInput = app.querySelector("[data-pattern-long-text-source-text='true']");
  assert.ok(form);
  assert.ok(titleInput);
  assert.ok(originInput);
  assert.ok(kindSelect);
  assert.ok(chapterInput);
  assert.ok(pageInput);
  assert.ok(textInput);

  titleInput.value = input.title;
  originInput.value = input.origin;
  kindSelect.value = input.sourceKind ?? "book";
  chapterInput.value = input.chapter ?? "";
  pageInput.value = input.page ?? "";
  textInput.value = input.text;
  submitForm(form);
}

function submitBoardLocalNode(
  app: PatternRoomFakeApp,
  labelText: string,
  contentText: string,
  nodeTypeValue: "claim" | "inspiration" | "uncertainty" = "claim"
): void {
  const nodeForm = app.querySelector("[data-pattern-author-node-form='true']");
  const nodeType = app.querySelector("[data-pattern-author-node-type='true']");
  const labelInput = app.querySelector("[data-pattern-author-node-label='true']");
  const contentInput = app.querySelector("[data-pattern-author-node-content='true']");
  assert.ok(nodeForm);
  assert.ok(nodeType);
  assert.ok(labelInput);
  assert.ok(contentInput);

  installFormReset(nodeForm);
  nodeType.value = nodeTypeValue;
  labelInput.value = labelText;
  contentInput.value = contentText;
  submitForm(nodeForm);
}

function submitBoardLocalEvidence(
  app: PatternRoomFakeApp,
  labelText: string,
  excerptText: string,
  interpretationText: string
): void {
  const evidenceForm = app.querySelector("[data-pattern-author-evidence-form='true']");
  const labelInput = app.querySelector("[data-pattern-author-evidence-label='true']");
  const excerptInput = app.querySelector("[data-pattern-author-evidence-excerpt='true']");
  const interpretationInput = app.querySelector(
    "[data-pattern-author-evidence-interpretation='true']"
  );
  assert.ok(evidenceForm);
  assert.ok(labelInput);
  assert.ok(excerptInput);
  assert.ok(interpretationInput);

  installFormReset(evidenceForm);
  labelInput.value = labelText;
  excerptInput.value = excerptText;
  interpretationInput.value = interpretationText;
  submitForm(evidenceForm);
}

function submitArchiveSourceEvidence(
  app: PatternRoomFakeApp,
  sourceId: string,
  labelText: string,
  excerptText: string,
  interpretationText: string
): void {
  const evidenceForm = app.querySelector(`[data-pattern-archive-evidence-form='${sourceId}']`);
  const labelInput = app.querySelector(`[data-pattern-archive-evidence-label='${sourceId}']`);
  const excerptInput = app.querySelector(`[data-pattern-archive-evidence-excerpt='${sourceId}']`);
  const interpretationInput = app.querySelector(
    `[data-pattern-archive-evidence-interpretation='${sourceId}']`
  );
  assert.ok(evidenceForm);
  assert.ok(labelInput);
  assert.ok(excerptInput);
  assert.ok(interpretationInput);

  labelInput.value = labelText;
  excerptInput.value = excerptText;
  interpretationInput.value = interpretationText;
  submitForm(evidenceForm);
}

function searchArchiveSource(app: PatternRoomFakeApp, sourceId: string, query: string): void {
  const searchInput = app.querySelector(`[data-pattern-archive-source-search-input='${sourceId}']`);
  assert.ok(searchInput);
  searchInput.value = query;
  fireEvent(searchInput, "input");
}

function submitBoardLocalEdge(
  app: PatternRoomFakeApp,
  sourceId: string,
  edgeType: string,
  targetId: string,
  noteText: string
): void {
  const edgeForm = app.querySelector("[data-pattern-author-edge-form='true']");
  const sourceSelect = app.querySelector("[data-pattern-author-edge-source='true']");
  const edgeTypeSelect = app.querySelector("[data-pattern-author-edge-type='true']");
  const targetSelect = app.querySelector("[data-pattern-author-edge-target='true']");
  const noteInput = app.querySelector("[data-pattern-author-edge-note='true']");
  assert.ok(edgeForm);
  assert.ok(sourceSelect);
  assert.ok(edgeTypeSelect);
  assert.ok(targetSelect);
  assert.ok(noteInput);

  installFormReset(edgeForm);
  sourceSelect.value = sourceId;
  edgeTypeSelect.value = edgeType;
  targetSelect.value = targetId;
  noteInput.value = noteText;
  submitForm(edgeForm);
}

function clickBoardPin(app: PatternRoomFakeApp, pinId: string): void {
  const pin = app.querySelector(`[data-pattern-board-pin='${pinId}']`);
  assert.ok(pin);
  fireEvent(pin, "click");
}

function setWindowConfirm(handler: (message: string) => boolean): void {
  (globalThis as unknown as { window: { confirm: (message: string) => boolean } }).window.confirm =
    handler;
}

function createHostLoadedSnapshot(
  activeView: PatternFocusedViewId | "overview",
  noteText: string
): PatternRoomSessionSnapshot {
  const localState = createLocalState(PATTERN_ROOM_DOMAIN_MOCK);
  localState.addLocalNote(noteText);
  return createSnapshot(localState, activeView);
}

function readLatestSavePayload(
  environment: ReturnType<typeof createMinimalForgeUiEnvironment>
): Record<string, unknown> {
  const event = environment.sentEvents[environment.sentEvents.length - 1];
  assert.ok(event);
  assert.equal(event.command, PATTERN_ROOM_SAVE_COMMAND);
  return event.payload;
}

function assertPatternCaseReviewPreviewAvoidsVerdictLanguage(previewText: string): void {
  assert.doesNotMatch(previewText, /kanıtlandı|doğrulandı|nihai sonuç/i);
  assert.doesNotMatch(previewText, /kesin hüküm(?:dür|dir| olarak|:)/i);
  assert.match(previewText, /Kesin hüküm üretme\./);
}

function assertSnapshotLocalStateUnchanged(
  before: PatternRoomSessionSnapshot,
  after: PatternRoomSessionSnapshot
): void {
  assert.equal(after.activeView, before.activeView);
  assert.equal(after.schemaVersion, before.schemaVersion);
  assert.deepEqual(after.guards, before.guards);
  assert.deepEqual(after.overlay, before.overlay);
}

function assertSavePayloadIncludesLocalNode(
  payload: Record<string, unknown>,
  labelText: string
): PatternRoomSessionSnapshot {
  const snapshot = payload["snapshot"] as PatternRoomSessionSnapshot;
  assert.equal(snapshot.roomId, "pattern-room");
  assert.equal(
    snapshot.overlay.localAuthoredNodes.some((node) => node.label === labelText),
    true
  );
  return snapshot;
}

describe("snapshot and autosave", () => {
  void test("pattern-room installed UI renders overview hotspots and returns from focused views", async () => {
    const environment = createMinimalForgeUiEnvironment();
    const installedCopy = await createRoomInstalledCopy("pattern-room");

    try {
      await import(
        `${pathToFileURL(resolve(installedCopy.rootDir, "ui/index.js")).href}?smoke=${Date.now()}`
      );

      assert.equal(environment.readyPayload()?.["roomId"], "pattern-room");
      assert.equal(environment.readyPayload()?.["featureId"], "pattern-workbench");
      assert.ok(environment.app.querySelector("[data-pattern-view='overview']"));
      assert.match(readTreeText(environment.app), /Dünya’nın Şekli/);
      assert.match(readTreeText(environment.app), /İz Sürme Odası/);
      assert.match(readTreeText(environment.app), /Pattern Room/);

      const hotspots = environment.app.querySelectorAll("[data-pattern-hotspot]");
      assert.equal(hotspots.length, PATTERN_FOCUSED_VIEWS.length);

      for (const viewId of PATTERN_FOCUSED_VIEWS) {
        const hotspot = environment.app.querySelector(`[data-pattern-hotspot='${viewId}']`);
        assert.ok(hotspot);
        fireEvent(hotspot, "click");
        assert.ok(environment.app.querySelector(`[data-pattern-view='${viewId}']`));
        const focusedText = readTreeText(environment.app);

        if (viewId === "board") {
          assertTextIncludes(focusedText, [
            "Kanıt",
            "Analiz",
            "Yorum",
            "Belirsizlik",
            "Bağlantılar Rapor panelinde Yerel Bağlantılar bölümünde listelenir.",
          ]);
        }

        if (viewId === "archive") {
          assertTextIncludes(focusedText, [
            "Kitap / Metin",
            "Görsel kaynak",
            "Kişisel not",
            "Belirsiz kaynak",
          ]);
        }

        if (viewId === "tenth-man") {
          assertTextIncludes(focusedText, [
            "AI0 — Araştırmacı",
            "AI1 — Savunucu",
            "AI2 — 10. Adam / Karşıt",
            "US1 — Hakem / Uzak kullanıcı",
            "Yerel Simülasyon",
            "0 / 8",
          ]);
        }

        if (viewId === "report") {
          assertTextIncludes(focusedText, [
            "Kaynak Özeti",
            "Kanıt Notları",
            "Pano Notları",
            "Yerel Bağlantılar",
            "10. Adam İzleri",
            "Sonraki Araştırma Notları",
          ]);
        }

        const backButton = environment.app.querySelector("[data-pattern-back='true']");
        assert.ok(backButton);
        fireEvent(backButton, "click");
        assert.ok(environment.app.querySelector("[data-pattern-view='overview']"));
      }

      assert.deepEqual(environment.sentCommands, []);
    } finally {
      environment.restore();
      await installedCopy.cleanup();
    }
  });

  void test("pattern-room installed UI restores a loaded host snapshot", async () => {
    const environment = createMinimalForgeUiEnvironment();
    const installedCopy = await createRoomInstalledCopy("pattern-room");
    const snapshot = createHostLoadedSnapshot("report", "Restored host snapshot note");

    try {
      await import(
        `${pathToFileURL(resolve(installedCopy.rootDir, "ui/index.js")).href}?loaded=${Date.now()}`
      );

      environment.emitHostMessage({
        payload: { snapshot },
        type: PATTERN_ROOM_LOADED_EVENT,
      });

      assert.ok(environment.app.querySelector("[data-pattern-view='report']"));
      assertTextIncludes(readTreeText(environment.app), [
        "Sonraki Araştırma Notları",
        "Restored host snapshot note",
      ]);
      environment.runPendingTimers(2000);
      assert.deepEqual(environment.sentCommands, []);
      assert.deepEqual(environment.sentEvents, []);
    } finally {
      environment.restore();
      await installedCopy.cleanup();
    }
  });

  void test("pattern-room installed UI keeps the default state for a null loaded snapshot", async () => {
    const environment = createMinimalForgeUiEnvironment();
    const installedCopy = await createRoomInstalledCopy("pattern-room");

    try {
      await import(
        `${pathToFileURL(resolve(installedCopy.rootDir, "ui/index.js")).href}?loaded-null=${Date.now()}`
      );

      environment.emitHostMessage({
        payload: { snapshot: null },
        type: PATTERN_ROOM_LOADED_EVENT,
      });

      assert.ok(environment.app.querySelector("[data-pattern-view='overview']"));
      assert.match(readTreeText(environment.app), /Pattern Room/);
      assert.doesNotMatch(readTreeText(environment.app), /Restored host snapshot note/);
      environment.runPendingTimers(2000);
      assert.deepEqual(environment.sentCommands, []);
      assert.deepEqual(environment.sentEvents, []);
    } finally {
      environment.restore();
      await installedCopy.cleanup();
    }
  });

  void test("pattern-room installed UI rejects an invalid loaded snapshot without breaking state", async () => {
    const environment = createMinimalForgeUiEnvironment();
    const installedCopy = await createRoomInstalledCopy("pattern-room");

    try {
      await import(
        `${pathToFileURL(resolve(installedCopy.rootDir, "ui/index.js")).href}?loaded-invalid=${Date.now()}`
      );

      environment.emitHostMessage({
        payload: {
          snapshot: {
            activeView: "report",
            roomId: "pattern-room",
            schemaVersion: -1,
            topicId: PATTERN_ROOM_DOMAIN_MOCK.topic.id,
          },
        },
        type: PATTERN_ROOM_LOADED_EVENT,
      });

      assert.ok(environment.app.querySelector("[data-pattern-view='overview']"));
      assert.match(readTreeText(environment.app), /Pattern Room/);
      assert.doesNotMatch(readTreeText(environment.app), /Restored host snapshot note/);
      assert.deepEqual(environment.sentCommands, []);
      assert.deepEqual(environment.sentEvents, []);
    } finally {
      environment.restore();
      await installedCopy.cleanup();
    }
  });

  void test("pattern-room installed UI does not autosave local mutations before host load completes", async () => {
    const environment = createMinimalForgeUiEnvironment();
    const installedCopy = await createRoomInstalledCopy("pattern-room");

    try {
      await import(
        `${pathToFileURL(resolve(installedCopy.rootDir, "ui/index.js")).href}?autosave-gate=${Date.now()}`
      );

      openFocusedView(environment.app, "board");
      submitBoardLocalNode(environment.app, "Mutation before loaded event", "Pano mutation");
      environment.runPendingTimers(2000);

      assert.equal(environment.pendingTimerCount(), 0);
      assert.deepEqual(environment.sentCommands, []);
      assert.deepEqual(environment.sentEvents, []);
    } finally {
      environment.restore();
      await installedCopy.cleanup();
    }
  });

  void test("pattern-room installed UI debounces autosave after a null host load", async () => {
    const environment = createMinimalForgeUiEnvironment();
    const installedCopy = await createRoomInstalledCopy("pattern-room");

    try {
      await import(
        `${pathToFileURL(resolve(installedCopy.rootDir, "ui/index.js")).href}?autosave-null=${Date.now()}`
      );

      environment.emitHostMessage({
        payload: { snapshot: null },
        type: PATTERN_ROOM_LOADED_EVENT,
      });
      openFocusedView(environment.app, "board");
      submitBoardLocalNode(environment.app, "Autosaved after null load", "Pano autosave");

      assert.equal(environment.pendingTimerCount(), 1);
      environment.runPendingTimers(1999);
      assert.deepEqual(environment.sentCommands, []);

      environment.runPendingTimers(2000);
      assert.deepEqual(environment.sentCommands, [PATTERN_ROOM_SAVE_COMMAND]);
      const payload = readLatestSavePayload(environment);
      assert.equal(payload["flush"], undefined);
      assertSavePayloadIncludesLocalNode(payload, "Autosaved after null load");
    } finally {
      environment.restore();
      await installedCopy.cleanup();
    }
  });

  void test("pattern-room installed UI autosaves only user mutations after restoring a snapshot", async () => {
    const environment = createMinimalForgeUiEnvironment();
    const installedCopy = await createRoomInstalledCopy("pattern-room");
    const snapshot = createHostLoadedSnapshot("report", "Restored snapshot suppresses autosave");

    try {
      await import(
        `${pathToFileURL(resolve(installedCopy.rootDir, "ui/index.js")).href}?autosave-restore=${Date.now()}`
      );

      environment.emitHostMessage({
        payload: { snapshot },
        type: PATTERN_ROOM_LOADED_EVENT,
      });
      environment.runPendingTimers(2000);
      assert.deepEqual(environment.sentCommands, []);

      returnToOverview(environment.app);
      openFocusedView(environment.app, "board");
      submitBoardLocalNode(
        environment.app,
        "Mutation after restored snapshot",
        "Pano restored mutation"
      );
      environment.runPendingTimers(2000);

      assert.deepEqual(environment.sentCommands, [PATTERN_ROOM_SAVE_COMMAND]);
      const payload = readLatestSavePayload(environment);
      const savedSnapshot = assertSavePayloadIncludesLocalNode(
        payload,
        "Mutation after restored snapshot"
      );
      assert.equal(savedSnapshot.activeView, "board");
    } finally {
      environment.restore();
      await installedCopy.cleanup();
    }
  });

  void test("pattern-room installed UI coalesces fast autosave mutations into one save", async () => {
    const environment = createMinimalForgeUiEnvironment();
    const installedCopy = await createRoomInstalledCopy("pattern-room");

    try {
      await import(
        `${pathToFileURL(resolve(installedCopy.rootDir, "ui/index.js")).href}?autosave-coalesce=${Date.now()}`
      );

      environment.emitHostMessage({
        payload: { snapshot: null },
        type: PATTERN_ROOM_LOADED_EVENT,
      });
      openFocusedView(environment.app, "board");

      for (let index = 0; index < 5; index += 1) {
        submitBoardLocalNode(
          environment.app,
          `Fast autosave node ${index + 1}`,
          `Fast autosave content ${index + 1}`
        );
      }

      assert.equal(environment.pendingTimerCount(), 1);
      environment.runPendingTimers(2000);

      assert.deepEqual(environment.sentCommands, [PATTERN_ROOM_SAVE_COMMAND]);
      const payload = readLatestSavePayload(environment);
      const savedSnapshot = assertSavePayloadIncludesLocalNode(payload, "Fast autosave node 5");
      assert.equal(savedSnapshot.overlay.localAuthoredNodes.length, 5);
    } finally {
      environment.restore();
      await installedCopy.cleanup();
    }
  });

  void test("pattern-room installed UI flushes a pending autosave before unload", async () => {
    const environment = createMinimalForgeUiEnvironment();
    const installedCopy = await createRoomInstalledCopy("pattern-room");

    try {
      await import(
        `${pathToFileURL(resolve(installedCopy.rootDir, "ui/index.js")).href}?autosave-flush=${Date.now()}`
      );

      environment.emitHostMessage({
        payload: { snapshot: null },
        type: PATTERN_ROOM_LOADED_EVENT,
      });
      openFocusedView(environment.app, "board");
      submitBoardLocalNode(
        environment.app,
        "Flush before unload node",
        "Flush before unload content"
      );

      assert.equal(environment.pendingTimerCount(), 1);
      environment.emitWindowEvent("beforeunload");

      assert.equal(environment.pendingTimerCount(), 0);
      assert.deepEqual(environment.sentCommands, [PATTERN_ROOM_SAVE_COMMAND]);
      const payload = readLatestSavePayload(environment);
      assert.equal(payload["flush"], true);
      assertSavePayloadIncludesLocalNode(payload, "Flush before unload node");

      environment.runPendingTimers(2000);
      assert.deepEqual(environment.sentCommands, [PATTERN_ROOM_SAVE_COMMAND]);
    } finally {
      environment.restore();
      await installedCopy.cleanup();
    }
  });

  void test("pattern-room installed UI dispose flushes pending autosave and disconnects listeners", async () => {
    const environment = createMinimalForgeUiEnvironment();
    const installedCopy = await createRoomInstalledCopy("pattern-room");
    const originalWarn = console.warn;
    const warnings: string[] = [];

    try {
      const runtimeModule = (await import(
        `${pathToFileURL(resolve(installedCopy.rootDir, "ui/pattern-room-ui-runtime.js")).href}?autosave-dispose=${Date.now()}`
      )) as PatternRoomUiRuntimeModule;
      const runtime = runtimeModule.createPatternRoomUiRuntime();

      runtime.start();
      assert.equal(environment.hasHostMessageHandler(), true);
      assert.equal(environment.windowListenerCount("beforeunload"), 1);

      environment.emitHostMessage({
        payload: { snapshot: null },
        type: PATTERN_ROOM_LOADED_EVENT,
      });
      openFocusedView(environment.app, "board");
      submitBoardLocalNode(environment.app, "Dispose flush node", "Dispose flush content");

      assert.equal(environment.pendingTimerCount(), 1);
      runtime.dispose();

      assert.equal(environment.pendingTimerCount(), 0);
      assert.equal(environment.hasHostMessageHandler(), false);
      assert.equal(environment.windowListenerCount("beforeunload"), 0);
      assert.deepEqual(environment.sentCommands, [PATTERN_ROOM_SAVE_COMMAND]);
      const payload = readLatestSavePayload(environment);
      assert.equal(payload["flush"], true);
      assertSavePayloadIncludesLocalNode(payload, "Dispose flush node");

      console.warn = (...args: unknown[]): void => {
        warnings.push(args.map(String).join(" "));
      };
      environment.emitHostMessage({
        payload: {
          error: "Pattern Room disposed listener should not receive this.",
          success: false,
        },
        type: PATTERN_ROOM_SAVE_FAILED_EVENT,
      });
      environment.emitWindowEvent("beforeunload");

      assert.deepEqual(warnings, []);
      assert.deepEqual(environment.sentCommands, [PATTERN_ROOM_SAVE_COMMAND]);
    } finally {
      console.warn = originalWarn;
      environment.restore();
      await installedCopy.cleanup();
    }
  });

  void test("pattern-room installed UI handles save-failed host events without status UI", async () => {
    const environment = createMinimalForgeUiEnvironment();
    const installedCopy = await createRoomInstalledCopy("pattern-room");
    const originalWarn = console.warn;
    const warnings: string[] = [];

    try {
      await import(
        `${pathToFileURL(resolve(installedCopy.rootDir, "ui/index.js")).href}?save-failed=${Date.now()}`
      );

      console.warn = (...args: unknown[]): void => {
        warnings.push(args.map(String).join(" "));
      };

      environment.emitHostMessage({
        payload: { snapshot: null },
        type: PATTERN_ROOM_LOADED_EVENT,
      });
      environment.emitHostMessage({
        payload: {
          error: "Pattern Room test save failed.",
          success: false,
        },
        type: PATTERN_ROOM_SAVE_FAILED_EVENT,
      });

      assert.ok(environment.app.querySelector("[data-pattern-view='overview']"));
      assert.deepEqual(warnings, ["Pattern Room test save failed."]);
      assert.doesNotMatch(readTreeText(environment.app), /save failed/i);
      assert.deepEqual(environment.sentCommands, []);
      assert.deepEqual(environment.sentEvents, []);
    } finally {
      console.warn = originalWarn;
      environment.restore();
      await installedCopy.cleanup();
    }
  });
});

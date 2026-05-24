import {
  assert,
  createMinimalForgeUiEnvironment,
  createRoomInstalledCopy,
  fireEvent,
  pathToFileURL,
  readTreeText,
  resolve,
  test,
} from "./forge-room-ui-smoke.helpers.ts";
import { adaptDomainToViewModels } from "../../rooms/pattern-room/shared/adapters/pattern-room-view-adapters.ts";
import { PATTERN_ROOM_DOMAIN_MOCK } from "../../rooms/pattern-room/shared/data/pattern-room-domain.mock.ts";
import { createLocalState } from "../../rooms/pattern-room/shared/state/pattern-room-local-state.ts";
import {
  createSnapshot,
  restoreFromSnapshot,
} from "../../rooms/pattern-room/shared/state/pattern-room-snapshot.ts";
import {
  PATTERN_ROOM_LOADED_EVENT,
  PATTERN_ROOM_SAVE_COMMAND,
  PATTERN_ROOM_SAVE_FAILED_EVENT,
} from "../../rooms/pattern-room/shared/types/pattern-room-persistence.ts";
import {
  PATTERN_ROOM_SNAPSHOT_VERSION,
  type PatternRoomSessionSnapshot,
} from "../../rooms/pattern-room/shared/types/pattern-room-snapshot.ts";
import { createArchivePanel } from "../../rooms/pattern-room/ui/panels/pattern-archive-panel.ts";
import type { PatternPanelActions } from "../../rooms/pattern-room/shared/types/pattern-room.ts";

const PATTERN_FOCUSED_VIEWS = ["board", "desk", "archive", "tenth-man", "report"] as const;
type PatternFocusedViewId = (typeof PATTERN_FOCUSED_VIEWS)[number];
type PatternRoomUiEnvironment = ReturnType<typeof createMinimalForgeUiEnvironment>;
type PatternRoomFakeApp = PatternRoomUiEnvironment["app"];
type PatternRoomUiRuntimeModule = {
  createPatternRoomUiRuntime: () => {
    dispose: () => void;
    start: () => void;
  };
};

function assertTextIncludes(text: string, expectedValues: string[]): void {
  expectedValues.forEach((expectedValue) => {
    assert.match(text, new RegExp(expectedValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });
}

function openFocusedView(
  app: ReturnType<typeof createMinimalForgeUiEnvironment>["app"],
  viewId: PatternFocusedViewId
): void {
  const hotspot = app.querySelector(`[data-pattern-hotspot='${viewId}']`);
  assert.ok(hotspot);
  fireEvent(hotspot, "click");
  assert.ok(app.querySelector(`[data-pattern-view='${viewId}']`));
}

function returnToOverview(app: ReturnType<typeof createMinimalForgeUiEnvironment>["app"]): void {
  const backButton = app.querySelector("[data-pattern-back='true']");
  assert.ok(backButton);
  fireEvent(backButton, "click");
  assert.ok(app.querySelector("[data-pattern-view='overview']"));
}

function installFormReset(form: { reset?: () => void }): void {
  form.reset = () => {};
}

function submitForm(form: {
  eventListeners: Map<string, Array<(event?: Record<string, unknown>) => void>>;
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

function submitLocalNote(
  app: ReturnType<typeof createMinimalForgeUiEnvironment>["app"],
  noteText: string
): void {
  const noteInput = app.querySelector("[data-pattern-local-note-input='true']");
  const noteForm = app.querySelector("[data-pattern-local-note-form='true']");
  assert.ok(noteInput);
  assert.ok(noteForm);
  noteInput.value = noteText;
  fireEvent(noteForm, "submit");
}

function submitUserTextSource(
  app: ReturnType<typeof createMinimalForgeUiEnvironment>["app"],
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
  (globalThis.window as unknown as { confirm: (message: string) => boolean }).confirm = handler;
}

function createHostLoadedSnapshot(
  activeView: PatternFocusedViewId | "overview",
  noteText: string
): PatternRoomSessionSnapshot {
  const localState = createLocalState(PATTERN_ROOM_DOMAIN_MOCK);
  localState.addLocalNote(noteText);
  return createSnapshot(localState, activeView);
}

function readLatestSavePayload(environment: PatternRoomUiEnvironment): Record<string, unknown> {
  const event = environment.sentEvents[environment.sentEvents.length - 1];
  assert.ok(event);
  assert.equal(event.command, PATTERN_ROOM_SAVE_COMMAND);
  return event.payload;
}

function assertSavePayloadIncludesNote(
  payload: Record<string, unknown>,
  noteText: string
): PatternRoomSessionSnapshot {
  const snapshot = payload["snapshot"] as PatternRoomSessionSnapshot;
  assert.ok(snapshot);
  assert.equal(snapshot.roomId, "pattern-room");
  assert.equal(
    snapshot.overlay.localNotes.some((note) => note.text === noteText),
    true
  );
  return snapshot;
}

test("pattern-room installed UI renders overview hotspots and returns from focused views", async () => {
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
          "Kanıt İzleri",
          "Analiz İzleri",
          "Belirsizlik İzleri",
          "Sonraki araştırma notları",
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

test("pattern-room installed UI restores a loaded host snapshot", async () => {
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
      "Yerel Notlar",
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

test("pattern-room installed UI keeps the default state for a null loaded snapshot", async () => {
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

test("pattern-room installed UI rejects an invalid loaded snapshot without breaking state", async () => {
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
    assert.doesNotMatch(readTreeText(environment.app), /Yerel Notlar/);
    assert.deepEqual(environment.sentCommands, []);
    assert.deepEqual(environment.sentEvents, []);
  } finally {
    environment.restore();
    await installedCopy.cleanup();
  }
});

test("pattern-room installed UI does not autosave local mutations before host load completes", async () => {
  const environment = createMinimalForgeUiEnvironment();
  const installedCopy = await createRoomInstalledCopy("pattern-room");

  try {
    await import(
      `${pathToFileURL(resolve(installedCopy.rootDir, "ui/index.js")).href}?autosave-gate=${Date.now()}`
    );

    openFocusedView(environment.app, "report");
    submitLocalNote(environment.app, "Mutation before loaded event");
    environment.runPendingTimers(2000);

    assert.equal(environment.pendingTimerCount(), 0);
    assert.deepEqual(environment.sentCommands, []);
    assert.deepEqual(environment.sentEvents, []);
  } finally {
    environment.restore();
    await installedCopy.cleanup();
  }
});

test("pattern-room installed UI debounces autosave after a null host load", async () => {
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
    openFocusedView(environment.app, "report");
    submitLocalNote(environment.app, "Autosaved after null load");

    assert.equal(environment.pendingTimerCount(), 1);
    environment.runPendingTimers(1999);
    assert.deepEqual(environment.sentCommands, []);

    environment.runPendingTimers(2000);
    assert.deepEqual(environment.sentCommands, [PATTERN_ROOM_SAVE_COMMAND]);
    const payload = readLatestSavePayload(environment);
    assert.equal(payload["flush"], undefined);
    assertSavePayloadIncludesNote(payload, "Autosaved after null load");
  } finally {
    environment.restore();
    await installedCopy.cleanup();
  }
});

test("pattern-room installed UI autosaves only user mutations after restoring a snapshot", async () => {
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

    submitLocalNote(environment.app, "Mutation after restored snapshot");
    environment.runPendingTimers(2000);

    assert.deepEqual(environment.sentCommands, [PATTERN_ROOM_SAVE_COMMAND]);
    const payload = readLatestSavePayload(environment);
    const savedSnapshot = assertSavePayloadIncludesNote(
      payload,
      "Mutation after restored snapshot"
    );
    assert.equal(savedSnapshot.activeView, "report");
  } finally {
    environment.restore();
    await installedCopy.cleanup();
  }
});

test("pattern-room installed UI coalesces fast autosave mutations into one save", async () => {
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
    openFocusedView(environment.app, "report");

    for (let index = 0; index < 5; index += 1) {
      submitLocalNote(environment.app, `Fast autosave note ${index + 1}`);
    }

    assert.equal(environment.pendingTimerCount(), 1);
    environment.runPendingTimers(2000);

    assert.deepEqual(environment.sentCommands, [PATTERN_ROOM_SAVE_COMMAND]);
    const payload = readLatestSavePayload(environment);
    const savedSnapshot = assertSavePayloadIncludesNote(payload, "Fast autosave note 5");
    assert.equal(savedSnapshot.overlay.localNotes.length, 5);
  } finally {
    environment.restore();
    await installedCopy.cleanup();
  }
});

test("pattern-room installed UI flushes a pending autosave before unload", async () => {
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
    openFocusedView(environment.app, "report");
    submitLocalNote(environment.app, "Flush before unload note");

    assert.equal(environment.pendingTimerCount(), 1);
    environment.emitWindowEvent("beforeunload");

    assert.equal(environment.pendingTimerCount(), 0);
    assert.deepEqual(environment.sentCommands, [PATTERN_ROOM_SAVE_COMMAND]);
    const payload = readLatestSavePayload(environment);
    assert.equal(payload["flush"], true);
    assertSavePayloadIncludesNote(payload, "Flush before unload note");

    environment.runPendingTimers(2000);
    assert.deepEqual(environment.sentCommands, [PATTERN_ROOM_SAVE_COMMAND]);
  } finally {
    environment.restore();
    await installedCopy.cleanup();
  }
});

test("pattern-room installed UI dispose flushes pending autosave and disconnects listeners", async () => {
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
    openFocusedView(environment.app, "report");
    submitLocalNote(environment.app, "Dispose flush note");

    assert.equal(environment.pendingTimerCount(), 1);
    runtime.dispose();

    assert.equal(environment.pendingTimerCount(), 0);
    assert.equal(environment.hasHostMessageHandler(), false);
    assert.equal(environment.windowListenerCount("beforeunload"), 0);
    assert.deepEqual(environment.sentCommands, [PATTERN_ROOM_SAVE_COMMAND]);
    const payload = readLatestSavePayload(environment);
    assert.equal(payload["flush"], true);
    assertSavePayloadIncludesNote(payload, "Dispose flush note");

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

test("pattern-room installed UI handles save-failed host events without status UI", async () => {
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

test("pattern-room installed UI supports phase 4B local interactions without host commands", async () => {
  const environment = createMinimalForgeUiEnvironment();
  const installedCopy = await createRoomInstalledCopy("pattern-room");

  try {
    await import(
      `${pathToFileURL(resolve(installedCopy.rootDir, "ui/index.js")).href}?local=${Date.now()}`
    );

    openFocusedView(environment.app, "board");
    const boardNode = environment.app.querySelector(
      "[data-pattern-board-pin='node-navigation-source']"
    );
    assert.ok(boardNode);
    fireEvent(boardNode, "click");
    assertTextIncludes(readTreeText(environment.app), [
      "Pano detayı",
      "Seyir defteri kaynagi",
      "Uzun rota gozlemlerini temsil eden arka plan kaynak karti.",
    ]);

    const sendToDesk = environment.app.querySelector(
      "[data-pattern-send-to-desk='node-navigation-source']"
    );
    assert.ok(sendToDesk);
    fireEvent(sendToDesk, "click");

    const addBoardNodeToDebate = environment.app.querySelector(
      "[data-pattern-add-node-debate='node-navigation-source']"
    );
    assert.ok(addBoardNodeToDebate);
    fireEvent(addBoardNodeToDebate, "click");

    returnToOverview(environment.app);
    openFocusedView(environment.app, "desk");
    assertTextIncludes(readTreeText(environment.app), [
      "Seyir defteri kaynagi",
      "Yerel masaya gönderildi",
    ]);

    returnToOverview(environment.app);
    openFocusedView(environment.app, "archive");
    const inspectSource = environment.app.querySelector(
      "[data-pattern-inspect-source='source-shadow-comparison']"
    );
    assert.ok(inspectSource);
    fireEvent(inspectSource, "click");
    assertTextIncludes(readTreeText(environment.app), [
      "Kaynak Detayı",
      "Golge karsilastirma gorseli",
      "Tür: Görsel kaynak",
      "Köken: Yerel temsilî görsel inceleme",
      "Durum: mocked",
      "Doğrulanmamış; kaynak origin: Yerel temsilî görsel inceleme.",
    ]);

    const pinSource = environment.app.querySelector(
      "[data-pattern-pin-source='source-shadow-comparison']"
    );
    assert.ok(pinSource);
    fireEvent(pinSource, "click");

    const addArchiveSourceToDebate = environment.app.querySelector(
      "[data-pattern-add-source-debate='source-shadow-comparison']"
    );
    assert.ok(addArchiveSourceToDebate);
    fireEvent(addArchiveSourceToDebate, "click");

    returnToOverview(environment.app);
    openFocusedView(environment.app, "board");
    assertTextIncludes(readTreeText(environment.app), ["Golge karsilastirma gorseli"]);

    returnToOverview(environment.app);
    openFocusedView(environment.app, "tenth-man");
    assertTextIncludes(readTreeText(environment.app), [
      "10. Adam referans listesi",
      "Seyir defteri kaynagi",
      "Golge karsilastirma gorseli",
    ]);

    returnToOverview(environment.app);
    openFocusedView(environment.app, "report");
    const noteInput = environment.app.querySelector("[data-pattern-local-note-input='true']");
    const noteForm = environment.app.querySelector("[data-pattern-local-note-form='true']");
    assert.ok(noteInput);
    assert.ok(noteForm);
    noteInput.value = "Bu sadece local overlay notudur";
    fireEvent(noteForm, "submit");
    assertTextIncludes(readTreeText(environment.app), [
      "Yerel Notlar",
      "Bu sadece local overlay notudur",
    ]);

    assert.deepEqual(environment.sentCommands, []);
    assert.deepEqual(environment.sentEvents, []);
  } finally {
    environment.restore();
    await installedCopy.cleanup();
  }
});

test("pattern-room installed UI phase 7C board node authoring form submits claims and guards blanks", async () => {
  const beforeDomain = JSON.stringify(PATTERN_ROOM_DOMAIN_MOCK);
  const environment = createMinimalForgeUiEnvironment();
  const installedCopy = await createRoomInstalledCopy("pattern-room");

  try {
    await import(
      `${pathToFileURL(resolve(installedCopy.rootDir, "ui/index.js")).href}?author-node=${Date.now()}`
    );

    openFocusedView(environment.app, "board");

    const initialPinCount = environment.app.querySelectorAll("[data-pattern-board-pin]").length;
    const nodeForm = environment.app.querySelector("[data-pattern-author-node-form='true']");
    const nodeType = environment.app.querySelector("[data-pattern-author-node-type='true']");
    const labelInput = environment.app.querySelector("[data-pattern-author-node-label='true']");
    const contentInput = environment.app.querySelector("[data-pattern-author-node-content='true']");
    assert.ok(nodeForm);
    assert.ok(nodeType);
    assert.ok(labelInput);
    assert.ok(contentInput);

    installFormReset(nodeForm);
    labelInput.value = " ";
    contentInput.value = "";
    submitForm(nodeForm);

    assert.equal(
      environment.app.querySelectorAll("[data-pattern-board-pin]").length,
      initialPinCount
    );
    assert.doesNotMatch(readTreeText(environment.app), /Faz 7C iddia/);

    const submittedNodeForm = environment.app.querySelector(
      "[data-pattern-author-node-form='true']"
    );
    const submittedNodeType = environment.app.querySelector(
      "[data-pattern-author-node-type='true']"
    );
    const submittedLabelInput = environment.app.querySelector(
      "[data-pattern-author-node-label='true']"
    );
    const submittedContentInput = environment.app.querySelector(
      "[data-pattern-author-node-content='true']"
    );
    assert.ok(submittedNodeForm);
    assert.ok(submittedNodeType);
    assert.ok(submittedLabelInput);
    assert.ok(submittedContentInput);

    installFormReset(submittedNodeForm);
    submittedNodeType.value = "claim";
    submittedLabelInput.value = "Faz 7C iddia";
    submittedContentInput.value = "DOM submit ile eklenen local iddia.";
    submitForm(submittedNodeForm);

    assert.ok(environment.app.querySelector("[data-pattern-board-pin='local-node-001']"));
    assertTextIncludes(readTreeText(environment.app), ["Faz 7C iddia"]);

    returnToOverview(environment.app);
    openFocusedView(environment.app, "desk");
    assertTextIncludes(readTreeText(environment.app), [
      "Faz 7C iddia",
      "DOM submit ile eklenen local iddia.",
    ]);

    assert.equal(JSON.stringify(PATTERN_ROOM_DOMAIN_MOCK), beforeDomain);
    assert.deepEqual(environment.sentCommands, []);
    assert.deepEqual(environment.sentEvents, []);
  } finally {
    environment.restore();
    await installedCopy.cleanup();
  }
});

test("pattern-room installed UI phase 7C board evidence form reaches board and report", async () => {
  const beforeDomain = JSON.stringify(PATTERN_ROOM_DOMAIN_MOCK);
  const environment = createMinimalForgeUiEnvironment();
  const installedCopy = await createRoomInstalledCopy("pattern-room");

  try {
    await import(
      `${pathToFileURL(resolve(installedCopy.rootDir, "ui/index.js")).href}?author-evidence=${Date.now()}`
    );

    openFocusedView(environment.app, "board");

    const evidenceForm = environment.app.querySelector(
      "[data-pattern-author-evidence-form='true']"
    );
    const labelInput = environment.app.querySelector("[data-pattern-author-evidence-label='true']");
    const excerptInput = environment.app.querySelector(
      "[data-pattern-author-evidence-excerpt='true']"
    );
    const interpretationInput = environment.app.querySelector(
      "[data-pattern-author-evidence-interpretation='true']"
    );
    assert.ok(evidenceForm);
    assert.ok(labelInput);
    assert.ok(excerptInput);
    assert.ok(interpretationInput);

    installFormReset(evidenceForm);
    labelInput.value = "Faz 7C kanıt";
    excerptInput.value = "DOM submit ile eklenen local alıntı.";
    interpretationInput.value = "Evidence layer guard yorumu.";
    submitForm(evidenceForm);

    assert.ok(environment.app.querySelector("[data-pattern-board-pin='local-evidence-001']"));
    assertTextIncludes(readTreeText(environment.app), ["Faz 7C kanıt"]);

    returnToOverview(environment.app);
    openFocusedView(environment.app, "report");
    assertTextIncludes(readTreeText(environment.app), [
      "Yerel Kanıt Notları",
      "Faz 7C kanıt",
      "DOM submit ile eklenen local alıntı.",
    ]);

    assert.equal(JSON.stringify(PATTERN_ROOM_DOMAIN_MOCK), beforeDomain);
    assert.deepEqual(environment.sentCommands, []);
    assert.deepEqual(environment.sentEvents, []);
  } finally {
    environment.restore();
    await installedCopy.cleanup();
  }
});

test("pattern-room installed UI phase 8B board connection form reaches report only", async () => {
  const beforeDomain = JSON.stringify(PATTERN_ROOM_DOMAIN_MOCK);
  const environment = createMinimalForgeUiEnvironment();
  const installedCopy = await createRoomInstalledCopy("pattern-room");

  try {
    await import(
      `${pathToFileURL(resolve(installedCopy.rootDir, "ui/index.js")).href}?author-edge=${Date.now()}`
    );

    openFocusedView(environment.app, "board");

    const initialPinCount = environment.app.querySelectorAll("[data-pattern-board-pin]").length;
    const edgeForm = environment.app.querySelector("[data-pattern-author-edge-form='true']");
    const sourceSelect = environment.app.querySelector("[data-pattern-author-edge-source='true']");
    const edgeTypeSelect = environment.app.querySelector("[data-pattern-author-edge-type='true']");
    const targetSelect = environment.app.querySelector("[data-pattern-author-edge-target='true']");
    const noteInput = environment.app.querySelector("[data-pattern-author-edge-note='true']");
    assert.ok(edgeForm);
    assert.ok(sourceSelect);
    assert.ok(edgeTypeSelect);
    assert.ok(targetSelect);
    assert.ok(noteInput);

    installFormReset(edgeForm);
    sourceSelect.value = "node-navigation-source";
    edgeTypeSelect.value = "supports";
    targetSelect.value = "node-navigation-source";
    submitForm(edgeForm);
    assert.equal(
      environment.app.querySelectorAll("[data-pattern-board-pin]").length,
      initialPinCount
    );

    sourceSelect.value = "node-navigation-source";
    edgeTypeSelect.value = "supports";
    targetSelect.value = "source-shadow-comparison";
    noteInput.value = "DOM smoke connection note.";
    submitForm(edgeForm);
    assert.equal(
      environment.app.querySelectorAll("[data-pattern-board-pin]").length,
      initialPinCount
    );

    returnToOverview(environment.app);
    openFocusedView(environment.app, "report");
    assertTextIncludes(readTreeText(environment.app), [
      "Yerel Bağlantılar",
      "Seyir defteri kaynagi",
      "destekliyor",
      "Golge karsilastirma gorseli",
    ]);

    assert.equal(JSON.stringify(PATTERN_ROOM_DOMAIN_MOCK), beforeDomain);
    assert.deepEqual(environment.sentCommands, []);
    assert.deepEqual(environment.sentEvents, []);
  } finally {
    environment.restore();
    await installedCopy.cleanup();
  }
});

test("pattern-room installed UI phase 7C archive source authoring form submits local sources", async () => {
  const beforeDomain = JSON.stringify(PATTERN_ROOM_DOMAIN_MOCK);
  const environment = createMinimalForgeUiEnvironment();
  const installedCopy = await createRoomInstalledCopy("pattern-room");

  try {
    await import(
      `${pathToFileURL(resolve(installedCopy.rootDir, "ui/index.js")).href}?author-source=${Date.now()}`
    );

    openFocusedView(environment.app, "archive");

    const sourceForm = environment.app.querySelector("[data-pattern-author-source-form='true']");
    const labelInput = environment.app.querySelector("[data-pattern-author-source-label='true']");
    const originInput = environment.app.querySelector("[data-pattern-author-source-origin='true']");
    const noteInput = environment.app.querySelector("[data-pattern-author-source-note='true']");
    assert.ok(sourceForm);
    assert.ok(labelInput);
    assert.ok(originInput);
    assert.ok(noteInput);

    installFormReset(sourceForm);
    labelInput.value = "Faz 7C kaynak";
    originInput.value = "DOM smoke defteri";
    noteInput.value = "Archive formundan eklenen local kaynak.";
    submitForm(sourceForm);

    assertTextIncludes(readTreeText(environment.app), [
      "Faz 7C kaynak",
      "Yerel Kaynak",
      "Archive formundan eklenen local kaynak.",
    ]);

    assert.equal(JSON.stringify(PATTERN_ROOM_DOMAIN_MOCK), beforeDomain);
    assert.deepEqual(environment.sentCommands, []);
    assert.deepEqual(environment.sentEvents, []);
  } finally {
    environment.restore();
    await installedCopy.cleanup();
  }
});

test("pattern-room installed UI phase 12D imports pasted user text through the source producer", async () => {
  const beforeDomain = JSON.stringify(PATTERN_ROOM_DOMAIN_MOCK);
  const environment = createMinimalForgeUiEnvironment();
  const installedCopy = await createRoomInstalledCopy("pattern-room");

  try {
    await import(
      `${pathToFileURL(resolve(installedCopy.rootDir, "ui/index.js")).href}?user-text-source=${Date.now()}`
    );

    environment.emitHostMessage({
      payload: { snapshot: null },
      type: PATTERN_ROOM_LOADED_EVENT,
    });
    openFocusedView(environment.app, "archive");
    submitUserTextSource(
      environment.app,
      "Faz 12D kullanıcı metni",
      "Kullanıcının yapıştırdığı metin kaynak producer hattından gelir."
    );

    assert.ok(environment.app.querySelector("[data-pattern-archive-source='local-source-001']"));
    assertTextIncludes(readTreeText(environment.app), [
      "Kaynak Atölyesi",
      "Bu ilk sürüm metni kaynak olarak ekler; alıntı ve örüntü çıkarımı daha sonra eklenecek.",
      "Metin kaynak olarak odaya eklendi: 1 kaynak, 0 kanıt, 0 düğüm.",
      "Faz 12D kullanıcı metni",
      "Yerel Kaynak",
      "Kullanıcının yapıştırdığı metin kaynak producer hattından gelir.",
    ]);
    assert.equal(environment.pendingTimerCount(), 1);

    const inspectUserTextSource = environment.app.querySelector(
      "[data-pattern-inspect-source='local-source-001']"
    );
    assert.ok(inspectUserTextSource);
    fireEvent(inspectUserTextSource, "click");
    assert.equal(
      environment.app.querySelector("[data-pattern-archive-source-segments='local-source-001']"),
      null
    );
    assert.equal(environment.pendingTimerCount(), 1);

    environment.runPendingTimers(2000);
    assert.deepEqual(environment.sentCommands, [PATTERN_ROOM_SAVE_COMMAND]);
    const savedSnapshot = readLatestSavePayload(environment)[
      "snapshot"
    ] as PatternRoomSessionSnapshot;
    assert.equal(savedSnapshot.overlay.localAuthoredSources.length, 1);
    assert.equal(savedSnapshot.overlay.localAuthoredSources[0]?.label, "Faz 12D kullanıcı metni");
    assert.equal(savedSnapshot.overlay.localAuthoredSources[0]?.origin, "Kullanıcı metni");
    assert.equal(
      savedSnapshot.overlay.localAuthoredSources[0]?.note,
      "Kullanıcının yapıştırdığı metin kaynak producer hattından gelir."
    );
    assert.deepEqual(savedSnapshot.overlay.localAuthoredEvidence, []);
    assert.deepEqual(savedSnapshot.overlay.localAuthoredNodes, []);
    assert.deepEqual(savedSnapshot.overlay.pinnedSourceIds, []);
    assert.deepEqual(savedSnapshot.overlay.sourcePinnedLayerById, {});

    submitUserTextSource(
      environment.app,
      "Faz 12D kullanıcı metni",
      "Kullanıcının yapıştırdığı metin kaynak producer hattından gelir."
    );
    assertTextIncludes(readTreeText(environment.app), ["Bu metin zaten odada kayıtlı görünüyor."]);
    assert.equal(
      environment.app.querySelectorAll("[data-pattern-archive-source='local-source-001']").length,
      1
    );
    assert.equal(environment.pendingTimerCount(), 0);
    assert.deepEqual(environment.sentCommands, [PATTERN_ROOM_SAVE_COMMAND]);

    assert.equal(JSON.stringify(PATTERN_ROOM_DOMAIN_MOCK), beforeDomain);
  } finally {
    environment.restore();
    await installedCopy.cleanup();
  }
});

test("pattern-room installed UI phase 12D derives a source title from untitled user text", async () => {
  const environment = createMinimalForgeUiEnvironment();
  const installedCopy = await createRoomInstalledCopy("pattern-room");

  try {
    await import(
      `${pathToFileURL(resolve(installedCopy.rootDir, "ui/index.js")).href}?user-text-title=${Date.now()}`
    );

    openFocusedView(environment.app, "archive");
    submitUserTextSource(
      environment.app,
      "",
      "Başlıksız metnin ilk satırı başlık olur.\nİkinci satır kaynak notunda kalır."
    );

    assertTextIncludes(readTreeText(environment.app), [
      "Başlıksız metnin ilk satırı başlık olur.",
      "Metin kaynak olarak odaya eklendi: 1 kaynak, 0 kanıt, 0 düğüm.",
    ]);
    assert.ok(environment.app.querySelector("[data-pattern-archive-source='local-source-001']"));
    assert.deepEqual(environment.sentCommands, []);
    assert.deepEqual(environment.sentEvents, []);
  } finally {
    environment.restore();
    await installedCopy.cleanup();
  }
});

test("pattern-room installed UI phase 12D rejects blank pasted user text", async () => {
  const environment = createMinimalForgeUiEnvironment();
  const installedCopy = await createRoomInstalledCopy("pattern-room");

  try {
    await import(
      `${pathToFileURL(resolve(installedCopy.rootDir, "ui/index.js")).href}?user-text-empty=${Date.now()}`
    );

    environment.emitHostMessage({
      payload: { snapshot: null },
      type: PATTERN_ROOM_LOADED_EVENT,
    });
    openFocusedView(environment.app, "archive");
    submitUserTextSource(environment.app, "Boş kaynak", " \n\t ");

    assertTextIncludes(readTreeText(environment.app), ["Metin boş olamaz."]);
    assert.equal(
      environment.app.querySelector("[data-pattern-archive-source='local-source-001']"),
      null
    );
    assert.equal(environment.pendingTimerCount(), 0);
    assert.deepEqual(environment.sentCommands, []);
    assert.deepEqual(environment.sentEvents, []);
  } finally {
    environment.restore();
    await installedCopy.cleanup();
  }
});

test("pattern-room installed UI phase 13C imports long text as a source only", async () => {
  const beforeDomain = JSON.stringify(PATTERN_ROOM_DOMAIN_MOCK);
  const environment = createMinimalForgeUiEnvironment();
  const installedCopy = await createRoomInstalledCopy("pattern-room");
  const longText =
    "Birinci bölüm uzun arşiv metninin ilk parçasıdır. Bu parça yalnızca kaynak gövdesinde tutulur. Kart görünümü bu metnin tamamını basmamalı; çünkü kaynak kartı arşivde kompakt kalmalı, çalışma yüzeyini uzatmamalı ve yalnızca kısa bir önizleme göstermelidir.\n\n" +
    "İkinci bölüm segment sayısını görünür kılar. Bu aşamada alıntı veya örüntü çıkarımı yapılmaz. TAM_METIN_GIZLI_KUYRUK";
  const segmentTexts = longText.split("\n\n");
  const firstSegmentText = segmentTexts[0] ?? "";
  const secondSegmentText = segmentTexts[1] ?? "";
  const expectedExcerpt = `${longText.replace(/\s+/g, " ").trim().slice(0, 240).trimEnd()}…`;

  try {
    await import(
      `${pathToFileURL(resolve(installedCopy.rootDir, "ui/index.js")).href}?long-text-source=${Date.now()}`
    );

    environment.emitHostMessage({
      payload: { snapshot: null },
      type: PATTERN_ROOM_LOADED_EVENT,
    });
    openFocusedView(environment.app, "archive");

    assert.ok(environment.app.querySelector("[data-pattern-long-text-source-form='true']"));
    assertTextIncludes(readTreeText(environment.app), [
      "Uzun Metin / Kitap / Arşiv Ekle",
      "Bu aşamada metin yalnızca kaynak olarak eklenir; alıntı ve örüntü çıkarımı daha sonra yapılır.",
    ]);

    submitLongTextSource(environment.app, {
      title: "Faz 13C uzun metin",
      origin: "Makale arşivi",
      sourceKind: "article",
      chapter: "Bölüm I",
      page: "s. 12-13",
      text: longText,
    });

    assert.ok(environment.app.querySelector("[data-pattern-archive-source='local-source-001']"));
    assertTextIncludes(readTreeText(environment.app), [
      "Uzun metin kaynak olarak eklendi: 2 segment.",
      "Faz 13C uzun metin",
      "Yerel Kaynak",
      expectedExcerpt,
    ]);
    const archiveText = readTreeText(environment.app);
    assert.equal(archiveText.includes(longText), false);
    assert.doesNotMatch(archiveText, /TAM_METIN_GIZLI_KUYRUK/);
    assertTextIncludes(archiveText, ["Kaynak Detayı", "Bir kaynak seç"]);
    assert.equal(environment.pendingTimerCount(), 1);

    const preview = environment.app.querySelector(
      "[data-pattern-archive-source-preview='local-source-001']"
    );
    const inspectLongTextSource = environment.app.querySelector(
      "[data-pattern-inspect-source='local-source-001']"
    );
    assert.ok(preview);
    assert.ok(inspectLongTextSource);
    assert.equal(preview.textContent, expectedExcerpt);
    assert.doesNotMatch(preview.textContent, /TAM_METIN_GIZLI_KUYRUK/);
    fireEvent(inspectLongTextSource, "click");

    const detailText = environment.app.querySelector(
      "[data-pattern-archive-source-full-text='local-source-001']"
    );
    assert.ok(detailText);
    assert.equal(detailText.textContent, longText);
    assertTextIncludes(readTreeText(environment.app), [
      "Kaynak Detayı",
      "Faz 13C uzun metin",
      "Tür: Yerel Kaynak",
      "Köken: Makale arşivi",
      "Durum: local",
      "Segmentler",
      "Birinci bölüm uzun arşiv metninin ilk parçasıdır.",
      "İkinci bölüm segment sayısını görünür kılar.",
      "TAM_METIN_GIZLI_KUYRUK",
    ]);
    const firstSegmentButton = environment.app.querySelector(
      "[data-pattern-archive-source-segment='segment-001']"
    );
    const secondSegmentButton = environment.app.querySelector(
      "[data-pattern-archive-source-segment='segment-002']"
    );
    const selectedSegmentText = environment.app.querySelector(
      "[data-pattern-archive-source-segment-text='local-source-001']"
    );
    const selectedSegmentDetail = environment.app.querySelector(
      "[data-pattern-archive-source-segment-detail='local-source-001']"
    );
    assert.ok(firstSegmentButton);
    assert.ok(secondSegmentButton);
    assert.ok(selectedSegmentText);
    assert.ok(selectedSegmentDetail);
    fireEvent(firstSegmentButton, "click");
    assert.equal(firstSegmentButton.dataset["patternArchiveSourceSegmentSelected"], "true");
    assert.equal(secondSegmentButton.dataset["patternArchiveSourceSegmentSelected"], "false");
    assert.equal(selectedSegmentDetail.dataset["patternArchiveSelectedSegment"], "segment-001");
    assert.equal(selectedSegmentText.textContent, firstSegmentText);
    assert.equal(environment.pendingTimerCount(), 1);
    fireEvent(secondSegmentButton, "click");
    assert.equal(firstSegmentButton.dataset["patternArchiveSourceSegmentSelected"], "false");
    assert.equal(secondSegmentButton.dataset["patternArchiveSourceSegmentSelected"], "true");
    assert.equal(selectedSegmentDetail.dataset["patternArchiveSelectedSegment"], "segment-002");
    assert.equal(selectedSegmentText.textContent, secondSegmentText);
    assert.equal(environment.pendingTimerCount(), 1);
    const selectedCard = environment.app.querySelector(
      "[data-pattern-archive-source='local-source-001']"
    );
    assert.ok(selectedCard);
    assert.equal(selectedCard.dataset["patternArchiveSourceSelected"], "true");
    assert.equal(environment.pendingTimerCount(), 1);

    environment.runPendingTimers(2000);
    assert.deepEqual(environment.sentCommands, [PATTERN_ROOM_SAVE_COMMAND]);
    const savedSnapshot = readLatestSavePayload(environment)[
      "snapshot"
    ] as PatternRoomSessionSnapshot;
    assert.equal(savedSnapshot.schemaVersion, PATTERN_ROOM_SNAPSHOT_VERSION);
    assert.equal(savedSnapshot.overlay.localAuthoredSources.length, 1);
    assert.equal(savedSnapshot.overlay.localAuthoredSources[0]?.label, "Faz 13C uzun metin");
    assert.equal(savedSnapshot.overlay.localAuthoredSources[0]?.origin, "Makale arşivi");
    assert.equal(savedSnapshot.overlay.localAuthoredSources[0]?.note, longText);
    assert.deepEqual(
      savedSnapshot.overlay.localAuthoredSources[0]?.segments?.map((segment) => {
        return segment.id;
      }),
      ["segment-001", "segment-002"]
    );
    assert.deepEqual(savedSnapshot.overlay.localAuthoredEvidence, []);
    assert.deepEqual(savedSnapshot.overlay.localAuthoredNodes, []);
    assert.deepEqual(savedSnapshot.overlay.localAuthoredEdges, []);
    assert.deepEqual(savedSnapshot.overlay.pinnedSourceIds, []);
    assert.deepEqual(savedSnapshot.overlay.sourcePinnedLayerById, {});
    const restored = restoreFromSnapshot(savedSnapshot, PATTERN_ROOM_DOMAIN_MOCK);
    assert.ok(restored);
    assert.equal(restored.overlay.localAuthoredSources[0]?.label, "Faz 13C uzun metin");

    returnToOverview(environment.app);
    openFocusedView(environment.app, "board");
    assert.equal(
      environment.app.querySelector("[data-pattern-board-pin='local-source-001']"),
      null
    );

    returnToOverview(environment.app);
    openFocusedView(environment.app, "report");
    const reportText = readTreeText(environment.app);
    assert.doesNotMatch(reportText, /Faz 13C uzun metin/);
    assert.doesNotMatch(reportText, /Yerel Kanıt Notları/);
    assert.doesNotMatch(reportText, /Yerel Bağlantılar/);
    assert.equal(JSON.stringify(PATTERN_ROOM_DOMAIN_MOCK), beforeDomain);
  } finally {
    environment.restore();
    await installedCopy.cleanup();
  }
});

test("pattern-room archive source card renders compact preview metadata when provided", () => {
  const environment = createMinimalForgeUiEnvironment();

  try {
    const data = adaptDomainToViewModels(PATTERN_ROOM_DOMAIN_MOCK);
    data.sources = [
      {
        id: "local-source-meta",
        label: "Deneme",
        sourceTypeLabel: "Yerel Kaynak",
        origin: "Test",
        status: "local",
        note: "Tam içerik state tarafında korunur; kart yalnızca kısa önizlemeyi gösterir.",
        notePreview: "Tam içerik state tarafında korunur…",
        metadataLine: "Segment: 1 · Karakter: 640",
        isLocal: true,
      },
    ];

    const panel = createArchivePanel(data, {} as PatternPanelActions, () => {});
    environment.app.append(panel as unknown as PatternRoomFakeApp);

    assert.ok(
      environment.app.querySelector("[data-pattern-archive-source-preview='local-source-meta']")
    );
    assert.ok(
      environment.app.querySelector("[data-pattern-archive-source-meta='local-source-meta']")
    );
    assertTextIncludes(readTreeText(environment.app), [
      "Deneme",
      "Yerel Kaynak",
      "Test",
      "Tam içerik state tarafında korunur…",
      "Segment: 1 · Karakter: 640",
    ]);
  } finally {
    environment.restore();
  }
});

test("pattern-room installed UI phase 13F captures manual evidence from source detail", async () => {
  const environment = createMinimalForgeUiEnvironment();
  const installedCopy = await createRoomInstalledCopy("pattern-room");
  const confirmMessages: string[] = [];
  const longText =
    "Faz 13F kaynak metni kullanıcı tarafından incelenir ve kart üzerinde kısa önizleme olarak kalır. " +
    "Kanıt pasajı otomatik çıkarılmaz; kullanıcı pasajı manuel olarak forma yazar. " +
    "Bu uzun kaynak metninin saklı kuyruk bölümü sadece detay alanında görünmelidir. SOURCE_DETAIL_SECRET_TAIL";
  const expectedExcerpt = `${longText.replace(/\s+/g, " ").trim().slice(0, 240).trimEnd()}…`;

  try {
    await import(
      `${pathToFileURL(resolve(installedCopy.rootDir, "ui/index.js")).href}?source-evidence=${Date.now()}`
    );

    environment.emitHostMessage({
      payload: { snapshot: null },
      type: PATTERN_ROOM_LOADED_EVENT,
    });
    openFocusedView(environment.app, "archive");
    assert.equal(environment.app.querySelector("[data-pattern-archive-evidence-capture]"), null);

    submitLongTextSource(environment.app, {
      title: "Faz 13F uzun kaynak",
      origin: "Manuel kanıt arşivi",
      sourceKind: "archive_text",
      text: longText,
    });
    environment.runPendingTimers(2000);

    const sourceOnlySnapshot = readLatestSavePayload(environment)[
      "snapshot"
    ] as PatternRoomSessionSnapshot;
    assert.equal(sourceOnlySnapshot.schemaVersion, PATTERN_ROOM_SNAPSHOT_VERSION);
    assert.equal(sourceOnlySnapshot.overlay.localAuthoredSources.length, 1);
    assert.deepEqual(sourceOnlySnapshot.overlay.localAuthoredEvidence, []);
    assert.deepEqual(sourceOnlySnapshot.overlay.localAuthoredNodes, []);
    assert.deepEqual(sourceOnlySnapshot.overlay.localAuthoredEdges, []);
    assert.deepEqual(sourceOnlySnapshot.overlay.pinnedSourceIds, []);

    const inspectLongTextSource = environment.app.querySelector(
      "[data-pattern-inspect-source='local-source-001']"
    );
    assert.ok(inspectLongTextSource);
    fireEvent(inspectLongTextSource, "click");

    assert.ok(
      environment.app.querySelector("[data-pattern-archive-evidence-form='local-source-001']")
    );
    assertTextIncludes(readTreeText(environment.app), [
      "Bu kaynaktan kanıt notu oluştur",
      "Bu işlem otomatik analiz yapmaz; seçtiğin pasajı yerel kanıt notu olarak panoya ekler.",
    ]);

    submitArchiveSourceEvidence(environment.app, "local-source-001", "", "Manuel pasaj", "");
    assertTextIncludes(readTreeText(environment.app), ["Kanıt başlığı boş olamaz."]);
    assert.equal(environment.pendingTimerCount(), 0);

    submitArchiveSourceEvidence(environment.app, "local-source-001", "Kaynak pasajı", "", "");
    assertTextIncludes(readTreeText(environment.app), ["Alıntı boş olamaz."]);
    assert.equal(environment.pendingTimerCount(), 0);

    submitArchiveSourceEvidence(
      environment.app,
      "local-source-001",
      "Kaynak pasajı",
      "Kullanıcı tarafından seçilen manuel kanıt pasajı.",
      "Pasajın bağlamı manuel olarak yazıldı."
    );
    assertTextIncludes(readTreeText(environment.app), ["Kanıt notu panoya eklendi."]);
    assert.equal(environment.pendingTimerCount(), 1);

    const preview = environment.app.querySelector(
      "[data-pattern-archive-source-preview='local-source-001']"
    );
    const detailText = environment.app.querySelector(
      "[data-pattern-archive-source-full-text='local-source-001']"
    );
    assert.ok(preview);
    assert.ok(detailText);
    assert.equal(preview.textContent, expectedExcerpt);
    assert.doesNotMatch(preview.textContent, /SOURCE_DETAIL_SECRET_TAIL/);
    assert.equal(detailText.textContent, longText);

    returnToOverview(environment.app);
    openFocusedView(environment.app, "board");
    assert.ok(environment.app.querySelector("[data-pattern-board-pin='local-evidence-001']"));
    assert.equal(
      environment.app.querySelector("[data-pattern-board-pin='local-source-001']"),
      null
    );
    clickBoardPin(environment.app, "local-evidence-001");
    assertTextIncludes(readTreeText(environment.app), [
      "Kaynak pasajı",
      "Kullanıcı tarafından seçilen manuel kanıt pasajı.",
      "Pasajın bağlamı manuel olarak yazıldı.",
      "Faz 13F uzun kaynak",
    ]);

    returnToOverview(environment.app);
    openFocusedView(environment.app, "report");
    const reportText = readTreeText(environment.app);
    assertTextIncludes(reportText, [
      "Yerel Kanıt Notları",
      "Kaynak pasajı: Kullanıcı tarafından seçilen manuel kanıt pasajı. Kaynak: Faz 13F uzun kaynak Yorum: Pasajın bağlamı manuel olarak yazıldı.",
    ]);
    assert.doesNotMatch(reportText, /Yerel Bağlantılar/);

    environment.runPendingTimers(2000);
    const captureSnapshot = readLatestSavePayload(environment)[
      "snapshot"
    ] as PatternRoomSessionSnapshot;
    assert.equal(captureSnapshot.schemaVersion, PATTERN_ROOM_SNAPSHOT_VERSION);
    assert.equal(captureSnapshot.overlay.localAuthoredEvidence.length, 1);
    assert.equal(captureSnapshot.overlay.localAuthoredEvidence[0]?.sourceId, "local-source-001");
    assert.equal(
      captureSnapshot.overlay.localAuthoredEvidence[0]?.sourceLabel,
      "Faz 13F uzun kaynak"
    );
    assert.deepEqual(captureSnapshot.overlay.localAuthoredNodes, []);
    assert.deepEqual(captureSnapshot.overlay.localAuthoredEdges, []);
    assert.deepEqual(captureSnapshot.overlay.pinnedSourceIds, []);
    const restored = restoreFromSnapshot(captureSnapshot, PATTERN_ROOM_DOMAIN_MOCK);
    assert.ok(restored);
    assert.equal(restored.overlay.localAuthoredEvidence[0]?.sourceId, "local-source-001");
    assert.equal(restored.overlay.localAuthoredEvidence[0]?.sourceLabel, "Faz 13F uzun kaynak");

    returnToOverview(environment.app);
    openFocusedView(environment.app, "archive");
    const removeLocalSource = environment.app.querySelector(
      "[data-pattern-remove-local-source='local-source-001']"
    );
    assert.ok(removeLocalSource);
    setWindowConfirm((message) => {
      confirmMessages.push(message);
      return true;
    });
    fireEvent(removeLocalSource, "click");
    assert.deepEqual(confirmMessages, ["Bu yerel kaynak odadan kaldırılacak. Devam edilsin mi?"]);
    assert.equal(
      environment.app.querySelector("[data-pattern-archive-source='local-source-001']"),
      null
    );
    assert.equal(environment.app.querySelector("[data-pattern-archive-evidence-capture]"), null);

    returnToOverview(environment.app);
    openFocusedView(environment.app, "board");
    assert.equal(
      environment.app.querySelector("[data-pattern-board-pin='local-evidence-001']"),
      null
    );

    environment.runPendingTimers(2000);
    const removedSnapshot = readLatestSavePayload(environment)[
      "snapshot"
    ] as PatternRoomSessionSnapshot;
    assert.deepEqual(removedSnapshot.overlay.localAuthoredSources, []);
    assert.deepEqual(removedSnapshot.overlay.localAuthoredEvidence, []);
  } finally {
    environment.restore();
    await installedCopy.cleanup();
  }
});

test("pattern-room installed UI phase 14B-2 prepares manual evidence from a selected source segment", async () => {
  const environment = createMinimalForgeUiEnvironment();
  const installedCopy = await createRoomInstalledCopy("pattern-room");
  const longText =
    "Segment bir kanıt pasajı kullanıcı tarafından ayrıca seçilir ve otomatik kanıt üretmez. " +
    "Bu pasaj formu sadece hazırlama butonuyla doldurmalıdır.\n\n" +
    "Segment iki ikinci pasaj olarak kaynak detayında kalır ve tek başına pano kanıtı oluşturmaz.";
  const firstSegmentText = longText.split("\n\n")[0] ?? "";
  const firstSegmentLabel = firstSegmentText.replace(/\s+/g, " ").trim().slice(0, 80);

  try {
    await import(
      `${pathToFileURL(resolve(installedCopy.rootDir, "ui/index.js")).href}?source-segment-evidence=${Date.now()}`
    );

    environment.emitHostMessage({
      payload: { snapshot: null },
      type: PATTERN_ROOM_LOADED_EVENT,
    });
    openFocusedView(environment.app, "archive");
    submitLongTextSource(environment.app, {
      title: "Faz 14B-2 segment kaynağı",
      origin: "Segment kanıt arşivi",
      sourceKind: "archive_text",
      text: longText,
    });
    environment.runPendingTimers(2000);

    const sourceOnlySnapshot = readLatestSavePayload(environment)[
      "snapshot"
    ] as PatternRoomSessionSnapshot;
    assert.equal(sourceOnlySnapshot.schemaVersion, PATTERN_ROOM_SNAPSHOT_VERSION);
    assert.deepEqual(sourceOnlySnapshot.overlay.localAuthoredEvidence, []);
    assert.deepEqual(sourceOnlySnapshot.overlay.localAuthoredNodes, []);
    assert.deepEqual(sourceOnlySnapshot.overlay.localAuthoredEdges, []);

    const inspectLongTextSource = environment.app.querySelector(
      "[data-pattern-inspect-source='local-source-001']"
    );
    assert.ok(inspectLongTextSource);
    fireEvent(inspectLongTextSource, "click");

    const firstSegmentButton = environment.app.querySelector(
      "[data-pattern-archive-source-segment='segment-001']"
    );
    const prepareEvidenceButton = environment.app.querySelector(
      "[data-pattern-archive-prepare-segment-evidence='local-source-001']"
    );
    const evidenceForm = environment.app.querySelector(
      "[data-pattern-archive-evidence-form='local-source-001']"
    );
    const labelInput = environment.app.querySelector(
      "[data-pattern-archive-evidence-label='local-source-001']"
    );
    const excerptInput = environment.app.querySelector(
      "[data-pattern-archive-evidence-excerpt='local-source-001']"
    );
    const interpretationInput = environment.app.querySelector(
      "[data-pattern-archive-evidence-interpretation='local-source-001']"
    );
    assert.ok(firstSegmentButton);
    assert.ok(prepareEvidenceButton);
    assert.ok(evidenceForm);
    assert.ok(labelInput);
    assert.ok(excerptInput);
    assert.ok(interpretationInput);
    assert.equal(prepareEvidenceButton.disabled, true);
    assert.equal(environment.app.querySelector("[data-pattern-archive-source-search]"), null);

    fireEvent(firstSegmentButton, "click");
    assert.equal(firstSegmentButton.dataset["patternArchiveSourceSegmentSelected"], "true");
    assert.equal(labelInput.value, "");
    assert.equal(excerptInput.value, "");
    assert.equal(interpretationInput.value, "");
    assert.equal(prepareEvidenceButton.disabled, false);
    assert.equal(environment.pendingTimerCount(), 0);

    returnToOverview(environment.app);
    openFocusedView(environment.app, "board");
    assert.equal(
      environment.app.querySelector("[data-pattern-board-pin='local-evidence-001']"),
      null
    );
    assert.equal(
      environment.app.querySelector("[data-pattern-board-pin='local-source-001']"),
      null
    );

    returnToOverview(environment.app);
    openFocusedView(environment.app, "archive");
    const inspectPreparedSource = environment.app.querySelector(
      "[data-pattern-inspect-source='local-source-001']"
    );
    assert.ok(inspectPreparedSource);
    fireEvent(inspectPreparedSource, "click");
    const firstSegmentButtonAfterBoardCheck = environment.app.querySelector(
      "[data-pattern-archive-source-segment='segment-001']"
    );
    const prepareEvidenceButtonAfterBoardCheck = environment.app.querySelector(
      "[data-pattern-archive-prepare-segment-evidence='local-source-001']"
    );
    const evidenceFormAfterBoardCheck = environment.app.querySelector(
      "[data-pattern-archive-evidence-form='local-source-001']"
    );
    const labelInputAfterBoardCheck = environment.app.querySelector(
      "[data-pattern-archive-evidence-label='local-source-001']"
    );
    const excerptInputAfterBoardCheck = environment.app.querySelector(
      "[data-pattern-archive-evidence-excerpt='local-source-001']"
    );
    const interpretationInputAfterBoardCheck = environment.app.querySelector(
      "[data-pattern-archive-evidence-interpretation='local-source-001']"
    );
    assert.ok(firstSegmentButtonAfterBoardCheck);
    assert.ok(prepareEvidenceButtonAfterBoardCheck);
    assert.ok(evidenceFormAfterBoardCheck);
    assert.ok(labelInputAfterBoardCheck);
    assert.ok(excerptInputAfterBoardCheck);
    assert.ok(interpretationInputAfterBoardCheck);

    fireEvent(firstSegmentButtonAfterBoardCheck, "click");
    fireEvent(prepareEvidenceButtonAfterBoardCheck, "click");
    assert.equal(labelInputAfterBoardCheck.value, firstSegmentLabel);
    assert.equal(excerptInputAfterBoardCheck.value, firstSegmentText);
    assert.equal(interpretationInputAfterBoardCheck.value, "");
    assert.equal(environment.pendingTimerCount(), 0);

    labelInputAfterBoardCheck.value = "Düzenlenmiş segment kanıtı";
    excerptInputAfterBoardCheck.value = "Kısaltılmış segment pasajı.";
    interpretationInputAfterBoardCheck.value = "Kullanıcı yorumu sonradan yazıldı.";
    submitForm(evidenceFormAfterBoardCheck);
    assertTextIncludes(readTreeText(environment.app), ["Kanıt notu panoya eklendi."]);
    assert.equal(environment.pendingTimerCount(), 1);

    returnToOverview(environment.app);
    openFocusedView(environment.app, "board");
    assert.ok(environment.app.querySelector("[data-pattern-board-pin='local-evidence-001']"));
    assert.equal(
      environment.app.querySelector("[data-pattern-board-pin='local-source-001']"),
      null
    );
    clickBoardPin(environment.app, "local-evidence-001");
    assertTextIncludes(readTreeText(environment.app), [
      "Düzenlenmiş segment kanıtı",
      "Kısaltılmış segment pasajı.",
      "Kullanıcı yorumu sonradan yazıldı.",
      "Faz 14B-2 segment kaynağı",
    ]);

    returnToOverview(environment.app);
    openFocusedView(environment.app, "report");
    assertTextIncludes(readTreeText(environment.app), [
      "Yerel Kanıt Notları",
      "Düzenlenmiş segment kanıtı: Kısaltılmış segment pasajı. Kaynak: Faz 14B-2 segment kaynağı Yorum: Kullanıcı yorumu sonradan yazıldı.",
    ]);

    environment.runPendingTimers(2000);
    assert.deepEqual(environment.sentCommands, [
      PATTERN_ROOM_SAVE_COMMAND,
      PATTERN_ROOM_SAVE_COMMAND,
    ]);
    const evidenceSnapshot = readLatestSavePayload(environment)[
      "snapshot"
    ] as PatternRoomSessionSnapshot;
    assert.equal(evidenceSnapshot.schemaVersion, PATTERN_ROOM_SNAPSHOT_VERSION);
    assert.equal(evidenceSnapshot.overlay.localAuthoredEvidence.length, 1);
    assert.equal(
      evidenceSnapshot.overlay.localAuthoredEvidence[0]?.label,
      "Düzenlenmiş segment kanıtı"
    );
    assert.equal(
      evidenceSnapshot.overlay.localAuthoredEvidence[0]?.excerpt,
      "Kısaltılmış segment pasajı."
    );
    assert.equal(
      evidenceSnapshot.overlay.localAuthoredEvidence[0]?.interpretation,
      "Kullanıcı yorumu sonradan yazıldı."
    );
    assert.equal(evidenceSnapshot.overlay.localAuthoredEvidence[0]?.sourceId, "local-source-001");
    assert.equal(
      evidenceSnapshot.overlay.localAuthoredEvidence[0]?.sourceLabel,
      "Faz 14B-2 segment kaynağı"
    );
    assert.deepEqual(evidenceSnapshot.overlay.localAuthoredNodes, []);
    assert.deepEqual(evidenceSnapshot.overlay.localAuthoredEdges, []);
    assert.deepEqual(evidenceSnapshot.overlay.pinnedSourceIds, []);
    const restored = restoreFromSnapshot(evidenceSnapshot, PATTERN_ROOM_DOMAIN_MOCK);
    assert.ok(restored);
    assert.equal(restored.overlay.localAuthoredEvidence[0]?.sourceId, "local-source-001");
    assert.equal(
      restored.overlay.localAuthoredEvidence[0]?.sourceLabel,
      "Faz 14B-2 segment kaynağı"
    );
  } finally {
    environment.restore();
    await installedCopy.cleanup();
  }
});

test("pattern-room installed UI phase 13C rejects blank long text fields", async () => {
  const environment = createMinimalForgeUiEnvironment();
  const installedCopy = await createRoomInstalledCopy("pattern-room");

  try {
    await import(
      `${pathToFileURL(resolve(installedCopy.rootDir, "ui/index.js")).href}?long-text-empty=${Date.now()}`
    );

    environment.emitHostMessage({
      payload: { snapshot: null },
      type: PATTERN_ROOM_LOADED_EVENT,
    });
    openFocusedView(environment.app, "archive");

    submitLongTextSource(environment.app, {
      title: " ",
      origin: "Arşiv kökeni",
      text: "Geçerli uzun metin.",
    });
    assertTextIncludes(readTreeText(environment.app), ["Başlık boş olamaz."]);
    assert.equal(
      environment.app.querySelector("[data-pattern-archive-source='local-source-001']"),
      null
    );

    submitLongTextSource(environment.app, {
      title: "Boş köken testi",
      origin: " ",
      text: "Geçerli uzun metin.",
    });
    assertTextIncludes(readTreeText(environment.app), ["Kaynak bilgisi boş olamaz."]);
    assert.equal(
      environment.app.querySelector("[data-pattern-archive-source='local-source-001']"),
      null
    );

    submitLongTextSource(environment.app, {
      title: "Boş metin testi",
      origin: "Arşiv kökeni",
      text: " \n\t ",
    });
    assertTextIncludes(readTreeText(environment.app), ["Metin boş olamaz."]);
    assert.equal(
      environment.app.querySelector("[data-pattern-archive-source='local-source-001']"),
      null
    );
    assert.equal(environment.pendingTimerCount(), 0);
    assert.deepEqual(environment.sentCommands, []);
    assert.deepEqual(environment.sentEvents, []);
  } finally {
    environment.restore();
    await installedCopy.cleanup();
  }
});

test("pattern-room installed UI phase 12G-A cancels local source removal safely", async () => {
  const beforeDomain = JSON.stringify(PATTERN_ROOM_DOMAIN_MOCK);
  const environment = createMinimalForgeUiEnvironment();
  const installedCopy = await createRoomInstalledCopy("pattern-room");
  const confirmMessages: string[] = [];

  try {
    await import(
      `${pathToFileURL(resolve(installedCopy.rootDir, "ui/index.js")).href}?remove-cancel=${Date.now()}`
    );

    environment.emitHostMessage({
      payload: { snapshot: null },
      type: PATTERN_ROOM_LOADED_EVENT,
    });
    openFocusedView(environment.app, "archive");
    submitUserTextSource(
      environment.app,
      "Kendi Metin Testi",
      "Kaldırma iptali için kullanıcı metni."
    );
    environment.runPendingTimers(2000);

    const removeLocalSource = environment.app.querySelector(
      "[data-pattern-remove-local-source='local-source-001']"
    );
    assert.ok(removeLocalSource);
    assert.equal(
      environment.app.querySelector(
        "[data-pattern-remove-local-source='source-shadow-comparison']"
      ),
      null
    );
    assertTextIncludes(readTreeText(environment.app), ["Kendi Metin Testi", "Kaynağı kaldır"]);

    setWindowConfirm((message) => {
      confirmMessages.push(message);
      return false;
    });
    fireEvent(removeLocalSource, "click");

    assert.deepEqual(confirmMessages, ["Bu yerel kaynak odadan kaldırılacak. Devam edilsin mi?"]);
    assert.ok(environment.app.querySelector("[data-pattern-archive-source='local-source-001']"));
    assert.equal(environment.pendingTimerCount(), 0);
    assert.deepEqual(environment.sentCommands, [PATTERN_ROOM_SAVE_COMMAND]);
    assert.equal(JSON.stringify(PATTERN_ROOM_DOMAIN_MOCK), beforeDomain);
  } finally {
    environment.restore();
    await installedCopy.cleanup();
  }
});

test("pattern-room installed UI phase 11D imports a mock SourcePackage from the archive demo", async () => {
  const beforeDomain = JSON.stringify(PATTERN_ROOM_DOMAIN_MOCK);
  const environment = createMinimalForgeUiEnvironment();
  const installedCopy = await createRoomInstalledCopy("pattern-room");

  try {
    await import(
      `${pathToFileURL(resolve(installedCopy.rootDir, "ui/index.js")).href}?source-import-demo=${Date.now()}`
    );

    environment.emitHostMessage({
      payload: { snapshot: null },
      type: PATTERN_ROOM_LOADED_EVENT,
    });
    openFocusedView(environment.app, "archive");

    const importButton = environment.app.querySelector(
      "[data-pattern-import-sample-source-package='true']"
    );
    assert.ok(importButton);
    fireEvent(importButton, "click");

    assert.ok(environment.app.querySelector("[data-pattern-archive-source='local-source-001']"));
    assert.ok(
      environment.app.querySelector("[data-pattern-remove-local-source='local-source-001']")
    );
    assertTextIncludes(readTreeText(environment.app), [
      "Kaynak Atölyesi",
      "Örnek Kaynak Paketini İçe Aktar",
      "Bu ilk sürüm metni kaynak olarak ekler; alıntı ve örüntü çıkarımı daha sonra eklenecek.",
      "Kaynak paketi odaya eklendi: 1 kaynak, 1 kanıt, 1 düğüm.",
      "Saha Defteri Alıntısı",
      "Yerel Kaynak",
    ]);
    assert.equal(environment.pendingTimerCount(), 1);

    environment.runPendingTimers(2000);
    assert.deepEqual(environment.sentCommands, [PATTERN_ROOM_SAVE_COMMAND]);
    const savedSnapshot = readLatestSavePayload(environment)[
      "snapshot"
    ] as PatternRoomSessionSnapshot;
    assert.equal(savedSnapshot.overlay.localAuthoredSources.length, 1);
    assert.equal(savedSnapshot.overlay.localAuthoredEvidence.length, 1);
    assert.equal(savedSnapshot.overlay.localAuthoredNodes.length, 1);
    assert.equal(savedSnapshot.overlay.localAuthoredEdges.length, 1);
    assert.equal(savedSnapshot.overlay.localNotes.length, 1);

    returnToOverview(environment.app);
    openFocusedView(environment.app, "board");
    assertTextIncludes(readTreeText(environment.app), ["Gölge yönü notu", "Tekrarlayan gölge izi"]);

    returnToOverview(environment.app);
    openFocusedView(environment.app, "report");
    assertTextIncludes(readTreeText(environment.app), [
      "Yerel Notlar",
      "Kaynak Atölyesi tarafından örnek bir saha notu paketi hazırlandı.",
      "Yerel Kanıt Notları",
      "Gölge yönü notu",
      "Yerel Bağlantılar",
      "Tekrarlayan gölge izi",
      "türetildi",
    ]);

    returnToOverview(environment.app);
    openFocusedView(environment.app, "archive");
    const duplicateImportButton = environment.app.querySelector(
      "[data-pattern-import-sample-source-package='true']"
    );
    assert.ok(duplicateImportButton);
    fireEvent(duplicateImportButton, "click");

    assertTextIncludes(readTreeText(environment.app), [
      "Bu kaynak paketi zaten odada kayıtlı görünüyor.",
    ]);
    assert.equal(
      environment.app.querySelectorAll("[data-pattern-archive-source='local-source-001']").length,
      1
    );

    assert.equal(JSON.stringify(PATTERN_ROOM_DOMAIN_MOCK), beforeDomain);
  } finally {
    environment.restore();
    await installedCopy.cleanup();
  }
});

test("pattern-room installed UI phase 12G-A removes confirmed local sources and cascades source-linked report links", async () => {
  const beforeDomain = JSON.stringify(PATTERN_ROOM_DOMAIN_MOCK);
  const environment = createMinimalForgeUiEnvironment();
  const installedCopy = await createRoomInstalledCopy("pattern-room");
  const confirmMessages: string[] = [];

  try {
    await import(
      `${pathToFileURL(resolve(installedCopy.rootDir, "ui/index.js")).href}?remove-accept=${Date.now()}`
    );

    environment.emitHostMessage({
      payload: { snapshot: null },
      type: PATTERN_ROOM_LOADED_EVENT,
    });
    openFocusedView(environment.app, "archive");
    submitUserTextSource(
      environment.app,
      "Kaynak Bağlantı Testi",
      "Silindiğinde bağlı yerel bağlantısı da kalkacak kaynak."
    );
    environment.runPendingTimers(2000);

    returnToOverview(environment.app);
    openFocusedView(environment.app, "board");
    const edgeForm = environment.app.querySelector("[data-pattern-author-edge-form='true']");
    const sourceSelect = environment.app.querySelector("[data-pattern-author-edge-source='true']");
    const edgeTypeSelect = environment.app.querySelector("[data-pattern-author-edge-type='true']");
    const targetSelect = environment.app.querySelector("[data-pattern-author-edge-target='true']");
    const noteInput = environment.app.querySelector("[data-pattern-author-edge-note='true']");
    assert.ok(edgeForm);
    assert.ok(sourceSelect);
    assert.ok(edgeTypeSelect);
    assert.ok(targetSelect);
    assert.ok(noteInput);
    installFormReset(edgeForm);
    sourceSelect.value = "local-source-001";
    edgeTypeSelect.value = "references";
    targetSelect.value = "node-navigation-source";
    noteInput.value = "Source-linked deletion smoke.";
    submitForm(edgeForm);
    environment.runPendingTimers(2000);

    returnToOverview(environment.app);
    openFocusedView(environment.app, "report");
    assertTextIncludes(readTreeText(environment.app), [
      "Yerel Bağlantılar",
      "Kaynak Bağlantı Testi",
      "referans veriyor",
      "Seyir defteri kaynagi",
    ]);

    returnToOverview(environment.app);
    openFocusedView(environment.app, "archive");
    const inspectLocalSource = environment.app.querySelector(
      "[data-pattern-inspect-source='local-source-001']"
    );
    assert.ok(inspectLocalSource);
    fireEvent(inspectLocalSource, "click");
    assertTextIncludes(readTreeText(environment.app), [
      "Kaynak Detayı",
      "Kaynak Bağlantı Testi",
      "Silindiğinde bağlı yerel bağlantısı da kalkacak kaynak.",
    ]);

    const removeLocalSource = environment.app.querySelector(
      "[data-pattern-remove-local-source='local-source-001']"
    );
    assert.ok(removeLocalSource);
    setWindowConfirm((message) => {
      confirmMessages.push(message);
      return true;
    });
    fireEvent(removeLocalSource, "click");

    assert.deepEqual(confirmMessages, ["Bu yerel kaynak odadan kaldırılacak. Devam edilsin mi?"]);
    assert.equal(
      environment.app.querySelector("[data-pattern-archive-source='local-source-001']"),
      null
    );
    assert.ok(
      environment.app.querySelector("[data-pattern-archive-source-detail-placeholder='true']")
    );
    assertTextIncludes(readTreeText(environment.app), ["Kaynak Detayı", "Bir kaynak seç"]);
    assert.equal(environment.pendingTimerCount(), 1);
    environment.runPendingTimers(2000);
    assert.deepEqual(environment.sentCommands, [
      PATTERN_ROOM_SAVE_COMMAND,
      PATTERN_ROOM_SAVE_COMMAND,
      PATTERN_ROOM_SAVE_COMMAND,
    ]);

    const savedSnapshot = readLatestSavePayload(environment)[
      "snapshot"
    ] as PatternRoomSessionSnapshot;
    assert.equal(savedSnapshot.overlay.localAuthoredSources.length, 0);
    assert.equal(savedSnapshot.overlay.localAuthoredEdges.length, 0);
    assert.deepEqual(savedSnapshot.overlay.pinnedSourceIds, []);
    assert.deepEqual(savedSnapshot.overlay.sourcePinnedLayerById, {});
    const restored = restoreFromSnapshot(savedSnapshot, PATTERN_ROOM_DOMAIN_MOCK);
    assert.ok(restored);
    assert.deepEqual(restored.overlay.localAuthoredSources, []);

    returnToOverview(environment.app);
    openFocusedView(environment.app, "report");
    assert.doesNotMatch(readTreeText(environment.app), /Yerel Bağlantılar/);
    assert.equal(JSON.stringify(PATTERN_ROOM_DOMAIN_MOCK), beforeDomain);
  } finally {
    environment.restore();
    await installedCopy.cleanup();
  }
});

test("pattern-room installed UI phase 12G-C removes selected local board nodes and evidence only", async () => {
  const beforeDomain = JSON.stringify(PATTERN_ROOM_DOMAIN_MOCK);
  const environment = createMinimalForgeUiEnvironment();
  const installedCopy = await createRoomInstalledCopy("pattern-room");
  const confirmMessages: string[] = [];
  const removeConfirm =
    "Bu yerel pano öğesi odadan kaldırılacak. Bağlı yerel bağlantılar da temizlenir. Devam edilsin mi?";

  try {
    await import(
      `${pathToFileURL(resolve(installedCopy.rootDir, "ui/index.js")).href}?board-item-remove=${Date.now()}`
    );

    environment.emitHostMessage({
      payload: { snapshot: null },
      type: PATTERN_ROOM_LOADED_EVENT,
    });
    openFocusedView(environment.app, "board");

    clickBoardPin(environment.app, "node-navigation-source");
    assert.equal(environment.app.querySelector("[data-pattern-remove-board-item]"), null);

    submitBoardLocalNode(
      environment.app,
      "Faz 12G-C iddia",
      "Board detail kaldırma testi için local iddia."
    );
    clickBoardPin(environment.app, "local-node-001");
    const cancelRemoveNode = environment.app.querySelector(
      "[data-pattern-remove-board-item='local-node-001']"
    );
    assert.ok(cancelRemoveNode);
    assert.equal(cancelRemoveNode.dataset["patternRemoveBoardItemKind"], "node");
    assertTextIncludes(readTreeText(environment.app), ["Öğeyi kaldır"]);
    const addNodeDebate = environment.app.querySelector(
      "[data-pattern-add-node-debate='local-node-001']"
    );
    assert.ok(addNodeDebate);
    fireEvent(addNodeDebate, "click");

    setWindowConfirm((message) => {
      confirmMessages.push(message);
      return false;
    });
    fireEvent(cancelRemoveNode, "click");
    assert.ok(environment.app.querySelector("[data-pattern-board-pin='local-node-001']"));
    assertTextIncludes(readTreeText(environment.app), ["Faz 12G-C iddia"]);

    clickBoardPin(environment.app, "node-navigation-source");
    assert.equal(environment.app.querySelector("[data-pattern-remove-board-item]"), null);

    submitBoardLocalEvidence(
      environment.app,
      "Faz 12G-C kanıt",
      "Board detail kaldırma testi için local kanıt.",
      "Silme sonrası rapordan düşmeli."
    );
    clickBoardPin(environment.app, "local-evidence-001");
    const removeEvidence = environment.app.querySelector(
      "[data-pattern-remove-board-item='local-evidence-001']"
    );
    assert.ok(removeEvidence);
    assert.equal(removeEvidence.dataset["patternRemoveBoardItemKind"], "evidence");
    const addEvidenceDebate = environment.app.querySelector(
      "[data-pattern-add-evidence-debate='local-evidence-001']"
    );
    assert.ok(addEvidenceDebate);
    fireEvent(addEvidenceDebate, "click");

    submitBoardLocalEdge(
      environment.app,
      "local-node-001",
      "derived_from",
      "local-evidence-001",
      "Board item deletion linked edge smoke."
    );
    environment.runPendingTimers(2000);

    returnToOverview(environment.app);
    openFocusedView(environment.app, "report");
    assertTextIncludes(readTreeText(environment.app), [
      "Yerel Kanıt Notları",
      "Faz 12G-C kanıt",
      "Yerel Bağlantılar",
      "Faz 12G-C iddia",
      "türetildi",
      "Faz 12G-C kanıt",
    ]);

    returnToOverview(environment.app);
    openFocusedView(environment.app, "tenth-man");
    assertTextIncludes(readTreeText(environment.app), ["Faz 12G-C iddia", "Faz 12G-C kanıt"]);

    returnToOverview(environment.app);
    openFocusedView(environment.app, "board");
    clickBoardPin(environment.app, "local-evidence-001");
    const acceptRemoveEvidence = environment.app.querySelector(
      "[data-pattern-remove-board-item='local-evidence-001']"
    );
    assert.ok(acceptRemoveEvidence);
    setWindowConfirm((message) => {
      confirmMessages.push(message);
      return true;
    });
    fireEvent(acceptRemoveEvidence, "click");

    assert.equal(
      environment.app.querySelector("[data-pattern-board-pin='local-evidence-001']"),
      null
    );
    assert.ok(environment.app.querySelector("[data-pattern-board-pin='local-node-001']"));
    assert.ok(environment.app.querySelector("[data-pattern-board-pin='node-navigation-source']"));
    environment.runPendingTimers(2000);

    const evidenceRemovedSnapshot = readLatestSavePayload(environment)[
      "snapshot"
    ] as PatternRoomSessionSnapshot;
    assert.equal(evidenceRemovedSnapshot.schemaVersion, PATTERN_ROOM_SNAPSHOT_VERSION);
    assert.equal(evidenceRemovedSnapshot.overlay.localAuthoredNodes.length, 1);
    assert.deepEqual(evidenceRemovedSnapshot.overlay.localAuthoredEvidence, []);
    assert.deepEqual(evidenceRemovedSnapshot.overlay.localAuthoredEdges, []);
    assert.equal(
      evidenceRemovedSnapshot.overlay.debateReferenceIds.includes("local-evidence-001"),
      false
    );
    assert.equal(
      evidenceRemovedSnapshot.overlay.debateReferenceIds.includes("local-node-001"),
      true
    );
    const evidenceRemovedRestored = restoreFromSnapshot(
      evidenceRemovedSnapshot,
      PATTERN_ROOM_DOMAIN_MOCK
    );
    assert.ok(evidenceRemovedRestored);
    assert.deepEqual(evidenceRemovedRestored.overlay.localAuthoredEvidence, []);
    assert.deepEqual(evidenceRemovedRestored.overlay.localAuthoredEdges, []);

    returnToOverview(environment.app);
    openFocusedView(environment.app, "report");
    const evidenceRemovedReportText = readTreeText(environment.app);
    assert.doesNotMatch(evidenceRemovedReportText, /Yerel Bağlantılar/);
    assert.doesNotMatch(evidenceRemovedReportText, /Faz 12G-C kanıt/);

    returnToOverview(environment.app);
    openFocusedView(environment.app, "tenth-man");
    const evidenceRemovedDebateText = readTreeText(environment.app);
    assertTextIncludes(evidenceRemovedDebateText, ["Faz 12G-C iddia"]);
    assert.doesNotMatch(evidenceRemovedDebateText, /Faz 12G-C kanıt/);

    returnToOverview(environment.app);
    openFocusedView(environment.app, "board");
    clickBoardPin(environment.app, "local-node-001");
    const acceptRemoveNode = environment.app.querySelector(
      "[data-pattern-remove-board-item='local-node-001']"
    );
    assert.ok(acceptRemoveNode);
    fireEvent(acceptRemoveNode, "click");

    assert.equal(environment.app.querySelector("[data-pattern-board-pin='local-node-001']"), null);
    assert.ok(environment.app.querySelector("[data-pattern-board-pin='node-navigation-source']"));
    environment.runPendingTimers(2000);

    const nodeRemovedSnapshot = readLatestSavePayload(environment)[
      "snapshot"
    ] as PatternRoomSessionSnapshot;
    assert.equal(nodeRemovedSnapshot.schemaVersion, PATTERN_ROOM_SNAPSHOT_VERSION);
    assert.deepEqual(nodeRemovedSnapshot.overlay.localAuthoredNodes, []);
    assert.deepEqual(nodeRemovedSnapshot.overlay.localAuthoredEvidence, []);
    assert.deepEqual(nodeRemovedSnapshot.overlay.localAuthoredEdges, []);
    assert.equal(nodeRemovedSnapshot.overlay.debateReferenceIds.includes("local-node-001"), false);
    const nodeRemovedRestored = restoreFromSnapshot(nodeRemovedSnapshot, PATTERN_ROOM_DOMAIN_MOCK);
    assert.ok(nodeRemovedRestored);
    assert.deepEqual(nodeRemovedRestored.overlay.localAuthoredNodes, []);
    assert.deepEqual(nodeRemovedRestored.overlay.localAuthoredEvidence, []);

    returnToOverview(environment.app);
    openFocusedView(environment.app, "tenth-man");
    const nodeRemovedDebateText = readTreeText(environment.app);
    assert.doesNotMatch(nodeRemovedDebateText, /Faz 12G-C iddia/);
    assert.doesNotMatch(nodeRemovedDebateText, /Faz 12G-C kanıt/);

    assert.deepEqual(confirmMessages, [removeConfirm, removeConfirm, removeConfirm]);
    assert.equal(JSON.stringify(PATTERN_ROOM_DOMAIN_MOCK), beforeDomain);
  } finally {
    environment.restore();
    await installedCopy.cleanup();
  }
});

test("pattern-room installed UI phase 12G-B resets the local session without touching domain data", async () => {
  const beforeDomain = JSON.stringify(PATTERN_ROOM_DOMAIN_MOCK);
  const environment = createMinimalForgeUiEnvironment();
  const installedCopy = await createRoomInstalledCopy("pattern-room");
  const confirmMessages: string[] = [];

  try {
    await import(
      `${pathToFileURL(resolve(installedCopy.rootDir, "ui/index.js")).href}?local-reset=${Date.now()}`
    );

    environment.emitHostMessage({
      payload: { snapshot: null },
      type: PATTERN_ROOM_LOADED_EVENT,
    });
    openFocusedView(environment.app, "archive");
    assertTextIncludes(readTreeText(environment.app), [
      "Yerel Oturum",
      "Yerel Oturumu Sıfırla",
      "Hazır konu verileri korunur.",
    ]);
    assert.equal(environment.app.querySelector("[data-pattern-remove-import-batch]"), null);

    const importButton = environment.app.querySelector(
      "[data-pattern-import-sample-source-package='true']"
    );
    assert.ok(importButton);
    fireEvent(importButton, "click");
    environment.runPendingTimers(2000);

    assert.ok(environment.app.querySelector("[data-pattern-archive-source='local-source-001']"));
    assert.ok(
      environment.app.querySelector("[data-pattern-archive-source='source-shadow-comparison']")
    );
    const addLocalSourceToDebate = environment.app.querySelector(
      "[data-pattern-add-source-debate='local-source-001']"
    );
    assert.ok(addLocalSourceToDebate);
    fireEvent(addLocalSourceToDebate, "click");

    returnToOverview(environment.app);
    openFocusedView(environment.app, "tenth-man");
    assertTextIncludes(readTreeText(environment.app), ["Saha Defteri Alıntısı"]);
    const prepare = environment.app.querySelector("[data-pattern-prepare-debate='true']");
    assert.ok(prepare);
    fireEvent(prepare, "click");
    const assign = environment.app.querySelector("[data-pattern-assign-debate-roles='true']");
    assert.ok(assign);
    fireEvent(assign, "click");
    const start = environment.app.querySelector("[data-pattern-start-debate='true']");
    assert.ok(start);
    fireEvent(start, "click");
    assertTextIncludes(readTreeText(environment.app), ["AI0 araştırmacı açılışı"]);
    environment.runPendingTimers(2000);
    assert.deepEqual(environment.sentCommands, [
      PATTERN_ROOM_SAVE_COMMAND,
      PATTERN_ROOM_SAVE_COMMAND,
    ]);

    returnToOverview(environment.app);
    openFocusedView(environment.app, "board");
    assertTextIncludes(readTreeText(environment.app), ["Gölge yönü notu", "Tekrarlayan gölge izi"]);

    returnToOverview(environment.app);
    openFocusedView(environment.app, "report");
    assertTextIncludes(readTreeText(environment.app), [
      "Yerel Notlar",
      "Kaynak Atölyesi tarafından örnek bir saha notu paketi hazırlandı.",
      "Yerel Kanıt Notları",
      "Gölge yönü notu",
      "Yerel Bağlantılar",
      "Tekrarlayan gölge izi",
    ]);

    returnToOverview(environment.app);
    openFocusedView(environment.app, "archive");
    const resetButton = environment.app.querySelector("[data-pattern-reset-local-session='true']");
    assert.ok(resetButton);
    setWindowConfirm((message) => {
      confirmMessages.push(message);
      return false;
    });
    fireEvent(resetButton, "click");

    assert.deepEqual(confirmMessages, [
      "Tüm yerel kaynaklar, notlar ve geçici tartışma izleri temizlenecek. Hazır konu verileri korunur. Devam edilsin mi?",
    ]);
    assert.ok(environment.app.querySelector("[data-pattern-archive-source='local-source-001']"));
    assert.equal(environment.pendingTimerCount(), 0);
    assert.deepEqual(environment.sentCommands, [
      PATTERN_ROOM_SAVE_COMMAND,
      PATTERN_ROOM_SAVE_COMMAND,
    ]);

    setWindowConfirm((message) => {
      confirmMessages.push(message);
      return true;
    });
    fireEvent(resetButton, "click");

    assert.equal(
      environment.app.querySelector("[data-pattern-archive-source='local-source-001']"),
      null
    );
    assert.ok(
      environment.app.querySelector("[data-pattern-archive-source='source-shadow-comparison']")
    );
    assert.equal(environment.pendingTimerCount(), 1);

    environment.runPendingTimers(2000);
    assert.deepEqual(environment.sentCommands, [
      PATTERN_ROOM_SAVE_COMMAND,
      PATTERN_ROOM_SAVE_COMMAND,
      PATTERN_ROOM_SAVE_COMMAND,
    ]);
    const savedSnapshot = readLatestSavePayload(environment)[
      "snapshot"
    ] as PatternRoomSessionSnapshot;
    assert.equal(savedSnapshot.schemaVersion, PATTERN_ROOM_SNAPSHOT_VERSION);
    assert.deepEqual(savedSnapshot.overlay.localAuthoredSources, []);
    assert.deepEqual(savedSnapshot.overlay.localAuthoredNodes, []);
    assert.deepEqual(savedSnapshot.overlay.localAuthoredEvidence, []);
    assert.deepEqual(savedSnapshot.overlay.localAuthoredEdges, []);
    assert.deepEqual(savedSnapshot.overlay.localNotes, []);
    assert.deepEqual(savedSnapshot.overlay.pinnedSourceIds, []);
    assert.deepEqual(savedSnapshot.overlay.sourcePinnedLayerById, {});
    assert.deepEqual(savedSnapshot.overlay.debateReferenceIds, []);
    assert.deepEqual(savedSnapshot.overlay.debateLocalTurns, []);
    assert.equal(savedSnapshot.overlay.debateLocalVerdict, null);
    assert.equal(savedSnapshot.overlay.debatePhase, "idle");
    assert.equal(savedSnapshot.guards.debateReportReflected, false);

    returnToOverview(environment.app);
    openFocusedView(environment.app, "board");
    const boardText = readTreeText(environment.app);
    assert.doesNotMatch(boardText, /Gölge yönü notu/);
    assert.doesNotMatch(boardText, /Tekrarlayan gölge izi/);
    assertTextIncludes(boardText, ["Seyir defteri kaynagi"]);

    returnToOverview(environment.app);
    openFocusedView(environment.app, "report");
    const reportText = readTreeText(environment.app);
    assert.doesNotMatch(reportText, /Yerel Bağlantılar/);
    assert.doesNotMatch(reportText, /Yerel Kanıt Notları/);
    assert.doesNotMatch(
      reportText,
      /Kaynak Atölyesi tarafından örnek bir saha notu paketi hazırlandı./
    );

    returnToOverview(environment.app);
    openFocusedView(environment.app, "tenth-man");
    const tenthManText = readTreeText(environment.app);
    assertTextIncludes(tenthManText, [
      "Referans eklemek için Pano veya Arşiv üzerinden 10. Adam’a Ekle akışını kullan.",
      "0 / 8",
    ]);
    assert.doesNotMatch(tenthManText, /Saha Defteri Alıntısı/);
    assert.doesNotMatch(tenthManText, /AI0 araştırmacı açılışı/);

    assert.deepEqual(confirmMessages, [
      "Tüm yerel kaynaklar, notlar ve geçici tartışma izleri temizlenecek. Hazır konu verileri korunur. Devam edilsin mi?",
      "Tüm yerel kaynaklar, notlar ve geçici tartışma izleri temizlenecek. Hazır konu verileri korunur. Devam edilsin mi?",
    ]);
    assert.equal(JSON.stringify(PATTERN_ROOM_DOMAIN_MOCK), beforeDomain);
  } finally {
    environment.restore();
    await installedCopy.cleanup();
  }
});

test("pattern-room installed UI runs phase 5B local tenth-man debate flow", async () => {
  const environment = createMinimalForgeUiEnvironment();
  const installedCopy = await createRoomInstalledCopy("pattern-room");

  try {
    await import(
      `${pathToFileURL(resolve(installedCopy.rootDir, "ui/index.js")).href}?debate=${Date.now()}`
    );

    openFocusedView(environment.app, "tenth-man");
    const disabledPrepare = environment.app.querySelector("[data-pattern-prepare-debate='true']");
    assert.ok(disabledPrepare);
    assert.equal(disabledPrepare.disabled, true);

    returnToOverview(environment.app);
    openFocusedView(environment.app, "archive");
    const addArchiveSourceToDebate = environment.app.querySelector(
      "[data-pattern-add-source-debate='source-shadow-comparison']"
    );
    assert.ok(addArchiveSourceToDebate);
    fireEvent(addArchiveSourceToDebate, "click");

    returnToOverview(environment.app);
    openFocusedView(environment.app, "tenth-man");
    assertTextIncludes(readTreeText(environment.app), [
      "Golge karsilastirma gorseli",
      "Yerel Simülasyon",
      "0 / 8",
    ]);

    const prepare = environment.app.querySelector("[data-pattern-prepare-debate='true']");
    assert.ok(prepare);
    assert.equal(prepare.disabled, false);
    fireEvent(prepare, "click");
    assertTextIncludes(readTreeText(environment.app), ["Hazırlık", "Rolleri Ata", "1 / 8"]);

    const assign = environment.app.querySelector("[data-pattern-assign-debate-roles='true']");
    assert.ok(assign);
    fireEvent(assign, "click");
    assertTextIncludes(readTreeText(environment.app), ["Rol atama", "dummy bağlı", "2 / 8"]);

    const start = environment.app.querySelector("[data-pattern-start-debate='true']");
    assert.ok(start);
    fireEvent(start, "click");
    assertTextIncludes(readTreeText(environment.app), ["AI0 araştırmacı açılışı"]);

    for (let index = 0; index < 4; index += 1) {
      const advance = environment.app.querySelector("[data-pattern-advance-debate='true']");
      assert.ok(advance);
      fireEvent(advance, "click");
    }

    assertTextIncludes(readTreeText(environment.app), ["US1 hakem değerlendirmesi"]);

    const complete = environment.app.querySelector("[data-pattern-complete-debate='true']");
    assert.ok(complete);
    fireEvent(complete, "click");
    assertTextIncludes(readTreeText(environment.app), [
      "Local 10. Adam oturumu tamamlandı",
      "8 / 8",
    ]);

    const reflect = environment.app.querySelector("[data-pattern-reflect-debate='true']");
    assert.ok(reflect);
    fireEvent(reflect, "click");

    returnToOverview(environment.app);
    openFocusedView(environment.app, "report");
    assertTextIncludes(readTreeText(environment.app), [
      "Yerel Notlar",
      "10. Adam local oturum özeti",
    ]);

    assert.deepEqual(environment.sentCommands, []);
    assert.deepEqual(environment.sentEvents, []);
  } finally {
    environment.restore();
    await installedCopy.cleanup();
  }
});

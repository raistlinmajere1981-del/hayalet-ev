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
import { PATTERN_ROOM_DOMAIN_MOCK } from "../../rooms/pattern-room/shared/data/pattern-room-domain.mock.ts";
import { createLocalState } from "../../rooms/pattern-room/shared/state/pattern-room-local-state.ts";
import { createSnapshot } from "../../rooms/pattern-room/shared/state/pattern-room-snapshot.ts";
import {
  PATTERN_ROOM_LOADED_EVENT,
  PATTERN_ROOM_SAVE_FAILED_EVENT,
} from "../../rooms/pattern-room/shared/types/pattern-room-persistence.ts";
import type { PatternRoomSessionSnapshot } from "../../rooms/pattern-room/shared/types/pattern-room-snapshot.ts";

const PATTERN_FOCUSED_VIEWS = ["board", "desk", "archive", "tenth-man", "report"] as const;
type PatternFocusedViewId = (typeof PATTERN_FOCUSED_VIEWS)[number];

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

function createHostLoadedSnapshot(
  activeView: PatternFocusedViewId | "overview",
  noteText: string
): PatternRoomSessionSnapshot {
  const localState = createLocalState(PATTERN_ROOM_DOMAIN_MOCK);
  localState.addLocalNote(noteText);
  return createSnapshot(localState, activeView);
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

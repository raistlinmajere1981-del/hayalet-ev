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
        assertTextIncludes(focusedText, ["Kanıt", "Analiz", "Yorum", "Belirsizlik"]);
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
        ]);
      }

      if (viewId === "report") {
        assertTextIncludes(focusedText, [
          "Kanıtlar",
          "Analizler",
          "Belirsizlikler",
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
    assertTextIncludes(readTreeText(environment.app), ["Golge karsilastirma gorseli"]);

    const prepare = environment.app.querySelector("[data-pattern-prepare-debate='true']");
    assert.ok(prepare);
    assert.equal(prepare.disabled, false);
    fireEvent(prepare, "click");
    assertTextIncludes(readTreeText(environment.app), ["Hazırlık", "Rolleri Ata"]);

    const assign = environment.app.querySelector("[data-pattern-assign-debate-roles='true']");
    assert.ok(assign);
    fireEvent(assign, "click");
    assertTextIncludes(readTreeText(environment.app), ["Rol atama", "dummy bağlı"]);

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
    assertTextIncludes(readTreeText(environment.app), ["Local 10. Adam oturumu tamamlandı"]);

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

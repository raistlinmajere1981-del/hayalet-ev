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

import type { FakeElement } from "./forge-room-ui-smoke.helpers.ts";
import { assert, createMinimalForgeUiEnvironment, createRoomInstalledCopy, fireEvent, pathToFileURL, readTreeText, resolve, test } from "./forge-room-ui-smoke.helpers.ts";
import { PATTERN_ROOM_DOMAIN_MOCK } from "../../rooms/pattern-room/shared/data/pattern-room-domain.mock.ts";
import { createLocalState } from "../../rooms/pattern-room/shared/state/pattern-room-local-state.ts";
import { createSnapshot } from "../../rooms/pattern-room/shared/state/pattern-room-snapshot.ts";
import { PATTERN_ROOM_SAVE_COMMAND } from "../../rooms/pattern-room/shared/types/pattern-room-persistence.ts";

const _PATTERN_FOCUSED_VIEWS = ["board", "desk", "archive", "tenth-man", "report"] as const;
type PatternFocusedViewId = (typeof _PATTERN_FOCUSED_VIEWS)[number];
type PatternRoomFakeApp = FakeElement;

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


describe("phase 4B local interactions", () => {
  void test("pattern-room installed UI supports phase 4B local interactions without host commands", async () => {
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
      assert.equal(environment.app.querySelector("[data-pattern-local-note-form='true']"), null);
      assertTextIncludes(readTreeText(environment.app), [
        "Kaynak Özeti",
        "Pano Notları",
        "10. Adam İzleri",
        "Henüz yerel kanıt notu yok.",
        "Henüz yerel pano notu yok.",
      ]);

      assert.deepEqual(environment.sentCommands, []);
      assert.deepEqual(environment.sentEvents, []);
    } finally {
      environment.restore();
      await installedCopy.cleanup();
    }
  });
});

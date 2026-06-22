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


describe("phase 5B tenth-man debate", () => {
  void test("pattern-room installed UI runs phase 5B local tenth-man debate flow", async () => {
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
        "10. Adam İzleri",
        "Yerel tartışma özeti",
        "Sonraki Araştırma Notları",
        "10. Adam local oturum özeti",
      ]);

      assert.deepEqual(environment.sentCommands, []);
      assert.deepEqual(environment.sentEvents, []);
    } finally {
      environment.restore();
      await installedCopy.cleanup();
    }
  });
});

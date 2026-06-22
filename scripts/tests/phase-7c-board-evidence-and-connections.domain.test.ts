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


describe("phase 7C board evidence and connections", () => {
  void test("pattern-room installed UI phase 7C board node authoring form submits claims and guards blanks", async () => {
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
      const contentInput = environment.app.querySelector(
        "[data-pattern-author-node-content='true']"
      );
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

  void test("pattern-room installed UI phase 7C board evidence form reaches board and report", async () => {
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
      const labelInput = environment.app.querySelector(
        "[data-pattern-author-evidence-label='true']"
      );
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
        "Kanıt Notları",
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

  void test("pattern-room installed UI phase 8B board connection form reaches report only", async () => {
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
      const sourceSelect = environment.app.querySelector(
        "[data-pattern-author-edge-source='true']"
      );
      const edgeTypeSelect = environment.app.querySelector(
        "[data-pattern-author-edge-type='true']"
      );
      const targetSelect = environment.app.querySelector(
        "[data-pattern-author-edge-target='true']"
      );
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

  void test("pattern-room installed UI phase 7C archive source authoring form submits local sources", async () => {
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
      const originInput = environment.app.querySelector(
        "[data-pattern-author-source-origin='true']"
      );
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
});

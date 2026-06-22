import type { FakeElement } from "./forge-room-ui-smoke.helpers.ts";
import { assert, createMinimalForgeUiEnvironment, createRoomInstalledCopy, fireEvent, pathToFileURL, readTreeText, resolve, test } from "./forge-room-ui-smoke.helpers.ts";
import { PATTERN_ROOM_DOMAIN_MOCK } from "../../rooms/pattern-room/shared/data/pattern-room-domain.mock.ts";
import { createLocalState } from "../../rooms/pattern-room/shared/state/pattern-room-local-state.ts";
import { createSnapshot } from "../../rooms/pattern-room/shared/state/pattern-room-snapshot.ts";
import { PATTERN_ROOM_LOADED_EVENT, PATTERN_ROOM_SAVE_COMMAND } from "../../rooms/pattern-room/shared/types/pattern-room-persistence.ts";

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

describe("phase 13C blank text and 11D import", () => {
  void test("pattern-room installed UI phase 13C rejects blank long text fields", async () => {
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

  void test("pattern-room installed UI phase 12G-A cancels local source removal safely", async () => {
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

  void test("pattern-room installed UI phase 11D imports a mock SourcePackage from the archive demo", async () => {
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
      assertTextIncludes(readTreeText(environment.app), [
        "Gölge yönü notu",
        "Tekrarlayan gölge izi",
      ]);

      returnToOverview(environment.app);
      openFocusedView(environment.app, "report");
      assertTextIncludes(readTreeText(environment.app), [
        "Sonraki Araştırma Notları",
        "Kaynak Atölyesi tarafından örnek bir saha notu paketi hazırlandı.",
        "Kanıt Notları",
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
});

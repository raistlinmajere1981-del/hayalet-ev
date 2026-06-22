import type { FakeElement } from "./forge-room-ui-smoke.helpers.ts";
import {
  assert,
  createMinimalForgeUiEnvironment,
  createRoomInstalledCopy,
  fireEvent,
  pathToFileURL,
  readFileSync,
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
  PATTERN_ROOM_CASE_REVIEW_DISPATCH_COMMAND,
  PATTERN_ROOM_CASE_REVIEW_DISPATCH_FAILED_EVENT,
  PATTERN_ROOM_CASE_REVIEW_DISPATCHED_EVENT,
  type PatternRoomCaseReviewDispatchDraft,
} from "../../rooms/pattern-room/shared/types/pattern-room-case-review-dispatch.ts";
import {
  PATTERN_ROOM_SNAPSHOT_VERSION,
  type PatternRoomSessionSnapshot,
} from "../../rooms/pattern-room/shared/types/pattern-room-snapshot.ts";
import { createArchivePanel } from "../../rooms/pattern-room/ui/panels/pattern-archive-panel.ts";
import type { PatternPanelActions } from "../../rooms/pattern-room/shared/types/pattern-room.ts";

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

describe("phase 12G source removal and reset", () => {
  void test("pattern-room installed UI phase 12G-A removes confirmed local sources and cascades source-linked report links", async () => {
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
      assertTextIncludes(readTreeText(environment.app), ["Henüz yerel bağlantı yok."]);
      assert.equal(JSON.stringify(PATTERN_ROOM_DOMAIN_MOCK), beforeDomain);
    } finally {
      environment.restore();
      await installedCopy.cleanup();
    }
  });

  void test("pattern-room installed UI phase 12G-C removes selected local board nodes and evidence only", async () => {
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
        "Kanıt Notları",
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
      assertTextIncludes(evidenceRemovedReportText, ["Henüz yerel bağlantı yok."]);
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

      assert.equal(
        environment.app.querySelector("[data-pattern-board-pin='local-node-001']"),
        null
      );
      assert.ok(environment.app.querySelector("[data-pattern-board-pin='node-navigation-source']"));
      environment.runPendingTimers(2000);

      const nodeRemovedSnapshot = readLatestSavePayload(environment)[
        "snapshot"
      ] as PatternRoomSessionSnapshot;
      assert.equal(nodeRemovedSnapshot.schemaVersion, PATTERN_ROOM_SNAPSHOT_VERSION);
      assert.deepEqual(nodeRemovedSnapshot.overlay.localAuthoredNodes, []);
      assert.deepEqual(nodeRemovedSnapshot.overlay.localAuthoredEvidence, []);
      assert.deepEqual(nodeRemovedSnapshot.overlay.localAuthoredEdges, []);
      assert.equal(
        nodeRemovedSnapshot.overlay.debateReferenceIds.includes("local-node-001"),
        false
      );
      const nodeRemovedRestored = restoreFromSnapshot(
        nodeRemovedSnapshot,
        PATTERN_ROOM_DOMAIN_MOCK
      );
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

  void test("pattern-room installed UI phase 12G-B resets the local session without touching domain data", async () => {
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
      ]);

      returnToOverview(environment.app);
      openFocusedView(environment.app, "archive");
      const resetButton = environment.app.querySelector(
        "[data-pattern-reset-local-session='true']"
      );
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
      assertTextIncludes(reportText, ["Henüz yerel kanıt notu yok.", "Henüz yerel bağlantı yok."]);
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
});

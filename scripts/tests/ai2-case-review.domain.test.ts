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

describe("AI2 case review", () => {
  void test("pattern-room installed UI prepares a local AI2 case review dry-run preview", async () => {
    const environment = createMinimalForgeUiEnvironment();
    const installedCopy = await createRoomInstalledCopy("pattern-room");

    try {
      await import(
        `${pathToFileURL(resolve(installedCopy.rootDir, "ui/index.js")).href}?case-review-preview=${Date.now()}`
      );

      openFocusedView(environment.app, "tenth-man");
      assertTextIncludes(readTreeText(environment.app), [
        "AI2 Vaka İnceleme Önizlemesi",
        "Bu aşamada hiçbir mesaj gönderilmez.",
        "Önizleme Hazırla",
      ]);

      const preparePreview = environment.app.querySelector(
        "[data-pattern-case-review-preview-prepare='true']"
      );
      assert.ok(preparePreview);
      fireEvent(preparePreview, "click");

      const previewTextElement = environment.app.querySelector(
        "[data-pattern-case-review-preview-text='true']"
      );
      assert.ok(previewTextElement);
      const fullText = readTreeText(environment.app);
      const previewText = previewTextElement.textContent;

      assertTextIncludes(fullText, [
        "Target: AI2 / ai2",
        "Protocol: pattern-room-case-review",
        "Bu paket kullanıcı tarafından eklenen",
      ]);
      assert.match(previewText, /\[Case Packet\]/);
      assert.match(previewText, /"caution":/);
      assert.match(previewText, /"sources":/);
      assertPatternCaseReviewPreviewAvoidsVerdictLanguage(previewText);

      assert.deepEqual(environment.sentCommands, []);
      assert.deepEqual(environment.sentEvents, []);
      assert.equal(
        (environment.sentCommands as string[]).includes("pattern:case-review-dispatch"),
        false
      );

      const previewSource = readFileSync(
        resolve("rooms/pattern-room/ui/pattern-case-review-preview.ts"),
        "utf8"
      );
      const panelSource = readFileSync(
        resolve("rooms/pattern-room/ui/panels/pattern-tenth-man-panel.ts"),
        "utf8"
      );
      [previewSource, panelSource].forEach((source) => {
        assert.doesNotMatch(source, /PATTERN_ROOM_CASE_REVIEW_DISPATCH_COMMAND/);
        assert.doesNotMatch(source, /pattern:case-review-dispatch/);
        assert.doesNotMatch(source, /roomAPI\.sendCommand/);
        assert.doesNotMatch(source, /dispatchBridge/);
        assert.doesNotMatch(source, /message\.sendWait/);
      });
      assert.equal(PATTERN_ROOM_SNAPSHOT_VERSION, 1);
    } finally {
      environment.restore();
      await installedCopy.cleanup();
    }
  });

  void test("pattern-room installed UI dispatches the AI2 case review only after preview and confirm", async () => {
    const environment = createMinimalForgeUiEnvironment();
    const installedCopy = await createRoomInstalledCopy("pattern-room");
    const confirmMessages: string[] = [];
    const confirmMessage =
      "Bu vaka inceleme paketi AI2 / 10. Adam rolüne gönderilecek. Mesaj gönderildikten sonra yanıt bu aşamada otomatik olarak odaya işlenmez. Devam edilsin mi?";
    const beforeDomain = JSON.stringify(PATTERN_ROOM_DOMAIN_MOCK);
    let confirmResult = false;

    try {
      const runtimeModule = (await import(
        `${pathToFileURL(resolve(installedCopy.rootDir, "ui/pattern-room-ui-runtime.js")).href}?case-review-send=${Date.now()}`
      )) as PatternRoomUiRuntimeModule;
      const runtime = runtimeModule.createPatternRoomUiRuntime();
      runtime.start();

      setWindowConfirm((message) => {
        confirmMessages.push(message);
        return confirmResult;
      });

      openFocusedView(environment.app, "tenth-man");
      const disabledSend = environment.app.querySelector(
        "[data-pattern-case-review-dispatch-send='true']"
      );
      assert.ok(disabledSend);
      assert.equal(disabledSend.disabled, true);
      fireEvent(disabledSend, "click");
      assert.deepEqual(confirmMessages, []);
      assert.deepEqual(environment.sentCommands, []);

      const preparePreview = environment.app.querySelector(
        "[data-pattern-case-review-preview-prepare='true']"
      );
      assert.ok(preparePreview);
      fireEvent(preparePreview, "click");

      const enabledSend = environment.app.querySelector(
        "[data-pattern-case-review-dispatch-send='true']"
      );
      assert.ok(enabledSend);
      assert.equal(enabledSend.disabled, false);
      assertTextIncludes(readTreeText(environment.app), [
        "Target: AI2 / ai2",
        "Protocol: pattern-room-case-review",
      ]);

      const snapshotBeforeSend = runtime.createSnapshot();
      fireEvent(enabledSend, "click");
      assert.deepEqual(confirmMessages, [confirmMessage]);
      assert.deepEqual(environment.sentCommands, []);

      confirmResult = true;
      fireEvent(enabledSend, "click");
      assert.deepEqual(confirmMessages, [confirmMessage, confirmMessage]);
      assert.deepEqual(environment.sentCommands, [PATTERN_ROOM_CASE_REVIEW_DISPATCH_COMMAND]);
      assertTextIncludes(readTreeText(environment.app), ["Gönderiliyor..."]);

      const dispatchEvent = environment.sentEvents[0];
      assert.ok(dispatchEvent);
      assert.equal(dispatchEvent.command, PATTERN_ROOM_CASE_REVIEW_DISPATCH_COMMAND);
      assert.equal(environment.sentEvents.length, 1);
      const draft = dispatchEvent.payload["draft"] as
        | PatternRoomCaseReviewDispatchDraft
        | undefined;
      assert.ok(draft);
      assert.equal(draft.roleSlot, "AI2");
      assert.equal(draft.targetSlot, "ai2");
      assert.equal(draft.payload.toSlot, "ai2");
      assert.equal(draft.payload.payload.protocol.protocolKey, "pattern-room-case-review");
      assert.match(draft.payload.payload.text, /\[Case Packet\]/);
      assert.match(draft.payload.payload.text, /"caution":/);
      assert.equal("context" in draft.payload.payload.protocol, false);

      assertSnapshotLocalStateUnchanged(snapshotBeforeSend, runtime.createSnapshot());

      environment.emitHostMessage({
        payload: {
          roleSlot: "AI2",
          success: true,
          targetSlot: "ai2",
          warnings: [],
        },
        type: PATTERN_ROOM_CASE_REVIEW_DISPATCHED_EVENT,
      });
      assertTextIncludes(readTreeText(environment.app), ["AI2’ye gönderildi."]);
      assertSnapshotLocalStateUnchanged(snapshotBeforeSend, runtime.createSnapshot());

      environment.emitHostMessage({
        payload: {
          error: "dispatch failed in smoke",
          success: false,
        },
        type: PATTERN_ROOM_CASE_REVIEW_DISPATCH_FAILED_EVENT,
      });
      assertTextIncludes(readTreeText(environment.app), ["Gönderim başarısız."]);
      assertSnapshotLocalStateUnchanged(snapshotBeforeSend, runtime.createSnapshot());

      environment.runPendingTimers(2000);
      assert.deepEqual(environment.sentCommands, [PATTERN_ROOM_CASE_REVIEW_DISPATCH_COMMAND]);
      assert.equal(
        (environment.sentCommands as string[]).includes(PATTERN_ROOM_SAVE_COMMAND),
        false
      );
      assert.equal(JSON.stringify(PATTERN_ROOM_DOMAIN_MOCK), beforeDomain);
      runtime.dispose();
    } finally {
      environment.restore();
      await installedCopy.cleanup();
    }
  });
});

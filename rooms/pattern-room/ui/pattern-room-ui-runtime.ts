import { adaptDomainToViewModels } from "../shared/adapters/pattern-room-view-adapters.js";
import { PATTERN_ROOM_DOMAIN_MOCK } from "../shared/data/pattern-room-domain.mock.js";
import { createLocalState } from "../shared/state/pattern-room-local-state.js";
import { createSnapshot, restoreFromSnapshot } from "../shared/state/pattern-room-snapshot.js";
import {
  PATTERN_ROOM_LOADED_EVENT,
  PATTERN_ROOM_SAVE_COMMAND,
  PATTERN_ROOM_SAVED_EVENT,
  PATTERN_ROOM_SAVE_FAILED_EVENT,
} from "../shared/types/pattern-room-persistence.js";
import type {
  PatternLongTextSourceImportInput,
  PatternLongTextSourceImportStatus,
  PatternPanelActions,
  PatternRoomMockData,
  PatternUserTextSourceImportInput,
  PatternUserTextSourceImportStatus,
  PatternViewId,
} from "../shared/types/pattern-room.js";
import {
  createLongTextProducer,
  createUserTextProducer,
  produceAndImportSource,
  type LongTextInput,
  type PastedTextInput,
  type SourceProducerOrchestrationResult,
} from "../shared/source-producers/index.js";
import type { PatternRoomSessionSnapshot } from "../shared/types/pattern-room-snapshot.js";
import { createArchivePanel } from "./panels/pattern-archive-panel.js";
import { createBoardPanel } from "./panels/pattern-board-panel.js";
import { createDeskPanel } from "./panels/pattern-desk-panel.js";
import { createOverviewPanel } from "./panels/pattern-overview-panel.js";
import { createReportPanel } from "./panels/pattern-report-panel.js";
import { createTenthManPanel } from "./panels/pattern-tenth-man-panel.js";
import { importSampleSourcePackage } from "./pattern-source-import-demo.js";

type FocusedPatternViewId = Exclude<PatternViewId, "overview">;
type HostMessageUnsubscribe = () => void;
const AUTOSAVE_DEBOUNCE_MS = 2000;

export type PatternRoomUiRuntime = {
  start: () => void;
  dispose: () => void;
  createSnapshot: () => PatternRoomSessionSnapshot;
  restoreSnapshot: (snapshot: unknown) => boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isHostMessageUnsubscribe(value: unknown): value is HostMessageUnsubscribe {
  return typeof value === "function";
}

function resolveRoot(): HTMLElement {
  const existingRoot = document.getElementById("app");
  if (existingRoot !== null) {
    return existingRoot;
  }

  const root = document.createElement("div");
  root.id = "app";
  document.body.append(root);
  return root;
}

export function createPatternRoomUiRuntime(): PatternRoomUiRuntime {
  const root = resolveRoot();
  const localState = createLocalState(PATTERN_ROOM_DOMAIN_MOCK);
  let activeView: PatternViewId = "overview";
  let selectedNodeId: string | null = null;
  let selectedArchiveSourceId: string | null = null;
  let viewModels: PatternRoomMockData = adaptDomainToViewModels(
    PATTERN_ROOM_DOMAIN_MOCK,
    localState.getOverlay()
  );
  let hostMessagesConnected = false;
  let removeHostMessageListener: HostMessageUnsubscribe | null = null;
  let beforeUnloadConnected = false;
  let persistenceReady = false;
  let isRestoring = false;
  let dirty = false;
  let pendingSaveTimer: number | null = null;
  let sourceImportDemoStatus: ReturnType<typeof importSampleSourcePackage> | null = null;
  let userTextSourceImportStatus: PatternUserTextSourceImportStatus | null = null;
  let longTextSourceImportStatus: PatternLongTextSourceImportStatus | null = null;
  const importedUserTextPackageIds = new Set<string>();
  const importedLongTextPackageIds = new Set<string>();

  function createEmptyUserTextStatus(message: string): PatternUserTextSourceImportStatus {
    return {
      packageIds: [],
      message,
      success: false,
      duplicate: false,
      sourcesAdded: 0,
      evidenceAdded: 0,
      nodesAdded: 0,
      edgesAdded: 0,
      notesAdded: 0,
      duplicatesSkipped: 0,
      warningCount: 0,
      errorCount: 0,
    };
  }

  function createEmptyLongTextStatus(message: string): PatternLongTextSourceImportStatus {
    return {
      ...createEmptyUserTextStatus(message),
      segmentCount: 0,
    };
  }

  function createUserTextProducerInput(input: PatternUserTextSourceImportInput): PastedTextInput {
    const producerInput: PastedTextInput = {
      inputKind: "pasted_text",
      text: input.text.trim(),
      language: input.language?.trim() || "tr",
    };
    const title = input.title.trim();
    if (title !== "") {
      producerInput.title = title;
    }
    return producerInput;
  }

  function createLongTextProducerInput(input: PatternLongTextSourceImportInput): LongTextInput {
    const producerInput: LongTextInput = {
      inputKind: "long_text",
      title: input.title.trim(),
      origin: input.origin.trim(),
      sourceKind: input.sourceKind,
      text: input.text.trim(),
      language: input.language?.trim() || "tr",
    };
    const chapter = input.chapter?.trim();
    const page = input.page?.trim();
    if (chapter !== undefined && chapter !== "") {
      producerInput.chapter = chapter;
    }
    if (page !== undefined && page !== "") {
      producerInput.page = page;
    }
    return producerInput;
  }

  function summarizeUserTextImportResult(
    result: SourceProducerOrchestrationResult
  ): PatternUserTextSourceImportStatus {
    let sourcesAdded = 0;
    let evidenceAdded = 0;
    let nodesAdded = 0;
    let edgesAdded = 0;
    let notesAdded = 0;
    let duplicatesSkipped = 0;
    let applyWarningCount = 0;

    result.importResults.forEach((packageResult) => {
      const summary = localState.applySourceImportResult(packageResult.importResult);
      sourcesAdded += summary.sourcesAdded;
      evidenceAdded += summary.evidenceAdded;
      nodesAdded += summary.nodesAdded;
      edgesAdded += summary.edgesAdded;
      notesAdded += summary.notesAdded;
      duplicatesSkipped +=
        summary.duplicatesSkipped + packageResult.importResult.stats.duplicatesSkipped;
      applyWarningCount += summary.warnings.length;

      if (
        summary.sourcesAdded > 0 ||
        summary.evidenceAdded > 0 ||
        summary.nodesAdded > 0 ||
        summary.edgesAdded > 0 ||
        summary.notesAdded > 0
      ) {
        importedUserTextPackageIds.add(packageResult.packageId);
      }
    });

    const packageIds = result.packagesProduced.map((sourcePackage) => {
      return sourcePackage.sourcePackageId;
    });
    const importedCount = sourcesAdded + evidenceAdded + nodesAdded + edgesAdded + notesAdded;
    const duplicate = importedCount === 0 && duplicatesSkipped > 0;
    const errorCount = result.errors.length;
    const warningCount = result.warnings.length + applyWarningCount;
    const message =
      errorCount > 0
        ? "Metin kaynak paketine dönüştürülemedi."
        : duplicate
          ? "Bu metin zaten odada kayıtlı görünüyor."
          : importedCount > 0
            ? `Metin kaynak olarak odaya eklendi: ${String(sourcesAdded)} kaynak, ${String(
                evidenceAdded
              )} kanıt, ${String(nodesAdded)} düğüm.`
            : "Metinden içe aktarılacak kaynak bulunamadı.";

    return {
      packageIds,
      message,
      success: importedCount > 0,
      duplicate,
      sourcesAdded,
      evidenceAdded,
      nodesAdded,
      edgesAdded,
      notesAdded,
      duplicatesSkipped,
      warningCount,
      errorCount,
    };
  }

  function summarizeLongTextImportResult(
    result: SourceProducerOrchestrationResult
  ): PatternLongTextSourceImportStatus {
    let sourcesAdded = 0;
    let evidenceAdded = 0;
    let nodesAdded = 0;
    let edgesAdded = 0;
    let notesAdded = 0;
    let duplicatesSkipped = 0;
    let applyWarningCount = 0;

    result.importResults.forEach((packageResult) => {
      const summary = localState.applySourceImportResult(packageResult.importResult);
      sourcesAdded += summary.sourcesAdded;
      evidenceAdded += summary.evidenceAdded;
      nodesAdded += summary.nodesAdded;
      edgesAdded += summary.edgesAdded;
      notesAdded += summary.notesAdded;
      duplicatesSkipped +=
        summary.duplicatesSkipped + packageResult.importResult.stats.duplicatesSkipped;
      applyWarningCount += summary.warnings.length;

      if (
        summary.sourcesAdded > 0 ||
        summary.evidenceAdded > 0 ||
        summary.nodesAdded > 0 ||
        summary.edgesAdded > 0 ||
        summary.notesAdded > 0
      ) {
        importedLongTextPackageIds.add(packageResult.packageId);
      }
    });

    const packageIds = result.packagesProduced.map((sourcePackage) => {
      return sourcePackage.sourcePackageId;
    });
    const segmentCount = result.packagesProduced.reduce((count, sourcePackage) => {
      return count + sourcePackage.segments.length;
    }, 0);
    const importedCount = sourcesAdded + evidenceAdded + nodesAdded + edgesAdded + notesAdded;
    const duplicate = importedCount === 0 && duplicatesSkipped > 0;
    const errorCount = result.errors.length;
    const warningCount = result.warnings.length + applyWarningCount;
    const message =
      errorCount > 0
        ? "Uzun metin kaynak paketine dönüştürülemedi."
        : duplicate
          ? "Bu uzun metin zaten odada kayıtlı görünüyor."
          : importedCount > 0
            ? `Uzun metin kaynak olarak eklendi: ${String(segmentCount)} segment.`
            : "Uzun metinden içe aktarılacak kaynak bulunamadı.";

    return {
      packageIds,
      message,
      success: importedCount > 0,
      duplicate,
      sourcesAdded,
      evidenceAdded,
      nodesAdded,
      edgesAdded,
      notesAdded,
      duplicatesSkipped,
      warningCount,
      errorCount,
      segmentCount,
    };
  }

  function archiveSourceExists(sourceId: string): boolean {
    return viewModels.sources.some((source) => {
      return source.id === sourceId;
    });
  }

  function selectArchiveSource(sourceId: string | null): void {
    selectedArchiveSourceId = sourceId;
    render();
  }

  const actions: PatternPanelActions = {
    getSelectedNodeId(): string | null {
      return selectedNodeId;
    },
    selectNode(nodeId: string | null): void {
      selectedNodeId = nodeId;
    },
    sendNodeToDesk(nodeId: string): void {
      localState.sendToDesk(nodeId);
    },
    addNodeToDebate(nodeId: string): void {
      localState.addToDebate(nodeId);
    },
    pinSourceToBoard(sourceId: string, layer): void {
      localState.pinSource(sourceId, layer);
    },
    addSourceToDebate(sourceId: string): void {
      localState.addToDebate(sourceId);
    },
    addLocalNote(text: string): void {
      localState.addLocalNote(text);
    },
    addAuthoredClaim(label: string, content: string): void {
      localState.addAuthoredClaim(label, content);
    },
    addAuthoredInspiration(label: string, content: string): void {
      localState.addAuthoredInspiration(label, content);
    },
    addAuthoredUncertainty(label: string, content: string): void {
      localState.addAuthoredUncertainty(label, content);
    },
    addAuthoredSource(label: string, origin: string, note: string): void {
      localState.addAuthoredSource(label, origin, note);
    },
    removeLocalSource(sourceId: string): void {
      localState.removeLocalSource(sourceId);
    },
    removeLocalNode(nodeId: string): void {
      localState.removeLocalNode(nodeId);
    },
    removeLocalEvidence(evidenceId: string): void {
      localState.removeLocalEvidence(evidenceId);
    },
    resetLocalSession(): void {
      localState.resetOverlayToEmpty();
    },
    addAuthoredEvidence(label: string, excerpt: string, interpretation, layer): void {
      localState.addAuthoredEvidence(label, excerpt, interpretation, layer);
    },
    addAuthoredEdge(edgeType, sourceId: string, targetId: string, note?: string): void {
      localState.addAuthoredEdge(edgeType, sourceId, targetId, note);
    },
    importUserTextSource(input: PatternUserTextSourceImportInput) {
      if (input.text.trim() === "") {
        userTextSourceImportStatus = createEmptyUserTextStatus("Metin boş olamaz.");
        return userTextSourceImportStatus;
      }

      const producer = createUserTextProducer();
      const result = produceAndImportSource(producer, createUserTextProducerInput(input), {
        importOptions: {
          existingPackageIds: [...importedUserTextPackageIds],
        },
      });
      userTextSourceImportStatus = summarizeUserTextImportResult(result);
      render();
      return userTextSourceImportStatus;
    },
    importLongTextSource(input: PatternLongTextSourceImportInput) {
      if (input.title.trim() === "") {
        longTextSourceImportStatus = createEmptyLongTextStatus("Başlık boş olamaz.");
        return longTextSourceImportStatus;
      }
      if (input.origin.trim() === "") {
        longTextSourceImportStatus = createEmptyLongTextStatus("Kaynak bilgisi boş olamaz.");
        return longTextSourceImportStatus;
      }
      if (input.text.trim() === "") {
        longTextSourceImportStatus = createEmptyLongTextStatus("Metin boş olamaz.");
        return longTextSourceImportStatus;
      }

      const producer = createLongTextProducer();
      const result = produceAndImportSource(producer, createLongTextProducerInput(input), {
        importOptions: {
          existingPackageIds: [...importedLongTextPackageIds],
        },
      });
      longTextSourceImportStatus = summarizeLongTextImportResult(result);
      render();
      return longTextSourceImportStatus;
    },
    importSampleSourcePackage(packageId?: string) {
      sourceImportDemoStatus = importSampleSourcePackage(localState, packageId);
      render();
      return sourceImportDemoStatus;
    },
    prepareDebate(): void {
      localState.prepareDebate();
    },
    assignDebateRoles(): void {
      localState.assignDebateRoles();
    },
    startDebate(): void {
      localState.startDebate();
    },
    advanceDebatePhase(): void {
      localState.advanceDebatePhase();
    },
    completeDebate(): void {
      localState.completeDebate();
    },
    reflectDebateToReport(): void {
      localState.reflectDebateToReport();
    },
  };

  localState.subscribe(() => {
    viewModels = adaptDomainToViewModels(PATTERN_ROOM_DOMAIN_MOCK, localState.getOverlay());
    if (selectedArchiveSourceId !== null && !archiveSourceExists(selectedArchiveSourceId)) {
      selectedArchiveSourceId = null;
    }
    render();
    scheduleAutosave();
  });

  function createCurrentSnapshot(): PatternRoomSessionSnapshot {
    return createSnapshot(localState, activeView);
  }

  function clearPendingAutosave(): void {
    if (pendingSaveTimer === null) {
      return;
    }

    window.clearTimeout(pendingSaveTimer);
    pendingSaveTimer = null;
  }

  function sendPersistenceSave(flush = false): void {
    const sendCommand = window.roomAPI?.sendCommand;
    if (typeof sendCommand !== "function") {
      return;
    }

    const payload: Record<string, unknown> = {
      snapshot: createCurrentSnapshot(),
    };
    if (flush) {
      payload["flush"] = true;
    }

    try {
      if (sendCommand(PATTERN_ROOM_SAVE_COMMAND, payload)) {
        dirty = false;
      }
    } catch (error) {
      console.warn("Pattern Room save command failed.", error);
    }
  }

  function scheduleAutosave(): void {
    if (!persistenceReady || isRestoring) {
      return;
    }

    dirty = true;
    clearPendingAutosave();
    pendingSaveTimer = window.setTimeout(() => {
      pendingSaveTimer = null;
      if (dirty) {
        sendPersistenceSave();
      }
    }, AUTOSAVE_DEBOUNCE_MS);
  }

  function markPersistenceReady(): void {
    persistenceReady = true;
    dirty = false;
    clearPendingAutosave();
  }

  function flushPendingSave(): void {
    clearPendingAutosave();
    if (!persistenceReady || isRestoring || !dirty) {
      return;
    }

    sendPersistenceSave(true);
  }

  function handleBeforeUnload(): void {
    flushPendingSave();
  }

  function setActiveView(viewId: PatternViewId): void {
    activeView = viewId;
    render();
  }

  function renderFocusedView(viewId: FocusedPatternViewId): HTMLElement {
    const onBack = (): void => {
      setActiveView("overview");
    };
    const panelFactories: Record<FocusedPatternViewId, () => HTMLElement> = {
      archive: () =>
        createArchivePanel(
          viewModels,
          actions,
          onBack,
          userTextSourceImportStatus,
          longTextSourceImportStatus,
          sourceImportDemoStatus,
          {
            selectedSourceId: selectedArchiveSourceId,
            onSelectSource: selectArchiveSource,
          }
        ),
      board: () => createBoardPanel(viewModels, actions, onBack),
      desk: () => createDeskPanel(viewModels, actions, onBack),
      report: () => createReportPanel(viewModels, actions, onBack),
      "tenth-man": () => createTenthManPanel(viewModels, actions, onBack),
    };
    return panelFactories[viewId]();
  }

  function render(): void {
    const content =
      activeView === "overview"
        ? createOverviewPanel(viewModels, setActiveView)
        : renderFocusedView(activeView);
    root.replaceChildren(content);
  }

  function restoreSnapshot(snapshot: unknown): boolean {
    const restoredState = restoreFromSnapshot(snapshot, PATTERN_ROOM_DOMAIN_MOCK);
    if (restoredState === null) {
      return false;
    }

    isRestoring = true;
    try {
      activeView = restoredState.activeView;
      selectedArchiveSourceId = null;
      localState.restoreOverlay(restoredState.overlay, restoredState.guards);
      return true;
    } finally {
      isRestoring = false;
    }
  }

  function handleLoadedPayload(payload: unknown): void {
    if (!isRecord(payload) || payload["snapshot"] === null || payload["snapshot"] === undefined) {
      markPersistenceReady();
      return;
    }

    try {
      restoreSnapshot(payload["snapshot"]);
    } catch (error) {
      console.warn("Pattern Room snapshot restore failed.", error);
    } finally {
      markPersistenceReady();
    }
  }

  function handleSaveFailedPayload(payload: unknown): void {
    const message =
      isRecord(payload) && typeof payload["error"] === "string"
        ? payload["error"]
        : "Pattern Room save failed.";
    dirty = true;
    console.warn(message);
  }

  function handleHostMessage(message: unknown): void {
    if (!isRecord(message)) {
      return;
    }

    if (message["type"] === PATTERN_ROOM_LOADED_EVENT) {
      handleLoadedPayload(message["payload"]);
      return;
    }

    if (message["type"] === PATTERN_ROOM_SAVED_EVENT) {
      return;
    }

    if (message["type"] === PATTERN_ROOM_SAVE_FAILED_EVENT) {
      handleSaveFailedPayload(message["payload"]);
    }
  }

  function connectHostMessages(): void {
    if (hostMessagesConnected || typeof window.roomAPI?.onHostMessage !== "function") {
      return;
    }

    hostMessagesConnected = true;
    const maybeRemoveListener = window.roomAPI.onHostMessage(handleHostMessage) as unknown;
    removeHostMessageListener = isHostMessageUnsubscribe(maybeRemoveListener)
      ? maybeRemoveListener
      : null;
  }

  function disconnectHostMessages(): void {
    if (!hostMessagesConnected) {
      return;
    }

    removeHostMessageListener?.();
    removeHostMessageListener = null;
    hostMessagesConnected = false;
  }

  function connectBeforeUnload(): void {
    if (beforeUnloadConnected || typeof window.addEventListener !== "function") {
      return;
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    beforeUnloadConnected = true;
  }

  function disconnectBeforeUnload(): void {
    if (!beforeUnloadConnected || typeof window.removeEventListener !== "function") {
      return;
    }

    window.removeEventListener("beforeunload", handleBeforeUnload);
    beforeUnloadConnected = false;
  }

  function announceReady(): void {
    window.roomAPI?.ready?.({
      roomId: "pattern-room",
      featureId: "pattern-workbench",
      status: "ready",
    });
  }

  return {
    start(): void {
      connectHostMessages();
      connectBeforeUnload();
      render();
      announceReady();
    },
    dispose(): void {
      flushPendingSave();
      disconnectHostMessages();
      disconnectBeforeUnload();
      clearPendingAutosave();
    },
    createSnapshot(): PatternRoomSessionSnapshot {
      return createCurrentSnapshot();
    },
    restoreSnapshot,
  };
}

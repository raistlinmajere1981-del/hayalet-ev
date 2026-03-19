import { LogCategory } from "@shared/logging-core";
import { getErrorMessage } from "@shared/index.js";
import type { TranslationParams } from "@shared/i18n.js";
import { SettingsManager } from "../modules/settings-manager.js";
import { TrafficManager } from "../modules/traffic-manager.js";
import { CoreEngine } from "../modules/core-engine.js";
import { Logger } from "../modules/logger/index.js";
import { AppState } from "../modules/app-state.js";
import { AppI18n } from "../modules/i18n/index.js";
import { ConversationListManager } from "../modules/conversation-list-manager.js";
import { getMimeTypeFromPath } from "../constants/index.js";
import { SlotController, SlotEvent } from "../modules/slot-controller.js";
import { ButtonStates } from "../ui/button-states.js";
import { isSceneUiMode } from "../ui/ui-mode.js";
import { shellT } from "../app/shell-i18n.js";
import { isAssistantAccountsSettingsPath, isAssistantSlotSettingsPath } from "@shared/settings.js";
import type { Us1RoomPackageCandidate, Us1SessionEvent } from "@shared/us1-mail.js";
import { SceneAlphaWindowFrameController } from "../scene/alpha-window.js";
import { bindSceneBackZones } from "../scene/back-zone.js";
import { navigateToScenePage, openSceneSettingsPanel } from "../scene/navigation.js";
import { getCoverSceneProjectionFromElement } from "../scene/projection.js";
import { getActiveSceneDebugRoomId, SCENE_DEBUG_ROOMS } from "../scene/scene-debug-rooms.js";
import { getSceneRoomBackgroundSrc, getSceneRoomPanelSrc } from "../scene/theme-pack.js";
import { syncSceneViewRuntime } from "../scene/runtime.js";

import { renderMessages, resetMessageRenderState } from "./analyze/message-renderer.js";
import type { RenderCallbacks } from "./analyze/message-renderer.js";
import { createMessageBubble } from "./analyze/message-renderer-bubble.js";
import {
  isAttachmentData,
  isDbAttachmentsResult,
  isDbMessagesResult,
  isMessageItem,
  type AttachmentData,
  type MessageItem,
} from "./analyze/message-renderer-types.js";
import { renderUploadList, addUploadFiles, removeUploadFile } from "./analyze/upload-handler.js";
import type { StagedFile } from "./analyze/upload-handler.js";
import { applyMessageAction, initReadModal } from "./analyze/context-menu.js";
import { initDraft, loadDraft, persistDraft } from "./analyze/draft-manager.js";
import { AnalyzeArchiveOverlayController } from "./analyze/archive-overlay-controller.js";
import {
  EntranceSceneEditor,
  type EntranceSceneEditorSelection,
} from "./entrance/scene/scene-editor.js";
import { resolveSceneAvatarSource } from "./entrance/scene/scene-avatar.js";
import { applySceneDebugFlag } from "./entrance/scene/scene-debug.js";
import {
  buildSceneCharacterRoster,
  type SceneCharacterDescriptor,
} from "./entrance/scene/scene-character-roster.js";
import {
  getSceneHotspotLabelId,
  getSceneNodeKindForHotspot,
  hasSceneHotspotLabel,
  isSceneDebugSelectionForCharacter,
  isSceneDebugSelectionForHotspot,
  type EntranceSceneHotspotConfig,
  type EntranceSceneMap,
} from "./entrance/scene/scene-map.js";
import { createSceneDebugStore } from "../scene/debug-store.js";

interface ConversationSelectedDetail {
  provider?: "ai1" | "ai2" | "us1";
  isNew?: boolean;
  localSessionId?: string | null;
}

interface DraftState {
  message: string;
  files: StagedFile[];
}

type AnalyzeParticipant = "ai1" | "ai2" | "us1";
const ANALYZE_SCENE_DEBUG_STORE = createSceneDebugStore("analyze");

function analyzeT(key: string, params?: TranslationParams): string {
  return AppI18n.t(`app.analyze.${key}`, params);
}

function isConversationSelectedDetail(value: unknown): value is ConversationSelectedDetail {
  if (value === null || value === undefined || typeof value !== "object") {
    return false;
  }

  const maybe = value as Record<string, unknown>;
  const provider = maybe["provider"];
  const isNew = maybe["isNew"];

  const providerValid =
    provider === undefined || provider === "ai1" || provider === "ai2" || provider === "us1";
  const isNewValid = isNew === undefined || typeof isNew === "boolean";
  const localSessionIdValid =
    maybe["localSessionId"] === undefined ||
    maybe["localSessionId"] === null ||
    typeof maybe["localSessionId"] === "string";

  return providerValid && isNewValid && localSessionIdValid;
}

function isDraftState(value: unknown): value is DraftState {
  if (value === null || value === undefined || typeof value !== "object") {
    return false;
  }

  const maybe = value as Record<string, unknown>;
  return typeof maybe["message"] === "string" && Array.isArray(maybe["files"]);
}

export class AnalyzeController {
  archiveOverlay: AnalyzeArchiveOverlayController;
  stagedFiles: StagedFile[];
  lastMessages: Record<AnalyzeParticipant, string>;
  us1SessionId: string | null;
  us1SessionIdentityId: string | null;
  _slotActiveStates: Record<AnalyzeParticipant, boolean>;
  beforeUnloadHandler: (() => void) | null;
  _unsubSettings: (() => void) | null;
  _unsubSlotController: (() => void) | null;
  _unsubAppState: (() => void) | null;
  _unsubI18n: (() => void) | null;
  _boundActions: boolean;
  _us1PollTimer: number | null;
  _us1SyncInFlight: boolean;
  _us1LoadingBusy: boolean;
  _us1SendBusy: boolean;
  _us1AwaitingReply: boolean;
  _syncingUs1Indicators: boolean;
  _analyzeSceneTableOpen: boolean;
  _analyzeSceneDebugEnabled: boolean;
  _analyzeSceneBindingsReady: boolean;
  _analyzeSceneMap: EntranceSceneMap;
  _analyzeSceneEditor: EntranceSceneEditor | null;
  _analyzeSceneSelection: EntranceSceneEditorSelection;
  _analyzeSceneResizeObserver: ResizeObserver | null;
  _analyzeSceneCharacterRenderToken: number;
  _analyzeSceneFrameController: SceneAlphaWindowFrameController | null;

  constructor() {
    this.archiveOverlay = new AnalyzeArchiveOverlayController();
    this.stagedFiles = [];
    this.lastMessages = { ai1: "", ai2: "", us1: "" };
    this.us1SessionId = null;
    this.us1SessionIdentityId = null;
    this._slotActiveStates = { ai1: false, ai2: false, us1: false };
    this.beforeUnloadHandler = null;
    this._unsubSettings = null;
    this._unsubSlotController = null;
    this._unsubAppState = null;
    this._unsubI18n = null;
    this._boundActions = false;
    this._us1PollTimer = null;
    this._us1SyncInFlight = false;
    this._us1LoadingBusy = false;
    this._us1SendBusy = false;
    this._us1AwaitingReply = false;
    this._syncingUs1Indicators = false;
    this._analyzeSceneTableOpen = false;
    this._analyzeSceneDebugEnabled = false;
    this._analyzeSceneBindingsReady = false;
    this._analyzeSceneMap = ANALYZE_SCENE_DEBUG_STORE.cloneDefault();
    this._analyzeSceneEditor = null;
    this._analyzeSceneSelection = null;
    this._analyzeSceneResizeObserver = null;
    this._analyzeSceneCharacterRenderToken = 0;
    this._analyzeSceneFrameController = null;
  }

  async init(): Promise<void> {
    await this.loadSettings();
    this._analyzeSceneDebugEnabled = applySceneDebugFlag();
    this._analyzeSceneMap =
      (this._analyzeSceneDebugEnabled ? ANALYZE_SCENE_DEBUG_STORE.loadDraft() : null) ??
      ANALYZE_SCENE_DEBUG_STORE.cloneDefault();
    this.applyAvatars();
    this.applyNames();

    this._unsubSettings ??= SettingsManager.subscribe(
      ({ changedPaths }: { changedPaths: string[] }) => {
        const shouldRefreshAnalyzeHeader =
          changedPaths.includes("*") ||
          changedPaths.some(
            (path) =>
              path.startsWith("user") ||
              path.startsWith("accounts") ||
              path.startsWith("remoteUsers") ||
              isAssistantAccountsSettingsPath(path) ||
              path.startsWith("slots") ||
              path.startsWith("us1Slot") ||
              isAssistantSlotSettingsPath(path)
          );

        if (!shouldRefreshAnalyzeHeader) {
          return;
        }

        this.applyAvatars();
        this.applyNames();
        this.updateConnectionStates();
        void this._renderAnalyzeSceneCharacters();
      }
    );

    this.bindActions();
    TrafficManager.onUpdate(() => {
      this.updateSendButtonState();
      void this._renderAnalyzeSceneCharacters();
    });

    this._unsubSlotController ??= SlotController.on(SlotEvent.STATE_CHANGED, () => {
      this.applyNames();
      this.updateConnectionStates();
      void this._renderAnalyzeSceneCharacters();
    });

    this._unsubAppState ??= AppState.subscribe(() => {
      this.applyNames();
      void this._renderAnalyzeSceneCharacters();
    });

    this._unsubI18n ??= AppI18n.subscribe(() => {
      this.applyNames();
      this.updateConnectionStates();
      this.refreshUploads();
      this._renderAnalyzeSceneHotspots();
      this._analyzeSceneEditor?.refresh();
      void this._renderMessages("ai1");
      void this._renderMessages("ai2");
      void this._renderUs1Messages();
      void this._renderAnalyzeSceneCharacters();
    });

    this.updateConnectionStates();
    this.refreshUploads();
    await this.archiveOverlay.init();
    this._initializeAnalyzeScene();

    initReadModal();
    void this._initDraftSystem();

    window.addEventListener("conversation-selected", (e) => {
      const rawDetail: unknown = (e as CustomEvent<unknown>).detail;
      const detail = isConversationSelectedDetail(rawDetail) ? rawDetail : {};
      Logger.debug(LogCategory.ANALYZE, analyzeT("logs.conversationSelectedReceived"), { detail });
      if (detail.provider !== undefined) {
        if (detail.isNew === true) {
          Logger.debug(
            LogCategory.ANALYZE,
            analyzeT("logs.newConversationSelected", { provider: detail.provider })
          );
          this._clearSlotMessages(detail.provider);
        } else if (detail.provider === "us1") {
          this.us1SessionId =
            typeof detail.localSessionId === "string" && detail.localSessionId.trim() !== ""
              ? detail.localSessionId.trim()
              : null;
          void this._renderUs1Messages();
        } else {
          Logger.debug(
            LogCategory.ANALYZE,
            analyzeT("logs.renderMessagesForProvider", { provider: detail.provider })
          );
          void this._renderMessages(detail.provider);
        }
      } else {
        Logger.warn(LogCategory.ANALYZE, analyzeT("logs.conversationSelectedMissingProvider"), {
          detail,
        });
      }
    });
  }

  _initializeAnalyzeScene(): void {
    const room = document.querySelector(".analyze-room");
    const tableView = document.getElementById("analyze-scene-table-view");
    const tableArt = document.getElementById("analyze-scene-table-art") as HTMLImageElement | null;

    if (
      room instanceof HTMLElement &&
      tableView instanceof HTMLElement &&
      tableArt instanceof HTMLImageElement
    ) {
      this._analyzeSceneFrameController?.disconnect();
      this._analyzeSceneFrameController = new SceneAlphaWindowFrameController({
        image: tableArt,
        container: tableView,
        target: room,
        variablePrefix: "analyze-scene",
      });
    }

    this._setupAnalyzeSceneDebug();
    this._syncAnalyzeSceneAssets();
    this._bindAnalyzeSceneEvents();
    this._renderAnalyzeScene();
    this._syncAnalyzeSceneVisibility();
    this._observeAnalyzeSceneLayout();
  }

  _syncAnalyzeSceneAssets(): void {
    const background = document.getElementById(
      "analyze-scene-background"
    ) as HTMLImageElement | null;
    const tableArt = document.getElementById("analyze-scene-table-art") as HTMLImageElement | null;
    const archiveArt = document.getElementById(
      "analyze-archive-scene-art"
    ) as HTMLImageElement | null;

    if (background !== null) {
      background.src = getSceneRoomBackgroundSrc("analyze");
      background.alt = "";
    }

    if (tableArt !== null) {
      tableArt.src = getSceneRoomPanelSrc("analyze", "table") ?? "";
      tableArt.alt = "";
    }

    if (archiveArt !== null) {
      archiveArt.src = getSceneRoomPanelSrc("analyze", "archive") ?? "";
      archiveArt.alt = "";
    }

    this._analyzeSceneFrameController?.refresh();
  }

  _setupAnalyzeSceneDebug(): void {
    const editorHost = document.getElementById("analyze-scene-editor-host");
    if (!(editorHost instanceof HTMLElement)) {
      this._analyzeSceneEditor = null;
      return;
    }

    if (!this._analyzeSceneDebugEnabled) {
      editorHost.replaceChildren();
      this._analyzeSceneEditor = null;
      return;
    }

    this._analyzeSceneEditor = new EntranceSceneEditor(editorHost, {
      isActive: (): boolean => this._isAnalyzeSceneDebugActive(),
      getSceneMap: (): EntranceSceneMap => this._analyzeSceneMap,
      getSelection: (): EntranceSceneEditorSelection => this._analyzeSceneSelection,
      getRoomOptions: (): Array<{ id: string; label: string }> =>
        SCENE_DEBUG_ROOMS.map((room) => ({
          id: room.id,
          label: shellT(room.labelKey),
        })),
      getActiveRoomId: (): string => "analyze",
      setSelection: (selection): void => {
        this._analyzeSceneSelection = selection;
        this._analyzeSceneEditor?.refresh();
        this._renderAnalyzeScene();
      },
      navigateToRoom: (roomId: string): void => {
        this._navigateToAnalyzeSceneDebugRoom(roomId);
      },
      updateHotspot: (id, updater): void => {
        this._analyzeSceneMap.hotspots = this._analyzeSceneMap.hotspots.map((hotspot) =>
          hotspot.id === id ? updater(hotspot) : hotspot
        );
        this._persistAnalyzeSceneMapDraft();
        this._renderAnalyzeScene();
        this._analyzeSceneEditor?.refresh();
      },
      updateLabelNode: (id, updater): void => {
        this._analyzeSceneMap.hotspots = this._analyzeSceneMap.hotspots.map((hotspot) =>
          getSceneHotspotLabelId(hotspot.id) === id ? updater(hotspot) : hotspot
        );
        this._persistAnalyzeSceneMapDraft();
        this._renderAnalyzeScene();
        this._analyzeSceneEditor?.refresh();
      },
      updateCharacterAnchor: (id, updater): void => {
        this._analyzeSceneMap.characterAnchors = this._analyzeSceneMap.characterAnchors.map(
          (anchor) => (anchor.id === id ? updater(anchor) : anchor)
        );
        this._persistAnalyzeSceneMapDraft();
        this._renderAnalyzeScene();
        this._analyzeSceneEditor?.refresh();
      },
      resetDraft: (): void => {
        this._analyzeSceneMap = ANALYZE_SCENE_DEBUG_STORE.cloneDefault();
        ANALYZE_SCENE_DEBUG_STORE.clearDraft();
        this._analyzeSceneSelection = null;
        this._renderAnalyzeScene();
        this._analyzeSceneEditor?.refresh();
      },
      copySceneMap: async (): Promise<void> => {
        try {
          await ANALYZE_SCENE_DEBUG_STORE.copyToClipboard(this._analyzeSceneMap);
        } catch {
          console.info("Analyze scene map copy failed.");
        }
      },
    });
    this._analyzeSceneEditor.refresh();
  }

  _observeAnalyzeSceneLayout(): void {
    const sceneRoot = document.getElementById("analyze-scene-root");
    if (!(sceneRoot instanceof HTMLElement) || typeof ResizeObserver === "undefined") {
      return;
    }

    this._analyzeSceneResizeObserver?.disconnect();
    this._analyzeSceneResizeObserver = new ResizeObserver(() => {
      if (!isSceneUiMode()) {
        return;
      }
      this._renderAnalyzeScene();
      this._analyzeSceneEditor?.refresh();
    });
    this._analyzeSceneResizeObserver.observe(sceneRoot);
  }

  _renderAnalyzeScene(): void {
    this._renderAnalyzeSceneHotspots();
    void this._renderAnalyzeSceneCharacters();
  }

  _renderAnalyzeSceneHotspots(): void {
    const hotspotLayer = document.getElementById("analyze-scene-hotspots");
    if (!(hotspotLayer instanceof HTMLElement)) {
      return;
    }

    const projection = this._getAnalyzeSceneProjection();
    const fragment = document.createDocumentFragment();

    this._analyzeSceneMap.hotspots.forEach((hotspot) => {
      const labelText = this._resolveAnalyzeSceneHotspotLabel(hotspot);
      const shouldRenderLabel = hasSceneHotspotLabel(hotspot);
      const selected = isSceneDebugSelectionForHotspot(this._analyzeSceneSelection, hotspot);
      const wrapper = document.createElement("div");
      wrapper.className = "analyze-scene__hotspot-item";

      const button = document.createElement("button");
      button.type = "button";
      button.className = "analyze-scene__hotspot";
      button.dataset["hotspotId"] = hotspot.id;
      button.dataset["frameVariant"] = hotspot.frameVariant;
      button.classList.toggle("is-selected", selected);
      button.style.setProperty(
        "--analyze-scene-hotspot-left",
        `${projection.offsetX + hotspot.leftPx * projection.scale}px`
      );
      button.style.setProperty(
        "--analyze-scene-hotspot-top",
        `${projection.offsetY + hotspot.topPx * projection.scale}px`
      );
      button.style.setProperty(
        "--analyze-scene-hotspot-width",
        `${hotspot.widthPx * projection.scale}px`
      );
      button.style.setProperty(
        "--analyze-scene-hotspot-height",
        `${hotspot.heightPx * projection.scale}px`
      );
      button.style.setProperty(
        "--analyze-scene-hotspot-frame-rotate",
        `${hotspot.frameRotateDeg}deg`
      );
      button.style.setProperty(
        "--analyze-scene-hotspot-frame-perspective",
        `${hotspot.framePerspectiveDeg}deg`
      );
      button.style.setProperty(
        "--analyze-scene-hotspot-hover-glow-hue",
        `${hotspot.frameHoverGlowHueDeg}deg`
      );
      button.style.setProperty(
        "--analyze-scene-hotspot-hover-glow-alpha",
        `${hotspot.frameHoverGlowAlpha}`
      );
      button.ariaLabel = labelText;
      button.addEventListener("click", () => {
        this._handleAnalyzeSceneHotspotInteraction(hotspot, getSceneNodeKindForHotspot(hotspot));
      });

      if (shouldRenderLabel) {
        const label = document.createElement("span");
        label.className = "analyze-scene__hotspot-label";
        label.classList.toggle("is-selected", selected);
        label.textContent = labelText;
        label.ariaHidden = "true";
        label.style.setProperty(
          "--analyze-scene-hotspot-label-left",
          `${projection.offsetX + hotspot.labelCenterXPx * projection.scale}px`
        );
        label.style.setProperty(
          "--analyze-scene-hotspot-label-top",
          `${projection.offsetY + hotspot.labelTopPx * projection.scale}px`
        );
        label.style.setProperty(
          "--analyze-scene-hotspot-label-width",
          `${hotspot.labelWidthPx * projection.scale}px`
        );
        label.style.setProperty(
          "--analyze-scene-hotspot-label-height",
          `${hotspot.labelHeightPx * projection.scale}px`
        );
        label.style.setProperty(
          "--analyze-scene-hotspot-label-rotate",
          `${hotspot.labelRotateDeg}deg`
        );
        label.style.setProperty(
          "--analyze-scene-hotspot-label-frame-perspective",
          `${hotspot.labelFramePerspectiveDeg}deg`
        );
        label.style.setProperty(
          "--analyze-scene-hotspot-label-font-size",
          `${hotspot.labelFontSizePx * projection.scale}px`
        );
        label.style.setProperty(
          "--analyze-scene-hotspot-label-letter-spacing",
          `${hotspot.labelLetterSpacingPx * projection.scale}px`
        );
        label.addEventListener("click", () => {
          this._handleAnalyzeSceneHotspotInteraction(hotspot, "label");
        });

        wrapper.append(button, label);
      } else {
        wrapper.append(button);
      }

      fragment.appendChild(wrapper);
    });

    hotspotLayer.replaceChildren(fragment);
  }

  async _renderAnalyzeSceneCharacters(): Promise<void> {
    const characterLayer = document.getElementById("analyze-scene-characters");
    if (!(characterLayer instanceof HTMLElement)) {
      return;
    }

    if (!isSceneUiMode()) {
      characterLayer.replaceChildren();
      return;
    }

    const hasConnectedAi = SlotController.isConnected("ai1") || SlotController.isConnected("ai2");
    const roster: SceneCharacterDescriptor[] = buildSceneCharacterRoster(
      this._analyzeSceneMap.characterAnchors
    ).filter((character) => {
      if (character.kind === "user") {
        return true;
      }

      if (!hasConnectedAi) {
        return false;
      }

      if (character.slot === "ai1") {
        return SlotController.isConnected("ai1");
      }

      if (character.slot === "ai2") {
        return SlotController.isConnected("ai2");
      }

      if (character.slot === "us1") {
        return AppState.isUs1Connected();
      }

      return false;
    });

    const renderToken = ++this._analyzeSceneCharacterRenderToken;
    const projection = this._getAnalyzeSceneProjection();
    const avatarSources = await Promise.all(
      roster.map(async (character) => await resolveSceneAvatarSource(character.avatarSource))
    );

    if (renderToken !== this._analyzeSceneCharacterRenderToken) {
      return;
    }

    const fragment = document.createDocumentFragment();
    roster.forEach((character, index) => {
      const avatarSource = avatarSources[index] ?? null;
      const depth = Number.isFinite(character.depth) ? Math.max(1, character.depth) : 1;
      const characterNode = document.createElement("div");
      characterNode.className = `entrance-scene__character analyze-scene__character is-${character.state}`;
      if (character.slot !== null) {
        characterNode.dataset["slot"] = character.slot;
      }
      characterNode.dataset["characterId"] = character.id;
      characterNode.dataset["kind"] = character.kind;
      characterNode.dataset["role"] = character.role;
      characterNode.dataset["variant"] = character.variant;
      characterNode.dataset["anchorId"] = character.anchorId;
      characterNode.classList.toggle(
        "is-selected",
        isSceneDebugSelectionForCharacter(this._analyzeSceneSelection, {
          id: character.anchorId,
        })
      );
      characterNode.style.setProperty(
        "--scene-character-left",
        `${projection.offsetX + character.leftPx * projection.scale}px`
      );
      characterNode.style.setProperty(
        "--scene-character-bottom",
        `${projection.offsetY + character.bottomPx * projection.scale}px`
      );
      characterNode.style.setProperty("--scene-character-scale", String(character.scale));
      characterNode.style.setProperty("--scene-character-depth", String(depth));
      characterNode.style.setProperty(
        "--scene-character-depth-scale",
        String(this._getAnalyzeSceneDepthScale(depth))
      );
      characterNode.style.setProperty("--scene-character-body-scale", String(character.bodyScale));
      characterNode.style.setProperty("--scene-character-head-top", `${character.headTopPct}%`);
      characterNode.style.setProperty("--scene-character-head-left", `${character.headLeftPct}%`);
      characterNode.style.setProperty("--scene-character-head-size", `${character.headSizePct}%`);
      characterNode.style.setProperty(
        "--scene-character-avatar-scale",
        String(character.avatarScale)
      );

      if (this._analyzeSceneEditor !== null) {
        characterNode.tabIndex = 0;
        characterNode.role = "button";
        characterNode.setAttribute("aria-label", character.label);
      } else {
        characterNode.tabIndex = -1;
        characterNode.removeAttribute("role");
        characterNode.removeAttribute("aria-label");
      }

      const stage = document.createElement("div");
      stage.className = "entrance-scene__character-stage";

      const body = document.createElement("img");
      body.className = "entrance-scene__character-body";
      body.src = character.bodySrc;
      body.alt = "";
      body.ariaHidden = "true";
      stage.appendChild(body);

      const head = document.createElement("span");
      head.className = "entrance-scene__character-head";
      head.ariaHidden = "true";
      if (avatarSource !== null) {
        const avatar = document.createElement("img");
        avatar.className = "entrance-scene__character-avatar";
        avatar.src = avatarSource;
        avatar.alt = "";
        avatar.ariaHidden = "true";
        head.appendChild(avatar);
      } else {
        const fallback = document.createElement("span");
        fallback.className = "entrance-scene__character-head-fallback";
        fallback.ariaHidden = "true";
        fallback.textContent = character.headLabel ?? "?";
        head.appendChild(fallback);
      }
      stage.appendChild(head);

      const label = document.createElement("span");
      label.className = "entrance-scene__character-label";
      label.textContent = character.label;

      const anchorMarker = document.createElement("span");
      anchorMarker.className = "entrance-scene__character-anchor-marker";
      anchorMarker.ariaHidden = String(!this._analyzeSceneDebugEnabled);
      anchorMarker.textContent = character.anchorId;

      characterNode.append(stage, label, anchorMarker);
      characterNode.addEventListener("click", () => {
        if (this._analyzeSceneEditor === null) {
          return;
        }
        this._analyzeSceneSelection = { kind: "character", id: character.anchorId };
        this._analyzeSceneEditor.refresh();
        this._renderAnalyzeScene();
      });
      characterNode.addEventListener("keydown", (event: KeyboardEvent) => {
        if (this._analyzeSceneEditor === null) {
          return;
        }
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }
        event.preventDefault();
        this._analyzeSceneSelection = { kind: "character", id: character.anchorId };
        this._analyzeSceneEditor.refresh();
        this._renderAnalyzeScene();
      });

      fragment.appendChild(characterNode);
    });

    characterLayer.replaceChildren(fragment);
  }

  _getAnalyzeSceneProjection(): { offsetX: number; offsetY: number; scale: number } {
    const sceneRoot = document.getElementById("analyze-scene-root");
    return getCoverSceneProjectionFromElement(
      sceneRoot instanceof HTMLElement ? sceneRoot : null,
      this._analyzeSceneMap.referenceSize
    );
  }

  _getAnalyzeSceneDepthScale(depth: number): number {
    const normalizedDepth = Math.max(1, Number.isFinite(depth) ? depth : 1);
    const scaled = 1 - (normalizedDepth - 1) * 0.02;
    return Number(Math.max(0.75, scaled).toFixed(3));
  }

  _resolveAnalyzeSceneHotspot(hotspotId: string): EntranceSceneHotspotConfig | null {
    return this._analyzeSceneMap.hotspots.find((item) => item.id === hotspotId) ?? null;
  }

  _resolveAnalyzeSceneHotspotLabel(hotspot: EntranceSceneHotspotConfig): string {
    const customLabel =
      typeof hotspot.labelCustomText === "string" ? hotspot.labelCustomText.trim() : "";
    if (customLabel !== "") {
      return customLabel;
    }
    if (hotspot.labelKey !== "") {
      return shellT(hotspot.labelKey);
    }
    return hotspot.id;
  }

  _persistAnalyzeSceneMapDraft(): void {
    ANALYZE_SCENE_DEBUG_STORE.saveDraft(this._analyzeSceneMap);
  }

  _isAnalyzeSceneDebugActive(): boolean {
    return (
      isSceneUiMode() &&
      (getActiveSceneDebugRoomId() ?? document.documentElement.getAttribute("data-active-page")) ===
        "analyze"
    );
  }

  _bindAnalyzeSceneEvents(): void {
    if (this._analyzeSceneBindingsReady) {
      return;
    }

    const sceneRoot = document.getElementById("analyze-scene-root");
    const archiveOverlay = document.getElementById("analyze-archive-overlay");

    if (sceneRoot !== null) {
      bindSceneBackZones(sceneRoot, () => {
        this._setAnalyzeSceneTableOpen(false);
      });
    }

    if (archiveOverlay !== null) {
      bindSceneBackZones(archiveOverlay, () => {
        this.archiveOverlay.close();
      });
    }

    this._analyzeSceneBindingsReady = true;
  }

  _handleAnalyzeSceneHotspotInteraction(
    hotspot: EntranceSceneHotspotConfig,
    selectionKind: "door" | "object" | "label"
  ): void {
    if (this._analyzeSceneEditor !== null) {
      this._analyzeSceneSelection = {
        kind: selectionKind,
        id: selectionKind === "label" ? getSceneHotspotLabelId(hotspot.id) : hotspot.id,
      };
      this._analyzeSceneEditor.refresh();
      this._renderAnalyzeScene();
      return;
    }

    this._handleAnalyzeSceneHotspotAction(hotspot);
  }

  _handleAnalyzeSceneHotspotAction(hotspot: EntranceSceneHotspotConfig): void {
    if (hotspot.action.type === "navigate") {
      this.archiveOverlay.close();
      this._setAnalyzeSceneTableOpen(false);
      this._navigateToPage(hotspot.action.page);
      return;
    }

    if (hotspot.action.type !== "screen") {
      return;
    }

    if (hotspot.action.screen === "archive") {
      void this.archiveOverlay.open();
      return;
    }

    this.archiveOverlay.close();
    this._setAnalyzeSceneTableOpen(true);
  }

  _setAnalyzeSceneTableOpen(open: boolean): void {
    this._analyzeSceneTableOpen = open;
    this._syncAnalyzeSceneVisibility();
  }

  _syncAnalyzeSceneVisibility(): void {
    const sceneRoot = document.getElementById("analyze-scene-root");
    const tableView = document.getElementById("analyze-scene-table-view");
    const room = document.querySelector(".analyze-room");
    const sceneActive = isSceneUiMode();

    syncSceneViewRuntime({
      elements: {
        root: sceneRoot instanceof HTMLElement ? sceneRoot : null,
        view: tableView instanceof HTMLElement ? tableView : null,
        room: room instanceof HTMLElement ? room : null,
      },
      state: {
        sceneActive,
        viewOpen: this._analyzeSceneTableOpen,
        roomOpenClass: "is-scene-table-open",
      },
    });

    if (!sceneActive) {
      return;
    }

    this._syncAnalyzeSceneAssets();
    this._analyzeSceneFrameController?.refresh();
    this._renderAnalyzeScene();
    this._analyzeSceneEditor?.refresh();
  }

  _navigateToPage(page: string): void {
    navigateToScenePage(page);
  }

  _navigateToAnalyzeSceneDebugRoom(roomId: string): void {
    this.archiveOverlay.close();
    this._setAnalyzeSceneTableOpen(false);
    if (roomId === "settings") {
      openSceneSettingsPanel(null);
      return;
    }

    this._navigateToPage(roomId);
  }

  async loadSettings(): Promise<void> {
    await SettingsManager.load();
  }

  applyAvatars(): void {
    const avatarTargets: Array<{
      provider: "user" | "ai1" | "ai2" | "us1";
      elementId: string;
      fallbackText?: string;
    }> = [
      { provider: "ai1", elementId: "avatar-ai1" },
      { provider: "ai2", elementId: "avatar-ai2" },
      { provider: "us1", elementId: "avatar-us1", fallbackText: "US" },
      { provider: "user", elementId: "avatar-user-compose", fallbackText: "U" },
    ];

    avatarTargets.forEach(({ provider, elementId, fallbackText = "" }) => {
      const configuredPath = AppState.getAvatar(provider).trim();
      const isUser = provider === "user";
      const isUs1 = provider === "us1";
      const slotAssigned = isUser
        ? true
        : isUs1
          ? AppState.hasUs1Identity()
          : AppState.getAccountForSlot(provider) !== null;

      const el = document.getElementById(elementId);
      if (!el) return;

      if (!slotAssigned) {
        el.textContent = "";
        el.innerHTML = "";
        return;
      }

      const electronApi = window.electronAPI;
      if (electronApi === undefined) {
        el.textContent = fallbackText;
        return;
      }

      const fallbackCandidates: string[] = [];
      if (isUser) {
        fallbackCandidates.push("src/assets/user.png", "src/assets/default.png");
      } else {
        const providerId = isUs1 ? "" : (AppState.getProviderIdForSlot(provider) ?? "");
        if (providerId !== "") {
          fallbackCandidates.push(`src/assets/${providerId}.png`);
        }
        fallbackCandidates.push("src/assets/default.png");
      }

      const candidates = [configuredPath, ...fallbackCandidates];
      const filteredCandidates = candidates.filter(
        (candidate, index, arr) => candidate !== "" && arr.indexOf(candidate) === index
      );

      const tryLoad = (index: number): void => {
        const candidate = filteredCandidates[index];
        if (candidate === undefined) {
          el.textContent = fallbackText;
          return;
        }

        electronApi
          .readFile(candidate)
          .then((data) => {
            const base64 = String(data ?? "");
            if (base64 === "") {
              tryLoad(index + 1);
              return;
            }

            const mime = getMimeTypeFromPath(candidate);
            el.innerHTML = `<img src="data:${mime};base64,${base64}" alt="${provider} avatar" class="img-cover" />`;
          })
          .catch(() => {
            tryLoad(index + 1);
          });
      };

      tryLoad(0);
    });
  }

  applyNames(): void {
    const nickUser = AppState.getNickname("user");
    const nickAi1 = AppState.getNickname("ai1");
    const nickAi2 = AppState.getNickname("ai2");
    const nickUs1 = AppState.getNickname("us1");

    const nameAi1 = document.getElementById("name-ai1");
    const nameAi2 = document.getElementById("name-ai2");
    const nameUs1 = document.getElementById("name-us1");
    if (nameAi1) nameAi1.textContent = nickAi1;
    if (nameAi2) nameAi2.textContent = nickAi2;
    if (nameUs1) nameUs1.textContent = nickUs1;

    const sendLabelAi1 = document.getElementById("send-ai1-label");
    const sendLabelAi2 = document.getElementById("send-ai2-label");
    const sendLabelUs1 = document.getElementById("send-us1-label");
    const nameUserCompose = document.getElementById("name-user-compose");
    if (sendLabelAi1) sendLabelAi1.textContent = nickAi1;
    if (sendLabelAi2) sendLabelAi2.textContent = nickAi2;
    if (sendLabelUs1) sendLabelUs1.textContent = nickUs1;
    if (nameUserCompose) nameUserCompose.textContent = nickUser;
  }

  _syncUs1IdentityContext(): void {
    const identityId = AppState.getUs1ArchiveAccountId();
    if (identityId === this.us1SessionIdentityId) {
      return;
    }

    this.us1SessionIdentityId = identityId;
    this.us1SessionId = null;
    this.lastMessages.us1 = "";
    AppState.setActiveConversation("us1", null);
  }

  _createUs1LocalSessionId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  _ensureUs1LocalSessionId(): string | null {
    this._syncUs1IdentityContext();
    if (this.us1SessionIdentityId === null) {
      return null;
    }

    if (this.us1SessionId === null || this.us1SessionId === "") {
      this.us1SessionId = this._createUs1LocalSessionId();
    }

    return this.us1SessionId;
  }

  _chooseUs1AutoOpenSession(
    sessionEvents: Us1SessionEvent[],
    options: {
      currentSessionId: string | null;
      currentConversationId: string | null;
      isNewSelected: boolean;
      composeHasDraft: boolean;
    }
  ): Us1SessionEvent | null {
    const eligibleEvents = sessionEvents.filter(
      (sessionEvent) =>
        sessionEvent.localSessionId.trim() !== "" && sessionEvent.conversationId.trim() !== ""
    );
    if (eligibleEvents.length === 0) {
      return null;
    }

    const currentMatch =
      [...eligibleEvents]
        .reverse()
        .find(
          (sessionEvent) =>
            (options.currentSessionId !== null &&
              sessionEvent.localSessionId === options.currentSessionId) ||
            (options.currentConversationId !== null &&
              sessionEvent.conversationId === options.currentConversationId)
        ) ?? null;
    if (currentMatch !== null) {
      return currentMatch;
    }

    if (options.currentConversationId === null || options.isNewSelected === true) {
      return eligibleEvents[eligibleEvents.length - 1] ?? null;
    }

    if (options.composeHasDraft === false && options.currentSessionId === null) {
      return eligibleEvents[eligibleEvents.length - 1] ?? null;
    }

    return null;
  }

  _applyUs1PendingSessions(
    sessionEvents: Us1SessionEvent[],
    activeSessionId: string | null,
    activeConversationId: string | null
  ): void {
    const seenSessionIds = new Set<string>();
    for (const sessionEvent of sessionEvents) {
      const localSessionId = sessionEvent.localSessionId.trim();
      const conversationId = sessionEvent.conversationId.trim();
      if (localSessionId === "" || conversationId === "" || seenSessionIds.has(localSessionId)) {
        continue;
      }
      seenSessionIds.add(localSessionId);

      if (
        (activeSessionId !== null && localSessionId === activeSessionId) ||
        (activeConversationId !== null && conversationId === activeConversationId)
      ) {
        AppState.clearUs1PendingSession(localSessionId);
        AppState.clearUs1PendingSessionByConversation(conversationId);
        continue;
      }

      const updatedAt = sessionEvent.sentAt ?? sessionEvent.createdAt;
      AppState.markUs1PendingSession(localSessionId, {
        conversationId,
        unreadDelta: 1,
        ...(updatedAt !== undefined ? { updatedAt } : {}),
      });
    }
  }

  updateConnectionStates(): void {
    this._syncUs1IdentityContext();

    const composeInput = document.getElementById("compose-input") as HTMLTextAreaElement | null;
    const uploadBtn = document.getElementById("upload-add-btn") as HTMLButtonElement | null;
    const sendBtn = document.getElementById("compose-send-btn") as HTMLButtonElement | null;
    if (composeInput) composeInput.disabled = false;
    if (uploadBtn) uploadBtn.disabled = false;
    if (sendBtn) sendBtn.disabled = false;

    const ai1Connected = SlotController.isConnected("ai1");
    const ai2Connected = SlotController.isConnected("ai2");
    const ai1HasAccount = !!AppState.getAccountForSlot("ai1");
    const ai2HasAccount = !!AppState.getAccountForSlot("ai2");
    const us1Connected = AppState.isUs1Connected();
    const us1HasIdentity = AppState.hasUs1Identity();
    if (us1Connected === false) {
      this._us1AwaitingReply = false;
    }

    (["ai1", "ai2", "us1"] as const).forEach((slot) => {
      const hasAccount =
        slot === "ai1" ? ai1HasAccount : slot === "ai2" ? ai2HasAccount : us1HasIdentity;
      const connected =
        slot === "ai1" ? ai1Connected : slot === "ai2" ? ai2Connected : us1Connected;
      const isActive = hasAccount && connected;
      const wasActive = this._slotActiveStates[slot];

      this._updateSlotUI(slot, hasAccount, connected);

      if (wasActive && !isActive) {
        this._clearSlotMessages(slot);
      }

      this._slotActiveStates[slot] = isActive;
    });

    this._applyUs1Indicators(us1Connected);

    this._updateGridLayout({
      ai1: ai1HasAccount,
      ai2: ai2HasAccount,
      us1: us1HasIdentity,
    });
    void this._renderUs1Messages();

    this._updateAIAIControls();
  }

  _updateSlotUI(slot: string, hasAccount: boolean, connected: boolean): void {
    const card = document.getElementById(`card-${slot}`);
    const status = document.getElementById(`status-${slot}`);
    const sendToggle = document.getElementById(`send-${slot}`);

    if (status) {
      if (!hasAccount) status.textContent = analyzeT("page.slotEmptyStatus");
      else if (connected) status.textContent = analyzeT("page.connectedStatus");
      else status.textContent = analyzeT("page.disconnectedStatus");
    }

    if (card) {
      card.classList.toggle("slot-empty", !hasAccount);
      card.classList.toggle("slot-disconnected", hasAccount && !connected);
      card.classList.toggle("slot-connected", hasAccount && connected);
    }

    if (sendToggle) {
      (sendToggle as HTMLInputElement).disabled = !hasAccount || !connected;
      if (!hasAccount || !connected) (sendToggle as HTMLInputElement).checked = false;
    }
  }

  _updateGridLayout(participants: Record<AnalyzeParticipant, boolean>): void {
    const grid = document.querySelector(".conversation-grid");
    const cardAi1 = document.getElementById("card-ai1");
    const cardAi2 = document.getElementById("card-ai2");
    const cardUs1 = document.getElementById("card-us1");

    if (!grid) return;

    const configuredParticipants = (
      Object.entries(participants) as Array<[AnalyzeParticipant, boolean]>
    )
      .filter(([, visible]) => visible)
      .map(([slot]) => slot);
    const fallbackParticipants: AnalyzeParticipant[] = ["ai1", "ai2"];
    const visibleParticipants =
      configuredParticipants.length > 0 ? configuredParticipants : fallbackParticipants;
    const participantCount = Math.min(3, Math.max(1, visibleParticipants.length));

    grid.classList.remove("participant-count-1", "participant-count-2", "participant-count-3");
    grid.classList.add(`participant-count-${participantCount}`);

    if (cardAi1) cardAi1.classList.toggle("is-hidden", !visibleParticipants.includes("ai1"));
    if (cardAi2) cardAi2.classList.toggle("is-hidden", !visibleParticipants.includes("ai2"));
    if (cardUs1) cardUs1.classList.toggle("is-hidden", !visibleParticipants.includes("us1"));
  }

  _updateAIAIControls(): void {
    const ai1Assigned = !!AppState.getAccountForSlot("ai1");
    const ai2Assigned = !!AppState.getAccountForSlot("ai2");
    const ai1Connected = SlotController.isConnected("ai1") === true;
    const ai2Connected = SlotController.isConnected("ai2") === true;
    const bothAIsConnected = ai1Connected && ai2Connected;
    const aiChatEnabled = ai1Assigned && ai2Assigned && bothAIsConnected;

    const analyzeBtn = document.getElementById("compose-start-btn") as HTMLButtonElement | null;
    if (analyzeBtn) analyzeBtn.disabled = !aiChatEnabled;

    const analyzeStopBtn = document.getElementById("compose-stop-btn") as HTMLButtonElement | null;
    if (analyzeStopBtn) analyzeStopBtn.disabled = !aiChatEnabled;

    this._updateCrossCheckboxState();
  }

  bindActions(): void {
    if (this._boundActions) return;
    this._boundActions = true;

    document.getElementById("compose-start-btn")?.addEventListener("click", () => {
      void this.handleAnalyzeStart();
    });

    document.getElementById("compose-stop-btn")?.addEventListener("click", () => {
      void this.handleAnalyzeStop();
    });

    // NOTE: Prevent duplicate sends while the button is already loading.
    const sendBtn = document.getElementById("compose-send-btn") as HTMLButtonElement | null;
    if (sendBtn) {
      sendBtn.addEventListener("click", () => {
        if (ButtonStates.isLoading(sendBtn)) {
          Logger.debug(LogCategory.ANALYZE, analyzeT("logs.sendIgnoredWhileLoading"));
          return;
        }
        this.handleSend();
      });
    }

    document.getElementById("upload-add-btn")?.addEventListener("click", () => {
      void this.handleUploadClick();
    });
    document.getElementById("compose-input")?.addEventListener("input", () => {
      this.updateSendButtonState();
    });

    // NOTE: Allow Ctrl+Enter sends while still preventing duplicate dispatches.
    document.getElementById("compose-input")?.addEventListener("keydown", (e) => {
      if (e.ctrlKey && e.key === "Enter") {
        e.preventDefault();
        const sendBtn = document.getElementById("compose-send-btn") as HTMLButtonElement | null;
        if (sendBtn && ButtonStates.isLoading(sendBtn)) {
          Logger.debug(LogCategory.ANALYZE, analyzeT("logs.sendShortcutIgnoredWhileLoading"));
          return;
        }
        this.handleSend();
      }
    });

    ["send-ai1", "send-ai2", "send-us1", "send-cross"].forEach((id) => {
      document.getElementById(id)?.addEventListener("change", () => {
        this.updateSendButtonState();
      });
    });
  }

  _clearSlotMessages(provider: string): void {
    if (provider === "ai1" || provider === "ai2") {
      resetMessageRenderState(provider);
    } else if (provider === "us1") {
      this.us1SessionId = null;
      AppState.setActiveConversation("us1", null);
      this._us1AwaitingReply = false;
      this._applyUs1Indicators(AppState.isUs1Connected());
    }
    const container = document.getElementById(`messages-${provider}`);
    if (container) {
      container.innerHTML = "";
    }
    if (provider === "ai1" || provider === "ai2" || provider === "us1") {
      this.lastMessages[provider] = "";
    }
    Logger.info(LogCategory.ANALYZE, analyzeT("logs.slotMessagesCleared", { provider }));
  }

  async _renderMessages(provider: "ai1" | "ai2"): Promise<void> {
    Logger.debug(LogCategory.ANALYZE, analyzeT("logs.renderMessagesStarted", { provider }));
    const callbacks: RenderCallbacks = {
      onMessageAction: (action, payload: { provider: string; text: string }) => {
        applyMessageAction(action, payload, () => {
          this.updateSendButtonState();
        });
      },
    };
    const result = await renderMessages(provider, callbacks);
    Logger.debug(LogCategory.ANALYZE, analyzeT("logs.renderMessagesCompleted", { provider }), {
      lastMessage: result.lastMessage.substring(0, 50),
    });
    this.lastMessages[provider] = result.lastMessage;
  }

  async _renderUs1Messages(): Promise<void> {
    const container = document.getElementById("messages-us1");
    if (!(container instanceof HTMLElement)) {
      return;
    }

    const electronApi = window.electronAPI;
    const accountId = AppState.getUs1ArchiveAccountId();
    const conversationId = AppState.getState().activeConversations["us1"] ?? null;
    if (
      electronApi === undefined ||
      typeof electronApi.dbGetMessages !== "function" ||
      typeof electronApi["dbGetAttachments"] !== "function" ||
      accountId === null ||
      conversationId === null
    ) {
      container.innerHTML = "";
      const placeholder = document.createElement("div");
      placeholder.className = "message-placeholder";
      placeholder.textContent = analyzeT("page.noMessages");
      container.appendChild(placeholder);
      this.lastMessages.us1 = "";
      this._us1AwaitingReply = false;
      this._applyUs1Indicators(AppState.isUs1Connected());
      return;
    }

    const rawMessages = await electronApi.dbGetMessages({ accountId, conversationId });
    const rawAttachments = await electronApi["dbGetAttachments"]({ accountId, conversationId });
    const messagesResult = isDbMessagesResult(rawMessages) ? rawMessages : {};
    const attachmentsResult = isDbAttachmentsResult(rawAttachments) ? rawAttachments : {};
    const rawMessageItems = Array.isArray(messagesResult.data)
      ? (messagesResult.data as unknown[])
      : [];
    const rawAttachmentItems = Array.isArray(attachmentsResult.data)
      ? (attachmentsResult.data as unknown[])
      : [];
    const messages = rawMessageItems.filter((message): message is MessageItem =>
      isMessageItem(message)
    );
    const attachments = rawAttachmentItems.filter((attachment): attachment is AttachmentData =>
      isAttachmentData(attachment)
    );

    container.innerHTML = "";

    if (messages.length === 0) {
      const placeholder = document.createElement("div");
      placeholder.className = "message-placeholder";
      placeholder.textContent = analyzeT("page.noMessages");
      container.appendChild(placeholder);
      this.lastMessages.us1 = "";
      this._us1AwaitingReply = false;
      this._applyUs1Indicators(AppState.isUs1Connected());
      return;
    }

    const attachmentsByMessage = attachments.reduce<Record<string, AttachmentData[]>>(
      (acc, attachment) => {
        acc[attachment.messageId] ??= [];
        acc[attachment.messageId]?.push(attachment);
        return acc;
      },
      {}
    );
    const callbacks: RenderCallbacks = {
      onMessageAction: (action, payload: { provider: string; text: string }) => {
        applyMessageAction(action, payload, () => {
          this.updateSendButtonState();
        });
      },
    };
    const attachmentsBasePath = `data/${accountId}/attachments/${conversationId}`;

    messages.forEach((message) => {
      container.appendChild(
        createMessageBubble(
          message,
          "us1",
          attachmentsBasePath,
          attachmentsByMessage[message.id] ?? [],
          callbacks
        )
      );
    });

    const lastAssistant = [...messages]
      .reverse()
      .find(
        (message) =>
          message.role === "assistant" && (message.content ?? message.text ?? "").trim() !== ""
      );
    const lastMeaningful = [...messages].reverse().find((message) => {
      const text = (message.content ?? message.text ?? "").trim();
      return text !== "" && (message.role === "assistant" || message.role === "user");
    });
    this.lastMessages.us1 = lastAssistant?.content ?? lastAssistant?.text ?? "";
    this._us1AwaitingReply = lastMeaningful?.role === "user";
    AppState.clearUs1PendingSession(this.us1SessionId);
    AppState.clearUs1PendingSessionByConversation(conversationId);
    container.scrollTop = container.scrollHeight;
    this._applyUs1Indicators(AppState.isUs1Connected());
  }

  _applyUs1Indicators(connected: boolean): void {
    if (this._syncingUs1Indicators) {
      return;
    }

    this._syncingUs1Indicators = true;
    try {
      TrafficManager.setIndicator("us1", "loading", this._us1LoadingBusy ? "busy" : "idle");
      TrafficManager.setIndicator(
        "us1",
        "thinking",
        connected && this._us1AwaitingReply ? "busy" : "idle"
      );
      TrafficManager.setIndicator("us1", "send", this._isUs1SendReady(connected) ? "idle" : "busy");
    } finally {
      this._syncingUs1Indicators = false;
    }
  }

  _isUs1SendReady(connected: boolean): boolean {
    if (connected === false || this._us1SendBusy === true) {
      return false;
    }

    const analyzePage = document.getElementById("page-analyze");
    const analyzeVisible =
      analyzePage instanceof HTMLElement && !analyzePage.classList.contains("is-hidden");
    if (analyzeVisible === false) {
      return true;
    }

    const sendUs1 =
      (document.getElementById("send-us1") as HTMLInputElement | null)?.checked === true;
    const message = (
      (document.getElementById("compose-input") as HTMLTextAreaElement | null)?.value ?? ""
    ).trim();
    const hasContent = message !== "" || this.stagedFiles.length > 0;
    return sendUs1 && hasContent;
  }

  async _sendUs1Message(message: string, attachments: StagedFile[]): Promise<void> {
    const electronApi = window.electronAPI;
    if (electronApi === undefined || typeof electronApi.us1SendMessage !== "function") {
      throw new Error("US1 mail transport is unavailable.");
    }

    this._syncUs1IdentityContext();
    const localSessionId = this._ensureUs1LocalSessionId();
    if (localSessionId === null) {
      throw new Error("US1 session could not be resolved.");
    }

    this._us1SendBusy = true;
    this._us1AwaitingReply = true;
    this._applyUs1Indicators(AppState.isUs1Connected());

    try {
      const result = await electronApi.us1SendMessage({
        text: message,
        localSessionId,
        attachments: attachments.map((file) => ({
          path: file.path,
          name: file.originalName ?? file.name,
          mimeType: getMimeTypeFromPath(file.path),
        })),
      });

      if (result.success !== true) {
        throw new Error(result.error ?? "US1 outbound send failed.");
      }

      this.us1SessionId = result.localSessionId ?? localSessionId;
      AppState.setActiveConversation("us1", result.conversationId ?? null);
      await ConversationListManager.refresh({
        silent: true,
        provider: "us1",
        ...(typeof result.conversationId === "string" && result.conversationId !== ""
          ? { forceSelectId: result.conversationId }
          : {}),
        skipNotify: true,
      });
      await SettingsManager.reload();
      this.applyAvatars();
      this.applyNames();
      await this._renderUs1Messages();
      await this._syncUs1Messages({ showRoomPackages: true });
    } catch (error) {
      this._us1AwaitingReply = false;
      throw error;
    } finally {
      this._us1SendBusy = false;
      this._applyUs1Indicators(AppState.isUs1Connected());
    }
  }

  async _syncUs1Messages(options: { showRoomPackages?: boolean } = {}): Promise<void> {
    if (this._us1SyncInFlight === true) {
      return;
    }

    const electronApi = window.electronAPI;
    if (
      electronApi === undefined ||
      typeof electronApi.us1SyncMessages !== "function" ||
      AppState.isUs1Connected() !== true
    ) {
      return;
    }

    this._us1SyncInFlight = true;
    this._us1LoadingBusy = true;
    this._applyUs1Indicators(true);
    const conversationSelect = document.getElementById(
      "conversation-us1"
    ) as HTMLSelectElement | null;
    const selectedConversationValue = conversationSelect?.value ?? "new";
    const isNewSelected = selectedConversationValue === "new";
    const currentConversationId = AppState.getState().activeConversations["us1"] ?? null;
    const currentSessionId = this.us1SessionId;
    const composeHasDraft =
      (
        (document.getElementById("compose-input") as HTMLTextAreaElement | null)?.value ?? ""
      ).trim() !== "" || this.stagedFiles.length > 0;

    try {
      const result = await electronApi.us1SyncMessages({
        localSessionId: this.us1SessionId,
      });
      if (result.success !== true) {
        throw new Error(result.error ?? "US1 inbound sync failed.");
      }

      if ((result.fetchedCount ?? 0) > 0 || (result.processedCount ?? 0) > 0) {
        await SettingsManager.reload();
        this.applyAvatars();
        this.applyNames();
      }

      const sessionEvents = Array.isArray(result.sessionEvents) ? result.sessionEvents : [];
      const autoOpenSession = this._chooseUs1AutoOpenSession(sessionEvents, {
        currentSessionId,
        currentConversationId,
        isNewSelected,
        composeHasDraft,
      });
      const nextConversationId =
        autoOpenSession?.conversationId ??
        (sessionEvents.length > 0 && currentConversationId !== null
          ? currentConversationId
          : (result.conversationId ?? currentConversationId));
      const nextSessionId =
        autoOpenSession?.localSessionId ??
        (nextConversationId === currentConversationId
          ? (currentSessionId ?? result.localSessionId ?? null)
          : (result.localSessionId ?? currentSessionId));

      this._applyUs1PendingSessions(sessionEvents, nextSessionId, nextConversationId);
      this.us1SessionId = nextSessionId;
      AppState.setActiveConversation("us1", nextConversationId ?? null);
      await ConversationListManager.refresh({
        silent: true,
        provider: "us1",
        ...(typeof nextConversationId === "string" &&
        nextConversationId !== "" &&
        autoOpenSession !== null
          ? { forceSelectId: nextConversationId }
          : {}),
        skipNotify: true,
      });
      await this._renderUs1Messages();

      if (options.showRoomPackages === true) {
        await this._handleIncomingUs1RoomPackages(result.roomPackages ?? []);
      }
    } catch (error) {
      Logger.warn(LogCategory.ANALYZE, "US1 inbound sync failed", {
        error,
      });
    } finally {
      this._us1SyncInFlight = false;
      this._us1LoadingBusy = false;
      this._applyUs1Indicators(AppState.isUs1Connected());
    }
  }

  async _handleIncomingUs1RoomPackages(roomPackages: Us1RoomPackageCandidate[]): Promise<void> {
    const electronApi = window.electronAPI;
    if (
      electronApi === undefined ||
      typeof electronApi.showMessageBox !== "function" ||
      typeof electronApi.roomsImportBundle !== "function"
    ) {
      return;
    }

    for (const roomPackage of roomPackages) {
      if (roomPackage.storedPath.trim() === "") {
        Logger.warn(LogCategory.ANALYZE, "US1 room package missing attachment path", {
          roomPackage,
        });
        continue;
      }

      // eslint-disable-next-line no-await-in-loop -- NOTE: user confirmations must be sequential.
      const confirmation = await electronApi.showMessageBox({
        type: "question",
        title: "Import room package",
        message: `${roomPackage.originalName} was received from ${AppState.getNickname("us1")}. Import it now?`,
        buttons: ["Import", "Cancel"],
        defaultId: 0,
        cancelId: 1,
      });
      if (confirmation.response !== 0) {
        Logger.warn(LogCategory.ANALYZE, "US1 room package import rejected", {
          roomPackage,
        });
        continue;
      }

      // eslint-disable-next-line no-await-in-loop -- NOTE: keep import order aligned with confirmations.
      const importResult = await electronApi.roomsImportBundle({
        bundleFile: roomPackage.storedPath,
        overwriteWorkspace: true,
      });
      if (importResult.success !== true) {
        Logger.warn(LogCategory.ANALYZE, "US1 room package import failed", {
          roomPackage,
          error: importResult.error,
        });
      }
    }
  }

  _startUs1Polling(): void {
    if (this._us1PollTimer !== null || AppState.isUs1Connected() !== true) {
      return;
    }

    this._us1PollTimer = window.setInterval(() => {
      void this._syncUs1Messages({ showRoomPackages: true });
    }, 30000);
  }

  _stopUs1Polling(): void {
    if (this._us1PollTimer !== null) {
      window.clearInterval(this._us1PollTimer);
      this._us1PollTimer = null;
    }
  }

  refreshUploads(): void {
    this._renderUploadList();
  }

  async handleUploadClick(): Promise<void> {
    const btn = document.getElementById("upload-add-btn") as HTMLButtonElement | null;
    if (btn?.disabled === true) return;
    if (btn) btn.disabled = true;

    try {
      this.stagedFiles = await addUploadFiles(this.stagedFiles);
      this._renderUploadList();
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  _renderUploadList(): void {
    renderUploadList(this.stagedFiles, (name) => {
      this.stagedFiles = removeUploadFile(this.stagedFiles, name);
      this._renderUploadList();
    });
    this.updateSendButtonState();
  }

  async _initDraftSystem(): Promise<void> {
    initDraft();
    this.beforeUnloadHandler = (): void => {
      this._persistDraft();
    };
    window.addEventListener("beforeunload", this.beforeUnloadHandler);

    const draftResult = await loadDraft();
    const draft = isDraftState(draftResult) ? draftResult : { message: "", files: [] };

    const textarea = document.getElementById("compose-input") as HTMLTextAreaElement | null;
    if (textarea !== null && textarea.value.trim() === "") {
      textarea.value = draft.message;
    }
    if (this.stagedFiles.length === 0) {
      this.stagedFiles = draft.files;
    }
    this._renderUploadList();
  }

  _persistDraft(): void {
    const composeInput = document.getElementById("compose-input") as HTMLTextAreaElement | null;
    const message = composeInput ? composeInput.value : "";
    void persistDraft(message, this.stagedFiles);
  }

  handleSend(): void {
    const msg = (
      (document.getElementById("compose-input") as HTMLTextAreaElement | null)?.value ?? ""
    ).trim();
    const hasFiles = this.stagedFiles.length > 0;
    const sendAi1 = (document.getElementById("send-ai1") as HTMLInputElement | null)?.checked;
    const sendAi2 = (document.getElementById("send-ai2") as HTMLInputElement | null)?.checked;
    const sendUs1 = (document.getElementById("send-us1") as HTMLInputElement | null)?.checked;
    const cross = (document.getElementById("send-cross") as HTMLInputElement | null)?.checked;
    const sendBtn = document.getElementById("compose-send-btn") as HTMLButtonElement | null;

    const shouldSendAi1 = sendAi1 === true;
    const shouldSendAi2 = sendAi2 === true;
    const shouldSendUs1 = sendUs1 === true;
    const shouldCross = cross === true;

    if ((!shouldSendAi1 && !shouldSendAi2 && !shouldSendUs1) || (msg === "" && !hasFiles)) return;

    if (sendBtn) {
      ButtonStates.setLoading(sendBtn, analyzeT("page.buttons.sending"));
    }

    Logger.debug(LogCategory.ANALYZE, analyzeT("logs.sendStarting"));

    const targets: string[] = [];
    const textByProvider: Record<string, string> = {};
    const archiveFolders: Record<string, string> = {};

    if (shouldSendAi1) {
      let text = msg;
      if (shouldCross && shouldSendAi2) {
        const otherName = AppState.getNickname("ai2");
        const otherMsg = this.lastMessages.ai2.trim();
        text = otherMsg !== "" ? `${otherName} : ${otherMsg} | ${msg}` : msg;
      }
      textByProvider["ai1"] = text;
      targets.push("ai1");
      archiveFolders["ai1"] = this._getConversationFolder("ai1");
    }

    if (shouldSendAi2) {
      let text = msg;
      if (shouldCross && shouldSendAi1) {
        const otherName = AppState.getNickname("ai1");
        const otherMsg = this.lastMessages.ai1.trim();
        text = otherMsg !== "" ? `${otherName} : ${otherMsg} | ${msg}` : msg;
      }
      textByProvider["ai2"] = text;
      targets.push("ai2");
      archiveFolders["ai2"] = this._getConversationFolder("ai2");
    }

    const texts = targets.map((p) => textByProvider[p] ?? msg);
    const allSame = texts.every((t) => t === texts[0]);
    const attachList = [...this.stagedFiles];

    const sendFlow = async (): Promise<void> => {
      try {
        if (targets.length > 0 && allSame) {
          await CoreEngine.sendBatch({
            targets,
            text: texts[0] ?? "",
            attachments: attachList,
            page: "analyze",
            archiveFolders,
          });
        } else if (targets.length > 0) {
          await targets.reduce(async (prev, provider) => {
            await prev;
            await CoreEngine.sendBatch({
              targets: [provider],
              text: textByProvider[provider] ?? "",
              attachments: attachList,
              page: "analyze",
              archiveFolders,
            });
          }, Promise.resolve());
        }
        if (shouldSendUs1) {
          await this._sendUs1Message(msg, attachList);
        }
        if (sendBtn) {
          ButtonStates.setSuccess(sendBtn, analyzeT("page.buttons.sent"), 1500);
        }
        Logger.success(LogCategory.ANALYZE, analyzeT("logs.sendSuccess"));
      } catch (error) {
        if (sendBtn) {
          ButtonStates.setError(sendBtn, analyzeT("page.buttons.error"), 1500);
        }
        Logger.error(
          LogCategory.ANALYZE,
          analyzeT("logs.sendError", { message: getErrorMessage(error) })
        );
      }
    };

    void sendFlow().finally(() => {
      this.stagedFiles = [];
      this._renderUploadList();
      const composeInput = document.getElementById("compose-input") as HTMLTextAreaElement | null;
      if (composeInput) composeInput.value = "";

      setTimeout(() => {
        this.updateSendButtonState();
      }, 1600);
    });
  }

  async handleAnalyzeStart(): Promise<void> {
    const targets = this._getConnectedAIs();
    if (targets.length === 0) {
      Logger.warn(LogCategory.ANALYZE, analyzeT("logs.protocolSendSkippedNoConnectedAi"));
      return;
    }
    await CoreEngine.sendProtocol({
      room: "analyze",
      scenario: "user-ai-ai",
      targets,
      mode: targets.length >= 2 ? "aiRelay" : "normal",
    });
  }

  async handleAnalyzeStop(): Promise<void> {
    const targets = this._getConnectedAIs();
    if (targets.length === 0) {
      Logger.warn(LogCategory.ANALYZE, analyzeT("logs.protocolStopSkippedNoConnectedAi"));
      return;
    }

    await CoreEngine.sendProtocol({
      room: "analyze",
      scenario: "user-ai-ai-stop",
      targets,
    });
  }

  updateSendButtonState(): void {
    const btn = document.getElementById("compose-send-btn") as HTMLButtonElement | null;
    if (!btn) return;

    const sendAi1 = (document.getElementById("send-ai1") as HTMLInputElement | null)?.checked;
    const sendAi2 = (document.getElementById("send-ai2") as HTMLInputElement | null)?.checked;
    const sendUs1 = (document.getElementById("send-us1") as HTMLInputElement | null)?.checked;
    const hasTarget = sendAi1 === true || sendAi2 === true || sendUs1 === true;
    const message = (
      (document.getElementById("compose-input") as HTMLTextAreaElement | null)?.value ?? ""
    ).trim();
    const hasContent = message !== "" || this.stagedFiles.length > 0;

    btn.disabled = !hasTarget || !hasContent;
    this._updateCrossCheckboxState();
    this._applyUs1Indicators(AppState.isUs1Connected());
  }

  _resetSendTargetsOnShow(): void {
    const sendAi1 = document.getElementById("send-ai1") as HTMLInputElement | null;
    const sendAi2 = document.getElementById("send-ai2") as HTMLInputElement | null;
    const sendUs1 = document.getElementById("send-us1") as HTMLInputElement | null;
    const cross = document.getElementById("send-cross") as HTMLInputElement | null;

    const ai1CanSend =
      AppState.getAccountForSlot("ai1") !== null && SlotController.isConnected("ai1") === true;
    const ai2CanSend =
      AppState.getAccountForSlot("ai2") !== null && SlotController.isConnected("ai2") === true;
    const us1CanSend = AppState.hasUs1Identity() && AppState.isUs1Connected();

    if (sendAi1) {
      sendAi1.checked = ai1CanSend;
    }
    if (sendAi2) {
      sendAi2.checked = ai2CanSend;
    }
    if (sendUs1) {
      sendUs1.checked = !ai1CanSend && !ai2CanSend && us1CanSend;
    }
    if (cross) {
      cross.checked = false;
    }

    this._updateCrossCheckboxState();
  }

  _updateCrossCheckboxState(): void {
    const cross = document.getElementById("send-cross") as HTMLInputElement | null;
    const sendAi1 = document.getElementById("send-ai1") as HTMLInputElement | null;
    const sendAi2 = document.getElementById("send-ai2") as HTMLInputElement | null;

    if (cross && sendAi1 && sendAi2) {
      const bothChecked = sendAi1.checked && sendAi2.checked;
      cross.disabled = !bothChecked;
      if (!bothChecked) cross.checked = false;
    }
  }

  _getConnectedAIs(): string[] {
    const list: string[] = [];
    if (SlotController.isConnected("ai1") === true) list.push("ai1");
    if (SlotController.isConnected("ai2") === true) list.push("ai2");
    return list;
  }

  _getConversationFolder(provider: string): string {
    const select = document.getElementById(`conversation-${provider}`) as HTMLSelectElement | null;
    if (!select) {
      return "";
    }
    const opt = select.selectedOptions[0];
    if (!opt || opt.value === "new") {
      return "";
    }
    return opt.dataset["folder"] ?? "";
  }

  onShow(): void {
    this.archiveOverlay.onHostShow();
    this.refreshUploads();
    this.updateConnectionStates();
    this._syncAnalyzeSceneVisibility();
    this._resetSendTargetsOnShow();
    this.updateSendButtonState();
    void this._syncUs1Messages({ showRoomPackages: true });
    this._startUs1Polling();
  }

  onHide(): void {
    this._setAnalyzeSceneTableOpen(false);
    this._analyzeSceneSelection = null;
    this.archiveOverlay.onHostHide();
    this._stopUs1Polling();

    try {
      this._persistDraft();
    } catch (_) {}

    if (this.beforeUnloadHandler) {
      window.removeEventListener("beforeunload", this.beforeUnloadHandler);
      this.beforeUnloadHandler = null;
    }
  }
}

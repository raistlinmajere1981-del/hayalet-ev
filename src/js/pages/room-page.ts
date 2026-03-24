import type {
  InstalledRoomFeatureRecord,
  InstalledRoomRecord,
  RoomSceneTextConfig,
  RoomSceneTransparentWindowConfig,
} from "@shared/index.js";
import type { SlotStateInfo } from "../../types/assistant.js";
import type { PageController } from "../app/types.js";
import { shellT } from "../app/shell-i18n.js";
import { AppState } from "../modules/app-state.js";
import { AppI18n } from "../modules/i18n/index.js";
import { RoomHostRuntime } from "../modules/rooms/room-host-runtime.js";
import { SlotController, SlotEvent } from "../modules/slot-controller.js";
import { TrafficManager } from "../modules/traffic-manager.js";
import {
  createInstalledRoomSceneDebugStore,
  createRoomScopedSceneThemeStore,
} from "../modules/rooms/room-scene-debug.js";
import {
  getRoomRuntimeAssetSource,
  resolveRoomRuntimeAssetSource,
  toRoomRuntimeFileUrl,
} from "../modules/rooms/room-runtime-url.js";
import {
  applySceneDebugFlag,
  createSceneDebugRuntimeSession,
  getSceneDebugRoomOptions,
  openSceneDebugRoom,
  SceneLayoutEditor,
  type SceneDebugRuntimeSession,
  type SceneLayoutEditorRoomOption,
  type SceneLayoutEditorSelection,
} from "../scene-editor/index.js";
import type { SceneEditorAssetTargetDescriptor } from "../scene-editor/scene-theme-asset-state.js";
import {
  detectSceneAlphaWindowBounds,
  type SceneAlphaWindowBounds,
} from "../scene/alpha-window.js";
import { buildSceneCharacterRoster, resolveSceneAvatarSource } from "../scene/characters/index.js";
import type {
  SceneBackConfig,
  SceneLayoutConfig,
  SceneObjectConfig,
} from "../scene/layout/index.js";
import { renderSceneBackLayer } from "../scene/renderers/back-layer.js";
import { renderSceneCharacterLayer } from "../scene/renderers/character-layer.js";
import { renderSceneObjectLayer } from "../scene/renderers/object-layer.js";
import { getCoverSceneProjectionFromElement, type SceneProjection } from "../scene/projection.js";
import { navigateToScenePage } from "../scene/navigation.js";
import { syncSceneViewRuntime } from "../scene/runtime.js";
import type { SceneClickableThemeDefinition } from "../scene/schema.js";
import { mountSceneWindowControls, unmountSceneWindowControls } from "../scene/window-controls.js";
import { isSceneUiMode } from "../ui/ui-mode.js";

type RoomRuntimeState = "idle" | "loading" | "ready" | "error";
type RoomHostMessage = Record<string, unknown>;

type RoomWebviewElement = HTMLElement & {
  src: string;
  getURL?: () => string;
  send?: (channel: string, ...args: unknown[]) => void;
};

type RoomIpcMessageEvent = Event & {
  channel?: string;
  args?: unknown[];
};

type RoomLoadErrorEvent = Event & {
  errorCode?: number;
  errorDescription?: string;
};

const DEFAULT_SCENE_REFERENCE_SIZE = {
  width: 1600,
  height: 900,
} as const;

const DEFAULT_SCENE_TRANSPARENT_WINDOW = {
  leftPct: 18,
  topPct: 18,
  widthPct: 64,
  heightPct: 58,
} as const;

function resolveSceneTextValue(value: RoomSceneTextConfig | undefined, fallback: string): string {
  if (value?.textKey !== undefined) {
    return AppI18n.t(value.textKey);
  }
  if (value?.text !== undefined && value.text.trim() !== "") {
    return value.text.trim();
  }
  return fallback;
}

function buildRoomSceneObject(feature: InstalledRoomFeatureRecord): SceneObjectConfig | null {
  if (feature.scene === undefined) {
    return null;
  }

  const rect = feature.scene.hotspot.rect;
  const labelText = resolveSceneTextValue(feature.scene.hotspot.label, feature.name);

  return {
    id: feature.scene.hotspot.id,
    kind: "object",
    viewId: null,
    action: {
      type: "screen",
      screen: "primary",
    },
    rect: { ...rect },
    frame: {
      variant: "flat",
      rotateDeg: 0,
      perspectiveDeg: 0,
      hueDeg: 34,
      alpha: 0.62,
    },
    label: {
      visible: true,
      textKey: "",
      customText: labelText,
      centerXPx: rect.leftPx + rect.widthPx / 2,
      topPx: rect.topPx + rect.heightPx + 18,
      widthPx: Math.max(rect.widthPx, 220),
      heightPx: 44,
      rotateDeg: 0,
      fontSizePx: 25,
      letterSpacingPx: 1.2,
      fontPreset: "display",
      framePerspectiveDeg: 0,
    },
  };
}

function buildRoomBackNode(
  room: InstalledRoomRecord,
  options: { idSuffix?: string; viewId: string }
): SceneBackConfig | null {
  if (room.scene === undefined) {
    return null;
  }

  const rect = room.scene.backHotspot.rect;
  const labelText = resolveSceneTextValue(
    room.scene.backHotspot.label,
    roomPageT("page.backToRooms")
  );

  return {
    id: `${room.scene.backHotspot.id}${options.idSuffix ?? ""}`,
    kind: "back",
    viewId: options.viewId,
    action: {
      type: "back",
      target: "room",
    },
    rect: { ...rect },
    glow: {
      hueDeg: 24,
      alpha: 0.54,
    },
    label: {
      visible: true,
      textKey: "",
      customText: labelText,
      centerXPx: rect.leftPx + rect.widthPx / 2,
      topPx: rect.topPx + rect.heightPx + 16,
      widthPx: Math.max(rect.widthPx, 180),
      heightPx: 40,
      rotateDeg: 0,
      fontSizePx: 24,
      letterSpacingPx: 1,
      fontPreset: "display",
      framePerspectiveDeg: 0,
    },
  };
}

function buildRoomSceneViewBackNode(room: InstalledRoomRecord): SceneBackConfig | null {
  if (room.scene === undefined) {
    return null;
  }

  const referenceSize = room.scene.referenceSize;
  const widthPx = Math.max(88, Math.round(referenceSize.width * (116 / 1920)));
  const labelWidthPx = Math.max(150, Math.round(referenceSize.width * (180 / 1920)));
  const labelHeightPx = Math.max(34, Math.round(referenceSize.height * (40 / 1080)));
  const labelTopPx = Math.round(referenceSize.height * (490 / 1080));
  const fontSizePx = Math.max(16, Math.round(referenceSize.height * (18 / 1080)));

  return {
    id: `${room.scene.backHotspot.id}-feature-view`,
    kind: "back",
    viewId: "feature-view",
    action: {
      type: "back",
      target: "room",
    },
    rect: {
      leftPx: 0,
      topPx: 0,
      widthPx,
      heightPx: referenceSize.height,
    },
    glow: {
      hueDeg: 33,
      alpha: 0.34,
    },
    label: {
      visible: true,
      textKey: "",
      customText: shellT("settingsHub.scene.returnRoom"),
      centerXPx: widthPx / 2,
      topPx: labelTopPx,
      widthPx: labelWidthPx,
      heightPx: labelHeightPx,
      rotateDeg: 0,
      fontSizePx,
      letterSpacingPx: 1,
      fontPreset: "display",
      framePerspectiveDeg: 0,
    },
  };
}

function buildStandardSceneViewBackButton(label: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className =
    "scene-clickable__button scene-clickable__button--back workspace-tool-scene-chrome__back room-scene-view__standard-back-button";
  button.dataset["frameVariant"] = "flat";
  button.title = label;
  button.setAttribute("aria-label", label);

  const arrow = document.createElement("span");
  arrow.className = "scene-clickable__arrow";
  arrow.ariaHidden = "true";
  arrow.textContent = "←";

  const text = document.createElement("span");
  text.className = "scene-clickable__label scene-clickable__label--back";
  text.ariaHidden = "true";
  text.textContent = label;

  button.append(arrow, text);
  return button;
}

export class RoomPageController implements PageController {
  private room: InstalledRoomRecord;
  private readonly pageName: string;
  private readonly sceneDebugSession: SceneDebugRuntimeSession;
  private runtimeState: RoomRuntimeState = "idle";
  private lastRuntimeEvent = roomPageT("status.handshakeWaiting");
  private preloadUrlPromise: Promise<string> | null = null;
  private unsubscribeI18n: (() => void) | null = null;
  private readonly slotSubscriptions: Array<() => void> = [];
  private readonly pendingHostMessages = new WeakMap<RoomWebviewElement, RoomHostMessage[]>();
  private activeFeatureId: string;
  private sceneFeatureId: string | null = null;
  private sceneDebugEnabled = false;
  private editor: SceneLayoutEditor | null = null;
  private editorSelection: SceneLayoutEditorSelection = null;
  private sceneCharacterRenderToken = 0;

  constructor(room: InstalledRoomRecord, pageName: string) {
    this.room = { ...room };
    this.pageName = pageName;
    this.activeFeatureId = this.resolveInitialFeatureId(room, null);
    this.sceneDebugSession = createSceneDebugRuntimeSession(pageName, {
      createLayoutStore: () =>
        createInstalledRoomSceneDebugStore({
          roomId: room.id,
          getRoom: () => this.room,
        }),
      createThemeStore: () => createRoomScopedSceneThemeStore(room.id),
    });
  }

  private get sceneLayout(): SceneLayoutConfig {
    return this.sceneDebugSession.getSceneLayout();
  }

  private set sceneLayout(sceneLayout: SceneLayoutConfig) {
    this.sceneDebugSession.setSceneLayout(sceneLayout);
  }

  private get sceneClickableTheme(): SceneClickableThemeDefinition {
    return this.sceneDebugSession.getSceneClickableTheme();
  }

  private set sceneClickableTheme(sceneClickableTheme: SceneClickableThemeDefinition) {
    this.sceneDebugSession.setSceneClickableTheme(sceneClickableTheme);
  }

  updateRoom(room: InstalledRoomRecord): void {
    this.activeFeatureId = this.resolveInitialFeatureId(room, this.activeFeatureId);
    this.sceneFeatureId =
      this.sceneFeatureId !== null &&
      room.features.some(
        (feature) => feature.id === this.sceneFeatureId && feature.scene !== undefined
      )
        ? this.sceneFeatureId
        : null;
    this.room = { ...room };
    this.render();
  }

  async init(): Promise<void> {
    this.sceneDebugEnabled = applySceneDebugFlag();
    this.sceneDebugSession.load(this.sceneDebugEnabled);
    this.unsubscribeI18n ??= AppI18n.subscribe(() => {
      this.render();
      void this.syncRuntimeContext("locale-change");
    });
    this.bindRoomContextSubscriptions();
    this.render();
    await this.ensureRuntimeHost();
  }

  onShow(): void {
    this.render();
    this.editor?.refresh();
    void this.ensureRuntimeHost();
  }

  render(): void {
    const page = this.getPage();
    if (page === null) {
      return;
    }

    this.ensureShell(page);
    this.syncSceneWindowControls(page);
    this.setupSceneDebug(page);
    this.syncShell(page);
    this.syncScene(page);
    void this.ensureRuntimeHost(page);
  }

  dispose(): void {
    this.unsubscribeI18n?.();
    this.unsubscribeI18n = null;
    this.clearRoomContextSubscriptions();
    void RoomHostRuntime.disposeRoom(this.room.id);
    const classicMount = this.getMountHost();
    const sceneMount = this.getSceneRuntimeSlot();
    this.getEditorHost()?.replaceChildren();
    this.editor = null;
    classicMount?.replaceChildren();
    sceneMount?.replaceChildren();
  }

  private resolveInitialFeatureId(room: InstalledRoomRecord, preferredId: string | null): string {
    if (preferredId !== null && room.features.some((feature) => feature.id === preferredId)) {
      return preferredId;
    }
    if (room.features.some((feature) => feature.id === room.defaultFeatureId)) {
      return room.defaultFeatureId;
    }
    return room.features[0]?.id ?? "";
  }

  private getActiveFeature(): InstalledRoomFeatureRecord | null {
    return this.room.features.find((feature) => feature.id === this.activeFeatureId) ?? null;
  }

  private getSceneFeature(): InstalledRoomFeatureRecord | null {
    if (this.sceneFeatureId === null) {
      return null;
    }

    return this.room.features.find((feature) => feature.id === this.sceneFeatureId) ?? null;
  }

  private isSceneFeatureOpen(): boolean {
    return (
      isSceneUiMode() &&
      this.room.scene !== undefined &&
      this.getSceneFeature()?.scene !== undefined
    );
  }

  private getSceneReferenceSize(): { width: number; height: number } {
    return this.room.scene?.referenceSize ?? DEFAULT_SCENE_REFERENCE_SIZE;
  }

  private getPageShellVariant(): "standard" | "immersive-stage" {
    return this.room.scene?.chrome?.pageShellVariant ?? "standard";
  }

  private usesImmersivePageShell(): boolean {
    return this.getPageShellVariant() === "immersive-stage";
  }

  private getPage(): HTMLElement | null {
    return document.getElementById(`page-${this.pageName}`);
  }

  private bindRoomContextSubscriptions(): void {
    if (this.slotSubscriptions.length > 0) {
      return;
    }

    const syncContext = (): void => {
      void this.syncRuntimeContext("slot-state");
    };

    const syncSceneCharacters = (): void => {
      this.refreshSceneCharacters();
    };

    [
      SlotEvent.STATE_CHANGED,
      SlotEvent.ACCOUNT_ASSIGNED,
      SlotEvent.ACCOUNT_REMOVED,
      SlotEvent.URL_EXCLUDED,
      SlotEvent.URL_INCLUDED,
      SlotEvent.CONNECT_COMPLETE,
      SlotEvent.CONNECT_FAILED,
      SlotEvent.DISCONNECT_COMPLETE,
    ].forEach((eventName) => {
      this.slotSubscriptions.push(
        SlotController.on(eventName, () => {
          syncContext();
          syncSceneCharacters();
        })
      );
    });

    this.slotSubscriptions.push(
      AppState.subscribe(() => {
        syncContext();
        syncSceneCharacters();
      })
    );

    this.slotSubscriptions.push(
      TrafficManager.onUpdate(() => {
        syncSceneCharacters();
      })
    );
  }

  private clearRoomContextSubscriptions(): void {
    while (this.slotSubscriptions.length > 0) {
      const unsubscribe = this.slotSubscriptions.pop();
      try {
        unsubscribe?.();
      } catch {
        continue;
      }
    }
  }

  private getClassicShell(page: HTMLElement | null = this.getPage()): HTMLElement | null {
    return page?.querySelector<HTMLElement>("[data-room-role='classic-shell']") ?? null;
  }

  private getSceneRoot(page: HTMLElement | null = this.getPage()): HTMLElement | null {
    return page?.querySelector<HTMLElement>("[data-room-role='scene-root']") ?? null;
  }

  private getSceneRoom(page: HTMLElement | null = this.getPage()): HTMLElement | null {
    return page?.querySelector<HTMLElement>("[data-room-role='scene-room']") ?? null;
  }

  private getSceneView(page: HTMLElement | null = this.getPage()): HTMLElement | null {
    return page?.querySelector<HTMLElement>("[data-room-role='scene-view']") ?? null;
  }

  private getPageShell(page: HTMLElement | null = this.getPage()): HTMLElement | null {
    return page?.querySelector<HTMLElement>("[data-room-role='page-shell']") ?? null;
  }

  private getMountHost(page: HTMLElement | null = this.getPage()): HTMLElement | null {
    return page?.querySelector<HTMLElement>("[data-room-role='runtime-mount']") ?? null;
  }

  private getSceneRuntimeSlot(page: HTMLElement | null = this.getPage()): HTMLElement | null {
    return page?.querySelector<HTMLElement>("[data-room-role='scene-runtime-slot']") ?? null;
  }

  private getEditorHost(page: HTMLElement | null = this.getPage()): HTMLElement | null {
    return page?.querySelector<HTMLElement>("[data-room-role='scene-editor-host']") ?? null;
  }

  private shouldShowFeatureStrip(): boolean {
    if (this.usesImmersivePageShell() && this.room.features.length <= 1) {
      return false;
    }
    return true;
  }

  private ensureShell(page: HTMLElement): void {
    if (page.dataset["roomShellReady"] === "true") {
      return;
    }

    const showFeatureStrip = this.shouldShowFeatureStrip();

    const classicShellMarkup = this.usesImmersivePageShell()
      ? `
        <div class="room-shell room-shell--immersive" data-room-role="classic-shell">
          <div class="room-shell-topline"${showFeatureStrip ? "" : " hidden"}>
            <div class="room-feature-strip room-feature-strip--inline" data-room-role="feature-strip"></div>
          </div>
          <section class="glass-panel ds-surface-card room-shell-stage room-shell-stage--immersive">
            <div class="room-runtime-mount room-runtime-mount--stage" data-room-role="runtime-mount"></div>
          </section>
        </div>
      `
      : `
        <div class="room-shell" data-room-role="classic-shell">
          <div class="room-shell-topline"${showFeatureStrip ? "" : " hidden"}>
            <div class="room-feature-strip room-feature-strip--header" data-room-role="feature-strip"></div>
          </div>

          <section class="glass-panel ds-surface-card ds-surface-card--stack room-shell-panel room-shell-panel--runtime">
            <div class="room-runtime-mount" data-room-role="runtime-mount"></div>
          </section>
        </div>
      `;

    page.innerHTML = `
      <div class="room-page-shell${
        this.usesImmersivePageShell() ? " room-page-shell--immersive" : ""
      }" data-room-role="page-shell">
        <div class="room-scene-root scene-shell__surface" data-room-role="scene-root" hidden>
          <div class="room-scene-room scene-shell__room-layer" data-room-role="scene-room">
            <img class="room-scene-room__background scene-shell__cover-image" data-room-role="scene-room-background" alt="" />
            <div class="room-scene-room__characters entrance-scene__characters" data-room-role="scene-characters"></div>
            <div class="room-scene-room__back-layer" data-room-role="scene-room-back-host"></div>
            <div class="room-scene-room__hotspots" data-room-role="scene-hotspots"></div>
          </div>
          <div class="room-scene-view scene-shell__view" data-room-role="scene-view" aria-hidden="true">
            <img class="room-scene-view__background scene-shell__cover-image" data-room-role="scene-view-background" alt="" />
            <img class="room-scene-view__panel-art scene-shell__cover-image" data-room-role="scene-view-panel-art" alt="" hidden />
            <div class="room-scene-view__runtime-frame" data-room-role="scene-runtime-slot"></div>
            <div class="room-scene-view__back-layer" data-room-role="scene-back-host"></div>
          </div>
        </div>
        <div class="entrance-scene__editor-host" data-room-role="scene-editor-host"></div>

        ${classicShellMarkup}
      </div>
    `;

    page
      .querySelector<HTMLElement>("[data-room-role='feature-strip']")
      ?.addEventListener("click", (event) => {
        const button = (event.target as Element | null)?.closest<HTMLButtonElement>(
          "[data-room-feature-id]"
        );
        const featureId = button?.dataset["roomFeatureId"] ?? "";
        if (featureId !== "") {
          this.setActiveFeature(featureId, "feature-button");
        }
      });

    page.dataset["roomShellReady"] = "true";
  }

  private isSceneDebugActive(): boolean {
    return isSceneUiMode();
  }

  private resolveSceneWindowControlsVisibility(): "scene-only" | "all-pages" | "hidden" {
    return this.room.scene?.chrome?.windowControlsVisibility ?? "scene-only";
  }

  private resolveSceneViewBackButtonVariant(): "scene-back-layer" | "standard-button" {
    return this.room.scene?.chrome?.viewBackButtonVariant ?? "scene-back-layer";
  }

  private syncSceneWindowControls(page: HTMLElement): void {
    unmountSceneWindowControls(page);

    const visibility = this.resolveSceneWindowControlsVisibility();
    if (visibility === "hidden") {
      return;
    }

    if (visibility === "all-pages") {
      if (this.getPageShell(page) !== null) {
        mountSceneWindowControls(page, {
          surfaceSelector: "[data-room-role='page-shell']",
        });
      }
      return;
    }

    if (this.room.scene === undefined) {
      return;
    }

    mountSceneWindowControls(page, {
      surfaceSelector: "[data-room-role='scene-root']",
    });
  }

  private getSceneStandardBackHost(page: HTMLElement): HTMLElement | null {
    return page.querySelector<HTMLElement>("[data-room-role='scene-standard-back']");
  }

  private ensureSceneStandardBackHost(page: HTMLElement, view: HTMLElement): HTMLElement {
    const existing = this.getSceneStandardBackHost(page);
    if (existing !== null) {
      return existing;
    }

    const host = document.createElement("div");
    host.className = "room-scene-view__standard-back";
    host.dataset["roomRole"] = "scene-standard-back";

    const runtimeSlot = view.querySelector<HTMLElement>("[data-room-role='scene-runtime-slot']");
    if (runtimeSlot !== null) {
      runtimeSlot.insertAdjacentElement("beforebegin", host);
    } else {
      view.insertAdjacentElement("beforeend", host);
    }

    return host;
  }

  private buildSceneAssetTargets(): SceneEditorAssetTargetDescriptor[] {
    const activeFeature = this.getActiveFeature();
    if (activeFeature?.scene === undefined) {
      return [];
    }

    return [
      {
        id: `feature-view:${activeFeature.id}`,
        roomId: this.pageName,
        label: `${activeFeature.name} View`,
        sourceHint: activeFeature.scene.view.backgroundPath,
        runtimeSrc: getRoomRuntimeAssetSource(activeFeature.scene.view.backgroundPath),
        hasSourceOverride: false,
        supportsTransparentWindow: true,
        transparentWindow: this.getActiveSceneAssetTransparentWindowBounds(activeFeature),
      },
    ];
  }

  private getFeatureIdFromAssetTarget(targetId: string): string | null {
    const prefix = "feature-view:";
    if (!targetId.startsWith(prefix)) {
      return null;
    }

    const featureId = targetId.slice(prefix.length).trim();
    return featureId === "" ? null : featureId;
  }

  private getSuggestedSceneAssetTargetId(): string | null {
    const activeFeature = this.getActiveFeature();
    if (activeFeature?.scene === undefined) {
      return null;
    }

    return `feature-view:${activeFeature.id}`;
  }

  private getSceneViewBackgroundImage(
    page: HTMLElement | null = this.getPage()
  ): HTMLImageElement | null {
    return (
      page?.querySelector<HTMLImageElement>("[data-room-role='scene-view-background']") ?? null
    );
  }

  private getActiveSceneAssetTransparentWindowBounds(
    feature: InstalledRoomFeatureRecord
  ): SceneAlphaWindowBounds | null {
    const transparentWindow = feature.scene?.view.transparentWindow;
    if (transparentWindow === undefined) {
      return null;
    }

    const image = this.getSceneViewBackgroundImage();
    const sourceWidth = image?.naturalWidth ?? 0;
    const sourceHeight = image?.naturalHeight ?? 0;
    if (sourceWidth <= 0 || sourceHeight <= 0) {
      return null;
    }

    return {
      sourceWidth,
      sourceHeight,
      left: (transparentWindow.leftPct / 100) * sourceWidth,
      top: (transparentWindow.topPct / 100) * sourceHeight,
      right: ((transparentWindow.leftPct + transparentWindow.widthPct) / 100) * sourceWidth,
      bottom: ((transparentWindow.topPct + transparentWindow.heightPct) / 100) * sourceHeight,
    };
  }

  private toTransparentWindowConfig(
    bounds: SceneAlphaWindowBounds
  ): RoomSceneTransparentWindowConfig {
    return {
      leftPct: Number(((bounds.left / bounds.sourceWidth) * 100).toFixed(3)),
      topPct: Number(((bounds.top / bounds.sourceHeight) * 100).toFixed(3)),
      widthPct: Number((((bounds.right - bounds.left) / bounds.sourceWidth) * 100).toFixed(3)),
      heightPct: Number((((bounds.bottom - bounds.top) / bounds.sourceHeight) * 100).toFixed(3)),
    };
  }

  private async detectSceneAssetTransparentWindow(targetId: string): Promise<void> {
    const featureId = this.getFeatureIdFromAssetTarget(targetId);
    const feature =
      featureId === null
        ? null
        : (this.room.features.find((item) => item.id === featureId) ?? null);
    if (feature?.scene === undefined) {
      return;
    }

    const runtimeSrc = await resolveRoomRuntimeAssetSource(feature.scene.view.backgroundPath);
    if (runtimeSrc === "") {
      return;
    }

    const bounds = await detectSceneAlphaWindowBounds(runtimeSrc, 24);
    this.updateSceneAssetTransparentWindow(targetId, bounds);
  }

  private clearSceneAssetTransparentWindow(targetId: string): void {
    this.updateSceneAssetTransparentWindow(targetId, null);
  }

  private updateSceneAssetTransparentWindow(
    targetId: string,
    nextBounds: SceneAlphaWindowBounds | null
  ): void {
    const featureId = this.getFeatureIdFromAssetTarget(targetId);
    if (featureId === null) {
      return;
    }

    this.room = {
      ...this.room,
      features: this.room.features.map((feature) => {
        if (feature.id !== featureId || feature.scene === undefined) {
          return feature;
        }

        const nextView = {
          id: feature.scene.view.id,
          backgroundPath: feature.scene.view.backgroundPath,
          ...(feature.scene.view.panelArtPath !== undefined
            ? { panelArtPath: feature.scene.view.panelArtPath }
            : {}),
          ...(nextBounds !== null
            ? { transparentWindow: this.toTransparentWindowConfig(nextBounds) }
            : {}),
        };

        return {
          ...feature,
          scene: {
            ...feature.scene,
            view: nextView,
          },
        };
      }),
    };

    this.refreshSceneShell();
    this.editor?.refresh();
  }

  private refreshSceneShell(): void {
    const page = this.getPage();
    if (page === null) {
      return;
    }

    this.syncShell(page);
    this.syncScene(page);
  }

  private refreshSceneCharacters(): void {
    const page = this.getPage();
    if (page === null || !isSceneUiMode() || this.room.scene === undefined) {
      return;
    }

    void this.renderSceneRoomCharacters(page);
  }

  private setupSceneDebug(page: HTMLElement): void {
    const editorHost = this.getEditorHost(page);
    if (editorHost === null) {
      this.editor = null;
      return;
    }

    if (!this.sceneDebugEnabled || this.room.scene === undefined) {
      editorHost.replaceChildren();
      this.editor = null;
      return;
    }

    if (this.editor !== null) {
      this.editor.refresh();
      return;
    }

    this.editor = new SceneLayoutEditor(editorHost, {
      isActive: (): boolean => this.isSceneDebugActive(),
      getSceneLayout: (): SceneLayoutConfig => this.sceneLayout,
      getSceneClickableTheme: (): SceneClickableThemeDefinition => this.sceneClickableTheme,
      getSelection: (): SceneLayoutEditorSelection => this.editorSelection,
      getRoomOptions: (): SceneLayoutEditorRoomOption[] => getSceneDebugRoomOptions(shellT),
      getActiveRoomId: (): string => this.pageName,
      setSelection: (selection): void => {
        this.editorSelection = selection;
        this.editor?.refresh();
        this.refreshSceneShell();
      },
      navigateToRoom: (roomId: string): void => {
        openSceneDebugRoom(roomId);
      },
      updateObject: (id, updater): void => {
        this.sceneLayout = this.sceneDebugSession.updateObject(id, updater);
        this.refreshSceneShell();
        this.editor?.refresh();
      },
      updateBack: (id, updater): void => {
        this.sceneLayout = this.sceneDebugSession.updateBack(id, updater);
        this.refreshSceneShell();
        this.editor?.refresh();
      },
      updateCharacter: (): void => {
        return;
      },
      resetDraft: (): void => {
        this.sceneLayout = this.sceneDebugSession.resetSceneLayoutDraft();
        this.editorSelection = null;
        this.refreshSceneShell();
        this.editor?.refresh();
      },
      copySceneLayout: async (): Promise<void> => {
        await this.sceneDebugSession.copySceneLayout();
      },
      saveSceneLayoutToSource: async (): Promise<void> => {
        await this.sceneDebugSession.saveSceneLayoutToSource();
      },
      updateSceneClickableTheme: (updater): void => {
        this.sceneClickableTheme = this.sceneDebugSession.updateSceneClickableTheme(updater);
        this.refreshSceneShell();
        this.editor?.refresh();
      },
      resetSceneClickableThemeDraft: (): void => {
        this.sceneClickableTheme = this.sceneDebugSession.resetSceneClickableThemeDraft();
        this.refreshSceneShell();
        this.editor?.refresh();
      },
      copySceneClickableTheme: async (): Promise<void> => {
        await this.sceneDebugSession.copySceneClickableTheme();
      },
      saveSceneClickableThemeToSource: async (): Promise<void> => {
        await this.sceneDebugSession.saveSceneClickableThemeToSource();
      },
      getSceneAssetTargets: (): SceneEditorAssetTargetDescriptor[] => this.buildSceneAssetTargets(),
      getSuggestedSceneAssetTargetId: (): string | null => this.getSuggestedSceneAssetTargetId(),
      saveSceneAssetDraftToSource: async (): Promise<void> => {
        await this.sceneDebugSession.saveSceneLayoutToSource();
      },
      detectSceneAssetTransparentWindow: async (targetId: string): Promise<void> => {
        await this.detectSceneAssetTransparentWindow(targetId);
      },
      clearSceneAssetTransparentWindow: (targetId: string): void => {
        this.clearSceneAssetTransparentWindow(targetId);
      },
      updateSceneAssetTransparentWindow: (
        targetId: string,
        nextBounds: SceneAlphaWindowBounds | null
      ): void => {
        this.updateSceneAssetTransparentWindow(targetId, nextBounds);
      },
    });
    this.editor.refresh();
  }

  private syncShell(page: HTMLElement): void {
    const activeFeature = this.getActiveFeature();

    this.renderFeatureButtons(page, activeFeature?.id ?? null);
  }

  private renderFeatureButtons(page: HTMLElement, activeFeatureId: string | null): void {
    const strip = page.querySelector<HTMLElement>("[data-room-role='feature-strip']");
    if (strip === null) {
      return;
    }

    if (!this.shouldShowFeatureStrip()) {
      strip.innerHTML = "";
      strip.hidden = true;
      return;
    }

    strip.hidden = false;

    strip.innerHTML = this.room.features
      .map((feature) => {
        const selected = feature.id === activeFeatureId;
        return [
          `<button class="btn btn-sm ${selected ? "btn-primary" : "btn-ghost"} room-feature-chip"`,
          ` type="button" data-room-feature-id="${escapeHtml(feature.id)}"`,
          ` aria-pressed="${selected ? "true" : "false"}">`,
          `<span class="room-feature-chip__title">${escapeHtml(feature.name)}</span>`,
          "</button>",
        ].join("");
      })
      .join("");
  }

  private updateRuntimeStatus(page: HTMLElement): void {
    const statusEl = page.querySelector<HTMLElement>("[data-room-role='runtime-status']");
    const eventEl = page.querySelector<HTMLElement>("[data-room-role='runtime-event']");
    if (statusEl !== null) {
      statusEl.dataset["state"] = this.runtimeState;
      statusEl.textContent =
        this.runtimeState === "error"
          ? roomPageT("status.loadFailed")
          : this.runtimeState === "ready"
            ? roomPageT("status.ready")
            : this.runtimeState === "loading"
              ? roomPageT("status.loading")
              : roomPageT("status.preparing");
    }
    if (eventEl !== null) {
      eventEl.textContent = this.lastRuntimeEvent;
    }
  }

  private syncScene(page: HTMLElement): void {
    const sceneRoot = this.getSceneRoot(page);
    const sceneRoom = this.getSceneRoom(page);
    const sceneView = this.getSceneView(page);
    const classicShell = this.getClassicShell(page);
    const sceneEnabled = isSceneUiMode() && this.room.scene !== undefined;
    const viewOpen = sceneEnabled && this.getSceneFeature()?.scene !== undefined;

    syncSceneViewRuntime({
      elements: {
        root: sceneRoot,
        view: sceneView,
        room: sceneRoom,
        classicLayout: classicShell,
        viewSlot: this.getSceneRuntimeSlot(page),
      },
      state: {
        sceneActive: sceneEnabled,
        viewOpen,
        roomOpenClass: "is-scene-feature-open",
      },
    });

    if (!sceneEnabled || this.room.scene === undefined) {
      return;
    }

    const roomBackground = page.querySelector<HTMLImageElement>(
      "[data-room-role='scene-room-background']"
    );
    if (roomBackground !== null) {
      this.applySceneImageSource(roomBackground, this.room.scene.roomBackgroundPath);
      roomBackground.alt = "";
    }

    this.renderSceneRoomHotspots(page);
    void this.renderSceneRoomCharacters(page);
    this.renderSceneRoomBack(page);
    this.renderSceneView(page);
  }

  private renderSceneRoomHotspots(page: HTMLElement): void {
    const layer = page.querySelector<HTMLElement>("[data-room-role='scene-hotspots']");
    const host = this.getSceneRoom(page);
    if (layer === null || host === null) {
      return;
    }

    const projection = this.getProjection(host);
    const nodes = this.room.features
      .map((feature) => buildRoomSceneObject(feature))
      .filter((node): node is SceneObjectConfig => node !== null);

    renderSceneObjectLayer({
      layer,
      nodes,
      themeDefaults: this.sceneClickableTheme.object,
      projection,
      cssVarPrefix: "scene-hotspot",
      classNames: {
        item: "room-scene__hotspot-item",
        button: "room-scene__hotspot",
        label: "room-scene__hotspot-label",
      },
      selection: null,
      clickableLabels: true,
      resolveLabel: (node) => {
        const feature =
          this.room.features.find((item) => item.scene?.hotspot.id === node.id) ?? null;
        return feature?.name ?? node.id;
      },
      onActivate: (node) => {
        const feature =
          this.room.features.find((item) => item.scene?.hotspot.id === node.id) ?? null;
        if (feature !== null) {
          this.setActiveFeature(feature.id, "scene-hotspot");
        }
      },
    });
  }

  private async renderSceneRoomCharacters(page: HTMLElement): Promise<void> {
    const layer = page.querySelector<HTMLElement>("[data-room-role='scene-characters']");
    const host = this.getSceneRoom(page);
    if (layer === null || host === null) {
      return;
    }

    const characters = buildSceneCharacterRoster(
      this.sceneLayout.characters,
      this.sceneLayout.characterRosterPreset
    );
    if (characters.length === 0) {
      layer.replaceChildren();
      return;
    }

    const renderToken = ++this.sceneCharacterRenderToken;
    await renderSceneCharacterLayer({
      layer,
      characters,
      projection: this.getProjection(host),
      sceneDebugEnabled: this.sceneDebugEnabled,
      interactive: false,
      selectedCharacterId: null,
      isStale: () => renderToken !== this.sceneCharacterRenderToken,
      getDepthScale: (depth) => this.getDepthScale(depth),
      resolveAvatarSource: async (character) => {
        return await resolveSceneAvatarSource(character.avatarSource);
      },
      getNodeClassName: (character) =>
        `entrance-scene__character room-scene__character is-${character.state}`,
      getFallbackHeadLabel: (character) => character.headLabel ?? "?",
      onActivate: () => {},
    });
  }

  private renderSceneRoomBack(page: HTMLElement): void {
    const host = page.querySelector<HTMLElement>("[data-room-role='scene-room-back-host']");
    const room = this.getSceneRoom(page);
    if (host === null || room === null) {
      return;
    }

    renderSceneBackLayer({
      host,
      node: buildRoomBackNode(this.room, {
        idSuffix: "-room-return",
        viewId: "room",
      }),
      themeDefaults: this.sceneClickableTheme.back,
      projection: this.getProjection(room),
      resolveLabel: (node) => resolveSceneTextValue(this.room.scene?.backHotspot.label, node.id),
      onActivate: () => {
        navigateToScenePage("rooms");
      },
    });
  }

  private renderSceneView(page: HTMLElement): void {
    const feature = this.getSceneFeature();
    const view = this.getSceneView(page);
    const background = page.querySelector<HTMLImageElement>(
      "[data-room-role='scene-view-background']"
    );
    const panelArt = page.querySelector<HTMLImageElement>(
      "[data-room-role='scene-view-panel-art']"
    );
    const backHost = page.querySelector<HTMLElement>("[data-room-role='scene-back-host']");
    const runtimeSlot = this.getSceneRuntimeSlot(page);

    if (
      feature?.scene === undefined ||
      view === null ||
      background === null ||
      panelArt === null ||
      backHost === null ||
      runtimeSlot === null
    ) {
      return;
    }

    this.applySceneImageSource(background, feature.scene.view.backgroundPath, {
      refreshEditor: this.sceneDebugEnabled,
    });
    background.alt = "";

    if (feature.scene.view.panelArtPath !== undefined) {
      panelArt.hidden = false;
      this.applySceneImageSource(panelArt, feature.scene.view.panelArtPath);
      panelArt.alt = "";
    } else {
      panelArt.hidden = true;
      delete panelArt.dataset["roomAssetSourcePath"];
      panelArt.removeAttribute("src");
    }

    this.applySceneRuntimeFrame(runtimeSlot, feature);
    const backButtonVariant = this.resolveSceneViewBackButtonVariant();

    if (backButtonVariant === "standard-button") {
      const standardBackHost = this.ensureSceneStandardBackHost(page, view);
      backHost.replaceChildren();
      const label = shellT("settingsHub.scene.returnRoom");
      const button = buildStandardSceneViewBackButton(label);
      button.addEventListener("click", () => {
        this.closeSceneFeatureView();
      });
      standardBackHost.replaceChildren(button);
      return;
    }

    this.getSceneStandardBackHost(page)?.remove();
    renderSceneBackLayer({
      host: backHost,
      node: buildRoomSceneViewBackNode(this.room),
      themeDefaults: this.sceneClickableTheme.back,
      projection: this.getProjection(view),
      resolveLabel: (node) =>
        node.label.customText?.trim() ?? shellT("settingsHub.scene.returnRoom"),
      onActivate: () => {
        this.closeSceneFeatureView();
      },
    });
  }

  private applySceneRuntimeFrame(
    runtimeSlot: HTMLElement,
    feature: InstalledRoomFeatureRecord
  ): void {
    const frame = feature.scene?.view.transparentWindow ?? DEFAULT_SCENE_TRANSPARENT_WINDOW;
    runtimeSlot.style.left = `${frame.leftPct}%`;
    runtimeSlot.style.top = `${frame.topPct}%`;
    runtimeSlot.style.width = `${frame.widthPct}%`;
    runtimeSlot.style.height = `${frame.heightPct}%`;
  }

  private applySceneImageSource(
    image: HTMLImageElement,
    sourcePath: string,
    options: { refreshEditor?: boolean } = {}
  ): void {
    const source = sourcePath.trim();
    image.dataset["roomAssetSourcePath"] = source;

    const immediateSource = getRoomRuntimeAssetSource(source);
    if (immediateSource !== "") {
      image.src = immediateSource;
    } else {
      image.removeAttribute("src");
    }

    if (source === "") {
      return;
    }

    void resolveRoomRuntimeAssetSource(source).then((resolvedSource) => {
      if (!image.isConnected) {
        return;
      }
      if ((image.dataset["roomAssetSourcePath"] ?? "") !== source) {
        return;
      }
      if (resolvedSource === "") {
        image.removeAttribute("src");
        return;
      }

      image.src = resolvedSource;
      if (options.refreshEditor === true && immediateSource === "") {
        this.editor?.refresh();
      }
    });
  }

  private getProjection(host: HTMLElement | null): SceneProjection {
    return getCoverSceneProjectionFromElement(host, this.getSceneReferenceSize());
  }

  private getDepthScale(depth: number): number {
    const safeDepth = Number.isFinite(depth) ? depth : 1;
    const normalizedDepth = Math.max(1, safeDepth);
    const scaled = 1 - (normalizedDepth - 1) * 0.02;
    return Number(Math.max(0.75, scaled).toFixed(3));
  }

  private closeSceneFeatureView(): void {
    if (!isSceneUiMode()) {
      return;
    }
    this.sceneFeatureId = null;
    this.render();
    void this.syncRuntimeContext("scene-close");
  }

  private setActiveFeature(featureId: string, reason: string): void {
    const feature =
      featureId === ""
        ? null
        : (this.room.features.find((candidate) => candidate.id === featureId) ?? null);

    if (feature === null) {
      return;
    }
    this.activeFeatureId = feature.id;
    this.sceneFeatureId = feature.scene !== undefined ? feature.id : null;
    this.render();
    void this.syncRuntimeContext(reason);
  }

  private getRuntimeMountHost(page: HTMLElement): HTMLElement | null {
    if (this.isSceneFeatureOpen()) {
      return this.getSceneRuntimeSlot(page);
    }
    return this.getMountHost(page);
  }

  private async ensureRuntimeHost(page: HTMLElement | null = this.getPage()): Promise<void> {
    if (page === null) {
      return;
    }

    const mount = this.getRuntimeMountHost(page);
    if (mount === null) {
      return;
    }

    const runtimeUrl = toRoomRuntimeFileUrl(this.room.runtimeEntryPath);
    const preloadUrl = await this.getRoomPreloadUrl();
    if (page.isConnected === false) {
      return;
    }

    let webview = page.querySelector<RoomWebviewElement>("webview[data-room-runtime='true']");
    if (webview === null) {
      webview = document.createElement("webview") as RoomWebviewElement;
      webview.className = "room-runtime-webview";
      webview.id = `room-webview-${this.room.id}`;
      webview.setAttribute("data-room-runtime", "true");
      webview.setAttribute("allowpopups", "false");
      webview.setAttribute("partition", `persist:room-${this.room.id}`);
      if (preloadUrl !== "") {
        webview.setAttribute("preload", preloadUrl);
      }
      this.bindRuntimeEvents(webview);
    }

    if (webview.parentElement !== mount) {
      mount.replaceChildren(webview);
    }

    const currentSrc = webview.getAttribute("src") ?? "";
    if (currentSrc !== runtimeUrl) {
      this.markRuntimeReady(webview, false);
      this.resetPendingHostMessages(webview);
    }

    webview.setAttribute("aria-label", roomPageT("page.runtimeSceneAriaLabel"));

    await RoomHostRuntime.ensureRoomHost(this.room, {
      sendToRoom: (payload) => {
        this.sendRuntimeMessage(webview, payload);
      },
    });

    if (currentSrc !== runtimeUrl) {
      this.runtimeState = "loading";
      this.lastRuntimeEvent = runtimeUrl;
      this.updateRuntimeStatus(page);
      webview.setAttribute("src", runtimeUrl);
      webview.src = runtimeUrl;
    }

    this.sendHostContext(webview, "render-sync");
  }

  private bindRuntimeEvents(webview: RoomWebviewElement): void {
    if (webview.dataset["roomRuntimeBound"] === "true") {
      return;
    }

    webview.dataset["roomRuntimeBound"] = "true";

    webview.addEventListener("did-start-loading", () => {
      const page = this.getPage();
      this.markRuntimeReady(webview, false);
      this.runtimeState = "loading";
      this.lastRuntimeEvent =
        webview.getAttribute("src") ?? toRoomRuntimeFileUrl(this.room.runtimeEntryPath);
      if (page !== null) {
        this.updateRuntimeStatus(page);
      }
    });

    webview.addEventListener("dom-ready", () => {
      this.markRuntimeReady(webview, true);
      this.flushPendingHostMessages(webview);
    });

    webview.addEventListener("did-stop-loading", () => {
      const page = this.getPage();
      this.runtimeState = "ready";
      this.lastRuntimeEvent =
        webview.getAttribute("src") ?? toRoomRuntimeFileUrl(this.room.runtimeEntryPath);
      if (page !== null) {
        this.updateRuntimeStatus(page);
      }
    });

    webview.addEventListener("did-fail-load", (event) => {
      const page = this.getPage();
      const loadEvent = event as RoomLoadErrorEvent;
      if (loadEvent.errorCode === -3) {
        return;
      }
      this.runtimeState = "error";
      this.lastRuntimeEvent =
        loadEvent.errorDescription ?? `Runtime load error (${String(loadEvent.errorCode ?? 0)})`;
      if (page !== null) {
        this.updateRuntimeStatus(page);
      }
    });

    webview.addEventListener("ipc-message", (event) => {
      const ipcEvent = event as RoomIpcMessageEvent;
      if (ipcEvent.channel === "room-ready") {
        const payload = ipcEvent.args?.[0];
        this.runtimeState = "ready";
        this.lastRuntimeEvent = this.describePayload(payload, roomPageT("status.runtimeReady"));
        const page = this.getPage();
        if (page !== null) {
          this.updateRuntimeStatus(page);
        }
        this.sendHostContext(webview, "room-ready");
        void RoomHostRuntime.handleRuntimeMessage(this.room.id, "room-ready", payload);
      }

      if (ipcEvent.channel === "room-command") {
        const payload = ipcEvent.args?.[0];
        this.lastRuntimeEvent = this.describeRoomCommand(payload);
        const page = this.getPage();
        if (page !== null) {
          this.updateRuntimeStatus(page);
        }
        void RoomHostRuntime.handleRuntimeMessage(this.room.id, "room-command", payload);
      }

      if (ipcEvent.channel === "room-event") {
        const payload = ipcEvent.args?.[0];
        this.lastRuntimeEvent = this.describePayload(payload, roomPageT("status.roomEvent"));
        const page = this.getPage();
        if (page !== null) {
          this.updateRuntimeStatus(page);
        }
        void RoomHostRuntime.handleRuntimeMessage(this.room.id, "room-event", payload);
      }
    });
  }

  private buildSlotContext(slotId: "ai1" | "ai2" | "us1"): Record<string, unknown> {
    if (slotId === "us1") {
      const identity = AppState.getUs1Identity();
      const connected = AppState.isUs1Connected();

      return {
        slotId,
        label: slotId.toUpperCase(),
        nickname: AppState.getNickname(slotId),
        assigned: identity !== null,
        connected,
        ready: identity !== null && connected,
        state: connected ? "connected" : identity !== null ? "assigned" : "empty",
        urlExcluded: false,
        providerId: "us1",
        accountId: AppState.getUs1ArchiveAccountId(),
        remoteUserId: identity?.remoteUserId ?? null,
      };
    }

    const slotState = SlotController.getState(slotId) as SlotStateInfo | null;
    const account = AppState.getAccountForSlot(slotId);
    const connected = slotState?.state === "connected";
    const ready =
      slotState !== null &&
      slotState.state === "connected" &&
      slotState.urlExcluded !== true &&
      account !== null;

    return {
      slotId,
      label: slotId.toUpperCase(),
      nickname: AppState.getNickname(slotId),
      assigned: account !== null,
      connected,
      ready,
      state: slotState?.state ?? "empty",
      urlExcluded: slotState?.urlExcluded === true,
      providerId: slotState?.providerId ?? null,
      accountId: account?.id ?? slotState?.accountId ?? null,
    };
  }

  private buildRuntimeContextPayload(reason: string): RoomHostMessage {
    const activeFeature = this.getActiveFeature();
    const sceneFeature = this.getSceneFeature();

    return {
      type: "host-context",
      reason,
      locale: AppI18n.getLocale(),
      translations: AppI18n.getNamespaceCatalog(["rooms", this.room.id]),
      room: {
        id: this.room.id,
        name: this.room.name,
        version: this.room.version,
        runtimeEntryPath: this.room.runtimeEntryPath,
        hostEntryPath: this.room.hostEntryPath,
        defaultFeatureId: this.room.defaultFeatureId,
      },
      user: {
        nickname: AppState.getNickname("user"),
      },
      slots: {
        ai1: this.buildSlotContext("ai1"),
        ai2: this.buildSlotContext("ai2"),
        us1: this.buildSlotContext("us1"),
      },
      features: this.room.features.map((feature) => ({
        id: feature.id,
        name: feature.name,
        description: feature.description ?? "",
      })),
      activeFeature:
        activeFeature === null
          ? null
          : {
              id: activeFeature.id,
              name: activeFeature.name,
              description: activeFeature.description ?? "",
            },
      presentation: {
        mode: this.isSceneFeatureOpen() ? "scene-view" : "classic",
        sceneEnabled: this.room.scene !== undefined,
        sceneViewId: sceneFeature?.scene?.view.id ?? null,
      },
    };
  }

  private sendHostContext(webview: RoomWebviewElement, reason: string): void {
    this.sendRuntimeMessage(webview, this.buildRuntimeContextPayload(reason));
  }

  private async syncRuntimeContext(reason: string): Promise<void> {
    const payload = this.buildRuntimeContextPayload(reason);
    const webview =
      this.getPage()?.querySelector<RoomWebviewElement>("webview[data-room-runtime='true']") ??
      null;
    if (webview !== null) {
      this.sendRuntimeMessage(webview, payload);
    }

    await RoomHostRuntime.handleRuntimeMessage(this.room.id, "room-event", payload);
  }

  private getPendingHostMessages(webview: RoomWebviewElement): RoomHostMessage[] {
    const existing = this.pendingHostMessages.get(webview);
    if (existing !== undefined) {
      return existing;
    }

    const next: RoomHostMessage[] = [];
    this.pendingHostMessages.set(webview, next);
    return next;
  }

  private resetPendingHostMessages(webview: RoomWebviewElement): void {
    this.pendingHostMessages.set(webview, []);
  }

  private markRuntimeReady(webview: RoomWebviewElement, ready: boolean): void {
    webview.dataset["roomRuntimeReady"] = ready ? "true" : "false";
  }

  private isRuntimeReady(webview: RoomWebviewElement): boolean {
    return webview.dataset["roomRuntimeReady"] === "true";
  }

  private sendRuntimeMessage(webview: RoomWebviewElement, payload: RoomHostMessage): void {
    if (!this.isRuntimeReady(webview)) {
      this.getPendingHostMessages(webview).push(payload);
      return;
    }

    try {
      webview.send?.("room-host-message", payload);
    } catch {
      this.markRuntimeReady(webview, false);
      this.getPendingHostMessages(webview).push(payload);
    }
  }

  private flushPendingHostMessages(webview: RoomWebviewElement): void {
    if (!this.isRuntimeReady(webview)) {
      return;
    }

    const queue = this.getPendingHostMessages(webview);
    if (queue.length === 0) {
      return;
    }

    const pending = queue.splice(0, queue.length);
    for (const payload of pending) {
      try {
        webview.send?.("room-host-message", payload);
      } catch {
        this.markRuntimeReady(webview, false);
        queue.unshift(payload);
        break;
      }
    }
  }

  private describeRoomCommand(payload: unknown): string {
    if (payload !== null && typeof payload === "object") {
      const command = "command" in payload ? payload.command : undefined;
      if (typeof command === "string" && command.trim() !== "") {
        return `++cmd:${command.trim()}`;
      }
    }
    return roomPageT("status.commandSent");
  }

  private describePayload(payload: unknown, fallback: string): string {
    if (payload === null || payload === undefined) {
      return fallback;
    }

    if (typeof payload === "string" && payload.trim() !== "") {
      return payload.trim();
    }

    if (typeof payload === "object") {
      const stage = "stage" in payload ? payload.stage : undefined;
      const type = "type" in payload ? payload.type : undefined;
      if (typeof stage === "string" && stage.trim() !== "") {
        return stage.trim();
      }
      if (typeof type === "string" && type.trim() !== "") {
        return type.trim();
      }
      try {
        return JSON.stringify(payload);
      } catch {
        return fallback;
      }
    }

    return fallback;
  }

  private async getRoomPreloadUrl(): Promise<string> {
    if (this.preloadUrlPromise === null) {
      const electronApi = window.electronAPI;
      if (electronApi === undefined || typeof electronApi.getPreloadPath !== "function") {
        this.preloadUrlPromise = Promise.resolve("");
      } else {
        this.preloadUrlPromise = electronApi.getPreloadPath("room").catch(() => "");
      }
    }

    return await this.preloadUrlPromise;
  }
}

function roomPageT(key: string, params?: Record<string, string | number>): string {
  return AppI18n.t(`app.roomPage.${key}`, params);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

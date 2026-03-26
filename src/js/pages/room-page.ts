import type {
  InstalledRoomFeatureRecord,
  InstalledRoomRecord,
  RoomSceneTransparentWindowConfig,
} from "@shared/index.js";
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
import {
  buildRoomBackNode,
  buildRoomSceneObject,
  buildRoomSceneViewBackNode,
  buildStandardSceneViewBackButton,
  DEFAULT_SCENE_REFERENCE_SIZE,
  DEFAULT_SCENE_TRANSPARENT_WINDOW,
  resolveSceneTextValue,
} from "./room-page/scene-helpers.js";
import {
  ensureRoomPageShell,
  renderRoomFeatureButtons,
  shouldShowRoomFeatureStrip,
} from "./room-page/shell-layout.js";
import {
  buildRoomRuntimeContextPayload,
  type RoomHostMessage,
} from "./room-page/runtime-context.js";
import {
  markRoomRuntimeReady,
  resetPendingRoomHostMessages,
  sendRoomRuntimeMessage,
  type RoomWebviewElement,
} from "./room-page/runtime-messaging.js";
import {
  bindRoomRuntimeEvents,
  type RoomRuntimeState,
  updateRoomRuntimeStatus,
} from "./room-page/runtime-events.js";

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
    return shouldShowRoomFeatureStrip(this.usesImmersivePageShell(), this.room.features.length);
  }

  private ensureShell(page: HTMLElement): void {
    ensureRoomPageShell(page, {
      immersive: this.usesImmersivePageShell(),
      showFeatureStrip: this.shouldShowFeatureStrip(),
      onSelectFeature: (featureId) => {
        this.setActiveFeature(featureId, "feature-button");
      },
    });
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
    renderRoomFeatureButtons({
      page,
      room: this.room,
      activeFeatureId,
      showFeatureStrip: this.shouldShowFeatureStrip(),
      escapeHtml,
    });
  }

  private updateRuntimeStatus(page: HTMLElement): void {
    updateRoomRuntimeStatus({
      page,
      runtimeState: this.runtimeState,
      lastRuntimeEvent: this.lastRuntimeEvent,
      translate: roomPageT,
    });
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
        fallbackLabel: roomPageT("page.backToRooms"),
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
      markRoomRuntimeReady(webview, false);
      resetPendingRoomHostMessages(this.pendingHostMessages, webview);
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
    bindRoomRuntimeEvents({
      webview,
      roomId: this.room.id,
      runtimeEntryPath: this.room.runtimeEntryPath,
      pendingHostMessages: this.pendingHostMessages,
      getPage: () => this.getPage(),
      updateRuntimeStatus: (page) => this.updateRuntimeStatus(page),
      setRuntimeState: (runtimeState, lastRuntimeEvent) => {
        this.runtimeState = runtimeState;
        this.lastRuntimeEvent = lastRuntimeEvent;
      },
      sendHostContext: (target, reason) => this.sendHostContext(target, reason),
      translate: roomPageT,
    });
  }

  private buildRuntimeContextPayload(reason: string): RoomHostMessage {
    return buildRoomRuntimeContextPayload({
      activeFeature: this.getActiveFeature(),
      reason,
      room: this.room,
      sceneFeature: this.getSceneFeature(),
      sceneFeatureOpen: this.isSceneFeatureOpen(),
    });
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
      sendRoomRuntimeMessage(this.pendingHostMessages, webview, payload);
    }

    await RoomHostRuntime.handleRuntimeMessage(this.room.id, "room-event", payload);
  }

  private sendRuntimeMessage(webview: RoomWebviewElement, payload: RoomHostMessage): void {
    sendRoomRuntimeMessage(this.pendingHostMessages, webview, payload);
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

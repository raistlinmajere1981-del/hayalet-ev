import type {
  EntranceSceneLabelFontPreset,
  EntranceSceneCharacterAnchorConfig,
  EntranceSceneHotspotConfig,
  EntranceSceneMap,
  SceneDebugNodeListEntry,
  SceneDebugNodeSelection,
} from "./scene-map.js";
import {
  ENTRANCE_SCENE_LABEL_FONT_PRESETS,
  getSceneHotspotLabelId,
  listSceneDebugNodes,
  resolveSceneCharacterForSelection,
  resolveSceneHotspotForSelection,
} from "./scene-map.js";
import { t as entranceT } from "../i18n.js";

export type EntranceSceneEditorSelection = SceneDebugNodeSelection;

export interface EntranceSceneEditorRoomOption {
  id: string;
  label: string;
}

interface EntranceSceneEditorCallbacks {
  isActive(): boolean;
  getSceneMap(): EntranceSceneMap;
  getSelection(): EntranceSceneEditorSelection;
  getRoomOptions(): EntranceSceneEditorRoomOption[];
  getActiveRoomId(): string;
  setSelection(selection: EntranceSceneEditorSelection): void;
  navigateToRoom(roomId: string): void;
  updateHotspot(
    id: string,
    updater: (hotspot: EntranceSceneHotspotConfig) => EntranceSceneHotspotConfig
  ): void;
  updateLabelNode(
    id: string,
    updater: (hotspot: EntranceSceneHotspotConfig) => EntranceSceneHotspotConfig
  ): void;
  updateCharacterAnchor(
    id: string,
    updater: (anchor: EntranceSceneCharacterAnchorConfig) => EntranceSceneCharacterAnchorConfig
  ): void;
  resetDraft(): void;
  copySceneMap(): Promise<void>;
}

const HOTSPOT_DOOR_FIELDS = [
  ["leftPx", "X"],
  ["topPx", "Y"],
  ["widthPx", "W"],
  ["heightPx", "H"],

  ["frameRotateDeg", "Frame R"],
  ["framePerspectiveDeg", "Frame P"],
  ["frameHoverGlowHueDeg", "Glow H"],
  ["frameHoverGlowAlpha", "Glow A"],
] as const;

const HOTSPOT_LABEL_FIELDS = [
  ["labelCenterXPx", "Label X"],
  ["labelTopPx", "Label Y"],
  ["labelWidthPx", "Label W"],
  ["labelHeightPx", "Label H"],
  ["labelRotateDeg", "Label R"],
  ["labelFontSizePx", "Text"],
  ["labelLetterSpacingPx", "Track"],
  ["labelFramePerspectiveDeg", "Label P"],
] as const;

const CHARACTER_FIELDS = [
  ["leftPx", "X"],
  ["bottomPx", "Bottom"],
  ["scale", "Scale"],
  ["depth", "Depth"],
] as const;

const DEBUG_NODE_SECTIONS = [
  { kind: "door", title: "Doors" },
  { kind: "object", title: "Objects" },
  { kind: "label", title: "Labels" },
  { kind: "character", title: "Characters" },
] as const;

type SceneEditorNodeKind = (typeof DEBUG_NODE_SECTIONS)[number]["kind"];

export class EntranceSceneEditor {
  host: HTMLElement;
  callbacks: EntranceSceneEditorCallbacks;
  step = 1;
  panelPosition: { left: number; top: number } | null = null;
  dragState: { pointerId: number; offsetX: number; offsetY: number } | null = null;
  panelScroll = { top: 0, left: 0 };

  constructor(host: HTMLElement, callbacks: EntranceSceneEditorCallbacks) {
    this.host = host;
    this.callbacks = callbacks;
    this.host.addEventListener("click", this.handleClick);
    this.host.addEventListener("change", this.handleChange);
    this.host.addEventListener("pointerdown", this.handlePointerDown);
    window.addEventListener("pointermove", this.handlePointerMove);
    window.addEventListener("pointerup", this.handlePointerUp);
    window.addEventListener("keydown", this.handleKeydown);
  }

  refresh(): void {
    const sceneMap = this.callbacks.getSceneMap();
    const selection = this.callbacks.getSelection();
    const roomOptions = this.callbacks.getRoomOptions();
    const activeRoomId = this.callbacks.getActiveRoomId();
    const debugNodes = listSceneDebugNodes(sceneMap);
    const previousPanel = this.host.querySelector<HTMLElement>(".entrance-scene__editor-panel");
    if (previousPanel !== null) {
      this.panelScroll = {
        top: previousPanel.scrollTop,
        left: previousPanel.scrollLeft,
      };
    }
    const panel = document.createElement("aside");
    panel.className = "entrance-scene__editor-panel";

    const selectedHotspot = resolveSceneHotspotForSelection(sceneMap, selection);
    const selectedCharacter = resolveSceneCharacterForSelection(sceneMap, selection);

    panel.innerHTML = `
      <div class="entrance-scene__editor-room-list" role="tablist" aria-label="Scene rooms">
        ${roomOptions
          .map(
            (room) => `
            <button
              type="button"
              class="entrance-scene__editor-room-btn${room.id === activeRoomId ? " is-active" : ""}"
              data-editor-action="room"
              data-room-id="${room.id}"
              aria-pressed="${String(room.id === activeRoomId)}"
            >
              ${room.label}
            </button>
          `
          )
          .join("")}
      </div>
      <div class="entrance-scene__editor-header">
        <div class="entrance-scene__editor-drag-handle" data-editor-drag-handle="true">
          <h3 class="entrance-scene__editor-title">Scene Editor</h3>
          <p class="entrance-scene__editor-subtitle">Drafts save locally while debug mode is open.</p>
        </div>
        <div class="entrance-scene__editor-toolbar">
          <button type="button" class="btn btn-ghost btn-sm" data-editor-action="copy">Copy JSON</button>
          <button type="button" class="btn btn-ghost btn-sm" data-editor-action="reset">Reset</button>
        </div>
      </div>
      <div class="entrance-scene__editor-stepper" role="group" aria-label="Editor step size">
        ${[1, 5, 10]
          .map(
            (step) => `
            <button
              type="button"
              class="entrance-scene__editor-chip${step === this.step ? " is-active" : ""}"
              data-editor-action="step"
              data-step="${step}"
            >
              ${step}px
            </button>
          `
          )
          .join("")}
      </div>
      <div class="entrance-scene__editor-selected">
        ${this.renderSelectedBlock(selection, selectedHotspot, selectedCharacter)}
      </div>
      <div class="entrance-scene__editor-help">
        <span>Arrow: move</span>
        <span>Shift: x10</span>
        <span>[ ]: rotate/scale</span>
      </div>
      <div class="entrance-scene__editor-list-wrap">
        ${DEBUG_NODE_SECTIONS.map(({ kind, title }) =>
          this.renderNodeSection(
            title,
            debugNodes.filter((node) => node.kind === kind),
            selection
          )
        ).join("")}
      </div>
    `;

    this.host.replaceChildren(panel);
    this.applyPanelPosition(panel);
    panel.scrollTop = this.panelScroll.top;
    panel.scrollLeft = this.panelScroll.left;
  }

  private renderSelectedBlock(
    selection: EntranceSceneEditorSelection,
    hotspot: EntranceSceneHotspotConfig | null,
    character: EntranceSceneCharacterAnchorConfig | null
  ): string {
    if (selection === null || (hotspot === null && character === null)) {
      return `<p class="entrance-scene__editor-empty">Select a door, object, label, or character node from the scene.</p>`;
    }

    if (hotspot !== null && (selection.kind === "door" || selection.kind === "object")) {
      const title = selection.kind === "door" ? "Door" : "Object";
      return `
        <div class="entrance-scene__editor-selected-title">${title}: ${hotspot.id}</div>
        <div class="entrance-scene__editor-section">
          <div class="entrance-scene__editor-section-title">Frame</div>
          <div class="entrance-scene__editor-grid">
            ${HOTSPOT_DOOR_FIELDS.map(([field, label]) =>
              this.renderControlRow(selection.kind, hotspot.id, field, label, hotspot[field])
            ).join("")}
          </div>
        </div>
      `;
    }

    if (hotspot !== null && selection.kind === "label") {
      const labelId = getSceneHotspotLabelId(hotspot.id);
      return `
        <div class="entrance-scene__editor-selected-title">Label: ${labelId}</div>
        <div class="entrance-scene__editor-section">
          <div class="entrance-scene__editor-section-title">Layout</div>
          <div class="entrance-scene__editor-grid">
            ${HOTSPOT_LABEL_FIELDS.map(([field, label]) =>
              this.renderControlRow("label", labelId, field, label, hotspot[field])
            ).join("")}
          </div>
          ${this.renderLabelTextRow(labelId, hotspot)}
          ${this.renderFontPresetRow(labelId, hotspot)}
        </div>
      `;
    }

    if (character !== null && selection.kind === "character") {
      return `
        <div class="entrance-scene__editor-selected-title">Character: ${character.id}</div>
        <div class="entrance-scene__editor-grid">
          ${CHARACTER_FIELDS.map(([field, label]) =>
            this.renderControlRow("character", character.id, field, label, character[field])
          ).join("")}
        </div>
      `;
    }

    return "";
  }

  private renderControlRow(
    kind: SceneEditorNodeKind,
    id: string,
    field: string,
    label: string,
    value: number
  ): string {
    return `
      <div class="entrance-scene__editor-row">
        <span class="entrance-scene__editor-row-label">${label}</span>
        <div class="entrance-scene__editor-row-controls">
          <button type="button" class="entrance-scene__editor-adjust" data-editor-action="adjust" data-kind="${kind}" data-id="${id}" data-field="${field}" data-direction="-1">-</button>
          <span class="entrance-scene__editor-row-value">${value}</span>
          <button type="button" class="entrance-scene__editor-adjust" data-editor-action="adjust" data-kind="${kind}" data-id="${id}" data-field="${field}" data-direction="1">+</button>
        </div>
      </div>
    `;
  }

  private renderNodeSection(
    title: string,
    nodes: SceneDebugNodeListEntry[],
    selection: EntranceSceneEditorSelection
  ): string {
    const content =
      nodes.length > 0
        ? nodes
            .map((node) => this.renderListItem(node.kind, node.id, node.label, selection))
            .join("")
        : `<p class="entrance-scene__editor-empty">No ${title.toLowerCase()}.</p>`;

    return `
      <div class="entrance-scene__editor-section">
        <div class="entrance-scene__editor-section-title">${title}</div>
        <div class="entrance-scene__editor-list">${content}</div>
      </div>
    `;
  }

  private renderListItem(
    kind: SceneEditorNodeKind,
    id: string,
    label: string,
    selection: EntranceSceneEditorSelection
  ): string {
    const selected = selection?.kind === kind && selection.id === id;
    return `
      <button
        type="button"
        class="entrance-scene__editor-item${selected ? " is-selected" : ""}"
        data-editor-action="select"
        data-kind="${kind}"
        data-id="${id}"
      >
        ${label}
      </button>
    `;
  }

  private renderLabelTextRow(id: string, hotspot: EntranceSceneHotspotConfig): string {
    const value = typeof hotspot.labelCustomText === "string" ? hotspot.labelCustomText : "";
    const placeholder = this.escapeAttribute(entranceT("scene.editor.customLabelPlaceholder"));
    return `
      <label class="entrance-scene__editor-row entrance-scene__editor-row--stack">
        <span class="entrance-scene__editor-row-label">Custom label</span>
        <input
          type="text"
          class="entrance-scene__editor-input"
          value="${this.escapeAttribute(value)}"
          placeholder="${placeholder}"
          data-editor-action="text"
          data-id="${id}"
          data-field="labelCustomText"
        />
      </label>
    `;
  }

  private renderFontPresetRow(id: string, hotspot: EntranceSceneHotspotConfig): string {
    return `
      <div class="entrance-scene__editor-row">
        <span class="entrance-scene__editor-row-label">Font</span>
        <div class="entrance-scene__editor-row-controls">
          <button type="button" class="entrance-scene__editor-adjust" data-editor-action="cycle-font" data-id="${id}" data-direction="-1">-</button>
          <span class="entrance-scene__editor-row-value entrance-scene__editor-row-value--wide">${this.formatFontPreset(hotspot.labelFontPreset)}</span>
          <button type="button" class="entrance-scene__editor-adjust" data-editor-action="cycle-font" data-id="${id}" data-direction="1">+</button>
        </div>
      </div>
    `;
  }

  private handleClick = (event: Event): void => {
    const target = event.target as HTMLElement | null;
    const actionButton = target?.closest<HTMLElement>("[data-editor-action]") ?? null;
    if (actionButton === null) {
      return;
    }

    const action = actionButton.dataset["editorAction"] ?? "";
    if (action === "step") {
      const parsedStep = Number(actionButton.dataset["step"] ?? "1");
      this.step = Number.isNaN(parsedStep) || parsedStep === 0 ? 1 : parsedStep;
      this.refresh();
      return;
    }

    if (action === "copy") {
      void this.callbacks.copySceneMap();
      return;
    }

    if (action === "room") {
      const roomId = actionButton.dataset["roomId"] ?? "";
      if (roomId !== "") {
        this.callbacks.navigateToRoom(roomId);
      }
      return;
    }

    if (action === "reset") {
      this.callbacks.resetDraft();
      return;
    }

    if (action === "select") {
      const kind = actionButton.dataset["kind"];
      const id = actionButton.dataset["id"];
      if (
        (kind === "door" || kind === "object" || kind === "label" || kind === "character") &&
        id !== undefined
      ) {
        this.callbacks.setSelection({ kind, id });
      }
      return;
    }

    if (action === "cycle-font") {
      const id = actionButton.dataset["id"] ?? "";
      const direction = Number(actionButton.dataset["direction"] ?? "0");
      this.callbacks.updateLabelNode(id, (hotspot) => ({
        ...hotspot,
        labelFontPreset: this.shiftFontPreset(hotspot.labelFontPreset, direction),
      }));
      return;
    }

    if (action === "adjust") {
      const kind = actionButton.dataset["kind"];
      const id = actionButton.dataset["id"] ?? "";
      const field = actionButton.dataset["field"] ?? "";
      const direction = Number(actionButton.dataset["direction"] ?? "0");
      this.adjustField(kind, id, field, this.getAdjustDelta(field, direction));
    }
  };

  private handleChange = (event: Event): void => {
    const target = event.target as HTMLElement | null;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    if (target.dataset["editorAction"] !== "text") {
      return;
    }
    const id = target.dataset["id"] ?? "";
    const field = target.dataset["field"] ?? "";
    if (id === "" || field !== "labelCustomText") {
      return;
    }
    const nextValue = target.value.trim();
    this.callbacks.updateLabelNode(id, (hotspot) => {
      if (nextValue === "") {
        const { labelCustomText: _labelCustomText, ...nextHotspot } = hotspot;
        return nextHotspot;
      }
      return {
        ...hotspot,
        labelCustomText: nextValue,
      };
    });
  };

  private handleKeydown = (event: KeyboardEvent): void => {
    if (!this.callbacks.isActive()) {
      return;
    }

    const selection = this.callbacks.getSelection();
    if (selection === null) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      return;
    }

    const step = event.shiftKey ? this.step * 10 : this.step;

    if (selection.kind === "door" || selection.kind === "object") {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        this.adjustField(selection.kind, selection.id, "leftPx", -step);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        this.adjustField(selection.kind, selection.id, "leftPx", step);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        this.adjustField(selection.kind, selection.id, "topPx", -step);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        this.adjustField(selection.kind, selection.id, "topPx", step);
      } else if (event.key === "[") {
        event.preventDefault();
        this.adjustField(
          selection.kind,
          selection.id,
          "frameRotateDeg",
          this.getAdjustDelta("frameRotateDeg", -1)
        );
      } else if (event.key === "]") {
        event.preventDefault();
        this.adjustField(
          selection.kind,
          selection.id,
          "frameRotateDeg",
          this.getAdjustDelta("frameRotateDeg", 1)
        );
      }
      return;
    }

    if (selection.kind === "label") {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        this.adjustField("label", selection.id, "labelCenterXPx", -step);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        this.adjustField("label", selection.id, "labelCenterXPx", step);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        this.adjustField("label", selection.id, "labelTopPx", -step);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        this.adjustField("label", selection.id, "labelTopPx", step);
      } else if (event.key === "[") {
        event.preventDefault();
        this.adjustField(
          "label",
          selection.id,
          "labelRotateDeg",
          this.getAdjustDelta("labelRotateDeg", -1)
        );
      } else if (event.key === "]") {
        event.preventDefault();
        this.adjustField(
          "label",
          selection.id,
          "labelRotateDeg",
          this.getAdjustDelta("labelRotateDeg", 1)
        );
      }
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      this.adjustField("character", selection.id, "leftPx", -step);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      this.adjustField("character", selection.id, "leftPx", step);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      this.adjustField("character", selection.id, "bottomPx", step);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      this.adjustField("character", selection.id, "bottomPx", -step);
    } else if (event.key === "[") {
      event.preventDefault();
      this.adjustField("character", selection.id, "scale", -this.getScaleStep());
    } else if (event.key === "]") {
      event.preventDefault();
      this.adjustField("character", selection.id, "scale", this.getScaleStep());
    }
  };

  private handlePointerDown = (event: PointerEvent): void => {
    const target = event.target as HTMLElement | null;
    const dragHandle = target?.closest<HTMLElement>("[data-editor-drag-handle]") ?? null;
    if (dragHandle === null) {
      return;
    }

    if (target?.closest("button") !== null) {
      return;
    }

    const panel = dragHandle.closest<HTMLElement>(".entrance-scene__editor-panel");
    if (panel === null) {
      return;
    }

    const hostRect = this.host.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    this.panelPosition = {
      left: panelRect.left - hostRect.left,
      top: panelRect.top - hostRect.top,
    };
    this.dragState = {
      pointerId: event.pointerId,
      offsetX: event.clientX - panelRect.left,
      offsetY: event.clientY - panelRect.top,
    };
    panel.classList.add("is-dragging");
    event.preventDefault();
  };

  private handlePointerMove = (event: PointerEvent): void => {
    if (!this.callbacks.isActive()) {
      return;
    }

    if (this.dragState?.pointerId !== event.pointerId) {
      return;
    }

    const panel = this.host.querySelector<HTMLElement>(".entrance-scene__editor-panel");
    if (panel === null) {
      return;
    }

    const hostRect = this.host.getBoundingClientRect();
    this.panelPosition = this.clampPanelPosition(
      event.clientX - hostRect.left - this.dragState.offsetX,
      event.clientY - hostRect.top - this.dragState.offsetY,
      panel
    );
    this.applyPanelPosition(panel);
  };

  private handlePointerUp = (event: PointerEvent): void => {
    if (!this.callbacks.isActive()) {
      return;
    }

    if (this.dragState?.pointerId !== event.pointerId) {
      return;
    }

    const panel = this.host.querySelector<HTMLElement>(".entrance-scene__editor-panel");
    panel?.classList.remove("is-dragging");
    this.dragState = null;
  };

  private adjustField(kind: string | undefined, id: string, field: string, delta: number): void {
    if (kind === "door" || kind === "object") {
      this.callbacks.updateHotspot(id, (hotspot) => ({
        ...hotspot,
        [field]: this.roundField(
          field,
          hotspot[field as keyof EntranceSceneHotspotConfig] as number,
          delta
        ),
      }));
      return;
    }

    if (kind === "label") {
      this.callbacks.updateLabelNode(id, (hotspot) => ({
        ...hotspot,
        [field]: this.roundField(
          field,
          hotspot[field as keyof EntranceSceneHotspotConfig] as number,
          delta
        ),
      }));
      return;
    }

    if (kind === "character") {
      this.callbacks.updateCharacterAnchor(id, (anchor) => ({
        ...anchor,
        [field]: this.roundField(
          field,
          anchor[field as keyof EntranceSceneCharacterAnchorConfig] as number,
          delta
        ),
      }));
    }
  }

  private roundField(field: string, current: number, delta: number): number {
    const next = current + delta;
    if (field === "scale") {
      return Number(Math.max(0.2, next).toFixed(2));
    }
    if (field.endsWith("Alpha")) {
      return Number(Math.min(1, Math.max(0, next)).toFixed(2));
    }
    if (field.endsWith("HueDeg")) {
      const wrapped = ((next % 360) + 360) % 360;
      return Math.round(wrapped);
    }
    if (field.endsWith("RotateDeg") || field.endsWith("PerspectiveDeg")) {
      return Number(next.toFixed(1));
    }
    return Math.round(next);
  }

  private getScaleStep(): number {
    return Math.max(0.01, this.step / 100);
  }

  private getAdjustDelta(field: string, direction: number): number {
    if (field === "scale") {
      return direction * this.getScaleStep();
    }
    if (field.endsWith("RotateDeg")) {
      return direction * (this.step / 10);
    }
    if (field.endsWith("Alpha")) {
      return direction * this.getScaleStep();
    }
    if (field.endsWith("HueDeg")) {
      return direction * this.step;
    }
    if (field.endsWith("Px")) {
      return direction * this.step;
    }
    return direction;
  }

  private shiftFontPreset(
    current: EntranceSceneLabelFontPreset,
    direction: number
  ): EntranceSceneLabelFontPreset {
    const currentIndex = ENTRANCE_SCENE_LABEL_FONT_PRESETS.indexOf(current);
    const nextIndex =
      (currentIndex + direction + ENTRANCE_SCENE_LABEL_FONT_PRESETS.length) %
      ENTRANCE_SCENE_LABEL_FONT_PRESETS.length;
    return ENTRANCE_SCENE_LABEL_FONT_PRESETS[nextIndex] ?? "display";
  }

  private formatFontPreset(preset: EntranceSceneLabelFontPreset): string {
    if (preset === "inscription") {
      return "Inscription";
    }
    if (preset === "classic") {
      return "Classic";
    }
    if (preset === "sans") {
      return "Sans";
    }
    if (preset === "rounded") {
      return "Rounded";
    }
    if (preset === "condensed") {
      return "Condensed";
    }
    if (preset === "mono") {
      return "Mono";
    }
    return "Display";
  }

  private escapeAttribute(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/'/g, "&#39;");
  }

  private applyPanelPosition(panel: HTMLElement): void {
    if (this.panelPosition === null) {
      this.panelPosition = this.clampPanelPosition(
        16,
        this.host.clientHeight - panel.offsetHeight - 16,
        panel
      );
    } else {
      this.panelPosition = this.clampPanelPosition(
        this.panelPosition.left,
        this.panelPosition.top,
        panel
      );
    }

    panel.style.left = `${this.panelPosition.left}px`;
    panel.style.top = `${this.panelPosition.top}px`;
    panel.style.bottom = "auto";
  }

  private clampPanelPosition(
    left: number,
    top: number,
    panel: HTMLElement
  ): { left: number; top: number } {
    const maxLeft = Math.max(16, this.host.clientWidth - panel.offsetWidth - 16);
    const maxTop = Math.max(16, this.host.clientHeight - panel.offsetHeight - 16);
    return {
      left: Math.min(Math.max(16, left), maxLeft),
      top: Math.min(Math.max(16, top), maxTop),
    };
  }
}

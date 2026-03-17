import type {
  EntranceSceneLabelFontPreset,
  EntranceSceneCharacterAnchorConfig,
  EntranceSceneHotspotConfig,
  EntranceSceneMap,
} from "./scene-map.js";
import { ENTRANCE_SCENE_LABEL_FONT_PRESETS } from "./scene-map.js";
import { t as entranceT } from "../i18n.js";

export type EntranceSceneEditorSelection =
  | { kind: "hotspot"; id: string }
  | { kind: "character"; id: string }
  | null;

interface EntranceSceneEditorCallbacks {
  getSceneMap(): EntranceSceneMap;
  getSelection(): EntranceSceneEditorSelection;
  setSelection(selection: EntranceSceneEditorSelection): void;
  updateHotspot(
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
    const previousPanel = this.host.querySelector<HTMLElement>(".entrance-scene__editor-panel");
    if (previousPanel !== null) {
      this.panelScroll = {
        top: previousPanel.scrollTop,
        left: previousPanel.scrollLeft,
      };
    }
    const panel = document.createElement("aside");
    panel.className = "entrance-scene__editor-panel";

    const selectedHotspot =
      selection?.kind === "hotspot"
        ? (sceneMap.hotspots.find((item) => item.id === selection.id) ?? null)
        : null;
    const selectedCharacter =
      selection?.kind === "character"
        ? (sceneMap.characterAnchors.find((item) => item.id === selection.id) ?? null)
        : null;

    panel.innerHTML = `
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
        ${this.renderSelectedBlock(selectedHotspot, selectedCharacter)}
      </div>
      <div class="entrance-scene__editor-help">
        <span>Arrow: move</span>
        <span>Shift: x10</span>
        <span>[ ]: rotate/scale</span>
      </div>
      <div class="entrance-scene__editor-list-wrap">
        <div class="entrance-scene__editor-section">
          <div class="entrance-scene__editor-section-title">Hotspots</div>
          <div class="entrance-scene__editor-list">
            ${sceneMap.hotspots.map((item) => this.renderListItem("hotspot", item.id, item.id, selection)).join("")}
          </div>
        </div>
        <div class="entrance-scene__editor-section">
          <div class="entrance-scene__editor-section-title">Characters</div>
          <div class="entrance-scene__editor-list">
            ${sceneMap.characterAnchors
              .map((item) => this.renderListItem("character", item.id, item.id, selection))
              .join("")}
          </div>
        </div>
      </div>
    `;

    this.host.replaceChildren(panel);
    this.applyPanelPosition(panel);
    panel.scrollTop = this.panelScroll.top;
    panel.scrollLeft = this.panelScroll.left;
  }

  private renderSelectedBlock(
    hotspot: EntranceSceneHotspotConfig | null,
    character: EntranceSceneCharacterAnchorConfig | null
  ): string {
    if (hotspot === null && character === null) {
      return `<p class="entrance-scene__editor-empty">Select a hotspot or character anchor from the scene.</p>`;
    }

    if (hotspot !== null) {
      return `
        <div class="entrance-scene__editor-selected-title">Hotspot: ${hotspot.id}</div>
        <div class="entrance-scene__editor-section">
          <div class="entrance-scene__editor-section-title">Door</div>
          <div class="entrance-scene__editor-grid">
            ${HOTSPOT_DOOR_FIELDS.map(([field, label]) => this.renderControlRow("hotspot", hotspot.id, field, label, hotspot[field])).join("")}
          </div>
        </div>
        <div class="entrance-scene__editor-section">
          <div class="entrance-scene__editor-section-title">Label</div>
          <div class="entrance-scene__editor-grid">
            ${HOTSPOT_LABEL_FIELDS.map(([field, label]) => this.renderControlRow("hotspot", hotspot.id, field, label, hotspot[field])).join("")}
          </div>
          ${this.renderLabelTextRow(hotspot)}
          ${this.renderFontPresetRow(hotspot)}
        </div>
      `;
    }

    if (character !== null) {
      return `
        <div class="entrance-scene__editor-selected-title">Character: ${character.id}</div>
        <div class="entrance-scene__editor-grid">
          ${CHARACTER_FIELDS.map(([field, label]) => this.renderControlRow("character", character.id, field, label, character[field])).join("")}
        </div>
      `;
    }

    return "";
  }

  private renderControlRow(
    kind: "hotspot" | "character",
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

  private renderListItem(
    kind: "hotspot" | "character",
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

  private renderLabelTextRow(hotspot: EntranceSceneHotspotConfig): string {
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
          data-id="${hotspot.id}"
          data-field="labelCustomText"
        />
      </label>
    `;
  }

  private renderFontPresetRow(hotspot: EntranceSceneHotspotConfig): string {
    return `
      <div class="entrance-scene__editor-row">
        <span class="entrance-scene__editor-row-label">Font</span>
        <div class="entrance-scene__editor-row-controls">
          <button type="button" class="entrance-scene__editor-adjust" data-editor-action="cycle-font" data-id="${hotspot.id}" data-direction="-1">-</button>
          <span class="entrance-scene__editor-row-value entrance-scene__editor-row-value--wide">${this.formatFontPreset(hotspot.labelFontPreset)}</span>
          <button type="button" class="entrance-scene__editor-adjust" data-editor-action="cycle-font" data-id="${hotspot.id}" data-direction="1">+</button>
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

    if (action === "reset") {
      this.callbacks.resetDraft();
      return;
    }

    if (action === "select") {
      const kind = actionButton.dataset["kind"];
      const id = actionButton.dataset["id"];
      if ((kind === "hotspot" || kind === "character") && id !== undefined) {
        this.callbacks.setSelection({ kind, id });
      }
      return;
    }

    if (action === "cycle-font") {
      const id = actionButton.dataset["id"] ?? "";
      const direction = Number(actionButton.dataset["direction"] ?? "0");
      this.callbacks.updateHotspot(id, (hotspot) => ({
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
    this.callbacks.updateHotspot(id, (hotspot) => ({
      ...hotspot,
      labelCustomText: nextValue === "" ? undefined : nextValue,
    }));
  };

  private handleKeydown = (event: KeyboardEvent): void => {
    const selection = this.callbacks.getSelection();
    if (selection === null) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      return;
    }

    const step = event.shiftKey ? this.step * 10 : this.step;

    if (selection.kind === "hotspot") {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        this.adjustField("hotspot", selection.id, "leftPx", -step);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        this.adjustField("hotspot", selection.id, "leftPx", step);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        this.adjustField("hotspot", selection.id, "topPx", -step);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        this.adjustField("hotspot", selection.id, "topPx", step);
      } else if (event.key === "[") {
        event.preventDefault();
        this.adjustField(
          "hotspot",
          selection.id,
          "frameRotateDeg",
          this.getAdjustDelta("frameRotateDeg", -1)
        );
      } else if (event.key === "]") {
        event.preventDefault();
        this.adjustField(
          "hotspot",
          selection.id,
          "frameRotateDeg",
          this.getAdjustDelta("frameRotateDeg", 1)
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
    if (this.dragState?.pointerId !== event.pointerId) {
      return;
    }

    const panel = this.host.querySelector<HTMLElement>(".entrance-scene__editor-panel");
    panel?.classList.remove("is-dragging");
    this.dragState = null;
  };

  private adjustField(kind: string | undefined, id: string, field: string, delta: number): void {
    if (kind === "hotspot") {
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
    if (field === "frameRotateDeg") {
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

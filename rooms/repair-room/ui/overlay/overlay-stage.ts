import type {
  RepairEvent,
  RepairImagePoint,
  RepairImageRect,
  RepairOverlayLayerId,
  RepairPcbImageRef,
  RepairWorkbenchState,
} from "../../shared/types/index.js";
import { REPAIR_UI_COLORS } from "../../shared/repair-constants.js";
import type Konva from "konva";
import {
  clampImagePoint,
  getContainedImageFrame,
  imageRectToStageRect,
  stagePointToImagePoint,
} from "./overlay-coords.js";
import { isRepairOverlayDrawTool } from "./overlay-tools.js";

type KonvaNamespace = typeof Konva;
type KonvaGlobal = typeof globalThis & { Konva?: unknown };
type RepairKonvaContainer =
  | InstanceType<KonvaNamespace["Layer"]>
  | InstanceType<KonvaNamespace["Group"]>;

export interface RepairOverlayEventInteraction {
  additive: boolean;
  focusJump: boolean;
}

let konvaLoadPromise: Promise<KonvaNamespace> | null = null;

function isKonvaNamespace(value: unknown): value is KonvaNamespace {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate["Stage"] === "function" &&
    typeof candidate["Layer"] === "function" &&
    typeof candidate["Group"] === "function" &&
    typeof candidate["Rect"] === "function" &&
    typeof candidate["Line"] === "function" &&
    typeof candidate["Circle"] === "function" &&
    typeof candidate["Text"] === "function"
  );
}

function getGlobalKonva(): KonvaNamespace | null {
  const value = (globalThis as KonvaGlobal).Konva;
  return isKonvaNamespace(value) ? value : null;
}

async function loadKonvaNamespace(documentRef: Document): Promise<KonvaNamespace> {
  const existing = getGlobalKonva();
  if (existing !== null) return existing;

  if (konvaLoadPromise === null) {
    konvaLoadPromise = new Promise<KonvaNamespace>((resolve, reject) => {
      const script = documentRef.createElement("script");
      script.async = true;
      script.dataset["repairVendor"] = "konva";
      script.src = new URL("../../shared/vendor/konva.min.js", import.meta.url).href;
      script.onload = () => {
        const loaded = getGlobalKonva();
        if (loaded === null) {
          reject(new Error("Repair Room Konva vendor loaded without exposing window.Konva."));
          return;
        }
        resolve(loaded);
      };
      script.onerror = () => {
        reject(new Error(`Repair Room failed to load Konva vendor from ${script.src}`));
      };
      documentRef.head.append(script);
    });
  }

  try {
    return await konvaLoadPromise;
  } catch (error) {
    konvaLoadPromise = null;
    throw error;
  }
}

export interface RepairOverlayStageConfig {
  container: HTMLElement;
  events: RepairEvent[];
  focusedEventId: string | null;
  image: RepairPcbImageRef;
  knowledgeRegions: Array<{ id: string; label: string; region: RepairImageRect }>;
  visibleLayers: Record<RepairOverlayLayerId, boolean>;
  workbench: RepairWorkbenchState;
  onAddAnnotation: (payload: {
    tool: string;
    xPx: number;
    yPx: number;
    widthPx?: number;
    heightPx?: number;
    label?: string;
  }) => void;
  onAddMeasurement: (payload: {
    eventId?: string;
    xPx: number;
    yPx: number;
    reference: string;
  }) => void;
  onCursor: (point: RepairImagePoint) => void;
  onEventClick: (eventId: string, interaction: RepairOverlayEventInteraction) => void;
  onEventHover: (eventId: string | null) => void;
  onSelectionClear: () => void;
  onViewportChange: (payload: { zoom: number; panXPx: number; panYPx: number }) => void;
}

export interface RepairOverlayController {
  update: (config: RepairOverlayStageConfig) => void;
  resize: () => void;
  destroy: () => void;
}

function getStageSize(container: HTMLElement): { width: number; height: number } {
  const rect = container.getBoundingClientRect();
  return {
    width: Math.max(1, Math.round(rect.width || container.clientWidth || 800)),
    height: Math.max(1, Math.round(rect.height || container.clientHeight || 480)),
  };
}

function addGridLayer(
  Konva: KonvaNamespace,
  config: RepairOverlayStageConfig,
  layer: RepairKonvaContainer
): void {
  if (!config.visibleLayers.grid) return;
  const { width, height } = getStageSize(config.container);
  const frame = getContainedImageFrame(width, height, config.image.widthPx, config.image.heightPx);
  const stepPx = Math.max(
    12,
    config.image.pixelsPerMm * 10 * frame.scale * config.workbench.viewport.zoom
  );
  const startX = frame.leftPx + config.workbench.viewport.panXPx;
  const startY = frame.topPx + config.workbench.viewport.panYPx;
  const endX =
    frame.leftPx +
    frame.widthPx * config.workbench.viewport.zoom +
    config.workbench.viewport.panXPx;
  const endY =
    frame.topPx +
    frame.heightPx * config.workbench.viewport.zoom +
    config.workbench.viewport.panYPx;

  for (let x = startX; x <= endX; x += stepPx) {
    layer.add(
      new Konva.Line({
        points: [x, startY, x, endY],
        stroke: "rgba(86, 200, 222, 0.16)",
        strokeWidth: 1,
      })
    );
  }
  for (let y = startY; y <= endY; y += stepPx) {
    layer.add(
      new Konva.Line({
        points: [startX, y, endX, y],
        stroke: "rgba(86, 200, 222, 0.12)",
        strokeWidth: 1,
      })
    );
  }

  layer.add(
    new Konva.Text({
      x: startX + 10,
      y: startY + 10,
      text: "10mm",
      fontFamily: "IBM Plex Mono, JetBrains Mono, monospace",
      fontSize: 10,
      fill: "rgba(226, 232, 240, 0.62)",
    })
  );
}

function addLabel(
  Konva: KonvaNamespace,
  layer: RepairKonvaContainer,
  x: number,
  y: number,
  text: string,
  color: string
): void {
  const label = new Konva.Label({ x, y, listening: false });
  label.add(
    new Konva.Tag({
      fill: "rgba(5, 8, 12, 0.84)",
      stroke: color,
      strokeWidth: 1,
      cornerRadius: 3,
      lineJoin: "round",
    })
  );
  label.add(
    new Konva.Text({
      text,
      padding: 5,
      fill: color,
      fontFamily: "IBM Plex Mono, JetBrains Mono, monospace",
      fontSize: 10,
    })
  );
  layer.add(label);
}

function hasEventModifier(
  event: unknown,
  key: "shiftKey" | "ctrlKey" | "metaKey" | "altKey"
): boolean {
  const candidate = event as Partial<Record<typeof key, unknown>> | null;
  return typeof candidate?.[key] === "boolean" ? Boolean(candidate[key]) : false;
}

function getInteractionFromKonvaEvent(event: { evt?: unknown }): RepairOverlayEventInteraction {
  const nativeEvent = event.evt;
  return {
    additive:
      hasEventModifier(nativeEvent, "shiftKey") ||
      hasEventModifier(nativeEvent, "ctrlKey") ||
      hasEventModifier(nativeEvent, "metaKey"),
    focusJump: hasEventModifier(nativeEvent, "altKey") === false,
  };
}

function getEventInteractionState(
  config: RepairOverlayStageConfig,
  eventId: string
): { hovered: boolean; selected: boolean; focused: boolean } {
  return {
    hovered:
      config.workbench.selection.hoveredEventId === eventId ||
      config.workbench.hoveredEventId === eventId,
    selected: config.workbench.selection.selectedEventIds.includes(eventId),
    focused: config.focusedEventId === eventId,
  };
}

function addRectSelectionAssist(
  Konva: KonvaNamespace,
  layer: RepairKonvaContainer,
  rect: RepairImageRect,
  color: string,
  selected: boolean,
  hovered: boolean
): void {
  if (!selected && !hovered) return;
  layer.add(
    new Konva.Rect({
      x: rect.xPx - 4,
      y: rect.yPx - 4,
      width: rect.widthPx + 8,
      height: rect.heightPx + 8,
      stroke: color,
      strokeWidth: selected ? 1.5 : 1,
      dash: selected ? [4, 3] : [2, 4],
      opacity: selected ? 0.88 : 0.54,
      cornerRadius: 6,
      listening: false,
    })
  );
}

function addAiEvent(
  Konva: KonvaNamespace,
  config: RepairOverlayStageConfig,
  layer: RepairKonvaContainer,
  event: RepairEvent
): void {
  if ((event.kind !== "ai-mark" && event.kind !== "risk-flag") || event.region === null) return;
  if (!config.visibleLayers["ai-marks"]) return;
  if (event.kind === "risk-flag" && !config.visibleLayers.risks) return;
  const rect = event.region;
  const color =
    event.kind === "risk-flag" || event.severity === "risk"
      ? REPAIR_UI_COLORS.risk
      : REPAIR_UI_COLORS.amber;
  const interaction = getEventInteractionState(config, event.id);
  const shape = new Konva.Rect({
    x: rect.xPx,
    y: rect.yPx,
    width: rect.widthPx,
    height: rect.heightPx,
    stroke: color,
    strokeWidth: interaction.selected || interaction.focused ? 3 : interaction.hovered ? 2.5 : 2,
    dash: [8, 5],
    fill:
      event.kind === "risk-flag"
        ? interaction.hovered
          ? "rgba(217, 122, 122, 0.16)"
          : "rgba(217, 122, 122, 0.10)"
        : interaction.hovered
          ? "rgba(232, 168, 87, 0.16)"
          : "rgba(232, 168, 87, 0.10)",
    cornerRadius: 5,
    shadowColor: color,
    shadowBlur: interaction.selected || interaction.hovered ? 12 : 0,
    shadowOpacity: interaction.selected ? 0.28 : 0.16,
  });
  shape.on("click tap", (konvaEvent) => {
    config.onEventClick(event.id, getInteractionFromKonvaEvent(konvaEvent));
  });
  shape.on("mouseenter", () => {
    config.onEventHover(event.id);
  });
  shape.on("mouseleave", () => {
    config.onEventHover(null);
  });
  layer.add(shape);
  addRectSelectionAssist(Konva, layer, rect, color, interaction.selected, interaction.hovered);
  addLabel(
    Konva,
    layer,
    rect.xPx,
    Math.max(0, rect.yPx - 26),
    event.kind === "risk-flag" ? "RISK" : "AI SUGGESTION",
    color
  );
}

function addAnnotationEvent(
  Konva: KonvaNamespace,
  config: RepairOverlayStageConfig,
  layer: RepairKonvaContainer,
  event: RepairEvent
): void {
  if (event.kind !== "annotation" || !config.visibleLayers.annotations) return;
  const author = event.meta?.author ?? event.source;
  if (author === "operator" && !config.visibleLayers["operator-annotations"]) return;
  if (author === "ai" && !config.visibleLayers["ai-annotations"]) return;
  const color = event.color;
  const interaction = getEventInteractionState(config, event.id);
  if (event.region !== null) {
    const rect = event.region;
    if (event.tool === "arrow") {
      const shape = new Konva.Arrow({
        points: [rect.xPx, rect.yPx, rect.xPx + rect.widthPx, rect.yPx + rect.heightPx],
        pointerLength: 10,
        pointerWidth: 8,
        stroke: color,
        strokeWidth: interaction.selected || interaction.focused ? 3 : interaction.hovered ? 2.5 : 2,
        fill: color,
        shadowColor: color,
        shadowBlur: interaction.selected || interaction.hovered ? 10 : 0,
        shadowOpacity: interaction.selected ? 0.24 : 0.16,
      });
      shape.on("click tap", (konvaEvent) => {
        config.onEventClick(event.id, getInteractionFromKonvaEvent(konvaEvent));
      });
      shape.on("mouseenter", () => {
        config.onEventHover(event.id);
      });
      shape.on("mouseleave", () => {
        config.onEventHover(null);
      });
      layer.add(shape);
      addRectSelectionAssist(Konva, layer, rect, color, interaction.selected, interaction.hovered);
      addLabel(Konva, layer, rect.xPx, rect.yPx + 8, event.label, color);
      return;
    }
    const shape = new Konva.Rect({
      x: rect.xPx,
      y: rect.yPx,
      width: rect.widthPx,
      height: rect.heightPx,
      stroke: color,
      strokeWidth: interaction.selected || interaction.focused ? 3 : interaction.hovered ? 2.5 : 2,
      dash: event.tool === "freehand" ? [3, 3] : [],
      cornerRadius: 4,
      shadowColor: color,
      shadowBlur: interaction.selected || interaction.hovered ? 9 : 0,
      shadowOpacity: interaction.selected ? 0.22 : 0.14,
    });
    shape.on("click tap", (konvaEvent) => {
      config.onEventClick(event.id, getInteractionFromKonvaEvent(konvaEvent));
    });
    shape.on("mouseenter", () => {
      config.onEventHover(event.id);
    });
    shape.on("mouseleave", () => {
      config.onEventHover(null);
    });
    layer.add(shape);
    addRectSelectionAssist(Konva, layer, rect, color, interaction.selected, interaction.hovered);
    addLabel(Konva, layer, rect.xPx, rect.yPx + rect.heightPx + 5, event.label, color);
    return;
  }
  if (event.point !== null) {
    const point = event.point;
    const marker = new Konva.Circle({
      x: point.xPx,
      y: point.yPx,
      radius: interaction.selected || interaction.hovered ? 8 : 6,
      fill: color,
      stroke: "rgba(0, 0, 0, 0.72)",
      strokeWidth: 2,
      shadowColor: color,
      shadowBlur: interaction.selected || interaction.hovered ? 10 : 0,
      shadowOpacity: interaction.selected ? 0.24 : 0.14,
    });
    marker.on("click tap", (konvaEvent) => {
      config.onEventClick(event.id, getInteractionFromKonvaEvent(konvaEvent));
    });
    marker.on("mouseenter", () => {
      config.onEventHover(event.id);
    });
    marker.on("mouseleave", () => {
      config.onEventHover(null);
    });
    layer.add(marker);
    addLabel(Konva, layer, point.xPx + 8, point.yPx - 12, event.label, color);
  }
}

function addMeasurementEvent(
  Konva: KonvaNamespace,
  config: RepairOverlayStageConfig,
  layer: RepairKonvaContainer,
  event: RepairEvent
): void {
  if (
    event.kind !== "measurement" ||
    event.pinAt === null ||
    !config.visibleLayers["measurement-pins"] ||
    !config.visibleLayers.measurements
  )
    return;
  const point = event.pinAt;
  const interaction = getEventInteractionState(config, event.id);
  const group = new Konva.Group({
    x: point.xPx,
    y: point.yPx,
    draggable: config.workbench.contextualCursor !== "replay-scrub-lock",
  });
  group.add(
    new Konva.Circle({
      x: 0,
      y: 0,
      radius: interaction.selected || interaction.hovered ? 9 : 7,
      fill: REPAIR_UI_COLORS.cyan,
      stroke: "rgba(0, 0, 0, 0.72)",
      strokeWidth: 2,
      shadowColor: REPAIR_UI_COLORS.cyan,
      shadowBlur: interaction.selected || interaction.hovered ? 10 : 0,
      shadowOpacity: interaction.selected ? 0.24 : 0.14,
    })
  );
  group.add(
    new Konva.Text({
      x: 12,
      y: -9,
      text: `${event.reference ?? event.channel} — ${event.rawDisplay} ${event.unit}`,
      fill: REPAIR_UI_COLORS.cyan,
      fontFamily: "IBM Plex Mono, JetBrains Mono, monospace",
      fontSize: 10,
    })
  );
  group.on("click tap", (konvaEvent) => {
    config.onEventClick(event.id, getInteractionFromKonvaEvent(konvaEvent));
  });
  group.on("mouseenter", () => {
    config.onEventHover(event.id);
  });
  group.on("mouseleave", () => {
    config.onEventHover(null);
  });
  group.on("dragend", () => {
    const clamped = clampImagePoint(
      { xPx: group.x(), yPx: group.y() },
      config.image.widthPx,
      config.image.heightPx
    );
    config.onAddMeasurement({
      eventId: event.id,
      xPx: Math.round(clamped.xPx),
      yPx: Math.round(clamped.yPx),
      reference: event.reference ?? "Dragged probe",
    });
  });
  layer.add(group);
}

function addKnowledgeRegions(
  Konva: KonvaNamespace,
  config: RepairOverlayStageConfig,
  layer: RepairKonvaContainer
): void {
  if (!config.visibleLayers.knowledge) return;
  const { width, height } = getStageSize(config.container);
  const frame = getContainedImageFrame(width, height, config.image.widthPx, config.image.heightPx);
  config.knowledgeRegions.forEach((entry) => {
    const rect = imageRectToStageRect(entry.region, frame, config.workbench.viewport);
    const shape = new Konva.Rect({
      x: rect.xPx,
      y: rect.yPx,
      width: rect.widthPx,
      height: rect.heightPx,
      stroke: "rgba(111, 191, 154, 0.72)",
      strokeWidth: 1,
      dash: [4, 6],
      fill: "rgba(111, 191, 154, 0.08)",
      cornerRadius: 5,
      listening: false,
    });
    layer.add(shape);
    addLabel(Konva, layer, rect.xPx, Math.max(0, rect.yPx - 20), entry.label, "rgb(111, 191, 154)");
  });
}

function addFocusCallout(
  Konva: KonvaNamespace,
  config: RepairOverlayStageConfig,
  layer: RepairKonvaContainer
): void {
  if (!config.visibleLayers.focus || config.focusedEventId === null) return;
  const focused = config.events.find((event) => event.id === config.focusedEventId);
  if (focused === undefined) return;

  const sourceRect =
    (focused.kind === "ai-mark" || focused.kind === "risk-flag") && focused.region !== null
      ? focused.region
      : focused.kind === "annotation"
        ? focused.region
        : null;
  if (sourceRect === null) return;

  const { width, height } = getStageSize(config.container);
  const frame = getContainedImageFrame(width, height, config.image.widthPx, config.image.heightPx);
  const rect = imageRectToStageRect(sourceRect, frame, config.workbench.viewport);
  addLabel(
    Konva,
    layer,
    Math.min(width - 190, rect.xPx + rect.widthPx + 12),
    Math.max(12, rect.yPx),
    "AI SUGGESTION: Focus here",
    REPAIR_UI_COLORS.amber
  );
}

export async function mountRepairOverlayStage(
  config: RepairOverlayStageConfig
): Promise<RepairOverlayController | null> {
  if (
    config.container.dataset["mounted"] === "true" ||
    config.container.dataset["mounting"] === "true"
  ) {
    return null;
  }
  config.container.dataset["mounting"] = "true";

  try {
    const Konva = await loadKonvaNamespace(config.container.ownerDocument);
    type RepairLayer = InstanceType<KonvaNamespace["Layer"]>;
    type RepairStage = InstanceType<KonvaNamespace["Stage"]>;
    let currentConfig = config;
    let stage: RepairStage | null = null;
    let layers: {
      grid: RepairLayer;
      ai: RepairLayer;
      annotation: RepairLayer;
      measurement: RepairLayer;
      focus: RepairLayer;
    } | null = null;
    const entityGroups = new Map<
      string,
      {
        group: InstanceType<KonvaNamespace["Group"]>;
        fingerprint: string;
        layerKey: "ai" | "annotation" | "measurement";
      }
    >();
    let panStart: { pointerX: number; pointerY: number; panXPx: number; panYPx: number } | null =
      null;
    let disposed = false;

    function getRenderableSize(): { width: number; height: number } | null {
      const rect = currentConfig.container.getBoundingClientRect();
      const width = Math.round(rect.width || currentConfig.container.clientWidth || 0);
      const height = Math.round(rect.height || currentConfig.container.clientHeight || 0);
      if (width <= 0 || height <= 0) return null;
      return { width, height };
    }

    function getActiveStageSize(): { width: number; height: number } {
      if (stage !== null) {
        return { width: stage.width(), height: stage.height() };
      }
      return getStageSize(currentConfig.container);
    }

    function clearContainer(container: RepairKonvaContainer): void {
      container.getChildren().forEach((child) => {
        child.destroy();
      });
    }

    function getEventEntityFingerprint(
      layerKey: "ai" | "annotation" | "measurement",
      event: RepairEvent
    ): string {
      return JSON.stringify({
        layerKey,
        event,
        focusedEventId: currentConfig.focusedEventId,
        selection: currentConfig.workbench.selection,
        contextualCursor: currentConfig.workbench.contextualCursor,
        visibleLayers: currentConfig.visibleLayers,
      });
    }

    function syncEntityLayerTransforms(): void {
      if (layers === null || stage === null) return;
      const { width, height } = getActiveStageSize();
      const frame = getContainedImageFrame(
        width,
        height,
        currentConfig.image.widthPx,
        currentConfig.image.heightPx
      );
      const scale = frame.scale * currentConfig.workbench.viewport.zoom;
      const transform = {
        x: frame.leftPx + currentConfig.workbench.viewport.panXPx,
        y: frame.topPx + currentConfig.workbench.viewport.panYPx,
      };
      [layers.ai, layers.annotation, layers.measurement].forEach((layer) => {
        layer.position(transform);
        layer.scale({ x: scale, y: scale });
      });
    }

    function syncEventEntity(
      layerKey: "ai" | "annotation" | "measurement",
      layer: RepairLayer,
      event: RepairEvent,
      draw: (group: InstanceType<KonvaNamespace["Group"]>) => void
    ): void {
      const key = `${layerKey}:${event.id}`;
      const fingerprint = getEventEntityFingerprint(layerKey, event);
      let record = entityGroups.get(key) ?? null;
      if (record !== null && record.layerKey !== layerKey) {
        record.group.destroy();
        entityGroups.delete(key);
        record = null;
      }
      if (record === null) {
        const group = new Konva.Group({ listening: true });
        layer.add(group);
        record = { group, fingerprint: "", layerKey };
        entityGroups.set(key, record);
      }
      if (record.fingerprint === fingerprint) return;
      clearContainer(record.group);
      draw(record.group);
      record.fingerprint = fingerprint;
    }

    function pruneEventEntities(activeKeys: Set<string>): void {
      entityGroups.forEach((record, key) => {
        if (activeKeys.has(key)) return;
        record.group.destroy();
        entityGroups.delete(key);
      });
    }

    function renderOverlay(): void {
      if (stage === null || layers === null || disposed) return;
      const activeStage = stage;
      const activeLayers = layers;
      const activeEntityKeys = new Set<string>();
      clearContainer(activeLayers.grid);
      clearContainer(activeLayers.focus);
      syncEntityLayerTransforms();

      addGridLayer(Konva, currentConfig, activeLayers.grid);
      addKnowledgeRegions(Konva, currentConfig, activeLayers.focus);
      currentConfig.events.forEach((event) => {
        if (event.kind === "ai-mark" || event.kind === "risk-flag") {
          activeEntityKeys.add(`ai:${event.id}`);
          syncEventEntity("ai", activeLayers.ai, event, (group) => {
            addAiEvent(Konva, currentConfig, group, event);
          });
        }
        if (event.kind === "annotation") {
          activeEntityKeys.add(`annotation:${event.id}`);
          syncEventEntity("annotation", activeLayers.annotation, event, (group) => {
            addAnnotationEvent(Konva, currentConfig, group, event);
          });
        }
        if (event.kind === "measurement") {
          activeEntityKeys.add(`measurement:${event.id}`);
          syncEventEntity("measurement", activeLayers.measurement, event, (group) => {
            addMeasurementEvent(Konva, currentConfig, group, event);
          });
        }
      });
      pruneEventEntities(activeEntityKeys);
      addFocusCallout(Konva, currentConfig, activeLayers.focus);

      activeLayers.grid.batchDraw();
      activeLayers.ai.batchDraw();
      activeLayers.annotation.batchDraw();
      activeLayers.measurement.batchDraw();
      activeLayers.focus.batchDraw();
      activeStage.batchDraw();
    }

    function syncStageCursor(): void {
      if (stage === null) return;
      const cursor =
        currentConfig.workbench.contextualCursor === "pan"
          ? "grab"
          : currentConfig.workbench.contextualCursor === "measurement"
            ? "crosshair"
            : currentConfig.workbench.contextualCursor === "annotate"
              ? "cell"
              : currentConfig.workbench.contextualCursor === "replay-scrub-lock"
                ? "not-allowed"
                : "default";
      stage.container().style.cursor = cursor;
    }

    function isReplayInteractionLocked(): boolean {
      return currentConfig.workbench.contextualCursor === "replay-scrub-lock";
    }

    function bindStageEvents(activeStage: RepairStage): void {
      activeStage.on("mousemove tap", () => {
        const pointer = activeStage.getPointerPosition();
        if (pointer === null) return;
        const { width, height } = getActiveStageSize();
        const frame = getContainedImageFrame(
          width,
          height,
          currentConfig.image.widthPx,
          currentConfig.image.heightPx
        );
        const point = clampImagePoint(
          stagePointToImagePoint(
            { xPx: pointer.x, yPx: pointer.y },
            frame,
            currentConfig.workbench.viewport
          ),
          currentConfig.image.widthPx,
          currentConfig.image.heightPx
        );
        currentConfig.onCursor({ xPx: Math.round(point.xPx), yPx: Math.round(point.yPx) });
      });

      activeStage.on("wheel", (event) => {
        event.evt.preventDefault();
        if (isReplayInteractionLocked()) return;
        const delta = event.evt.deltaY > 0 ? -0.12 : 0.12;
        currentConfig.onViewportChange({
          zoom: Math.min(4, Math.max(0.5, currentConfig.workbench.viewport.zoom + delta)),
          panXPx: currentConfig.workbench.viewport.panXPx,
          panYPx: currentConfig.workbench.viewport.panYPx,
        });
      });

      activeStage.on("mousedown touchstart", () => {
        if (isReplayInteractionLocked()) return;
        if (currentConfig.workbench.activeTool !== "pan") return;
        const pointer = activeStage.getPointerPosition();
        if (pointer === null) return;
        panStart = {
          pointerX: pointer.x,
          pointerY: pointer.y,
          panXPx: currentConfig.workbench.viewport.panXPx,
          panYPx: currentConfig.workbench.viewport.panYPx,
        };
      });

      activeStage.on("mouseup touchend", () => {
        panStart = null;
      });

      activeStage.on("dragmove mousemove touchmove", () => {
        if (isReplayInteractionLocked()) return;
        if (panStart === null) return;
        const pointer = activeStage.getPointerPosition();
        if (pointer === null) return;
        currentConfig.onViewportChange({
          zoom: currentConfig.workbench.viewport.zoom,
          panXPx: panStart.panXPx + pointer.x - panStart.pointerX,
          panYPx: panStart.panYPx + pointer.y - panStart.pointerY,
        });
      });

      activeStage.on("click tap", (event) => {
        if (event.target !== activeStage) return;
        if (isReplayInteractionLocked()) return;
        const pointer = activeStage.getPointerPosition();
        if (pointer === null) return;
        const { width, height } = getActiveStageSize();
        const frame = getContainedImageFrame(
          width,
          height,
          currentConfig.image.widthPx,
          currentConfig.image.heightPx
        );
        const point = clampImagePoint(
          stagePointToImagePoint(
            { xPx: pointer.x, yPx: pointer.y },
            frame,
            currentConfig.workbench.viewport
          ),
          currentConfig.image.widthPx,
          currentConfig.image.heightPx
        );
        const xPx = Math.round(point.xPx);
        const yPx = Math.round(point.yPx);
        if (currentConfig.workbench.activeTool === "measurement-pin") {
          currentConfig.onAddMeasurement({ xPx, yPx, reference: `TP@${xPx},${yPx}` });
          return;
        }
        if (currentConfig.workbench.activeTool === "select") {
          currentConfig.onSelectionClear();
          return;
        }
        if (currentConfig.workbench.activeTool === "ruler") {
          const widthPx = Math.round(currentConfig.image.pixelsPerMm * 10);
          currentConfig.onAddAnnotation({
            tool: "arrow",
            xPx,
            yPx,
            widthPx,
            heightPx: 0,
            label: "Ruler 10.0 mm",
          });
          return;
        }
        if (isRepairOverlayDrawTool(currentConfig.workbench.activeTool)) {
          currentConfig.onAddAnnotation({
            tool: currentConfig.workbench.activeTool,
            xPx,
            yPx,
            widthPx: 120,
            heightPx: 80,
          });
        }
      });
    }

    function ensureStage(): boolean {
      if (stage !== null) return true;
      const size = getRenderableSize();
      if (size === null) {
        currentConfig.container.dataset["mountDeferred"] = "true";
        delete currentConfig.container.dataset["mounting"];
        return false;
      }

      stage = new Konva.Stage({
        container: currentConfig.container as HTMLDivElement,
        width: size.width,
        height: size.height,
      });
      layers = {
        grid: new Konva.Layer(),
        ai: new Konva.Layer(),
        annotation: new Konva.Layer(),
        measurement: new Konva.Layer(),
        focus: new Konva.Layer(),
      };
      layers.grid.listening(false);
      layers.focus.listening(false);

      stage.add(layers.grid);
      stage.add(layers.ai);
      stage.add(layers.annotation);
      stage.add(layers.measurement);
      stage.add(layers.focus);
      bindStageEvents(stage);

      delete currentConfig.container.dataset["mounting"];
      delete currentConfig.container.dataset["mountDeferred"];
      currentConfig.container.dataset["mounted"] = "true";
      return true;
    }

    function resize(): void {
      if (disposed) return;
      if (ensureStage() === false || stage === null) return;
      const size = getRenderableSize();
      if (size === null) {
        currentConfig.container.dataset["mountDeferred"] = "true";
        return;
      }
      if (stage.width() !== size.width || stage.height() !== size.height) {
        stage.size(size);
      }
      syncStageCursor();
      renderOverlay();
    }

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            resize();
          });
    resizeObserver?.observe(currentConfig.container);
    resize();

    return {
      update: (nextConfig) => {
        currentConfig = nextConfig;
        resize();
      },
      resize,
      destroy: () => {
        disposed = true;
        resizeObserver?.disconnect();
        stage?.destroy();
        delete currentConfig.container.dataset["mounted"];
        delete currentConfig.container.dataset["mounting"];
        delete currentConfig.container.dataset["mountDeferred"];
      },
    };
  } catch (error) {
    delete config.container.dataset["mounted"];
    delete config.container.dataset["mounting"];
    delete config.container.dataset["mountDeferred"];
    throw error;
  }
}

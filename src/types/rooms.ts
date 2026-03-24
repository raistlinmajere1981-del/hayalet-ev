export const ROOM_SCHEMA_VERSION = 2 as const;

export type RoomCommandScope = "room-ui" | "ai-slots" | "assistant" | "us1" | "system";

const LEGACY_ASSISTANT_SCOPE = "ai0";

export const ROOM_SCENE_CHARACTER_KINDS = ["ai", "assistant", "us1", "user"] as const;
export const ROOM_SCENE_CHARACTER_SLOTS = ["ai0", "ai1", "ai2", "us1"] as const;
export const ROOM_SCENE_CHARACTER_ROSTER_PRESETS = [
  "all-characters",
  "connected-plus-user",
  "assistant-only",
  "user-only",
] as const;
export const ROOM_SCENE_WINDOW_CONTROLS_VISIBILITIES = [
  "scene-only",
  "all-pages",
  "hidden",
] as const;
export const ROOM_SCENE_VIEW_BACK_BUTTON_VARIANTS = [
  "scene-back-layer",
  "standard-button",
] as const;
export const ROOM_SCENE_PAGE_SHELL_VARIANTS = ["standard", "immersive-stage"] as const;

export type RoomSceneCharacterKind = (typeof ROOM_SCENE_CHARACTER_KINDS)[number];
export type RoomSceneCharacterSlot = (typeof ROOM_SCENE_CHARACTER_SLOTS)[number];
export type RoomSceneCharacterRosterPreset = (typeof ROOM_SCENE_CHARACTER_ROSTER_PRESETS)[number];
export type RoomSceneWindowControlsVisibility =
  (typeof ROOM_SCENE_WINDOW_CONTROLS_VISIBILITIES)[number];
export type RoomSceneViewBackButtonVariant = (typeof ROOM_SCENE_VIEW_BACK_BUTTON_VARIANTS)[number];
export type RoomScenePageShellVariant = (typeof ROOM_SCENE_PAGE_SHELL_VARIANTS)[number];

export interface RoomMenuConfig {
  label: string;
  icon?: string;
  order?: number;
}

export interface RoomRuntimeConfig {
  uiEntry: string;
  hostEntry: string;
}

export interface RoomCommandSpec {
  name: string;
  description?: string;
  scope?: RoomCommandScope;
}

export interface RoomProtocolSpec {
  key: string;
  room: string;
  scenario: string;
  title: string;
  editable?: boolean;
}

export interface RoomSceneRect {
  leftPx: number;
  topPx: number;
  widthPx: number;
  heightPx: number;
}

export interface RoomSceneTextConfig {
  text?: string;
  textKey?: string;
}

export interface RoomSceneHotspotConfig {
  id: string;
  rect: RoomSceneRect;
  label?: RoomSceneTextConfig;
}

export interface RoomSceneTransparentWindowConfig {
  leftPct: number;
  topPct: number;
  widthPct: number;
  heightPct: number;
}

export interface RoomSceneCharacterConfig {
  id: string;
  characterKind: RoomSceneCharacterKind;
  preferredSlot?: RoomSceneCharacterSlot;
  leftPx: number;
  bottomPx: number;
  scale: number;
  depth: number;
}

export interface RoomSceneChromeConfig {
  windowControlsVisibility?: RoomSceneWindowControlsVisibility;
  viewBackButtonVariant?: RoomSceneViewBackButtonVariant;
  pageShellVariant?: RoomScenePageShellVariant;
}

export interface RoomFeatureSceneViewConfig {
  id: string;
  backgroundSrc: string;
  panelArtSrc?: string;
  transparentWindow?: RoomSceneTransparentWindowConfig;
}

export interface RoomFeatureSceneConfig {
  hotspot: RoomSceneHotspotConfig;
  view: RoomFeatureSceneViewConfig;
}

export interface RoomSceneConfig {
  referenceSize: {
    width: number;
    height: number;
  };
  roomBackgroundSrc: string;
  roomsHotspot: RoomSceneHotspotConfig;
  backHotspot: RoomSceneHotspotConfig;
  characterRosterPreset?: RoomSceneCharacterRosterPreset;
  characters?: RoomSceneCharacterConfig[];
  chrome?: RoomSceneChromeConfig;
}

export interface RoomI18nConfig {
  baseDir: string;
}

export interface RoomFeatureManifest {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  commandSpecs?: RoomCommandSpec[];
  protocolSpecs?: RoomProtocolSpec[];
  scene?: RoomFeatureSceneConfig;
}

export interface RoomManifest {
  schemaVersion: typeof ROOM_SCHEMA_VERSION;
  id: string;
  name: string;
  version: string;
  description?: string;
  menu: RoomMenuConfig;
  runtime: RoomRuntimeConfig;
  defaultFeatureId: string;
  features: RoomFeatureManifest[];
  scene?: RoomSceneConfig;
  i18n?: RoomI18nConfig;
  storageNamespace?: string;
  engineRange?: string;
  permissions?: string[];
  commandSpecs?: RoomCommandSpec[];
  protocolSpecs?: RoomProtocolSpec[];
}

export interface RoomBundleFile {
  encoding: "base64";
  content: string;
}

export interface RoomBundle {
  schemaVersion: typeof ROOM_SCHEMA_VERSION;
  manifest: RoomManifest;
  files: Record<string, RoomBundleFile>;
  exportedAt: string;
}

export interface RoomManifestValidationResult {
  valid: boolean;
  errors: string[];
  manifest?: RoomManifest;
}

export interface RoomWorkspaceEntry {
  dirName: string;
  dirPath: string;
  valid: boolean;
  errors: string[];
  manifest?: RoomManifest;
  sourceKind?: "workspace" | "bundle";
  readOnly?: boolean;
}

export interface InstalledRoomFeatureSceneViewRecord {
  id: string;
  backgroundPath: string;
  panelArtPath?: string;
  transparentWindow?: RoomSceneTransparentWindowConfig;
}

export interface InstalledRoomFeatureSceneRecord {
  hotspot: RoomSceneHotspotConfig;
  view: InstalledRoomFeatureSceneViewRecord;
}

export interface InstalledRoomFeatureRecord {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  commandSpecs?: RoomCommandSpec[];
  protocolSpecs?: RoomProtocolSpec[];
  scene?: InstalledRoomFeatureSceneRecord;
}

export interface InstalledRoomSceneRecord {
  referenceSize: {
    width: number;
    height: number;
  };
  roomBackgroundPath: string;
  roomsHotspot: RoomSceneHotspotConfig;
  backHotspot: RoomSceneHotspotConfig;
  characterRosterPreset?: RoomSceneCharacterRosterPreset;
  characters?: RoomSceneCharacterConfig[];
  chrome?: RoomSceneChromeConfig;
}

export interface InstalledRoomRecord {
  id: string;
  name: string;
  version: string;
  description?: string;
  icon?: string;
  sourceDir: string;
  installedDir: string;
  manifestPath: string;
  runtimeEntryPath: string;
  hostEntryPath: string;
  defaultFeatureId: string;
  features: InstalledRoomFeatureRecord[];
  scene?: InstalledRoomSceneRecord;
  i18nBaseDir?: string;
  commandSpecs?: RoomCommandSpec[];
  protocolSpecs?: RoomProtocolSpec[];
  installedAt: string;
  updatedAt: string;
}

export interface RoomRegistryState {
  version: typeof ROOM_SCHEMA_VERSION;
  updatedAt: string;
  rooms: InstalledRoomRecord[];
}

export interface StartupRoomProtocolSnapshot {
  roomId: string;
  key: string;
  body: string;
}

export interface StartupRoomsSnapshot {
  rooms: InstalledRoomRecord[];
  protocols: StartupRoomProtocolSnapshot[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && Array.isArray(value) === false;
}

function readOptionalString(
  record: Record<string, unknown>,
  key: string,
  errors: string[]
): string | undefined {
  const value = record[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    errors.push(`${key} must be a string`);
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed === "") {
    errors.push(`${key} cannot be empty`);
    return undefined;
  }
  return trimmed;
}

function readRequiredString(
  record: Record<string, unknown>,
  key: string,
  errors: string[]
): string | undefined {
  const value = readOptionalString(record, key, errors);
  if (value === undefined) {
    errors.push(`${key} is required`);
  }
  return value;
}

function readFiniteNumber(
  record: Record<string, unknown>,
  key: string,
  errors: string[]
): number | undefined {
  const value = record[key];
  if (typeof value !== "number" || Number.isFinite(value) === false) {
    errors.push(`${key} must be a finite number`);
    return undefined;
  }
  return value;
}

function readPositiveNumber(
  record: Record<string, unknown>,
  key: string,
  errors: string[]
): number | undefined {
  const value = readFiniteNumber(record, key, errors);
  if (value !== undefined && value <= 0) {
    errors.push(`${key} must be greater than 0`);
    return undefined;
  }
  return value;
}

function hasDuplicateValues(values: string[]): boolean {
  return new Set(values).size !== values.length;
}

export function isValidRoomId(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

export function isValidRoomFeatureId(value: string): boolean {
  return isValidRoomId(value);
}

export function isValidRoomCommandName(value: string): boolean {
  return /^[A-Za-z0-9_]+$/.test(value);
}

export function normalizeRoomRelativePath(value: string): string | null {
  const trimmed = value.replace(/\\/g, "/").trim();
  if (trimmed === "") {
    return null;
  }
  if (trimmed.startsWith("/") || trimmed.startsWith("../") || trimmed.includes("/../")) {
    return null;
  }
  const parts = trimmed.split("/");
  if (parts.some((part) => part === "" || part === "." || part === "..")) {
    return null;
  }
  return parts.join("/");
}

function isRoomSceneCharacterKind(value: string): value is RoomSceneCharacterKind {
  return ROOM_SCENE_CHARACTER_KINDS.includes(value as RoomSceneCharacterKind);
}

function isRoomSceneCharacterSlot(value: string): value is RoomSceneCharacterSlot {
  return ROOM_SCENE_CHARACTER_SLOTS.includes(value as RoomSceneCharacterSlot);
}

function isRoomSceneCharacterRosterPreset(value: string): value is RoomSceneCharacterRosterPreset {
  return ROOM_SCENE_CHARACTER_ROSTER_PRESETS.includes(value as RoomSceneCharacterRosterPreset);
}

function isRoomSceneWindowControlsVisibility(
  value: string
): value is RoomSceneWindowControlsVisibility {
  return ROOM_SCENE_WINDOW_CONTROLS_VISIBILITIES.includes(
    value as RoomSceneWindowControlsVisibility
  );
}

function isRoomSceneViewBackButtonVariant(value: string): value is RoomSceneViewBackButtonVariant {
  return ROOM_SCENE_VIEW_BACK_BUTTON_VARIANTS.includes(value as RoomSceneViewBackButtonVariant);
}

function isRoomScenePageShellVariant(value: string): value is RoomScenePageShellVariant {
  return ROOM_SCENE_PAGE_SHELL_VARIANTS.includes(value as RoomScenePageShellVariant);
}

function readMenuConfig(
  record: Record<string, unknown>,
  errors: string[]
): RoomMenuConfig | undefined {
  const menuRaw = record["menu"];
  if (!isRecord(menuRaw)) {
    errors.push("menu is required");
    return undefined;
  }

  const label = readRequiredString(menuRaw, "label", errors);
  const icon = readOptionalString(menuRaw, "icon", errors);
  const orderRaw = menuRaw["order"];
  let order: number | undefined;
  if (orderRaw !== undefined) {
    if (typeof orderRaw !== "number" || Number.isFinite(orderRaw) === false) {
      errors.push("menu.order must be a number");
    } else {
      order = orderRaw;
    }
  }

  if (label === undefined) {
    return undefined;
  }

  return {
    label,
    ...(icon !== undefined ? { icon } : {}),
    ...(order !== undefined ? { order } : {}),
  };
}

function readRuntimeConfig(
  record: Record<string, unknown>,
  errors: string[]
): RoomRuntimeConfig | undefined {
  const runtimeRaw = record["runtime"];
  if (!isRecord(runtimeRaw)) {
    errors.push("runtime is required");
    return undefined;
  }

  const uiEntryRaw = readRequiredString(runtimeRaw, "uiEntry", errors);
  const hostEntryRaw = readRequiredString(runtimeRaw, "hostEntry", errors);
  const uiEntry = uiEntryRaw !== undefined ? normalizeRoomRelativePath(uiEntryRaw) : null;
  const hostEntry = hostEntryRaw !== undefined ? normalizeRoomRelativePath(hostEntryRaw) : null;
  if (uiEntryRaw !== undefined && uiEntry === null) {
    errors.push("runtime.uiEntry must be a safe relative path");
  }
  if (hostEntryRaw !== undefined && hostEntry === null) {
    errors.push("runtime.hostEntry must be a safe relative path");
  }

  if (uiEntry === null || hostEntry === null) {
    return undefined;
  }

  return {
    uiEntry,
    hostEntry,
  };
}

function readCommandSpecs(
  rawValue: unknown,
  path: string,
  errors: string[]
): RoomCommandSpec[] | undefined {
  if (rawValue === undefined) {
    return undefined;
  }

  if (!Array.isArray(rawValue)) {
    errors.push(`${path} must be an array`);
    return undefined;
  }

  const parsed: RoomCommandSpec[] = [];
  rawValue.forEach((item, index) => {
    if (!isRecord(item)) {
      errors.push(`${path}[${String(index)}] must be an object`);
      return;
    }
    const commandName = readRequiredString(item, "name", errors);
    if (commandName !== undefined && isValidRoomCommandName(commandName) === false) {
      errors.push(`${path}[${String(index)}].name must match /^[A-Za-z0-9_]+$/`);
    }
    const descriptionValue = readOptionalString(item, "description", errors);
    const scopeRaw = item["scope"];
    let scope: RoomCommandScope | undefined;
    if (scopeRaw !== undefined) {
      if (typeof scopeRaw !== "string") {
        errors.push(`${path}[${String(index)}].scope is invalid`);
      } else if (
        scopeRaw !== "room-ui" &&
        scopeRaw !== "ai-slots" &&
        scopeRaw !== "assistant" &&
        scopeRaw !== "us1" &&
        scopeRaw !== "system" &&
        scopeRaw !== LEGACY_ASSISTANT_SCOPE
      ) {
        errors.push(`${path}[${String(index)}].scope is invalid`);
      } else {
        scope = scopeRaw === LEGACY_ASSISTANT_SCOPE ? "assistant" : (scopeRaw as RoomCommandScope);
      }
    }
    if (commandName !== undefined) {
      parsed.push({
        name: commandName,
        ...(descriptionValue !== undefined ? { description: descriptionValue } : {}),
        ...(scope !== undefined ? { scope } : {}),
      });
    }
  });

  if (hasDuplicateValues(parsed.map((item) => item.name))) {
    errors.push(`${path} names must be unique`);
  }

  return parsed;
}

function readProtocolSpecs(
  rawValue: unknown,
  path: string,
  errors: string[]
): RoomProtocolSpec[] | undefined {
  if (rawValue === undefined) {
    return undefined;
  }

  if (!Array.isArray(rawValue)) {
    errors.push(`${path} must be an array`);
    return undefined;
  }

  const parsed: RoomProtocolSpec[] = [];
  rawValue.forEach((item, index) => {
    if (!isRecord(item)) {
      errors.push(`${path}[${String(index)}] must be an object`);
      return;
    }
    const key = readRequiredString(item, "key", errors);
    const room = readRequiredString(item, "room", errors);
    const scenario = readRequiredString(item, "scenario", errors);
    const title = readRequiredString(item, "title", errors);
    const editableRaw = item["editable"];
    let editable: boolean | undefined;
    if (editableRaw !== undefined) {
      if (typeof editableRaw !== "boolean") {
        errors.push(`${path}[${String(index)}].editable must be boolean`);
      } else {
        editable = editableRaw;
      }
    }
    if (key !== undefined && room !== undefined && scenario !== undefined && title !== undefined) {
      parsed.push({
        key,
        room,
        scenario,
        title,
        ...(editable !== undefined ? { editable } : {}),
      });
    }
  });

  if (hasDuplicateValues(parsed.map((item) => item.key))) {
    errors.push(`${path} keys must be unique`);
  }

  return parsed;
}

function readSceneRect(
  rawValue: unknown,
  path: string,
  errors: string[]
): RoomSceneRect | undefined {
  if (!isRecord(rawValue)) {
    errors.push(`${path} must be an object`);
    return undefined;
  }

  const leftPx = readFiniteNumber(rawValue, "leftPx", errors);
  const topPx = readFiniteNumber(rawValue, "topPx", errors);
  const widthPx = readPositiveNumber(rawValue, "widthPx", errors);
  const heightPx = readPositiveNumber(rawValue, "heightPx", errors);

  if (
    leftPx === undefined ||
    topPx === undefined ||
    widthPx === undefined ||
    heightPx === undefined
  ) {
    return undefined;
  }

  return {
    leftPx,
    topPx,
    widthPx,
    heightPx,
  };
}

function readSceneTextConfig(
  rawValue: unknown,
  path: string,
  errors: string[]
): RoomSceneTextConfig | undefined {
  if (rawValue === undefined) {
    return undefined;
  }

  if (!isRecord(rawValue)) {
    errors.push(`${path} must be an object`);
    return undefined;
  }

  const text = readOptionalString(rawValue, "text", errors);
  const textKey = readOptionalString(rawValue, "textKey", errors);
  if (text === undefined && textKey === undefined) {
    errors.push(`${path} requires text or textKey`);
    return undefined;
  }

  return {
    ...(text !== undefined ? { text } : {}),
    ...(textKey !== undefined ? { textKey } : {}),
  };
}

function readSceneHotspotConfig(
  rawValue: unknown,
  path: string,
  fallbackId: string,
  errors: string[]
): RoomSceneHotspotConfig | undefined {
  if (!isRecord(rawValue)) {
    errors.push(`${path} must be an object`);
    return undefined;
  }

  const id = readOptionalString(rawValue, "id", errors) ?? fallbackId;
  const rect = readSceneRect(rawValue["rect"], `${path}.rect`, errors);
  const label = readSceneTextConfig(rawValue["label"], `${path}.label`, errors);
  if (rect === undefined) {
    return undefined;
  }

  return {
    id,
    rect,
    ...(label !== undefined ? { label } : {}),
  };
}

function readTransparentWindowConfig(
  rawValue: unknown,
  path: string,
  errors: string[]
): RoomSceneTransparentWindowConfig | undefined {
  if (rawValue === undefined) {
    return undefined;
  }

  if (!isRecord(rawValue)) {
    errors.push(`${path} must be an object`);
    return undefined;
  }

  const leftPct = readPositiveNumber(rawValue, "leftPct", errors);
  const topPct = readPositiveNumber(rawValue, "topPct", errors);
  const widthPct = readPositiveNumber(rawValue, "widthPct", errors);
  const heightPct = readPositiveNumber(rawValue, "heightPct", errors);

  if (
    leftPct === undefined ||
    topPct === undefined ||
    widthPct === undefined ||
    heightPct === undefined
  ) {
    return undefined;
  }

  return {
    leftPct,
    topPct,
    widthPct,
    heightPct,
  };
}

function readSceneCharacterConfig(
  rawValue: unknown,
  path: string,
  errors: string[]
): RoomSceneCharacterConfig | undefined {
  if (!isRecord(rawValue)) {
    errors.push(`${path} must be an object`);
    return undefined;
  }

  const id = readRequiredString(rawValue, "id", errors);
  const characterKindRaw = readRequiredString(rawValue, "characterKind", errors);
  const preferredSlotRaw = readOptionalString(rawValue, "preferredSlot", errors);
  const leftPx = readFiniteNumber(rawValue, "leftPx", errors);
  const bottomPx = readFiniteNumber(rawValue, "bottomPx", errors);
  const scale = readPositiveNumber(rawValue, "scale", errors);
  const depth = readFiniteNumber(rawValue, "depth", errors);

  let characterKind: RoomSceneCharacterKind | undefined;
  if (characterKindRaw !== undefined) {
    if (isRoomSceneCharacterKind(characterKindRaw) === false) {
      errors.push(`${path}.characterKind is invalid`);
    } else {
      characterKind = characterKindRaw;
    }
  }

  let preferredSlot: RoomSceneCharacterSlot | undefined;
  if (preferredSlotRaw !== undefined) {
    if (isRoomSceneCharacterSlot(preferredSlotRaw) === false) {
      errors.push(`${path}.preferredSlot is invalid`);
    } else {
      preferredSlot = preferredSlotRaw;
    }
  }

  if (
    id === undefined ||
    characterKind === undefined ||
    leftPx === undefined ||
    bottomPx === undefined ||
    scale === undefined ||
    depth === undefined
  ) {
    return undefined;
  }

  return {
    id,
    characterKind,
    ...(preferredSlot !== undefined ? { preferredSlot } : {}),
    leftPx,
    bottomPx,
    scale,
    depth,
  };
}

function readSceneCharacters(
  rawValue: unknown,
  path: string,
  errors: string[]
): RoomSceneCharacterConfig[] | undefined {
  if (rawValue === undefined) {
    return undefined;
  }

  if (!Array.isArray(rawValue)) {
    errors.push(`${path} must be an array`);
    return undefined;
  }

  const parsed = rawValue
    .map((item, index) => readSceneCharacterConfig(item, `${path}[${String(index)}]`, errors))
    .filter((character): character is RoomSceneCharacterConfig => character !== undefined);

  if (hasDuplicateValues(parsed.map((character) => character.id))) {
    errors.push(`${path} ids must be unique`);
  }

  return parsed;
}

function readSceneChromeConfig(
  rawValue: unknown,
  path: string,
  errors: string[]
): RoomSceneChromeConfig | undefined {
  if (rawValue === undefined) {
    return undefined;
  }

  if (!isRecord(rawValue)) {
    errors.push(`${path} must be an object`);
    return undefined;
  }

  const windowControlsVisibilityRaw = readOptionalString(
    rawValue,
    "windowControlsVisibility",
    errors
  );
  const viewBackButtonVariantRaw = readOptionalString(rawValue, "viewBackButtonVariant", errors);
  const pageShellVariantRaw = readOptionalString(rawValue, "pageShellVariant", errors);

  let windowControlsVisibility: RoomSceneWindowControlsVisibility | undefined;
  if (windowControlsVisibilityRaw !== undefined) {
    if (isRoomSceneWindowControlsVisibility(windowControlsVisibilityRaw) === false) {
      errors.push(`${path}.windowControlsVisibility is invalid`);
    } else {
      windowControlsVisibility = windowControlsVisibilityRaw;
    }
  }

  let viewBackButtonVariant: RoomSceneViewBackButtonVariant | undefined;
  if (viewBackButtonVariantRaw !== undefined) {
    if (isRoomSceneViewBackButtonVariant(viewBackButtonVariantRaw) === false) {
      errors.push(`${path}.viewBackButtonVariant is invalid`);
    } else {
      viewBackButtonVariant = viewBackButtonVariantRaw;
    }
  }

  let pageShellVariant: RoomScenePageShellVariant | undefined;
  if (pageShellVariantRaw !== undefined) {
    if (isRoomScenePageShellVariant(pageShellVariantRaw) === false) {
      errors.push(`${path}.pageShellVariant is invalid`);
    } else {
      pageShellVariant = pageShellVariantRaw;
    }
  }

  if (
    windowControlsVisibility === undefined &&
    viewBackButtonVariant === undefined &&
    pageShellVariant === undefined
  ) {
    return {};
  }

  return {
    ...(windowControlsVisibility !== undefined ? { windowControlsVisibility } : {}),
    ...(viewBackButtonVariant !== undefined ? { viewBackButtonVariant } : {}),
    ...(pageShellVariant !== undefined ? { pageShellVariant } : {}),
  };
}

function readFeatureSceneConfig(
  rawValue: unknown,
  featureId: string,
  errors: string[]
): RoomFeatureSceneConfig | undefined {
  if (rawValue === undefined) {
    return undefined;
  }

  if (!isRecord(rawValue)) {
    errors.push(`features.${featureId}.scene must be an object`);
    return undefined;
  }

  const hotspot = readSceneHotspotConfig(
    rawValue["hotspot"],
    `features.${featureId}.scene.hotspot`,
    `${featureId}-hotspot`,
    errors
  );

  const viewRaw = rawValue["view"];
  if (!isRecord(viewRaw)) {
    errors.push(`features.${featureId}.scene.view must be an object`);
    return undefined;
  }

  const viewId = readRequiredString(viewRaw, "id", errors);
  const backgroundSrcRaw = readRequiredString(viewRaw, "backgroundSrc", errors);
  const backgroundSrc =
    backgroundSrcRaw !== undefined ? normalizeRoomRelativePath(backgroundSrcRaw) : null;
  if (backgroundSrcRaw !== undefined && backgroundSrc === null) {
    errors.push(`features.${featureId}.scene.view.backgroundSrc must be a safe relative path`);
  }

  const panelArtSrcRaw = readOptionalString(viewRaw, "panelArtSrc", errors);
  const panelArtSrc =
    panelArtSrcRaw !== undefined ? normalizeRoomRelativePath(panelArtSrcRaw) : null;
  if (panelArtSrcRaw !== undefined && panelArtSrc === null) {
    errors.push(`features.${featureId}.scene.view.panelArtSrc must be a safe relative path`);
  }

  const transparentWindow = readTransparentWindowConfig(
    viewRaw["transparentWindow"],
    `features.${featureId}.scene.view.transparentWindow`,
    errors
  );

  if (hotspot === undefined || viewId === undefined || backgroundSrc === null) {
    return undefined;
  }

  return {
    hotspot,
    view: {
      id: viewId,
      backgroundSrc,
      ...(panelArtSrc !== null ? { panelArtSrc } : {}),
      ...(transparentWindow !== undefined ? { transparentWindow } : {}),
    },
  };
}

function readFeatureManifest(
  rawValue: unknown,
  index: number,
  errors: string[]
): RoomFeatureManifest | undefined {
  if (!isRecord(rawValue)) {
    errors.push(`features[${String(index)}] must be an object`);
    return undefined;
  }

  const id = readRequiredString(rawValue, "id", errors);
  if (id !== undefined && isValidRoomFeatureId(id) === false) {
    errors.push(`features[${String(index)}].id must match /^[a-z0-9]+(?:-[a-z0-9]+)*$/`);
  }
  const name = readRequiredString(rawValue, "name", errors);
  const description = readOptionalString(rawValue, "description", errors);
  const icon = readOptionalString(rawValue, "icon", errors);
  const commandSpecs = readCommandSpecs(
    rawValue["commandSpecs"],
    `features[${String(index)}].commandSpecs`,
    errors
  );
  const protocolSpecs = readProtocolSpecs(
    rawValue["protocolSpecs"],
    `features[${String(index)}].protocolSpecs`,
    errors
  );
  const scene = readFeatureSceneConfig(rawValue["scene"], id ?? `feature-${String(index)}`, errors);

  if (id === undefined || name === undefined) {
    return undefined;
  }

  return {
    id,
    name,
    ...(description !== undefined ? { description } : {}),
    ...(icon !== undefined ? { icon } : {}),
    ...(commandSpecs !== undefined ? { commandSpecs } : {}),
    ...(protocolSpecs !== undefined ? { protocolSpecs } : {}),
    ...(scene !== undefined ? { scene } : {}),
  };
}

function readSceneConfig(
  rawValue: unknown,
  features: RoomFeatureManifest[],
  errors: string[]
): RoomSceneConfig | undefined {
  if (rawValue === undefined) {
    return undefined;
  }

  if (!isRecord(rawValue)) {
    errors.push("scene must be an object");
    return undefined;
  }

  const referenceSizeRaw = rawValue["referenceSize"];
  if (!isRecord(referenceSizeRaw)) {
    errors.push("scene.referenceSize must be an object");
    return undefined;
  }

  const width = readPositiveNumber(referenceSizeRaw, "width", errors);
  const height = readPositiveNumber(referenceSizeRaw, "height", errors);
  const roomBackgroundSrcRaw = readRequiredString(rawValue, "roomBackgroundSrc", errors);
  const roomBackgroundSrc =
    roomBackgroundSrcRaw !== undefined ? normalizeRoomRelativePath(roomBackgroundSrcRaw) : null;
  if (roomBackgroundSrcRaw !== undefined && roomBackgroundSrc === null) {
    errors.push("scene.roomBackgroundSrc must be a safe relative path");
  }

  const roomsHotspot = readSceneHotspotConfig(
    rawValue["roomsHotspot"],
    "scene.roomsHotspot",
    "room-entry",
    errors
  );
  const backHotspot = readSceneHotspotConfig(
    rawValue["backHotspot"],
    "scene.backHotspot",
    "room-back",
    errors
  );
  const rosterPresetRaw = readOptionalString(rawValue, "characterRosterPreset", errors);
  const characters = readSceneCharacters(rawValue["characters"], "scene.characters", errors);
  const chrome = readSceneChromeConfig(rawValue["chrome"], "scene.chrome", errors);

  let characterRosterPreset: RoomSceneCharacterRosterPreset | undefined;
  if (rosterPresetRaw !== undefined) {
    if (isRoomSceneCharacterRosterPreset(rosterPresetRaw) === false) {
      errors.push("scene.characterRosterPreset is invalid");
    } else {
      characterRosterPreset = rosterPresetRaw;
    }
  }

  const missingFeatureScene = features
    .filter((feature) => feature.scene === undefined)
    .map((feature) => feature.id);
  if (missingFeatureScene.length > 0) {
    errors.push(`scene requires feature.scene for: ${missingFeatureScene.join(", ")}`);
  }

  if (
    width === undefined ||
    height === undefined ||
    roomBackgroundSrc === null ||
    roomsHotspot === undefined ||
    backHotspot === undefined
  ) {
    return undefined;
  }

  return {
    referenceSize: {
      width,
      height,
    },
    roomBackgroundSrc,
    roomsHotspot,
    backHotspot,
    ...(characterRosterPreset !== undefined ? { characterRosterPreset } : {}),
    ...(characters !== undefined ? { characters } : {}),
    ...(chrome !== undefined ? { chrome } : {}),
  };
}

function readI18nConfig(rawValue: unknown, errors: string[]): RoomI18nConfig | undefined {
  if (rawValue === undefined) {
    return undefined;
  }

  if (!isRecord(rawValue)) {
    errors.push("i18n must be an object");
    return undefined;
  }

  const baseDirRaw = readRequiredString(rawValue, "baseDir", errors);
  const baseDir = baseDirRaw !== undefined ? normalizeRoomRelativePath(baseDirRaw) : null;
  if (baseDirRaw !== undefined && baseDir === null) {
    errors.push("i18n.baseDir must be a safe relative path");
  }

  if (baseDir === null) {
    return undefined;
  }

  return { baseDir };
}

export function flattenRoomCommandSpecs(manifest: RoomManifest): RoomCommandSpec[] {
  return [
    ...(manifest.commandSpecs ?? []),
    ...manifest.features.flatMap((feature) => feature.commandSpecs ?? []),
  ];
}

export function flattenRoomProtocolSpecs(manifest: RoomManifest): RoomProtocolSpec[] {
  return [
    ...(manifest.protocolSpecs ?? []),
    ...manifest.features.flatMap((feature) => feature.protocolSpecs ?? []),
  ];
}

export function collectRoomManifestRequiredFilePaths(manifest: RoomManifest): string[] {
  const paths = new Set<string>();
  paths.add(manifest.runtime.uiEntry);
  paths.add(manifest.runtime.hostEntry);
  if (manifest.scene !== undefined) {
    paths.add(manifest.scene.roomBackgroundSrc);
  }
  manifest.features.forEach((feature) => {
    if (feature.scene === undefined) {
      return;
    }
    paths.add(feature.scene.view.backgroundSrc);
    if (feature.scene.view.panelArtSrc !== undefined) {
      paths.add(feature.scene.view.panelArtSrc);
    }
  });
  return Array.from(paths.values()).sort((left, right) => left.localeCompare(right));
}

export function validateRoomManifest(candidate: unknown): RoomManifestValidationResult {
  const errors: string[] = [];

  if (!isRecord(candidate)) {
    return {
      valid: false,
      errors: ["manifest must be an object"],
    };
  }

  const schemaVersion = candidate["schemaVersion"];
  if (schemaVersion !== ROOM_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${String(ROOM_SCHEMA_VERSION)}`);
  }

  const id = readRequiredString(candidate, "id", errors);
  if (id !== undefined && isValidRoomId(id) === false) {
    errors.push("id must match /^[a-z0-9]+(?:-[a-z0-9]+)*$/");
  }

  const name = readRequiredString(candidate, "name", errors);
  const version = readRequiredString(candidate, "version", errors);
  if (version !== undefined && /^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(version) === false) {
    errors.push("version must look like semver");
  }

  const description = readOptionalString(candidate, "description", errors);
  const menu = readMenuConfig(candidate, errors);
  const runtime = readRuntimeConfig(candidate, errors);
  const defaultFeatureId = readRequiredString(candidate, "defaultFeatureId", errors);
  const storageNamespace = readOptionalString(candidate, "storageNamespace", errors);
  const engineRange = readOptionalString(candidate, "engineRange", errors);
  const i18n = readI18nConfig(candidate["i18n"], errors);

  const permissionsRaw = candidate["permissions"];
  let permissions: string[] | undefined;
  if (permissionsRaw !== undefined) {
    if (!Array.isArray(permissionsRaw)) {
      errors.push("permissions must be an array of strings");
    } else {
      const parsed = permissionsRaw.filter((value): value is string => typeof value === "string");
      if (parsed.length !== permissionsRaw.length) {
        errors.push("permissions must contain only strings");
      } else {
        permissions = parsed.map((value) => value.trim()).filter((value) => value !== "");
      }
    }
  }

  const commandSpecs = readCommandSpecs(candidate["commandSpecs"], "commandSpecs", errors);
  const protocolSpecs = readProtocolSpecs(candidate["protocolSpecs"], "protocolSpecs", errors);

  const featuresRaw = candidate["features"];
  let features: RoomFeatureManifest[] | undefined;
  if (!Array.isArray(featuresRaw)) {
    errors.push("features must be an array");
  } else if (featuresRaw.length === 0) {
    errors.push("features must contain at least one item");
  } else {
    const parsed = featuresRaw
      .map((item, index) => readFeatureManifest(item, index, errors))
      .filter((feature): feature is RoomFeatureManifest => feature !== undefined);
    if (hasDuplicateValues(parsed.map((feature) => feature.id))) {
      errors.push("features ids must be unique");
    }
    features = parsed;
  }

  if (
    defaultFeatureId !== undefined &&
    features?.some((feature) => feature.id === defaultFeatureId) === false
  ) {
    errors.push("defaultFeatureId must match one of the feature ids");
  }

  const scene =
    features !== undefined ? readSceneConfig(candidate["scene"], features, errors) : undefined;

  if (features !== undefined) {
    const commandNames = [
      ...(commandSpecs ?? []).map((item) => item.name),
      ...features.flatMap((feature) => (feature.commandSpecs ?? []).map((item) => item.name)),
    ];
    if (hasDuplicateValues(commandNames)) {
      errors.push("commandSpecs names must be unique across room and features");
    }

    const protocolKeys = [
      ...(protocolSpecs ?? []).map((item) => item.key),
      ...features.flatMap((feature) => (feature.protocolSpecs ?? []).map((item) => item.key)),
    ];
    if (hasDuplicateValues(protocolKeys)) {
      errors.push("protocolSpecs keys must be unique across room and features");
    }
  }

  if (
    errors.length > 0 ||
    id === undefined ||
    name === undefined ||
    version === undefined ||
    menu === undefined ||
    runtime === undefined ||
    defaultFeatureId === undefined ||
    features === undefined
  ) {
    return {
      valid: false,
      errors,
    };
  }

  const manifest: RoomManifest = {
    schemaVersion: ROOM_SCHEMA_VERSION,
    id,
    name,
    version,
    menu,
    runtime,
    defaultFeatureId,
    features,
    ...(description !== undefined ? { description } : {}),
    ...(scene !== undefined ? { scene } : {}),
    ...(i18n !== undefined ? { i18n } : {}),
    ...(storageNamespace !== undefined ? { storageNamespace } : {}),
    ...(engineRange !== undefined ? { engineRange } : {}),
    ...(permissions !== undefined ? { permissions } : {}),
    ...(commandSpecs !== undefined ? { commandSpecs } : {}),
    ...(protocolSpecs !== undefined ? { protocolSpecs } : {}),
  };

  return {
    valid: true,
    errors: [],
    manifest,
  };
}

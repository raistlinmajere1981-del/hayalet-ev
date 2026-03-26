import {
  hasDuplicateValues,
  isRecord,
  isValidRoomCommandName,
  isValidRoomId,
  normalizeRoomRelativePath,
  readOptionalString,
  readRequiredString,
} from "./room-validation-primitives.js";
import {
  readCommandSpecs,
  readI18nConfig,
  readMenuConfig,
  readProtocolSpecs,
  readRuntimeConfig,
} from "./room-manifest-readers.js";
import { createRoomSceneReaders } from "./room-scene-readers.js";
export { isValidRoomCommandName, isValidRoomId, normalizeRoomRelativePath };

export const ROOM_SCHEMA_VERSION = 2 as const;

export type RoomCommandScope = "room-ui" | "ai-slots" | "assistant" | "us1" | "system";

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
  path?: string;
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

export function isValidRoomFeatureId(value: string): boolean {
  return isValidRoomId(value);
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

const roomSceneReaders = createRoomSceneReaders({
  isValidRoomFeatureId,
  isRoomSceneCharacterKind,
  isRoomSceneCharacterSlot,
  isRoomSceneCharacterRosterPreset,
  isRoomSceneWindowControlsVisibility,
  isRoomSceneViewBackButtonVariant,
  isRoomScenePageShellVariant,
});

const { readFeatureManifest, readSceneConfig } = roomSceneReaders;

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

export function resolveRoomProtocolFilePath(spec: RoomProtocolSpec): string | null {
  if (spec.path !== undefined) {
    return spec.path;
  }

  const normalizedKey = spec.key.trim();
  if (/^[A-Za-z0-9._-]+$/.test(normalizedKey) !== true) {
    return null;
  }

  return `protocols/${normalizedKey}.md`;
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
  flattenRoomProtocolSpecs(manifest).forEach((spec) => {
    const protocolPath = resolveRoomProtocolFilePath(spec);
    if (protocolPath !== null) {
      paths.add(protocolPath);
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

/**
 * Room package and workspace types.
 */

export const ROOM_SCHEMA_VERSION = 1 as const;

export type RoomCommandScope = "room-ui" | "ai-slots" | "asistan" | "system";

export interface RoomMenuConfig {
  label: string;
  icon?: string;
  order?: number;
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

export interface RoomManifest {
  schemaVersion: typeof ROOM_SCHEMA_VERSION;
  id: string;
  name: string;
  version: string;
  description?: string;
  menu: RoomMenuConfig;
  uiEntry: string;
  hostEntry: string;
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
}

export interface InstalledRoomRecord {
  id: string;
  name: string;
  version: string;
  description?: string;
  sourceDir: string;
  installedDir: string;
  manifestPath: string;
  runtimeEntryPath: string;
  hostEntryPath: string;
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

function hasDuplicateValues(values: string[]): boolean {
  return new Set(values).size !== values.length;
}

export function isValidRoomId(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
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

  const menuRaw = candidate["menu"];
  let menu: RoomMenuConfig | undefined;
  if (!isRecord(menuRaw)) {
    errors.push("menu is required");
  } else {
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
    if (label !== undefined) {
      menu = {
        label,
        ...(icon !== undefined ? { icon } : {}),
        ...(order !== undefined ? { order } : {}),
      };
    }
  }

  const uiEntryRaw = readRequiredString(candidate, "uiEntry", errors);
  const hostEntryRaw = readRequiredString(candidate, "hostEntry", errors);
  const uiEntry = uiEntryRaw !== undefined ? normalizeRoomRelativePath(uiEntryRaw) : null;
  const hostEntry = hostEntryRaw !== undefined ? normalizeRoomRelativePath(hostEntryRaw) : null;
  if (uiEntryRaw !== undefined && uiEntry === null) {
    errors.push("uiEntry must be a safe relative path");
  }
  if (hostEntryRaw !== undefined && hostEntry === null) {
    errors.push("hostEntry must be a safe relative path");
  }

  const storageNamespace = readOptionalString(candidate, "storageNamespace", errors);
  const engineRange = readOptionalString(candidate, "engineRange", errors);

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

  const commandSpecsRaw = candidate["commandSpecs"];
  let commandSpecs: RoomCommandSpec[] | undefined;
  if (commandSpecsRaw !== undefined) {
    if (!Array.isArray(commandSpecsRaw)) {
      errors.push("commandSpecs must be an array");
    } else {
      const parsed: RoomCommandSpec[] = [];
      commandSpecsRaw.forEach((item, index) => {
        if (!isRecord(item)) {
          errors.push(`commandSpecs[${String(index)}] must be an object`);
          return;
        }
        const commandName = readRequiredString(item, "name", errors);
        if (commandName !== undefined && isValidRoomCommandName(commandName) === false) {
          errors.push(`commandSpecs[${String(index)}].name must match /^[A-Za-z0-9_]+$/`);
        }
        const descriptionValue = readOptionalString(item, "description", errors);
        const scopeRaw = item["scope"];
        let scope: RoomCommandScope | undefined;
        if (scopeRaw !== undefined) {
          if (
            scopeRaw !== "room-ui" &&
            scopeRaw !== "ai-slots" &&
            scopeRaw !== "asistan" &&
            scopeRaw !== "system"
          ) {
            errors.push(`commandSpecs[${String(index)}].scope is invalid`);
          } else {
            scope = scopeRaw;
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
        errors.push("commandSpecs names must be unique");
      }
      commandSpecs = parsed;
    }
  }

  const protocolSpecsRaw = candidate["protocolSpecs"];
  let protocolSpecs: RoomProtocolSpec[] | undefined;
  if (protocolSpecsRaw !== undefined) {
    if (!Array.isArray(protocolSpecsRaw)) {
      errors.push("protocolSpecs must be an array");
    } else {
      const parsed: RoomProtocolSpec[] = [];
      protocolSpecsRaw.forEach((item, index) => {
        if (!isRecord(item)) {
          errors.push(`protocolSpecs[${String(index)}] must be an object`);
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
            errors.push(`protocolSpecs[${String(index)}].editable must be boolean`);
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
        errors.push("protocolSpecs keys must be unique");
      }
      protocolSpecs = parsed;
    }
  }

  if (errors.length > 0 || id === undefined || name === undefined || version === undefined) {
    return {
      valid: false,
      errors,
    };
  }

  if (menu === undefined || uiEntry === null || hostEntry === null) {
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
    uiEntry,
    hostEntry,
    ...(description !== undefined ? { description } : {}),
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

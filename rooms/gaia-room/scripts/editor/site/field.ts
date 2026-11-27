import type en from "../../../i18n/en.json";
import { capabilityOf } from "../../devices/capabilities.ts";
import type { PhysicalView } from "../../devices/field-view.ts";
import type { Connection, DeviceHealth } from "../../devices/status.ts";
import type {
  FieldAssignment,
  FieldError,
  FieldOperation,
  FieldReply,
  FieldState,
} from "../../field/management-contract.ts";
import type { Device } from "../../spatial/world.ts";

export const statusPollMs = 10_000;

export type FieldEndpoint = NonNullable<FieldState["endpoint"]>;

export interface FieldEndpointDraft {
  address: string;
  port: string;
  origin: string;
}

export interface StagedReassign {
  sourceProjectId: string;
  sourceDeviceId: string;
  assignmentId: string;
  expectedSourceRevision: number;
  hardwareId: string;
}

const ipv4Pattern =
  /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const dnsLabelPattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const ipv6ZonePattern = /^[A-Za-z0-9._-]+$/;
const uuidV4Pattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;

function isIpv4(host: string): boolean {
  return ipv4Pattern.test(host);
}

function parseIpv6(address: string, allowZone: boolean): string | undefined {
  const percent = address.indexOf("%");
  const bare = percent === -1 ? address : address.slice(0, percent);
  if (percent !== -1) {
    const zone = address.slice(percent + 1);
    if (!allowZone || !zone || !ipv6ZonePattern.test(zone)) return undefined;
  }
  if (!bare.includes(":")) return undefined;
  try {
    return new URL(`http://[${bare}]`).hostname;
  } catch {
    return undefined;
  }
}

export function isUuidV4(value: string): boolean {
  return uuidV4Pattern.test(value.trim());
}

export function parseHttpsOrigin(
  origin: string
): { ok: true; host: string; port: number; origin: string } | { ok: false } {
  const trimmed = origin.trim();
  if (!trimmed || trimmed !== origin || trimmed.length > 300) return { ok: false };
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false };
  }
  if (url.protocol !== "https:" || url.origin !== trimmed || url.port === "0") {
    return { ok: false };
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const isIpHost =
    isIpv4(host) || (url.hostname.startsWith("[") && parseIpv6(host, false) !== undefined);
  if (
    !isIpHost &&
    (host.length > 253 || !host.split(".").every((label) => dnsLabelPattern.test(label)))
  ) {
    return { ok: false };
  }
  return { ok: true, host, port: Number(url.port || 443), origin: trimmed };
}

export function validateFieldEndpoint(
  draft: FieldEndpointDraft
): { ok: true; endpoint: { address: string; port: number; origin: string } } | { ok: false } {
  const address = draft.address.trim();
  const parsedOrigin = parseHttpsOrigin(draft.origin);
  if (!address || !parsedOrigin.ok) return { ok: false };
  const port = Number(draft.port.trim());
  if (!Number.isInteger(port) || port < 1 || port > 65535 || port !== parsedOrigin.port) {
    return { ok: false };
  }
  if (isIpv4(address)) {
    if (address === "0.0.0.0") return { ok: false };
    return { ok: true, endpoint: { address, port, origin: parsedOrigin.origin } };
  }
  const ipv6 = parseIpv6(address, true);
  if (!ipv6 || ipv6 === "[::]" || ipv6 === "[::ffff:0:0]" || ipv6 === "[::ffff:0.0.0.0]") {
    return { ok: false };
  }
  return { ok: true, endpoint: { address, port, origin: parsedOrigin.origin } };
}

export function isFieldReply(value: unknown): value is FieldReply<FieldOperation["action"]> {
  if (typeof value !== "object" || value === null || !("ok" in value)) return false;
  const record = value as Record<string, unknown>;
  if (typeof record["ok"] !== "boolean") return false;
  return record["ok"] ? "data" in record : typeof record["code"] === "string";
}

export function fieldErrorText(code: FieldError | "transport", labels: typeof en.site): string {
  switch (code) {
    case "cancelled":
      return labels.fieldErrCancelled;
    case "busy":
      return labels.fieldErrBusy;
    case "invalid_request":
      return labels.fieldErrInvalidRequest;
    case "scope_changed":
      return labels.fieldErrScopeChanged;
    case "unavailable":
      return labels.fieldErrUnavailable;
    case "transport":
      return labels.fieldErrTransport;
  }
}

export function physicalConnection(device: Device, view?: PhysicalView): Connection {
  if (!device.hardwareId) return "unbound";
  return view?.connection ?? "unknown";
}

export function physicalHealth(device: Device, view?: PhysicalView): DeviceHealth {
  const link = physicalConnection(device, view);
  if (link === "unbound" || link === "offline") return link;
  if (!view) return "unknown";
  const observations = Object.values(view.observations);
  if (observations.some((reading) => reading.quality === "invalid")) return "invalid";
  if (observations.some((reading) => reading.freshness === "stale")) return "stale";
  if (observations.some((reading) => reading.freshness === "noData")) return "noData";
  const readable = device.capabilities.filter((id) => {
    const definition = capabilityOf(id);
    return definition !== undefined && definition.kind !== "media";
  });
  if (link === "online" && readable.length > 0 && observations.length === 0) return "noData";
  return link;
}

export function nextPhysicalExpiryDelay(
  physical: Record<string, PhysicalView>
): number | undefined {
  let next = Infinity;
  for (const row of Object.values(physical)) {
    if (row.connection === "online" && row.linkRemainingMs > 0) {
      next = Math.min(next, row.linkRemainingMs);
    }
    for (const observation of Object.values(row.observations)) {
      if (observation.freshness === "fresh" && observation.freshRemainingMs > 0) {
        next = Math.min(next, observation.freshRemainingMs);
      }
    }
  }
  return Number.isFinite(next) ? Math.max(1, Math.ceil(next)) : undefined;
}

export function latestEstimatedMeasurement(view?: PhysicalView): number | undefined {
  if (!view) return undefined;
  let latest: number | undefined;
  for (const observation of Object.values(view.observations)) {
    if (observation.at !== undefined && (latest === undefined || observation.at > latest)) {
      latest = observation.at;
    }
  }
  return latest;
}

export function deviceAssignments(
  assignments: readonly FieldAssignment[],
  deviceId: string
): { active?: FieldAssignment; pending?: FieldAssignment } {
  const forDevice = assignments.filter((entry) => entry.deviceId === deviceId);
  const active = forDevice.find((entry) => entry.state === "active");
  const pending = forDevice.find((entry) => entry.state === "pending");
  return {
    ...(active === undefined ? {} : { active }),
    ...(pending === undefined ? {} : { pending }),
  };
}

import type en from "../../../i18n/en.json";
import type { PhysicalView } from "../../devices/field-view.ts";
import { deviceHealth, type DeviceHealth, type DeviceStatuses } from "../../devices/status.ts";
import type { Device } from "../../spatial/world.ts";
import { physicalHealth } from "./field.ts";

export const badgeSymbols: Record<DeviceHealth, string> = {
  online: "✓",
  offline: "!",
  unknown: "?",
  unbound: "○",
  fresh: "✓",
  stale: "◷",
  noData: "…",
  invalid: "×",
};

export interface DeviceBadge {
  health: DeviceHealth;
  label: string;
}

export function healthLabel(labels: typeof en.site, state: DeviceHealth): string {
  if (state === "unknown") return labels.noLink;
  if (state === "stale") return labels.staleData;
  return labels[state];
}

export function deviceBadgeHealth(
  id: string,
  device: Device,
  statuses: DeviceStatuses,
  physical: Record<string, PhysicalView>,
  now: number
): DeviceHealth {
  return device.source === "physical"
    ? physicalHealth(device, physical[id])
    : deviceHealth(device, statuses[id], now);
}

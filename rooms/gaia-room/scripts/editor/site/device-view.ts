import type en from "../../../i18n/en.json";
import type { DeviceHealth } from "../../devices/status.ts";

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

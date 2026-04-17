import { AppI18n } from "../i18n/index.js";

const ROOM_SHELL_OVERRIDES = {
  "forge-room": {
    icon: "⚒️",
    nameKey: "shell.rooms.catalog.forgeRoom",
  },
  laboratory: {
    icon: "🧪",
    nameKey: "shell.rooms.catalog.laboratory",
  },
} as const;

function getRoomShellOverride(roomId: string) {
  return ROOM_SHELL_OVERRIDES[roomId as keyof typeof ROOM_SHELL_OVERRIDES];
}

export function resolveRoomShellName(roomId: string, fallbackName: string): string {
  const override = getRoomShellOverride(roomId);
  if (override === undefined) {
    return fallbackName;
  }

  return AppI18n.t(override.nameKey);
}

export function resolveRoomShellIcon(
  roomId: string,
  configuredIcon: string | null | undefined,
  fallbackName: string
): string {
  const override = getRoomShellOverride(roomId);
  if (override !== undefined) {
    return override.icon;
  }

  const trimmedConfiguredIcon = configuredIcon?.trim();
  if (trimmedConfiguredIcon !== undefined && trimmedConfiguredIcon !== "") {
    return trimmedConfiguredIcon;
  }

  const trimmedFallbackName = fallbackName.trim();
  return trimmedFallbackName.length > 0 ? trimmedFallbackName.slice(0, 2).toUpperCase() : "OD";
}

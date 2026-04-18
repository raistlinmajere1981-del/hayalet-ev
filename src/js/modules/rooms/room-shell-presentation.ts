function readRoomShellLabel(roomId: string, fallbackName: string): string {
  const trimmedFallbackName = fallbackName.trim();
  if (trimmedFallbackName !== "") {
    return trimmedFallbackName;
  }

  return roomId.trim();
}

export function resolveRoomShellName(roomId: string, fallbackName: string): string {
  const label = readRoomShellLabel(roomId, fallbackName);
  return label !== "" ? label : roomId;
}

export function resolveRoomShellIcon(
  roomId: string,
  configuredIcon: string | null | undefined,
  fallbackName: string
): string {
  const trimmedConfiguredIcon = configuredIcon?.trim();
  if (trimmedConfiguredIcon !== undefined && trimmedConfiguredIcon !== "") {
    return trimmedConfiguredIcon;
  }

  const label = readRoomShellLabel(roomId, fallbackName);
  return label.length > 0 ? label.slice(0, 2).toUpperCase() : "OD";
}

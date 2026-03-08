export function toRoomRuntimeFileUrl(runtimeEntryPath: string): string {
  const normalized = runtimeEntryPath.replace(/\\/g, "/");
  const url = new URL("file:///");
  url.pathname = normalized.startsWith("/") ? normalized : `/${normalized}`;
  return url.toString();
}

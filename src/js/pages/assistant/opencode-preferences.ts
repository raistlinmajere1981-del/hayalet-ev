import type { AppSettings } from "@shared/settings.js";

export function normalizeOpencodePort(raw: unknown): number {
  if (typeof raw === "number" && Number.isInteger(raw) && raw >= 1024 && raw <= 65535) {
    return raw;
  }
  return 4096;
}

export function getOpencodePreferences(settings: AppSettings | null): {
  defaultPort: number;
} {
  const defaultPort = normalizeOpencodePort(settings?.assistants?.opencode?.defaultPort);
  return { defaultPort };
}

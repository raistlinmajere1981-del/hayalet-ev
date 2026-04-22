export const DEFAULT_CAPTURE_COMMAND_PHRASES = {
  openCamera: ["kamerayi ac", "kamerayi baslat", "preview baslat", "hazirim"],
  capture: ["cek", "capture", "foto cek", "fotograf cek"],
  retake: ["yeniden cek", "retake", "tekrar cek"],
  attach: ["ekle", "attach", "gonder"],
  stop: ["durdur", "kapat", "stop", "capture durdur"],
  cancel: ["iptal", "cancel"],
} as const;

export type CaptureCommandPhraseKey = keyof typeof DEFAULT_CAPTURE_COMMAND_PHRASES;

export function normalizeCapturePhraseList(
  value: unknown,
  fallback: readonly string[]
): string[] {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];

  const normalized = source
    .map((entry) =>
      typeof entry === "string" ? entry.trim().toLocaleLowerCase("tr-TR") : ""
    )
    .filter((entry, index, list) => entry !== "" && list.indexOf(entry) === index);

  return normalized.length > 0 ? normalized : [...fallback];
}

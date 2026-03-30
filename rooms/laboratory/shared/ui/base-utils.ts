type LaboratoryLocale = "en" | "tr";
type LaboratoryRecord = Record<string, unknown>;
type LaboratoryFormControl = HTMLInputElement | HTMLSelectElement;

function toFiniteNumber(value: unknown): number | null {
  const numericValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

export function resolveLaboratoryLocale(value: unknown): LaboratoryLocale {
  return typeof value === "string" && value.toLowerCase().startsWith("tr") ? "tr" : "en";
}

export function toLaboratoryRecord(value: unknown): LaboratoryRecord {
  if (value !== null && typeof value === "object" && Array.isArray(value) === false) {
    return value as LaboratoryRecord;
  }
  return {};
}

export function cloneLaboratoryValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function readLaboratoryFormValue(target: LaboratoryFormControl): number | string | null {
  if (target instanceof HTMLInputElement && target.type === "number") {
    return target.value === "" ? null : Number(target.value);
  }
  return target.value;
}

export function readLaboratoryValue(source: unknown, path: readonly (string | number)[]): unknown {
  let current: unknown = source;
  for (let index = 0; index < path.length; index += 1) {
    const key = path[index];
    if (key === undefined) {
      return undefined;
    }
    if (current === null || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    current = toLaboratoryRecord(current)[key];
  }
  return current;
}

export function escapeLaboratoryHtml(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function formatLaboratoryTime(ms: unknown, totalDurationMs: unknown): string {
  const durationMs = Math.max(0, toFiniteNumber(totalDurationMs) ?? 0);
  const currentMs = Math.max(0, Math.round(toFiniteNumber(ms) ?? 0));
  const total = Math.max(0, Math.min(durationMs, currentMs));
  const minutes = Math.floor(total / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  const centiseconds = Math.floor((total % 1000) / 10);
  return [
    String(minutes).padStart(2, "0"),
    String(seconds).padStart(2, "0"),
    String(centiseconds).padStart(2, "0"),
  ].join(":");
}

export function formatLaboratoryDuration(seconds: unknown): string {
  const numericSeconds = toFiniteNumber(seconds);
  if (numericSeconds === null || numericSeconds <= 0) {
    return "--";
  }
  const total = Math.floor(numericSeconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainingSeconds = total % 60;
  if (hours > 0) {
    return [hours, minutes, remainingSeconds]
      .map((item) => String(item).padStart(2, "0"))
      .join(":");
  }
  return [minutes, remainingSeconds].map((item) => String(item).padStart(2, "0")).join(":");
}

export function formatLaboratoryDateTime(value: unknown, locale: unknown): string {
  if (typeof value !== "string" || value.trim() === "") {
    return "--";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString(resolveLaboratoryLocale(locale) === "tr" ? "tr-TR" : "en-US");
}

export function formatLaboratoryStatusLabel(value: unknown): string {
  const token = typeof value === "string" ? value : "idle";
  return token
    .split(/[-_]/)
    .filter(Boolean)
    .map(function (segment) {
      return segment.charAt(0).toUpperCase() + segment.slice(1);
    })
    .join(" ");
}

export function resolveLaboratoryLocale(value) {
  return typeof value === "string" && value.toLowerCase().startsWith("tr") ? "tr" : "en";
}

export function toLaboratoryRecord(value) {
  if (value !== null && typeof value === "object" && Array.isArray(value) === false) {
    return value;
  }
  return {};
}

export function cloneLaboratoryValue(value) {
  return JSON.parse(JSON.stringify(value));
}

export function readLaboratoryFormValue(target) {
  if (target instanceof HTMLInputElement && target.type === "number") {
    return target.value === "" ? null : Number(target.value);
  }
  return target.value;
}

export function readLaboratoryValue(source, path) {
  let current = source;
  for (let index = 0; index < path.length; index += 1) {
    const key = path[index];
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    current = current[key];
  }
  return current;
}

export function escapeLaboratoryHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function formatLaboratoryTime(ms, totalDurationMs) {
  const total = Math.max(0, Math.min(totalDurationMs, Math.round(ms)));
  const minutes = Math.floor(total / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  const centiseconds = Math.floor((total % 1000) / 10);
  return [
    String(minutes).padStart(2, "0"),
    String(seconds).padStart(2, "0"),
    String(centiseconds).padStart(2, "0"),
  ].join(":");
}

export function formatLaboratoryDuration(seconds) {
  if (typeof seconds !== "number" || Number.isFinite(seconds) === false || seconds <= 0) {
    return "--";
  }
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainingSeconds = total % 60;
  if (hours > 0) {
    return [hours, minutes, remainingSeconds].map((item) => String(item).padStart(2, "0")).join(":");
  }
  return [minutes, remainingSeconds].map((item) => String(item).padStart(2, "0")).join(":");
}

export function formatLaboratoryDateTime(value, locale) {
  if (typeof value !== "string" || value.trim() === "") {
    return "--";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString(locale === "tr" ? "tr-TR" : "en-US");
}

export function formatLaboratoryStatusLabel(value) {
  const token = typeof value === "string" ? value : "idle";
  return token
    .split(/[-_]/)
    .filter(Boolean)
    .map(function (segment) {
      return segment.charAt(0).toUpperCase() + segment.slice(1);
    })
    .join(" ");
}

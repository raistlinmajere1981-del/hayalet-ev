export const LAB_STAGES = ["source", "edit", "profile", "process", "report"];
export const LAB_FEATURES = [
  {
    id: "media-analysis",
    label: "Medya Analizi",
    shortLabel: "Medya",
    description: "Kaynak hazırlama, önizleme, profil ve final iş akışı."
  },
  {
    id: "audio-analysis",
    label: "Ses Analizi",
    shortLabel: "Ses",
    description: "Ses odaklı analiz modülleri ve çıktı takibi."
  },
  {
    id: "subtitle-analysis",
    label: "Altyazi Analizi",
    shortLabel: "Altyazi",
    description: "Altyazı girişi, seçim, analiz ve rapor akışı."
  }
];
export function createLabFeatureMeta(featureId) {
  return LAB_FEATURES.find(function(entry) {
    return entry.id === featureId;
  }) || LAB_FEATURES[0];
}
export function asLabRecord(value) {
  if (value !== null && typeof value === "object" && Array.isArray(value) === false) {
    return value;
  }
  return {};
}
export function asString(value, fallback = "") {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return fallback;
}
export function asNonEmptyString(value) {
  const text = asString(value).trim();
  return text !== "" ? text : null;
}
export function asNumber(value) {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : null;
}
export function asStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map(function(entry) {
    return asNonEmptyString(entry);
  }).filter((entry) => entry !== null);
}
export function escapeHtml(value) {
  return asString(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
export function formatDateTime(value) {
  const text = asNonEmptyString(value);
  if (text === null) {
    return "--";
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return text;
  }
  return parsed.toLocaleString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit"
  });
}
export function formatDurationSeconds(value) {
  const seconds = asNumber(value);
  if (seconds === null) {
    return "--";
  }
  const whole = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(whole / 60);
  const remainder = whole % 60;
  if (minutes <= 0) {
    return `${String(remainder)} sn`;
  }
  return `${String(minutes)} dk ${String(remainder).padStart(2, "0")} sn`;
}
export function formatBytes(value) {
  const bytes = asNumber(value);
  if (bytes === null) {
    return "--";
  }
  if (bytes < 1024) {
    return `${Math.round(bytes)} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
export function clampPercent(value) {
  const percent = asNumber(value);
  if (percent === null) {
    return null;
  }
  return Math.max(0, Math.min(100, Math.round(percent)));
}
export function toTimestamp(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const text = asNonEmptyString(value);
  if (text === null) {
    return Date.now();
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? Date.now() : parsed.getTime();
}
export function createLabEventId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
export function isLabFeatureId(value) {
  return value === "media-analysis" || value === "audio-analysis" || value === "subtitle-analysis";
}
export function normalizeLabFeatureId(value, fallback = "media-analysis") {
  return isLabFeatureId(value) ? value : fallback;
}
export function normalizeLabStage(value, fallback = "source") {
  return LAB_STAGES.includes(value) ? value : fallback;
}
export function formatStatusLabel(value) {
  const status = asNonEmptyString(value) || "idle";
  switch (status) {
    case "idle":
      return "Hazır";
    case "queued":
      return "Sırada";
    case "running":
      return "Çalışıyor";
    case "ready":
      return "Hazır";
    case "completed":
      return "Tamamlandı";
    case "failed":
      return "Hata";
    case "cancelled":
      return "İptal";
    case "skipped":
      return "Atlandı";
    case "stale":
      return "Yenile";
    default:
      return status;
  }
}
export function normalizeFindingKind(value) {
  if (value === "measured" || value === "heuristic") {
    return value;
  }
  return "derived";
}

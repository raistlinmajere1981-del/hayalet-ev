export const WORKSPACE_INTENTS = [
  {
    id: "visual-inspection",
    label: "Visual inspection",
    description: "Examine visual structure, frame composition, and forensic markers.",
    sourceKinds: ["video", "image"],
    internalCapabilities: ["visual-structure", "visual-forensics"]
  },
  {
    id: "audio-investigation",
    label: "Audio investigation",
    description: "Analyze audio signals, recover details, and identify speakers.",
    sourceKinds: ["video", "audio"],
    internalCapabilities: ["audio-signal", "audio-recovery", "speaker-analysis"]
  },
  {
    id: "detail-enhancement",
    label: "Detail enhancement",
    description: "Generate transcripts and separate audio sources for deeper review.",
    sourceKinds: ["video", "audio"],
    internalCapabilities: ["transcription", "source-separation"]
  },
  {
    id: "anomaly-detection",
    label: "Anomaly detection",
    description: "Detect visual and audio anomalies, classify sounds, and analyze prosody.",
    sourceKinds: ["video", "audio", "image"],
    internalCapabilities: [
      "visual-forensics",
      "sound-classification",
      "prosody-emotion",
      "music-analysis"
    ]
  }
];
export function getIntentLabel(intentId) {
  return WORKSPACE_INTENTS.find(function(intent) {
    return intent.id === intentId;
  })?.label || intentId;
}
export function getIntentPreviewDescription(intentId) {
  switch (intentId) {
    case "visual-inspection":
      return "Görsel yapı ve anomaliler analiz edilir";
    case "audio-investigation":
      return "Ses sinyali ve anomaliler analiz edilir";
    case "detail-enhancement":
      return "Görüntü detayları iyileştirilir";
    case "anomaly-detection":
      return "Olası anormallikler tespit edilir";
    default:
      return getIntentLabel(intentId);
  }
}
export function getCapabilityFamilyIdsForIntentId(intentId) {
  const intent = WORKSPACE_INTENTS.find(function(entry) {
    return entry.id === intentId;
  });
  return Array.isArray(intent?.internalCapabilities) ? intent.internalCapabilities.slice() : [];
}
export const CAPABILITY_FAMILIES = [
  {
    id: "visual-structure",
    label: "Visual Structure",
    sourceKinds: ["video"],
    primaryTool: "ffmpeg",
    requiredTools: ["ffmpeg"]
  },
  {
    id: "visual-forensics",
    label: "Visual Forensics",
    sourceKinds: ["video"],
    primaryTool: "ffmpeg",
    requiredTools: ["ffmpeg"]
  },
  {
    id: "audio-signal",
    label: "Audio Signal",
    sourceKinds: ["video", "audio"],
    primaryTool: "ffmpeg",
    requiredTools: ["ffmpeg"]
  },
  {
    id: "audio-recovery",
    label: "Audio Recovery",
    sourceKinds: ["video", "audio"],
    primaryTool: "ffmpeg",
    requiredTools: ["ffmpeg"]
  },
  {
    id: "transcription",
    label: "Transcription",
    sourceKinds: ["video", "audio"],
    primaryTool: "whisper.cpp",
    requiredTools: ["whisper.cpp"]
  },
  {
    id: "speaker-analysis",
    label: "Speaker Analysis",
    sourceKinds: ["video", "audio"],
    primaryTool: "pyaudioanalysis",
    requiredTools: ["pyaudioanalysis", "ffmpeg"]
  },
  {
    id: "prosody-emotion",
    label: "Prosody & Emotion",
    sourceKinds: ["video", "audio"],
    primaryTool: "opensmile",
    requiredTools: ["opensmile"]
  },
  {
    id: "sound-classification",
    label: "Sound Classification",
    sourceKinds: ["video", "audio"],
    primaryTool: "yamnet",
    requiredTools: ["yamnet", "ffmpeg"]
  },
  {
    id: "source-separation",
    label: "Source Separation",
    sourceKinds: ["video", "audio"],
    primaryTool: "demucs",
    requiredTools: ["demucs", "ffmpeg"]
  },
  {
    id: "music-analysis",
    label: "Music Analysis",
    sourceKinds: ["video", "audio"],
    primaryTool: "librosa",
    requiredTools: ["librosa", "ffmpeg"]
  }
];
const CAPABILITY_MODULE_GROUPS = [
  {
    capabilityId: "visual-structure",
    moduleIds: [
      "frame-consistency",
      "lighting-consistency",
      "background-consistency",
      "occlusion-inconsistency",
      "object-insert-remove-anomaly",
      "temporal-noise-pattern",
      "motion-anomaly"
    ]
  },
  {
    capabilityId: "visual-forensics",
    moduleIds: [
      "visual-signal-amplification",
      "color-channel-isolation",
      "gamma-scan",
      "contrast-scan",
      "edge-enhancement",
      "histogram-equalization",
      "hidden-detail-reveal",
      "ai-artifact-detection"
    ]
  },
  {
    capabilityId: "audio-signal",
    moduleIds: ["signal-health", "spectral-artifacts"]
  },
  {
    capabilityId: "audio-recovery",
    moduleIds: [
      "signal-recovery",
      "band-pass-exploration",
      "spectrogram-guided-recovery",
      "hidden-pattern-extraction",
      "frequency-shift-reversal",
      "phase-recovery-experiment"
    ]
  },
  {
    capabilityId: "transcription",
    moduleIds: ["transcription", "transcript-support"]
  },
  {
    capabilityId: "speaker-analysis",
    moduleIds: ["speaker-diarization"]
  },
  {
    capabilityId: "prosody-emotion",
    moduleIds: ["prosody", "emotion"]
  },
  {
    capabilityId: "sound-classification",
    moduleIds: ["sound-events"]
  },
  {
    capabilityId: "source-separation",
    moduleIds: ["source-separation"]
  },
  {
    capabilityId: "music-analysis",
    moduleIds: ["music-rhythm-tonal"]
  }
];
export function getModuleIdsForCapabilityFamily(capabilityId) {
  return CAPABILITY_MODULE_GROUPS.find(function(entry) {
    return entry.capabilityId === capabilityId;
  })?.moduleIds.slice() || [];
}
export function getIntentIdsForCapabilityFamily(capabilityId) {
  return WORKSPACE_INTENTS.filter(function(intent) {
    return intent.internalCapabilities.includes(capabilityId);
  }).map(function(intent) {
    return intent.id;
  });
}
export function getCapabilityFamilyForModuleId(moduleId) {
  if (typeof moduleId !== "string" || moduleId.trim() === "") {
    return null;
  }
  const normalizedModuleId = moduleId.trim();
  if (CAPABILITY_FAMILIES.some(function(family) {
    return family.id === normalizedModuleId;
  })) {
    return normalizedModuleId;
  }
  return CAPABILITY_MODULE_GROUPS.find(function(entry) {
    return entry.moduleIds.includes(normalizedModuleId);
  })?.capabilityId || null;
}
export function getIntentIdsForModuleId(moduleId) {
  const capabilityId = getCapabilityFamilyForModuleId(moduleId);
  if (capabilityId === null) {
    return [];
  }
  return getIntentIdsForCapabilityFamily(capabilityId);
}
export const LAB_STAGES = ["source", "edit", "process", "report"];
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
    // NOTE: subtitle-analysis remains legacy-internal only and is no longer user-facing in v2.2.
    id: "subtitle-analysis",
    label: "Transcript Support",
    shortLabel: "Transcript",
    description: "Timestamped transcript artifact support kept for backward compatibility."
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

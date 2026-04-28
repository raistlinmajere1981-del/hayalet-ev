import type { LabI18nKey } from "./lab-i18n.js";

export const labI18nEn: Record<LabI18nKey, string> = {
  "posture.proceed": "Proceed",
  "posture.caution": "Proceed with caution",
  "posture.reconsider": "Reconsider",
  "descriptor.view": "Descriptor view",
  "readiness.view": "Readiness view",
  "bridge.view": "Execution bridge",
  "coherence.view": "Coherence view",
  "coherence.aligned": "Signals are aligned toward a stable path",
  "coherence.mixed": "Signals are mixed, with trade-offs between stability and coverage",
  "coherence.conflicted": "Signals are conflicted, indicating a high-risk and unstable path",
  "coherence.neutral": "Neutral signal",
  "projection.increase": "better projection",
  "projection.decrease": "worse projection",
  "projection.stable": "neutral projection",
};

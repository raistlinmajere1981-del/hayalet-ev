import { normalizeLaboratoryTemporalStressTestRequest } from "./temporal-stress-test-model.js";
import type { LaboratoryTemporalStressTestRequest } from "./temporal-stress-test-model.js";

export type LaboratoryControlInjectionKind =
  | "noise"
  | "blur"
  | "sharpen"
  | "denoise"
  | "gamma"
  | "black-crush"
  | "highlight-clipping"
  | "chroma-suppression"
  | "low-light"
  | "recompression"
  | "recompression-ladder"
  | "response-exposure"
  | "response-gamma"
  | "response-brightness"
  | "response-black-level"
  | "response-contrast"
  | "response-local-contrast"
  | "response-blur"
  | "response-denoise"
  | "response-sharpen"
  | "appearance-transition";

export type LaboratoryControlInjectionDefinition = {
  kind: LaboratoryControlInjectionKind;
  label: string;
  params: Record<string, number>;
  group?: "destruction" | "response" | "transition";
};

export type LaboratoryControlInjectionRequest = {
  kind: LaboratoryControlInjectionKind;
  params: Record<string, number>;
  temporalRequest: LaboratoryTemporalStressTestRequest;
};

const CONTROL_INJECTION_DEFINITIONS: LaboratoryControlInjectionDefinition[] = [
  { kind: "noise", label: "Noise", params: { strength: 12, seed: 4242 }, group: "destruction" },
  { kind: "blur", label: "Blur", params: { radius: 2 }, group: "destruction" },
  { kind: "sharpen", label: "Sharpen", params: { amount: 1.25 }, group: "destruction" },
  { kind: "denoise", label: "Denoise", params: { luma: 6, chroma: 4.5 }, group: "destruction" },
  { kind: "gamma", label: "Gamma stress", params: { gamma: 1.8 }, group: "destruction" },
  { kind: "black-crush", label: "Black crush", params: { threshold: 0.1 }, group: "destruction" },
  {
    kind: "highlight-clipping",
    label: "Highlight clipping",
    params: { threshold: 0.85 },
    group: "destruction",
  },
  {
    kind: "chroma-suppression",
    label: "Chroma suppression",
    params: { saturation: 0.15 },
    group: "destruction",
  },
  {
    kind: "low-light",
    label: "Low-light",
    params: {
      brightness: -0.25,
      contrast: 1.05,
      saturation: 0.9,
      noiseStrength: 8,
      noiseSeed: 4242,
    },
    group: "destruction",
  },
  {
    kind: "recompression",
    label: "Recompression 18→36",
    params: { baselineCrf: 18, injectedCrf: 36 },
    group: "destruction",
  },
  {
    kind: "recompression-ladder",
    label: "Recompression ladder 18→42",
    params: {},
    group: "destruction",
  },
  { kind: "response-exposure", label: "Response · Exposure", params: {}, group: "response" },
  { kind: "response-gamma", label: "Response · Gamma", params: {}, group: "response" },
  { kind: "response-brightness", label: "Response · Brightness", params: {}, group: "response" },
  { kind: "response-black-level", label: "Response · Black level", params: {}, group: "response" },
  { kind: "response-contrast", label: "Response · Contrast", params: {}, group: "response" },
  { kind: "response-local-contrast", label: "Response · Local contrast", params: {}, group: "response" },
  { kind: "response-blur", label: "Response · Blur", params: {}, group: "response" },
  { kind: "response-denoise", label: "Response · Denoise", params: {}, group: "response" },
  { kind: "response-sharpen", label: "Response · Sharpen", params: {}, group: "response" },
  {
    kind: "appearance-transition",
    label: "Appearance / disappearance transition",
    params: {},
    group: "transition",
  },
];

function toRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && Array.isArray(value) === false
    ? (value as Record<string, unknown>)
    : {};
}

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function getLaboratoryControlInjectionDefinitions(): LaboratoryControlInjectionDefinition[] {
  return CONTROL_INJECTION_DEFINITIONS.map(function (definition) {
    return { ...definition, params: { ...definition.params } };
  });
}

export function isLaboratoryControlInjectionKind(
  value: unknown
): value is LaboratoryControlInjectionKind {
  return CONTROL_INJECTION_DEFINITIONS.some(function (definition) {
    return definition.kind === value;
  });
}

export function normalizeLaboratoryControlInjectionRequest(
  value: unknown,
  sourceDurationSeconds: number | null = null
): LaboratoryControlInjectionRequest | null {
  const record = toRecord(value);
  const kind = record["kind"];
  if (!isLaboratoryControlInjectionKind(kind)) return null;
  const definition = CONTROL_INJECTION_DEFINITIONS.find((entry) => entry.kind === kind);
  if (definition === undefined) return null;
  const temporalRequest = normalizeLaboratoryTemporalStressTestRequest(
    record["temporalRequest"],
    sourceDurationSeconds
  );
  if (temporalRequest === null) return null;
  const suppliedParams = toRecord(record["params"]);
  const params = Object.entries(definition.params).reduce<Record<string, number>>(
    (output, [key, fallback]) => {
      output[key] = finite(suppliedParams[key]) ?? fallback;
      return output;
    },
    {}
  );
  return { kind, params, temporalRequest };
}

import { normalizeLaboratoryTemporalStressTestRequest } from "./temporal-stress-test-model.js";
import type { LaboratoryTemporalStressTestRequest } from "./temporal-stress-test-model.js";

export type LaboratoryControlInjectionKind =
  | "noise"
  | "blur"
  | "sharpen"
  | "low-light"
  | "recompression";

export type LaboratoryControlInjectionDefinition = {
  kind: LaboratoryControlInjectionKind;
  label: string;
  params: Record<string, number>;
};

export type LaboratoryControlInjectionRequest = {
  kind: LaboratoryControlInjectionKind;
  params: Record<string, number>;
  temporalRequest: LaboratoryTemporalStressTestRequest;
};

const CONTROL_INJECTION_DEFINITIONS: LaboratoryControlInjectionDefinition[] = [
  {
    kind: "noise",
    label: "Noise",
    params: { strength: 12, seed: 4242 },
  },
  {
    kind: "blur",
    label: "Blur",
    params: { radius: 2 },
  },
  {
    kind: "sharpen",
    label: "Sharpen",
    params: { amount: 1.25 },
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
  },
  {
    kind: "recompression",
    label: "Recompression",
    params: {
      baselineCrf: 18,
      injectedCrf: 36,
    },
  },
];

function toRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && Array.isArray(value) === false
    ? (value as Record<string, unknown>)
    : {};
}

export function getLaboratoryControlInjectionDefinitions(): LaboratoryControlInjectionDefinition[] {
  return CONTROL_INJECTION_DEFINITIONS.map(function (definition) {
    return {
      ...definition,
      params: { ...definition.params },
    };
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
  if (!isLaboratoryControlInjectionKind(kind)) {
    return null;
  }
  const definition = CONTROL_INJECTION_DEFINITIONS.find(function (entry) {
    return entry.kind === kind;
  });
  if (definition === undefined) {
    return null;
  }
  const temporalRequest = normalizeLaboratoryTemporalStressTestRequest(
    record["temporalRequest"],
    sourceDurationSeconds
  );
  if (temporalRequest === null) {
    return null;
  }
  return {
    kind,
    params: { ...definition.params },
    temporalRequest,
  };
}

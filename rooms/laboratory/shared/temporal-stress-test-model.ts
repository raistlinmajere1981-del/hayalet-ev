const LAB_TEMPORAL_STRESS_TEST_MAX_WINDOW_SECONDS = 6;
const LAB_TEMPORAL_STRESS_TEST_DEFAULT_SAMPLE_FPS = 5;

export type LaboratoryTemporalStressTestRoi = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type LaboratoryTemporalStressTestRequest = {
  startSeconds: number;
  endSeconds: number;
  sampleFps: number;
  roi: LaboratoryTemporalStressTestRoi | null;
};

type LaboratoryTemporalStressTestWorkspaceSelection = {
  startMs?: unknown;
  endMs?: unknown;
  roi?: unknown;
};

function toFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeRoi(value: unknown): LaboratoryTemporalStressTestRoi | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const rawX = toFiniteNumber(record["x"]);
  const rawY = toFiniteNumber(record["y"]);
  const rawWidth = toFiniteNumber(record["width"]);
  const rawHeight = toFiniteNumber(record["height"]);
  if (rawX === null || rawY === null || rawWidth === null || rawHeight === null) {
    return null;
  }

  const x = clamp(rawX, 0, 0.99);
  const y = clamp(rawY, 0, 0.99);
  const width = clamp(rawWidth, 0.01, 1 - x);
  const height = clamp(rawHeight, 0.01, 1 - y);
  return { x, y, width, height };
}

function clampWindowToDuration(
  startSeconds: number,
  endSeconds: number,
  sourceDurationSeconds: number | null
) {
  const sourceEnd =
    sourceDurationSeconds !== null && sourceDurationSeconds > 0
      ? sourceDurationSeconds
      : Number.POSITIVE_INFINITY;
  let start = clamp(startSeconds, 0, sourceEnd);
  let end = clamp(endSeconds, 0, sourceEnd);
  if (end <= start) {
    return null;
  }

  const duration = end - start;
  if (duration <= LAB_TEMPORAL_STRESS_TEST_MAX_WINDOW_SECONDS) {
    return { startSeconds: start, endSeconds: end };
  }

  const center = (start + end) / 2;
  start = Math.max(0, center - LAB_TEMPORAL_STRESS_TEST_MAX_WINDOW_SECONDS / 2);
  end = start + LAB_TEMPORAL_STRESS_TEST_MAX_WINDOW_SECONDS;
  if (Number.isFinite(sourceEnd) && end > sourceEnd) {
    end = sourceEnd;
    start = Math.max(0, end - LAB_TEMPORAL_STRESS_TEST_MAX_WINDOW_SECONDS);
  }
  return { startSeconds: start, endSeconds: end };
}

export function normalizeLaboratoryTemporalStressTestRequest(
  value: unknown,
  sourceDurationSeconds: number | null = null
): LaboratoryTemporalStressTestRequest | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const startSeconds = toFiniteNumber(record["startSeconds"]);
  const endSeconds = toFiniteNumber(record["endSeconds"]);
  if (startSeconds === null || endSeconds === null) {
    return null;
  }
  const window = clampWindowToDuration(startSeconds, endSeconds, sourceDurationSeconds);
  if (window === null) {
    return null;
  }
  const requestedSampleFps = toFiniteNumber(record["sampleFps"]);
  return {
    ...window,
    sampleFps: Math.round(
      clamp(requestedSampleFps ?? LAB_TEMPORAL_STRESS_TEST_DEFAULT_SAMPLE_FPS, 1, 10)
    ),
    roi: normalizeRoi(record["roi"]),
  };
}

export function buildLaboratoryTemporalStressTestRequestFromWorkspaceSelection(
  value: LaboratoryTemporalStressTestWorkspaceSelection | null | undefined,
  sourceDurationSeconds: number | null = null
): LaboratoryTemporalStressTestRequest | null {
  if (value === null || value === undefined) {
    return null;
  }
  const startMs = toFiniteNumber(value.startMs);
  const endMs = toFiniteNumber(value.endMs);
  if (startMs === null || endMs === null || endMs <= startMs) {
    return null;
  }
  return normalizeLaboratoryTemporalStressTestRequest(
    {
      startSeconds: startMs / 1000,
      endSeconds: endMs / 1000,
      sampleFps: LAB_TEMPORAL_STRESS_TEST_DEFAULT_SAMPLE_FPS,
      roi: value.roi,
    },
    sourceDurationSeconds
  );
}

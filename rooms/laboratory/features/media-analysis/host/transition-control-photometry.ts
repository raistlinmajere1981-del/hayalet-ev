import {
  buildLaboratoryResponseRegionMetrics,
  parseLaboratoryResponseMetricText,
} from "./visual-response-probe.js";
import type { LaboratoryNormalizedRoi } from "../../../shared/visual-response-probe-model.js";

type RecordValue = Record<string, unknown>;
type RuntimeRecord = RecordValue;
type ProjectRecord = RecordValue;

type TransitionControlPhotometryDeps = {
  callRoomTools: (payload: RecordValue) => Promise<unknown>;
  getProjectEditOutputDir: (runtime: RuntimeRecord, project: ProjectRecord) => string;
  roomId: string;
  toRecord: (value: unknown) => RecordValue;
};

type PhaseWindow = {
  endSeconds: number;
  phase: string;
  startSeconds: number;
};

const NEAR_BLACK_THRESHOLD = 32;
const LUMA_RECOVERY_MULTIPLIER = 8;

function formatNumber(value: number) {
  return Number(value.toFixed(6)).toString();
}

function finite(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function cropFilter(roi: LaboratoryNormalizedRoi) {
  return `crop=iw*${formatNumber(roi.width)}:ih*${formatNumber(roi.height)}:iw*${formatNumber(roi.x)}:ih*${formatNumber(roi.y)}`;
}

function buildCommand(
  sourcePath: string,
  window: PhaseWindow,
  roi: LaboratoryNormalizedRoi,
  sampleFps: number,
  mode: "source" | "edge" | "lifted"
) {
  const filters = [`fps=${String(sampleFps)}`];
  if (mode === "edge") {
    filters.push(
      "edgedetect=low=0.05:high=0.2",
      cropFilter(roi),
      "signalstats",
      "metadata=mode=print:key=lavfi.signalstats.YAVG"
    );
  } else if (mode === "lifted") {
    filters.push(
      cropFilter(roi),
      `lutyuv=y=val*${String(LUMA_RECOVERY_MULTIPLIER)}`,
      `blackframe=amount=0:threshold=${String(NEAR_BLACK_THRESHOLD)}`,
      "metadata=mode=print:key=lavfi.blackframe.pblack"
    );
  } else {
    filters.push(
      cropFilter(roi),
      "signalstats",
      `blackframe=amount=0:threshold=${String(NEAR_BLACK_THRESHOLD)}`,
      "metadata=mode=print:key=lavfi.signalstats.YAVG",
      "metadata=mode=print:key=lavfi.signalstats.YMIN",
      "metadata=mode=print:key=lavfi.signalstats.YLOW",
      "metadata=mode=print:key=lavfi.signalstats.YHIGH",
      "metadata=mode=print:key=lavfi.signalstats.YMAX",
      "metadata=mode=print:key=lavfi.signalstats.UAVG",
      "metadata=mode=print:key=lavfi.signalstats.VAVG",
      "metadata=mode=print:key=lavfi.blackframe.pblack"
    );
  }
  return [
    "-hide_banner",
    "-nostats",
    "-ss",
    formatNumber(window.startSeconds),
    "-t",
    formatNumber(Math.max(0.02, window.endSeconds - window.startSeconds)),
    "-i",
    sourcePath,
    "-an",
    "-sn",
    "-dn",
    "-vf",
    filters.join(","),
    "-f",
    "null",
    "-",
  ];
}

async function sequentialMap<T, U>(values: readonly T[], mapper: (value: T) => Promise<U>) {
  return values.reduce<Promise<U[]>>(async function (pending, value) {
    const output = await pending;
    output.push(await mapper(value));
    return output;
  }, Promise.resolve([]));
}

export function createLaboratoryTransitionControlPhotometryRuntime(
  deps: TransitionControlPhotometryDeps
) {
  const { callRoomTools, getProjectEditOutputDir, roomId, toRecord } = deps;

  async function runTool(
    runtime: RuntimeRecord,
    project: ProjectRecord,
    requestId: string,
    args: string[]
  ) {
    const result = toRecord(
      await callRoomTools({
        args,
        cwd: getProjectEditOutputDir(runtime, project),
        operation: "tool-run",
        requestId,
        roomId,
        timeoutMs: 60_000,
        toolId: "ffmpeg",
      })
    );
    const run = toRecord(result["run"]);
    const exitCode = finite(run["exitCode"]) ?? 0;
    if (run["cancelled"] === true || exitCode !== 0) {
      const stderr = typeof run["stderr"] === "string" ? run["stderr"] : "";
      throw new Error(stderr.trim() || "Control ROI photometry failed.");
    }
    return [run["stdout"], run["stderr"]]
      .filter(function (value): value is string {
        return typeof value === "string" && value.trim() !== "";
      })
      .join("\n");
  }

  async function measurePhase(input: {
    project: ProjectRecord;
    requestId: string;
    roi: LaboratoryNormalizedRoi;
    runtime: RuntimeRecord;
    sampleFps: number;
    sourcePath: string;
    window: PhaseWindow;
  }) {
    const sourceText = await runTool(
      input.runtime,
      input.project,
      input.requestId,
      buildCommand(input.sourcePath, input.window, input.roi, input.sampleFps, "source")
    );
    const edgeText = await runTool(
      input.runtime,
      input.project,
      input.requestId,
      buildCommand(input.sourcePath, input.window, input.roi, input.sampleFps, "edge")
    );
    const liftedText = await runTool(
      input.runtime,
      input.project,
      input.requestId,
      buildCommand(input.sourcePath, input.window, input.roi, input.sampleFps, "lifted")
    );
    return buildLaboratoryResponseRegionMetrics(
      parseLaboratoryResponseMetricText(sourceText),
      parseLaboratoryResponseMetricText(edgeText),
      parseLaboratoryResponseMetricText(liftedText)
    );
  }

  async function measureControlPhases(input: {
    controlRoi: LaboratoryNormalizedRoi;
    phases: PhaseWindow[];
    project: ProjectRecord;
    requestId: string;
    runtime: RuntimeRecord;
    sampleFps: number;
    sourcePath: string;
  }) {
    return sequentialMap(input.phases, async function (phase) {
      return {
        phase: phase.phase,
        metrics: await measurePhase({
          project: input.project,
          requestId: input.requestId,
          roi: input.controlRoi,
          runtime: input.runtime,
          sampleFps: input.sampleFps,
          sourcePath: input.sourcePath,
          window: phase,
        }),
      };
    });
  }

  return { measureControlPhases };
}

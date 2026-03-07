import type {
  ProviderSessionPreview,
  ProviderTestResult,
  ProviderTestSlot,
  ProviderTestStep,
  ProviderTestSuite,
  ProviderTestStepStatus,
  TestStatus,
} from "../../../types/provider.ts";

export interface ProviderTestOverlaySurface {
  kind: "overlay" | "side-panel";
  hostSlot: ProviderTestSlot;
  testedSlot: ProviderTestSlot;
}

export interface ProviderTestOverlayHost {
  kind: "overlay";
  hostSlot: "ai1" | "ai2";
  testedSlot: "ai1" | "ai2";
}

export interface ProviderTestSidePanelHost {
  kind: "side-panel";
  hostSlot: "ai0";
  testedSlot: "ai0";
}

export type ProviderTestSurface = ProviderTestOverlayHost | ProviderTestSidePanelHost;

export interface ProviderTestSurfaceLegacy {
  kind: "overlay" | "side-panel";
  hostSlot: ProviderTestSlot;
  testedSlot: ProviderTestSlot;
}

export interface ScenarioProgressSummary {
  title: string;
  completedSteps: number;
  totalSteps: number;
  activeStepId: string | null;
  hasFailures: boolean;
}

export type ScenarioStatusFilter = "all" | TestStatus;

export interface ScenarioStatusCounts {
  all: number;
  pass: number;
  fail: number;
  warning: number;
  skip: number;
}

export interface ScenarioDisplayRow {
  id: string;
  name: string;
  status: ProviderTestStepStatus;
  message: string;
  sessionPreview?: ProviderSessionPreview;
}

export const resolveScenarioSurface = resolveProviderTestSurface;

export function resolveProviderTestSurface(slot: ProviderTestSlot): ProviderTestSurface {
  if (slot === "ai1") {
    return { kind: "overlay", hostSlot: "ai2", testedSlot: slot };
  }
  if (slot === "ai2") {
    return { kind: "overlay", hostSlot: "ai1", testedSlot: slot };
  }
  return { kind: "side-panel", hostSlot: "ai0", testedSlot: slot };
}

export function buildScenarioProgressSummary(input: {
  slot: ProviderTestSlot;
  providerName: string;
  scenarioTitle?: string;
  steps: Array<Pick<ProviderTestStep, "id" | "name" | "status">>;
}): ScenarioProgressSummary {
  const completedSteps = input.steps.filter(
    (step) => step.status !== "pending" && step.status !== "running"
  ).length;
  const activeStep =
    input.steps.find((step) => step.status === "running") ??
    input.steps.find((step) => step.status === "pending") ??
    null;

  return {
    title: `${input.providerName} ${input.scenarioTitle ?? "testi"} calisiyor`,
    completedSteps,
    totalSteps: input.steps.length,
    activeStepId: activeStep?.id ?? null,
    hasFailures: input.steps.some((step) => step.status === "fail"),
  };
}

function toDisplayRow(item: ProviderTestResult | ProviderTestStep): ScenarioDisplayRow {
  const sessionPreview = "details" in item ? item.details?.sessionPreview : undefined;

  return {
    id: item.id,
    name: item.name,
    status: item.status,
    message: item.message ?? "",
    ...(sessionPreview !== undefined ? { sessionPreview } : {}),
  };
}

export function buildScenarioStatusCounts(input: {
  steps: Array<Pick<ProviderTestStep, "status">>;
  suite?: Pick<
    ProviderTestSuite,
    "totalTests" | "passed" | "failed" | "warnings" | "skipped"
  > | null;
}): ScenarioStatusCounts {
  if (input.suite) {
    return {
      all: input.suite.totalTests,
      pass: input.suite.passed,
      fail: input.suite.failed,
      warning: input.suite.warnings,
      skip: input.suite.skipped,
    };
  }

  return {
    all: input.steps.length,
    pass: input.steps.filter((step) => step.status === "pass").length,
    fail: input.steps.filter((step) => step.status === "fail").length,
    warning: input.steps.filter((step) => step.status === "warning").length,
    skip: input.steps.filter((step) => step.status === "skip").length,
  };
}

export function filterScenarioDisplayRows(input: {
  filter: ScenarioStatusFilter;
  steps: ProviderTestStep[];
  suite?: Pick<ProviderTestSuite, "results"> | null;
}): ScenarioDisplayRow[] {
  const rows =
    input.suite && input.suite.results.length > 0
      ? input.suite.results.map((result) => toDisplayRow(result))
      : input.steps.map((step) => toDisplayRow(step));

  if (input.filter === "all") {
    return rows;
  }

  return rows.filter((row) => row.status === input.filter);
}

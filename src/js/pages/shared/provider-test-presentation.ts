import type {
  ProviderScenarioCommandReport,
  ProviderScenarioCommandStatus,
  ProviderSessionPreview,
  ProviderTestSlot,
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
  status: ProviderScenarioCommandStatus;
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

function toDisplayRow(command: ProviderScenarioCommandReport): ScenarioDisplayRow {
  const sessionPreview =
    command.details?.sessionPreview ??
    (typeof command.output === "object" &&
    command.output !== null &&
    "sessionPreview" in command.output
      ? ((command.output as { sessionPreview?: ProviderSessionPreview }).sessionPreview ?? undefined)
      : undefined);

  return {
    id: command.id,
    name: command.name,
    status: command.status,
    message: command.message,
    ...(sessionPreview !== undefined ? { sessionPreview } : {}),
  };
}

export function buildScenarioProgressSummary(input: {
  slot: ProviderTestSlot;
  providerName: string;
  scenarioTitle?: string;
  commands: Array<Pick<ProviderScenarioCommandReport, "id" | "name" | "status">>;
}): ScenarioProgressSummary {
  const completedSteps = input.commands.filter((command) => command.status !== "running").length;
  const activeStep = input.commands.find((command) => command.status === "running") ?? null;

  return {
    title: `${input.providerName} ${input.scenarioTitle ?? "testi"} calisiyor`,
    completedSteps,
    totalSteps: input.commands.length,
    activeStepId: activeStep?.id ?? null,
    hasFailures: input.commands.some((command) => command.status === "fail"),
  };
}

export function buildScenarioStatusCounts(input: {
  commands: Array<Pick<ProviderScenarioCommandReport, "status">>;
}): ScenarioStatusCounts {
  return {
    all: input.commands.length,
    pass: input.commands.filter((command) => command.status === "pass").length,
    fail: input.commands.filter((command) => command.status === "fail").length,
    warning: input.commands.filter((command) => command.status === "warning").length,
    skip: input.commands.filter((command) => command.status === "skip").length,
  };
}

export function buildScenarioCompletionMessage(input: {
  passed?: number;
  totalTests?: number;
  commands?: Array<Pick<ProviderScenarioCommandReport, "status">>;
  aborted?: boolean;
  abortReason?: string;
}): string {
  if (input.aborted === true) {
    return input.abortReason?.trim() !== "" && input.abortReason !== undefined
      ? input.abortReason
      : "Senaryo durduruldu";
  }

  const fallbackCommands = input.commands ?? [];
  const passed =
    typeof input.passed === "number"
      ? input.passed
      : fallbackCommands.filter((command) => command.status === "pass").length;
  const totalTests =
    typeof input.totalTests === "number" ? input.totalTests : fallbackCommands.length;

  if (totalTests <= 0) {
    return "Senaryo tamamlandi";
  }

  return `${passed}/${totalTests} kontrol gecti`;
}

export function filterScenarioDisplayRows(input: {
  filter: ScenarioStatusFilter;
  commands: ProviderScenarioCommandReport[];
}): ScenarioDisplayRow[] {
  const rows = input.commands.map((command) => toDisplayRow(command));

  if (input.filter === "all") {
    return rows;
  }

  return rows.filter((row) => row.status === input.filter);
}

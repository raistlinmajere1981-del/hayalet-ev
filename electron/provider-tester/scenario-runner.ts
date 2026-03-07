import type {
  ProviderScenarioId,
  ProviderScenarioProgressEvent,
  ProviderTestSlot,
  ProviderScenarioStep,
} from "../../src/types/provider.ts";

export const PROVIDER_TEST_PROMPT =
  "Sadece 1'den 20'ye kadar numaralari, her satirda bir tane olacak sekilde yaz. Baska hicbir sey ekleme.";

const MIN_STEP_DELAY_MS = 1_000;

export type ScenarioStepSeverity = "core" | "soft" | "provider";

export interface ScenarioStepResult {
  status: "pass" | "fail" | "skip" | "warning";
  message: string;
}

export interface ScenarioStepDefinition {
  id: string;
  name: string;
  severity: ScenarioStepSeverity;
  delayAfterMs?: number;
  run: () => Promise<ScenarioStepResult>;
}

export interface RunScenarioOptions {
  runId: string;
  scenarioId: ProviderScenarioId;
  slot: ProviderTestSlot;
  providerId: string;
  steps: ScenarioStepDefinition[];
  emitProgress?: (event: ProviderScenarioProgressEvent) => void;
}

export interface RunScenarioResult {
  scenarioId: ProviderScenarioId;
  aborted: boolean;
  abortReason?: string;
  failed: number;
  warnings: number;
  steps: ProviderScenarioStep[];
}

export type RunProviderTestScenarioOptions = Omit<RunScenarioOptions, "scenarioId">;

export type RunProviderTestScenarioResult = RunScenarioResult;

function emit(
  options: RunScenarioOptions,
  type: ProviderScenarioProgressEvent["type"],
  payload: Partial<ProviderScenarioProgressEvent> = {}
): void {
  options.emitProgress?.({
    runId: options.runId,
    scenarioId: options.scenarioId,
    slot: options.slot,
    providerId: options.providerId,
    type,
    timestamp: Date.now(),
    ...payload,
  });
}

async function wait(delayMs: number | undefined): Promise<void> {
  if (typeof delayMs !== "number" || delayMs <= 0) {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

function resolveStepDelay(delayMs: number | undefined): number {
  if (typeof delayMs !== "number" || delayMs <= 0) {
    return MIN_STEP_DELAY_MS;
  }

  return Math.max(MIN_STEP_DELAY_MS, delayMs);
}

export async function runScenario(options: RunScenarioOptions): Promise<RunScenarioResult> {
  const steps: ProviderScenarioStep[] = [];
  let aborted = false;
  let abortReason: string | undefined;

  const runStepAt = async (index: number): Promise<void> => {
    const step = options.steps[index];
    if (step === undefined) {
      return;
    }

    const startedAt = Date.now();
    emit(options, "step-start", {
      stepId: step.id,
      status: "running",
      message: step.name,
    });

    let result: ScenarioStepResult;
    try {
      result = await step.run();
    } catch (error) {
      result = {
        status: "fail",
        message: error instanceof Error ? error.message : String(error),
      };
    }
    const completedAt = Date.now();
    steps.push({
      id: step.id,
      name: step.name,
      status: result.status,
      message: result.message,
      startedAt,
      completedAt,
      duration: completedAt - startedAt,
    });

    emit(options, "step-complete", {
      stepId: step.id,
      status: result.status,
      message: result.message,
    });

    if (step.severity === "core" && result.status === "fail") {
      aborted = true;
      abortReason = result.message;
      return;
    }

    if (options.steps[index + 1] !== undefined) {
      await wait(resolveStepDelay(step.delayAfterMs));
      await runStepAt(index + 1);
    }
  };

  emit(options, "started");

  await runStepAt(0);

  emit(options, "completed", {
    message: abortReason ?? "completed",
  });

  return {
    scenarioId: options.scenarioId,
    aborted,
    ...(abortReason !== undefined ? { abortReason } : {}),
    failed: steps.filter((step) => step.status === "fail").length,
    warnings: steps.filter((step) => step.status === "warning").length,
    steps,
  };
}

export async function runProviderTestScenario(
  options: RunProviderTestScenarioOptions
): Promise<RunProviderTestScenarioResult> {
  return await runScenario({
    scenarioId: "webview-test",
    ...options,
  });
}

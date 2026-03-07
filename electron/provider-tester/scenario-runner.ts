import type {
  ProviderTestProgressEvent,
  ProviderTestSlot,
  ProviderTestStep,
} from "../../src/types/provider.ts";

export const PROVIDER_TEST_PROMPT =
  "Sadece 1'den 20'ye kadar numaralari, her satirda bir tane olacak sekilde yaz. Baska hicbir sey ekleme.";

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

export interface RunProviderTestScenarioOptions {
  runId: string;
  slot: ProviderTestSlot;
  providerId: string;
  steps: ScenarioStepDefinition[];
  emitProgress?: (event: ProviderTestProgressEvent) => void;
}

export interface RunProviderTestScenarioResult {
  aborted: boolean;
  abortReason?: string;
  failed: number;
  warnings: number;
  steps: ProviderTestStep[];
}

function emit(
  options: RunProviderTestScenarioOptions,
  type: ProviderTestProgressEvent["type"],
  payload: Partial<ProviderTestProgressEvent> = {}
): void {
  options.emitProgress?.({
    runId: options.runId,
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

export async function runProviderTestScenario(
  options: RunProviderTestScenarioOptions
): Promise<RunProviderTestScenarioResult> {
  const steps: ProviderTestStep[] = [];
  let aborted = false;
  let abortReason: string | undefined;

  emit(options, "started");

  for (const step of options.steps) {
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
      break;
    }

    await wait(step.delayAfterMs);
  }

  emit(options, "completed", {
    ...(aborted && abortReason !== undefined ? { message: abortReason } : { message: "completed" }),
  });

  return {
    aborted,
    ...(abortReason !== undefined ? { abortReason } : {}),
    failed: steps.filter((step) => step.status === "fail").length,
    warnings: steps.filter((step) => step.status === "warning").length,
    steps,
  };
}

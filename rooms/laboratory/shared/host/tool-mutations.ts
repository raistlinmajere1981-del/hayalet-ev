type LaboratoryRecord = Record<string, unknown>;

type LaboratoryToolEntry = LaboratoryRecord & {
  busy?: boolean;
  lastError?: string | null;
  latestReleaseName?: string | null;
  latestReleaseTag?: string | null;
  latestVersion?: string | null;
  toolId: string;
  updateAvailable?: boolean;
};

type LaboratoryRuntimeWithToolState = LaboratoryRecord & {
  toolState: {
    tools: Record<string, LaboratoryToolEntry | undefined>;
  };
};

type LaboratoryToolMutationResult = {
  tool?: LaboratoryRecord & {
    releaseName?: string | null;
    releaseTag?: string | null;
    version?: string | null;
  };
};

type LaboratoryToolMutationRuntimeDeps = {
  callRoomTools: (payload: {
    featureStage?: string | null;
    jobId: string;
    operation: string;
    requestId: string;
    roomId: string;
    toolId: string;
  }) => Promise<LaboratoryToolMutationResult>;
  clearJob: (runtime: LaboratoryRuntimeWithToolState, jobId: string) => void;
  createDefaultToolEntry: (toolId: string) => LaboratoryToolEntry;
  getRuntimeToolIds: (runtime: LaboratoryRuntimeWithToolState) => string[];
  persistToolState: (runtime: LaboratoryRuntimeWithToolState) => Promise<unknown>;
  pushJobState: (api: unknown, payload: LaboratoryRecord) => void;
  refreshProfileModelState: (runtime: LaboratoryRuntimeWithToolState) => Promise<unknown>;
  registerJob: (runtime: LaboratoryRuntimeWithToolState, options: LaboratoryRecord) => unknown;
  roomId: string;
  toRecord: (value: unknown) => LaboratoryRecord;
};

export function createLaboratoryToolMutationRuntime(deps: LaboratoryToolMutationRuntimeDeps) {
  const {
    callRoomTools,
    clearJob,
    createDefaultToolEntry,
    getRuntimeToolIds,
    persistToolState,
    pushJobState,
    refreshProfileModelState,
    registerJob,
    roomId,
    toRecord,
  } = deps;

  function updateToolBusy(
    runtime: LaboratoryRuntimeWithToolState,
    toolId: string,
    busy: boolean,
    lastError: string | null
  ): void {
    runtime.toolState.tools[toolId] = {
      ...createDefaultToolEntry(toolId),
      ...toRecord(runtime.toolState.tools[toolId]),
      toolId: toolId,
      busy: busy === true,
      lastError: lastError || null,
    };
  }

  async function handleToolMutation(
    api: unknown,
    runtime: LaboratoryRuntimeWithToolState,
    requestId: string,
    action: string,
    toolId: string,
    featureStage: string | null
  ) {
    if (getRuntimeToolIds(runtime).includes(toolId) === false) {
      throw new Error(`Unsupported tool: ${toolId}`);
    }

    const operation = action === "tool-update" ? "tool-update" : "tool-install";
    const jobId = `room-tool-${toolId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    updateToolBusy(runtime, toolId, true, null);
    registerJob(runtime, {
      jobId: jobId,
      requestId: requestId,
      action: action,
      toolId: toolId,
      featureStage: featureStage || "source",
    });

    pushJobState(api, {
      requestId: requestId,
      jobId: jobId,
      action: action,
      toolId: toolId,
      featureStage: featureStage || "source",
      stage: "queued",
    });

    try {
      const result = await callRoomTools({
        operation: operation,
        roomId: roomId,
        requestId: requestId,
        jobId: jobId,
        toolId: toolId,
      });
      const tool = toRecord(result["tool"]);

      runtime.toolState.tools[toolId] = {
        ...createDefaultToolEntry(toolId),
        ...toRecord(runtime.toolState.tools[toolId]),
        ...tool,
        toolId: toolId,
        busy: false,
        lastError: null,
        updateAvailable: false,
        latestVersion: typeof tool["version"] === "string" ? tool["version"] : null,
        latestReleaseTag: typeof tool["releaseTag"] === "string" ? tool["releaseTag"] : null,
        latestReleaseName: typeof tool["releaseName"] === "string" ? tool["releaseName"] : null,
        lastCheckedAt: new Date().toISOString(),
      };

      await persistToolState(runtime);
      if (toolId === "whisper.cpp") {
        await refreshProfileModelState(runtime);
      }
      pushJobState(api, {
        requestId: requestId,
        jobId: jobId,
        action: action,
        toolId: toolId,
        featureStage: featureStage || "source",
        stage: "completed",
        percent: 100,
      });
      return result["tool"];
    } catch (error) {
      updateToolBusy(
        runtime,
        toolId,
        false,
        error instanceof Error ? error.message : String(error)
      );
      await persistToolState(runtime);
      if (toolId === "whisper.cpp") {
        await refreshProfileModelState(runtime);
      }
      pushJobState(api, {
        requestId: requestId,
        jobId: jobId,
        action: action,
        toolId: toolId,
        featureStage: featureStage || "source",
        stage: "failed",
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      clearJob(runtime, jobId);
    }
  }

  return {
    handleToolMutation,
    updateToolBusy,
  };
}

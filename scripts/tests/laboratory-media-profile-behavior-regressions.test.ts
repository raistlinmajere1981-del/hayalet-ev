import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

function extractFunctionSource(source: string, functionName: string): string {
  const marker = `function ${functionName}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `Missing function ${functionName}`);

  let braceIndex = source.indexOf("{", start);
  assert.notEqual(braceIndex, -1, `Missing body for ${functionName}`);

  let depth = 0;
  for (let index = braceIndex; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }

  throw new Error(`Unterminated function ${functionName}`);
}

test("laboratory UI keeps profile stale-response tracking isolated by action domain", () => {
  const coreBootstrapSource = readFileSync("rooms/laboratory/ui/core-bootstrap.ts", "utf8");
  const draftRuntimeSource = readFileSync("rooms/laboratory/shared/ui/draft-runtime.ts", "utf8");
  const requestRuntimeSource = readFileSync(
    "rooms/laboratory/shared/ui/request-runtime.ts",
    "utf8"
  );
  const context = {
    state: {
      ui: {
        requestCounter: 0,
        latestRequestByDomain: {
          project: 0,
          "source-config": 0,
          "source-acquire": 0,
          "edit-config": 0,
          "edit-preview": 0,
          "edit-apply": 0,
          "edit-preview-cancel": 0,
          "edit-apply-cancel": 0,
          "profile-config": 0,
          "profile-run": 0,
          "profile-cancel": 0,
          "profile-model": 0,
          tools: 0,
          misc: 0,
        },
        requestLookup: {},
      },
    },
    sampleJobs: [
      {
        jobId: "run-job",
        requestId: "profile-run-current",
        action: "profile-run-preflight",
        featureStage: "profile",
      },
      {
        jobId: "model-job",
        requestId: "profile-model-current",
        action: "profile-model-install",
        featureStage: "profile",
      },
      {
        jobId: "edit-job",
        requestId: "edit-preview-current",
        action: "edit-preview",
        featureStage: "edit",
      },
    ],
  };

  vm.createContext(context);
  vm.runInContext(
    [
      extractFunctionSource(draftRuntimeSource, "sortStageJobs"),
      extractFunctionSource(coreBootstrapSource, "toRecord"),
      extractFunctionSource(requestRuntimeSource, "getActionDomain"),
      extractFunctionSource(requestRuntimeSource, "rememberRequest"),
      extractFunctionSource(requestRuntimeSource, "shouldIgnoreCorrelatedPayload"),
      extractFunctionSource(draftRuntimeSource, "collectProfileStageJobs"),
    ].join("\n"),
    context
  );

  vm.runInContext(`rememberRequest("profile-run-old", "profile-run-preflight");`, context);
  vm.runInContext(`rememberRequest("profile-run-current", "profile-run-preflight");`, context);
  vm.runInContext(`rememberRequest("profile-model-current", "profile-model-install");`, context);

  assert.equal(
    vm.runInContext(`shouldIgnoreCorrelatedPayload("profile-run-old", "profile-run-preflight")`, context),
    true
  );
  assert.equal(
    vm.runInContext(`shouldIgnoreCorrelatedPayload("profile-run-current", "profile-run-preflight")`, context),
    false
  );
  assert.equal(
    vm.runInContext(`shouldIgnoreCorrelatedPayload("profile-run-current", "profile-model-install")`, context),
    false
  );
  assert.equal(vm.runInContext(`collectProfileStageJobs(sampleJobs).length`, context), 2);
  assert.equal(
    vm.runInContext(`collectProfileStageJobs(sampleJobs)[0].action`, context),
    "profile-run-preflight"
  );
  assert.equal(
    vm.runInContext(`collectProfileStageJobs(sampleJobs)[1].action`, context),
    "profile-model-install"
  );
});

test("laboratory host treats profile preflight and model jobs as action-scoped slots", () => {
  const jobRuntimeSource = readFileSync("rooms/laboratory/shared/host/job-runtime.ts", "utf8");
  const runtimePrimitivesSource = readFileSync(
    "rooms/laboratory/shared/host/runtime-primitives.ts",
    "utf8"
  );
  const context = {
    runtime: {
      jobs: {
        preflightJob: {
          requestId: "req-profile-run",
          action: "profile-run-preflight",
          projectId: "project-1",
        },
        modelJob: {
          requestId: "req-profile-model",
          action: "profile-model-install",
          projectId: "project-1",
        },
      },
    },
  };

  vm.createContext(context);
  vm.runInContext(
    [
      extractFunctionSource(runtimePrimitivesSource, "toLaboratoryRecord").replace(
        /function toLaboratoryRecord/,
        "function toRecord"
      ),
      extractFunctionSource(jobRuntimeSource, "collectJobs"),
      extractFunctionSource(jobRuntimeSource, "getActiveProfileJobs"),
      extractFunctionSource(jobRuntimeSource, "ensureProfileJobSlotAvailable"),
    ].join("\n"),
    context
  );

  assert.equal(
    vm.runInContext(`getActiveProfileJobs(runtime, "project-1", "profile-run-preflight").length`, context),
    1
  );
  assert.equal(
    vm.runInContext(`getActiveProfileJobs(runtime, "project-1", "profile-model-install").length`, context),
    1
  );

  assert.throws(() => {
    vm.runInContext(`ensureProfileJobSlotAvailable(runtime, "project-1", "profile-run-preflight")`, context);
  }, /already running/i);

  assert.equal(
    vm.runInContext(
      `
        const isolatedRuntime = { jobs: { modelOnly: runtime.jobs.modelJob } };
        try {
          ensureProfileJobSlotAvailable(isolatedRuntime, "project-1", "profile-run-preflight");
          "ok";
        } catch (error) {
          error.message;
        }
      `,
      context
    ),
    "ok"
  );
});

test("laboratory UI prefers the active profile target metadata over the source-only summary helpers", () => {
  const helperSource = readFileSync(
    "rooms/laboratory/main-functions/media-analysis/ui/profile-helpers.ts",
    "utf8"
  );
  const context = {
    previewMetrics: {
      url: "file:///derived-preview.mp4",
      duration: 41,
      width: 1024,
      height: 576,
    },
    toRecord(value: unknown) {
      return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    },
  };

  vm.createContext(context);
  vm.runInContext(
    [
      extractFunctionSource(helperSource, "getPreferredAssetDuration"),
      extractFunctionSource(helperSource, "getPreferredAssetResolution"),
      extractFunctionSource(helperSource, "getPreferredAssetCodec"),
    ].join("\n"),
    context
  );

  assert.equal(
    vm.runInContext(
      `getPreferredAssetDuration({ previewUrl: "file:///derived-preview.mp4", metadata: { durationSeconds: 58 } }, previewMetrics, toRecord)`,
      context
    ),
    58
  );
  assert.equal(
    vm.runInContext(
      `getPreferredAssetResolution({ previewUrl: "file:///derived-preview.mp4", metadata: { width: 1920, height: 1080 } }, previewMetrics, toRecord)`,
      context
    ),
    "1920 x 1080"
  );
  assert.equal(
    vm.runInContext(
      `getPreferredAssetCodec({ previewUrl: "file:///derived-preview.mp4", metadata: { videoCodec: "h264" } }, toRecord)`,
      context
    ),
    "h264"
  );
});

test("laboratory host resolves derived profile targets with safe fallback when the pin is stale", () => {
  const profileProjectionSource = readFileSync(
    "rooms/laboratory/main-functions/media-analysis/host/profile-projection.ts",
    "utf8"
  );
  const context = {
    toRecord(value: unknown) {
      return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    },
    asNonEmptyString(value: unknown) {
      return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
    },
    asNumber(value: unknown) {
      return typeof value === "number" && Number.isFinite(value) ? value : null;
    },
    normalizeSourceMetadata(value: unknown) {
      return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    },
    buildSourceTargetSignature() {
      return "source-sig";
    },
    buildDerivedTargetSignature() {
      return "derived-sig";
    },
    findEditOutputById(project: any, outputId: string | null) {
      if (!outputId) {
        return null;
      }
      return (Array.isArray(project.edit?.outputs) ? project.edit.outputs : []).find((entry: any) => entry.id === outputId) ?? null;
    },
    normalizeEditOutput(entry: any) {
      return entry;
    },
  };

  vm.createContext(context);
  vm.runInContext(extractFunctionSource(profileProjectionSource, "resolveProfileTarget"), context);

  assert.equal(
    vm.runInContext(
      `
        const result = resolveProfileTarget({
          name: "Project",
          source: {
            storedPath: "/project/source.mp4",
            storedFileName: "source.mp4",
            mimeType: "video/mp4",
            metadata: { durationSeconds: 20 }
          },
          edit: { outputs: [] },
          profile: { targetAssetMode: "derived", targetOutputId: "missing-output" }
        });
        JSON.stringify(result);
      `,
      context
    ),
    JSON.stringify({
      requestedMode: "derived",
      mode: "source",
      outputId: "missing-output",
      path: "/project/source.mp4",
      fileName: "source.mp4",
      mimeType: "video/mp4",
      metadata: { durationSeconds: 20 },
      signature: "source-sig",
      label: "source.mp4",
      usingFallback: true,
      reason: "Pinned derived output is unavailable. Falling back to the saved source.",
    })
  );
});

test("laboratory host readiness blocks missing targets and surfaces model-compatibility warnings", () => {
  const profileProjectionSource = readFileSync(
    "rooms/laboratory/main-functions/media-analysis/host/profile-projection.ts",
    "utf8"
  );
  const context = {
    toRecord(value: unknown) {
      return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    },
    asNonEmptyString(value: unknown) {
      return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
    },
    clone(value: unknown) {
      return JSON.parse(JSON.stringify(value));
    },
    resolveProfileTarget(project: any) {
      return project.__target;
    },
    getCompatibleProfileLaneIds() {
      return ["speech-overlay"];
    },
    getProfileLaneMap() {
      return {
        "speech-overlay": {
          labelKey: "lane.speech",
          summaryKey: "lane.summary",
          requiredTools: ["ffmpeg"],
          optionalTools: ["whisper.cpp"],
          artifactKinds: ["transcript"],
        },
      };
    },
    buildProfileModelSummary() {
      return [
        {
          modelId: "tiny.en",
          selected: true,
          ready: false,
          runtimeCompatible: false,
          compatibilityReason: "This model is not declared for linux-x64.",
        },
      ];
    },
    buildProfileToolSummary(runtime: any, toolId: string) {
      if (toolId === "ffmpeg") {
        return { toolId, displayName: "FFmpeg", ready: true };
      }
      return { toolId, displayName: "Whisper.cpp", ready: true };
    },
    getToolManifest() {
      return {};
    },
    getStageSupport() {
      return "required";
    },
  };

  vm.createContext(context);
  vm.runInContext(extractFunctionSource(profileProjectionSource, "buildProfileReadiness"), context);

  const blockedResult = JSON.parse(
    vm.runInContext(
      `
        JSON.stringify(
          buildProfileReadiness(
            { profilePresets: {}, toolState: {}, profileModelState: {}, profileModels: {} },
            {
              source: { kind: "video" },
              profile: { laneSelection: { "speech-overlay": true } },
              __target: {
                requestedMode: "source",
                mode: "source",
                outputId: null,
                path: null,
                label: "source.mp4",
                metadata: {},
                usingFallback: false,
                reason: null
              }
            }
          )
        )
      `,
      context
    )
  );

  assert.equal(blockedResult.stageReady, false);
  assert.match(blockedResult.blockers[0], /Prepare a source or derived output/i);

  const warningResult = JSON.parse(
    vm.runInContext(
      `
        JSON.stringify(
          buildProfileReadiness(
            { profilePresets: {}, toolState: {}, profileModelState: {}, profileModels: {} },
            {
              source: { kind: "video" },
              profile: { laneSelection: { "speech-overlay": true } },
              __target: {
                requestedMode: "derived",
                mode: "source",
                outputId: "stale-output",
                path: "/project/source.mp4",
                label: "source.mp4",
                metadata: {},
                usingFallback: true,
                reason: "Pinned derived output is unavailable. Falling back to the saved source."
              }
            }
          )
        )
      `,
      context
    )
  );

  assert.equal(warningResult.stageReady, true);
  assert.ok(
    warningResult.warnings.includes("Pinned derived output is unavailable. Falling back to the saved source.")
  );
  assert.ok(warningResult.warnings.includes("This model is not declared for linux-x64."));
});

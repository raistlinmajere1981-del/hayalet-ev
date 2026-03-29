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

test("laboratory UI keeps preview/apply stale-response tracking isolated by action domain", () => {
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
          tools: 0,
          misc: 0,
        },
        requestLookup: {},
      },
    },
    sampleJobs: [
      {
        jobId: "apply-job",
        requestId: "apply-current",
        action: "edit-apply",
        featureStage: "edit",
      },
      {
        jobId: "preview-job",
        requestId: "preview-current",
        action: "edit-preview",
        featureStage: "edit",
      },
      {
        jobId: "tool-job",
        requestId: "tool-current",
        action: "tool-install",
        featureStage: "source",
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
      extractFunctionSource(draftRuntimeSource, "collectEditStageJobs"),
    ].join("\n"),
    context
  );

  vm.runInContext(`rememberRequest("preview-old", "edit-preview");`, context);
  vm.runInContext(`rememberRequest("apply-current", "edit-apply");`, context);
  vm.runInContext(`rememberRequest("preview-current", "edit-preview");`, context);

  assert.equal(
    vm.runInContext(`shouldIgnoreCorrelatedPayload("preview-old", "edit-preview")`, context),
    true
  );
  assert.equal(
    vm.runInContext(`shouldIgnoreCorrelatedPayload("apply-current", "edit-apply")`, context),
    false
  );
  assert.equal(
    vm.runInContext(`shouldIgnoreCorrelatedPayload("apply-current", "edit-preview")`, context),
    false
  );
  assert.equal(
    vm.runInContext(`collectEditStageJobs(sampleJobs).length`, context),
    2
  );
  assert.equal(
    vm.runInContext(`collectEditStageJobs(sampleJobs)[0].action`, context),
    "edit-preview"
  );
  assert.equal(
    vm.runInContext(`collectEditStageJobs(sampleJobs)[1].action`, context),
    "edit-apply"
  );
});

test("laboratory host treats preview/apply edit jobs as action-scoped slots", () => {
  const jobRuntimeSource = readFileSync("rooms/laboratory/shared/host/job-runtime.ts", "utf8");
  const runtimePrimitivesSource = readFileSync(
    "rooms/laboratory/shared/host/runtime-primitives.ts",
    "utf8"
  );
  const context = {
    runtime: {
      jobs: {
        previewJob: {
          requestId: "req-preview",
          action: "edit-preview",
          projectId: "project-1",
        },
        applyJob: {
          requestId: "req-apply",
          action: "edit-apply",
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
      extractFunctionSource(jobRuntimeSource, "getActiveEditJobs"),
      extractFunctionSource(jobRuntimeSource, "ensureEditJobSlotAvailable"),
    ].join("\n"),
    context
  );

  assert.equal(
    vm.runInContext(`getActiveEditJobs(runtime, "project-1", "edit-preview").length`, context),
    1
  );
  assert.equal(
    vm.runInContext(`getActiveEditJobs(runtime, "project-1", "edit-apply").length`, context),
    1
  );

  assert.throws(() => {
    vm.runInContext(`ensureEditJobSlotAvailable(runtime, "project-1", "edit-preview")`, context);
  }, /already running/i);

  assert.equal(
    vm.runInContext(
      `
        const isolatedRuntime = { jobs: { applyOnly: runtime.jobs.applyJob } };
        try {
          ensureEditJobSlotAvailable(isolatedRuntime, "project-1", "edit-preview");
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

import assert from "node:assert/strict";
import test from "node:test";
import {
  materializeFateKnotsWorldForgeAssets,
  planFateKnotsAssetMaterialization,
} from "../../rooms/game-room/main-functions/fate-knots/forge/materializer.ts";
import type { FateKnotsWorldForgeDraft } from "../../rooms/game-room/main-functions/fate-knots/forge/world-forge.ts";

const draft = {
  requestId: "forge-resume",
  assetPlans: [
    ...Array.from({ length: 4 }, (_, i) => ({
      assetId: "portrait-" + i,
      kind: "portrait",
      prompt: "portrait " + i,
      aspectRatio: "1:1",
      batchGroup: "group",
    })),
    { assetId: "map", kind: "map", prompt: "map", aspectRatio: "1:1" },
  ],
} as unknown as FateKnotsWorldForgeDraft;
const asset = (assetId: string) => ({
  assetId,
  path: "/managed/" + assetId + ".png",
  mimeType: "image/png",
});
void test("resume skips completed sheets, retries only missing singles and checkpoints each job", async () => {
  const calls: string[] = [];
  const checkpoints: number[] = [];
  const retained = {
    assets: draft.assetPlans.slice(0, 4).map((x) => asset(x.assetId)),
    sourceArtifacts: [
      { jobId: "forge-resume:sheet:1", path: "/managed/source.png", mimeType: "image/png" },
    ],
  };
  const result = await materializeFateKnotsWorldForgeAssets(
    draft,
    {
      async materialize(job) {
        calls.push(job.jobId);
        assert.equal(job.kind, "single");
        return { assets: [asset("map")] };
      },
    },
    {
      retained,
      onCheckpoint: async (result) => {
        checkpoints.push(result.assets.length);
      },
    }
  );
  assert.deepEqual(calls, ["forge-resume:single:1:map"]);
  assert.deepEqual(checkpoints, [4, 5]);
  assert.equal(result.complete, true);
  assert.deepEqual(result.assets.slice(0, 4), retained.assets);
  assert.deepEqual(result.sourceArtifacts, retained.sourceArtifacts);
});
void test("partially saved sheets retry only missing cells", async () => {
  const calls: string[] = [];
  const retained = {
    assets: [asset("portrait-0"), asset("portrait-2"), asset("map")],
    sourceArtifacts: [],
  };
  const result = await materializeFateKnotsWorldForgeAssets(
    draft,
    {
      async materialize(job) {
        assert.equal(job.kind, "single");
        if (job.kind !== "single") throw Error("unexpected sheet");
        calls.push(job.plan.assetId);
        return { assets: [asset(job.plan.assetId)] };
      },
    },
    { retained }
  );
  assert.deepEqual(calls, ["portrait-1", "portrait-3"]);
  assert.equal(result.complete, true);
});
void test("failed jobs retain successful assets and checkpoint failures", async () => {
  const counts: number[] = [];
  const result = await materializeFateKnotsWorldForgeAssets(
    draft,
    {
      async materialize(job) {
        if (job.kind === "single") throw Error("provider unavailable");
        return { assets: job.plans.map((plan) => asset(plan.assetId)) };
      },
    },
    {
      onCheckpoint: async (s) => {
        counts.push(s.assets.length);
      },
    }
  );
  assert.equal(result.complete, false);
  assert.equal(result.assets.length, 4);
  assert.deepEqual(result.failures[0]?.assetIds, ["map"]);
  assert.deepEqual(counts, [0, 4, 4]);
});
void test("a checkpoint write failure stops further provider calls", async () => {
  let calls = 0;
  let writes = 0;
  await assert.rejects(
    materializeFateKnotsWorldForgeAssets(
      draft,
      {
        async materialize(job) {
          calls++;
          return {
            assets: (job.kind === "sheet" ? job.plans : [job.plan]).map((p) => asset(p.assetId)),
          };
        },
      },
      {
        onCheckpoint: async () => {
          if (++writes === 2) throw Error("disk unavailable");
        },
      }
    ),
    /disk unavailable/
  );
  assert.equal(calls, 1);
});
void test("fully retained draft does not call the image provider", async () => {
  assert.equal(planFateKnotsAssetMaterialization(draft).length, 2);
  const result = await materializeFateKnotsWorldForgeAssets(
    draft,
    {
      async materialize() {
        throw Error("must not generate");
      },
    },
    { retained: { assets: draft.assetPlans.map((p) => asset(p.assetId)), sourceArtifacts: [] } }
  );
  assert.equal(result.complete, true);
});

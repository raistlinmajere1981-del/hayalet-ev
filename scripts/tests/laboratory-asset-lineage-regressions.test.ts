import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSourceLabAsset,
  createLabOutputAsset,
  normalizeLabAsset,
  serializeLabAssetForSnapshot,
} from "../../rooms/laboratory/shared/host/lab-assets.ts";

test("laboratory asset normalization and serialization preserve lineage fields", () => {
  const rawAsset = {
    id: "asset-audio-1",
    type: "audio",
    name: "audio.wav",
    localPath: "/tmp/audio.wav",
    createdAt: 100,
    sourceId: "source-active",
    derivedFromAssetId: "source-active",
    derivedFromSourceId: "source-active",
    metadata: {
      durationMs: 1400,
      startOffsetMs: 0,
    },
  };

  const normalized = normalizeLabAsset(rawAsset);
  assert.equal(normalized?.derivedFromAssetId, "source-active");
  assert.equal(normalized?.derivedFromSourceId, "source-active");

  const serialized = serializeLabAssetForSnapshot(rawAsset, function (path) {
    return `file://${String(path)}`;
  });
  assert.equal(serialized?.url, "file:///tmp/audio.wav");
  assert.equal(serialized?.derivedFromAssetId, "source-active");
  assert.equal(serialized?.derivedFromSourceId, "source-active");
});

test("laboratory output asset creation accepts top-level lineage fields", () => {
  const createdAsset = createLabOutputAsset(
    {
      id: "project-lineage",
      source: {
        kind: "video",
        storedPath: "/tmp/source.mp4",
      },
    },
    {
      type: "audio",
      localPath: "/tmp/audio.wav",
      derivedFromAssetId: "source-active",
      derivedFromSourceId: "source-active",
      metadata: {
        durationMs: 1400,
      },
    }
  );

  assert.equal(createdAsset.derivedFromAssetId, "source-active");
  assert.equal(createdAsset.derivedFromSourceId, "source-active");
  assert.equal(typeof createdAsset.sourceId, "string");
  assert.equal((createdAsset.sourceId || "").startsWith("source-"), true);
});

test("laboratory source asset projection lifts lineage from source metadata", () => {
  const sourceAsset = buildSourceLabAsset({
    id: "project-reuse",
    createdAt: "2026-04-23T18:30:00.000Z",
    source: {
      kind: "video",
      storedPath: "/tmp/project/source/clip_01.mp4",
      storedFileName: "clip_01.mp4",
      mode: "local",
      metadata: {
        derivedFromAssetId: "asset-local-clip",
        derivedFromSourceId: "source-1",
        extractedAt: "2026-04-23T18:31:00.000Z",
      },
    },
  });

  assert.equal(sourceAsset?.derivedFromAssetId, "asset-local-clip");
  assert.equal(sourceAsset?.derivedFromSourceId, "source-1");
});

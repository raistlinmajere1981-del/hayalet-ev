import type { World } from "./world.ts";

export function createFixture(): World {
  return {
    schemaVersion: 1,
    id: "demo",
    revision: 7,
    nodes: {
      plot: {
        kind: "site",
        name: "Deney arazisi",
        parent: null,
        p: [0, 0, 0],
        yaw: 0,
        geometry: {
          kind: "footprint",
          ring: [
            [0, 0],
            [40, 0],
            [40, 60],
            [0, 60],
          ],
        },
      },
      glass: { kind: "building", name: "Sera", parent: "plot", p: [12, 14, 0], yaw: 90 },
      ground: {
        kind: "floor",
        name: "Yetiştirme",
        parent: "glass",
        p: [0, 0, 0],
        yaw: 0,
        level: 0,
      },
      partition: {
        kind: "object",
        name: "Bölme",
        role: "wall",
        parent: "ground",
        p: [-4, 0, 0],
        yaw: 0,
        geometry: { kind: "wall", length: 3, thickness: 0.12, height: 2.4 },
        basis: "measured",
        surveyMark: "W-17",
      },
      bench: {
        kind: "object",
        name: "Çalışma masası",
        role: "table",
        parent: "ground",
        p: [2, 1, 0],
        yaw: 30,
        geometry: { kind: "box", size: [1.2, 0.6, 0.8] },
        zoneIds: ["bed"],
        basis: "estimated",
        inventory: { loadKg: 40 },
      },
      bed: {
        kind: "zone",
        name: "Fide bölgesi",
        parent: "ground",
        p: [0, 0, 0],
        yaw: 0,
        geometry: {
          kind: "footprint",
          ring: [
            [-4, -3],
            [4, -3],
            [4, 3],
            [-4, 3],
          ],
        },
      },
      mc2: {
        kind: "mount",
        name: "Nem sensörü noktası",
        parent: "ground",
        p: [1, 1, 0.4],
        yaw: 0,
        geometry: { kind: "point" },
        zoneIds: ["bed"],
      },
    },
    devices: {
      c2: {
        role: "sensor",
        source: "virtual",
        mount: "mc2",
        capabilities: ["humidity.read.v1"],
        displayUnit: "%",
      },
    },
    assets: {},
    references: {},
    survey: { source: "synthetic", tags: ["02-A/1"] },
  };
}

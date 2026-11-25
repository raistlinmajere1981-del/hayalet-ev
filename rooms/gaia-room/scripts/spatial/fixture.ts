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

export function createSiteFixture(): World {
  const world = createFixture();
  const nodes = world.nodes;
  nodes["glass"]!.geometry = { kind: "box", size: [12, 8, 6] };
  nodes["mc2"]!.parent = "bed";
  nodes["mc2"]!.zoneIds = ["bed", "yard"];
  nodes["mc2"]!.name = "Yatak izleme";
  Object.assign(nodes, {
    coop: {
      kind: "building",
      name: "Kümes",
      parent: "plot",
      p: [28, 38, 0],
      yaw: 0,
      geometry: { kind: "box", size: [6, 4, 2.8] },
    },
    cellar: {
      kind: "floor",
      name: "Teknik bodrum",
      parent: "glass",
      level: -1,
      p: [0, 0, -3],
      yaw: 0,
      geometry: { kind: "box", size: [12, 8, 3] },
    },
    upper: { kind: "floor", name: "Fide katı", parent: "glass", level: 1, p: [0, 0, 3], yaw: 0 },
    yard: {
      kind: "zone",
      name: "Bakım alanı",
      parent: "plot",
      p: [0, 0, 0],
      yaw: 0,
      geometry: {
        kind: "footprint",
        ring: [
          [8, 10],
          [31, 10],
          [31, 40],
          [8, 40],
        ],
      },
    },
    tank: {
      kind: "object",
      role: "waterTank",
      name: "Su deposu",
      parent: "plot",
      p: [10, 12, -3],
      yaw: 0,
      geometry: { kind: "cylinder", radius: 1, height: 2 },
    },
    pipe: {
      kind: "route",
      role: "water",
      name: "Depo çıkış hattı",
      parent: "plot",
      p: [0, 0, 0],
      yaw: 0,
      zoneIds: ["yard", "bed"],
      geometry: {
        kind: "path",
        vertices: [
          [10, 12, -2],
          [13, 16, -2],
          [13, 16, 1],
        ],
      },
    },
    cable: {
      kind: "route",
      role: "electricity",
      name: "Kümes beslemesi",
      parent: "plot",
      p: [0, 0, 0],
      yaw: 0,
      zoneIds: ["yard", "bed"],
      geometry: {
        kind: "path",
        vertices: [
          [12, 14, 0.5],
          [12, 14, -0.6],
          [28, 38, -0.6],
          [28, 38, 1.2],
        ],
      },
    },
  } satisfies World["nodes"]);
  const mounts = [
    ["mr1", "Sera ağ noktası", "upper", [1, 1, 1.8], "r1", "router", "link.status.v1"],
    ["mr2", "Kümes ağ noktası", "coop", [0, 0, 2], "r2", "router", "link.status.v1"],
    ["mc1", "Bodrum", "cellar", [2, 1, 1], "c1", "client", "temperature.read.v1"],
    ["mc3", "Üst kat", "upper", [-1, 2, 0.8], "c3", "client", "temperature.read.v1"],
    ["mc4", "Su seviyesi", "plot", [10, 12, -1.5], "c4", "client", "level.read.v1"],
    ["mc5", "Kümes içi", "coop", [1, 0, 0.6], "c5", "client", "temperature.read.v1"],
  ] as const;
  for (const [id, name, parent, p, device, role, capability] of mounts) {
    nodes[id] = { kind: "mount", name, parent, p: [...p], yaw: 0, geometry: { kind: "point" } };
    world.devices[device] = { role, source: "virtual", mount: id, capabilities: [capability] };
  }
  world.devices["c2"]!.role = "client";
  world["survey"] = { source: "synthetic", tags: ["02-A/3"] };
  return world;
}

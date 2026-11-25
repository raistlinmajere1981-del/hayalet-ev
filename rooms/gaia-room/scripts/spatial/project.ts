import { createFixture } from "./fixture.ts";
import type { World } from "./world.ts";

export const referencePng =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNQSPAAAAFsAMl2ukAnAAAAAElFTkSuQmCC";

export function newProject(id: string, fixture: boolean, locale: string): World {
  if (fixture) {
    const world = createFixture();
    world.id = id;
    world.assets["sample-pixel"] = { mime: "image/png", pixels: [1, 1] };
    world.references["sample-reference"] = { frame: "plot", asset: "sample-pixel", opacity: 1 };
    return world;
  }
  const site = crypto.randomUUID();
  const building = crypto.randomUUID();
  const tr = locale === "tr";
  return {
    schemaVersion: 1,
    revision: 0,
    id,
    devices: {},
    assets: {},
    references: {},
    nodes: {
      [site]: {
        kind: "site",
        name: tr ? "Arazi" : "Site",
        parent: null,
        p: [0, 0, 0],
        yaw: 0,
        basis: "estimated",
        geometry: {
          kind: "footprint",
          ring: [
            [0, 0],
            [10, 0],
            [10, 10],
            [0, 10],
          ],
        },
      },
      [building]: {
        kind: "building",
        name: tr ? "Yapı" : "Building",
        parent: site,
        p: [0, 0, 0],
        yaw: 0,
      },
      [crypto.randomUUID()]: {
        kind: "floor",
        name: tr ? "Zemin kat" : "Ground floor",
        level: 0,
        parent: building,
        p: [0, 0, 0],
        yaw: 0,
      },
    },
  };
}

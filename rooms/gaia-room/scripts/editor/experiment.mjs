import { mount } from "svelte";
import Workshop from "./Workshop.svelte";
import { createFixture } from "../spatial/fixture.ts";
import { applyTrusted } from "../storage/batch.ts";

export function mountExperiment(target) {
  let world = createFixture();
  if (new globalThis.URLSearchParams(globalThis.location.search).get("fixture") === "two-floors")
    world.nodes.upper = {
      kind: "floor",
      name: "Fide katı",
      parent: "glass",
      level: 1,
      p: [0.5, -1, 3],
      yaw: 25,
    };
  const open = () => ({
    world,
    building: "glass",
    session: globalThis.crypto.randomUUID(),
    missing: [],
  });
  mount(Workshop, {
    target,
    props: {
      initial: open(),
      storage: {
        async save(batch) {
          world = applyTrusted(world, batch);
          return { world, missing: [] };
        },
        async reopen() {
          return open();
        },
      },
    },
  });
}

import type { Id, SpatialNode, World } from "../../spatial/world.ts";
import { spatialScene } from "./scene.ts";

export type LayerKind = SpatialNode["kind"] | "device";

export interface RevealState {
  visible: boolean;
  hidden: ReadonlySet<Id>;
  hiddenKinds: ReadonlySet<LayerKind>;
  underground: boolean;
}

export interface RevealResult {
  revealed: boolean;
  hidden: ReadonlySet<Id>;
  hiddenKinds: ReadonlySet<LayerKind>;
  underground: boolean;
}

// Selection from the inventory may target a device whose mount, ancestor floor or layer kind is
// filtered. Reveal exactly that path without clearing unrelated filters; underground floors become
// reachable only when the scene still cannot produce the target after clearing the path.
export function revealSelection(world: World, id: Id, state: RevealState): RevealResult {
  if (state.visible)
    return {
      revealed: false,
      hidden: state.hidden,
      hiddenKinds: state.hiddenKinds,
      underground: state.underground,
    };

  const mount = world.devices[id]?.mount;
  const node = mount ?? id;
  const hidden = new Set(state.hidden);
  for (let cursor: Id | null = node; cursor; cursor = world.nodes[cursor]?.parent ?? null)
    hidden.delete(cursor);

  const hiddenKinds = new Set(state.hiddenKinds);
  const kind = mount ? "device" : world.nodes[id]?.kind;
  if (kind) hiddenKinds.delete(kind);

  const underground =
    state.underground ||
    !spatialScene(world, hidden, state.underground).some((item) => item.id === node);
  return { revealed: true, hidden, hiddenKinds, underground };
}

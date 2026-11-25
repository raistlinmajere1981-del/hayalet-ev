import { untrack } from "svelte";
import type { ReferencePreview } from "../storage/reference-contract.ts";
import type { Id } from "../spatial/world.ts";
import { command } from "./client.ts";

export function referenceImages(request: () => { project: Id; session: string; assets: Id[] }) {
  let sources = $state.raw(new Map<Id, string | null>());
  let session = "";
  const pending = new Map<Id, object>();
  $effect(() => {
    const next = request();
    const keys = new Set(next.assets);
    if (session !== next.session) {
      session = next.session;
      pending.clear();
      sources = new Map();
    }
    const prior = untrack(() => sources);
    for (const id of pending.keys()) if (!keys.has(id)) pending.delete(id);
    if ([...prior.keys()].some((id) => !keys.has(id)))
      sources = new Map([...prior].filter(([id]) => keys.has(id)));
    for (const asset of keys) {
      if (prior.has(asset) || pending.has(asset)) continue;
      const token = {};
      pending.set(asset, token);
      const finish = (source: string | null) => {
        if (pending.get(asset) !== token) return;
        pending.delete(asset);
        sources = new Map(sources).set(asset, source);
      };
      void command<ReferencePreview>("GaiaReference", {
        project: next.project,
        session: next.session,
        asset,
      }).then(
        ({ mime, image }) => finish(`data:${mime};base64,${image}`),
        () => finish(null)
      );
    }
  });
  $effect(() => () => pending.clear());
  return (asset: Id) => sources.get(asset);
}

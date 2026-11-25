import { applySiteEdits, type SiteEdit } from "../../spatial/site-edits.ts";
import type { World } from "../../spatial/world.ts";

export interface DraftCommit {
  world: World;
  edits: SiteEdit[];
}

function sharesSavedInventory(candidate: World, saved: World): boolean {
  return (
    JSON.stringify(candidate.nodes) === JSON.stringify(saved.nodes) &&
    JSON.stringify(candidate.devices) === JSON.stringify(saved.devices)
  );
}

// Draft history is only meaningful while it differs from the saved inventory. Returning to the
// saved nodes and devices must also drop the history so a later save cannot replay a removed edit.
export function commitDraft(
  saved: World,
  current: World,
  history: SiteEdit[],
  changes: SiteEdit[]
): DraftCommit {
  const candidate = applySiteEdits(current, changes);
  if (candidate === current) return { world: current, edits: history };
  if (sharesSavedInventory(candidate, saved)) return { world: saved, edits: [] };
  return { world: candidate, edits: [...history, ...changes] };
}

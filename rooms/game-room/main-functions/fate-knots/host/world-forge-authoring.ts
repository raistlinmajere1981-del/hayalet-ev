import type { GameRoomHostApi } from "../../../shared/host/activation.js";
import { buildFateKnotsWorldForgeAuthoringPrompt } from "../forge/authoring-prompt.js";
import {
  validateFateKnotsPlayableUniverse,
  type FateKnotsPlayabilityIssue,
} from "../forge/playability-validation.js";
import {
  validateFateKnotsWorldForgeDraftResponse,
  type FateKnotsWorldForgeDraft,
  type FateKnotsWorldForgeIssue,
  type FateKnotsWorldForgeRequest,
} from "../forge/world-forge.js";
import {
  validateFateKnotsCardArtBindings,
  type FateKnotsCardArtIssue,
} from "../shared/card-art.js";
import type { FateKnotsForgeAuthoringProvider } from "./forge-provider-policy.js";
import {
  dispatchFateKnotsForgeProviderJsonPrompt,
  openFateKnotsForgeProviderSession,
} from "./forge-provider-transport.js";
import { clearFateKnotsForgeSession, setFateKnotsForgeSession } from "./session-state.js";
import type { FateKnotsTransportApi } from "./transport.js";

export type FateKnotsWorldForgeAuthoringIssue =
  FateKnotsWorldForgeIssue | FateKnotsPlayabilityIssue | FateKnotsCardArtIssue;

export type FateKnotsWorldForgeAuthoringResult =
  | {
      ok: true;
      draft: FateKnotsWorldForgeDraft;
    }
  | {
      ok: false;
      code:
        | "session-open-failed"
        | "provider-failed"
        | "draft-invalid"
        | "universe-not-playable"
        | "card-art-invalid";
      message: string;
      issues?: FateKnotsWorldForgeAuthoringIssue[];
    };

export function validateAuthoredFateKnotsDraft(
  request: FateKnotsWorldForgeRequest,
  candidate: unknown
): FateKnotsWorldForgeAuthoringResult {
  const validated = validateFateKnotsWorldForgeDraftResponse(request, candidate);
  if (!validated.ok || !validated.draft) {
    return {
      ok: false,
      code: "draft-invalid",
      message: "Evren taslağı doğrulanamadı.",
      issues: validated.issues,
    };
  }
  const playable = validateFateKnotsPlayableUniverse(validated.draft.universe);
  if (!playable.valid) {
    return {
      ok: false,
      code: "universe-not-playable",
      message: "Evrenin oynanabilirlik kuralları doğrulanamadı.",
      issues: playable.issues,
    };
  }
  const cardArtIssues = validateFateKnotsCardArtBindings(validated.draft.universe);
  if (cardArtIssues.length > 0) {
    return {
      ok: false,
      code: "card-art-invalid",
      message: "Kart ve görsel ilişkileri doğrulanamadı.",
      issues: cardArtIssues,
    };
  }
  return { ok: true, draft: validated.draft };
}

export async function authorFateKnotsWorldForgeDraft(
  api: GameRoomHostApi & FateKnotsTransportApi,
  request: FateKnotsWorldForgeRequest,
  options: { provider?: FateKnotsForgeAuthoringProvider; onRepair?: () => void } = {}
): Promise<FateKnotsWorldForgeAuthoringResult> {
  const provider = options.provider ?? "ai1";
  const opened = await openFateKnotsForgeProviderSession(
    api,
    provider,
    `Fate Knots World Forge · ${request.universeId}`
  );
  if (!opened.ok) return { ok: false, code: "session-open-failed", message: opened.message };

  let sessionRef = opened.sessionRef;
  setFateKnotsForgeSession(api, request.requestId, sessionRef);
  try {
    const transported = await dispatchFateKnotsForgeProviderJsonPrompt(
      api,
      provider,
      buildFateKnotsWorldForgeAuthoringPrompt(request),
      { sessionRef, timeoutMs: 10 * 60_000 }
    );
    if (!transported.ok)
      return { ok: false, code: "provider-failed", message: transported.message };
    sessionRef = transported.sessionRef ?? sessionRef;
    setFateKnotsForgeSession(api, request.requestId, sessionRef);
    const initial = validateAuthoredFateKnotsDraft(request, transported.value);
    if (initial.ok) return initial;
    // One bounded correction in the same confirmed conversation, not a new
    // universe and never an unbounded retry or a different provider.
    if (!(sessionRef.conversationId || sessionRef.threadId || sessionRef.id)) return initial;
    const repairRef = { ...sessionRef };
    delete repairRef.openHint;
    options.onRepair?.();
    const repaired = await dispatchFateKnotsForgeProviderJsonPrompt(
      api,
      provider,
      [
        "Correct your immediately preceding World Forge JSON using the engine validation errors below.",
        "Keep requestId, universeId, createdAt, existing story, IDs, and unrelated fields unchanged.",
        "Return the COMPLETE corrected JSON object, no markdown or commentary.",
        "music.stateCueIds is an object; use {} when no audio cues exist. card.presentation is an array.",
        JSON.stringify(initial.issues ?? []),
      ].join("\n"),
      { sessionRef: repairRef, timeoutMs: 10 * 60_000 }
    );
    if (!repaired.ok)
      return {
        ...initial,
        message: initial.message + " Düzeltme yanıtı alınamadı: " + repaired.message,
      };
    const checked = validateAuthoredFateKnotsDraft(request, repaired.value);
    if (!checked.ok)
      return {
        ...checked,
        message: checked.message + " Bir düzeltme turu tamamlandı ancak hatalar kaldı.",
      };
    return checked;
  } finally {
    clearFateKnotsForgeSession(api);
  }
}

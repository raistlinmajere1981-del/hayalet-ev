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

export async function authorFateKnotsWorldForgeDraft(
  api: GameRoomHostApi & FateKnotsTransportApi,
  request: FateKnotsWorldForgeRequest,
  options: { provider?: FateKnotsForgeAuthoringProvider } = {}
): Promise<FateKnotsWorldForgeAuthoringResult> {
  const provider = options.provider ?? "ai1";
  const opened = await openFateKnotsForgeProviderSession(
    api,
    provider,
    `Fate Knots World Forge · ${request.universeId}`
  );
  if (!opened.ok) {
    return { ok: false, code: "session-open-failed", message: opened.message };
  }

  setFateKnotsForgeSession(api, request.requestId, opened.sessionRef);
  const transported = await dispatchFateKnotsForgeProviderJsonPrompt(
    api,
    provider,
    buildFateKnotsWorldForgeAuthoringPrompt(request),
    { sessionRef: opened.sessionRef, timeoutMs: 10 * 60_000 }
  );
  if (!transported.ok) {
    clearFateKnotsForgeSession(api);
    return { ok: false, code: "provider-failed", message: transported.message };
  }

  if (transported.sessionRef) {
    setFateKnotsForgeSession(api, request.requestId, transported.sessionRef);
  }

  const validated = validateFateKnotsWorldForgeDraftResponse(request, transported.value);
  if (!validated.ok || !validated.draft) {
    clearFateKnotsForgeSession(api);
    return {
      ok: false,
      code: "draft-invalid",
      message: `World Forge draft failed ${validated.issues.length} validation check(s).`,
      issues: validated.issues,
    };
  }

  const playable = validateFateKnotsPlayableUniverse(validated.draft.universe);
  if (!playable.valid) {
    clearFateKnotsForgeSession(api);
    return {
      ok: false,
      code: "universe-not-playable",
      message: `World Forge draft failed ${playable.issues.length} playability check(s).`,
      issues: playable.issues,
    };
  }

  const cardArtIssues = validateFateKnotsCardArtBindings(validated.draft.universe);
  if (cardArtIssues.length > 0) {
    clearFateKnotsForgeSession(api);
    return {
      ok: false,
      code: "card-art-invalid",
      message: `World Forge draft failed ${cardArtIssues.length} card-art binding check(s).`,
      issues: cardArtIssues,
    };
  }

  clearFateKnotsForgeSession(api);
  return { ok: true, draft: validated.draft };
}

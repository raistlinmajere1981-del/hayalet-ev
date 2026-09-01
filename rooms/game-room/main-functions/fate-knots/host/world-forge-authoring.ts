import type { GameRoomHostApi } from "../../../shared/host/activation.js";
import { buildFateKnotsWorldForgeAuthoringPrompt } from "../forge/authoring-prompt.js";
import {
  validateFateKnotsWorldForgeDraftResponse,
  type FateKnotsWorldForgeDraft,
  type FateKnotsWorldForgeIssue,
  type FateKnotsWorldForgeRequest,
} from "../forge/world-forge.js";
import {
  clearFateKnotsForgeSession,
  setFateKnotsForgeSession,
} from "./session-state.js";
import {
  dispatchFateKnotsAi1JsonPrompt,
  openFateKnotsAi1Session,
  type FateKnotsTransportApi,
} from "./transport.js";

export type FateKnotsWorldForgeAuthoringResult =
  | {
      ok: true;
      draft: FateKnotsWorldForgeDraft;
    }
  | {
      ok: false;
      code: "session-open-failed" | "provider-failed" | "draft-invalid";
      message: string;
      issues?: FateKnotsWorldForgeIssue[];
    };

export async function authorFateKnotsWorldForgeDraft(
  api: GameRoomHostApi & FateKnotsTransportApi,
  request: FateKnotsWorldForgeRequest
): Promise<FateKnotsWorldForgeAuthoringResult> {
  const opened = await openFateKnotsAi1Session(
    api,
    `Fate Knots World Forge · ${request.universeId}`
  );
  if (!opened.ok) {
    return { ok: false, code: "session-open-failed", message: opened.message };
  }

  setFateKnotsForgeSession(api, request.requestId, opened.sessionRef);
  const transported = await dispatchFateKnotsAi1JsonPrompt(
    api,
    buildFateKnotsWorldForgeAuthoringPrompt(request),
    { sessionRef: opened.sessionRef, timeoutMs: 10 * 60_000 }
  );
  if (!transported.ok) {
    return { ok: false, code: "provider-failed", message: transported.message };
  }

  if (transported.sessionRef) {
    setFateKnotsForgeSession(api, request.requestId, transported.sessionRef);
  }

  const validated = validateFateKnotsWorldForgeDraftResponse(request, transported.value);
  if (!validated.ok || !validated.draft) {
    return {
      ok: false,
      code: "draft-invalid",
      message: `World Forge draft failed ${validated.issues.length} validation check(s).`,
      issues: validated.issues,
    };
  }

  clearFateKnotsForgeSession(api);
  return { ok: true, draft: validated.draft };
}

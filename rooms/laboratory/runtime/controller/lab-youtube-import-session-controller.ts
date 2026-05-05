import type { createLabStore } from "../lab-store.js";
import {
  buildYoutubeImportCustomPatch,
  buildYoutubeImportPreview,
  normalizeYoutubeImportUrlInput,
} from "./lab-youtube-import-controller.js";

type LabYoutubeImportSessionControllerDeps = {
  dispatch: (event: Parameters<ReturnType<typeof createLabStore>["dispatch"]>[0]) => void;
  store: ReturnType<typeof createLabStore>;
};

const YOUTUBE_IMPORT_PARSE_DELAY_MS = 800;

export function createLabYoutubeImportSessionController(
  deps: LabYoutubeImportSessionControllerDeps
) {
  let youtubeImportParseTimer: ReturnType<typeof setTimeout> | null = null;
  let youtubeImportParseUrl: string | null = null;

  function clearYoutubeImportParseTimer() {
    if (youtubeImportParseTimer !== null) {
      clearTimeout(youtubeImportParseTimer);
      youtubeImportParseTimer = null;
    }
    youtubeImportParseUrl = null;
  }

  function updateYoutubeImportCustomField(field: string, value: unknown) {
    const patch = buildYoutubeImportCustomPatch(field, value);
    if (patch === null) {
      return;
    }
    deps.dispatch({
      type: "youtube-import-custom-updated",
      patch,
    });
  }

  function scheduleYoutubeImportParse(rawUrl: string) {
    const url = normalizeYoutubeImportUrlInput(rawUrl);
    clearYoutubeImportParseTimer();
    if (url === null) {
      deps.dispatch({ type: "youtube-import-set-url", url: null });
      return;
    }

    deps.dispatch({ type: "youtube-import-set-url", url });
    const preview = buildYoutubeImportPreview(url);
    if (preview === null) {
      deps.dispatch({ type: "youtube-import-parse-error", reason: "invalid-url" });
      return;
    }

    deps.dispatch({ type: "youtube-import-parse-start" });
    youtubeImportParseUrl = url;
    youtubeImportParseTimer = setTimeout(function () {
      youtubeImportParseTimer = null;
      const state = deps.store.getState();
      if (
        youtubeImportParseUrl !== url ||
        state.ui.labMode !== "import-youtube" ||
        state.ui.youtubeImport.url !== url ||
        state.ui.youtubeImport.status !== "parsing"
      ) {
        return;
      }
      youtubeImportParseUrl = null;
      deps.dispatch({
        type: "youtube-import-parse-success",
        url,
        preview,
      });
    }, YOUTUBE_IMPORT_PARSE_DELAY_MS);
  }

  return {
    clearYoutubeImportParseTimer,
    scheduleYoutubeImportParse,
    updateYoutubeImportCustomField,
  };
}

import {
  mutateLaboratoryTransformStages,
  normalizeLaboratoryTransformStages,
} from "../../shared/transform-stress-test-model.js";

type AudioForensicsRoomApi = {
  sendEvent?: (eventName: string, payload: Record<string, unknown>) => void;
};

type AudioForensicsWindow = Window & {
  roomAPI?: AudioForensicsRoomApi;
};

type AudioForensicsBinderDeps = {
  documentRef: Document;
  windowRef: AudioForensicsWindow;
};

let attached = false;

function readTimelineSelection(documentRef: Document) {
  const timeline = documentRef.querySelector<HTMLElement>("#lab-timeline");
  const selection = timeline?.querySelector<HTMLElement>(".labx-timeline__selection");
  if (
    timeline === null ||
    timeline === undefined ||
    selection === null ||
    selection === undefined
  ) {
    return null;
  }
  const durationMs = Number(timeline.dataset["duration"] || "");
  const leftPct = Number.parseFloat(selection.style.left || "");
  const widthPct = Number.parseFloat(selection.style.width || "");
  if (
    !Number.isFinite(durationMs) ||
    durationMs <= 0 ||
    !Number.isFinite(leftPct) ||
    !Number.isFinite(widthPct) ||
    widthPct <= 0
  ) {
    return null;
  }
  const startSeconds = (durationMs * Math.max(0, Math.min(100, leftPct))) / 100 / 1000;
  const endSeconds = (durationMs * Math.max(0, Math.min(100, leftPct + widthPct))) / 100 / 1000;
  return endSeconds > startSeconds ? { startSeconds, endSeconds } : null;
}

function parseStages(value: string | undefined) {
  try {
    return normalizeLaboratoryTransformStages(JSON.parse(value || "[]"), "audio");
  } catch {
    return [];
  }
}

function buildNoiseProfileStages(stagesValue: unknown, startSeconds: number, endSeconds: number) {
  let stages = normalizeLaboratoryTransformStages(stagesValue, "audio");
  let profile = stages.find((stage) => stage.kind === "noise-profile") || null;
  if (profile === null) {
    stages = mutateLaboratoryTransformStages(stages, "audio", {
      type: "add",
      kind: "noise-profile",
    });
    profile = stages.find((stage) => stage.kind === "noise-profile") || null;
  }
  if (profile === null) return stages;
  stages = mutateLaboratoryTransformStages(stages, "audio", {
    type: "parameter",
    stageId: profile.id,
    parameterId: "profileStartSec",
    value: startSeconds,
  });
  stages = mutateLaboratoryTransformStages(stages, "audio", {
    type: "parameter",
    stageId: profile.id,
    parameterId: "profileEndSec",
    value: Math.max(startSeconds + 0.01, endSeconds),
  });
  return stages;
}

export function bindLaboratoryAudioForensicsInteractions(deps: AudioForensicsBinderDeps) {
  if (attached) return function noop() {};
  attached = true;

  function handleClick(event: Event) {
    if (!(event.target instanceof Element)) return;

    const abButton = event.target.closest<HTMLButtonElement>(
      '[data-lab-action="workspace-audio-sweep-ab"]'
    );
    if (abButton !== null && !abButton.disabled) {
      const root = abButton.closest<HTMLElement>("[data-lab-audio-forensics='true']");
      const player =
        root?.querySelector<HTMLAudioElement>("[data-lab-audio-sweep-ab-player='true']") || null;
      const status =
        root?.querySelector<HTMLElement>("[data-lab-audio-sweep-ab-status='true']") || null;
      const sourceUrl = abButton.dataset["labSourceUrl"] || "";
      const variantUrl = abButton.dataset["labVariantUrl"] || "";
      if (player !== null && sourceUrl !== "" && variantUrl !== "") {
        event.preventDefault();
        const showSource = player.dataset["labAbMode"] === "variant";
        player.pause();
        player.src = showSource ? sourceUrl : variantUrl;
        player.dataset["labAbMode"] = showSource ? "source" : "variant";
        player.load();
        if (status !== null) {
          status.textContent = showSource
            ? "A · Source"
            : `B · ${abButton.dataset["labVariantLabel"] || "Variant"}`;
        }
        void player.play().catch(function () {
          // Browsers can still require a fresh gesture after a source swap.
        });
      }
      return;
    }

    const button = event.target.closest<HTMLButtonElement>(
      '[data-lab-action="workspace-noise-profile-capture"]'
    );
    if (button === null || button.disabled) return;
    const root = button.closest<HTMLElement>("[data-lab-audio-forensics='true']");
    if (root === null || root.dataset["labAudioForensicsLocked"] === "true") return;
    const selection = readTimelineSelection(deps.documentRef);
    if (selection === null) {
      const status = root.querySelector<HTMLElement>("[data-lab-noise-profile-status='true']");
      if (status !== null) status.textContent = "Önce timeline üzerinde sessiz bir aralık seçin.";
      return;
    }
    const trimStartSeconds = Number(root.dataset["labAudioTrimStartSeconds"] || "0");
    const offset = Number.isFinite(trimStartSeconds) ? Math.max(0, trimStartSeconds) : 0;
    const startSeconds = Math.max(0, selection.startSeconds - offset);
    const endSeconds = Math.max(startSeconds + 0.01, selection.endSeconds - offset);
    const roomApi = deps.windowRef.roomAPI;
    if (!roomApi || typeof roomApi.sendEvent !== "function") return;

    event.preventDefault();
    const stages = buildNoiseProfileStages(
      parseStages(root.dataset["labAudioTransformStagesJson"]),
      startSeconds,
      endSeconds
    );
    const requestId = `audio-noise-profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    roomApi.sendEvent("media-action", {
      action: "edit-update-recipe",
      payload: {
        featureId: root.dataset["labAudioForensicsFeatureId"] || "audio-analysis",
        patch: {
          audio: {
            transformStages: stages,
          },
        },
      },
      requestId,
    });

    const status = root.querySelector<HTMLElement>("[data-lab-noise-profile-status='true']");
    if (status !== null) {
      status.textContent = `${startSeconds.toFixed(3)}–${endSeconds.toFixed(3)} s · noise-profile aşamasına aktarıldı.`;
    }
  }

  deps.documentRef.addEventListener("click", handleClick);
  return function detach() {
    deps.documentRef.removeEventListener("click", handleClick);
    attached = false;
  };
}

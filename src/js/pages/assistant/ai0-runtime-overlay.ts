import { AppI18n } from "../../modules/i18n/index.js";
import { requestAi0Runtime } from "../../modules/ai0-runtime.js";
import { requestAgentProfiles } from "../../modules/agent-profiles.js";
import { createSharedAssistantToolOverlayController } from "../../ui/overlay-presets.js";
import { AI0_ASSISTANT_SCOPE, AI0_IMAGE_SCOPE } from "../../../../shared/ai0-runtime.js";
import type {
  Ai0CapabilityStatus,
  Ai0ImageArtifact,
  Ai0Model,
  Ai0TextResult,
} from "../../../../shared/ai0-runtime.js";
import type {
  AgentCharacterProfile,
  AgentProfileScope,
} from "../../../../shared/agent-profiles.js";

function t(key: string): string {
  return AppI18n.t(`shell.assistant.ai0Runtime.${key}`);
}
export function initAi0RuntimeOverlay(): void {
  const overlay = document.getElementById("ai0-runtime-overlay");
  const task = document.getElementById("ai0-runtime-task") as HTMLSelectElement | null;
  const model = document.getElementById("ai0-runtime-model") as HTMLSelectElement | null;
  const profile = document.getElementById("ai0-runtime-profile") as HTMLSelectElement | null;
  const prompt = document.getElementById("ai0-runtime-prompt") as HTMLTextAreaElement | null;
  const output = document.getElementById("ai0-runtime-output");
  const run = document.getElementById("ai0-runtime-run") as HTMLButtonElement | null;
  const open = document.getElementById("ai0-runtime-image-open") as HTMLButtonElement | null;
  if (
    !(overlay instanceof HTMLElement) ||
    !task ||
    !model ||
    !profile ||
    !prompt ||
    !output ||
    !run ||
    !open
  )
    return;

  const controller = createSharedAssistantToolOverlayController({
    id: "ai0-runtime-overlay",
    element: overlay,
  });
  let sessionId: string | undefined;
  let imagePath: string | null = null;
  let availableModels: Array<Ai0Model & { name: string }> = [];
  let selectedModels: { chat: Ai0Model | null; image: Ai0Model | null } = {
    chat: null,
    image: null,
  };
  const scope = (): AgentProfileScope =>
    task.value === "image" ? AI0_IMAGE_SCOPE : AI0_ASSISTANT_SCOPE;
  const reset = (): void => {
    sessionId = undefined;
    imagePath = null;
    open.disabled = true;
  };
  const displayError = (error: unknown): void => {
    output.textContent = error instanceof Error ? error.message : String(error);
  };
  const fillModels = (): void => {
    const image = task.value === "image";
    const list = image
      ? [{ providerID: "openai", id: "gpt-image-2", name: "GPT Image 2" }]
      : availableModels;
    model.replaceChildren();
    for (const item of list) {
      const option = document.createElement("option");
      option.value = JSON.stringify({ id: item.id, providerID: item.providerID });
      option.textContent = `${item.providerID} / ${item.name}`;
      model.append(option);
    }
    const selected = image ? selectedModels.image : selectedModels.chat;
    if (selected) {
      const value = JSON.stringify(selected);
      if (Array.from(model.options).some((item) => item.value === value)) model.value = value;
    }
    run.disabled = model.options.length === 0 || profile.options.length === 0;
  };
  document.getElementById("assistant-ai0-runtime-btn")?.addEventListener("click", () => {
    controller.open();
    output.textContent = t("loading");
    run.disabled = true;
    void (async (): Promise<void> => {
      const [models, profiles, selections] = await Promise.all([
        requestAi0Runtime<Array<Ai0Model & { name: string }>>({ action: "models" }),
        requestAgentProfiles<AgentCharacterProfile[]>({ action: "list" }),
        requestAi0Runtime<{ chat: Ai0Model | null; image: Ai0Model | null }>({
          action: "model-selections",
        }),
      ]);
      availableModels = models;
      selectedModels = selections;
      profile.replaceChildren();
      for (const item of profiles.filter((entry) => entry.instructionId === null)) {
        const option = document.createElement("option");
        option.value = item.id;
        option.textContent = item.name;
        profile.append(option);
      }
      fillModels();
      output.textContent = model.options.length > 0 ? t("ready") : t("noModels");
    })().catch(displayError);
  });
  document.getElementById("ai0-runtime-close")?.addEventListener("click", () => {
    controller.close();
  });
  document.getElementById("ai0-runtime-new-session")?.addEventListener("click", reset);
  task.addEventListener("change", () => {
    reset();
    fillModels();
  });
  for (const select of [model, profile]) select.addEventListener("change", reset);
  document.getElementById("ai0-runtime-image-status")?.addEventListener("click", () => {
    output.textContent = t("loading");
    void requestAi0Runtime<Ai0CapabilityStatus>({ action: "image-status" })
      .then((status) => {
        output.textContent = status.available
          ? status.verified
            ? t("imageReady")
            : t("imageNotTested")
          : (status.reason ?? t("imageUnavailable"));
      })
      .catch(displayError);
  });
  run.addEventListener("click", () => {
    if (!model.value || !prompt.value.trim()) return;
    run.disabled = true;
    output.textContent = t("working");
    void (async (): Promise<void> => {
      const selectedScope = scope();
      await requestAi0Runtime({
        action: "model-select",
        scope: selectedScope,
        model: JSON.parse(model.value) as Ai0Model,
      });
      await requestAgentProfiles({
        action: "select",
        scope: selectedScope,
        profileId: profile.value,
      });
      if (task.value === "image") {
        const image = await requestAi0Runtime<Ai0ImageArtifact>({
          action: "image-generate",
          prompt: prompt.value,
          scope: selectedScope,
        });
        imagePath = image.path;
        open.disabled = false;
        output.textContent = `${t("imageSaved")}\n${image.path}\n${image.width} × ${image.height} · ${image.bytes} bytes`;
      } else {
        const result = await requestAi0Runtime<Ai0TextResult>({
          action: "chat",
          text: prompt.value,
          scope: selectedScope,
          ...(sessionId !== undefined ? { sessionId } : {}),
        });
        sessionId = result.sessionId;
        output.textContent = result.text;
      }
    })()
      .catch(displayError)
      .finally(() => {
        run.disabled = false;
      });
  });
  open.addEventListener("click", () => {
    if (imagePath !== null)
      void requestAi0Runtime({ action: "image-open", path: imagePath }).catch(displayError);
  });
}

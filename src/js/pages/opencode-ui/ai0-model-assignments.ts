import { requestAi0Runtime } from "../../modules/ai0-runtime.js";
import {
  AI0_ASSISTANT_SCOPE,
  AI0_ROOM_SCOPE,
  AI0_IMAGE_SCOPE,
  type Ai0Model,
  type Ai0CapabilityStatus,
} from "../../../../shared/ai0-runtime.js";
import type { RuntimeState } from "./types.js";
import { t } from "./i18n.js";

type Task = "chat" | "room" | "image";
type Selections = Record<Task, Ai0Model | null>;

const tasks: Task[] = ["chat", "room", "image"];
const scopes = {
  chat: AI0_ASSISTANT_SCOPE,
  room: AI0_ROOM_SCOPE,
  image: AI0_IMAGE_SCOPE,
};
const imageModels: Ai0Model[] = [{ providerID: "openai", id: "gpt-image-2" }];

function key(model: Ai0Model): string {
  return JSON.stringify(model);
}
function asModel(value: string): Ai0Model | null {
  try {
    const model: unknown = JSON.parse(value);
    if (
      model !== null &&
      typeof model === "object" &&
      "id" in model &&
      "providerID" in model &&
      typeof model.id === "string" &&
      typeof model.providerID === "string"
    ) {
      return { id: model.id, providerID: model.providerID };
    }
  } catch {
    // A missing choice is not a model.
  }
  return null;
}

export function createAi0AssignmentsController(runtime: RuntimeState): {
  refresh: () => Promise<void>;
  bind: () => void;
} {
  const byId = (id: string): HTMLElement | null => document.getElementById(id);
  const status = (): HTMLElement | null => byId("model-settings-ai0-status");
  const say = (message: string): void => {
    const element = status();
    if (element) element.textContent = message;
  };
  const choices = (task: Task, existing: Ai0Model | null): Ai0Model[] => {
    if (task === "image") {
      const models = [...imageModels];
      if (existing && !models.some((candidate) => key(candidate) === key(existing)))
        models.push(existing);
      return models;
    }
    return runtime.modelItems
      .filter((item) => item.providerId && item.modelId && item.isPassive !== true)
      .map((item) => ({ providerID: item.providerId ?? "", id: item.modelId ?? "" }))
      .filter((model) => model.providerID !== "" && model.id !== "");
  };

  const refresh = async (): Promise<void> => {
    let selections: Selections;
    try {
      selections = await requestAi0Runtime<Selections>({ action: "model-selections" });
    } catch (error) {
      say(error instanceof Error ? error.message : String(error));
      return;
    }
    for (const task of tasks) {
      const select = byId("model-settings-ai0-" + task) as HTMLSelectElement | null;
      if (!select) continue;
      const selected = selections[task];
      select.replaceChildren();
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = t("modelSettings.ai0Unassigned");
      select.append(placeholder);
      const models = choices(task, selected);
      for (const model of models) {
        const option = document.createElement("option");
        option.value = key(model);
        option.textContent = model.providerID + " / " + model.id;
        select.append(option);
      }
      select.value = selected ? key(selected) : "";
      if (select.value === "") select.selectedIndex = 0;
    }
    try {
      const capability = await requestAi0Runtime<Ai0CapabilityStatus>({
        action: "image-status",
      });
      say(
        capability.available
          ? capability.verified
            ? t("modelSettings.ai0ImageVerified")
            : t("modelSettings.ai0ImageNotTested")
          : (capability.reason ?? t("modelSettings.ai0ImageUnavailable"))
      );
    } catch (error) {
      say(error instanceof Error ? error.message : String(error));
    }
  };

  const bind = (): void => {
    for (const task of tasks) {
      const select = byId("model-settings-ai0-" + task) as HTMLSelectElement | null;
      select?.addEventListener("change", () => {
        const model = asModel(select.value);
        if (!model) return;
        select.disabled = true;
        say(t("modelSettings.ai0Saving"));
        void requestAi0Runtime({
          action: "model-select",
          scope: scopes[task],
          model,
        })
          .then(async () => await refresh())
          .catch((error: unknown) => {
            say(error instanceof Error ? error.message : String(error));
          })
          .finally(() => {
            select.disabled = false;
          });
      });
    }
    byId("model-settings-ai0-check")?.addEventListener("click", () => {
      say(t("modelSettings.ai0Checking"));
      void refresh();
    });
  };
  return { bind, refresh };
}

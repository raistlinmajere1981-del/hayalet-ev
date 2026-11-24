import { requestAi0Runtime } from "../../modules/ai0-runtime.js";
import {
  AI0_ASSISTANT_SCOPE,
  AI0_ROOM_SCOPE,
  type Ai0Model,
  type Ai0CapabilityStatus,
  type Ai0ImageArtifact,
} from "../../../../shared/ai0-runtime.js";
import type { RuntimeState } from "./types.js";
import { t } from "./i18n.js";

type Task = "chat" | "room";
type Selections = Record<Task, Ai0Model | null>;

const tasks: Task[] = ["chat", "room"];
const scopes = {
  chat: AI0_ASSISTANT_SCOPE,
  room: AI0_ROOM_SCOPE,
};

function key(model: Ai0Model): string {
  return JSON.stringify({ providerID: model.providerID, id: model.id });
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
  let testing = false;
  const byId = (id: string): HTMLElement | null => document.getElementById(id);
  const status = (): HTMLElement | null => byId("model-settings-ai0-status");
  const say = (message: string): void => {
    const element = status();
    if (element) element.textContent = message;
  };
  const choices = (): Ai0Model[] => {
    return runtime.modelItems
      .filter(
        (item) =>
          item.providerId !== undefined &&
          item.providerId !== "" &&
          item.modelId !== undefined &&
          item.modelId !== "" &&
          item.isPassive !== true
      )
      .map((item) => ({ providerID: item.providerId ?? "", id: item.modelId ?? "" }))
      .filter((model) => model.providerID !== "" && model.id !== "");
  };

  const refresh = async (): Promise<void> => {
    if (testing) return;
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
      const models = choices();
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
          .then(async () => {
            await refresh();
          })
          .catch((error: unknown) => {
            say(error instanceof Error ? error.message : String(error));
          })
          .finally(() => {
            select.disabled = false;
          });
      });
    }
    byId("model-settings-ai0-check")?.addEventListener("click", () => {
      if (testing) return;
      testing = true;
      const button = byId("model-settings-ai0-check") as HTMLButtonElement;
      const selects = tasks.map(
        (task) => byId("model-settings-ai0-" + task) as HTMLSelectElement | null
      );
      button.disabled = true;
      for (const select of selects) if (select) select.disabled = true;
      say(t("modelSettings.ai0Checking"));
      void (async (): Promise<void> => {
        const capability = await requestAi0Runtime<Ai0CapabilityStatus>({ action: "image-status" });
        if (!capability.available)
          throw new Error(capability.reason ?? t("modelSettings.ai0ImageUnavailable"));
        const artifact = await requestAi0Runtime<Ai0ImageArtifact>({
          action: "image-generate",
          prompt: "A small blue ghost on a white background. Simple illustration, no text.",
          aspectRatio: "1:1",
        });
        say(t("modelSettings.ai0ImageVerified") + " · " + artifact.width + " × " + artifact.height);
      })()
        .catch((error) => {
          say(error instanceof Error ? error.message : String(error));
        })
        .finally(() => {
          testing = false;
          button.disabled = false;
          for (const select of selects) if (select) select.disabled = false;
        });
    });
  };
  return { bind, refresh };
}

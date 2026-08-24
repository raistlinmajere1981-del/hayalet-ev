import { isLaboratoryControlInjectionKind } from "../../shared/control-injection-model.js";
import { normalizeLaboratoryTemporalStressTestRequest } from "../../shared/temporal-stress-test-model.js";
import type { LaboratoryTemporalStressTestRequest } from "../../shared/temporal-stress-test-model.js";
import {
  isLaboratoryTransformStageKind,
  mutateLaboratoryTransformStages,
  normalizeLaboratoryTransformStages,
} from "../../shared/transform-stress-test-model.js";
import type {
  LaboratoryTransformStageMutation,
  LaboratoryTransformStageScope,
} from "../../shared/transform-stress-test-model.js";

type TransformStackRecipeSection = "video" | "audio" | "image";

type TransformStackRoomApi = {
  sendEvent?: (eventName: string, payload: Record<string, unknown>) => void;
};

type TransformStackWindow = Window & {
  roomAPI?: TransformStackRoomApi;
};

type TransformStackBinderDeps = {
  documentRef: Document;
  windowRef: TransformStackWindow;
};

type TransformStackRootState = {
  featureId: string;
  locked: boolean;
  recipeSection: TransformStackRecipeSection;
  scope: LaboratoryTransformStageScope;
  stages: ReturnType<typeof normalizeLaboratoryTransformStages>;
  temporalRequest: LaboratoryTemporalStressTestRequest | null;
};

let attached = false;

function asScope(value: string | null): LaboratoryTransformStageScope | null {
  return value === "visual" || value === "audio" ? value : null;
}

function asRecipeSection(value: string | null): TransformStackRecipeSection | null {
  return value === "video" || value === "audio" || value === "image" ? value : null;
}

function parseJsonAttribute(value: string | null, fallback: unknown) {
  try {
    return JSON.parse(value || "") as unknown;
  } catch {
    return fallback;
  }
}

function readRootState(root: HTMLElement): TransformStackRootState | null {
  const scope = asScope(root.getAttribute("data-lab-transform-stack"));
  const recipeSection = asRecipeSection(root.getAttribute("data-lab-transform-recipe-section"));
  if (scope === null || recipeSection === null) {
    return null;
  }
  const rawStages = parseJsonAttribute(root.getAttribute("data-lab-transform-stages-json"), []);
  const rawTemporalRequest = parseJsonAttribute(
    root.getAttribute("data-lab-temporal-request-json"),
    null
  );
  return {
    featureId: root.getAttribute("data-lab-transform-feature-id") || "media-analysis",
    locked: root.getAttribute("data-lab-transform-locked") === "true",
    recipeSection,
    scope,
    stages: normalizeLaboratoryTransformStages(rawStages, scope),
    temporalRequest: normalizeLaboratoryTemporalStressTestRequest(rawTemporalRequest),
  };
}

export function buildLaboratoryTransformStackRecipePatch(
  rootState: TransformStackRootState,
  mutation: LaboratoryTransformStageMutation
) {
  return {
    [rootState.recipeSection]: {
      transformStages: mutateLaboratoryTransformStages(rootState.stages, rootState.scope, mutation),
    },
  };
}

function createRequestId(action: string) {
  return `transform-stack-${action}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function sendMediaAction(
  windowRef: TransformStackWindow,
  state: TransformStackRootState,
  action: string,
  payload: Record<string, unknown> = {}
) {
  const roomApi = windowRef.roomAPI;
  if (!roomApi || typeof roomApi.sendEvent !== "function") {
    return false;
  }
  roomApi.sendEvent("media-action", {
    action,
    payload: {
      featureId: state.featureId,
      ...payload,
    },
    requestId: createRequestId(action),
  });
  return true;
}

function sendMutation(
  windowRef: TransformStackWindow,
  state: TransformStackRootState,
  mutation: LaboratoryTransformStageMutation
) {
  if (state.locked) {
    return false;
  }
  return sendMediaAction(windowRef, state, "edit-update-recipe", {
    patch: buildLaboratoryTransformStackRecipePatch(state, mutation),
  });
}

function getTransformRoot(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) {
    return null;
  }
  return target.closest<HTMLElement>("[data-lab-transform-stack]");
}

export function bindLaboratoryTransformStackInteractions(deps: TransformStackBinderDeps) {
  if (attached) {
    return function noop() {};
  }
  attached = true;

  function handleClick(event: Event) {
    if (!(event.target instanceof Element)) {
      return;
    }
    const actionButton = event.target.closest<HTMLElement>("[data-lab-action]");
    if (actionButton === null) {
      return;
    }
    const root = getTransformRoot(actionButton);
    if (root === null) {
      return;
    }
    const state = readRootState(root);
    if (state === null || state.locked) {
      return;
    }
    const action = actionButton.dataset["labAction"] || "";

    if (action === "workspace-transform-preview") {
      event.preventDefault();
      sendMediaAction(deps.windowRef, state, "edit-preview");
      return;
    }

    if (action === "workspace-transform-temporal-scan") {
      if (state.scope !== "visual" || state.temporalRequest === null) {
        return;
      }
      event.preventDefault();
      sendMediaAction(deps.windowRef, state, "edit-temporal-stress-test", {
        request: state.temporalRequest,
      });
      return;
    }

    if (action === "workspace-photometric-attenuation") {
      if (state.scope !== "visual" || state.temporalRequest === null) {
        return;
      }
      event.preventDefault();
      sendMediaAction(deps.windowRef, state, "edit-photometric-attenuation", {
        request: state.temporalRequest,
      });
      return;
    }

    if (action === "workspace-control-injection-run") {
      if (state.scope !== "visual" || state.temporalRequest === null) {
        return;
      }
      const kindSelect = root.querySelector<HTMLSelectElement>("[data-lab-control-injection-kind]");
      const kind = kindSelect?.value || "";
      if (!isLaboratoryControlInjectionKind(kind)) {
        return;
      }
      event.preventDefault();
      sendMediaAction(deps.windowRef, state, "edit-control-injection", {
        request: {
          kind,
          temporalRequest: state.temporalRequest,
        },
      });
      return;
    }

    if (action === "workspace-transform-stage-add") {
      const kindSelect = root.querySelector<HTMLSelectElement>("[data-lab-transform-add-kind]");
      const kind = kindSelect?.value || "";
      if (!isLaboratoryTransformStageKind(kind, state.scope)) {
        return;
      }
      event.preventDefault();
      sendMutation(deps.windowRef, state, { type: "add", kind });
      return;
    }

    const stageId = actionButton.dataset["labTransformStageId"] || "";
    if (stageId.trim() === "") {
      return;
    }
    if (action === "workspace-transform-stage-remove") {
      event.preventDefault();
      sendMutation(deps.windowRef, state, { type: "remove", stageId });
      return;
    }
    if (action === "workspace-transform-stage-move") {
      const direction = actionButton.dataset["labTransformDirection"];
      if (direction !== "up" && direction !== "down") {
        return;
      }
      event.preventDefault();
      sendMutation(deps.windowRef, state, { type: "move", direction, stageId });
    }
  }

  function handleChange(event: Event) {
    if (!(event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement)) {
      return;
    }
    const target = event.target;
    const root = getTransformRoot(target);
    if (root === null) {
      return;
    }
    const state = readRootState(root);
    if (state === null || state.locked) {
      return;
    }
    const stageId = target.dataset["labTransformStageId"] || "";
    if (stageId.trim() === "") {
      return;
    }

    if (target.dataset["labTransformStageEnabled"] === "true") {
      sendMutation(deps.windowRef, state, {
        type: "enabled",
        enabled: target instanceof HTMLInputElement ? target.checked : false,
        stageId,
      });
      return;
    }

    const parameterId = target.dataset["labTransformParameterId"] || "";
    if (parameterId.trim() === "") {
      return;
    }
    const value =
      target instanceof HTMLInputElement && target.type === "number"
        ? target.value === ""
          ? null
          : Number(target.value)
        : target.value;
    sendMutation(deps.windowRef, state, {
      type: "parameter",
      parameterId,
      stageId,
      value,
    });
  }

  deps.documentRef.addEventListener("click", handleClick);
  deps.documentRef.addEventListener("change", handleChange);

  return function detach() {
    deps.documentRef.removeEventListener("click", handleClick);
    deps.documentRef.removeEventListener("change", handleChange);
    attached = false;
  };
}

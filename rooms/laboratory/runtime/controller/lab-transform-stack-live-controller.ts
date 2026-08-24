import { asLabRecord, asNonEmptyString } from "../../domain/lab-types.js";
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
  offHostMessage?: (listener: (message: unknown) => void) => void;
  onHostMessage?: (listener: (message: unknown) => void) => (() => void) | void;
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

type TransformActionFeedbackState = "running" | "success" | "error";

type PendingTransformActionFeedback = {
  action: string;
  buttonAction: string;
  errorLabel: string;
  featureId: string;
  idleLabel: string;
  requestId: string;
  runningLabel: string;
  scope: LaboratoryTransformStageScope;
  state: TransformActionFeedbackState;
  successLabel: string;
  timerId: number | null;
};

const ACTION_FEEDBACK_HOLD_MS = 1800;

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

export function readLaboratoryTransformStackActionResult(message: unknown) {
  const envelope = asLabRecord(message);
  if (envelope["type"] !== "lab-event") {
    return null;
  }
  const payload = asLabRecord(envelope["payload"]);
  const event = Object.keys(payload).length > 0 ? payload : envelope;
  if (event["kind"] !== "request-result") {
    return null;
  }
  const requestId = asNonEmptyString(event["requestId"]);
  const stage = asNonEmptyString(event["stage"]);
  if (
    requestId === null ||
    (stage !== "completed" && stage !== "failed" && stage !== "cancelled")
  ) {
    return null;
  }
  return {
    action: asNonEmptyString(event["action"]),
    requestId,
    state: stage === "completed" ? ("success" as const) : ("error" as const),
  };
}

function sendMediaAction(
  windowRef: TransformStackWindow,
  state: TransformStackRootState,
  action: string,
  payload: Record<string, unknown> = {}
) {
  const roomApi = windowRef.roomAPI;
  if (!roomApi || typeof roomApi.sendEvent !== "function") {
    return null;
  }
  const requestId = createRequestId(action);
  roomApi.sendEvent("media-action", {
    action,
    payload: {
      featureId: state.featureId,
      ...payload,
    },
    requestId,
  });
  return requestId;
}

function sendMutation(
  windowRef: TransformStackWindow,
  state: TransformStackRootState,
  mutation: LaboratoryTransformStageMutation
) {
  if (state.locked) {
    return null;
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
  const pendingFeedback = new Map<string, PendingTransformActionFeedback>();
  let feedbackSyncFrame: number | null = null;

  function findFeedbackButton(feedback: PendingTransformActionFeedback) {
    const roots = deps.documentRef.querySelectorAll<HTMLElement>("[data-lab-transform-stack]");
    for (const root of roots) {
      if (
        root.getAttribute("data-lab-transform-feature-id") !== feedback.featureId ||
        root.getAttribute("data-lab-transform-stack") !== feedback.scope
      ) {
        continue;
      }
      const buttons = root.querySelectorAll<HTMLElement>('[data-lab-action-feedback="true"]');
      for (const button of buttons) {
        if (button.dataset["labAction"] === feedback.buttonAction) {
          return button;
        }
      }
    }
    return null;
  }

  function setFeedbackButtonState(button: HTMLElement, feedback: PendingTransformActionFeedback) {
    const label =
      feedback.state === "running"
        ? feedback.runningLabel
        : feedback.state === "success"
          ? feedback.successLabel
          : feedback.errorLabel;
    button.dataset["labActionState"] = feedback.state;
    button.dataset["labFeedbackRequestId"] = feedback.requestId;
    button.textContent = label;
    button.setAttribute("disabled", "");
    if (feedback.state === "running") {
      button.setAttribute("aria-busy", "true");
    } else {
      button.removeAttribute("aria-busy");
    }
  }

  function restoreFeedbackButton(feedback: PendingTransformActionFeedback) {
    const button = findFeedbackButton(feedback);
    if (button === null) {
      return;
    }
    const root = getTransformRoot(button);
    const state = root === null ? null : readRootState(root);
    const requiresTemporalSelection =
      feedback.buttonAction === "workspace-transform-temporal-scan" ||
      feedback.buttonAction === "workspace-photometric-attenuation" ||
      feedback.buttonAction === "workspace-motion-reference-lock" ||
      feedback.buttonAction === "workspace-motion-probe" ||
      feedback.buttonAction === "workspace-impact-window-compare" ||
      feedback.buttonAction === "workspace-control-injection-run";
    const requiresRoiSelection = feedback.buttonAction === "workspace-motion-reference-lock";
    button.textContent = feedback.idleLabel;
    delete button.dataset["labActionState"];
    delete button.dataset["labFeedbackRequestId"];
    button.removeAttribute("aria-busy");
    if (
      state === null ||
      state.locked ||
      (requiresTemporalSelection && state.temporalRequest === null) ||
      (requiresRoiSelection && state.temporalRequest?.roi === null)
    ) {
      button.setAttribute("disabled", "");
    } else {
      button.removeAttribute("disabled");
    }
  }

  function syncPendingFeedback() {
    feedbackSyncFrame = null;
    for (const feedback of pendingFeedback.values()) {
      const button = findFeedbackButton(feedback);
      if (button !== null) {
        setFeedbackButtonState(button, feedback);
      }
    }
  }

  function schedulePendingFeedbackSync() {
    if (pendingFeedback.size === 0 || feedbackSyncFrame !== null) {
      return;
    }
    feedbackSyncFrame = deps.windowRef.requestAnimationFrame(syncPendingFeedback);
  }

  function startActionFeedback(
    button: HTMLElement,
    state: TransformStackRootState,
    action: string,
    requestId: string
  ) {
    if (button.dataset["labActionFeedback"] !== "true") {
      return;
    }
    const idleLabel = (button.textContent || "").trim();
    const feedback: PendingTransformActionFeedback = {
      action,
      buttonAction: button.dataset["labAction"] || "",
      errorLabel: button.dataset["labFeedbackError"] || "Failed",
      featureId: state.featureId,
      idleLabel,
      requestId,
      runningLabel: button.dataset["labFeedbackRunning"] || "Working…",
      scope: state.scope,
      state: "running",
      successLabel: button.dataset["labFeedbackSuccess"] || "Completed",
      timerId: null,
    };
    pendingFeedback.set(requestId, feedback);
    setFeedbackButtonState(button, feedback);
  }

  function handleHostMessage(message: unknown) {
    const result = readLaboratoryTransformStackActionResult(message);
    if (result !== null) {
      const feedback = pendingFeedback.get(result.requestId);
      if (feedback !== undefined && (result.action === null || result.action === feedback.action)) {
        feedback.state = result.state;
        if (feedback.timerId !== null) {
          deps.windowRef.clearTimeout(feedback.timerId);
        }
        feedback.timerId = deps.windowRef.setTimeout(function () {
          restoreFeedbackButton(feedback);
          pendingFeedback.delete(feedback.requestId);
        }, ACTION_FEEDBACK_HOLD_MS);
      }
    }
    schedulePendingFeedbackSync();
  }

  function handleClick(event: Event) {
    schedulePendingFeedbackSync();
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
      const requestId = sendMediaAction(deps.windowRef, state, "edit-preview");
      if (requestId !== null) {
        startActionFeedback(actionButton, state, "edit-preview", requestId);
      }
      return;
    }

    if (action === "workspace-transform-temporal-scan") {
      if (state.scope !== "visual" || state.temporalRequest === null) {
        return;
      }
      event.preventDefault();
      const requestId = sendMediaAction(deps.windowRef, state, "edit-temporal-stress-test", {
        request: state.temporalRequest,
      });
      if (requestId !== null) {
        startActionFeedback(actionButton, state, "edit-temporal-stress-test", requestId);
      }
      return;
    }

    if (action === "workspace-photometric-attenuation") {
      if (state.scope !== "visual" || state.temporalRequest === null) {
        return;
      }
      event.preventDefault();
      const requestId = sendMediaAction(deps.windowRef, state, "edit-photometric-attenuation", {
        request: state.temporalRequest,
      });
      if (requestId !== null) {
        startActionFeedback(actionButton, state, "edit-photometric-attenuation", requestId);
      }
      return;
    }

    if (action === "workspace-motion-reference-lock") {
      if (state.scope !== "visual" || state.temporalRequest?.roi == null) {
        return;
      }
      event.preventDefault();
      const requestId = sendMediaAction(deps.windowRef, state, "edit-motion-reference-lock", {
        request: state.temporalRequest,
      });
      if (requestId !== null) {
        startActionFeedback(actionButton, state, "edit-motion-reference-lock", requestId);
      }
      return;
    }

    if (action === "workspace-motion-probe") {
      if (state.scope !== "visual" || state.temporalRequest === null) {
        return;
      }
      event.preventDefault();
      const requestId = sendMediaAction(deps.windowRef, state, "edit-motion-probe", {
        request: state.temporalRequest,
      });
      if (requestId !== null) {
        startActionFeedback(actionButton, state, "edit-motion-probe", requestId);
      }
      return;
    }

    if (action === "workspace-impact-window-compare") {
      if (state.scope !== "visual" || state.temporalRequest === null) {
        return;
      }
      event.preventDefault();
      const requestId = sendMediaAction(deps.windowRef, state, "edit-impact-window-compare", {
        request: state.temporalRequest,
      });
      if (requestId !== null) {
        startActionFeedback(actionButton, state, "edit-impact-window-compare", requestId);
      }
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
      const requestId = sendMediaAction(deps.windowRef, state, "edit-control-injection", {
        request: {
          kind,
          temporalRequest: state.temporalRequest,
        },
      });
      if (requestId !== null) {
        startActionFeedback(actionButton, state, "edit-control-injection", requestId);
      }
      return;
    }

    if (action === "workspace-transform-stage-add") {
      const kindSelect = root.querySelector<HTMLSelectElement>("[data-lab-transform-add-kind]");
      const kind = kindSelect?.value || "";
      if (!isLaboratoryTransformStageKind(kind, state.scope)) {
        return;
      }
      event.preventDefault();
      const requestId = sendMutation(deps.windowRef, state, { type: "add", kind });
      if (requestId !== null) {
        startActionFeedback(actionButton, state, "edit-update-recipe", requestId);
      }
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
  deps.windowRef.roomAPI?.onHostMessage?.(handleHostMessage);

  return function detach() {
    deps.documentRef.removeEventListener("click", handleClick);
    deps.documentRef.removeEventListener("change", handleChange);
    deps.windowRef.roomAPI?.offHostMessage?.(handleHostMessage);
    if (feedbackSyncFrame !== null) {
      deps.windowRef.cancelAnimationFrame(feedbackSyncFrame);
    }
    for (const feedback of pendingFeedback.values()) {
      if (feedback.timerId !== null) {
        deps.windowRef.clearTimeout(feedback.timerId);
      }
    }
    pendingFeedback.clear();
    attached = false;
  };
}

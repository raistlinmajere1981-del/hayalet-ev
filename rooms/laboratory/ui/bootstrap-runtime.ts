import type { createLaboratoryUiActionRouter } from "../shared/ui/action-router.js";
import type { createLaboratoryUiBootstrapStateRuntime } from "./bootstrap-state-runtime.js";

type LaboratoryUiState = ReturnType<typeof createLaboratoryUiBootstrapStateRuntime>["state"];
type LaboratoryUiActionRouter = Pick<
  ReturnType<typeof createLaboratoryUiActionRouter>,
  "handleChange" | "handleClick" | "handleInput"
>;

type LaboratoryRoomApi = {
  onHostMessage?: (listener: (message: unknown) => void) => void;
  ready?: (payload: { feature: string; room: string; stage: string }) => void;
};

type LaboratoryWindowRef = Window & {
  roomAPI?: LaboratoryRoomApi;
};

type LaboratoryUiBootstrapRuntimeDeps = {
  actionRouter: LaboratoryUiActionRouter;
  applyLocale: (locale: string) => void;
  applyPresentationMode: (mode: LaboratoryUiState["presentation"]["mode"]) => void;
  bootstrapText: (key: string) => string;
  documentRef: Document;
  getActiveFeatureId: () => string;
  handleHostMessage: (message: unknown) => void;
  render: () => void;
  setLastAction: (message: string) => void;
  state: LaboratoryUiState;
  windowRef: LaboratoryWindowRef;
};

export function createLaboratoryUiBootstrapRuntime(deps: LaboratoryUiBootstrapRuntimeDeps) {
  const actionRouter = deps.actionRouter;
  const applyLocale = deps.applyLocale;
  const applyPresentationMode = deps.applyPresentationMode;
  const bootstrapText = deps.bootstrapText;
  const getActiveFeatureId = deps.getActiveFeatureId;
  const handleHostMessage = deps.handleHostMessage;
  const render = deps.render;
  const setLastAction = deps.setLastAction;
  const state = deps.state;
  const windowRef = deps.windowRef;
  const documentRef = deps.documentRef;
  let attached = false;

  function attach() {
    if (attached) {
      return;
    }

    attached = true;
    documentRef.addEventListener("click", actionRouter.handleClick);
    documentRef.addEventListener("input", actionRouter.handleInput);
    documentRef.addEventListener("change", actionRouter.handleChange);

    if (windowRef.roomAPI && typeof windowRef.roomAPI.onHostMessage === "function") {
      windowRef.roomAPI.onHostMessage(handleHostMessage);
    } else {
      setLastAction(bootstrapText("roomApiUnavailable"));
    }

    const locale = typeof state.locale === "string" ? state.locale : "en";
    applyPresentationMode(state.presentation.mode);
    applyLocale(locale);
    render();

    if (windowRef.roomAPI && typeof windowRef.roomAPI.ready === "function") {
      windowRef.roomAPI.ready({
        room: "laboratory",
        feature: getActiveFeatureId(),
        stage: "ui-ready",
      });
    }
  }

  return {
    attach: attach,
  };
}

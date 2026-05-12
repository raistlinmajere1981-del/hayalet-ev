/* global window */

(function (global: GameRoomUiGlobal) {
  type UnknownRecord = GameRoomUnknownRecord;

  function isRecord(value: unknown): value is UnknownRecord {
    return typeof value === "object" && value !== null && Array.isArray(value) === false;
  }

  function readNumber(value: unknown, fallback: number): number {
    return Number.isFinite(value) ? Number(value) : fallback;
  }

  function createState(candidate: unknown = {}): GameRoomFateKnotsState {
    const source = isRecord(candidate) ? candidate : {};
    const active = source["active"] === true;
    return {
      active,
      phase: active ? "ready" : "blank-slate",
      revision: readNumber(source["revision"], 0),
    };
  }

  function text(deps: GameRoomFateKnotsUiModuleDeps, path: string[], fallback: string): string {
    return deps.text(["fateKnots", ...path]) || fallback;
  }

  function getRuntimeRegistry(host: GameRoomUiGlobal): GameRoomUiFactoriesRegistry {
    return host.GameRoomUiFactories || (host.GameRoomUiFactories = {});
  }

  const registry = getRuntimeRegistry(global);

  registry.createFateKnotsUiModule = function createFateKnotsUiModule(
    deps: GameRoomFateKnotsUiModuleDeps
  ): GameRoomFateKnotsUiModule {
    function createFateKnotsState(): GameRoomFateKnotsState {
      return createState();
    }

    function sanitizeFateKnotsState(candidate: unknown): GameRoomFateKnotsState {
      return createState(candidate);
    }

    function renderFateKnots(root: HTMLElement): void {
      const state = deps.getState().fateKnots;
      root.replaceChildren();

      const shell = deps.createElement("main", "fk-shell");
      shell.dataset["fkPhase"] = state.phase;
      shell.dataset["fkScreen"] = "blank-slate";

      const header = deps.createElement("section", "fk-panel fk-panel--primary");
      header.dataset["fkRole"] = "surface-shell";
      const badge = deps.createElement("p", "fk-eyebrow", text(deps, ["heroBadge"], "Blank Slate"));
      const title = deps.createElement("h1", "fk-title", deps.getFeatureLabel(deps.featureId));
      const subtitle = deps.createElement(
        "p",
        "fk-copy",
        text(deps, ["heroSubtitle"], "This feature is clean and ready for a new design.")
      );
      header.append(badge, title, subtitle);

      const status = deps.createElement("section", "fk-panel");
      status.dataset["fkRole"] = "status";
      status.append(
        deps.createElement("h2", "fk-section-title", text(deps, ["status", "label"], "Status")),
        deps.createElement(
          "p",
          "fk-copy",
          state.active
            ? text(deps, ["status", "ready"], "Ready for the next Fate Knots system.")
            : text(deps, ["status", "idle"], "No legacy run is loaded.")
        )
      );

      const actions = deps.createElement("div", "fk-actions");
      actions.dataset["fkRole"] = "action-zone";
      const startButton = deps.createElement(
        "button",
        "fk-button fk-button--primary",
        text(deps, ["controls", "start"], "Start")
      ) as HTMLButtonElement;
      startButton.type = "button";
      startButton.addEventListener("click", function () {
        deps.sendRoomCommand("GameRoomFateKnotsStart", {});
      });

      const resetButton = deps.createElement(
        "button",
        "fk-button",
        text(deps, ["controls", "reset"], "Reset")
      ) as HTMLButtonElement;
      resetButton.type = "button";
      resetButton.addEventListener("click", function () {
        deps.sendRoomCommand("GameRoomFateKnotsReset", {});
      });
      actions.append(startButton, resetButton);

      shell.append(header, status, actions);
      root.append(shell);
    }

    return {
      createFateKnotsState,
      sanitizeFateKnotsState,
      renderFateKnots,
    };
  };
})(window as unknown as GameRoomUiGlobal);

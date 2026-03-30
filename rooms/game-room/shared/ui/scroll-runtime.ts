/* global window */

(function (global: any) {
  const registry = global.GameRoomUiScrollRuntime || (global.GameRoomUiScrollRuntime = {});

  const FEATURE_SCROLL_SELECTORS = {
    xoxRail: ".xox-rail",
    xoxStage: ".xox-stage",
    teamTetrisRail: ".tt-rail",
    teamTetrisStage: ".tt-stage",
    fateKnotsSurface: ".fk-surface__inner",
  };

  function canQuerySelector(value: any) {
    return !!value && typeof value === "object" && typeof value.querySelector === "function";
  }

  function isScrollableElement(value: any) {
    return !!value && typeof value === "object" && typeof value.scrollTop === "number";
  }

  registry.createGameRoomUiScrollRuntime = function createGameRoomUiScrollRuntime() {
    return {
      capture(root: any) {
        if (!canQuerySelector(root)) {
          return {};
        }

        return Object.fromEntries(
          Object.entries(FEATURE_SCROLL_SELECTORS).map(function ([key, selector]) {
            const element = root.querySelector(selector);
            return [key, isScrollableElement(element) ? element.scrollTop : null];
          })
        );
      },
      restore(root: any, scrollState: any) {
        if (!scrollState || typeof scrollState !== "object" || !canQuerySelector(root)) {
          return;
        }

        Object.entries(FEATURE_SCROLL_SELECTORS).forEach(function ([key, selector]) {
          const top = scrollState[key];
          if (typeof top !== "number") {
            return;
          }

          const element = root.querySelector(selector);
          if (isScrollableElement(element)) {
            element.scrollTop = top;
          }
        });
      },
    };
  };
})(window);

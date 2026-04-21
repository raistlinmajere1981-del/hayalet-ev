(function(global) {
  const FEATURE_SCROLL_SELECTORS = {
    xoxRail: ".xox-rail",
    xoxStage: ".xox-stage",
    teamTetrisRail: ".tt-rail",
    teamTetrisStage: ".tt-stage",
    fateKnotsSurface: ".fk-surface__inner"
  };
  function isRecord(value) {
    return typeof value === "object" && value !== null && Array.isArray(value) === false;
  }
  function canQuerySelector(value) {
    return typeof value === "object" && value !== null && typeof value.querySelector === "function";
  }
  function isScrollableElement(value) {
    return value instanceof HTMLElement;
  }
  const registry = global.GameRoomUiScrollRuntime || (global.GameRoomUiScrollRuntime = {});
  registry.createGameRoomUiScrollRuntime = function createGameRoomUiScrollRuntime() {
    return {
      capture(root) {
        if (!canQuerySelector(root)) {
          return {};
        }
        const scrollState = {};
        Object.entries(FEATURE_SCROLL_SELECTORS).forEach(
          function([key, selector]) {
            const element = root.querySelector(selector);
            if (isScrollableElement(element)) {
              scrollState[key] = element.scrollTop;
            }
          }
        );
        return scrollState;
      },
      restore(root, scrollState) {
        if (isRecord(scrollState) === false || !canQuerySelector(root)) {
          return;
        }
        Object.entries(FEATURE_SCROLL_SELECTORS).forEach(
          function([key, selector]) {
            const top = scrollState[key];
            if (typeof top !== "number") {
              return;
            }
            const element = root.querySelector(selector);
            if (isScrollableElement(element)) {
              element.scrollTop = top;
            }
          }
        );
      }
    };
  };
})(window);

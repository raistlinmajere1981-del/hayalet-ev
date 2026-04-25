import { reduceForgeRuntimeState } from "./forge-runtime-reducer.js";
export function createForgeRuntimeStore(initialState) {
  let state = initialState;
  const listeners = /* @__PURE__ */ new Set();
  function getState() {
    return state;
  }
  function dispatch(action) {
    state = reduceForgeRuntimeState(state, action);
    listeners.forEach((listener) => {
      listener(state);
    });
    return state;
  }
  function subscribe(listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }
  return {
    dispatch,
    getState,
    subscribe
  };
}

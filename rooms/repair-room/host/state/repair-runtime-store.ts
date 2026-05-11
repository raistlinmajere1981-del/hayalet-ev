import type { RepairRuntimeAction } from "./repair-runtime-actions.js";
import { reduceRepairRuntimeState } from "./repair-runtime-reducer.js";
import type { RepairRuntimeState } from "./repair-runtime-state.js";

export interface RepairRuntimeStore {
  dispatch: (action: RepairRuntimeAction) => RepairRuntimeState;
  getState: () => RepairRuntimeState;
  subscribe: (listener: (state: RepairRuntimeState) => void) => () => void;
}

export function createRepairRuntimeStore(initialState: RepairRuntimeState): RepairRuntimeStore {
  let state = initialState;
  const listeners = new Set<(state: RepairRuntimeState) => void>();

  function getState(): RepairRuntimeState {
    return state;
  }

  function dispatch(action: RepairRuntimeAction): RepairRuntimeState {
    state = reduceRepairRuntimeState(state, action);
    listeners.forEach((listener) => {
      listener(state);
    });
    return state;
  }

  function subscribe(listener: (state: RepairRuntimeState) => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  return { dispatch, getState, subscribe };
}

import type { LabPersistedState } from "../models/lab-types.js";

const LAB_PERSISTENCE_KEY = "hayalet-ev:laboratory-refactor:v2";

type PersistenceWindow = Window & typeof globalThis;

function getStorage(windowRef: PersistenceWindow | undefined) {
  try {
    return windowRef?.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadLabPersistedState(windowRef: PersistenceWindow | undefined) {
  const storage = getStorage(windowRef);
  if (!storage) {
    return null;
  }

  try {
    const rawValue = storage.getItem(LAB_PERSISTENCE_KEY);
    if (!rawValue) {
      return null;
    }
    return JSON.parse(rawValue) as Partial<LabPersistedState>;
  } catch {
    return null;
  }
}

export function saveLabPersistedState(
  windowRef: PersistenceWindow | undefined,
  state: LabPersistedState
) {
  const storage = getStorage(windowRef);
  if (!storage) {
    return;
  }

  try {
    storage.setItem(LAB_PERSISTENCE_KEY, JSON.stringify(state));
  } catch {
    // NOTE: Persistence is best-effort only.
  }
}

const LAB_PERSISTENCE_KEY = "hayalet-ev:laboratory-refactor:v2";
function getStorage(windowRef) {
  try {
    return windowRef?.localStorage ?? null;
  } catch {
    return null;
  }
}
export function loadLabPersistedState(windowRef) {
  const storage = getStorage(windowRef);
  if (!storage) {
    return null;
  }
  try {
    const rawValue = storage.getItem(LAB_PERSISTENCE_KEY);
    if (!rawValue) {
      return null;
    }
    return JSON.parse(rawValue);
  } catch {
    return null;
  }
}
export function saveLabPersistedState(windowRef, state) {
  const storage = getStorage(windowRef);
  if (!storage) {
    return;
  }
  try {
    storage.setItem(LAB_PERSISTENCE_KEY, JSON.stringify(state));
  } catch {
  }
}

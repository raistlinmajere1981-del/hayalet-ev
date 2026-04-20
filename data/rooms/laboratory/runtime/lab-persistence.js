const LAB_PERSISTENCE_KEY = "hayalet-ev:laboratory-refactor:v4";
const LAB_LEGACY_PERSISTENCE_KEYS = [
  "hayalet-ev:laboratory-refactor:v3",
  "hayalet-ev:laboratory-refactor:v2"
];
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
    const candidateKeys = [LAB_PERSISTENCE_KEY].concat(LAB_LEGACY_PERSISTENCE_KEYS);
    for (const key of candidateKeys) {
      const rawValue = storage.getItem(key);
      if (!rawValue) {
        continue;
      }
      const parsed = JSON.parse(rawValue);
      const migrated = migratePersistedState(parsed);
      if (key !== LAB_PERSISTENCE_KEY) {
        storage.setItem(LAB_PERSISTENCE_KEY, JSON.stringify(migrated));
      }
      return migrated;
    }
    return null;
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
function migratePersistedState(persisted) {
  return {
    ...persisted,
    schemaVersion: 4,
    activityFeed: Array.isArray(persisted.activityFeed) ? persisted.activityFeed : [],
    activePreviewArtifactId: typeof persisted.activePreviewArtifactId === "string" ? persisted.activePreviewArtifactId : null,
    liveFindingsExpanded: persisted.liveFindingsExpanded !== false,
    analysisControlsCollapsed: persisted.analysisControlsCollapsed === true
  };
}

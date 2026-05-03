import type { LabPersistedState } from "../models/lab-types.js";

const LAB_PERSISTENCE_KEY = "hayalet-ev:laboratory-refactor:v4";
const LAB_LEGACY_PERSISTENCE_KEYS = [
  "hayalet-ev:laboratory-refactor:v3",
  "hayalet-ev:laboratory-refactor:v2",
];

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
    const candidateKeys = [LAB_PERSISTENCE_KEY].concat(LAB_LEGACY_PERSISTENCE_KEYS);
    for (const key of candidateKeys) {
      const rawValue = storage.getItem(key);
      if (!rawValue) {
        continue;
      }
      const parsed = JSON.parse(rawValue) as Partial<LabPersistedState> & {
        schemaVersion?: unknown;
      };
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

function migratePersistedState(
  persisted: Partial<LabPersistedState> & { schemaVersion?: unknown }
): Partial<LabPersistedState> {
  return {
    ...persisted,
    schemaVersion: 4,
    activityFeed: Array.isArray(persisted.activityFeed) ? persisted.activityFeed : [],
    selectedCapabilities: Array.isArray(persisted.selectedCapabilities)
      ? persisted.selectedCapabilities
      : [],
    activePreviewArtifactId:
      typeof persisted.activePreviewArtifactId === "string"
        ? persisted.activePreviewArtifactId
        : null,
    liveFindingsExpanded: persisted.liveFindingsExpanded !== false,
    analysisControlsCollapsed: persisted.analysisControlsCollapsed === true,
    editSidePanelCollapsed: persisted.editSidePanelCollapsed === true,
    rawLogCollapsed: persisted.rawLogCollapsed !== false,
  };
}

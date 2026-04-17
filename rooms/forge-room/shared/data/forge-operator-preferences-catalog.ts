import type { ForgeOperatorPreferenceCatalogEntry } from "../types/forge-preflight.js";

export const FORGE_OPERATOR_PREFERENCES_CATALOG: ForgeOperatorPreferenceCatalogEntry[] = [
  {
    key: "mode",
    label: "Mode",
    translationKey: "mode",
    options: ["learn_first", "result_first"],
    applicableRooms: ["forge-room"],
    description: "Whether the operator prefers learning-oriented guidance or result-first output.",
  },
  {
    key: "riskTolerance",
    label: "Risk tolerance",
    translationKey: "risk",
    options: ["low", "medium", "high"],
    applicableRooms: ["forge-room"],
    description: "How conservative the run should stay when multiple paths exist.",
  },
];

export function listForgeOperatorPreferencesCatalog(
  roomId = "forge-room"
): ForgeOperatorPreferenceCatalogEntry[] {
  return FORGE_OPERATOR_PREFERENCES_CATALOG.filter((entry) => {
    return entry.applicableRooms === undefined || entry.applicableRooms.includes(roomId);
  }).map((entry) => ({
    ...entry,
    options: [...entry.options],
  }));
}

export function findForgeOperatorPreferenceCatalogEntry(
  key: string
): ForgeOperatorPreferenceCatalogEntry | null {
  return FORGE_OPERATOR_PREFERENCES_CATALOG.find((entry) => entry.key === key) ?? null;
}

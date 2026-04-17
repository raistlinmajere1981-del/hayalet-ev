import type { ForgeOperatorCatalogEntry } from "../types/forge-preflight.js";

export const FORGE_OPERATOR_SKILLS_CATALOG: ForgeOperatorCatalogEntry[] = [
  {
    key: "soldering",
    label: "Soldering",
    translationKey: "soldering",
    group: "skills",
    applicableRooms: ["forge-room"],
    description: "Comfort level with hand soldering, rework, and pad-safe thermal handling.",
  },
  {
    key: "measurement",
    label: "Measurement",
    translationKey: "measurement",
    group: "skills",
    applicableRooms: ["forge-room"],
    description: "Confidence in continuity, voltage, and circuit measurement workflows.",
  },
  {
    key: "mechanical",
    label: "Mechanical",
    translationKey: "mechanical",
    group: "skills",
    applicableRooms: ["forge-room"],
    description: "Comfort level with disassembly, alignment, fasteners, and mechanical fit.",
  },
];

export function listForgeOperatorSkillsCatalog(roomId = "forge-room"): ForgeOperatorCatalogEntry[] {
  return FORGE_OPERATOR_SKILLS_CATALOG.filter((entry) => {
    return entry.applicableRooms === undefined || entry.applicableRooms.includes(roomId);
  }).map((entry) => ({ ...entry }));
}

export function findForgeOperatorSkillCatalogEntry(
  skillKey: string
): ForgeOperatorCatalogEntry | null {
  return FORGE_OPERATOR_SKILLS_CATALOG.find((entry) => entry.key === skillKey) ?? null;
}

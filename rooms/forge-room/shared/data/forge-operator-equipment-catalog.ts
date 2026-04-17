import type { ForgeOperatorCatalogEntry } from "../types/forge-preflight.js";

export const FORGE_OPERATOR_EQUIPMENT_CATALOG: ForgeOperatorCatalogEntry[] = [
  {
    key: "multimeter",
    label: "Multimeter",
    translationKey: "multimeter",
    group: "equipment",
    applicableRooms: ["forge-room"],
    description: "Basic diagnostic meter for continuity, resistance, and voltage checks.",
  },
  {
    key: "soldering_iron",
    label: "Soldering iron",
    translationKey: "solderingIron",
    group: "equipment",
    applicableRooms: ["forge-room"],
    description: "Primary iron for through-hole work, touch-up, and light rework.",
  },
  {
    key: "hot_air",
    label: "Hot air",
    translationKey: "hotAir",
    group: "equipment",
    applicableRooms: ["forge-room"],
    description: "Hot air station for reflow, rework, and shrink / heat-assisted handling.",
  },
  {
    key: "bench_supply",
    label: "Bench supply",
    translationKey: "benchSupply",
    group: "equipment",
    applicableRooms: ["forge-room"],
    description: "Bench power supply for controlled bring-up and current-limited testing.",
  },
  {
    key: "magnification",
    label: "Magnification",
    translationKey: "magnification",
    group: "equipment",
    applicableRooms: ["forge-room"],
    description: "Microscope or magnifier support for fine-pitch inspection and alignment.",
  },
];

export function listForgeOperatorEquipmentCatalog(
  roomId = "forge-room"
): ForgeOperatorCatalogEntry[] {
  return FORGE_OPERATOR_EQUIPMENT_CATALOG.filter((entry) => {
    return entry.applicableRooms === undefined || entry.applicableRooms.includes(roomId);
  }).map((entry) => ({ ...entry }));
}

export function findForgeOperatorEquipmentCatalogEntry(
  equipmentKey: string
): ForgeOperatorCatalogEntry | null {
  return FORGE_OPERATOR_EQUIPMENT_CATALOG.find((entry) => entry.key === equipmentKey) ?? null;
}

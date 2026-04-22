import {
  FORGE_OPERATOR_PREFERENCE_KEYS
} from "../types/index.js";
export const FORGE_ACTIVE_OPERATOR_SKILL_KEYS = ["measurement"];
export const FORGE_ACTIVE_OPERATOR_EQUIPMENT_KEYS = ["multimeter"];
const ACTIVE_SKILL_KEYS = new Set(FORGE_ACTIVE_OPERATOR_SKILL_KEYS);
const ACTIVE_EQUIPMENT_KEYS = new Set(FORGE_ACTIVE_OPERATOR_EQUIPMENT_KEYS);
const ACTIVE_PREFERENCE_KEYS = new Set(FORGE_OPERATOR_PREFERENCE_KEYS);
export function filterForgeActiveSkillKeys(skillKeys) {
  return skillKeys.filter((key) => ACTIVE_SKILL_KEYS.has(key));
}
export function filterForgeActiveEquipmentKeys(equipmentKeys) {
  return equipmentKeys.filter((key) => ACTIVE_EQUIPMENT_KEYS.has(key));
}
export function filterForgeActivePreferenceKeys(preferenceKeys) {
  return preferenceKeys.filter(
    (key) => ACTIVE_PREFERENCE_KEYS.has(key)
  );
}

export const FORGE_SEAT_IDS = ["ai1", "ai2", "us1"];
export const FORGE_ROLE_IDS = [
  "architect",
  "challenger",
  "external-perspective",
  "coordinator"
];
export const FORGE_PERSONA_PRESET_IDS = ["gok", "rovo"];
export function isForgeSeatId(value) {
  return typeof value === "string" && FORGE_SEAT_IDS.includes(value);
}
export function isForgeRoleId(value) {
  return typeof value === "string" && FORGE_ROLE_IDS.includes(value);
}
export function isForgePersonaPresetId(value) {
  return typeof value === "string" && FORGE_PERSONA_PRESET_IDS.includes(value);
}

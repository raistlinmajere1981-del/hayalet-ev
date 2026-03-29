export const ROOM_ID = "game-room";
export const PAGE_ID = "room:game-room:xox";
export const FEATURE_ID = "xox";
export const TEAM_TETRIS_FEATURE_ID = "team-tetris";
export const TEAM_TETRIS_PAGE_ID = "room:game-room:team-tetris";
export const FATE_KNOTS_FEATURE_ID = "fate-knots";
export const FATE_KNOTS_PAGE_ID = "room:game-room:fate-knots";
const FEATURE_CATALOG = [
  {
    id: FEATURE_ID,
    name: "XOX"
  },
  {
    id: TEAM_TETRIS_FEATURE_ID,
    name: "Team Tetris"
  },
  {
    id: FATE_KNOTS_FEATURE_ID,
    name: "Fate Knots"
  }
];
export function getFeatureName(featureId) {
  const feature = FEATURE_CATALOG.find((entry) => entry.id === featureId);
  return feature ? feature.name : "XOX";
}
export function normalizeFeatureId(value) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return FEATURE_CATALOG.some((entry) => entry.id === normalized) ? normalized : FEATURE_ID;
}
export function sanitizeFeatureRecord(candidate, fallbackId) {
  const source = candidate && typeof candidate === "object" && Array.isArray(candidate) === false ? candidate : {};
  const featureId = normalizeFeatureId(source.id ?? fallbackId);
  const name = typeof source.name === "string" && source.name.trim() !== "" ? source.name.trim() : getFeatureName(featureId);
  const description = typeof source.description === "string" ? source.description.trim() : "";
  return {
    id: featureId,
    name,
    description
  };
}
export function getDefaultFeatureRecords() {
  return FEATURE_CATALOG.map((feature) => sanitizeFeatureRecord(feature, feature.id));
}

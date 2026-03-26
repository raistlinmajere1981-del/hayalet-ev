export const ROOM_ID = "game-room";
export const PAGE_ID = "room:game-room:xox";
export const FEATURE_ID = "xox";
export const TEAM_TETRIS_FEATURE_ID = "team-tetris";
export const TEAM_TETRIS_PAGE_ID = "room:game-room:team-tetris";

export function getFeatureName(featureId) {
  return featureId === TEAM_TETRIS_FEATURE_ID ? "Team Tetris" : "XOX";
}

export function normalizeFeatureId(value) {
  return value === TEAM_TETRIS_FEATURE_ID ? TEAM_TETRIS_FEATURE_ID : FEATURE_ID;
}

export function sanitizeFeatureRecord(candidate, fallbackId) {
  const source =
    candidate && typeof candidate === "object" && Array.isArray(candidate) === false
      ? candidate
      : {};
  const featureId = normalizeFeatureId(source.id || fallbackId);
  const name =
    typeof source.name === "string" && source.name.trim() !== ""
      ? source.name.trim()
      : getFeatureName(featureId);
  const description =
    typeof source.description === "string" ? source.description.trim() : "";

  return {
    id: featureId,
    name,
    description,
  };
}

export function getDefaultFeatureRecords() {
  return [
    sanitizeFeatureRecord({ id: FEATURE_ID, name: getFeatureName(FEATURE_ID) }, FEATURE_ID),
    sanitizeFeatureRecord(
      { id: TEAM_TETRIS_FEATURE_ID, name: getFeatureName(TEAM_TETRIS_FEATURE_ID) },
      TEAM_TETRIS_FEATURE_ID
    ),
  ];
}

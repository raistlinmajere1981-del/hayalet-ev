const SCENE_DEBUG_QUERY_KEY = "sceneDebug";
const SCENE_DEBUG_ATTRIBUTE = "data-scene-debug";

export function isSceneDebugEnabled(): boolean {
  try {
    const params = new URLSearchParams(window.location.search);
    const value = (params.get(SCENE_DEBUG_QUERY_KEY) ?? "").trim().toLowerCase();
    return value === "1" || value === "true" || value === "yes" || value === "debug";
  } catch {
    return false;
  }
}

export function applySceneDebugFlag(): boolean {
  const enabled = isSceneDebugEnabled();
  document.documentElement.setAttribute(SCENE_DEBUG_ATTRIBUTE, enabled ? "true" : "false");
  return enabled;
}

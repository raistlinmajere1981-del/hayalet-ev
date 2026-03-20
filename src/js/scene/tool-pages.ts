export const SCENE_TOOL_OPEN_EVENT = "scene-tool:open";
export const SCENE_TOOL_CLOSE_EVENT = "scene-tool:close";
export const SCENE_TOOL_HOST_SHOW_EVENT = "scene-tool:host-show";
export const SCENE_TOOL_HOST_HIDE_EVENT = "scene-tool:host-hide";

export type SceneToolPageName = "archives" | "whisper";

export interface SceneToolEventDetail {
  tool: SceneToolPageName;
}

export function isSceneToolPageName(value: string | null | undefined): value is SceneToolPageName {
  return value === "archives" || value === "whisper";
}

export function getSceneToolHostPage(tool: SceneToolPageName): "analyze" | "entrance" {
  return tool === "archives" ? "analyze" : "entrance";
}

function dispatchSceneToolEvent(eventName: string, tool: SceneToolPageName): void {
  document.dispatchEvent(
    new CustomEvent<SceneToolEventDetail>(eventName, {
      detail: { tool },
    })
  );
}

export function openSceneTool(tool: SceneToolPageName): void {
  dispatchSceneToolEvent(SCENE_TOOL_OPEN_EVENT, tool);
}

export function closeSceneTool(tool: SceneToolPageName): void {
  dispatchSceneToolEvent(SCENE_TOOL_CLOSE_EVENT, tool);
}

export function notifySceneToolHostShow(tool: SceneToolPageName): void {
  dispatchSceneToolEvent(SCENE_TOOL_HOST_SHOW_EVENT, tool);
}

export function notifySceneToolHostHide(tool: SceneToolPageName): void {
  dispatchSceneToolEvent(SCENE_TOOL_HOST_HIDE_EVENT, tool);
}

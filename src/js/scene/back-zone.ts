import { getSceneBackZonePolicy } from "./theme-pack.js";

export const SCENE_BACK_ZONE_SIDES = ["left", "right"] as const;

export type SceneBackZoneSide = (typeof SCENE_BACK_ZONE_SIDES)[number];

function isSceneBackZoneSide(value: string | undefined): value is SceneBackZoneSide {
  return value === "left" || value === "right";
}

export function bindSceneBackZones(
  root: ParentNode,
  onBack: (side: SceneBackZoneSide, event: Event) => void
): void {
  const configuredSides = new Set(getSceneBackZonePolicy().sides);
  const backZones = root.querySelectorAll<HTMLElement>("[data-scene-back-zone]");

  backZones.forEach((backZone) => {
    if (backZone.dataset["sceneBackZoneBound"] === "true") {
      return;
    }

    backZone.dataset["sceneBackZoneBound"] = "true";
    backZone.addEventListener("click", (event) => {
      const side = backZone.dataset["sceneBackZone"];
      if (!isSceneBackZoneSide(side) || !configuredSides.has(side)) {
        return;
      }

      onBack(side, event);
    });
  });
}

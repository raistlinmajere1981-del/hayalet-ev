export type UiModeToggleState = "classic" | "scene" | "scene-debug";
export type UiModeOptionState = UiModeToggleState | "ghost-agent";

export interface UiModeRestartOptions {
  uiMode: "classic" | "scene";
  sceneDebug: boolean;
}

export interface UiModeOptionDefinition {
  state: UiModeOptionState;
  icon: string;
  labelKey: string;
  behavior: "restart" | "ghost-agent";
  restartOptions?: UiModeRestartOptions;
}

const UI_MODE_OPTION_DEFINITIONS = [
  {
    state: "classic",
    icon: "C",
    labelKey: "uiMode.options.classic",
    behavior: "restart",
    restartOptions: {
      uiMode: "classic",
      sceneDebug: false,
    },
  },
  {
    state: "scene",
    icon: "S",
    labelKey: "uiMode.options.scene",
    behavior: "restart",
    restartOptions: {
      uiMode: "scene",
      sceneDebug: false,
    },
  },
  {
    state: "scene-debug",
    icon: "D",
    labelKey: "uiMode.options.sceneDebug",
    behavior: "restart",
    restartOptions: {
      uiMode: "scene",
      sceneDebug: true,
    },
  },
  {
    state: "ghost-agent",
    icon: "G",
    labelKey: "assistant.page.ghostAgentButton",
    behavior: "ghost-agent",
  },
] as const satisfies readonly UiModeOptionDefinition[];

function getUiModeOptionDefinition(state: UiModeOptionState): UiModeOptionDefinition | undefined {
  return UI_MODE_OPTION_DEFINITIONS.find((option) => option.state === state);
}

export function getUiModeOptionDefinitions(): readonly UiModeOptionDefinition[] {
  return UI_MODE_OPTION_DEFINITIONS;
}

export function isUiModeOptionState(value: string): value is UiModeOptionState {
  return UI_MODE_OPTION_DEFINITIONS.some((option) => option.state === value);
}

export function isUiModeToggleState(value: string): value is UiModeToggleState {
  return value !== "ghost-agent" && isUiModeOptionState(value);
}

export function getUiModeToggleState(
  root: Element | null = typeof document !== "undefined" ? document.documentElement : null
): UiModeToggleState {
  const uiMode = root?.getAttribute("data-ui-mode");
  if (uiMode !== "scene") {
    return "classic";
  }

  const sceneDebug = root?.getAttribute("data-scene-debug");
  return sceneDebug === "true" ? "scene-debug" : "scene";
}

export function getUiModeLabelKey(state: UiModeToggleState): string {
  return getUiModeOptionDefinition(state)?.labelKey ?? "uiMode.options.classic";
}

export function getUiModeRestartOptions(state: UiModeToggleState): UiModeRestartOptions {
  return (
    getUiModeOptionDefinition(state)?.restartOptions ?? {
      uiMode: "classic",
      sceneDebug: false,
    }
  );
}

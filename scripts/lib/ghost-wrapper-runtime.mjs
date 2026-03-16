export function defaultControl(now = new Date().toISOString()) {
  return {
    workflowSessionId: "",
    desiredMode: "soft",
    phase: "idle",
    updatedAt: now,
  };
}

export function normalizeControl(raw, now = new Date().toISOString()) {
  const base = defaultControl(now);
  const data = typeof raw === "object" && raw !== null ? raw : {};

  const desiredModeRaw = typeof data.desiredMode === "string" ? data.desiredMode : base.desiredMode;
  const desiredMode = ["terminal", "soft", "ghost-agent"].includes(desiredModeRaw)
    ? desiredModeRaw
    : base.desiredMode;

  const phaseRaw = typeof data.phase === "string" ? data.phase : base.phase;
  const phase = ["idle", "preparing-handoff", "in-ghost", "returning"].includes(phaseRaw)
    ? phaseRaw
    : base.phase;

  return {
    workflowSessionId:
      typeof data.workflowSessionId === "string" ? data.workflowSessionId : base.workflowSessionId,
    desiredMode,
    phase,
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : base.updatedAt,
  };
}

export function shouldStartGhost(control) {
  if (control.desiredMode !== "ghost-agent") return false;
  return control.phase === "preparing-handoff" || control.phase === "in-ghost";
}

export function toGhostRunningControl(control, now = new Date().toISOString()) {
  return normalizeControl({
    ...control,
    phase: "in-ghost",
    updatedAt: now,
  });
}

export function toPostGhostControl(control, now = new Date().toISOString()) {
  return normalizeControl({
    ...control,
    desiredMode: control.desiredMode === "ghost-agent" ? "soft" : control.desiredMode,
    phase: "idle",
    updatedAt: now,
  });
}

export function shouldReopenMainAfterGhost(control) {
  return control.desiredMode !== "terminal";
}

export function toGhostOnlyStartControl(control, now = new Date().toISOString()) {
  return normalizeControl({
    ...control,
    desiredMode: "ghost-agent",
    phase: "in-ghost",
    updatedAt: now,
  });
}

export function toMainRunningControl(control, now = new Date().toISOString()) {
  return normalizeControl({
    ...control,
    desiredMode: "soft",
    phase: "idle",
    updatedAt: now,
  });
}

export function normalizeMainAppUiMode(uiMode) {
  return uiMode === "scene" ? "scene" : "classic";
}

export function resolveMainAppScriptName(useAssistantStartupFlags = false, uiMode = "classic") {
  const normalizedUiMode = normalizeMainAppUiMode(uiMode);

  if (useAssistantStartupFlags) {
    return normalizedUiMode === "scene" ? "electron:dev:assistant:scene" : "electron:dev:assistant";
  }

  return normalizedUiMode === "scene" ? "electron:dev:scene" : "electron:dev";
}

export function buildMainAppLaunchArgs(mainEntry, useAssistantStartupFlags = false) {
  const args = [mainEntry, "--no-sandbox"];
  if (useAssistantStartupFlags) {
    args.push("--start-page=assistant", "--auto-connect");
  }
  return args;
}

export function formatWrapperEvent(event, details = {}, now = new Date().toISOString()) {
  const detailEntries = Object.entries(details)
    .filter((entry) => entry[1] !== undefined && entry[1] !== null && entry[1] !== "")
    .map(([key, value]) => `${key}=${String(value)}`);

  return `[${now}] ${event}${detailEntries.length > 0 ? ` ${detailEntries.join(" ")}` : ""}`;
}

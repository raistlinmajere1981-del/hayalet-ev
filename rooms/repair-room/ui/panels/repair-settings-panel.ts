import type { RepairUiState } from "../../shared/ui/state.js";
import { createRepairPanel } from "./panel-shell.js";

type TextFn = (path: string[], fallback: string) => string;

type RepairSettingsButtonDataset = Record<string, string>;

function getRouteLabel(route: "local" | "android"): string {
  return route === "android" ? "Android" : "Local";
}

function getAssistanceProfileLabel(maxAiInterruptions: number): string {
  if (maxAiInterruptions <= 1) return "Quiet";
  if (maxAiInterruptions === 2) return "Balanced";
  return "Proactive";
}

function createSettingsSection(
  documentRef: Document,
  title: string,
  subtitle: string
): HTMLElement {
  const section = documentRef.createElement("section");
  section.className = "repair-settings-section";

  const header = documentRef.createElement("div");
  header.className = "repair-settings-section__header";

  const titleEl = documentRef.createElement("h3");
  titleEl.className = "repair-settings-section__title";
  titleEl.textContent = title;
  header.append(titleEl);

  const subtitleEl = documentRef.createElement("p");
  subtitleEl.className = "repair-settings-section__subtitle";
  subtitleEl.textContent = subtitle;
  header.append(subtitleEl);

  section.append(header);
  return section;
}

function createButtonGroup(
  documentRef: Document,
  label: string
): { group: HTMLElement; buttons: HTMLElement } {
  const group = documentRef.createElement("div");
  group.className = "repair-settings-group";

  const labelEl = documentRef.createElement("span");
  labelEl.className = "repair-settings-group__label";
  labelEl.textContent = label;
  group.append(labelEl);

  const buttons = documentRef.createElement("div");
  buttons.className = "repair-settings-group__buttons";
  buttons.dataset["repairSettingsButtons"] = label;
  group.append(buttons);

  return { group, buttons };
}

function appendSettingsButton(
  documentRef: Document,
  parent: HTMLElement,
  options: {
    label: string;
    title: string;
    action: string;
    active?: boolean;
    dataset: RepairSettingsButtonDataset;
  }
): void {
  const button = documentRef.createElement("button");
  button.type = "button";
  button.className = `repair-settings-button${
    options.active === true ? " repair-settings-button--active" : ""
  }`;
  button.textContent = options.label;
  button.title = options.title;
  button.dataset["repairAction"] = options.action;
  Object.entries(options.dataset).forEach(([key, value]) => {
    button.dataset[key] = value;
  });
  parent.append(button);
}

export function renderRepairSettingsPanel(
  documentRef: Document,
  state: RepairUiState,
  text: TextFn
): HTMLElement {
  const body = documentRef.createElement("div");
  body.className = "repair-panel__body repair-settings-panel";

  const voice = state.layout.voiceGuidance;
  const settings = state.layout.interactionSettings;
  const handsFreeEnabled = voice.handsBusyMode && voice.ambientListeningState === "listening";

  const summary = documentRef.createElement("div");
  summary.className = "repair-settings-summary";
  summary.textContent = `Mic: ${getRouteLabel(settings.dictationRoute)} / Read aloud: ${getRouteLabel(settings.ttsRoute)} / View: ${settings.cameraFeedPreference === "android-feed" ? "Android camera" : "Manual image"}`;
  body.append(summary);

  const handsFree = createSettingsSection(
    documentRef,
    text(["settings", "handsFreeTitle"], "Hands-free repair"),
    text(
      ["settings", "handsFreeSubtitle"],
      "Choose how the assistant listens, speaks, and handles voice notes while your hands are busy."
    )
  );

  const handsGroup = createButtonGroup(documentRef, text(["settings", "mode"], "Stance"));
  appendSettingsButton(documentRef, handsGroup.buttons, {
    label: text(["settings", "handsFree"], "Guide me"),
    title: handsFreeEnabled
      ? "Return to manual repair controls"
      : "Enable hands-free listening and step guidance",
    action: "set-voice-guidance",
    active: handsFreeEnabled,
    dataset: {
      handsBusyMode: handsFreeEnabled ? "false" : "true",
      ambientListeningState: handsFreeEnabled ? "idle" : "listening",
      spokenGuidanceMode: handsFreeEnabled ? voice.spokenGuidanceMode : "step-by-step",
    },
  });
  appendSettingsButton(documentRef, handsGroup.buttons, {
    label: text(["settings", "readReplies"], "Read replies aloud"),
    title: settings.autoReadAiReplies
      ? "Disable automatic AI reply reading"
      : "Read AI replies aloud",
    action: "set-interaction-settings",
    active: settings.autoReadAiReplies,
    dataset: { autoReadAiReplies: String(!settings.autoReadAiReplies) },
  });
  handsFree.append(handsGroup.group);

  const ambientGroup = createButtonGroup(documentRef, text(["settings", "ambient"], "Ambient"));
  (["idle", "listening", "muted"] as const).forEach((ambientListeningState) => {
    appendSettingsButton(documentRef, ambientGroup.buttons, {
      label:
        ambientListeningState === "idle"
          ? text(["settings", "ambientIdle"], "Standby")
          : ambientListeningState === "listening"
            ? text(["settings", "ambientListening"], "Short listen")
            : text(["settings", "ambientMuted"], "Muted"),
      title:
        ambientListeningState === "idle"
          ? "Keep the assistant ready but not listening"
          : ambientListeningState === "listening"
            ? "Listen for short repair commands"
            : "Mute ambient command listening",
      action: "set-voice-guidance",
      active: voice.ambientListeningState === ambientListeningState,
      dataset: {
        ambientListeningState,
        spokenGuidanceMode: voice.spokenGuidanceMode,
        handsBusyMode: String(voice.handsBusyMode),
      },
    });
  });
  handsFree.append(ambientGroup.group);

  const spokenGroup = createButtonGroup(documentRef, text(["settings", "spoken"], "Read aloud"));
  (["silent", "brief", "step-by-step"] as const).forEach((spokenGuidanceMode) => {
    appendSettingsButton(documentRef, spokenGroup.buttons, {
      label:
        spokenGuidanceMode === "silent"
          ? text(["settings", "spokenSilent"], "Silent")
          : spokenGuidanceMode === "brief"
            ? text(["settings", "spokenBrief"], "Brief")
            : text(["settings", "spokenStep"], "Step-by-step"),
      title:
        spokenGuidanceMode === "silent"
          ? "Do not read guidance aloud"
          : spokenGuidanceMode === "brief"
            ? "Read only short guidance prompts"
            : "Read each guided repair step aloud",
      action: "set-voice-guidance",
      active: voice.spokenGuidanceMode === spokenGuidanceMode,
      dataset: {
        ambientListeningState: voice.ambientListeningState,
        spokenGuidanceMode,
        handsBusyMode: String(voice.handsBusyMode),
      },
    });
  });
  handsFree.append(spokenGroup.group);

  const submitGroup = createButtonGroup(
    documentRef,
    text(["settings", "dictationSubmit"], "Voice notes")
  );
  (["composer", "send"] as const).forEach((dictationSubmitMode) => {
    appendSettingsButton(documentRef, submitGroup.buttons, {
      label:
        dictationSubmitMode === "composer"
          ? text(["settings", "dictationComposer"], "Review first")
          : text(["settings", "dictationSend"], "Send after voice"),
      title:
        dictationSubmitMode === "composer"
          ? "Place dictated text in the composer"
          : "Send dictated text to AI when accepted",
      action: "set-interaction-settings",
      active: settings.dictationSubmitMode === dictationSubmitMode,
      dataset: { dictationSubmitMode },
    });
  });
  handsFree.append(submitGroup.group);
  body.append(handsFree);

  const companion = createSettingsSection(
    documentRef,
    text(["settings", "companionTitle"], "Android companion"),
    text(
      ["settings", "companionSubtitle"],
      "Choose where the repair mic, speaker, and camera come from."
    )
  );

  const companionGroup = createButtonGroup(
    documentRef,
    text(["settings", "companion"], "Phone link")
  );
  appendSettingsButton(documentRef, companionGroup.buttons, {
    label: settings.androidCompanionEnabled
      ? text(["settings", "enabled"], "Phone ready")
      : text(["settings", "disabled"], "Phone off"),
    title: settings.androidCompanionEnabled
      ? "Disable Android companion for Repair Room"
      : "Enable Android companion for Repair Room",
    action: "set-interaction-settings",
    active: settings.androidCompanionEnabled,
    dataset: { androidCompanionEnabled: String(!settings.androidCompanionEnabled) },
  });
  companion.append(companionGroup.group);

  const dictationGroup = createButtonGroup(
    documentRef,
    text(["settings", "dictationRoute"], "Microphone")
  );
  (["local", "android"] as const).forEach((dictationRoute) => {
    appendSettingsButton(documentRef, dictationGroup.buttons, {
      label:
        dictationRoute === "local"
          ? text(["settings", "local"], "Local")
          : text(["settings", "android"], "Android"),
      title: `Use ${dictationRoute} dictation for Repair Room`,
      action: "set-interaction-settings",
      active: settings.dictationRoute === dictationRoute,
      dataset: { dictationRoute },
    });
  });
  companion.append(dictationGroup.group);

  const ttsGroup = createButtonGroup(documentRef, text(["settings", "ttsRoute"], "Speaker"));
  (["local", "android"] as const).forEach((ttsRoute) => {
    appendSettingsButton(documentRef, ttsGroup.buttons, {
      label:
        ttsRoute === "local"
          ? text(["settings", "local"], "Local")
          : text(["settings", "android"], "Android"),
      title: `Use ${ttsRoute} TTS for Repair Room`,
      action: "set-interaction-settings",
      active: settings.ttsRoute === ttsRoute,
      dataset: { ttsRoute },
    });
  });
  companion.append(ttsGroup.group);

  const cameraGroup = createButtonGroup(documentRef, text(["settings", "camera"], "View"));
  (["manual", "android-feed"] as const).forEach((cameraFeedPreference) => {
    appendSettingsButton(documentRef, cameraGroup.buttons, {
      label:
        cameraFeedPreference === "manual"
          ? text(["settings", "cameraManual"], "Attach image")
          : text(["settings", "cameraAndroid"], "Phone camera"),
      title:
        cameraFeedPreference === "manual"
          ? "Use manually attached workbench media"
          : "Prefer Android companion camera feed",
      action: "set-interaction-settings",
      active: settings.cameraFeedPreference === cameraFeedPreference,
      dataset: { cameraFeedPreference },
    });
  });
  companion.append(cameraGroup.group);
  body.append(companion);

  const attention = createSettingsSection(
    documentRef,
    text(["settings", "attentionTitle"], "Assistance profile"),
    text(
      ["settings", "attentionSubtitle"],
      "Choose how often the assistant can interrupt while your hands are busy."
    )
  );
  const budgetGroup = createButtonGroup(documentRef, text(["settings", "budget"], "Interruptions"));
  ([1, 2, 3] as const).forEach((maxAiInterruptions) => {
    appendSettingsButton(documentRef, budgetGroup.buttons, {
      label: getAssistanceProfileLabel(maxAiInterruptions),
      title: `Use ${getAssistanceProfileLabel(maxAiInterruptions).toLowerCase()} assistance (${maxAiInterruptions} interruptions per window)`,
      action: "set-attention-budget",
      active: state.layout.attentionBudget.maxAiInterruptions === maxAiInterruptions,
      dataset: {
        maxAiInterruptions: String(maxAiInterruptions),
        windowMs: String(state.layout.attentionBudget.windowMs),
      },
    });
  });
  attention.append(budgetGroup.group);
  body.append(attention);

  return createRepairPanel(documentRef, {
    panelId: "repair-settings",
    eyebrow: text(["settings", "eyebrow"], "SETTINGS"),
    title: text(["settings", "title"], "Repair Controls"),
    statusDot: handsFreeEnabled ? "live" : "idle",
    collapsed: state.layout.collapsedPanels["repair-settings"],
    pinned: state.layout.pinnedPanels["repair-settings"],
    body,
  });
}

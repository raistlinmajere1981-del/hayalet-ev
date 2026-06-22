import type { RepairAiTargetSlot, RepairUiState } from "../../shared/ui/state.js";
import type { createRepairUiRequestRuntime } from "../../shared/ui/request-runtime.js";
import {
  createRepairOperatorProfileId,
  normalizeRepairSkillLevel,
} from "../panels/operator-profile-panel.js";

type RepairUiRequestRuntime = ReturnType<typeof createRepairUiRequestRuntime>;

interface RepairActionRoomWindow {
  roomAPI?: {
    close?: () => boolean;
  };
}

interface RepairEvidenceSelectionPayload {
  selectedEvidenceResourceIds?: string[];
  selectedFailureIds?: string[];
  selectedTestPointIds?: string[];
}

interface RepairRoomActionRuntimeParams {
  root: HTMLElement;
  requestRuntime: RepairUiRequestRuntime;
  state: RepairUiState;
  windowRef: RepairActionRoomWindow;
  dictationComposer: {
    setChatComposerDraft: (draft: string) => void;
  };
  cancelSpatialFocusTween: () => void;
  updateWizardField: (root: HTMLElement, field: string, value: string) => void;
  flushWizardFields: (root: HTMLElement) => void;
  collectEvidenceSelection: (root: HTMLElement) => RepairEvidenceSelectionPayload;
}

const SPATIAL_FOCUS_CANCEL_ACTIONS = new Set([
  "activate-session",
  "set-tool",
  "jump-to-event",
  "knowledge-spatial-focus",
  "knowledge-spatial-promote",
  "timeline-zoom",
  "timeline-range",
  "timeline-play",
  "timeline-pause",
  "timeline-live",
  "timeline-speed",
]);

function findActionElement(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element ? target.closest<HTMLElement>("[data-repair-action]") : null;
}

function readAiTargetSlot(value: unknown): RepairAiTargetSlot | null {
  return value === "ai0" || value === "ai1" || value === "ai2" ? value : null;
}

export function bindRepairRoomActions(params: RepairRoomActionRuntimeParams): void {
  const {
    root,
    requestRuntime,
    state,
    windowRef,
    dictationComposer,
    cancelSpatialFocusTween,
    updateWizardField,
    flushWizardFields,
    collectEvidenceSelection,
  } = params;

  if (root.dataset["actionsBound"] === "true") return;
  root.dataset["actionsBound"] = "true";

  root.addEventListener("click", (event) => {
    const el = findActionElement(event.target);
    if (el === null) return;
    const action = el.dataset["repairAction"];
    if (action === undefined) return;
    if (SPATIAL_FOCUS_CANCEL_ACTIONS.has(action)) cancelSpatialFocusTween();

    switch (action) {
      case "room-close":
        windowRef.roomAPI?.close?.();
        break;
      case "activate-session": {
        const sessionId = el.dataset["sessionId"];
        if (sessionId) requestRuntime.activateSession({ sessionId });
        break;
      }
      case "delete-session": {
        const sessionId = el.dataset["sessionId"];
        if (!sessionId) break;
        const sessionTitle = el.dataset["sessionTitle"] ?? "this session";
        const confirmed = window.confirm(
          `Delete saved repair session "${sessionTitle}" and all stored data?`
        );
        if (confirmed) requestRuntime.deleteSession({ sessionId });
        break;
      }
      case "set-tool": {
        const tool = el.dataset["tool"];
        if (tool) requestRuntime.setActiveTool({ tool });
        break;
      }
      case "set-operational-profile": {
        const profile = el.dataset["profile"];
        if (profile === "novice" || profile === "advanced") {
          requestRuntime.setOperationalProfile({ profile });
        }
        break;
      }
      case "set-voice-guidance": {
        const ambientListeningState = el.dataset["ambientListeningState"];
        const spokenGuidanceMode = el.dataset["spokenGuidanceMode"];
        const handsBusyMode = el.dataset["handsBusyMode"];
        requestRuntime.setVoiceGuidance({
          ...(ambientListeningState === "idle" ||
          ambientListeningState === "listening" ||
          ambientListeningState === "muted"
            ? { ambientListeningState }
            : {}),
          ...(spokenGuidanceMode === "silent" ||
          spokenGuidanceMode === "brief" ||
          spokenGuidanceMode === "step-by-step"
            ? { spokenGuidanceMode }
            : {}),
          ...(handsBusyMode === undefined ? {} : { handsBusyMode: handsBusyMode === "true" }),
        });
        break;
      }
      case "set-hands-free-mode": {
        const enabled = el.dataset["enabled"] === "true";
        requestRuntime.setVoiceGuidance({
          handsBusyMode: enabled,
          ambientListeningState: enabled ? "listening" : "idle",
          spokenGuidanceMode: enabled
            ? "step-by-step"
            : state.layout.voiceGuidance.spokenGuidanceMode,
        });
        if (enabled) {
          requestRuntime.startAmbientListener();
        } else {
          requestRuntime.stopAmbientListener();
        }
        break;
      }
      case "toggle-ambient-listener": {
        const active = el.dataset["active"] === "true";
        requestRuntime.setVoiceGuidance({
          ambientListeningState: active ? "idle" : "listening",
          spokenGuidanceMode: state.layout.voiceGuidance.spokenGuidanceMode,
          handsBusyMode: state.layout.voiceGuidance.handsBusyMode,
        });
        if (active) {
          requestRuntime.stopAmbientListener();
        } else {
          requestRuntime.startAmbientListener();
        }
        break;
      }
      case "toggle-dictation":
        if (el.dataset["active"] === "true") {
          requestRuntime.stopDictation();
        } else {
          requestRuntime.startDictation();
        }
        break;
      case "toggle-camera-feed":
        if (el.dataset["active"] === "true") {
          requestRuntime.stopCameraFeed();
        } else {
          requestRuntime.setInteractionSettings({ cameraFeedPreference: "android-feed" });
          requestRuntime.startCameraFeed();
        }
        break;
      case "toggle-tts":
        if (el.dataset["active"] === "true") {
          requestRuntime.stopSpeech();
        } else {
          requestRuntime.speakGuidance();
        }
        break;
      case "set-interaction-settings": {
        const dictationRoute = el.dataset["dictationRoute"];
        const ttsRoute = el.dataset["ttsRoute"];
        const cameraFeedPreference = el.dataset["cameraFeedPreference"];
        const dictationSubmitMode = el.dataset["dictationSubmitMode"];
        const androidCompanionEnabled = el.dataset["androidCompanionEnabled"];
        const autoReadAiReplies = el.dataset["autoReadAiReplies"];
        requestRuntime.setInteractionSettings({
          ...(androidCompanionEnabled === undefined
            ? {}
            : { androidCompanionEnabled: androidCompanionEnabled === "true" }),
          ...(dictationRoute === "local" || dictationRoute === "android" ? { dictationRoute } : {}),
          ...(ttsRoute === "local" || ttsRoute === "android" ? { ttsRoute } : {}),
          ...(cameraFeedPreference === "manual" || cameraFeedPreference === "android-feed"
            ? { cameraFeedPreference }
            : {}),
          ...(dictationSubmitMode === "composer" || dictationSubmitMode === "send"
            ? { dictationSubmitMode }
            : {}),
          ...(autoReadAiReplies === undefined
            ? {}
            : { autoReadAiReplies: autoReadAiReplies === "true" }),
        });
        break;
      }
      case "set-settings-overlay": {
        const open = el.dataset["open"];
        const tabId = el.dataset["tabId"];
        requestRuntime.setSettingsOverlay({
          ...(open === undefined ? {} : { open: open === "true" }),
          ...(tabId === "repair-controls" || tabId === "bench-operator" ? { tabId } : {}),
        });
        break;
      }
      case "set-attention-budget": {
        const maxAiInterruptions = Number(el.dataset["maxAiInterruptions"]);
        const windowMs = Number(el.dataset["windowMs"]);
        requestRuntime.setAttentionBudget({
          ...(Number.isFinite(maxAiInterruptions) ? { maxAiInterruptions } : {}),
          ...(Number.isFinite(windowMs) ? { windowMs } : {}),
        });
        break;
      }
      case "toggle-overlay-layer": {
        const layerId = el.dataset["layerId"];
        const visible = el.dataset["visible"] === "true";
        if (layerId) requestRuntime.toggleOverlayLayer({ layerId, visible });
        break;
      }
      case "toggle-investigation-mode":
        requestRuntime.toggleInvestigationMode({
          enabled: !state.workbench.investigationModeEnabled,
        });
        break;
      case "jump-to-event": {
        const eventId = el.dataset["eventId"];
        if (eventId) requestRuntime.jumpToEvent({ eventId });
        break;
      }
      case "attach-knowledge-pack": {
        const packId = el.dataset["packId"];
        if (packId) requestRuntime.attachKnowledgePack({ packId });
        break;
      }
      case "knowledge-pack-tab": {
        const previewTabId = el.dataset["tabId"];
        if (previewTabId) requestRuntime.updatePanelTab({ previewTabId });
        break;
      }
      case "knowledge-spatial-focus": {
        const spatialRefId = el.dataset["spatialRefId"];
        if (spatialRefId) requestRuntime.focusKnowledgeSpatialRef({ spatialRefId });
        break;
      }
      case "knowledge-spatial-promote": {
        const spatialRefId = el.dataset["spatialRefId"];
        if (spatialRefId) requestRuntime.promoteKnowledgeRegion({ spatialRefId });
        break;
      }
      case "ai-mark-state": {
        const eventId = el.dataset["eventId"];
        const aiState = el.dataset["aiState"];
        if (eventId && aiState) {
          requestRuntime.dismissAiMark({
            eventId,
            state: aiState,
            reason: `Repair observation marked ${aiState}.`,
          });
        }
        break;
      }
      case "set-instrument": {
        const instrumentKind = el.dataset["instrumentKind"];
        if (instrumentKind) requestRuntime.updatePanelTab({ instrumentKind });
        break;
      }
      case "operator-profile-tab": {
        const operatorProfileTabId = el.dataset["tabId"];
        if (operatorProfileTabId) requestRuntime.updatePanelTab({ operatorProfileTabId });
        break;
      }
      case "operator-profile-update": {
        const profileKind = el.dataset["profileKind"];
        if (profileKind === "tool") {
          const id = el.dataset["toolId"];
          if (id) {
            requestRuntime.updateOperatorProfile({
              tools: [
                {
                  id,
                  ...(el.dataset["remove"] === "true" ? { remove: true } : {}),
                  ...(el.dataset["available"] === undefined
                    ? {}
                    : { available: el.dataset["available"] === "true" }),
                },
              ],
            });
          }
        }
        if (profileKind === "skill") {
          const id = el.dataset["skillId"];
          const proficiency = Number(el.dataset["proficiency"]);
          if (id) {
            requestRuntime.updateOperatorProfile({
              skills: [
                {
                  id,
                  ...(el.dataset["remove"] === "true" ? { remove: true } : {}),
                  ...(Number.isFinite(proficiency) ? { proficiency } : {}),
                },
              ],
            });
          }
        }
        if (profileKind === "preference") {
          const key = el.dataset["preferenceKey"];
          const rawValue = el.dataset["preferenceValue"];
          if (key && rawValue !== undefined) {
            requestRuntime.updateOperatorProfile({
              preferences: {
                [key]: key === "annotationDefaultStrokeWidth" ? Number(rawValue) : rawValue,
              },
            });
          }
        }
        break;
      }
      case "operator-profile-add-tool": {
        const labelInput = root.querySelector<HTMLInputElement>(
          "[data-repair-input='operator-tool-label']"
        );
        const categoryInput = root.querySelector<HTMLSelectElement>(
          "[data-repair-input='operator-tool-category']"
        );
        const modelInput = root.querySelector<HTMLInputElement>(
          "[data-repair-input='operator-tool-model']"
        );
        const label = labelInput?.value.trim() ?? "";
        if (label === "") break;
        requestRuntime.updateOperatorProfile({
          tools: [
            {
              id: createRepairOperatorProfileId(label),
              label,
              category: categoryInput?.value ?? "measurement",
              model: modelInput?.value.trim() || null,
              notes: null,
              available: true,
              capabilities: [],
            },
          ],
        });
        if (labelInput) labelInput.value = "";
        if (modelInput) modelInput.value = "";
        break;
      }
      case "operator-profile-add-skill": {
        const labelInput = root.querySelector<HTMLInputElement>(
          "[data-repair-input='operator-skill-label']"
        );
        const proficiencyInput = root.querySelector<HTMLSelectElement>(
          "[data-repair-input='operator-skill-proficiency']"
        );
        const label = labelInput?.value.trim() ?? "";
        if (label === "") break;
        requestRuntime.updateOperatorProfile({
          skills: [
            {
              id: createRepairOperatorProfileId(label),
              label,
              proficiency: normalizeRepairSkillLevel(Number(proficiencyInput?.value ?? 3)),
            },
          ],
        });
        if (labelInput) labelInput.value = "";
        break;
      }
      case "toggle-panel-collapse": {
        const panelId = el.dataset["panelId"];
        const collapsed = el.dataset["collapsed"] === "true";
        if (panelId) requestRuntime.updatePanelLayout({ panelId, collapsed });
        break;
      }
      case "toggle-say-column": {
        const strip = root.querySelector<HTMLElement>(".repair-guidance-strip");
        if (strip) {
          const current = strip.dataset["showSay"] === "true";
          strip.dataset["showSay"] = String(!current);
          el.classList.toggle("repair-guidance-control--active", !current);
        }
        break;
      }
      case "send-chat": {
        const input = root.querySelector<HTMLInputElement>("[data-repair-input='chat-composer']");
        if (input && input.value.trim() !== "") {
          requestRuntime.sendChatTurn({ text: input.value.trim() });
          requestRuntime.setChatComposer({ draft: "" });
          input.value = "";
        }
        break;
      }
      case "clear-chat-composer":
        dictationComposer.setChatComposerDraft("");
        break;
      case "send-feed-question": {
        const input = root.querySelector<HTMLInputElement>("[data-repair-input='feed-composer']");
        if (input && input.value.trim() !== "") {
          requestRuntime.sendChatTurn({ text: input.value.trim() });
          input.value = "";
        }
        break;
      }
      case "wizard-symptom": {
        const symptom = el.dataset["symptom"];
        if (!symptom) return;
        const primarySymptoms = new Set(state.wizard.draft.primarySymptoms);
        const customSymptoms = new Set(state.wizard.draft.customSymptoms);
        const isSelected = primarySymptoms.has(symptom) || customSymptoms.has(symptom);
        if (isSelected) {
          primarySymptoms.delete(symptom);
          customSymptoms.delete(symptom);
        } else {
          primarySymptoms.add(symptom);
        }
        requestRuntime.updateSession({
          wizardDraft: {
            primarySymptoms: Array.from(primarySymptoms),
            customSymptoms: Array.from(customSymptoms),
          },
        });
        break;
      }
      case "wizard-suggestion": {
        const field = el.dataset["wizardField"];
        const value = el.dataset["value"];
        if (field === undefined || value === undefined) break;
        const wrapper = el.closest(".repair-wizard-field");
        const input = wrapper?.querySelector<HTMLInputElement>(
          `[data-repair-action='wizard-field'][data-wizard-field='${field}']`
        );
        if (input !== undefined && input !== null) input.value = value;
        updateWizardField(root, field, value);
        el.blur();
        break;
      }
      case "add-custom-symptom": {
        const input = root.querySelector<HTMLInputElement>(
          "[data-repair-input='wizard-custom-symptom']"
        );
        const symptom = input?.value.trim() ?? "";
        if (symptom === "") break;
        const primarySymptoms = Array.from(
          new Set([...state.wizard.draft.primarySymptoms, symptom])
        );
        const customSymptoms = Array.from(new Set([...state.wizard.draft.customSymptoms, symptom]));
        requestRuntime.updateSession({ wizardDraft: { primarySymptoms, customSymptoms } });
        if (input) input.value = "";
        break;
      }
      case "remove-wizard-symptom": {
        const symptom = el.dataset["symptom"];
        if (!symptom) break;
        requestRuntime.updateSession({
          wizardDraft: {
            primarySymptoms: state.wizard.draft.primarySymptoms.filter((item) => item !== symptom),
            customSymptoms: state.wizard.draft.customSymptoms.filter((item) => item !== symptom),
          },
        });
        break;
      }
      case "start-wizard-research": {
        flushWizardFields(root);
        const select = root.querySelector<HTMLSelectElement>(
          "[data-repair-action='set-ai-target-slot']"
        );
        const targetSlot = readAiTargetSlot(select?.value);
        requestRuntime.startKnowledgeResearch(targetSlot === null ? {} : { targetSlot });
        break;
      }
      case "skip-wizard-research":
        flushWizardFields(root);
        requestRuntime.skipKnowledgeResearch();
        break;
      case "advance-wizard": {
        flushWizardFields(root);
        const step = el.dataset["step"];
        requestRuntime.advanceWizard(step ? { step } : undefined);
        break;
      }
      case "create-session":
        flushWizardFields(root);
        requestRuntime.createSession();
        break;
      case "timeline-zoom": {
        const direction = el.dataset["direction"] === "out" ? -1 : 1;
        requestRuntime.updateTimeline({
          timelineZoom: Math.min(
            4,
            Math.max(0.25, state.workbench.timeline.zoom + direction * 0.25)
          ),
        });
        break;
      }
      case "timeline-range": {
        const playhead = state.workbench.timeline.playheadMs;
        requestRuntime.updateTimeline({
          timelineRangeStartMs: Math.max(0, playhead - 15000),
          timelineRangeEndMs: playhead + 15000,
        });
        break;
      }
      case "timeline-play":
        requestRuntime.updateTimeline({ replayAction: "play" });
        break;
      case "timeline-pause":
        requestRuntime.updateTimeline({ replayAction: "pause" });
        break;
      case "timeline-live":
        requestRuntime.focusLiveEdge();
        break;
      case "timeline-speed": {
        const nextSpeed =
          state.workbench.timeline.replaySpeed >= 4
            ? 0.5
            : state.workbench.timeline.replaySpeed * 2;
        requestRuntime.updateTimeline({ replaySpeed: nextSpeed });
        break;
      }
    }
  });

  root.addEventListener("input", (event) => {
    const el = findActionElement(event.target);
    if (el === null) return;
    if (el.dataset["repairAction"] === "timeline-scrub" && el instanceof HTMLInputElement) {
      cancelSpatialFocusTween();
      requestRuntime.scrubTimeline({ positionMs: Number(el.value) });
    }
    if (
      el.dataset["repairAction"] === "wizard-field" &&
      (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)
    ) {
      const field = el.dataset["wizardField"];
      if (field) updateWizardField(root, field, el.value);
    }
  });

  root.addEventListener("change", (event) => {
    const el = findActionElement(event.target);
    if (
      !(
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement
      )
    ) {
      return;
    }
    if (el.dataset["repairAction"] === "wizard-field" && el instanceof HTMLSelectElement) {
      const field = el.dataset["wizardField"];
      if (field) updateWizardField(root, field, el.value);
    }
    if (el.dataset["repairAction"] === "evidence-selection") {
      requestRuntime.updateEvidenceSelection(collectEvidenceSelection(root));
    }
    if (el.dataset["repairAction"] === "set-ai-target-slot") {
      const targetSlot = readAiTargetSlot(el.value);
      if (targetSlot !== null) {
        state.aiDispatch.chat.targetSlot = targetSlot;
        state.aiDispatch.research.targetSlot = targetSlot;
        state.aiDispatch.tactical.targetSlot = targetSlot;
        requestRuntime.setAiTargetSlot({ targetSlot });
      }
    }
    if (el.dataset["repairAction"] === "operator-profile-field") {
      const profileKind = el.dataset["profileKind"];
      const field = el.dataset["field"];
      if (profileKind === "tool") {
        const id = el.dataset["toolId"];
        if (id && field)
          requestRuntime.updateOperatorProfile({ tools: [{ id, [field]: el.value }] });
      }
      if (profileKind === "skill") {
        const id = el.dataset["skillId"];
        if (id && field)
          requestRuntime.updateOperatorProfile({ skills: [{ id, [field]: el.value }] });
      }
      if (profileKind === "preference") {
        const key = el.dataset["preferenceKey"];
        if (key) requestRuntime.updateOperatorProfile({ preferences: { [key]: el.value } });
      }
    }
  });
}

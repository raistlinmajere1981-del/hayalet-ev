import { PROVIDER_SCENARIO_TIMEOUTS } from "../../../../../../shared/timeouts.ts";
import type { ProviderScenarioDefinition } from "../../../../../types/provider.ts";

export const WEBVIEW_TEST_SCENARIO: ProviderScenarioDefinition = {
  id: "webview-test",
  title: "Webview Test",
  description: "Runs the shared webview validation scenario using preset actions.",
  commands: [
    {
      id: "reset-default-page",
      label: "Reset Default Page",
      action: "navigate-default",
      onFail: "abort",
      loading: true,
    },
    {
      id: "disabled-send",
      label: "Disabled Send State",
      action: "assert-disabled-send",
      onFail: "abort",
    },
    {
      id: "drag-drop-surface",
      label: "Drag And Drop Surface",
      action: "assert-drag-drop-surface",
      onFail: "abort",
    },
    {
      id: "inject-message",
      label: "Inject Message",
      action: "inject-prompt",
      onFail: "abort",
    },
    {
      id: "enabled-send",
      label: "Enabled Send State",
      action: "assert-enabled-send",
      onFail: "abort",
    },
    {
      id: "attach-file",
      label: "Attach File",
      action: "assert-attach-flow",
      onFail: "warn",
    },
    {
      id: "send-thinking",
      label: "Send And Thinking",
      action: "send-and-wait-thinking",
      onFail: "abort",
      loading: true,
    },
    {
      id: "final-bubbles",
      label: "Final Message Bubbles",
      action: "assert-final-bubbles",
      onFail: "abort",
    },
    {
      id: "scroll-behavior",
      label: "Scroll Behavior",
      action: "assert-scroll-behavior",
      onFail: "abort",
    },
    {
      id: "provider-capabilities",
      label: "Provider Capabilities",
      action: "assert-provider-capabilities",
      onFail: "warn",
    },
  ],
};

export const WEBVIEW_SYNC_SCENARIO: ProviderScenarioDefinition = {
  id: "webview-sync",
  title: "Webview Sync",
  description: "Runs provider sync commands through the shared scenario engine.",
  commands: [
    {
      id: "open-sidebar",
      label: "Open Sidebar",
      action: "click",
      target: "sync-sidebar-open-button",
      onFail: "abort",
    },
    {
      id: "wait-sidebar-ready",
      label: "Wait Sidebar Ready",
      action: "wait",
      target: "sync-sidebar-ready",
      params: {
        timeoutMs: PROVIDER_SCENARIO_TIMEOUTS.SIDEBAR_READY,
      },
      onFail: "abort",
    },
    {
      id: "check-sidebar-ready",
      label: "Check Sidebar Ready",
      action: "check",
      target: "sync-sidebar-ready",
      onFail: "abort",
    },
    {
      id: "collect-session-urls",
      label: "Collect Session Urls",
      action: "collect-session-urls",
      saveAs: "syncSessions",
      onFail: "abort",
    },
    {
      id: "soft-sync-session",
      label: "Soft Sync Session",
      action: "sync-session",
      forEach: "syncSessions",
      params: {
        mode: "soft",
      },
      whenSyncModes: ["soft", "full", "clean"],
      onFail: "abort",
    },
    {
      id: "navigate-session",
      label: "Navigate Session",
      action: "navigate",
      forEach: "syncSessions",
      whenSyncModes: ["full", "clean"],
      loading: true,
      onFail: "abort",
    },
    {
      id: "sync-session",
      label: "Sync Session",
      action: "sync-session",
      forEach: "syncSessions",
      params: {
        modeSource: "syncMode",
      },
      whenSyncModes: ["full", "clean"],
      onFail: "abort",
    },
    {
      id: "refresh-conversation-list",
      label: "Refresh Conversation List",
      action: "refresh-conversation-list",
      onFail: "abort",
    },
  ],
};

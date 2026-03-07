import type { ProviderScenarioDefinition } from "../../../../../types/provider.ts";

export const WEBVIEW_TEST_SCENARIO: ProviderScenarioDefinition = {
  id: "webview-test",
  title: "Webview Test",
  description: "Runs the shared webview validation scenario using preset actions.",
  steps: [
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
  description: "Collects visible session titles and URLs from the provider sidebar.",
  steps: [
    {
      id: "open-sidebar",
      label: "Open Sidebar",
      action: "open-sidebar",
      onFail: "abort",
    },
    {
      id: "collect-session-urls",
      label: "Collect Session Urls",
      action: "collect-session-urls",
      onFail: "abort",
    },
    {
      id: "open-session-urls",
      label: "Open Session Urls",
      action: "open-session-urls",
      onFail: "abort",
      loading: true,
    },
    {
      id: "report-sync-preview",
      label: "Report Sync Preview",
      action: "report",
      onFail: "warn",
    },
  ],
};

interface BindAsistanBasicEventsOptions {
  connectBtn: HTMLButtonElement | null;
  ghostAgentBtn: HTMLButtonElement | null;
  resumeLastSessionCheckbox: HTMLInputElement | null;
  keepServersOnAppCloseCheckbox: HTMLInputElement | null;
  catchCommandsCheckbox: HTMLInputElement | null;
  providerSelect: HTMLSelectElement | null;
  opencodeSettingsBtn: HTMLButtonElement | null;
  memoryBtn: HTMLButtonElement | null;
  devtoolsBtn: HTMLButtonElement | null;
  testBtn: HTMLButtonElement | null;
  onConnectClick: () => void;
  onGhostAgentClick: () => void;
  onResumeLastSessionChange: (enabled: boolean) => void;
  onKeepServersOnCloseChange: (enabled: boolean) => void;
  onCatchCommandsChange: (enabled: boolean) => void;
  onProviderChange: () => void;
  onOpencodeSettingsClick: () => void;
  onMemoryClick: () => void;
  onDevtoolsClick: () => void;
  onTestClick: () => void;
}

export function bindAsistanBasicEvents(options: BindAsistanBasicEventsOptions): void {
  options.connectBtn?.addEventListener("click", options.onConnectClick);
  options.ghostAgentBtn?.addEventListener("click", options.onGhostAgentClick);
  options.resumeLastSessionCheckbox?.addEventListener("change", () => {
    options.onResumeLastSessionChange(options.resumeLastSessionCheckbox?.checked === true);
  });
  options.keepServersOnAppCloseCheckbox?.addEventListener("change", () => {
    options.onKeepServersOnCloseChange(options.keepServersOnAppCloseCheckbox?.checked === true);
  });
  options.catchCommandsCheckbox?.addEventListener("change", () => {
    options.onCatchCommandsChange(options.catchCommandsCheckbox?.checked === true);
  });
  options.providerSelect?.addEventListener("change", options.onProviderChange);
  options.opencodeSettingsBtn?.addEventListener("click", options.onOpencodeSettingsClick);
  options.memoryBtn?.addEventListener("click", options.onMemoryClick);
  options.devtoolsBtn?.addEventListener("click", options.onDevtoolsClick);
  options.testBtn?.addEventListener("click", options.onTestClick);
}

// IPC wrapper: isolates window.electronAPI dependency.

export function getElectronAPI() {
  return typeof window !== "undefined" ? window.electronAPI : null;
}

export async function ipcLoadSettings() {
  const api = getElectronAPI();
  if (!api?.loadSettings) throw new Error("electronAPI.loadSettings not available");
  return await api.loadSettings();
}

export async function ipcSaveSettings(settings) {
  const api = getElectronAPI();
  if (!api?.saveSettings) throw new Error("electronAPI.saveSettings not available");
  return await api.saveSettings(settings);
}

export async function ipcAssignAccountToSlot(slot, accountId) {
  const api = getElectronAPI();
  if (!api?.assignAccountToSlot) throw new Error("electronAPI.assignAccountToSlot not available");
  return await api.assignAccountToSlot(slot, accountId);
}

export async function ipcCreateAccount(accountData) {
  const api = getElectronAPI();
  if (!api?.createAccount) throw new Error("electronAPI.createAccount not available");
  return await api.createAccount(accountData);
}

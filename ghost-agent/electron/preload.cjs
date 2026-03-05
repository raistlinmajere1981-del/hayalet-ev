const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  ghostBootstrap: () => ipcRenderer.invoke("ghost-bootstrap"),
  ghostProviderDetect: (provider) => ipcRenderer.invoke("ghost-provider-detect", provider),
  ghostProviderConnect: (payload) => ipcRenderer.invoke("ghost-provider-connect", payload),
  ghostProviderStop: (provider) => ipcRenderer.invoke("ghost-provider-stop", provider),
  ghostProviderSetPreferred: (provider) =>
    ipcRenderer.invoke("ghost-provider-set-preferred", provider),
  ghostOpenTarget: (target) => ipcRenderer.invoke("ghost-open-target", target),
  ghostExitAction: (action) => ipcRenderer.invoke("ghost-exit-action", action),
  showOpenDialog: (options) => ipcRenderer.invoke("show-open-dialog", options),
  fmTempPath: (prefix, ext) => ipcRenderer.invoke("fm-temp-path", prefix, ext),
  fmWriteFileAtomic: (payload) => ipcRenderer.invoke("fm-write-file-atomic", payload),
  ghostLog: (payload) => ipcRenderer.invoke("ghost-log", payload),
  sendToHost: () => {},
});

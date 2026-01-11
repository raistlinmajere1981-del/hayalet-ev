/**
 * IPC Channel sabitleri
 * 
 * Main process ile renderer process arasındaki iletişim kanalları
 */

export const IPC = {
  LOAD_SETTINGS: "load-settings",
  SAVE_SETTINGS: "save-settings",
  
  READ_FILE: "read-file",
  READ_FILES_MULTI: "read-files-multi",
  WRITE_FILE: "write-file",
  
  ARCHIVE_SYNC: "archive-sync",
  REMOVE_ARCHIVE: "remove-archive",
  
  SCREENSHOT_CAPTURE: "screenshot-capture",
  CAPTURE_PAGE: "capture-page",
  
  DEVICE_ACTION: "device-action",
  
  GOOGLEDRIVE_UPLOAD: "googledrive-upload",
  
  ASSISTANT_CONNECT: "assistant-connect",
  ASSISTANT_DISCONNECT: "assistant-disconnect",
  ASSISTANT_DISCONNECTED: "assistant-disconnected",
  
  SETUP_WEBVIEW_LOGGER: "setup-webview-logger",
  GET_PRELOAD_PATH: "get-preload-path",
  
  CONSOLE_LOG_FORWARD: "console-log-forward",
};

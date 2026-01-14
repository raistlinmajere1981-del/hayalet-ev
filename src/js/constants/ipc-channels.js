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
  
  // Database
  DB_INIT_ACCOUNT: "db-init-account",
  DB_GET_CONVERSATIONS: "db-get-conversations",
  DB_GET_MESSAGES: "db-get-messages",
  DB_SYNC_MESSAGES: "db-sync-messages",
  DB_SAVE_ATTACHMENT: "db-save-attachment",
  DB_GET_ATTACHMENTS: "db-get-attachments",
  DB_DELETE_CONVERSATION: "db-delete-conversation",
  DB_SEARCH_MESSAGES: "db-search-messages",
  DB_UPDATE_CONVERSATION: "db-update-conversation",
  
  // Legacy Archive (deprecated - use DB_* instead)
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

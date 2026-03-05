export const config = {
  id: "gemini",
  name: "Gemini",
  baseUrl: "https://gemini.google.com",
  defaultPaths: ["/app"],
  loginUrl: "https://gemini.google.com/",
  lastVerified: "2026-01-11",
  selectors: {
    sendButton: "button.send-button",
    stopButton: ".blue-circle.stop-icon",
    inputField: ".ql-editor.textarea",
    messageContainer: ".response-container-content",
    attachButton: 'button[data-test-id="local-images-files-uploader-button"]',
  },
  inputType: "character-by-character",
  scrollerSelectors: [".chat-history"],
  scrapeSelectors: {
    preferred: ".message-content",
    fallback: ".user-query-bubble-with-background, .markdown-main-panel",
    messageId: '[id^="message-content-id-"]',
  },
  messageIdStrategy: "dom-id",
  roleSelectors: {
    user: ".user-query-bubble-with-background",
    assistant: ".markdown-main-panel",
    text: ".query-text",
  },
  fileInputSelectors: [
    'button[data-test-id="local-images-files-uploader-button"] input[type="file"]',
    'input[type="file"][multiple]',
    'input[type="file"]',
    'input[type="file"][accept]',
  ],
  criticalSelectors: [
    ".ql-editor.textarea",
    ".message-content",
    ".user-query-bubble-with-background",
    ".markdown-main-panel",
  ],
  contentContainers: ["div", "message-content"],
  uploadTargetSelectors: [
    "div[xapfileselectordropzone]",
    // Keep as fallback
    "file-drop-indicator",
    // Extra fallbacks
    ".text-input-field",
    ".ql-editor.textarea",
    'rich-textarea .ql-editor[contenteditable="true"]',
  ],
  excludedUrls: [] as string[],

  filters: {
    selectors: [] as string[],
    hosts: [] as string[],
    blockResourceTypes: [] as string[],
    dragTextMatchers: ["sürükleyin", "drop", "dosya", "file"],
  },
  telemetry: {
    endpoints: [] as string[],
    tokenPaths: [] as string[],
  },
};

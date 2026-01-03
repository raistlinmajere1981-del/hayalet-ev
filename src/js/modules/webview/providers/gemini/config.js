export const config = {
  id: "gemini",
  name: "Gemini",
  baseUrl: "https://gemini.google.com",
  loginUrl: "https://gemini.google.com/",
  selectors: {
    sendButton: "button.send-button",
    stopButton: ".blue-circle.stop-icon",
    inputField: ".ql-editor.textarea",
    messageContainer: ".response-container-content",
    // DOM inspect: data-test-id="local-images-files-uploader-button"
    attachButton: 'button[data-test-id="local-images-files-uploader-button"]',
  },
  inputType: "character-by-character",
  scrollerSelectors: [".chat-history"],
  scrapeSelectors: {
    // A single selector for both user and assistant messages to get them in order
    preferred: ".message-content",
    // Fallback selectors if the preferred one fails
    fallback: ".user-query-bubble-with-background, .markdown-main-panel",
  },
  // We need to identify user and assistant messages within the scraped elements
  roleSelectors: {
    user: ".user-query-bubble-with-background",
    assistant: ".markdown-main-panel",
    // A selector to get the text content from a message element
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
    // Real dropzone in Gemini (from DOM inspect)
    'div[xapfileselectordropzone]',
    // Keep as fallback
    'file-drop-indicator',
    // Extra fallbacks
    '.text-input-field',
    '.ql-editor.textarea',
    'rich-textarea .ql-editor[contenteditable="true"]',
  ],
  excludedUrls: [],
  filters: {
    selectors: [],
    hosts: [],
    blockResourceTypes: [],
    dragTextMatchers: ["sürükleyin", "drop", "dosya", "file"],
  },
  telemetry: {
    endpoints: [],
    tokenPaths: [],
  },
};

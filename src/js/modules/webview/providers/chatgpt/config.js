export const config = {
  id: "chatgpt",
  name: "ChatGPT",
  baseUrl: "https://chatgpt.com",
  loginUrl: "https://chatgpt.com/auth/login",
  lastVerified: "2026-01-11",
  selectors: {
    // Turkish: "İstem gönder", English: "Send prompt"
    sendButton:
      '#composer-submit-button[data-testid="send-button"], #composer-submit-button',

    // Stop button (when generating response)
    // Turkish: "Yanıtlamayı durdur", English: "Stop streaming"
    // Primary: data-testid (language-independent)
    stopButton:
      '[data-testid="stop-button"], #composer-submit-button[data-testid="stop-button"], button[aria-label="Stop streaming"], button[aria-label="Yanıtlamayı durdur"]',

    voiceButton: "",

    // Input field - uses ID which is language-independent
    inputField: "#prompt-textarea",

    messageContainer: "main",
  },

  inputType: "direct",
  scrollerSelectors: [
    // Primary: The actual scrollable container (parent of main#main)
    'div[data-scroll-root="true"]',
    'div:has(> main#main)',
    'div.relative.flex.min-h-0.min-w-0.flex-1.flex-col[class*="overflow-y-auto"]',
    // Fallback: main element (doesn't scroll itself but helps fallback find the parent)
    "main#main",
    "main.min-h-0",
    "div.flex.h-full.flex-col.overflow-y-auto",
    "main div.overflow-y-auto",
    "main section.overflow-y-auto",
    'div[role="main"] .overflow-y-auto',
  ],
  scrapeSelectors: {
    preferred: "[data-message-author-role]",
    fallback: ".message-bubble, .markdown.prose",
  },
  fileInputSelectors: ['input[type="file"][multiple]', 'input[type="file"]'],
  uploadTargetSelectors: [
    '[data-testid="upload-drop-target"]',
    '[data-testid="prompt-textarea"]',
    "#prompt-textarea",
    "form textarea",
  ],
  criticalSelectors: [
    "#prompt-textarea",
    '[data-testid="prompt-textarea"]',
    '[data-testid="conversation-turn"]',
    "[data-message-author-role]",
  ],
  contentContainers: ["div", "section", "article"],
  filters: {
    selectors: [
      "div.block.lg\\:hidden div.inline-flex.items-center.gap-1.rounded-full",
    ],
    hosts: [],
    blockResourceTypes: [],
    dragOverlaySelectors: [
      "[data-dnd-overlay]",
      '[data-testid*="drop"]',
      '[data-testid*="drag"]',
      ".drag-overlay",
      ".drag-drop-overlay",
      ".file-drop-target",
      ".dnd-active-overlay",
    ],
    dragTextMatchers: [
      "sürükleyin",
      "drop",
      "dosya",
      "file",
    ],
  },
  // Supports exact URLs and wildcard patterns (e.g., "https://chatgpt.com/auth/*")
  excludedUrls: [
    "https://chatgpt.com/auth/login",
    "https://chatgpt.com/images/*",
    "https://chatgpt.com/apps/*",
  ],

  telemetry: {
    endpoints: [],
    tokenPaths: [],
  },
};

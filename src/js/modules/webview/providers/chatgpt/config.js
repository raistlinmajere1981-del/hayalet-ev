export const config = {
  id: "chatgpt",
  name: "ChatGPT",
  baseUrl: "https://chatgpt.com",
  loginUrl: "https://chatgpt.com/auth/login",
  selectors: {
    // Use a permissive selector that matches the composer submit button
    // (some locales change the aria-label, so match by id / data-testid as primary keys)
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
    // Turkish placeholder: "Herhangi bir şey sor", English: "Ask anything"
    inputField: "#prompt-textarea",

    messageContainer: "main",
  },

  // Input method type: 'direct' for ChatGPT (value/textContent assignment)
  inputType: "direct",
  scrollerSelectors: [
    // Primary: The actual scrollable container (parent of main#main)
    'div[data-scroll-root="true"]',
    // Secondary: Using :has() selector (modern browsers)
    'div:has(> main#main)',
    // Tertiary: Class-based with flex-1 and overflow
    'div.relative.flex.min-h-0.min-w-0.flex-1.flex-col[class*="overflow-y-auto"]',
    // Fallback: main element (doesn't scroll itself but helps fallback find the parent)
    "main#main",
    "main.min-h-0",
    // Legacy selectors (kept for compatibility)
    "div.flex.h-full.flex-col.overflow-y-auto",
    "main div.overflow-y-auto",
    "main section.overflow-y-auto",
    'div[role="main"] .overflow-y-auto',
  ],
  // Scraper and DOM helper selectors
  scrapeSelectors: {
    preferred: "[data-message-author-role]",
    fallback: ".message-bubble, .markdown.prose",
  },
  // File input selectors used by file-injection methods (first that matches will be used)
  fileInputSelectors: ['input[type="file"][multiple]', 'input[type="file"]'],
  // Upload target selectors for drag/drop (first match used)
  uploadTargetSelectors: [
    '[data-testid="upload-drop-target"]',
    '[data-testid="prompt-textarea"]',
    "#prompt-textarea",
    "form textarea",
  ],
  // Critical selectors that must not be hidden by overlay cleanup
  criticalSelectors: [
    "#prompt-textarea",
    '[data-testid="prompt-textarea"]',
    '[data-testid="conversation-turn"]',
    "[data-message-author-role]",
  ],
  // Containers to scan for textual matches when hiding overlays
  contentContainers: ["div", "section", "article"],
  // Lightweight provider-scoped filters and telemetry settings.
  // `filters.selectors` - DOM selectors to remove/clean from the provider UI.
  // `filters.hosts` - host substrings to block via main-process webRequest (optional).
  // `filters.blockResourceTypes` - resource types to block early (e.g. ['image','script']).
  filters: {
    selectors: [
      // Remove the small upgrade/promo pill that shows "Go'ya yükselterek"
      // Matches: <div class="block lg:hidden"> ... <div class="inline-flex items-center ...">Go’ya yükselterek</div>
      "div.block.lg\\:hidden div.inline-flex.items-center.gap-1.rounded-full",
    ],
    hosts: [],
    blockResourceTypes: [],
    // Drag/drop helper: overlay selectors and text matchers used by attachFiles_dragdrop
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
      // common words for drop/drag in Turkish/English
      "sürükleyin",
      "drop",
      "dosya",
      "file",
    ],
  },
  // URLs where operations should be disabled (sync, send, traffic monitoring)
  // Supports exact URLs and wildcard patterns (e.g., "https://chatgpt.com/auth/*")
  excludedUrls: [
    "https://chatgpt.com/auth/login",
    "https://chatgpt.com/images/*",
    "https://chatgpt.com/apps/*",
  ],

  // Telemetry: endpoints to inspect for usage/limit info and JSON paths to extract tokens/limits.
  telemetry: {
    endpoints: [],
    // tokenPaths: array of JSON paths (dot-separated) to look for token counts, e.g. ['usage.total_tokens']
    tokenPaths: [],
  },
};

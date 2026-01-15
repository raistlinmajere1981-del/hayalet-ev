export const config = {
  id: "grok",
  name: "Grok",
  baseUrl: "https://grok.com",
  loginUrl: "https://grok.com/",
  lastVerified: "2026-01-11",
  selectors: {
    // Turkish: "Gönder", English: "Submit"
    sendButton:
      'button[type="submit"][aria-label="Gönder"], button[type="submit"][aria-label="Submit"], button[type="submit"]',

    // Stop button (when generating response)
    // Turkish: "Model yanıtını durdur", English: "Stop model response"
    stopButton:
      'button[aria-label="Model yanıtını durdur"], button[aria-label="Stop model response"]',

    // Turkish: "Ses moduna gir", English: "Enter voice mode"
    voiceButton:
      'button[aria-label="Ses moduna gir"], button[aria-label="Enter voice mode"]',

    // Input field (textarea)
    // Turkish: "Grok'a her şeyi sor", English: "Ask Grok anything"
    inputField:
      'textarea[aria-label="Grok\'a her şeyi sor"], textarea[aria-label="Ask Grok anything"], textarea[aria-label*="Grok"]',

    messageContainer: "main",
  },

  // Grok textarea için character-by-character gerekli (React state algılaması için)
  inputType: "character-by-character",
  scrollerSelectors: [
    "div.flex.h-full.flex-col.overflow-y-auto",
    "main div.overflow-y-auto",
    'div[role="main"] .overflow-y-auto',
  ],
  scrapeSelectors: {
    preferred: "[data-message-author-role]",
    fallback: ".message-bubble",
    // User mesaj container'ı (border ve background ile ayırt edilir)
    userWrapper: ".message-bubble.bg-surface-l1, .message-bubble.border-border-l1",
    // Assistant mesaj container'ı (max-w-none sınıfı ile ayırt edilir)
    assistantWrapper: ".message-bubble.max-w-none, .response-content-markdown",
  },
  // Mesaj ID stratejisi: DOM'da benzersiz ID olmadığı için content hash kullanılır
  messageIdStrategy: "content-hash",
  fileInputSelectors: [
    'input[data-testid="dmComposerAttachFileInput"]',
    'input[type="file"]',
  ],
  criticalSelectors: [
    'textarea[aria-label="Ask Grok anything"]',
    'textarea[aria-label="Grok\'a her şeyi sor"]',
    '[data-testid="dmComposerTextInput"]',
    "[data-message-author-role]",
  ],
  contentContainers: ["div", "section", "article"],
  uploadTargetSelectors: [
    '[data-testid="dmComposerTextInput"]',
    "form textarea",
    'textarea[aria-label="Ask Grok anything"]',
    'textarea[aria-label="Grok\'a her şeyi sor"]',
  ],
  // Supports exact URLs and wildcard patterns (e.g., "https://grok.com/auth/*")
  excludedUrls: [
    "https://accounts.x.ai/sign-in?redirect=grok-com",
    "https://accounts.x.ai/sign-in",
    "https://accounts.x.ai/account",
    "https://grok.com/sign-in",
    "https://grok.com/imagine/*",
    "https://grok.com/project",
    "https://accounts.x.ai/sign-in",
  ],

  filters: {
    selectors: [],
    hosts: [],
    blockResourceTypes: [],
    dragOverlaySelectors: ["[data-overlay]", ".drag-overlay", ".drop-overlay"],
    dragTextMatchers: ["sürükleyin", "drop", "dosya", "file"],
  },
  telemetry: {
    endpoints: [],
    tokenPaths: [],
  },
};

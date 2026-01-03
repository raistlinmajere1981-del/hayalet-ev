export const config = {
  id: "grok",
  name: "Grok",
  baseUrl: "https://grok.com",
  loginUrl: "https://grok.com/",
  selectors: {
    // Match submit buttons by type first, and fall back to common aria-labels
    // Turkish: "Gönder", English: "Submit"
    sendButton:
      'button[type="submit"][aria-label="Gönder"], button[type="submit"][aria-label="Submit"], button[type="submit"]',

    // Stop button (when generating response)
    // Turkish: "Model yanıtını durdur", English: "Stop model response"
    stopButton:
      'button[aria-label="Model yanıtını durdur"], button[aria-label="Stop model response"]',

    // Voice mode button
    // Turkish: "Ses moduna gir", English: "Enter voice mode"
    voiceButton:
      'button[aria-label="Ses moduna gir"], button[aria-label="Enter voice mode"]',

    // Input field (textarea)
    // Turkish: "Grok'a her şeyi sor", English: "Ask Grok anything"
    inputField:
      'textarea[aria-label="Grok\'a her şeyi sor"], textarea[aria-label="Ask Grok anything"], textarea[aria-label*="Grok"]',

    messageContainer: "main",
  },

  // Input method type: 'character-by-character' for Grok
  inputType: "character-by-character",
  scrollerSelectors: [
    "div.flex.h-full.flex-col.overflow-y-auto",
    "main div.overflow-y-auto",
    'div[role="main"] .overflow-y-auto',
  ],
  // Scraper and DOM helper selectors
  scrapeSelectors: {
    preferred: "[data-message-author-role]",
    fallback: ".message-bubble",
  },
  // File input selectors used by file-injection methods
  fileInputSelectors: [
    'input[data-testid="dmComposerAttachFileInput"]',
    'input[type="file"]',
  ],
  // Critical selectors to avoid hiding during overlay cleanup
  // Updated to support both Turkish and English
  criticalSelectors: [
    'textarea[aria-label="Ask Grok anything"]',
    'textarea[aria-label="Grok\'a her şeyi sor"]',
    '[data-testid="dmComposerTextInput"]',
    "[data-message-author-role]",
  ],
  // Containers scanned for textual matches when hiding overlays
  contentContainers: ["div", "section", "article"],
  // Upload target selectors for drag/drop
  // Updated to support both Turkish and English
  uploadTargetSelectors: [
    '[data-testid="dmComposerTextInput"]',
    "form textarea",
    'textarea[aria-label="Ask Grok anything"]',
    'textarea[aria-label="Grok\'a her şeyi sor"]',
  ],
  // URLs where operations should be disabled (sync, send, traffic monitoring)
  // Supports exact URLs and wildcard patterns (e.g., "https://grok.com/auth/*")
  excludedUrls: [
    "https://grok.com/imagine/*",
    "https://grok.com/project",
    "https://accounts.x.ai/sign-in",
  ],

  // Provider-scoped filters & telemetry (empty defaults).
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

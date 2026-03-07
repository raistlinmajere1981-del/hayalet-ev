export const config = {
  id: "grok",
  name: "Grok",
  baseUrl: "https://grok.com",
  loginUrl: "https://grok.com/",
  lastVerified: "2026-01-11",
  selectors: {
    sendButton:
      'button[type="submit"][aria-label="Gönder"], button[type="submit"][aria-label="Submit"], button[type="submit"]',

    stopButton:
      'button[aria-label="Model yanıtını durdur"], button[aria-label="Stop model response"]',

    voiceButton:
      'button[aria-label="Dikteyi başlat (Ctrl+D)"], button[aria-label="Start dictation (Ctrl+D)"], button[aria-label="Ses moduna gir"], button[aria-label="Enter voice mode"]',

    dictateButton:
      'button[aria-label="Dikteyi başlat (Ctrl+D)"], button[aria-label="Start dictation (Ctrl+D)"]',

    attachButton:
      'button.group/attach-button[aria-label="Ekle"], button.group/attach-button[aria-label="Attach"], button[aria-label="Ekle"][aria-haspopup="menu"], button[aria-label="Attach"][aria-haspopup="menu"]',

    attachMenuItem: 'div[role="menuitem"][data-radix-collection-item][data-orientation="vertical"]',

    inputField:
      '[data-testid="dmComposerTextInput"] .ProseMirror[contenteditable="true"], .ProseMirror[contenteditable="true"], textarea[aria-label="Grok\'a her şeyi sor"], textarea[aria-label="Ask Grok anything"], textarea[aria-label*="Grok"]',

    messageContainer: "main",
  },
  selectorMatrix: {
    selectors: {
      sendButton: {
        tr: 'button[type="submit"][aria-label="Gönder"]',
        en: 'button[type="submit"][aria-label="Submit"]',
        fallbacks: ['button[type="submit"]'],
      },
    },
  },

  inputType: "character-by-character",
  scrollerSelectors: [
    "div.flex.h-full.flex-col.overflow-y-auto",
    "main div.overflow-y-auto",
    'div[role="main"] .overflow-y-auto',
  ],
  scrapeSelectors: {
    preferred: "[data-message-author-role]",
    fallback: ".message-bubble",
    userWrapper: ".message-bubble.bg-surface-l1, .message-bubble.border-border-l1",
    assistantWrapper: ".message-bubble.max-w-none, .response-content-markdown",
  },
  messageIdStrategy: "content-hash",
  fileInputSelectors: ['input[data-testid="dmComposerAttachFileInput"]', 'input[type="file"]'],
  criticalSelectors: [
    'button.group/attach-button[aria-label="Ekle"]',
    'button.group/attach-button[aria-label="Attach"]',
    '.ProseMirror[contenteditable="true"]',
    'p[data-placeholder="Ask Grok"]',
    'p[data-placeholder="Grok\'a Sor"]',
    'textarea[aria-label="Ask Grok anything"]',
    'textarea[aria-label="Grok\'a her şeyi sor"]',
    '[data-testid="dmComposerTextInput"]',
    "[data-message-author-role]",
  ],
  contentContainers: ["div", "section", "article"],
  uploadTargetSelectors: [
    'button.group/attach-button[aria-label="Ekle"]',
    'button.group/attach-button[aria-label="Attach"]',
    '[data-testid="dmComposerTextInput"] .ProseMirror[contenteditable="true"]',
    '.ProseMirror[contenteditable="true"]',
    '[data-testid="dmComposerTextInput"]',
    "form textarea",
    'textarea[aria-label="Ask Grok anything"]',
    'textarea[aria-label="Grok\'a her şeyi sor"]',
  ],
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
    selectors: [] as string[],
    hosts: [] as string[],
    blockResourceTypes: [] as string[],
    dragOverlaySelectors: ["[data-overlay]", ".drag-overlay", ".drop-overlay"],
    dragTextMatchers: ["sürükleyin", "drop", "dosya", "file"],
  },
  telemetry: {
    endpoints: [] as string[],
    tokenPaths: [] as string[],
  },
};

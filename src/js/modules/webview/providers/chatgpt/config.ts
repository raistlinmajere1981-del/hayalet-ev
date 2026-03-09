import { WEBVIEW_SYNC_SCENARIO, WEBVIEW_TEST_SCENARIO } from "../shared/scenarios.ts";

export const config = {
  id: "chatgpt",
  name: "ChatGPT",
  baseUrl: "https://chatgpt.com",
  loginUrl: "https://chatgpt.com/auth/login",
  lastVerified: "2026-01-11",
  selectors: {
    sendButton: '#composer-submit-button[data-testid="send-button"], #composer-submit-button',

    stopButton:
      '[data-testid="stop-button"], #composer-submit-button[data-testid="stop-button"], button[aria-label="Stop streaming"], button[aria-label="Yanıtlamayı durdur"]',

    voiceButton:
      'button.composer-btn[aria-label="Dictate button"], button.composer-btn[aria-label="Dikte düğmesi"]',

    dictateButton:
      'button.composer-btn[aria-label="Dictate button"], button.composer-btn[aria-label="Dikte düğmesi"]',

    attachButton:
      '#composer-plus-btn[data-testid="composer-plus-btn"], button[data-testid="composer-plus-btn"][aria-label="Add files and more"], button[data-testid="composer-plus-btn"][aria-label="Dosyaları ve çok daha fazlasını ekle"]',

    attachMenuItem:
      'div[role="menuitem"].group.__menu-item[data-orientation="vertical"], div[role="menuitem"][data-radix-collection-item]',

    inputField: "#prompt-textarea",

    messageContainer: "main",

    filePreview: [
      '[data-testid="attachment-preview"]',
      '[data-testid*="file"]',
      ".group\\/attachment",
      '[class*="attachment"]',
      'button[aria-label*="Remove"]',
      'button[aria-label*="Kaldır"]',
    ],
  },
  selectorMatrix: {
    selectors: {
      sendButton: {
        tr: '#composer-submit-button[data-testid="send-button"]',
        en: '#composer-submit-button[data-testid="send-button"]',
        fallbacks: ["#composer-submit-button"],
      },
    },
  },

  inputType: "direct",
  scrollerSelectors: [
    'div[data-scroll-root="true"]',
    "div:has(> main#main)",
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
    messageWrapper: '[data-testid="conversation-turn"]',
    userWrapper: ".user-message-bubble-color",
    assistantWrapper: ".agent-turn",
  },
  messageIdStrategy: "content-hash",
  fileInputSelectors: ['input[type="file"][multiple]', 'input[type="file"]'],
  uploadTargetSelectors: [
    '#composer-plus-btn[data-testid="composer-plus-btn"]',
    '[data-testid="upload-drop-target"]',
    '[data-testid="prompt-textarea"]',
    "#prompt-textarea",
    "form textarea",
  ],
  criticalSelectors: [
    '#composer-plus-btn[data-testid="composer-plus-btn"]',
    "#prompt-textarea",
    '[data-testid="prompt-textarea"]',
    '[data-testid="conversation-turn"]',
    "[data-message-author-role]",
  ],
  contentContainers: ["div", "section", "article"],
  filters: {
    selectors: ["div.block.lg\\:hidden div.inline-flex.items-center.gap-1.rounded-full"],
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
    dragTextMatchers: ["sürükleyin", "drop", "dosya", "file"],
  },
  excludedUrls: [
    "https://auth.openai.com/email-verification",
    "https://auth.openai.com/log-in-or-create-account",
    "https://auth.openai.com/log-in/password",
    "https://chatgpt.com/auth/login",
    "https://chatgpt.com/images/*",
    "https://chatgpt.com/apps/*",
  ],

  telemetry: {
    endpoints: [],
    tokenPaths: [],
  },
  uiLanguage: {
    support: "partial",
    syncMode: "manual",
    supportedLocales: ["tr", "en"],
    persistence: ["account", "cookie", "session"],
    notes: "Provider language is account-scoped and requires dedicated UI automation research.",
  },
  scenarios: {
    webviewTest: WEBVIEW_TEST_SCENARIO,
    webviewSync: WEBVIEW_SYNC_SCENARIO,
  },
  webviewSync: {
    readiness: "verified",
    sidebar: {
      openButtonSelectors: ['button[data-testid="open-sidebar-button"]'],
      closeButtonSelectors: ['button[data-testid="close-sidebar-button"]'],
    },
    history: {
      containerSelectors: ["#history"],
      itemSelectors: ['#history a[data-sidebar-item="true"][href^="/c/"]'],
      titleSelectors: ['span[dir="auto"]'],
    },
  },
};

## 🏗️ Architecture Overview

> **Last Updated:** 2026-01-18 | **Version:** 5.4.0

### Process Architecture
```
Main Process (electron/main.ts)
├── Renderer Process (src/index.html)
│   └── CoreEngine (src/js/modules/core-engine.ts)
├── AI Provider Webviews (isolated contexts)
│   ├── ChatGPT webview
│   ├── Gemini webview
│   ├── Grok webview
│   └── OpenCode webview (Asistan)
├── IPC Bridge (electron/preload.cjs)
└── MCP Server (mcp-server/ - ROVO entegrasyonu)
```

### Module Structure
```
electron/                    # Main process modules
├── main.ts                 # Application entry point & IPC handlers
├── preload.cjs             # Main window preload (exposes electronAPI)
├── webview-preload.cjs     # Webview preload (AI provider injection)
├── console-logger.ts       # Unified logging orchestrator
├── logger/                 # Logging alt modülleri
│   ├── session-manager.ts  # Session lifecycle & meta
│   ├── log-writer.ts       # Log file writing & rotation
│   └── log-reader.ts       # Log querying & filtering
├── database/               # SQLite veritabanı yönetimi
│   ├── index.ts            # DatabaseManager orchestrator (tutarlı hata formatı)
│   ├── schema.ts           # Tablo şemaları ve migration
│   ├── queries.ts          # Prepared statement'lar
│   └── hash-utils.ts       # Mesaj hash fonksiyonları (djb2)
├── handlers/               # Modüler IPC handlers
│   ├── ipc-database.ts     # Database IPC handlers
│   ├── ipc-fs.ts           # File system handlers
│   ├── ipc-window.ts       # Window handlers
│   ├── ipc-settings.ts     # Settings handlers
│   ├── ipc-provider.ts     # Provider handlers
│   └── ipc-helpers.ts      # Shared handler utilities
├── settings-manager.ts     # Settings persistence (JSON file)
├── file-manager.ts         # File operations & archive management
├── command-manager.ts      # Command queue system
├── googledrive-manager.ts  # Google Drive sync
├── whisper-manager.ts      # Voice input handling
├── screenshot-manager.ts   # Screenshot capture
├── device-manager.ts       # Device control actions
├── window-manager.ts       # Window state management
├── opencode-manager.ts     # OpenCode server subprocess management
└── log-manager.ts          # Logging system

src/js/modules/             # Renderer process modules
├── core-engine.ts          # Central coordinator (singleton, memory leak fixed)
├── app-state.ts            # Global state management (null-safe getters)
├── settings-manager.ts     # Settings UI & sync
├── command-manager.ts      # Command queue client
├── command-executor.ts     # Job execution logic
├── protocol-handler.ts     # AI-AI communication protocol
├── catch-manager.ts        # Command interception
├── error-boundary.ts       # Global hata yakalama (NEW)
├── ipc-client.ts           # Type-safe IPC wrapper (NEW)
│
├── database/               # Database facade (renderer side)
│   ├── index.ts            # DatabaseService orchestrator
│   ├── conversation-store.ts # Konuşma CRUD işlemleri
│   └── message-store.ts    # Mesaj CRUD ve sync işlemleri
│
├── relay-manager.ts        # Relay orchestrator (AI↔AI, AI↔Asistan)
├── relay/                  # Relay alt modülleri
│   ├── base-relay.ts       # Abstract base class for all relays
│   ├── ai-ai-relay.ts      # AI-to-AI communication relay
│   ├── ai-asistan-relay.ts # AI-to-Asistan communication relay
│   └── index.ts            # Barrel export
│
├── slot-controller.ts      # Slot lifecycle orchestrator (state machine integrated)
├── slot/                   # Slot alt modülleri
│   ├── state-machine.ts    # Robust state machine (NEW - transition validation)
│   ├── webview-handler.ts  # Webview attach/detach/dom-ready
│   ├── url-handler.ts      # URL change tracking & exclusion
│   ├── timeout-handler.ts  # Timeout & error management
│   ├── settings-sync.ts    # Settings synchronization
│   └── index.ts            # Barrel export
│
├── webview-manager.ts      # Webview facade (send, sync, lifecycle)
├── webview/                # Webview alt modülleri
│   ├── lifecycle-manager.ts    # Register, attach, detach, destroy
│   ├── message-sender.ts       # Message & file sending
│   ├── conversation-syncer.ts  # DOM scraping & archive sync
│   ├── pending-archive-handler.ts # Pending archive operations
│   ├── provider-registry.ts    # Provider configuration registry
│   ├── provider-factory.ts     # Provider instantiation (lazy loading support)
│   ├── index.ts                # Barrel export
│   ├── providers/
│   │   ├── chatgpt/
│   │   │   ├── config.ts       # Provider config & DOM selectors
│   │   │   ├── index.ts        # Main provider logic
│   │   │   └── scraper.ts      # DOM scraping utilities
│   │   ├── gemini/
│   │   ├── grok/
│   │   └── opencode/           # Asistan provider (lokal server)
│   │       ├── config.ts       # OpenCode config, selectors, server commands
│   │       ├── index.ts        # Message sending logic
│   │       └── scraper.ts      # Conversation scraping
│   └── methods/                # Injection methods
│       ├── message/            # Message sending strategies
│       │   ├── injection.ts    # DOM injection method
│       │   └── xdotools.ts     # X11 automation fallback
│       ├── file/               # File upload strategies
│       │   ├── dragdrop.ts     # Drag & drop simulation
│       │   ├── injection.ts    # Direct DOM injection
│       │   ├── googledrive.ts  # Google Drive links
│       │   ├── catbox.ts       # Catbox.moe upload
│       │   └── uguu.ts         # Uguu.se upload
│       └── shared/             # Shared utilities
│           ├── file-utils.ts   # File processing utilities
│           └── url-utils.ts    # URL validation (isSlotUrlExcluded - merkezi)
│
├── traffic-manager.ts      # Traffic orchestrator (race-condition fixed)
├── traffic/                # Traffic alt modülleri
│   ├── loading-tracker.ts  # Page loading state tracking
│   ├── thinking-tracker.ts # AI thinking state tracking
│   ├── send-tracker.ts     # Send button state tracking
│   ├── probe-script-builder.ts # Webview probe script generator
│   └── webview-events.ts   # Webview navigation events
│
├── server-commands.ts      # Server command dispatcher
└── commands/               # Command handler'ları
    ├── utils.ts            # Shared utilities
    ├── device-commands.ts  # DeviceManager handler
    ├── screenshot-commands.ts # Screenshot handlers
    ├── window-commands.ts  # Window control handlers
    ├── whisper-commands.ts # WhisperManager handler
    ├── file-commands.ts    # File operation handlers
    └── ai-chat-commands.ts # AI-AI chat handlers

src/js/types/               # TypeScript tip tanımları (NEW)
├── index.ts                # Barrel export
├── ipc-channels.ts         # IPC channel tip tanımları (NEW)
├── common.ts               # Ortak tipler
├── provider.ts             # Provider tipleri
├── settings.ts             # Settings tipleri
├── commands.ts             # Command tipleri
├── database.ts             # Database tipleri
├── traffic.ts              # Traffic tipleri
└── relay.ts                # Relay tipleri

src/js/pages/               # Page controllers
├── analyze.ts              # Analyze page orchestrator
├── analyze/                # Analyze alt modülleri
│   ├── message-renderer.ts # Message bubble rendering
│   ├── upload-handler.ts   # File upload UI
│   ├── context-menu.ts     # Context menu & read modal
│   └── draft-manager.ts    # Draft persistence
├── asistan.ts              # Asistan page controller (OpenCode integration)
├── entrance.ts             # Entrance Hall page
├── archives.ts             # Archives management page
├── server.ts               # Server room page
└── whisper.ts              # Whisper room page

mcp-server/                 # MCP Protocol Server (v1.4.0)
├── index.ts                # Server orchestrator (18 tool)
├── tools/                  # Tool handler'ları
│   ├── electron-tools.ts   # test_electron, list_plugins
│   ├── log-tools.ts        # read_electron_logs, list_log_sessions, get_session_summary
│   ├── debug-tools.ts      # get_error_hints
│   └── cdp-tools.ts        # CDP tool handlers (12 tool) - UI otomasyon
└── utils/                  # Yardımcı fonksiyonlar
    ├── log-utils.ts        # Log reading utilities
    ├── cdp-connection.ts   # WebSocket bağlantı yönetimi (CDP)
    └── cdp-commands.ts     # UI otomasyon komutları (CDP)
```

---


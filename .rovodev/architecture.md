## 🏗️ Architecture Overview

### Process Architecture
```
Main Process (electron/main.js)
├── Renderer Process (src/index.html)
│   └── CoreEngine (src/js/modules/core-engine.js)
├── AI Provider Webviews (isolated contexts)
│   ├── ChatGPT webview
│   ├── Gemini webview
│   └── Grok webview
└── IPC Bridge (electron/preload.cjs)
```

### Module Structure
```
electron/                    # Main process modules
├── main.js                 # Application entry point & IPC handlers
├── preload.cjs             # Main window preload (exposes electronAPI)
├── webview-preload.cjs     # Webview preload (AI provider injection)
├── console-logger.js       # Unified logging orchestrator
├── logger/                 # Logging alt modülleri
│   ├── session-manager.js  # Session lifecycle & meta
│   ├── log-writer.js       # Log file writing & rotation
│   └── log-reader.js       # Log querying & filtering
├── database/               # SQLite veritabanı yönetimi
│   ├── index.js            # DatabaseManager orchestrator
│   ├── schema.js           # Tablo şemaları ve migration
│   ├── queries.js          # Prepared statement'lar
│   └── hash-utils.js       # Mesaj hash fonksiyonları (djb2)
├── settings-manager.js     # Settings persistence (JSON file)
├── file-manager.js         # File operations & archive management
├── command-manager.js      # Command queue system
├── googledrive-manager.js  # Google Drive sync
├── whisper-manager.js      # Voice input handling
├── screenshot-manager.js   # Screenshot capture
├── device-manager.js       # Device control actions
├── window-manager.js       # Window state management
├── opencode-manager.js     # OpenCode server subprocess management
└── log-manager.js          # Logging system

src/js/modules/             # Renderer process modules
├── core-engine.js          # Central coordinator (singleton)
├── app-state.js            # Global state management
├── settings-manager.js     # Settings UI & sync
├── command-manager.js      # Command queue client
├── command-executor.js     # Job execution logic
├── protocol-handler.js     # AI-AI communication protocol
├── catch-manager.js        # Command interception
│
├── database/               # Database facade (renderer side)
│   ├── index.js            # DatabaseService orchestrator
│   ├── conversation-store.js # Konuşma CRUD işlemleri
│   └── message-store.js    # Mesaj CRUD ve sync işlemleri
│
├── relay-manager.js        # Relay orchestrator (AI↔AI, AI↔Asistan)
├── relay/                  # Relay alt modülleri
│   ├── base-relay.js       # Abstract base class for all relays
│   ├── ai-ai-relay.js      # AI-to-AI communication relay
│   ├── ai-asistan-relay.js # AI-to-Asistan communication relay
│   └── index.js            # Barrel export
│
├── slot-controller.js      # Slot lifecycle orchestrator
├── slot/                   # Slot alt modülleri
│   ├── webview-handler.js  # Webview attach/detach/dom-ready
│   ├── url-handler.js      # URL change tracking & exclusion
│   ├── timeout-handler.js  # Timeout & error management
│   ├── settings-sync.js    # Settings synchronization
│   └── index.js            # Barrel export
│
├── webview-manager.js      # Webview facade (send, sync, lifecycle)
├── webview/                # Webview alt modülleri
│   ├── lifecycle-manager.js    # Register, attach, detach, destroy
│   ├── message-sender.js       # Message & file sending
│   ├── conversation-syncer.js  # DOM scraping & archive sync
│   ├── pending-archive-handler.js # Pending archive operations
│   ├── provider-registry.js    # Provider configuration registry
│   ├── provider-factory.js     # Provider instantiation
│   ├── index.js                # Barrel export
│   ├── providers/
│   │   ├── chatgpt/
│   │   │   ├── config.js       # Provider config & DOM selectors
│   │   │   ├── index.js        # Main provider logic
│   │   │   └── scraper.js      # DOM scraping utilities
│   │   ├── gemini/
│   │   ├── grok/
│   │   └── opencode/           # Asistan provider (lokal server)
│   │       ├── config.js       # OpenCode config, selectors, server commands
│   │       ├── index.js        # Message sending logic
│   │       └── scraper.js      # Conversation scraping
│   └── methods/                # Injection methods
│       ├── message/            # Message sending strategies
│       │   ├── injection.js    # DOM injection method
│       │   └── xdotools.js     # X11 automation fallback
│       └── file/               # File upload strategies
│           ├── dragdrop.js     # Drag & drop simulation
│           ├── injection.js    # Direct DOM injection
│           ├── googledrive.js  # Google Drive links
│           ├── catbox.js       # Catbox.moe upload
│           └── uguu.js         # Uguu.se upload
│
├── traffic-manager.js      # Traffic orchestrator (loading/thinking/send)
├── traffic/                # Traffic alt modülleri
│   ├── loading-tracker.js  # Page loading state tracking
│   ├── thinking-tracker.js # AI thinking state tracking
│   ├── send-tracker.js     # Send button state tracking
│   ├── probe-script-builder.js # Webview probe script generator
│   └── webview-events.js   # Webview navigation events
│
├── server-commands.js      # Server command dispatcher
└── commands/               # Command handler'ları
    ├── utils.js            # Shared utilities
    ├── device-commands.js  # DeviceManager handler
    ├── screenshot-commands.js # Screenshot handlers
    ├── window-commands.js  # Window control handlers
    ├── whisper-commands.js # WhisperManager handler
    ├── file-commands.js    # File operation handlers
    └── ai-chat-commands.js # AI-AI chat handlers

src/js/pages/               # Page controllers
├── analyze.js              # Analyze page orchestrator
├── analyze/                # Analyze alt modülleri
│   ├── message-renderer.js # Message bubble rendering
│   ├── upload-handler.js   # File upload UI
│   ├── context-menu.js     # Context menu & read modal
│   └── draft-manager.js    # Draft persistence
├── asistan.js              # Asistan page controller (OpenCode integration)
├── settings.js
├── webview.js
└── ...

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


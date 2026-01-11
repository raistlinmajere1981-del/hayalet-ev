# Hayalet-ev Development Guide

## 📋 Project Overview

**Hayalet-ev** (Ghost House) is an Electron-based multi-AI chat interface platform that enables:
- **Multi-AI Integration:** ChatGPT, Gemini, Grok, and extensible for other providers
- **AI-to-AI Communication:** Protocol-based AI conversation system
- **Conversation Archiving:** Automatic conversation storage with Google Drive sync
- **Plugin System:** Extensible architecture for custom commands and features
- **Voice & Screenshots:** Whisper integration for voice input, screenshot capture
- **MCP Server:** Model Context Protocol server for Rovodev integration

### Tech Stack
- **Runtime:** Electron 39+ with Node.js (ESM modules)
- **Frontend:** Vanilla JavaScript (no framework), modern CSS
- **Build Tool:** Vite 7.3
- **Architecture:** Multi-process (Main + Renderer + Webviews)
- **IPC:** Electron IPC via preload scripts with contextBridge
- **Storage:** Local filesystem + Google Drive API
- **Dependencies:** googleapis, konva, screenshot-desktop

### Version
Current: `5.2.0`

---

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
├── settings-manager.js     # Settings persistence (JSON file)
├── file-manager.js         # File operations & archive management
├── command-manager.js      # Command queue system
├── googledrive-manager.js  # Google Drive sync
├── whisper-manager.js      # Voice input handling
├── screenshot-manager.js   # Screenshot capture
├── device-manager.js       # Device control actions
├── window-manager.js       # Window state management
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
│   │   └── grok/
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
├── settings.js
├── webview.js
└── ...

mcp-server/                 # MCP Protocol Server
├── index.js                # Server orchestrator
├── tools/                  # Tool handler'ları
│   ├── provider-tools.js   # list_providers, add_provider
│   ├── electron-tools.js   # test_electron, list_plugins
│   ├── log-tools.js        # read_electron_logs, list_log_sessions
│   └── debug-tools.js      # get_error_hints
└── utils/                  # Yardımcı fonksiyonlar
    └── log-utils.js        # Log reading utilities
```

---

## ⚠️ Dikkat Edilmesi Gerekenler

### Silinmemesi Gereken Modüller
Bu modüller "kullanılmıyor" gibi görünebilir ama kritik bağımlılıkları var:

| Modül | Kullananlar | Not |
|-------|-------------|-----|
| `upload-services.js` | catbox.js, uguu.js, tmpfile.js, googledrive.js | File upload metodları için kritik |
| `file-utils.js` | Tüm file upload metodları (6 dosya) | Silme! |
| `url-utils.js` | slot/url-handler, traffic-manager, webview-manager, conversation-syncer | URL işlemleri için kritik |
| `provider-registry.js` | 10 dosya tarafından kullanılıyor | Provider sistemi için merkezi |

### IPC Üzerinden Çağrılan Modüller
Bu modüller doğrudan import edilmez, `electron/main.js`'de IPC handler'ları üzerinden çağrılır:

- `device-manager.js` → `deviceActionHandler` (mouse, keyboard kontrolleri)
- `screenshot-manager.js` → `screenshot` IPC handler
- `whisper-manager.js` → `whisperLoad`, `whisperSave`
- `googledrive-manager.js` → OAuth ve sync işlemleri
- `server-commands.js` → Terminal/server komutları
- `asistan-manager.js` → Asistan modu yönetimi

### Provider Config'leri
AI siteleri DOM yapılarını sık değiştiriyor. Config dosyalarındaki selector'lar kırılabilir:
- `providers/chatgpt/config.js`
- `providers/gemini/config.js`
- `providers/grok/config.js`

Selector değişikliği yapmadan önce ilgili AI sitesinde manuel test yap.

---

## 🗺️ Modül Bağımlılık Haritası

### Kritik Shared Modüller
```
src/js/modules/webview/methods/shared/
├── upload-services.js ← catbox.js, uguu.js, tmpfile.js, googledrive.js
├── file-utils.js ← catbox.js, uguu.js, tmpfile.js, googledrive.js, dragdrop.js, injection.js
└── url-utils.js ← url-handler.js, traffic-manager.js, webview-manager.js, conversation-syncer.js, message-sender.js
```

### Core Engine Bağımlılıkları
```
core-engine.js
├── app.js (entry point)
├── pages/analyze.js
├── pages/entrance.js
├── pages/server.js
├── pages/webview.js
├── pages/whisper.js
├── commands/ai-chat-commands.js
└── conversation-list-manager.js
```

### Provider Registry Bağımlılıkları
```
provider-registry.js
├── webview-manager.js
├── webview/lifecycle-manager.js
├── webview/conversation-syncer.js
├── webview/message-sender.js
├── webview/index.js
├── slot/settings-sync.js
├── traffic-manager.js
├── traffic/loading-tracker.js
├── traffic/probe-script-builder.js
└── pages/webview.js
```

### Electron Main Process Bağımlılıkları
```
electron/main.js
├── device-manager.js (IPC: deviceAction)
├── screenshot-manager.js (IPC: screenshot)
├── whisper-manager.js (IPC: whisperLoad, whisperSave)
├── googledrive-manager.js (IPC: OAuth, sync)
├── settings-manager.js (IPC: load-settings, save-settings)
├── command-manager.js (IPC: command-write, command-read)
├── file-manager.js (IPC: file operations)
├── webview-manager.js (IPC: catboxUpload, uguuUpload)
├── server-commands.js (IPC: server commands)
├── asistan-manager.js (IPC: asistan mode)
├── log-manager.js (logging)
└── console-logger.js (session logging)
```

---

## 🔑 Key Concepts

### 0. Modular Architecture Pattern

Proje, büyük modülleri yönetilebilir alt modüllere bölen **Orchestrator Pattern** kullanır:

**Yapı:**
```
module-name.js              # Orchestrator (public API, koordinasyon)
module-name/                # Alt modüller klasörü
├── sub-module-1.js         # Tek sorumluluk
├── sub-module-2.js         # Tek sorumluluk
└── index.js                # Barrel export (opsiyonel)
```

**Kurallar:**
- **Orchestrator:** Public API'yi expose eder, alt modülleri koordine eder (~200-500 satır)
- **Alt modüller:** Tek bir sorumluluğa odaklanır (~100-300 satır)
- **Barrel export:** `index.js` ile tüm modülleri tek noktadan export et
- **AI-friendly:** Her dosya AI asistanların işlem yapabileceği boyutta (~300 satır ideal)

**Mevcut Orchestrator'lar:**
| Orchestrator | Alt Klasör | Açıklama |
|--------------|------------|----------|
| `relay-manager.js` | `relay/` | AI↔AI, AI↔Asistan relay yönetimi |
| `slot-controller.js` | `slot/` | Webview bağlantı yaşam döngüsü |
| `webview-manager.js` | `webview/` | Mesaj gönderim, sync, lifecycle |
| `traffic-manager.js` | `traffic/` | Loading, thinking, send tracking |
| `server-commands.js` | `commands/` | Server komut handler'ları |
| `console-logger.js` | `logger/` | Session, writer, reader |
| `analyze.js` | `analyze/` | Sayfa alt bileşenleri |
| `mcp-server/index.js` | `tools/`, `utils/` | MCP tool handler'ları |

### 1. Settings System
- **Storage:** `./config/settings.json` (project root, portable across platforms)
- **Schema:** Defined in `src/js/modules/settings/settings-schema.js`
- **Structure:**
  ```javascript
  {
    user: { nickname: "Kullanıcı", avatarPath: "", connected: false },
    integrations: {
      googledrive: {
        clientId: "",
        clientSecret: "",
        authorizationCode: "",
        connected: false,
        account: ""
      }
    },
    accounts: [
      {
        id: "uuid-123",
        email: "user@example.com",
        provider: "chatgpt",
        nickname: "My ChatGPT",
        avatarPath: "assets/user@example.com-chatgpt.png"
      }
    ],
    slots: {
      ai1: {
        accountId: "uuid-123",
        connected: false,
        catchCommands: true,
        messageMethod: "injection",
        fileMethod: "dragdrop"
      },
      ai2: {
        accountId: null,
        connected: false,
        catchCommands: true,
        messageMethod: "injection",
        fileMethod: "dragdrop"
      }
    }
  }
  ```
- **Access:** Via `SettingsManager.load()` / `SettingsManager.save()`
- **IPC Channels:** `load-settings`, `save-settings`

### 2. IPC Communication Pattern
All renderer-to-main communication goes through `electronAPI` exposed in `preload.cjs`:

```javascript
// Renderer side
const result = await window.electronAPI.commandWrite(item);

// Main process (electron/main.js)
ipcMain.handle("command-write", async (event, item) => {
  return CommandManager.write(item);
});
```

**Security:** Uses `contextBridge` with `contextIsolation: true` and `nodeIntegration: false`

### 3. Provider System
Each AI provider is a self-contained module with:
- **config.js:** Provider metadata, URL patterns, DOM selectors
- **index.js:** Message sending, file upload, scraping logic
- **scraper.js:** Conversation extraction from DOM

**Adding a new provider:**
1. Create `src/js/modules/webview/providers/{provider}/` directory
2. Implement config, index, and scraper
3. Register in `provider-registry.js`
4. Add UI button in webview page

### 4. Command Queue System
Asynchronous job queue for AI message sending:
- **Location:** `electron/command-manager.js` (main) + `src/js/modules/command-manager.js` (renderer)
- **Flow:** `pending → in_progress → sent | failed`
- **Persistence:** Jobs stored in `./commands/` (project root)
- **Use Case:** Ensures messages are sent even if webview is loading

### 5. AI-AI Communication Protocol
- **Protocol Files:** `protocol/analyze-AI1-AI2.txt`, `protocol/analyze-AI2-AI1.txt`, etc.
- **Handler:** `src/js/modules/protocol-handler.js`
- **Relay:** `src/js/modules/relay-manager.js`
- **Commands:** Special syntax like `@AI2[message]` to trigger inter-AI communication

### 6. Archive System
- **Location:** `archives/` directory
- **Structure:** Each conversation creates a folder with metadata and message files
- **Sync:** Google Drive integration via `googledrive-manager.js`
- **Index:** `archives/index.json` tracks all conversations

### 7. Traffic Tracking
Three types of activity tracking:
- **Loading:** `traffic/loading-tracker.js` - Webview loading states
- **Sending:** `traffic/send-tracker.js` - Message send progress
- **Thinking:** `traffic/thinking-tracker.js` - AI response generation

### 8. Unified Log System
Session bazlı, AI-debugging için optimize edilmiş log sistemi.

**Log Dosya Yapısı:**
```
./logs/
├── {sessionId}/                    # Her uygulama çalışması için ayrı dizin
│   ├── meta.json                  # Session metadata (platform, versions)
│   ├── console-001.log            # Console logları (10K satırda chunk'lanır)
│   ├── console-002.log            # Sonraki chunk
│   ├── error.log                  # Sadece hatalar ve uyarılar
│   ├── structured.jsonl           # JSON formatında structured loglar
│   ├── state-snapshots.jsonl      # Periyodik uygulama durumu
│   └── summary.json               # Session özeti (kapanışta yazılır)
```

**Log Seviyeleri:**
- `error` - Kritik hatalar, her zaman loglanır
- `warning` - Uyarılar, error.log'a da yazılır
- `info` - Genel bilgi mesajları
- `debug` - Detaylı debug bilgisi (gürültülü, filtrelenebilir)
- `system` - Sistem olayları (init, shutdown)

**LogManager Kullanımı (Renderer Process):**
```javascript
import { LogManager } from "./modules/log-manager.js";

// Basit log
LogManager.addEvent("source", "info", "Mesaj");

// Context ile log (webview işlemleri için)
LogManager.addEventWithContext("webview", "error", "Selector bulunamadı", {
  provider: "chatgpt",
  selector: "button[data-testid='send']",
  url: "https://chat.openai.com/c/xxx",
}, correlationId);

// İşlem takibi (correlation ID ile)
const correlationId = LogManager.startOperation("file-upload", { provider: "ai1" });
// ... işlem ...
LogManager.endOperation(correlationId, "success", { uploadedCount: 3 });
```

**Error Pattern Hints:**
Bilinen hata pattern'leri otomatik olarak tespit edilir ve çözüm önerileri eklenir:
```javascript
// Hata loglandığında otomatik hint eklenir:
{
  "type": "error",
  "message": "Cannot read property 'click' of null",
  "aiHint": {
    "category": "dom-selector",
    "suggestion": "Selector muhtemelen değişti. Provider config'i kontrol et.",
    "checkFiles": ["src/js/modules/webview/providers/chatgpt/config.js"],
    "severity": "high"
  }
}
```

**Best Practices:**
- ❌ `console.log()` kullanma - main process'te intercepted ama renderer'da LogManager tercih edilmeli
- ✅ `LogManager.addEvent()` kullan - dosyaya yazılır, UI'da görünür
- ✅ Error ve warning için her zaman context ekle
- ✅ Uzun işlemlerde correlation ID kullan
- ❌ Döngülerde veya sık çağrılan fonksiyonlarda info log yazma (throttling var ama yine de dikkat)

---

## 🎯 Development Guidelines

### Code Style
- **Language:** Modern JavaScript (ES2022+, ESM modules)
- **Async:** Always use `async/await`, never callbacks
- **Error Handling:** Always wrap async operations in try-catch
- **Naming:** Descriptive camelCase for functions, PascalCase for classes
- **Comments:** Minimize comments - only add AI-assistant-friendly comments:
  - ✅ JSDoc blocks (`/** ... */`) for function/module documentation
  - ✅ Section separators (`// ===...`, `// ---...`) for code organization
  - ✅ Selector explanations in config files (`// Turkish:`, `// Primary:`, `// Fallback:`)
  - ✅ URL references and external documentation links
  - ✅ Critical warnings (`// WARNING:`, `// HACK:`, `// TODO:`)
  - ❌ Avoid: Simple explanatory comments that describe obvious code
  - ❌ Avoid: Commented-out code blocks
  - ❌ Avoid: Redundant inline comments
- **Documentation:** All Markdown files in Turkish

### File Naming Conventions
- **Managers:** `*-manager.js` (singleton services, orchestrators)
- **Handlers:** `*-handler.js` (event processors)
- **Trackers:** `*-tracker.js` (state monitoring)
- **Utils:** `*-utils.js` (helper functions)
- **Commands:** `*-commands.js` (command handlers in `commands/`)
- **Tools:** `*-tools.js` (MCP tool handlers in `mcp-server/tools/`)
- **Pages:** `src/js/pages/*.js` + `src/pages/*.html` (page logic + markup)
- **Barrel Exports:** `index.js` (re-export all from a module folder)

### Module Pattern
```javascript
// Singleton manager pattern
export const MyManager = {
  _state: null,
  
  init() {
    this._state = {};
  },
  
  async doSomething() {
    // Implementation
  }
};

// Class-based pattern
export class MyService {
  constructor(deps) {
    this.deps = deps;
  }
  
  async method() {
    // Implementation
  }
}
```

### IPC Safety Rules
- **Never** use `remote` module (deprecated and unsafe)
- **Always** use `ipcRenderer.invoke()` for async operations
- **Always** validate input in main process handlers
- **Never** pass DOM objects through IPC
- **Always** sanitize file paths before operations

### Webview Best Practices
- **Lazy Loading:** Only create webviews when needed
- **Memory Management:** Destroy inactive webviews if memory constrained
- **Preload Scripts:** Use `webview-preload.cjs` for provider DOM manipulation
- **Security:** Never disable webSecurity in production
- **Communication:** Use `sendToHost()` from webview preload to renderer

### Plugin Development
See `plugins/hayalet-ev/README.md` for detailed guide:
- Create `.claude-plugin/plugin.json` manifest
- Add commands as Markdown files in `commands/`
- Use YAML frontmatter for metadata
- Test with `/plugin-name:command-name` syntax

---

## 🚀 Common Tasks

### Running the Application
```bash
# Install dependencies
npm install

# Development mode (Vite dev server + Electron)
npm run start

# Production build
npm run build
npm run electron

# Linting
npm run lint
npm run lint:fix

# Type checking
npm run check-types
```

### Adding a New AI Provider
1. **Create provider files:**
   ```bash
   mkdir -p src/js/modules/webview/providers/newprovider
   touch src/js/modules/webview/providers/newprovider/{config.js,index.js,scraper.js}
   ```

2. **Implement config.js:**
   ```javascript
   export const config = {
     id: "newprovider",
     name: "NewProvider",
     url: "https://newprovider.ai",
     domain: "newprovider.ai",
     // Add selectors, methods, etc.
   };
   ```

3. **Register in provider-registry.js:**
   ```javascript
   import { config as newprovider } from "./providers/newprovider/config.js";
   
   const providers = {
     chatgpt,
     grok,
     gemini,
     newprovider,  // Add here
   };
   ```

4. **Test:** Use MCP server tool or manual testing

### Debugging
- **Main Process:** Console output in terminal (where `npm start` runs)
- **Renderer Process:** DevTools in Electron window (Ctrl+Shift+I)
- **Webview:** Right-click webview → Inspect Element
- **Logs:** Check `./logs/{sessionId}/` (session bazlı log dizinleri)

#### Log Sistemini Kullanarak Debug
```bash
# 1. Uygulamayı başlat
npm run start

# 2. Hata oluştuğunda logları kontrol et
ls -la logs/                           # Session listesi
cat logs/{sessionId}/error.log         # Sadece hatalar
tail -50 logs/{sessionId}/console-001.log  # Son 50 console logu
cat logs/{sessionId}/meta.json         # Session bilgisi
cat logs/{sessionId}/summary.json      # Session özeti (kapanışta)

# 3. Structured logları incele (JSON format)
cat logs/{sessionId}/structured.jsonl | jq .
```

#### MCP Server ile Log Okuma (AI-Assisted Debugging)
```bash
# Session listesi
read_electron_logs --type all --tail 100

# Sadece webview hataları
read_electron_logs --source "WEBVIEW-*" --type error

# Belirli bir işlemi takip et (correlation ID ile)
read_electron_logs --correlationId "cmd-xxxxx"

# Hata analizi ve çözüm ipucu
get_error_hints --errorMessage "Cannot read property 'click' of null" --provider chatgpt

# Session özeti
get_session_summary
list_log_sessions --limit 5
```

#### Application Testing with Logs
Uygulama değişikliklerini test etmek için `npm run start` ile çalıştırıp log dosyalarını analiz edin:

```bash
# 1. Uygulamayı başlat (arka planda)
npm run start &
APP_PID=$!

# 2. Bir süre bekle (10-15 saniye)
sleep 12

# 3. Uygulamayı kapat
kill $APP_PID 2>/dev/null
pkill -f "electron" 2>/dev/null

# 4. En son log klasörünü bul ve analiz et
LATEST_LOG=$(ls -t logs/ | head -1)
echo "Session: $LATEST_LOG"

# 5. Log dosyalarını kontrol et
ls -la "logs/$LATEST_LOG/"              # Dosya listesi
cat "logs/$LATEST_LOG/meta.json"        # Session meta bilgisi
cat "logs/$LATEST_LOG/error.log"        # Hatalar (boş olmalı)
cat "logs/$LATEST_LOG/summary.json"     # Session özeti
tail -30 "logs/$LATEST_LOG/console-001.log"     # Console logları
tail -20 "logs/$LATEST_LOG/structured.jsonl"    # Structured eventler
```

**Başarılı Test Kriterleri:**
- ✅ `error.log` boş veya sadece uyarılar içermeli
- ✅ `summary.json` → `endReason: "normal"` olmalı
- ✅ `structured.jsonl` → Beklenen event'ler loglanmış olmalı
- ✅ `console-001.log` → Kritik hata mesajı olmamalı

**Yaygın Log Analiz Senaryoları:**
```bash
# Sadece hataları filtrele
grep -i "error\|fail\|exception" "logs/$LATEST_LOG/console-001.log"

# Belirli bir modülün loglarını filtrele
grep "webview\|slot" "logs/$LATEST_LOG/structured.jsonl" | jq .

# Import/syntax hatalarını kontrol et
grep -i "failed to resolve\|cannot find\|syntax" "logs/$LATEST_LOG/console-001.log"
```

### Testing with MCP Server
```bash
# Start MCP server separately for debugging
cd mcp-server
node index.js

# Use Rovodev to test tools
acli rovodev
# Then: "Hayalet-ev'de provider'ları listele"
```

---

## 🔌 Plugin System

### Available Plugins
- **hayalet-ev:** Project-specific commands (`add-webview`, `create-plugin`, `test-electron`)
- **git:** Git workflow automation (`commit-push`, `create-pr`, `review-pr`)
- **claude:** Meta-development commands (`create-command`, `create-skill`, `create-subagent`)

### Plugin Commands
Invoke with `/plugin-name:command-name` syntax in Claude Code:
```
/hayalet-ev:add-webview perplexity
/hayalet-ev:test-electron
/git:commit-push
/claude:create-command
```

### Plugin Structure
```
plugins/my-plugin/
├── .claude-plugin/
│   └── plugin.json          # Manifest (name, version, description)
├── commands/
│   ├── my-command.md        # Command definition with YAML frontmatter
│   └── another-command.md
└── README.md                # Documentation
```

---

## 🎨 UI Design Philosophy

### ULTRATHINK Protocol
See `ultrathink.md` for full behavioral protocols. Key points:
- **Default Mode:** Concise, focused, zero fluff
- **ULTRATHINK Mode:** Deep multi-dimensional analysis (trigger with "ULTRATHINK" command)
- **Design:** Intentional minimalism, anti-generic layouts
- **UI Library:** If a library exists in project, MUST use it (currently: none, vanilla JS)

### CSS Structure
- **Global:** `src/styles/main.css`
- **Page-Specific:** `src/styles/{page}.css`
- **Design:** Minimalist, functional, high contrast
- **Typography:** System fonts, clear hierarchy
- **Colors:** Dark theme primary (background: dark gray, text: white/light)

### UI Conventions
- **No Bootstrap/Tailwind:** Custom CSS only
- **Semantic HTML:** Use proper HTML5 elements
- **Accessibility:** WCAG AAA compliance where possible
- **Micro-interactions:** Subtle hover effects, transitions
- **Performance:** Minimize repaints, use CSS transforms

---

## 📁 Important Files Reference

### Core Entry Points
- `electron/main.js` - Application lifecycle, IPC handlers setup
- `src/index.html` - Main UI structure
- `src/js/app.js` - Renderer entry point
- `package.json` - Dependencies, scripts, metadata

### Configuration
- `jsconfig.json` - JavaScript project config (for IDE/type checking)
- `eslint.config.cjs` - ESLint rules (CommonJS config)
- `vite.config.js` - Vite build configuration
- `.gitignore` - Git exclusions

### Documentation
- `README.md` - Project overview (Turkish)
- `ultrathink.md` - AI behavioral protocols
- `AGENTS.md` - This file (development guide)

### MCP Server
- `mcp-server/index.js` - MCP protocol implementation
- `mcp-server/README.md` - MCP server documentation (Turkish)

---

## 🔒 Security Considerations

### Electron Security
- ✅ `contextIsolation: true` - Isolates preload from renderer
- ✅ `nodeIntegration: false` - No Node.js in renderer
- ✅ `sandbox: true` - Process sandboxing enabled
- ✅ `webSecurity: true` - CORS and web security enabled
- ✅ CSP headers - Content Security Policy enforced

### IPC Security
- All IPC channels validated in main process
- File paths sanitized before filesystem operations
- No dynamic `eval()` or `Function()` construction
- User input escaped before DOM injection

### Webview Security
- Each AI provider runs in isolated webview context
- Separate preload script with limited API exposure
- No direct DOM access from main/renderer to webview
- Communication via IPC and `sendToHost()` only

### Google Drive
- OAuth 2.0 flow with refresh tokens
- Credentials stored in secure system directory
- Token refresh handled automatically
- Disconnect option available

---

## 🛠️ Troubleshooting

### Common Issues

**Electron won't start:**
```bash
# Check Node.js version (18+ required)
node --version

# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# Try with clean profile
npm run electron -- --user-data-dir=/tmp/hayalet-test
```

**IPC channel not working:**
- Check channel name matches in preload.cjs and main.js
- Verify `ipcMain.handle()` is registered before window creation
- Check for typos in `electronAPI` method names
- Look for errors in main process console output

**Webview not loading:**
- Check network connectivity
- Verify provider URL in config.js
- Inspect webview DevTools for errors
- Check if provider changed their DOM structure

**Settings not persisting:**
- Check file permissions on `./config/` directory
- Verify JSON syntax in settings.json
- Look for errors in settings-manager.js logs

**MCP Server not responding:**
```bash
# Test server directly
cd mcp-server
node index.js
# Should show "Hayalet-ev MCP Server started"

# Check Rovodev config
cat ~/.rovodev/mcp.json
# Verify path is correct

# Restart Rovodev
pkill -f "acli rovodev" && acli rovodev
```

---

## 📚 Learning Resources

### Electron Documentation
- [Electron Docs](https://www.electronjs.org/docs/latest/) - Official documentation
- [Security Best Practices](https://www.electronjs.org/docs/latest/tutorial/security) - Must-read
- [IPC Communication](https://www.electronjs.org/docs/latest/tutorial/ipc) - Inter-process communication

### Project Patterns
- Study existing providers in `src/js/modules/webview/providers/` for patterns
- Read `core-engine.js` to understand application flow
- Check `command-manager.js` for queue system implementation
- Review `protocol-handler.js` for AI-AI communication logic

### AI-Assisted Development
- Use ULTRATHINK mode for complex architectural decisions
- Leverage MCP server for automated tasks
- Use plugin commands for common workflows
- Follow patterns in existing code before creating new ones

---

## 🤝 Contributing Guidelines

### Before Starting
1. Read this AGENTS.md file completely
2. Review `ultrathink.md` for behavioral protocols
3. Check existing issues/features in progress
4. Discuss major changes before implementation

### Development Workflow
```bash
# 1. Create feature branch
git checkout -b feature/my-feature

# 2. Make changes following guidelines
# 3. Test thoroughly
npm run lint
npm run check-types
npm run start  # Test in dev mode

# 4. Commit with descriptive message (Turkish)
git add .
git commit -m "feat: Yeni özellik açıklaması"

# 5. Push and create PR
git push origin feature/my-feature
```

### Code Review Checklist
- [ ] Follows project code style
- [ ] No direct `console.log` in renderer (use `LogManager.addEvent()`)
- [ ] Error/warning logs include context (provider, url, selector, etc.)
- [ ] Long operations use correlation ID for tracking
- [ ] Error handling implemented
- [ ] Comments in Turkish for complex logic
- [ ] No new dependencies without discussion
- [ ] Tested in development mode
- [ ] No breaking changes to existing APIs
- [ ] Documentation updated if needed

### Commit Message Format
Use conventional commits (Turkish):
- `feat:` - Yeni özellik
- `fix:` - Hata düzeltmesi
- `docs:` - Dokümantasyon
- `style:` - Kod formatı
- `refactor:` - Kod iyileştirme
- `test:` - Test ekleme
- `chore:` - Bakım işleri

---

## 📝 Notes

### Language Convention
- **Code:** English (variables, functions, classes)
- **Comments:** Turkish (inline explanations)
- **Documentation:** Turkish (README, this file, other .md files)
- **Commit Messages:** Turkish
- **UI Text:** Turkish

### Performance Considerations
- Webviews are heavy - lazy load when possible
- Use `visibility: hidden` instead of destroying webviews for faster switching
- Debounce expensive operations (DOM scraping, archive writes)
- Monitor memory usage with large conversations

### Future Considerations
- **Plugin System V2:** Hot reload, better isolation
- **Cloud Sync:** Beyond Google Drive (Dropbox, OneDrive)
- **Mobile App:** React Native port?
- **AI Providers:** DeepSeek, Perplexity, Claude Desktop integration
- **Protocol V2:** More sophisticated AI-AI communication

---

## 🔗 Quick Links

- **Repository:** (Add your git repo URL)
- **Issues:** (Add issues URL)
- **Discussions:** (Add discussions URL)
- **MCP Server Docs:** `mcp-server/README.md`
- **Plugin Docs:** `plugins/hayalet-ev/README.md`
- **ULTRATHINK Protocol:** `ultrathink.md`

---

**Last Updated:** 2026-01-11  
**Version:** 5.3.0 (Modular Architecture Refactor)  
**Maintainer:** Raistlin Majere, Nexa, Gök

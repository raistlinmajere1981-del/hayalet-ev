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
Current: `5.4.0`

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

mcp-server/                 # MCP Protocol Server (v1.3.0)
├── index.js                # Server orchestrator (20 tool)
├── tools/                  # Tool handler'ları
│   ├── provider-tools.js   # list_providers, add_provider
│   ├── electron-tools.js   # test_electron, list_plugins
│   ├── log-tools.js        # read_electron_logs, list_log_sessions
│   ├── debug-tools.js      # get_error_hints
│   └── cdp-tools.js        # CDP tool handlers (12 tool) - UI otomasyon
└── utils/                  # Yardımcı fonksiyonlar
    ├── log-utils.js        # Log reading utilities
    ├── cdp-connection.js   # WebSocket bağlantı yönetimi (CDP)
    └── cdp-commands.js     # UI otomasyon komutları (CDP)
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
- **Auto-Init:** Uygulama açılışında dosya yoksa default değerlerle oluşturulur
- **No Backup:** Settings güncellemesinde `.bak` dosyası oluşturulmaz

#### Account ID Formatı (Deterministik)
```
{provider}_{sanitizedEmail}

Örnekler:
- chatgpt_user_at_gmail_com
- grok_work_at_company_com
- gemini_personal_at_outlook_com
```

**Özellikler:**
- Aynı email+provider kombinasyonu silinip yeniden oluşturulsa bile aynı ID üretilir
- Aynı email+provider ile ikinci hesap oluşturulamaz (duplicate prevention)
- Aynı hesap iki farklı slota atanamaz (slot exclusivity)

**Utility Fonksiyonları (`src/js/constants/file-utils.js`):**
- `generateAccountId(email, provider)` → Deterministik account ID oluşturur
- `sanitizeEmail(email)` → Email'i klasör adı için güvenli formata çevirir
- `getAccountDataPath(accountId)` → Account ID'den data klasör yolu oluşturur

#### Settings Structure
```javascript
{
  user: { nickname: "Kullanıcı", avatarPath: "" },
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
      id: "chatgpt_user_at_gmail_com",  // Deterministik ID
      email: "user@gmail.com",
      provider: "chatgpt",
      nickname: "My ChatGPT",
      avatarPath: "assets/chatgpt_user_at_gmail_com.png"
    }
  ],
  asistanAccounts: [
    {
      id: "opencode_opencode_at_opencode_com",
      email: "opencode@opencode.com",
      provider: "opencode",
      nickname: "OpenCode",
      isAsistan: true
    }
  ],
  slots: {
    ai1: {
      accountId: "chatgpt_user_at_gmail_com",
      catchCommands: true,
      messageMethod: "injection",
      fileMethod: "dragdrop"
    },
    ai2: {
      accountId: null,
      catchCommands: true,
      messageMethod: "injection",
      fileMethod: "dragdrop"
    }
  },
  asistanSlot: {
    accountId: "opencode_opencode_at_opencode_com",
    catchCommands: false,
    messageMethod: "injection",
    fileMethod: "injection"
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

### 6. Asistan System (AI0 / OpenCode)

Asistan, AI1 ve AI2'nin teknik sorular sorabildiği yardımcı bir AI rolündedir. OpenCode lokal server üzerinden çalışır.

**Mimari:**
```
┌─────────────────────────────────────────────────────────────┐
│                    Hayalet-ev Electron                       │
├─────────────────────────────────────────────────────────────┤
│  AsistanController (src/js/pages/asistan.js)                │
│       │                                                      │
│       ├── OpenCode Server (subprocess)                       │
│       │   └── opencode serve --port 4096 --cors ...          │
│       │                                                      │
│       ├── Webview (ai0)                                      │
│       │   └── http://localhost:4096?project=hayalet-ev       │
│       │                                                      │
│       └── AI-Asistan Relay                                   │
│           └── AI1/AI2 ↔ AI0 mesaj iletimi                    │
└─────────────────────────────────────────────────────────────┘
```

**Bileşenler:**

| Dosya | Rol |
|-------|-----|
| `electron/opencode-manager.js` | Server subprocess yönetimi (start/stop/cleanup) |
| `src/js/pages/asistan.js` | Asistan sayfa controller |
| `src/js/modules/relay/ai-asistan-relay.js` | AI↔Asistan mesaj relay |
| `src/js/modules/webview/providers/opencode/config.js` | OpenCode DOM selectors |

**OpenCode Server Lifecycle:**
```javascript
// Bağlan butonu → Server başlat
const result = await window.electronAPI.opencodeStart({
  port: 4096,
  projectPath: "/home/raistlin/hayalet-ev"
});
// result.url → "http://localhost:4096?project=..."

// Bağlantıyı Kes → Server durdur
await window.electronAPI.opencodeStop();

// App kapanırken → Otomatik cleanup (main.js performCleanup)
```

**Provider Config (opencode/config.js):**
```javascript
{
  id: "opencode",
  name: "OpenCode",
  baseUrl: "http://localhost:4096",
  isAsistan: true,
  
  selectors: {
    // Base selector (aktif veya pasif buton)
    sendButtonBase: 'button[type="submit"][icon="arrow-up"][data-component="icon-button"]',
    // Aktif gönder butonu
    sendButton: '...sendButtonBase...:not([disabled])',
    // Pasif gönder butonu  
    sendButtonDisabled: '...sendButtonBase...[disabled]',
    // Stop butonu (thinking)
    stopButton: 'button[type="submit"][icon="stop"][data-component="icon-button"]',
    // Input alanı
    inputField: '[data-component="prompt-input"][contenteditable="true"]',
  }
}
```

**IPC Channels:**
- `opencode-start` → OpenCodeManager.start()
- `opencode-stop` → OpenCodeManager.stop()
- `opencode-status` → OpenCodeManager.getStatus()

### 7. AI-Asistan Relay

AI1 veya AI2 ile Asistan (AI0) arasında çift yönlü mesaj iletimi.

**Akış:**
```
1. Kullanıcı "AI-Asistan Sohbet" butonuna tıklar
2. Kaynak AI seçilir (ai1 veya ai2)
3. Protokol dosyası okunur (protocol/AI-asistan.txt)
4. Protokol kaynak AI'ye gönderilir
5. AI cevap verir → Asistan'a iletilir
6. Asistan cevap verir → AI'ye iletilir
7. Döngü devam eder
```

**State Machine:**
```
idle → protocol-sent → ai-replied → relay-active
                                         ↑↓
                                    (mesaj döngüsü)
```

**Relay Göstergesi (Topbar):**
```
[AI1] ───yeşil─── [Asistan] ───mavi─── [AI2]
           ╲                    ╱
            ╲──sarı/turuncu───╱
              (AI1-AI2 Relay)
```

| Çizgi | Kullanım | Renk |
|-------|----------|------|
| Sol (AI1 ↔ AI0) | AI1-Asistan Relay | Yeşil (#2ecc71) |
| Sağ (AI0 ↔ AI2) | AI2-Asistan Relay | Mavi (#3498db) |
| Alt (AI1 ↔ AI2) | AI-AI Relay | Sarı/Turuncu (#f1c40f) |

**Thinking Glow:**
AI düşünürken ilgili cluster yeşil parıltı ile vurgulanır:
```css
.indicator-cluster.thinking-active {
  box-shadow: 0 0 15px rgba(46, 204, 113, 0.5);
  animation: thinking-glow 1.5s ease-in-out infinite;
}
```

### 8. Database System (SQLite)
Konuşma ve mesaj verileri SQLite veritabanında saklanır. Her hesap için ayrı klasör ve veritabanı dosyası oluşturulur.

**⚠️ Tüm database erişimleri `accountId` üzerinden yapılır (email+provider değil).**

**Dosya Yapısı:**
```
data/
└── {accountId}/                     # Hesap klasörü (örn: chatgpt_user_at_gmail_com/)
    ├── database.db                  # SQLite veritabanı
    ├── whisper.json                 # Whisper verileri
    └── attachments/                 # Attachment dosyaları
        └── {conversationId}/        # Konuşma klasörü
            └── {messageId}/         # Mesaj klasörü
                └── filename.ext     # Dosya
```

**Tablo Şemaları:**
- `conversations` - Konuşma metadata (id, web_url, title, summary, message_count, timestamps)
- `messages` - Mesajlar (id, conversation_id, role, author, content, content_hash, dom_index)
- `attachments` - Ek dosya referansları (id, message_id, original_name, stored_path, mime_type)
- `messages_fts` - Full-text search virtual table (FTS5)

**Modül Yapısı:**
```
electron/database/
├── index.js          # DatabaseManager orchestrator
├── schema.js         # Tablo şemaları ve migration
├── queries.js        # Prepared statement'lar
└── hash-utils.js     # Mesaj hash fonksiyonları

src/js/modules/database/
├── index.js              # Renderer facade (DatabaseService)
├── conversation-store.js # Konuşma CRUD işlemleri
└── message-store.js      # Mesaj CRUD ve sync işlemleri
```

**IPC Kanalları:**
| Kanal | Açıklama |
|-------|----------|
| `db-init-account` | Hesap için veritabanı ve klasörleri oluştur |
| `db-get-conversations` | Konuşmaları listele |
| `db-get-messages` | Mesajları getir |
| `db-sync-messages` | Mesajları senkronize et (incremental) |
| `db-save-attachment` | Attachment kaydet |
| `db-delete-conversation` | Konuşmayı sil |
| `db-search-messages` | Full-text arama (FTS5) |
| `db-update-conversation` | Konuşma detaylarını güncelle |

**Incremental Sync:**
- Her mesaj için `content_hash` (djb2 algoritması) hesaplanır
- Sync sırasında sadece yeni mesajlar (hash'i olmayan) eklenir
- DOM'dan scrape edilen mesajlarda `contentHash` ve `domIndex` bulunur

**Conversation ID Format:**
```
conv-{timestamp}-{random}
Örnek: conv-1736799600000-a1b2c3
```

**Title Mantığı:**
- Yeni konuşma oluşturulduğunda: `Sohbet001`, `Sohbet002`... formatında otomatik başlık
- Mevcut konuşma sync olduğunda: Başlık değiştirilmez (manuel düzenlenebilir)

### 9. Traffic Tracking
Three types of activity tracking for AI1, AI2 and AI0 (Asistan):

| Tracker | Dosya | Başlangıç | Bitiş |
|---------|-------|-----------|-------|
| Loading | `loading-tracker.js` | URL değişimi | Send button bulunduğunda (enabled/disabled) |
| Thinking | `thinking-tracker.js` | Stop button görünür | Send button enabled/disabled |
| Send | `send-tracker.js` | Mesaj gönderildiğinde | Durum değişikliği |

**Probe Script (`probe-script-builder.js`):**
- Her provider için config'den selector'ları alır
- `sendButtonBase` varsa onu kullanır (disabled kontrolü script içinde)
- `sendState`: `"enabled"` | `"disabled"` | `"missing"`

**AI0 (Asistan) için özel:**
- `sendButtonBase` selector'ı kullanılır (`:not([disabled])` olmadan)
- Thinking bitiş koşulu: `sendState === "enabled" || sendState === "disabled"`

**Thinking Glow UI:**
- `traffic-manager.js` → `_updateClusterThinkingGlow(provider, status)`
- Thinking `busy` → cluster'a `thinking-active` class eklenir
- Yeşil parıltılı animasyon

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

### Constants Structure
Sabit değerler `src/js/constants/` klasöründe merkezi olarak yönetilir:

```
src/js/constants/
├── index.js          # Barrel export (tüm constants)
├── timeouts.js       # TIMEOUTS, INTERVALS, DELAYS
├── slots.js          # SLOTS, SLOT_LIST, PROVIDERS, PROVIDER_LIST, SPECIAL_PAGES
├── ipc-channels.js   # IPC channel isimleri
├── events.js         # EVENTS, DOM_EVENTS
└── file-utils.js     # getFilename, getExtension, getMimeType, generateUniqueId
```

**Kullanım:**
```javascript
import { TIMEOUTS, SLOTS, SLOT_LIST } from "./constants/index.js";
import { getFilename, generateUniqueId, getMimeTypeFromPath } from "./constants/index.js";

// Timeout kullanımı
setTimeout(callback, TIMEOUTS.DOM_READY);

// Slot kontrolü
if (SLOT_LIST.includes(provider)) { ... }

// Slot referansı
CoreEngine.registerWebview(SLOTS.AI1, webview);

// Dosya adı çıkarma (path'ten)
const filename = getFilename("/path/to/file.txt"); // "file.txt"

// Benzersiz ID oluşturma
const id = generateUniqueId("cmd"); // "cmd-1736603000000-a1b2c3d4"

// MIME type belirleme
const mime = getMimeTypeFromPath("image.png"); // "image/png"
```

### File Utility Functions
`src/js/constants/file-utils.js` dosyasında merkezi dosya işlemleri:

| Fonksiyon | Açıklama | Örnek |
|-----------|----------|-------|
| `getFilename(path)` | Dosya yolundan dosya adını çıkarır | `getFilename("/a/b/c.txt")` → `"c.txt"` |
| `getExtension(filename)` | Dosya uzantısını çıkarır (nokta olmadan) | `getExtension("file.png")` → `"png"` |
| `getMimeType(ext)` | Uzantıdan MIME type belirler | `getMimeType("png")` → `"image/png"` |
| `getMimeTypeFromPath(path)` | Dosya yolundan MIME type belirler | `getMimeTypeFromPath("x.pdf")` → `"application/pdf"` |
| `generateUniqueId(prefix)` | Timestamp + random ile benzersiz ID | `generateUniqueId("relay")` → `"relay-173660-f3a2"` |

**⚠️ Önemli:** Inline pattern kullanmayın! Bunun yerine utility fonksiyonlarını kullanın:
```javascript
// ❌ YANLIŞ - Inline pattern
const name = path.split(/[/\\]/).pop();
const id = `cmd-${Date.now()}-${Math.random().toString(16).slice(2)}`;

// ✅ DOĞRU - Utility fonksiyonları
const name = getFilename(path);
const id = generateUniqueId("cmd");
```

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

#### MCP Server ile CDP (Chrome DevTools Protocol) Kullanımı
Electron uygulaması çalışırken uzaktan kontrol ve otomasyon:

```bash
# Bağlantı kontrolü
check_electron_connection

# JavaScript çalıştır
send_command_to_electron --command "document.title"

# Ekran görüntüsü al
take_cdp_screenshot --savePath "./debug-screenshot.png"

# Element tıklama
click_element_by_selector --selector "#submit-btn"
click_element_by_text --text "Gönder" --tagName "button"

# Input doldurma
fill_input_field --selector "#username" --value "admin"

# DOM yapısını incele
get_page_dom_structure --maxDepth 3
inspect_element --selector ".main-content"
query_elements --selector "button"

# Klavye ve scroll
send_key_press --key "Enter"
scroll_page --y 500
```

**CDP Port:** Electron varsayılan olarak port 9222'de debug modunda başlar. `CDP_PORT` environment variable ile değiştirilebilir.

---

## 🎯 CDP-Driven Development & Testing

CDP (Chrome DevTools Protocol) entegrasyonu sayesinde AI asistanlar Electron uygulamasını **canlı olarak** kontrol edebilir, test edebilir ve debug yapabilir. Bu bölüm, geliştirme sürecinde CDP tool'larının nasıl kullanılacağını açıklar.

### CDP Mimarisi

```
┌─────────────────────────────────────────────────────────────────┐
│                     AI Asistan (Rovodev)                        │
├─────────────────────────────────────────────────────────────────┤
│  MCP Server (mcp-server/index.js)                               │
│       │                                                          │
│       ├── cdp-tools.js (Tool handlers)                          │
│       │       │                                                  │
│       │       ├── cdp-connection.js (WebSocket bağlantı)        │
│       │       └── cdp-commands.js (UI otomasyon komutları)      │
│       │                                                          │
│       └───────────────────┐                                      │
│                           │ WebSocket (ws://localhost:9222)      │
│                           ▼                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Electron (--remote-debugging-port=9222)     │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │    │
│  │  │ Main Window │  │  Webview 1  │  │  Webview 2  │      │    │
│  │  │ (Renderer)  │  │  (ChatGPT)  │  │   (Grok)    │      │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘      │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### CDP Tool Kategorileri

| Kategori | Tool'lar | Kullanım Amacı |
|----------|----------|----------------|
| **Bağlantı** | `check_electron_connection` | Electron çalışıyor mu kontrolü |
| **İnceleme** | `get_electron_window_info`, `get_page_dom_structure`, `inspect_element`, `query_elements` | UI durumunu anlama |
| **Etkileşim** | `click_element_by_selector`, `click_element_by_text`, `fill_input_field`, `send_key_press`, `scroll_page` | UI ile etkileşim |
| **Görüntüleme** | `take_cdp_screenshot` | Görsel doğrulama |
| **Kod Çalıştırma** | `send_command_to_electron` | Arbitrary JavaScript |

### Geliştirme Workflow'ları

#### 1. Yeni Özellik Geliştirme

```
1. npm start                              # Uygulamayı başlat
2. check_electron_connection              # Bağlantıyı doğrula
3. get_page_dom_structure --maxDepth 2    # Mevcut UI'ı anla
4. [Kod değişikliği yap]                  # Özelliği implemente et
5. send_command_to_electron --command "location.reload()"  # Sayfayı yenile
6. query_elements --selector ".new-feature"  # Yeni elementin varlığını doğrula
7. take_cdp_screenshot --savePath "./test-ss.png"  # Görsel kontrol
```

#### 2. Bug Fix Workflow

```
1. npm start                              # Uygulamayı başlat
2. check_electron_connection              # Bağlantıyı doğrula
3. [Bug'ı tetikle - click/fill/navigate]  # Hatayı reproduce et
4. read_electron_logs --type error        # Hata loglarını oku
5. inspect_element --selector "#problem-element"  # Sorunlu elementi incele
6. [Fix'i uygula]
7. send_command_to_electron --command "location.reload()"
8. [Bug'ı tekrar tetikle]                 # Fix'i doğrula
9. take_cdp_screenshot                    # Görsel onay
```

#### 3. UI Regression Testing

```
1. npm start
2. check_electron_connection

# Ana sayfa kontrolü
3. get_electron_window_info               # Pencere boyutları
4. query_elements --selector "button"     # Tüm butonlar yerinde mi?
5. inspect_element --selector "#menu-toggle"  # Kritik elementler

# Navigasyon testi
6. click_element_by_selector --selector "#webview-btn"
7. take_cdp_screenshot --savePath "./webview-page.png"

# Form testi (varsa)
8. fill_input_field --selector "#search" --value "test"
9. send_key_press --key "Enter"
10. take_cdp_screenshot --savePath "./search-result.png"
```

### Selector Debugging

Provider config'lerindeki selector'lar kırıldığında CDP ile hızlı debug:

```bash
# 1. Mevcut DOM yapısını al
get_page_dom_structure --maxDepth 4

# 2. Belirli bir selector'ı test et
inspect_element --selector "button[data-testid='send-button']"

# 3. Alternatif selector'ları dene
query_elements --selector "button"
query_elements --selector "[type='submit']"
query_elements --selector ".send-btn"

# 4. XPath ile metin bazlı arama (click_by_text kullanarak)
click_element_by_text --text "Gönder" --tagName "button"
```

### State İnceleme

Uygulama state'ini JavaScript ile sorgulama:

```bash
# CoreEngine durumu
send_command_to_electron --command "window.CoreEngine?.getState?.()"

# Settings kontrolü
send_command_to_electron --command "JSON.stringify(window.AppState?.settings || 'N/A')"

# Aktif webview'lar
send_command_to_electron --command "document.querySelectorAll('webview').length"

# LocalStorage içeriği
send_command_to_electron --command "JSON.stringify(localStorage)"
```

### Screenshot-Based Verification

Görsel değişiklikleri doğrulamak için:

```bash
# Değişiklik öncesi
take_cdp_screenshot --savePath "./before.png"

# Değişikliği uygula
click_element_by_selector --selector "#toggle-theme"

# Değişiklik sonrası
take_cdp_screenshot --savePath "./after.png"

# Karşılaştırma için her ikisini de sakla
```

### Otomatik Test Senaryoları

#### Senaryo 1: Hesap Ekleme Flow'u

```bash
# 1. Entrance sayfasında olduğunu doğrula
send_command_to_electron --command "document.querySelector('.entrance-page') !== null"

# 2. "Hesap Ekle" butonuna tıkla
click_element_by_text --text "Hesap Ekle"

# 3. Form alanlarını doldur
fill_input_field --selector "#account-email" --value "test@example.com"
fill_input_field --selector "#account-nickname" --value "Test Account"

# 4. Provider seç
click_element_by_selector --selector "#provider-chatgpt"

# 5. Kaydet
click_element_by_text --text "Kaydet"

# 6. Başarılı eklemeyi doğrula
inspect_element --selector ".account-item[data-email='test@example.com']"
```

#### Senaryo 2: Webview Yükleme Testi

```bash
# 1. Webview sayfasına git
click_element_by_selector --selector "#webview-btn"

# 2. Bekle ve kontrol et
send_command_to_electron --command "new Promise(r => setTimeout(r, 2000))"

# 3. Webview varlığını doğrula
inspect_element --selector "webview#ai1-webview"

# 4. Loading durumunu kontrol et
send_command_to_electron --command "document.querySelector('webview')?.isLoading()"
```

### CDP Kullanım Best Practices

#### ✅ Yapılması Gerekenler

1. **Her zaman önce bağlantıyı kontrol et:**
   ```bash
   check_electron_connection
   ```

2. **Değişikliklerden önce screenshot al:**
   ```bash
   take_cdp_screenshot --savePath "./before-change.png"
   ```

3. **Element'e tıklamadan önce varlığını doğrula:**
   ```bash
   inspect_element --selector "#my-button"
   # exists: true ise tıkla
   click_element_by_selector --selector "#my-button"
   ```

4. **Async işlemler için bekle:**
   ```bash
   send_command_to_electron --command "new Promise(r => setTimeout(r, 1000))"
   ```

5. **Hata durumunda logları kontrol et:**
   ```bash
   read_electron_logs --type error --tail 20
   ```

#### ❌ Yapılmaması Gerekenler

1. **Bağlantı kontrolü yapmadan komut gönderme** - Timeout hatalarına yol açar
2. **Olmayan elemente tıklama** - inspect_element ile önce kontrol et
3. **Sayfayı yenilemeden kod değişikliği bekleme** - Hot reload her zaman çalışmaz
4. **Çok hızlı ardışık komutlar** - UI'ın render olması için zaman tanı

### Troubleshooting

#### "Electron'a bağlanılamadı" hatası
```bash
# 1. Electron çalışıyor mu?
pgrep -f electron

# 2. Port açık mı?
curl -s http://localhost:9222/json

# 3. Farklı port dene
CDP_PORT=9223 npm start
```

#### "Element bulunamadı" hatası
```bash
# 1. Sayfa tam yüklendi mi?
send_command_to_electron --command "document.readyState"

# 2. DOM yapısını kontrol et
get_page_dom_structure --maxDepth 3

# 3. Alternatif selector dene
query_elements --selector "*"  # Tüm elementleri listele
```

#### "CDP komut zaman aşımı" hatası
```bash
# 1. Electron yanıt veriyor mu?
send_command_to_electron --command "1+1"  # Basit test

# 2. Uygulamayı yeniden başlat
pkill -f electron && npm start

# 3. Logları kontrol et
read_electron_logs --type error
```

### MCP Server Modül Yapısı

```
mcp-server/
├── index.js                    # Orchestrator, tool tanımları
├── tools/
│   ├── provider-tools.js       # list_providers, add_provider
│   ├── electron-tools.js       # test_electron, list_plugins
│   ├── log-tools.js            # read_electron_logs, list_log_sessions
│   ├── debug-tools.js          # get_error_hints
│   └── cdp-tools.js            # CDP tool handlers (12 tool)
└── utils/
    ├── log-utils.js            # Log okuma utilities
    ├── cdp-connection.js       # WebSocket bağlantı yönetimi
    └── cdp-commands.js         # UI otomasyon komutları
```

### Environment Variables

| Variable | Default | Açıklama |
|----------|---------|----------|
| `CDP_PORT` | 9222 | Chrome DevTools Protocol port |
| `CDP_HOST` | localhost | CDP host adresi |

#### Application Testing with Logs
Uygulama değişikliklerini test etmek için `npm run start` ile çalıştırıp log dosyalarını analiz edin.

**Log Klasör Yapısı:**
Her uygulama oturumu `logs/` altında tarih-saat formatında bir klasör oluşturur:
```
logs/
└── DD-MM-YYYY_HH-MM-SS/           # Örnek: 13-01-2026_21-55-11
    ├── meta.json                  # Session başlangıç bilgileri (platform, versions)
    ├── console-001.log            # Ana console logları (tüm process'ler)
    ├── structured.jsonl           # JSON formatında structured eventler
    ├── summary.json               # Session özeti (kapanışta oluşur)
    └── error.log                  # Sadece hatalar (opsiyonel, hata varsa oluşur)
```

**Log Analizi Komutları:**
```bash
# 1. En son log session'ını bul (tarih sırasına göre)
# NOT: ls -t yerine ls | sort -r kullan (tarih formatı DD-MM-YYYY_HH-MM-SS)
LATEST_LOG=$(ls logs/ | sort -r | head -1)
echo "Session: $LATEST_LOG"

# 2. Tüm log dosyalarını listele
ls -la "logs/$LATEST_LOG/"

# 3. Her log dosyasını incele:

# meta.json - Session başlangıç bilgileri
cat "logs/$LATEST_LOG/meta.json"

# console-001.log - Ana log dosyası (tüm aktiviteler)
cat "logs/$LATEST_LOG/console-001.log"
# veya son N satır:
tail -50 "logs/$LATEST_LOG/console-001.log"

# structured.jsonl - JSON formatında eventler (jq ile parse)
cat "logs/$LATEST_LOG/structured.jsonl"
# veya jq ile:
cat "logs/$LATEST_LOG/structured.jsonl" | head -20

# summary.json - Session özeti (uygulama düzgün kapandıysa)
cat "logs/$LATEST_LOG/summary.json"

# error.log - Sadece hatalar (dosya varsa)
cat "logs/$LATEST_LOG/error.log" 2>/dev/null || echo "Hata yok"
```

**Kullanıcı Log Session Paylaştığında:**
Kullanıcı log session path'i paylaştığında (örn: `/home/raistlin/hayalet-ev/logs/13-01-2026_21-55-11/`) bu 5 dosyayı sırayla kontrol et:
1. `error.log` - Önce hataları kontrol et
2. `console-001.log` - Ana aktivite logları
3. `structured.jsonl` - Detaylı event bilgileri
4. `meta.json` - Session bilgileri
5. `summary.json` - Kapanış durumu

**Başarılı Test Kriterleri:**
- ✅ `error.log` boş veya sadece uyarılar içermeli (veya dosya yok)
- ✅ `summary.json` → `endReason: "normal"` olmalı
- ✅ `structured.jsonl` → Beklenen event'ler loglanmış olmalı
- ✅ `console-001.log` → Kritik hata mesajı olmamalı

**Yaygın Log Analiz Senaryoları:**
```bash
# Sadece hataları filtrele
grep -i "error\|fail\|exception" "logs/$LATEST_LOG/console-001.log"

# Sync işlemlerini filtrele
grep -i "sync\|database\|db" "logs/$LATEST_LOG/console-001.log"

# Belirli bir modülün loglarını filtrele
grep "webview\|slot" "logs/$LATEST_LOG/structured.jsonl"

# Import/syntax hatalarını kontrol et
grep -i "failed to resolve\|cannot find\|syntax" "logs/$LATEST_LOG/console-001.log"

# Belirli bir zaman aralığındaki logları filtrele
grep "21:55" "logs/$LATEST_LOG/console-001.log"
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

**Last Updated:** 2026-01-15  
**Version:** 5.4.0 (CDP Integration for AI-Assisted Development)  
**Maintainer:** Raistlin Majere, Nexa, Gök

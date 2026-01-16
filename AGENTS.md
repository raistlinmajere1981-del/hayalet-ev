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

> **Detaylı rehber:** `.rovodev/architecture.md`

### Process Mimarisi
```
Main Process (electron/main.js)
├── Renderer Process (src/index.html → CoreEngine)
├── AI Provider Webviews (isolated contexts)
└── IPC Bridge (preload.cjs)
```

### Kritik Modüller
| Modül | Konum | Rol |
|-------|-------|-----|
| CoreEngine | `src/js/modules/core-engine.js` | Ana koordinatör |
| WebviewManager | `src/js/modules/webview-manager.js` | Webview lifecycle |
| TrafficManager | `src/js/modules/traffic-manager.js` | State tracking |
| DatabaseManager | `electron/database/index.js` | SQLite yönetimi |
| SettingsManager | `electron/settings-manager.js` | JSON config |

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

> **Detaylı rehber:** `.rovodev/concepts.md`

### Hızlı Referans

| Kavram | Dosya | Açıklama |
|--------|-------|----------|
| Settings | `electron/settings-manager.js` | `./config/settings.json` yönetimi |
| IPC | `electron/preload.cjs` | `window.electronAPI.*` metodları |
| Providers | `src/js/modules/webview/providers/` | ChatGPT, Grok, Gemini, OpenCode |
| Database | `electron/database/` | SQLite, accountId bazlı |
| Traffic | `src/js/modules/traffic/` | Loading, thinking, send tracking |
| Relay | `src/js/modules/relay/` | AI↔AI, AI↔Asistan |

### Account ID Formatı
```
{provider}_{sanitizedEmail}
Örnek: chatgpt_user_at_gmail_com
```

### Log Kuralı (ZORUNLU)
```javascript
// ❌ YANLIŞ
console.log("mesaj");

// ✅ DOĞRU  
import { LogManager } from "./modules/log-manager.js";
LogManager.addEvent("source", "info", "mesaj");
```

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

> **Detaylı rehber:** `.rovodev/testing.md`

### Temel Komutlar
```bash
npm start              # Uygulamayı başlat
npm run lint           # Kod kontrolü
npm run pre-commit     # Commit öncesi kontrol
npm run analyze        # Proje analizi
npm run bootstrap      # Session context oluştur
```

### Yeni Session Başlangıcı
```bash
# 1. Context dosyasını oku (AGENTS.md yerine)
cat .rovodev/context.md

# 2. Gerekirse cache'i güncelle
npm run cache:update

# 3. Detaylı bilgi için
npm run analyze -- --summary
```

---

## 🔷 TypeScript Entegrasyonu

Proje "Incremental TypeScript" yaklaşımı kullanıyor: `.js` dosyaları TypeScript ile kontrol ediliyor, kademeli olarak `.ts`'e dönüştürülüyor.

### Mevcut Durum

| Kontrol | Komut | Açıklama |
|---------|-------|----------|
| ESLint + TS | `npm run lint` | Syntax + TypeScript kuralları |
| Tip Kontrolü | `npm run check-types` | `tsc --checkJs` ile tip analizi |
| Hızlı Kontrol | `npm run check` | lint + check-types |
| Tam Kontrol | `npm run check:all` | lint + check-types + build |

### Konfigürasyon Dosyaları

| Dosya | Açıklama |
|-------|----------|
| `tsconfig.json` | Renderer (src/js) için TypeScript config |
| `tsconfig.electron.json` | Electron (main process) için config |
| `eslint.config.cjs` | ESLint + typescript-eslint entegrasyonu |
| `src/js/global.d.ts` | Window.electronAPI tip tanımları |

### Pre-commit Hook

Her commit'te otomatik çalışır:
1. **ESLint kontrolü** → Error varsa commit engellenir
2. **TypeScript tip kontrolü** → Şimdilik uyarı (kademeli geçiş)
3. **console.log kontrolü** → Renderer'da kullanım uyarısı

### Güvenli .js → .ts Dönüşümü

**⚠️ ÖNEMLİ:** Dosyaları manuel olarak yeniden adlandırmayın! Migration script kullanın:

```bash
# Mevcut durumu kontrol et
npm run ts:check

# Tek dosya dönüştür (backup alır, import'ları günceller)
npm run ts:convert src/js/modules/my-module.js

# Dönüşüm sonrası doğrulama
npm run ts:validate

# Sorun çıkarsa geri al
node .rovodev/scripts/ts-migrate.js revert src/js/modules/my-module.ts
```

### Migration Script Özellikleri

`ts-migrate.js` scripti şunları otomatik yapar:
- ✅ Dönüşüm öncesi backup alır (`.ts-migrate-backup/`)
- ✅ Dosyayı `.ts`'e yeniden adlandırır
- ✅ Tüm import'ları günceller (`.js` → `.ts`)
- ✅ Dönüşüm sonrası lint + type check çalıştırır
- ✅ Sorun çıkarsa tek komutla geri alır

### Dönüşüm Sırası Önerisi

1. **Constants** (`src/js/constants/`) - Bağımlılığı az
2. **Utils** (`src/js/modules/webview/methods/shared/`) - Yardımcı fonksiyonlar
3. **Managers** (`src/js/modules/*-manager.js`) - Singleton servisler
4. **Pages** (`src/js/pages/`) - UI logic
5. **Core** (`core-engine.js`, `app.js`) - En son

### Tip Tanımları Ekleme

Yeni IPC metodu eklerken `src/js/global.d.ts`'i güncelle:

```typescript
// src/js/global.d.ts
interface Window {
  electronAPI?: {
    // ... mevcut metodlar
    myNewMethod: (param: string) => Promise<{ success: boolean }>;
  };
}
```

### Strict Mode Geçişi

Şu an `strict: false`. Tip hataları düzeldikçe kademeli olarak aktif edilecek:

```json
// tsconfig.json - Sırayla aktif et:
"noImplicitThis": true,     // ✅ Aktif
"strictNullChecks": false,  // → true yap
"noImplicitAny": false,     // → true yap
"strict": false,            // → true yap (son adım)
```

---

## 🎯 CDP-Driven Development & Testing

> **Detaylı rehber:** `.rovodev/cdp.md`

CDP (Chrome DevTools Protocol) entegrasyonu sayesinde AI asistanlar Electron uygulamasını canlı olarak kontrol edebilir, test edebilir ve debug yapabilir.

### Hızlı Başlangıç

```bash
# 1. Uygulamayı başlat
npm start

# 2. CDP bağlantısını kontrol et
check_electron_connection

# 3. Element incele
inspect_element --selector "#menu-toggle"

# 4. Tıkla
click_element_by_selector --selector "#webview-btn"

# 5. Screenshot al
take_cdp_screenshot --savePath "./test.png"
```

### Mevcut CDP Tool'ları

| Tool | Açıklama |
|------|----------|
| `check_electron_connection` | Bağlantı durumu |
| `send_command_to_electron` | JavaScript çalıştır |
| `take_cdp_screenshot` | Ekran görüntüsü |
| `get_electron_window_info` | Pencere bilgileri |
| `click_element_by_selector` | CSS selector ile tıkla |
| `click_element_by_text` | Metin ile tıkla |
| `fill_input_field` | Input doldur |
| `get_page_dom_structure` | DOM yapısı |
| `inspect_element` | Element detayları |
| `query_elements` | Elementleri listele |
| `send_key_press` | Klavye tuşu |
| `scroll_page` | Scroll |

> Detaylı kullanım, workflow'lar ve troubleshooting için: `.rovodev/cdp.md`

---

## 📝 Log Sistemi ve AI Agent Talimatları

> **Detaylı rehber:** `.rovodev/logging.md`

### ZORUNLU: console.log Kullanma!

Renderer process'te `console.log` yerine `LogManager` kullan:

```javascript
// ❌ YANLIŞ
console.log("Mesaj");
console.error("Hata:", err);

// ✅ DOĞRU
import { LogManager } from "./modules/log-manager.js";
LogManager.addEvent("source", "info", "Mesaj");
LogManager.addEvent("source", "error", `Hata: ${err.message}`);
```

### Test Sonrası Log Analizi

```bash
# En son session
LATEST_LOG=$(ls logs/ | sort -r | head -1)

# Hataları kontrol et
cat "logs/$LATEST_LOG/error.log" 2>/dev/null || echo "Hata yok ✅"

# Ana logları incele
tail -50 "logs/$LATEST_LOG/console-001.log"
```

> Detaylı log kullanımı ve örnekler için: `.rovodev/logging.md`
> Test workflow'ları için: `.rovodev/testing.md`


## 🔌 Plugin System

> **Detaylı:** `plugins/hayalet-ev/README.md`

Plugin komutları: `/plugin-name:command-name` syntax

## 📁 Important Files

| Dosya | Açıklama |
|-------|----------|
| `electron/main.js` | Ana process, IPC handlers |
| `electron/preload.cjs` | contextBridge API |
| `src/js/modules/core-engine.js` | Renderer koordinatör |
| `src/js/modules/webview-manager.js` | Webview yönetimi |
| `mcp-server/index.js` | MCP protocol server |

## 🔒 Security

- ✅ `contextIsolation: true`
- ✅ `nodeIntegration: false`
- ✅ `sandbox: true`
- IPC kanalları main process'te validate edilir
- Dosya yolları sanitize edilir

## 🛠️ Troubleshooting

| Sorun | Çözüm |
|-------|-------|
| Electron başlamıyor | `rm -rf node_modules && npm install` |
| CDP bağlantı yok | `npm start` ile uygulama çalışıyor mu? |
| IPC çalışmıyor | preload.cjs ve main.js channel isimlerini kontrol et |
| Webview yüklenmiyor | Provider config selectors'ı kontrol et |

> Detaylı troubleshooting: `.rovodev/testing.md`

## 📝 Notes

- **Kod dili:** İngilizce (değişkenler, fonksiyonlar)
- **Yorum dili:** Türkçe
- **Commit mesajları:** Türkçe, conventional commits

---

## 🔗 Quick Links

- `.rovodev/context.md` - **YENİ SESSION İÇİN ÖNCE BUNU OKU**
- `.rovodev/architecture.md` - Mimari detayları
- `.rovodev/concepts.md` - Key concepts detayları
- `.rovodev/cdp.md` - CDP tool'ları
- `.rovodev/logging.md` - Log sistemi
- `.rovodev/testing.md` - Test workflow'ları

---

**Last Updated:** 2026-01-15  
**Version:** 5.4.0 (Context Optimization)

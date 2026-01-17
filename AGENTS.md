# Hayalet-ev Development Guide

## 📋 Project Overview

**Hayalet-ev** (Ghost House) is an Electron-based multi-AI chat interface platform that enables:
- **Multi-AI Integration:** ChatGPT, Gemini, Grok, and extensible for other providers
- **AI-to-AI Communication:** Protocol-based AI conversation system
- **Conversation Archiving:** Automatic conversation storage with Google Drive sync
- **Plugin System:** Extensible architecture for custom commands and features
- **Voice & Screenshots:** Whisper integration for voice input, screenshot capture
- **MCP Server:** Model Context Protocol server for AI assistant integration

### Tech Stack
- **Runtime:** Electron 39+ with Node.js (ESM modules)
- **Language:** TypeScript (strict mode)
- **Build Tool:** Vite 7.3
- **Architecture:** Multi-process (Main + Renderer + Webviews)
- **Storage:** SQLite + Google Drive API

### Version
Current: `5.4.0`

---

## 🏗️ Architecture Overview

> **Detaylı rehber:** `.rovodev/architecture.md`

```
Main Process (electron/main.ts)
├── Renderer Process (src/index.html → CoreEngine)
├── AI Provider Webviews (isolated contexts)
└── IPC Bridge (preload.cjs)
```

### Kritik Modüller
| Modül | Konum | Rol |
|-------|-------|-----|
| CoreEngine | `src/js/modules/core-engine.ts` | Ana koordinatör |
| WebviewManager | `src/js/modules/webview-manager.ts` | Webview lifecycle |
| TrafficManager | `src/js/modules/traffic-manager.ts` | State tracking |
| DatabaseManager | `electron/database/index.ts` | SQLite yönetimi |
| SettingsManager | `electron/settings-manager.ts` | JSON config |

---

## ⚠️ Dikkat Edilmesi Gerekenler

### Silinmemesi Gereken Modüller
Bu modüller "kullanılmıyor" gibi görünebilir ama kritik bağımlılıkları var:

| Modül | Not |
|-------|-----|
| `file-utils.ts` | Tüm file upload metodları için kritik - **SİLME!** |
| `url-utils.ts` | URL işlemleri için kritik |
| `provider-registry.ts` | 10+ dosya tarafından kullanılıyor |

### IPC Üzerinden Çağrılan Modüller
Bu modüller doğrudan import edilmez, `electron/main.ts`'de IPC handler'ları üzerinden çağrılır:
- `device-manager.ts`, `screenshot-manager.ts`, `whisper-manager.ts`
- `googledrive-manager.ts`, `server-commands.ts`

### Provider Config'leri
AI siteleri DOM yapılarını sık değiştiriyor. Selector değişikliği yapmadan önce ilgili AI sitesinde manuel test yap:
- `providers/chatgpt/config.ts`
- `providers/gemini/config.ts`
- `providers/grok/config.ts`

---

## 🔑 Key Concepts

> **Detaylı rehber:** `.rovodev/concepts.md`

| Kavram | Dosya | Açıklama |
|--------|-------|----------|
| Settings | `electron/settings-manager.ts` | `./config/settings.json` yönetimi |
| IPC | `electron/preload.cjs` | `window.electronAPI.*` metodları |
| Providers | `src/js/modules/webview/providers/` | ChatGPT, Grok, Gemini, OpenCode |
| Database | `electron/database/` | SQLite, accountId bazlı |
| Traffic | `src/js/modules/traffic/` | Loading, thinking, send tracking |
| Relay | `src/js/modules/relay/` | AI↔AI, AI↔Asistan |

### Log Kuralı (ZORUNLU)
```typescript
// ❌ YANLIŞ
console.log("mesaj");

// ✅ DOĞRU  
import { LogManager } from "./modules/log-manager.ts";
LogManager.addEvent("source", "info", "mesaj");
```

---

## 🎯 Development Guidelines

> **Detaylı rehber:** `.rovodev/concepts.md`

### Code Style
- **Language:** TypeScript (ES2022+, ESM modules, strict mode)
- **Async:** Always use `async/await`, never callbacks
- **Error Handling:** Always wrap async operations in try-catch
- **Naming:** camelCase for functions, PascalCase for classes
- **Documentation:** All Markdown files in Turkish

### File Naming
- `*-manager.ts` → Singleton services
- `*-handler.ts` → Event processors
- `*-utils.ts` → Helper functions
- `index.ts` → Barrel exports

### IPC Safety
- **Never** use `remote` module
- **Always** use `ipcRenderer.invoke()` for async operations
- **Always** validate input in main process handlers

---

## 🔷 TypeScript

Proje **%100 TypeScript** ve **strict mode** ile çalışıyor.

| Bileşen | Strict Mode |
|---------|-------------|
| Renderer (src/js) | ✅ `strict: true` |
| Electron (electron/) | ✅ `strict: true` |
| MCP Server (mcp-server/) | ✅ `strict: true` |
| Preload (.cjs) | CommonJS (zorunlu) |

### Kontrol Komutları
```bash
npm run lint          # ESLint + TypeScript
npm run check-types   # tsc --noEmit
npm run check         # lint + check-types
```

### Yeni IPC Metodu Ekleme
`src/js/global.d.ts`'i güncelle:
```typescript
interface Window {
  electronAPI?: {
    myNewMethod: (param: string) => Promise<{ success: boolean }>;
  };
}
```

---

## 🚀 Common Tasks

> **Detaylı rehber:** `.rovodev/testing.md`

### Temel Komutlar
```bash
npm start              # Uygulamayı başlat
npm run lint           # Kod kontrolü
npm run pre-commit     # Commit öncesi kontrol
```

### Yeni Session Başlangıcı
```bash
cat .rovodev/context.md   # Context dosyasını oku
npm run bootstrap         # Session context oluştur
```

---

## 🎯 CDP & MCP Tools

> **Detaylı rehber:** `.rovodev/cdp.md`

CDP (Chrome DevTools Protocol) ile Electron uygulamasını canlı kontrol edebilirsin:
```bash
check_electron_connection          # Bağlantı kontrolü
click_element_by_selector          # Element tıklama
take_cdp_screenshot                # Screenshot
```

MCP Server: 18 tool (test, log, CDP araçları)

---

## 📁 Important Files

| Dosya | Açıklama |
|-------|----------|
| `electron/main.ts` | Ana process, IPC handlers |
| `electron/preload.cjs` | contextBridge API |
| `src/js/modules/core-engine.ts` | Renderer koordinatör |
| `mcp-server/index.ts` | MCP protocol server |

---

## 🔒 Security

- ✅ `contextIsolation: true`
- ✅ `nodeIntegration: false`
- ✅ `sandbox: true`
- IPC kanalları main process'te validate edilir

---

## 🛠️ Troubleshooting

| Sorun | Çözüm |
|-------|-------|
| Electron başlamıyor | `rm -rf node_modules && npm install` |
| CDP bağlantı yok | `npm start` ile uygulama çalışıyor mu? |
| IPC çalışmıyor | preload.cjs ve main.ts channel isimlerini kontrol et |

> Detaylı troubleshooting: `.rovodev/testing.md`

---

## 🔗 Quick Links

- `.rovodev/context.md` - **YENİ SESSION İÇİN ÖNCE BUNU OKU**
- `.rovodev/architecture.md` - Mimari detayları
- `.rovodev/concepts.md` - Key concepts detayları
- `.rovodev/cdp.md` - CDP tool'ları
- `.rovodev/logging.md` - Log sistemi
- `.rovodev/testing.md` - Test workflow'ları

---

**Last Updated:** 2026-01-17  
**Version:** 5.4.0

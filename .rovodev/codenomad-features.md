# CodeNomad Fonksiyonellik Referansı

> **Amaç:** Hayalet-ev entegrasyonu için CodeNomad özelliklerinin AI asistan referansı
> **Kaynak Proje:** `/home/raistlin/CodeNomad-0.9.0`
> **Son Güncelleme:** 2026-01-25

---

## 📋 İçindekiler

1. [Platform & Paket Yapısı](#platform--paket-yapısı)
2. [Instance Yönetimi](#1-instance-yönetimi)
3. [Session Yönetimi](#2-session-yönetimi)
4. [Mesaj Görüntüleme](#3-mesaj-görüntüleme)
5. [Tool Call Rendering](#4-tool-call-rendering)
6. [Prompt Input](#5-prompt-input)
7. [Dosya Ekleri](#6-dosya-ekleri-attachments)
8. [Agent & Model Seçimi](#7-agent--model-seçimi)
9. [Command Palette](#8-command-palette)
10. [Keyboard Shortcuts](#9-keyboard-shortcuts)
11. [Logs Görünümü](#10-logs-görünümü)
12. [Permission & Question Handling](#11-permission--question-handling)
13. [SSE Event Handling](#12-sse-event-handling)
14. [Server API](#13-server-api)
15. [Tema & Styling](#14-tema--styling)

---

## Platform & Paket Yapısı

### Monorepo Yapısı

| Paket | Konum | Açıklama |
|-------|-------|----------|
| **UI** | `packages/ui/` | SolidJS frontend (Vite + TailwindCSS) |
| **Server** | `packages/server/` | HTTP API, workspace yönetimi, auth |
| **Electron** | `packages/electron-app/` | Native shell (IPC, process mgmt) |
| **Tauri** | `packages/tauri-app/` | Rust tabanlı native shell |
| **Config** | `packages/opencode-config/` | OpenCode plugin konfigürasyonu |
| **Cloudflare** | `packages/cloudflare/` | UI CDN dağıtımı |

---

## 1. Instance Yönetimi

> Birden fazla OpenCode workspace'i aynı anda yönetme

### Özellikler
- ✅ Multi-instance desteği (her biri ayrı klasör/workspace)
- ✅ Instance tab'ları (horizontal tabs - Level 1)
- ✅ Instance durumu: `starting`, `ready`, `error`, `stopped`
- ✅ Instance kapatma/durdurma
- ✅ Yeni instance oluşturma (`Cmd/Ctrl+N`)
- ✅ Bağlantı kopması modal uyarısı

### İlişkili Dosyalar

**UI (SolidJS):**
```
packages/ui/src/
├── stores/
│   └── instances.ts              # Instance state management
├── components/
│   ├── instance-tabs.tsx         # Tab bar component
│   ├── instance-tab.tsx          # Tek tab component
│   ├── instance-info.tsx         # Instance bilgi paneli
│   ├── instance-welcome-view.tsx # Hoşgeldin ekranı
│   ├── instance-disconnected-modal.tsx  # Bağlantı kopması
│   └── instance-service-status.tsx      # Servis durumu
├── types/
│   └── instance.ts               # Instance type tanımları
```

**Server:**
```
packages/server/src/
├── workspaces/
│   ├── manager.ts                # Workspace lifecycle
│   ├── runtime.ts                # OpenCode process spawning
│   └── instance-events.ts        # Instance event handling
├── storage/
│   └── instance-store.ts         # Instance persistence
├── server/routes/
│   └── workspaces.ts             # /workspaces API endpoints
```

**Electron:**
```
packages/electron-app/electron/main/
├── process-manager.ts            # OpenCode process lifecycle
├── ipc.ts                        # Instance IPC handlers
└── storage.ts                    # Electron storage
```

### API Endpoints
```
POST   /workspaces           # Yeni workspace oluştur
GET    /workspaces           # Workspace listesi
DELETE /workspaces/:id       # Workspace sil
GET    /workspaces/:id/status # Workspace durumu
```

---

## 2. Session Yönetimi

> Instance içinde birden fazla chat session'ı

### Özellikler
- ✅ Instance başına çoklu session (Level 2 tabs)
- ✅ Session oluşturma (`Cmd/Ctrl+T`)
- ✅ Session silme
- ✅ Session yeniden adlandırma
- ✅ Session picker modal (startup)
- ✅ Parent-child session ilişkileri (thread view)
- ✅ Session fork etme
- ✅ Session durumu: `idle`, `streaming`, `error`

### İlişkili Dosyalar

**UI (SolidJS):**
```
packages/ui/src/
├── stores/
│   ├── sessions.ts               # Session listesi state
│   ├── session-state.ts          # Aktif session state
│   ├── session-api.ts            # Session API çağrıları
│   ├── session-actions.ts        # Session CRUD actions
│   ├── session-events.ts         # Session event handlers
│   ├── session-status.ts         # Session status tracking
│   ├── session-models.ts         # Session model yönetimi
│   └── session-compaction.ts     # Session sıkıştırma
├── components/
│   ├── session-list.tsx          # Session sidebar listesi
│   ├── session-picker.tsx        # Session seçim modal
│   ├── session-rename-dialog.tsx # Yeniden adlandırma dialog
│   └── session/
│       ├── session-view.tsx      # Session ana view
│       └── context-usage-panel.tsx # Context kullanım paneli
├── types/
│   └── session.ts                # Session type tanımları
```

**Server:**
```
packages/server/src/
├── server/routes/
│   └── workspaces.ts             # Session proxy endpoints
```

### Session State Machine
```typescript
type SessionStatus = 'idle' | 'streaming' | 'error' | 'pending';
```

---

## 3. Mesaj Görüntüleme

> Chat mesajlarının render edilmesi ve yönetimi

### Özellikler
- ✅ User/Assistant mesaj ayrımı
- ✅ Markdown rendering (Shiki syntax highlighting)
- ✅ Kod blokları (syntax highlighting)
- ✅ Mesaj streaming (SSE üzerinden)
- ✅ Auto-scroll (yeni mesajlarda)
- ✅ Mesaj timeline görünümü
- ✅ Mesaj preview
- ✅ ANSI renk desteği

### İlişkili Dosyalar

**UI (SolidJS):**
```
packages/ui/src/
├── stores/
│   ├── message-history.ts        # Mesaj geçmişi
│   └── message-v2/               # V2 mesaj sistemi
│       ├── types.ts              # Mesaj tipleri
│       ├── normalizers.ts        # Mesaj normalizasyonu
│       ├── instance-store.ts     # Instance mesaj store
│       ├── session-info.ts       # Session info
│       ├── bridge.ts             # Store bridge
│       ├── bus.ts                # Event bus
│       └── record-display-cache.ts # Display cache
├── components/
│   ├── message-list-header.tsx   # Mesaj listesi başlık
│   ├── message-block-list.tsx    # Mesaj blok listesi
│   ├── message-block.tsx         # Tek mesaj bloğu
│   ├── message-item.tsx          # Mesaj item
│   ├── message-part.tsx          # Mesaj parçası
│   ├── message-section.tsx       # Mesaj section
│   ├── message-timeline.tsx      # Timeline görünümü
│   ├── message-preview.tsx       # Preview component
│   └── markdown.tsx              # Markdown renderer
├── lib/
│   ├── markdown.ts               # Markdown utilities
│   ├── ansi.ts                   # ANSI parser
│   └── formatters.ts             # Mesaj formatlayıcılar
├── types/
│   └── message.ts                # Message type tanımları
```

**Stiller:**
```
packages/ui/src/styles/
├── messaging/
│   ├── message-base.css          # Temel mesaj stilleri
│   ├── message-block-list.css    # Blok listesi stilleri
│   ├── message-section.css       # Section stilleri
│   └── message-timeline.css      # Timeline stilleri
├── markdown.css                  # Markdown stilleri
```

### Mesaj Tipi
```typescript
interface Message {
  id: string;
  role: 'user' | 'assistant';
  parts: MessagePart[];
  createdAt: number;
  metadata?: {
    model?: string;
    tokens?: number;
  };
}

interface MessagePart {
  type: 'text' | 'tool_use' | 'tool_result';
  content: string | ToolCall;
}
```

---

## 4. Tool Call Rendering

> AI tool çağrılarının görselleştirilmesi

### Özellikler
- ✅ Collapse/expand tool çağrıları
- ✅ Tool durumu: `pending`, `running`, `success`, `error`
- ✅ Özel renderer'lar (bash, edit, write, read, patch, task, todo, webfetch, question)
- ✅ Diff viewer (inline diff)
- ✅ Diagnostics section
- ✅ Permission block

### İlişkili Dosyalar

**UI (SolidJS):**
```
packages/ui/src/
├── stores/
│   └── tool-call-state.ts        # Tool call state yönetimi
├── components/
│   ├── tool-call.tsx             # Ana tool call component
│   ├── diff-viewer.tsx           # Diff görüntüleyici
│   └── tool-call/
│       ├── types.ts              # Tool call tipleri
│       ├── utils.ts              # Utility fonksiyonları
│       ├── tool-title.ts         # Tool başlık oluşturma
│       ├── ansi-render.tsx       # ANSI output render
│       ├── diff-render.tsx       # Diff render
│       ├── markdown-render.tsx   # MD render
│       ├── diagnostics.ts        # Diagnostics logic
│       ├── diagnostics-section.tsx # Diagnostics UI
│       ├── permission-block.tsx  # İzin bloğu
│       ├── question-block.tsx    # Soru bloğu
│       └── renderers/            # Tool-specific renderers
│           ├── index.ts          # Renderer registry
│           ├── bash.tsx          # Bash/shell commands
│           ├── edit.tsx          # Dosya düzenleme
│           ├── write.tsx         # Dosya yazma
│           ├── read.tsx          # Dosya okuma
│           ├── patch.tsx         # Patch uygulama
│           ├── apply-patch.tsx   # Apply patch
│           ├── task.tsx          # Alt görev
│           ├── todo.tsx          # Todo listesi
│           ├── webfetch.tsx      # Web fetch
│           ├── question.tsx      # Kullanıcı sorusu
│           ├── default.tsx       # Default renderer
│           └── invalid.tsx       # Geçersiz tool
├── lib/
│   └── diff-utils.ts             # Diff utilities
```

**Stiller:**
```
packages/ui/src/styles/
├── messaging/
│   ├── tool-call.css             # Tool call stilleri
│   └── tool-call/
│       ├── task.css              # Task stilleri
│       └── todo.css              # Todo stilleri
```

### Tool Call Tipi
```typescript
interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  state: 'pending' | 'running' | 'success' | 'error';
  output?: string;
  error?: string;
  duration?: number;
}
```

---

## 5. Prompt Input

> Kullanıcı mesaj girişi

### Özellikler
- ✅ Multi-line textarea (auto-expanding)
- ✅ Mesaj gönderme (`Cmd/Ctrl+Enter`)
- ✅ Mesaj geçmişi navigasyonu (Up/Down)
- ✅ Draft prompt kaydetme
- ✅ Long paste handling
- ✅ Placeholder desteği

### İlişkili Dosyalar

**UI (SolidJS):**
```
packages/ui/src/
├── components/
│   └── prompt-input.tsx          # Ana prompt component
├── lib/
│   └── prompt-placeholders.ts    # Placeholder yönetimi
```

**Stiller:**
```
packages/ui/src/styles/
└── messaging/
    └── prompt-input.css          # Prompt stilleri
```

---

## 6. Dosya Ekleri (Attachments)

> Mesajlara dosya ekleme

### Özellikler
- ✅ `@` ile dosya mention
- ✅ Drag & drop dosya ekleme
- ✅ Clipboard'dan resim yapıştırma
- ✅ Attachment chip görünümü
- ✅ Agent attachments
- ✅ Filesystem browser dialog
- ✅ Directory browser dialog

### İlişkili Dosyalar

**UI (SolidJS):**
```
packages/ui/src/
├── stores/
│   └── attachments.ts            # Attachment state
├── components/
│   ├── attachment-chip.tsx       # Attachment chip UI
│   ├── filesystem-browser-dialog.tsx  # Dosya seçici
│   └── directory-browser-dialog.tsx   # Klasör seçici
├── types/
│   └── attachment.ts             # Attachment tipleri
├── lib/
│   └── clipboard.ts              # Clipboard utilities
```

**Stiller:**
```
packages/ui/src/styles/
└── components/
    └── directory-browser.css     # Browser stilleri
```

---

## 7. Agent & Model Seçimi

> AI agent ve model konfigürasyonu

### Özellikler
- ✅ Agent selector dropdown
- ✅ Model selector dropdown
- ✅ Provider bazlı model gruplandırma
- ✅ Session bazında agent/model değiştirme
- ✅ Default model belirleme

### İlişkili Dosyalar

**UI (SolidJS):**
```
packages/ui/src/
├── components/
│   ├── agent-selector.tsx        # Agent seçici
│   ├── model-selector.tsx        # Model seçici
│   └── unified-picker.tsx        # Birleşik picker
├── stores/
│   └── session-models.ts         # Model state
├── lib/shortcuts/
│   └── agent.ts                  # Agent kısayolları
```

**Stiller:**
```
packages/ui/src/styles/
└── components/
    └── selector.css              # Selector stilleri
```

---

## 8. Command Palette

> Global komut arama ve çalıştırma

### Özellikler
- ✅ Global command palette (`Cmd/Ctrl+K`)
- ✅ Komut arama (fuzzy search)
- ✅ Klavye kısayolları gösterimi
- ✅ Kategori bazlı komutlar

### İlişkili Dosyalar

**UI (SolidJS):**
```
packages/ui/src/
├── stores/
│   ├── commands.ts               # Komut registry
│   └── command-palette.ts        # Palette state
├── components/
│   └── command-palette.tsx       # Palette component
├── lib/
│   ├── commands.ts               # Komut tanımları
│   └── command-utils.ts          # Komut utilities
```

---

## 9. Keyboard Shortcuts

> Klavye kısayolları sistemi

### Özellikler
- ✅ `Cmd/Ctrl+N` - Yeni instance
- ✅ `Cmd/Ctrl+T` - Yeni session
- ✅ `Cmd/Ctrl+K` - Command palette
- ✅ `Cmd/Ctrl+Enter` - Mesaj gönder
- ✅ `Escape` - Modal kapat
- ✅ `Cmd/Ctrl+L` - Input focus

### İlişkili Dosyalar

**UI (SolidJS):**
```
packages/ui/src/
├── lib/
│   ├── keyboard.ts               # Ana keyboard handler
│   ├── keyboard-registry.ts      # Kısayol registry
│   └── keyboard-utils.ts         # Keyboard utilities
├── lib/shortcuts/
│   ├── agent.ts                  # Agent kısayolları
│   ├── escape.ts                 # Escape handling
│   ├── input.ts                  # Input kısayolları
│   └── navigation.ts             # Navigation kısayolları
├── components/
│   ├── kbd.tsx                   # Keyboard hint component
│   └── keyboard-hint.tsx         # Hint görünümü
```

---

## 10. Logs Görünümü

> Instance ve server log'larının görüntülenmesi

### Özellikler
- ✅ Instance başına log tab
- ✅ Server stdout/stderr görüntüleme
- ✅ Log filtreleme
- ✅ ANSI renk desteği

### İlişkili Dosyalar

**UI (SolidJS):**
```
packages/ui/src/
├── components/
│   └── logs-view.tsx             # Log görüntüleyici
├── lib/
│   ├── logger.ts                 # Client-side logger
│   └── ansi.ts                   # ANSI parser
```

**Stiller:**
```
packages/ui/src/styles/
└── messaging/
    └── log-view.css              # Log stilleri
```

---

## 11. Permission & Question Handling

> İzin istekleri ve interaktif sorular

### Özellikler
- ✅ Permission approval modal
- ✅ Permission notification banner
- ✅ Interactive question block
- ✅ Question answering UI

### İlişkili Dosyalar

**UI (SolidJS):**
```
packages/ui/src/
├── components/
│   ├── permission-approval-modal.tsx     # İzin modal
│   └── permission-notification-banner.tsx # İzin banner
├── types/
│   ├── permission.ts             # Permission tipleri
│   └── question.ts               # Question tipleri
```

**Stiller:**
```
packages/ui/src/styles/
└── components/
    └── permission-notification.css
```

---

## 12. SSE Event Handling

> Server-Sent Events ile real-time iletişim

### Event Tipleri

| Event | Açıklama | Handler |
|-------|----------|---------|
| `message.update` | Mesaj güncelleme | `session-events.ts` |
| `message.part.updated` | Mesaj parçası güncelleme | `session-events.ts` |
| `message.removed` | Mesaj silme | `session-events.ts` |
| `session.update` | Session güncelleme | `session-events.ts` |
| `session.compacted` | Session compact | `session-compaction.ts` |
| `session.error` | Session hatası | `session-status.ts` |
| `session.idle` | Session idle | `session-status.ts` |
| `permission.updated` | İzin güncelleme | `session-events.ts` |
| `question.asked` | Soru soruldu | `session-events.ts` |
| `tui.toast` | Toast notification | `notifications.tsx` |

### İlişkili Dosyalar

**UI (SolidJS):**
```
packages/ui/src/
├── lib/
│   ├── sse-manager.ts            # SSE bağlantı yönetimi
│   ├── server-events.ts          # Event handlers
│   └── sdk-manager.ts            # OpenCode SDK wrapper
├── stores/
│   ├── session-events.ts         # Session event handlers
│   └── message-v2/
│       └── bus.ts                # Event bus
```

**Server:**
```
packages/server/src/
├── events/
│   └── bus.ts                    # Event bus
├── server/routes/
│   └── events.ts                 # SSE endpoint
```

---

## 13. Server API

> HTTP API endpoints

### İlişkili Dosyalar

**Server:**
```
packages/server/src/
├── index.ts                      # Ana export
├── bin.ts                        # CLI entry point
├── launcher.ts                   # Server launcher
├── api-types.ts                  # API type tanımları
├── server/
│   ├── http-server.ts            # HTTP server
│   └── routes/
│       ├── auth.ts               # Auth endpoints
│       ├── config.ts             # Config endpoints
│       ├── events.ts             # SSE endpoints
│       ├── filesystem.ts         # Filesystem endpoints
│       ├── meta.ts               # Meta endpoints
│       ├── plugin.ts             # Plugin endpoints
│       ├── storage.ts            # Storage endpoints
│       ├── workspaces.ts         # Workspace endpoints
│       └── background-processes.ts
├── auth/
│   ├── manager.ts                # Auth manager
│   ├── auth-store.ts             # Auth storage
│   ├── http-auth.ts              # HTTP auth middleware
│   ├── token-manager.ts          # Token yönetimi
│   ├── session-manager.ts        # Session yönetimi
│   └── password-hash.ts          # Password hashing
├── config/
│   ├── store.ts                  # Config store
│   ├── schema.ts                 # Config schema
│   └── binaries.ts               # Binary paths
├── filesystem/
│   ├── browser.ts                # Filesystem browser
│   ├── search.ts                 # File search
│   └── search-cache.ts           # Search cache
```

**UI API Client:**
```
packages/ui/src/lib/
├── api-client.ts                 # HTTP API client
├── opencode-api.ts               # OpenCode specific API
└── server-meta.ts                # Server metadata
```

---

## 14. Tema & Styling

> Görsel tema ve stil sistemi

### Özellikler
- ✅ Dark/Light mode desteği
- ✅ TailwindCSS v3 token sistemi
- ✅ CSS variables ile theming
- ✅ Typography baseline
- ✅ Responsive layout

### İlişkili Dosyalar

**UI (SolidJS):**
```
packages/ui/src/
├── lib/
│   └── theme.tsx                 # Theme provider
├── index.css                     # Global stiller
├── styles/
│   ├── tokens.css                # CSS token'lar
│   ├── utilities.css             # Utility sınıflar
│   ├── controls.css              # Form kontrolleri
│   ├── markdown.css              # Markdown stilleri
│   ├── messaging.css             # Mesajlaşma stilleri
│   ├── panels.css                # Panel stilleri
│   ├── components/               # Bileşen stilleri
│   │   ├── badges.css
│   │   ├── buttons.css
│   │   ├── dropdown.css
│   │   ├── env-vars.css
│   │   ├── folder-loading.css
│   │   ├── remote-access.css
│   │   └── selector.css
│   ├── messaging/                # Mesaj stilleri
│   │   ├── log-view.css
│   │   ├── message-base.css
│   │   ├── message-block-list.css
│   │   ├── message-section.css
│   │   ├── message-timeline.css
│   │   ├── prompt-input.css
│   │   └── tool-call.css
│   └── panels/                   # Panel stilleri
│       ├── empty-loading.css
│       ├── modal.css
│       ├── panel-shell.css
│       ├── session-layout.css
│       └── tabs.css
├── tailwind.config.js            # Tailwind config
└── postcss.config.js             # PostCSS config
```

---

## 🔗 Entegrasyon Notları

### Hayalet-ev'de Mevcut Durum
- `src/opencode-ui/` - Vanilla JS implementasyonu (basit)
- `electron/opencode-manager.ts` - OpenCode process yönetimi

### CodeNomad'dan Alınabilecek Özellikler

| Özellik | Öncelik | Karmaşıklık | Notlar |
|---------|---------|-------------|--------|
| Tool Call Renderers | Yüksek | Orta | Mevcut UI'da eksik |
| Permission Modal | Yüksek | Düşük | Kritik UX |
| Session Fork | Orta | Orta | Thread desteği için |
| Command Palette | Orta | Orta | Keyboard-first UX |
| Diff Viewer | Yüksek | Orta | Edit tool için |
| Attachment System | Orta | Yüksek | `@` mention sistemi |
| Agent Selector | Düşük | Düşük | Mevcut UI'da var |

### Dosya Eşleştirme (CodeNomad → Hayalet-ev)

| CodeNomad | Hayalet-ev |
|-----------|------------|
| `packages/ui/src/stores/sessions.ts` | `src/opencode-ui/js/stores/session-store.js` |
| `packages/ui/src/stores/instances.ts` | `src/opencode-ui/js/stores/instance-store.js` |
| `packages/ui/src/lib/sse-manager.ts` | `src/opencode-ui/js/sse-client.js` |
| `packages/ui/src/components/tool-call.tsx` | `src/opencode-ui/js/tool-renderer.js` |
| `packages/ui/src/components/prompt-input.tsx` | `src/opencode-ui/js/prompt-handler.js` |
| `packages/server/src/workspaces/runtime.ts` | `electron/opencode-manager.ts` |

---

## 📚 Kaynak Dosyalar

Bu dokümandaki tüm dosya referansları `/home/raistlin/CodeNomad-0.9.0` projesine aittir.

Detaylı implementasyon için:
- `README.md` - Proje özeti
- `dev-docs/architecture.md` - Mimari detayları
- `dev-docs/technical-implementation.md` - Teknik detaylar
- `tasks/done/` - Tamamlanan görev dokümantasyonu

---

**Son Güncelleme:** 2026-01-25

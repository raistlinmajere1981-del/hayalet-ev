# 📊 Hayalet-ev Dosya Refactoring Analizi

**Tarih:** 2026-01-27  
**Analiz Scope:** TypeScript/JavaScript dosyalar (node_modules, dist hariç)  
**Amaç:** 1000+ satırlık dosyaları modüler yapıya uygun şekilde bölmek

---

## 🎯 Refactoring Kriterleri

| Kriter | Değer |
|--------|-------|
| **Maksimal dosya boyutu** | 600-700 satır (AI asistanlar için optimal) |
| **Bölme stratejisi** | Fonksiyonel/mantıksal ayrımlar |
| **İçerik kaybı** | ❌ Yoktur - kayıpsız kopyalama |
| **Import yapısı** | Barrel export'lar (index.ts) ile modülarize |
| **Mevcut yapı** | Korunur ve genişletilir |

---

## 📈 Genel Istatistikler

| Kategori | Sayı |
|----------|------|
| **1000+ satırlık dosyalar** | 9 dosya |
| **700-1000 satır dosyalar** | 12 dosya |
| **600-700 satır dosyalar** | 6 dosya |
| **asistan/ui klasörü toplam** | 7,211 satır |
| **mcp-server/tools toplam** | 5,953 satır |

---

## 🔴 YÜKSEK PRİYORİTE - Bölünmesi Zorunlu

### 1️⃣ `src/js/pages/asistan-native/app.ts` (3,079 satır)

**Sorun:** Monolitik OpenCode app koordinatörü  
**Kullanıcı:** Direkt bootstrap  
**Bölme Stratejisi:**

```
asistan-native/
├── app.ts (ana entry point, koordinasyon)
├── lifecycle/
│   ├── init-handler.ts (init, parseUrlParams, checkWorkspace)
│   ├── event-handler.ts (SSE event dinleyici)
│   └── cleanup-handler.ts (cleanup, stopListening)
├── session/
│   ├── session-manager.ts (session yönetimi)
│   └── session-state.ts (session state tracking)
├── handlers/
│   ├── permission-handler.ts (izin istekleri)
│   ├── question-handler.ts (soru sistemi)
│   └── status-handler.ts (status panel updates)
└── ui/ (app.ts'ye geçiş öncesi oluşturulacak)
    ├── message-updates.ts (message updating logic)
    └── ui-helpers.ts (DOM manipulation)
```

**Tahmini Boyutlar:**
- app.ts: 300-350 satır (koordinasyon)
- event-handler.ts: 400-450 satır
- session-manager.ts: 300-350 satır
- handlers/*: 200-250 satır x3

---

### 2️⃣ `src/js/modules/asistan/ui/message-renderer.ts` (1,579 satır)

**Sorun:** Mesaj rendering + markdown + syntax highlight  
**Kullanıcı:** asistan-native/index.ts, analyze.ts  
**Bölme Stratejisi:**

```
asistan/ui/
├── message-renderer.ts (main renderer, koordinasyon)
├── formatters/
│   ├── markdown-parser.ts (markdown → HTML)
│   ├── syntax-highlighter.ts (code highlighting)
│   └── message-formatter.ts (mesaj formatting)
├── rendering/
│   ├── part-renderer.ts (message part rendering)
│   ├── tool-renderer.ts (tool call rendering - bkz #4)
│   └── thinking-renderer.ts (thinking block rendering)
└── cache/
    └── revision-cache.ts (revision tracking)
```

**Tahmini Boyutlar:**
- message-renderer.ts: 250-300 satır (main logic)
- markdown-parser.ts: 300-350 satır
- syntax-highlighter.ts: 250-300 satır
- part-renderer.ts: 200-250 satır
- tool-renderer.ts: ✅ Ayrı dosya (1,368 satır - #4 görmek)

---

### 3️⃣ `electron/opencode-sse-server.ts` (1,863 satır)

**Sorun:** SSE server + REST API + Event bus  
**Kullanıcı:** electron/main.ts, opencode-manager.ts  
**Bölme Stratejisi:**

```
electron/opencode-sse-server/
├── index.ts (main server class)
├── event-bus.ts (OpenCodeEventBus class)
├── client-manager.ts (SSE client connection handling)
├── endpoints/
│   ├── events-endpoint.ts (/api/events)
│   ├── sessions-endpoint.ts (/api/sessions)
│   ├── send-endpoint.ts (/api/send)
│   └── approval-endpoint.ts (/api/approve, /deny)
├── types.ts (SSEEvent, SSEClient, SSEServerConfig)
└── middleware/
    ├── cors-handler.ts (CORS middleware)
    └── heartbeat-handler.ts (heartbeat + keep-alive)
```

**Tahmini Boyutlar:**
- index.ts: 300-350 satır
- event-bus.ts: 200-250 satır
- client-manager.ts: 250-300 satır
- endpoints/*: 150-200 satır x4
- middleware/*: 100-150 satır x2

---

### 4️⃣ `src/js/modules/asistan/ui/tool-renderer.ts` (1,368 satır)

**Sorun:** Tool call rendering + visualization  
**Kullanıcı:** message-renderer.ts  
**Bölme Stratejisi:**

```
asistan/ui/
├── tool-renderer.ts (main coordinator)
├── tool-parts/
│   ├── tool-header.ts (tool başlığı, status)
│   ├── tool-input.ts (input visualization)
│   ├── tool-output.ts (output formatting)
│   └── tool-error.ts (error handling/display)
├── tool-types/
│   ├── code-tool-renderer.ts (code execution tools)
│   ├── search-tool-renderer.ts (arama tools)
│   └── custom-tool-renderer.ts (custom tools)
└── tool-state.ts (tool call state management)
```

**Tahmini Boyutlar:**
- tool-renderer.ts: 250-300 satır
- tool-header.ts: 150-200 satır
- tool-input.ts: 200-250 satır
- tool-output.ts: 300-350 satır
- tool-error.ts: 100-150 satır
- tool-types/*: 150-200 satır x3

---

### 5️⃣ `src/js/modules/asistan/ui/prompt-handler.ts` (1,360 satır)

**Sorun:** Prompt management + token counting + streaming  
**Kullanıcı:** asistan-native/app.ts  
**Bölme Stratejisi:**

```
asistan/prompt/
├── prompt-handler.ts (main handler)
├── token-counter.ts (token counting logic)
├── prompt-builder.ts (prompt construction)
├── streaming/
│   ├── streaming-handler.ts (streaming coordination)
│   └── token-tracker.ts (token tracking)
├── validation/
│   ├── prompt-validator.ts (prompt validation)
│   └── constraint-checker.ts (token limits vb)
└── types.ts (PromptContext, TokenInfo vb)
```

**Tahmini Boyutlar:**
- prompt-handler.ts: 250-300 satır
- token-counter.ts: 250-300 satır
- prompt-builder.ts: 200-250 satır
- streaming-handler.ts: 200-250 satır
- validation/*: 150-200 satır x2

---

### 6️⃣ `electron/opencode-manager.ts` (1,607 satır)

**Sorun:** OpenCode process yönetimi + API client  
**Kullanıcı:** electron/main.ts, opencode-sse-server.ts  
**Bölme Stratejisi:**

```
electron/opencode/
├── opencode-manager.ts (main manager class)
├── process/
│   ├── process-spawner.ts (spawn/spawn logic)
│   ├── process-monitor.ts (health check, port monitoring)
│   └── graceful-shutdown.ts (shutdown coordination)
├── api/
│   ├── api-client.ts (HTTP client for OpenCode API)
│   ├── session-api.ts (session endpoints)
│   └── command-api.ts (command execution API)
├── config/
│   └── timeout-config.ts (startup, shutdown, api timeouts)
├── state/
│   └── process-state.ts (ProcessState interface + state machine)
└── utils/
    └── id-generator.ts (ID generation - createId, randomBase62)
```

**Tahmini Boyutlar:**
- opencode-manager.ts: 250-300 satır
- process-spawner.ts: 200-250 satır
- api-client.ts: 300-350 satır
- session-api.ts: 200-250 satır
- process-monitor.ts: 150-200 satır
- graceful-shutdown.ts: 150-200 satır
- id-generator.ts: 100-150 satır

---

### 7️⃣ `src/js/modules/asistan/stores/message-store.ts` (883 satır)

**Sorun:** Mesaj state management (işlemler + filtreleme)  
**Kullanıcı:** store-bridge.ts, message-renderer.ts  
**Bölme Stratejisi:**

```
asistan/stores/
├── message-store.ts (main store)
├── message/
│   ├── message-operations.ts (add, update, delete, clear)
│   ├── message-filtering.ts (getMessages filters, sorting)
│   └── message-search.ts (search functionality)
├── state/
│   ├── message-state.ts (MessageState interface)
│   └── state-mutations.ts (state update logic)
└── subscriptions/
    └── message-subscriptions.ts (subscriber management)
```

**Tahmini Boyutlar:**
- message-store.ts: 200-250 satır
- message-operations.ts: 200-250 satır
- message-filtering.ts: 150-200 satır
- message-search.ts: 100-150 satır
- state-mutations.ts: 100-150 satır

---

### 8️⃣ `src/js/modules/asistan/stores/store-bridge.ts` (1,098 satır)

**Sorun:** Tüm store'ları koordine eden merkezi hub  
**Kullanıcı:** message-renderer.ts, app.ts, prompt-handler.ts  
**Bölme Stratejisi:**

```
asistan/stores/
├── store-bridge.ts (main coordinator)
├── bridge/
│   ├── message-bridge.ts (message store methods)
│   ├── session-bridge.ts (session store methods)
│   ├── instance-bridge.ts (instance store methods)
│   └── selection-bridge.ts (selection store methods)
├── subscriptions/
│   ├── subscription-manager.ts (subscribe/unsubscribe logic)
│   └── event-dispatcher.ts (event routing)
└── cache/
    └── selection-cache.ts (selection caching)
```

**Tahmini Boyutlar:**
- store-bridge.ts: 200-250 satır
- message-bridge.ts: 200-250 satır
- session-bridge.ts: 150-200 satır
- subscription-manager.ts: 150-200 satır
- event-dispatcher.ts: 100-150 satır

---

### 9️⃣ `mcp-server/index.ts` (1,007 satır)

**Sorun:** MCP server orchestrator + tüm tool'ları export eder  
**Kullanıcı:** MCP client (Claude, etc.)  
**Bölme Stratejisi:**

```
mcp-server/
├── index.ts (main server, tool registration)
├── tool-registry/
│   ├── electron-registry.ts (electron tools)
│   ├── log-registry.ts (log tools)
│   ├── debug-registry.ts (debug tools)
│   ├── cdp-registry.ts (CDP tools)
│   ├── filesystem-registry.ts (FS tools)
│   ├── dev-registry.ts (dev tools)
│   ├── web-registry.ts (web tools)
│   └── workflow-registry.ts (workflow tools)
└── orchestration/
    ├── server-lifecycle.ts (init, shutdown)
    └── tool-handler.ts (CallToolRequest handling)
```

**Tahmini Boyutlar:**
- index.ts: 200-250 satır
- tool-registry/*.ts: 50-100 satır x8
- server-lifecycle.ts: 100-150 satır

---

## 🟡 ORTA PRİYORİTE - İyileştirme Önerileri

| Dosya | Satır | Sorun | Önerisi |
|-------|-------|-------|---------|
| `src/js/modules/asistan/ui/agent-model-selector.ts` | 869 | Model selector UI + state | Bölme önerilir (500+ satır) |
| `src/js/pages/archives.ts` | 778 | Archive page (filtering, UI) | Bölme önerilir |
| `mcp-server/tools/filesystem-tools.ts` | 1,140 | 20+ FS işlemi | ✅ Zaten bölünmüş (`safe-chunk-tools.ts`) |
| `mcp-server/tools/dev-tools.ts` | 968 | 9 dev tool | Devam et (iyi organize) |
| `mcp-server/tools/web-tools.ts` | 599 | Web search/fetch | İyi boyut |

---

## 🟢 İYİ DURUMDA - Değişiklik Gerekmez

| Dosya | Satır | Durum |
|-------|-------|-------|
| `src/js/modules/core-engine.ts` | 685 | ✅ İyi organize (modüler) |
| `src/js/modules/slot-controller.ts` | 669 | ✅ Fonksiyonel |
| `src/js/modules/log-manager.ts` | 653 | ✅ Log utilities |
| `src/js/app.ts` | 639 | ✅ Entry point |
| `mcp-server/tools/safe-chunk-tools.ts` | 639 | ✅ Iyi tasarlanmış |

---

## 📋 Refactoring Checklist

### Phase 1: Hazırlık (✅ Tamamlandı)
- [x] Dosyaları boyuta göre sırala
- [x] Bölme noktalarını belirle
- [x] Import bağımlılıklarını analiz et

### Phase 2: Uygulama (🔄 Planlama Aşamasında)
- [ ] OpenCode bölümünü refactor et (`opencode-sse-server`, `opencode-manager`)
- [ ] Asistan UI'ı modülarize et (`message-renderer`, `tool-renderer`, `prompt-handler`)
- [ ] Store yapısını düzenle (`message-store`, `store-bridge`)
- [ ] MCP server'ı re-organize et (`index.ts`)

### Phase 3: Validasyon
- [ ] Tüm import'ları test et
- [ ] `npm run lint` başarılı?
- [ ] `npm run check-types` başarılı?
- [ ] Barrel export'lar çalışıyor mu?

---

## 🔗 Bağımlılık Matrixi

```
asistan-native/app.ts
├── uses: message-renderer.ts
├── uses: store-bridge.ts
├── uses: prompt-handler.ts
└── uses: opencode-sse-server.ts

message-renderer.ts
├── uses: tool-renderer.ts
└── uses: store-bridge.ts

opencode-sse-server.ts
├── exports SSEEvent, SSEServer
└── used-by: electron/main.ts

mcp-server/index.ts
├── imports: ALL tools
└── exports: MCP tool definitions
```

---

## ✅ Başarı Kriterleri

| Kriter | Kontrol Yöntemi |
|--------|-----------------|
| **Kayıpsız kopyalama** | Dosya boyutlarının toplamı ≈ orijinal |
| **Syntax doğruluğu** | `npm run lint` + `npm run check-types` |
| **Bağımlılık uyumu** | `grep -r import` sonuçları aynı |
| **Modülerlik** | Her dosya 600-750 satır arasında |
| **Backward compat** | Tüm external imports çalışmalı |

---

## 🎯 Sonraki Adım

Başlamak istediğiniz dosya ve detaylı uygulama planı söyleyin. Refactoring'i yapıyım:

1. **Dosya Seçimi:** Hangi dosya(lar)dan başlasak?
2. **Detay Seviyesi:** Kaç parçaya bölelim?
3. **Timeline:** Paralel işlemler vs. sıralı?


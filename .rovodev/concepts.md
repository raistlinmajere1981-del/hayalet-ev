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


## 🎯 CDP-Driven Development & Testing

CDP (Chrome DevTools Protocol) entegrasyonu sayesinde ROVOlar Electron uygulamasını **canlı olarak** kontrol edebilir, test edebilir ve debug yapabilir. Bu bölüm, geliştirme sürecinde CDP tool'larının nasıl kullanılacağını açıklar.

### CDP Mimarisi

```
┌─────────────────────────────────────────────────────────────────┐
│                     ROVO (Rovo)                        │
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
| **Bağlantı** | `hev_check_electron_connection` | Electron çalışıyor mu kontrolü |
| **İnceleme** | `get_electron_window_info`, `get_page_dom_structure`, `inspect_element`, `query_elements` | UI durumunu anlama |
| **Etkileşim** | `hev_click_element_by_selector`, `click_element_by_text`, `fill_input_field`, `send_key_press`, `scroll_page` | UI ile etkileşim |
| **Görüntüleme** | `hev_take_cdp_screenshot` | Görsel doğrulama |
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
├── index.ts                    # Orchestrator, tool tanımları
├── tools/
│   ├── electron-tools.ts       # test_electron, list_plugins
│   ├── log-tools.ts            # read_electron_logs, list_log_sessions, get_session_summary
│   ├── debug-tools.ts          # get_error_hints
│   └── cdp-tools.ts            # CDP tool handlers (12 tool)
└── utils/
    ├── log-utils.ts            # Log okuma utilities
    ├── cdp-connection.ts       # WebSocket bağlantı yönetimi
    └── cdp-commands.ts         # UI otomasyon komutları
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

# Use Rovo to test tools
acli Rovo
# Then: "Hayalet-ev'de logları oku"
```

---


---

### Workflow Tools (Test Otomasyonu)

Test hazırlık süreçlerini otomatize eden predefined workflow'lar:

| Tool | Açıklama |
|------|----------|
| `hev_run_workflow` | Predefined workflow çalıştır |
| `hev_run_steps` | Custom adımlar çalıştır |
| `hev_list_workflows` | Mevcut workflow'ları listele |

**Predefined Workflows:**

| Workflow | Açıklama | Adımlar |
|----------|----------|---------|
| `setup_asistan` | Asistan sayfası + bağlantı | navigate → wait → click → wait |
| `setup_entrance` | Entrance sayfası hazır | navigate → wait |
| `setup_ai1_slot` | AI1 slot bağlantısı | navigate → wait → click → wait |
| `check_app` | Uygulama durumu kontrol | wait → screenshot → assert |

**Kullanım:**
```bash
# Predefined workflow
hev_run_workflow workflow="setup_asistan"

# Custom steps
hev_run_steps steps='[{"action":"navigate","page":"asistan"},{"action":"click","selector":"#btn"}]'
```

**Adım Tipleri:**
- `click` - Element tıkla (selector veya text)
- `fill` - Input doldur
- `wait` - Element veya süre bekle
- `screenshot` - Ekran görüntüsü
- `navigate` - Sayfa geçişi
- `assert` - Koşul doğrula

### Chunk Tools (Büyük Dosya Oluşturma)

LLM response limitlerini aşmak için chunk-based dosya oluşturma araçları:

| Tool | Açıklama |
|------|----------|
| `hev_fs_create_chunked` | Parçaları tek seferde birleştir |
| `hev_fs_append_chunk` | Dosyaya streaming append |

**fs_create_chunked Kullanımı:**
```bash
# Tüm parçaları bir kerede gönder
fs_create_chunked file_path="src/big-file.ts" chunks='["part1...", "part2...", "part3..."]'
```

**fs_append_chunk Kullanımı (Streaming):**
```bash
# Parça parça ekle
fs_append_chunk file_path="src/big-file.ts" content="// Part 1\n..." create_if_missing=true
fs_append_chunk file_path="src/big-file.ts" content="// Part 2\n..."
fs_append_chunk file_path="src/big-file.ts" content="// Part 3\n..."
```

**Ne Zaman Kullanılmalı:**
- Dosya içeriği 50KB'dan büyükse
- create_file tool'u hata veriyorsa
- Uzun kod dosyaları oluştururken

---

### Git PR Tools (GitHub Workflow)

GitHub CLI (gh) entegrasyonu ile PR workflow otomasyonu:

| Tool | Açıklama |
|------|----------|
| `hev_git_fork_setup` | Repo fork et, clone et, branch oluştur |
| `hev_git_create_pr` | Commit et, push et, PR oluştur |
| `hev_git_check_guidelines` | CONTRIBUTING.md, DCO, PR template kontrolü |
| `hev_git_pr_status` | Git durumu ve açık PR'ları göster |

**Gereksinimler:**
- GitHub CLI (`gh`) kurulu olmalı: `brew install gh` veya `apt install gh`
- GitHub'a giriş yapılmış olmalı: `gh auth login`

**Tam PR Workflow Örneği:**
```bash
# 1. Fork ve branch hazırla
hev_git_fork_setup repo="owner/repo" work_dir="~/projects" base_branch="main" feature_branch="fix/bug-123"

# 2. Değişiklik yap (hev_fs_find_and_replace, hev_fs_create_file vb.)

# 3. Guidelines kontrol et
hev_git_check_guidelines cwd="~/projects/repo"

# 4. PR oluştur
hev_git_create_pr base_branch="main" title="Fix: Bug #123" body="Bu PR şunu düzeltiyor..." cwd="~/projects/repo"
```

**Özellikler:**
- ✅ Idempotent - Tekrar çalıştırılabilir
- ✅ DCO sign-off otomatik (-s flag)
- ✅ Mevcut PR kontrolü (duplicate önleme)
- ✅ Shallow clone desteği (hızlı)

---

### Context Tools (Proje Analizi)

Repomix entegrasyonu ile çok seviyeli proje context sistemi:

| Tool | Açıklama |
|------|----------|
| `hev_context_generate` | Belirli seviyede context oluştur |
| `hev_context_status` | Mevcut context durumu |
| `hev_context_module` | Spesifik modül için context |
| `hev_context_read` | Context içeriğini oku |

**Context Seviyeleri:**

| Seviye | Token | Boyut | İçerik |
|--------|-------|-------|--------|
| L1 (Quick) | ~7K | 27KB | AGENTS.md + package.json |
| L2 (Standard) | ~48K | 174KB | Orchestrator'lar + types |
| L3 (Deep) | ~360K | 1.3MB | Tüm src/js + electron |
| L4 (Full) | ~518K | 1.8MB | MCP server dahil |

**Kullanım:**
```bash
# Session başlangıcında status kontrol
hev_context_status

# Normal geliştirme için L2
hev_context_generate level="L2"

# Derin analiz için L3
hev_context_generate level="L3" force=true

# Belirli modül için
hev_context_module module="webview"
hev_context_module module="traffic"

# Context içeriğini oku
hev_context_read level="L2"
```

**Cache Sistemi:**
- 1 saatten yeni context'ler cache'den gelir
- `force=true` ile yeniden oluştur
- Config'ler: `.rovo/context-configs/`
- Çıktılar: `.rovo/context/`

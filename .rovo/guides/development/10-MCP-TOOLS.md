# 🛠️ MCP Tool Ekosistemi

> Hayalet-ev için 77 development tool'un tam referansı

---

## Overview

Hayalet-ev MCP Server, AI agent'lar için özelleştirilmiş 77 development tool sağlar. TypeScript/Node.js projelerinde hata düzeltme, refactoring, testing ve debugging işlemlerini hızlandırır.

**Version:** 1.12.0  
**Total Tools:** 77  
**Last Updated:** 2026-01-30

---

## 🎯 Quick Reference

| Kategori         | Prefix          | Tool Sayısı | Link                          |
| ---------------- | --------------- | ----------- | ----------------------------- |
| **Filesystem**   | `hev_fs_*`      | 15          | [Details](#filesystem-tools)  |
| **Development**  | `hev_dev_*`     | 20          | [Details](#development-tools) |
| **Context**      | `hev_context_*` | 4           | [Details](#context-tools)     |
| **Git/PR**       | `hev_git_*`     | 4           | [Details](#gitpr-tools)       |
| **Web**          | `hev_web_*`     | 3           | [Details](#web-tools)         |
| **Workflow**     | `hev_run_*`     | 3           | [Details](#workflow-tools)    |
| **Electron/CDP** | `hev_*`         | 28+         | [Details](#electroncdp-tools) |

---

## 🔗 Complete Tool List

**Otomatik olarak oluşturulan tam tool listesi:**  
**[See: \_metadata/TOOL-LIST.md](_metadata/TOOL-LIST.md)**

---

## 📊 Tool Categories

### Filesystem Tools (`hev_fs_*`)

**Purpose:** Dosya sistemi işlemleri için güvenli, context-preview'li araçlar.

**Common Tools:**

- `hev_fs_show` - Dosya içeriğini oku (line range destekli)
- `hev_fs_open_files` - Birden fazla dosyayı aç (collapsed view)
- `hev_fs_create_file` - Yeni dosya oluştur
- `hev_fs_find_and_replace` - Safe find & replace (duplicate prevention)
- `hev_fs_backup` - Dosya yedeği al
- `hev_fs_restore` - Çöp kutusundan geri yükle

**See:** [\_metadata/TOOL-LIST.md](_metadata/TOOL-LIST.md) for complete list

---

### Development Tools (`hev_dev_*`)

**Purpose:** TypeScript, linting, test ve syntax kontrol araçları.

**⭐ TypeScript Helper Suite (v1.11.0):**

| Tool                             | Use Case               | Frequency           |
| -------------------------------- | ---------------------- | ------------------- |
| `hev_dev_typescript_dashboard`   | Error analizi          | Her session başı    |
| `hev_dev_safe_batch_refactor`    | Toplu düzeltme         | 50+ benzer hata     |
| `hev_dev_fix_typescript_batch`   | Undefined checks       | 20-30 hata          |
| `hev_dev_typescript_type_helper` | Type conflicts         | Interface sorunları |
| `hev_dev_ast_insert`             | Smart code insertion   | Yeni kod ekleme     |
| `hev_dev_smart_insert`           | NL-based insertion     | Doğal dil pozisyon  |
| `hev_dev_register_tool`          | Auto tool registration | Yeni tool ekleme    |

**Other Dev Tools:**

- `hev_dev_analyze_project` - Proje istatistikleri
- `hev_dev_check_syntax` - Syntax + parantez kontrolü
- `hev_dev_visualize_structure` - Dosya yapısı görselleştirme
- `hev_dev_edit_lines` - Satır bazlı düzenleme (EN GÜVENLİ)
- `hev_dev_lint_file` - ESLint çalıştır
- `hev_dev_test_run` - Test çalıştır
- `hev_dev_search_symbol` - Sembol ara

**Detailed Guide:** [20-TYPESCRIPT-SUITE.md](./20-TYPESCRIPT-SUITE.md)

---

### Context Tools (`hev_context_*`)

**Purpose:** Proje context generation ve management.

**Tools:**

- `hev_context_generate` - Proje context'i oluştur (Repomix)
- `hev_context_status` - Context durumunu göster
- `hev_context_module` - Modül bazlı context oluştur
- `hev_context_read` - Oluşturulan context'i oku

**Context Levels:**

- **L1 (Quick):** 7K tokens, hızlı özet
- **L2 (Standard):** 48K tokens, detaylı
- **L3 (Deep):** 360K tokens, kapsamlı
- **L4 (Full):** 518K tokens, tam proje

---

### Git/PR Tools (`hev_git_*`)

**Purpose:** Git operations ve pull request automation.

**Tools:**

- `hev_git_fork_setup` - Repo fork, clone, feature branch oluştur
- `hev_git_create_pr` - Değişiklikleri commit et, push et ve PR oluştur
- `hev_git_check_guidelines` - Contribution guidelines kontrolü
- `hev_git_pr_status` - Mevcut git durumu, PR'lar, branch bilgileri

**GitHub CLI (gh) gerektirir.**

---

### Web Tools (`hev_web_*`)

**Purpose:** SearXNG ile web araması ve sayfa içeriği çekme.

**Tools:**

- `hev_web_search` - SearXNG araması (Google, Bing, DuckDuckGo)
- `hev_web_fetch` - Web sayfası içeriğini çek (temiz metin/markdown)
- `hev_web_search_and_fetch` - Arama yap ve ilk N sonucun içeriğini çek

**Use Cases:**

- Belge ve tutorial arama
- En son güncellemeleri bulma
- Kütüphane kullanım örnekleri

---

### Workflow Tools (`hev_run_*`)

**Purpose:** Predefined test workflow'ları.

**Workflows:**

- `setup_asistan` - Asistan sayfası için kurulum
- `setup_entrance` - Entrance sayfası için kurulum
- `setup_ai1_slot` - AI1 slot için kurulum
- `check_app` - Uygulama durumunu kontrol et

---

### Electron/CDP Tools (`hev_*`)

**Purpose:** Electron uygulamasına uzaktan kontrol (Chrome DevTools Protocol).

**Categories:**

#### 1. Health & Connection

- `hev_mcp_health` - MCP server sağlık kontrolü
- `hev_test_electron` - Electron uygulamasını test et
- `hev_check_electron_connection` - CDP bağlantı durumunu kontrol et

#### 2. Console & Logs

- `hev_read_electron_logs` - Console ve error loglarını oku
- `hev_list_log_sessions` - Mevcut log session'larını listele
- `hev_get_session_summary` - Session özeti al
- `hev_get_error_hints` - Hata için AI debugging ipuçları al

#### 3. Window & Page Control

- `hev_get_electron_window_info` - Pencere bilgilerini al
- `hev_send_command_to_electron` - JavaScript kodu çalıştır
- `hev_take_cdp_screenshot` - Ekran görüntüsü al
- `hev_scroll_page` - Sayfada scroll yap

#### 4. Element Interaction

- `hev_click_element_by_selector` - CSS selector ile tıkla
- `hev_click_element_by_text` - Metin içeriğine göre tıkla
- `hev_fill_input_field` - Input alanına değer yaz
- `hev_send_key_press` - Klavye tuşu gönder

#### 5. DOM Inspection

- `hev_get_page_dom_structure` - DOM yapısını al
- `hev_inspect_element` - Element bilgilerini incele
- `hev_query_elements` - Birden fazla elementi bul

#### 6. Provider Specific

- `hev_list_provider_webviews` - Provider ve webview listesi
- `hev_list_provider_selectors` - Config'deki selector'ları listele
- `hev_validate_provider_selectors` - Selector'ları canlı test et
- `hev_inspect_provider_element` - Webview'da element inspect et

**Detailed Guide:** [../testing/70-CDP.md](../testing/70-CDP.md)

---

## 🎯 Recommended Workflows

### Workflow 1: TypeScript Error Fixing

```bash
# 1. Dashboard ile başla
hev_dev_typescript_dashboard()

# 2. En yaygın hatayı düzelt
hev_dev_fix_typescript_batch({
  file_path: "src/modules/slot-controller.ts",
  error_codes: ["TS2532", "TS18048"],
  fix_strategy: "add_guards",
  dry_run: true
})

# 3. Toplu refactor (gerekirse)
hev_dev_safe_batch_refactor({
  file_path: "src/modules/event-handlers.ts",
  operations: [{ pattern: "...", replace_with: "..." }],
  verify_after_each: true,
  auto_rollback_on_error: true
})

# 4. Verify
hev_dev_check_syntax(file_path: "...")
```

**Detailed Guide:** [20-TYPESCRIPT-SUITE.md](./20-TYPESCRIPT-SUITE.md)

---

### Workflow 2: File Operations

```bash
# 1. Dosyayı oku
hev_fs_show({
  file_path: "src/modules/core-engine.ts",
  start_line: 1,
  end_line: 50
})

# 2. Edit yap (safest method)
hev_dev_edit_lines({
  file_path: "src/modules/core-engine.ts",
  operation: "replace",
  start_line: 25,
  end_line: 30,
  content: "// New code"
})

# 3. Syntax kontrol
hev_dev_check_syntax({
  file_path: "src/modules/core-engine.ts",
  check_brackets: true,
  check_eslint: true
})

# 4. Verify
hev_fs_show({
  file_path: "src/modules/core-engine.ts",
  start_line: 20,
  end_line: 35
})
```

---

### Workflow 3: Git & PR

```bash
# 1. Fork ve setup
hev_git_fork_setup({
  repo: "owner/repo",
  work_dir: "/path/to/workdir",
  feature_branch: "my-feature"
})

# 2. İlerleme göster
hev_git_pr_status({
  cwd: "/path/to/repo"
})

# 3. PR oluştur
hev_git_create_pr({
  base_branch: "main",
  title: "Add new feature",
  body: "Description of changes..."
})
```

---

### Workflow 4: Electron Automation

```bash
# 1. Health check
hev_mcp_health()

# 2. Test
hev_test_electron({ timeout: 10 })

# 3. Screenshot al
hev_take_cdp_screenshot()

# 4. Logları oku
hev_read_electron_logs({
  type: "error",
  tail: 100
})
```

---

## ⚠️ Best Practices

### DO ✅

1. **Her zaman dry-run mode kullan**

   ```typescript
   { ..., dry_run: true }  // Önce preview
   ```

2. **Safe batch refactor'da rollback aç**

   ```typescript
   { verify_after_each: true, auto_rollback_on_error: true }
   ```

3. **Progress tracking yap**

   ```typescript
   hev_dev_typescript_dashboard(); // Before
   // ... fixes ...
   hev_dev_typescript_dashboard(); // After
   ```

4. **Syntax kontrolü edit sonrası**
   ```typescript
   hev_dev_check_syntax({ file_path: "..." });
   ```

### DON'T ❌

1. **❌ Dry-run olmadan toplu değişiklik**

   ```typescript
   // YANLIŞ
   hev_dev_safe_batch_refactor({ ..., dry_run: false })

   // DOĞRU
   hev_dev_safe_batch_refactor({ ..., dry_run: true })
   ```

2. **❌ Rollback olmadan batch refactor**

   ```typescript
   // YANLIŞ
   { verify_after_each: false }

   // DOĞRU
   { verify_after_each: true, auto_rollback_on_error: true }
   ```

3. **❌ Rovo built-in tool'larını kullanma**
   ```typescript
   // ❌ find_and_replace_code(...)  - DUPLICATE risk!
   // ✅ hev_fs_find_and_replace(...)  - Safe!
   ```

---

## 🔧 Troubleshooting

### Problem 1: "No matches found"

**Sebep:** Regex pattern yanlış veya hedef kod değişmiş

**Çözüm:**

```typescript
// 1. Dosyayı kontrol et
hev_fs_show({ file_path: "...", start_line: 190, end_line: 200 })

// 2. Pattern'i test et (dry_run)
hev_dev_safe_batch_refactor({ ..., dry_run: true })
```

---

### Problem 2: "Error count increased"

**Sebep:** Replace string'i syntax hatası yaratmış

**Çözüm:**

- Auto-rollback zaten çalışmış olmalı
- Replace string'i kontrol et
- Syntax check ekle:

```typescript
hev_dev_check_syntax({ file_path: "..." });
```

---

### Problem 3: "MCP Server Crash"

**Sebep:** Export eksik veya syntax hatası

**Çözüm:**

```bash
# 1. Build log'u kontrol et
cd mcp-server && npm run build 2>&1 | tail -20

# 2. MCP health check
hev_mcp_health()

# 3. Restart
# Rovo'yu yeniden başlat
```

---

## 📚 Additional Resources

- **Complete Tool List:** [\_metadata/TOOL-LIST.md](_metadata/TOOL-LIST.md)
- **TypeScript Suite:** [20-TYPESCRIPT-SUITE.md](./20-TYPESCRIPT-SUITE.md)
- **CDP Usage:** [../testing/70-CDP.md](../testing/70-CDP.md)
- **Workflows:** [30-WORKFLOWS.md](./30-WORKFLOWS.md)
- **Auto-Generation:** Run `npm run generate:docs` to update TOOLL-LIST.md

---

**Version:** 1.0  
**Last Updated:** 2026-01-30  
**Status:** ✅ Production Ready

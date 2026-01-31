# 🔧 Complete Tool List

> **Generated:** 2026-01-31T09:51:42.137Z
> **Total Tools:** 99
> **Auto-generated:** `scripts/generate-tool-docs.js`

---

## Table of Contents

- [core](#core)
- [electron](#electron)
- [uncategorized](#uncategorized)
- [development](#development)

---

## core (4 tools)

### `hev_mcp_health`

**Description:** Hayalet-ev MCP'nin sağlık durumunu kontrol et. Eğer bu tool çalışıyorsa, MCP aktif ve built-in override sistemi çalışıyor demektir.

**Metadata:**
- Priority: critical
- Complexity: simple
- Risk Level: low
- Requires Confirmation: No

**Use Cases:**
- Session başlangıcında MCP sağlığını kontrol et
- Tool çalışmıyorsa troubleshoot

**Agent Guidance:** Her session başında veya tool hatası aldığında kullan. MCP çalışmazsa built-in toollar aktif olur (RISKLI!).

**Tags:** health, status, troubleshoot

---

### `hev_list_tools`

**Description:** Hayalet-ev MCP tool'larını kategorize ederek listele (97 tool)

**Metadata:**
- Priority: high
- Complexity: simple
- Risk Level: low
- Requires Confirmation: No

**Use Cases:**
- Tool keşfetme
- Kategori bazlı araştırma
- Tool count doğrulama

**Agent Guidance:** Tüm toolları görmek yerine hev_suggest_tool veya kategori bazlı arama kullan. 97 tool çok fazla!

**Tags:** discovery, list, reference

---

### `hev_suggest_tool`

**Description:** AI agent'a tool önerisi yap (intent-based discovery). Ne yapmak istediğini söyle, sana en uygun toolları önerir.

**Metadata:**
- Priority: critical
- Complexity: simple
- Risk Level: low
- Requires Confirmation: No

**Use Cases:**
- Tool karar verme
- Workflow planlama
- 97 tool arasında yol bulma

**Agent Guidance:** 97 tool arasında kayboluyorsan bu tool'u kullan. Intent-based smart search.

**Tags:** discovery, recommendation, intent

---

### `hev_tool_workflow`

**Description:** Belirli bir senaryo için önerilen tool workflow'unu göster. Step-by-step guide sağlar.

**Metadata:**
- Priority: high
- Complexity: simple
- Risk Level: low
- Requires Confirmation: No

**Use Cases:**
- Karmaşık senaryolar için adım adım kılavuz
- Workflow planlama

**Agent Guidance:** TypeScript/refactor gibi karmaşık işlemler için workflow kullan.

**Tags:** workflow, guide, planning

---

## electron (1 tools)

### `hev_test_electron`

**Description:** Hayalet-ev Electron uygulamasını test et

**Metadata:**
- Priority: medium
- Complexity: simple
- Risk Level: low
- Requires Confirmation: No

**Use Cases:**
- Electron app connectivity test
- CDP health check

**Agent Guidance:** Use to verify Electron app is running and CDP is accessible.

**Tags:** electron, testing, connectivity

---

## uncategorized (93 tools)

### `hev_read_electron_logs`

**Description:** Electron console ve error loglarını oku. Gelişmiş filtreleme: source (MAIN, RENDERER, WEBVIEW-AI1, etc.), level (LOG, WARN, ERROR), içerik arama, correlation ID ile işlem takibi.

---

### `hev_list_log_sessions`

**Description:** Mevcut log session'larını listele. Her session bir uygulama çalıştırmasını temsil eder.

---

### `hev_get_error_hints`

**Description:** Belirli bir hata mesajı için AI debugging ipuçları al. Bilinen hata pattern'lerini eşleştirir ve çözüm önerileri sunar.

---

### `hev_get_session_summary`

**Description:** Belirli bir session'ın özet bilgilerini al (hata sayısı, süre, son durum)

---

### `hev_collect_error_context`

**Description:** Hata bağlamını toplayıp özetler (komut, log, kategori, öneri)

---

### `hev_check_electron_connection`

**Description:** Electron uygulamasına CDP bağlantısını kontrol et. Uygulama çalışıyor mu ve debug portu açık mı?

---

### `hev_send_command_to_electron`

**Description:** Electron uygulamasında JavaScript kodu çalıştır. Herhangi bir JS expression çalıştırabilir.

---

### `hev_take_cdp_screenshot`

**Description:** Electron penceresinin ekran görüntüsünü al (CDP üzerinden, tam sayfa).

---

### `hev_get_electron_window_info`

**Description:** Electron penceresinin boyut, pozisyon ve URL bilgilerini al.

---

### `hev_click_element_by_selector`

**Description:** CSS selector ile bir elemente tıkla.

---

### `hev_click_element_by_text`

**Description:** Metin içeriğine göre bir elemente tıkla.

---

### `hev_fill_input_field`

**Description:** Bir input alanına değer yaz.

---

### `hev_get_page_dom_structure`

**Description:** Sayfanın DOM yapısını al. Debug ve element bulma için kullanışlı.

---

### `hev_inspect_element`

**Description:** Bir elementin detaylı bilgilerini al (boyut, pozisyon, görünürlük, içerik).

---

### `hev_query_elements`

**Description:** Bir selector ile eşleşen tüm elementleri bul ve listele.

---

### `hev_send_key_press`

**Description:** Klavye tuşu gönder (Enter, Escape, Tab vb.).

---

### `hev_scroll_page`

**Description:** Sayfada belirli bir konuma scroll yap.

---

### `hev_fs_open_files`

**Description:** Bir veya daha fazla dosyayı aç. Büyük dosyalar collapsed view ile gösterilir (fonksiyon gövdeleri gizli).

---

### `hev_fs_create_file`

**Description:** Yeni dosya oluştur. Dizin yoksa otomatik oluşturulur.

---

### `hev_fs_delete_file`

**Description:** Dosya sil (çöp kutusuna taşır, geri alınabilir). permanent=true ile kalıcı siler.

---

### `hev_fs_move_file`

**Description:** Dosya taşı veya yeniden adlandır.

---

### `hev_fs_expand_code_chunks`

**Description:** Dosyada belirli satır aralıklarını veya kod sembollerini genişlet. Pattern örnekleri: 'MyClass', 'my_function', 'def my_function', 'MyClass/myMethod'

---

### `hev_fs_find_and_replace`

**Description:** Dosyada bul ve değiştir. ignoreWhitespace=true ile whitespace farkları ignore edilir. dryRun=true ile önizleme modunda çalışır.

---

### `hev_fs_grep`

**Description:** Dosyalarda pattern ara. 3 mod: 1) Sadece content_pattern: içerik ara, 2) Sadece path_glob: dosya yolu ara, 3) Her ikisi: filtrelenmiş dosyalarda ara

---

### `hev_fs_expand_folder`

**Description:** Klasör yapısını göster (tree view).

---

### `hev_fs_bash`

**Description:** Shell komutu çalıştır. Komut workspace dizininde çalışır. & ile biten komutlar arka planda çalışır.

---

### `hev_fs_create_plan`

**Description:** Teknik plan oluştur ve doğrula.

---

### `hev_fs_trash_list`

**Description:** Çöp kutusundaki dosyaları listele

---

### `hev_fs_restore`

**Description:** Çöp kutusundan dosya geri yükle. Index verilmezse en son silinen geri yüklenir.

---

### `hev_fs_trash_empty`

**Description:** Çöp kutusunu boşalt

---

### `hev_fs_backup`

**Description:** Dosyanın yedeğini al (timestamp ile .bak uzantılı)

---

### `hev_fs_undo`

**Description:** Son dosya işlemini geri al (delete, create, replace)

---

### `hev_fs_history`

**Description:** Dosya işlem geçmişini göster

---

### `hev_fs_diff`

**Description:** İki dosyayı karşılaştır (unified diff formatı)

---

### `hev_fs_diff_content`

**Description:** İki metin bloğunu karşılaştır

---

### `hev_fs_show`

**Description:** Dosya içeriğini satır numaralarıyla göster

---

### `hev_fs_create_chunked`

**Description:** Büyük dosyaları parçalar halinde oluştur. LLM response limitlerini aşmak için chunk-based yaklaşım kullanır.

---

### `hev_fs_append_chunk`

**Description:** Mevcut dosyaya içerik ekle (streaming write). Büyük dosyaları parça parça oluşturmak için kullanılır.

---

### `hev_fs_start_chunked_session`

**Description:** GÜVENLİ CHUNK YAZMA SESSION BAŞLA

Büyük dosyalar (50-100KB+) için güvenli parçalama sistemi.

✅ ÖZELLİKLER:
- UTF-8 encoding validation
- Checksum verification
- Eksik chunk detection
- Rollback support
- Progress tracking

🔄 İŞ AKIŞI:
1. hev_fs_start_chunked_session (toplam chunk sayısını belirt)
2. hev_fs_write_chunk (her chunk için tekrarla)
3. hev_fs_chunk_session_status (İhtiyaç halinde kontrol et)
4. hev_fs_finalize_chunked (birleştir ve dosya oluştur)

📌 CHUNK STRATEJİSİ:
- Her chunk 500-800 satır (~40KB)
- Her chunk \n ile bitmeli
- Function/class ortasında kesme!
- Emoji/Türkçe karakter güvenli

---

### `hev_fs_write_chunk`

**Description:** Chunk yaz ve validate et. Her chunk için sırayla çağırılmalı.

---

### `hev_fs_finalize_chunked`

**Description:** Tüm chunk'ları birleştir ve final dosyayı oluştur. Session otomatik kapanır.

---

### `hev_fs_chunk_session_status`

**Description:** Session durumunu kontrol et. Hangi chunk'lar alındı, hangiler eksik?

---

### `hev_fs_cancel_chunk_session`

**Description:** Session iptal et ve temp dosyaları temizle.

---

### `hev_dev_analyze_project`

**Description:** Proje analizi: dosya sayıları, satır sayıları, bağımlılıklar, git durumu

---

### `hev_dev_bootstrap_context`

**Description:** Session context dosyası üret (.rovo/context.md). Yeni AI session başlatırken kullanışlı.

---

### `hev_dev_generate_diagram`

**Description:** Modül bağımlılık diagramı oluştur (Mermaid veya DOT formatında)

---

### `hev_dev_update_cache`

**Description:** Proje cache'ini güncelle (export/import haritası, dosya hash'leri)

---

### `hev_dev_edit_lines`

**Description:** Satır bazlı dosya düzenleme. Büyük dosyalarda find_and_replace yerine kullanılabilir.

---

### `hev_dev_git_diff`

**Description:** Git değişikliklerini göster (staged veya unstaged)

---

### `hev_dev_lint_file`

**Description:** Tek dosyada ESLint çalıştır

---

### `hev_dev_lint_project`

**Description:** Proje genelinde ESLint çalıştır (glob pattern ile batch linting)

---

### `hev_dev_eslint_dashboard`

**Description:** ESLint hatalarını analiz edip dashboard formatında gösterir (rule analytics, clustering)

---

### `hev_dev_eslint_batch_fix`

**Description:** ESLint rule-based otomatik toplu düzeltme (batch auto-fix with verification)

---

### `hev_dev_search_symbol`

**Description:** Projede sembol ara (fonksiyon, class, interface, type, const)

---

### `hev_dev_test_run`

**Description:** Test çalıştır (vitest/jest otomatik algılanır)

---

### `hev_dev_check_syntax`

**Description:** Dosyada syntax hataları, parantez dengesi ve ESLint kontrolleri yap

---

### `hev_dev_visualize_structure`

**Description:** Dosya yapısını görselleştir (AST scope tree, bracket analysis, unclosed detection)

---

### `hev_dev_fix_typescript_batch`

**Description:** Toplu TypeScript hatalarını otomatik düzeltir (undefined checks, optional chaining)

---

### `hev_dev_typescript_dashboard`

**Description:** TypeScript hatalarını analiz edip dashboard formatında gösterir (error count, top files, categories)

---

### `hev_dev_typescript_type_helper`

**Description:** Type uyumsuzluklarını analiz edip çözüm önerir (interface comparison, missing fields, fix suggestions)

---

### `hev_dev_ast_insert`

**Description:** TypeScript AST kullanarak kod ekler (duplicate prevention, smart positioning)

---

### `hev_dev_safe_batch_refactor`

**Description:** ⚠️ CAREFUL: Batch refactoring with validation after each step. FIXED v1.11: Removed global flag to prevent infinite loops. Test with dry_run first!

---

### `hev_dev_smart_insert`

**Description:** Natural language ile pozisyon bulma ve kod ekleme ('last if block', 'after function X', 'end of file')

---

### `hev_list_provider_webviews`

**Description:** Mevcut provider'ları ve bağlı webview'ları listele. CDP bağlantısı gerektirir.

---

### `hev_list_provider_selectors`

**Description:** Provider config dosyasındaki selector'ları listele (canlı test olmadan)

---

### `hev_validate_provider_selectors`

**Description:** Provider'ın tüm selector'larını canlı webview'da test et. Electron uygulaması ve ilgili AI sayfası açık olmalı.

---

### `hev_inspect_provider_element`

**Description:** Provider webview'ında belirli bir selector ile element inspect et

---

### `hev_web_search`

**Description:** SearXNG ile web araması yap. Google, Bing, DuckDuckGo ve diğer arama motorlarından sonuç getirir.

---

### `hev_web_fetch`

**Description:** Bir web sayfasının içeriğini çek ve temiz metin/markdown olarak döndür. Reklam, menü gibi gereksiz içerikler otomatik temizlenir.

---

### `hev_web_search_and_fetch`

**Description:** Web araması yap ve ilk N sonucun tam içeriğini çek. Detaylı araştırma için ideal.

---

### `hev_run_workflow`

**Description:** Predefined test workflow çalıştır: setup_asistan, setup_entrance, setup_ai1_slot, check_app

---

### `hev_run_steps`

**Description:** Custom workflow adımları çalıştır (click, fill, wait, screenshot, navigate, assert)

---

### `hev_list_workflows`

**Description:** Mevcut predefined workflow'ları listele

---

### `hev_git_fork_setup`

**Description:** GitHub repo fork et, clone et ve feature branch oluştur. gh CLI gerektirir.

---

### `hev_git_create_pr`

**Description:** Değişiklikleri commit et, push et ve PR oluştur. Mevcut PR varsa URL döner.

---

### `hev_git_check_guidelines`

**Description:** Repository'nin contribution guidelines, DCO, PR template vb. kontrollerini yap.

---

### `hev_git_pr_status`

**Description:** Mevcut git durumu, açık PR'lar ve branch bilgilerini göster.

---

### `hev_context_generate`

**Description:** Proje context'i oluştur (Repomix). L1=Quick(7K), L2=Standard(48K), L3=Deep(360K), L4=Full(518K token)

---

### `hev_context_status`

**Description:** Mevcut context dosyalarının durumunu göster (boyut, yaş, token sayısı)

---

### `hev_context_module`

**Description:** Belirli bir modül için özel context oluştur (örn: webview, traffic, slot)

---

### `hev_context_read`

**Description:** Oluşturulmuş context dosyasını oku. Önce hev_context_generate ile oluşturulmalı.

---

### `find_and_replace_code`

**Description:** SAFE VERSION: Find and replace code with context preview. Overrides Rovodev built-in to prevent duplicate lines.

---

### `expand_code_chunks`

**Description:** SAFE VERSION: Expand code by line ranges or patterns. Overrides Rovodev built-in.

---

### `hev_dev_fix_typescript_batch`

**Description:** Toplu TypeScript hatalarını otomatik düzeltir (undefined checks, optional chaining)

---

### `hev_dev_typescript_dashboard`

**Description:** TypeScript hatalarını analiz edip dashboard formatında gösterir

---

### `hev_dev_typescript_type_helper`

**Description:** Type uyumsuzluklarını analiz edip çözüm önerir

---

### `hev_dev_ast_insert`

**Description:** TypeScript AST kullanarak kod ekler (duplicate prevention, smart positioning)

---

### `hev_dev_safe_batch_refactor`

**Description:** Toplu refactoring ile her adımda doğrulama ve otomatik rollback

---

### `hev_dev_smart_insert`

**Description:** Natural language ile pozisyon bulma ve kod ekleme

---

### `hev_dev_register_tool`

**Description:** Yeni tool otomatik olarak handlers, registry ve index'e ekler

---

### `hev_dev_lint_project`

**Description:** Proje genelinde ESLint çalıştır (glob pattern ile batch linting)

---

### `hev_dev_eslint_dashboard`

**Description:** ESLint hatalarını analiz edip dashboard formatında gösterir (rule analytics, clustering)

---

### `hev_dev_eslint_batch_fix`

**Description:** ESLint rule-based otomatik toplu düzeltme (batch auto-fix with verification)

---

## development (1 tools)

### `hev_dev_register_tool`

**Description:** Yeni tool otomatik olarak handlers, registry ve index'e ekler (boilerplate automation)

**Metadata:**
- Priority: high
- Complexity: complex
- Risk Level: medium
- Requires Confirmation: No

**Use Cases:**
- Register new tool with boilerplate automation
- Auto-add to handlers, registry, and index
- Streamline tool development workflow

**Agent Guidance:** Use this for adding new MCP tools. Combines with npm run tool:register for full workflow. Automates handler/registry registration.

**Tags:** tool, registration, automation, boilerplate

---


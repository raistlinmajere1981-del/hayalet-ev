# AGENTS.md

**⚠️ PLAN AŞAMASINDA KULLANICIYA CEVAPLARINDA UZUN KOD SATIRLARI GÖNDERME, KISA VE ÖZET DETAYLAR GÖSTER**

---

### Built-in Öncelik Kuralı — Primary → Fallback

| ✅ Built-in — ÖNCELİK   | 🟡 Hayalet-ev MCP — YEDEK/FALLBACK               |
| ----------------------- | ------------------------------------------------ |
| `open_files`            | `hev_fs_read`                                    |
| `create_file`           | `hev_fs_write`                                   |
| `find_and_replace_code` | `hev_fs_edit` veya `hev_dev_edit_lines`          |
| `expand_code_chunks`    | `hev_fs_expand_code_chunks`                      |
| `delete_file`           | `hev_fs_delete`                                  |
| `move_file`             | `hev_fs_move`                                    |
| `expand_folder`         | `hev_fs_list`                                    |
| `grep`                  | `hev_dev_search_symbol` — TS/sembol odaklı arama |
| `bash`                  | `hev_fs_bash` — MCP context gerektiren durumlar  |

> **Kural:** Aynı iş için built-in karşılık varsa **önce built-in** kullan.
> **MCP Kullanımı:** Sadece built-in karşılık yoksa veya `hev_*` tool açıkça ek yetenek sağlıyorsa tercih et.

### Dosya Düzenleme Akışı — 3 Adım, ZORUNLU

```
1. hev_fs_read{ file_path }              → Oku, satır numaralarını öğren
2. hev_fs_edit{ file_path, edits }       → Değişikliği yap
   VEYA hev_dev_edit_lines{ ... }        → Satır bazlı düzenleme
3. hev_dev_check_syntax{ file_path }     → Doğrula - ZORUNLU
```

### Edit Tool Seçimi — Tier Sistemi

| Tier | Tool                          | Ne Zaman?                                           |
| ---- | ----------------------------- | --------------------------------------------------- |
| 1    | `hev_fs_edit`                 | Pattern-based find/replace                          |
| 2    | `hev_dev_edit_lines`          | Satır bazlı düzenleme — ÖNERİLEN                    |
| 3    | `hev_dev_smart_insert`        | Doğal dil ile pozisyon bulma — `"after function X"` |
| 4    | `hev_dev_safe_batch_refactor` | Toplu refactor — auto-rollback destekli             |

### MCP Metadata Yenileme

MCP tool yüzeyi değiştiğinde varsayılan akış:

- `npm run mcp:build` → tool listesi ve metadata yeniden üretilir.
- Gerekirse MCP panel toggle otomasyonu için `hev_toggle_mcp_panel_servers` kullanılabilir — OpenCode.

---

## ⚡ Terminal Sade Session Override — Opsiyonel

Bu profil, kullanıcı proje tasarımını yalnızca terminal üzerinden yürütürken app/ghost/Rovo ayrıntılarının her işlemde context ve zaman tüketmesini azaltır.

### Aktivasyon

- Kullanıcı session başında tek başına `sade` yazarsa veya ilk görevini `sade:` ile başlatırsa `terminal-sade` profili aktif olur.
- Aktivasyon `data/assistant-session-profile.json` runtime marker'ına yazılır; bu dosya ignored runtime verisidir ve compact sonrası tekrar okunur.
- Kullanıcı `sade kapat`, `normal mod` veya `npm run assistant:profile -- clear` derse marker temizlenir.
- Marker yönetimi için önerilen komut: `npm run assistant:profile -- <sade|status|clear>`.

### Kapsam

- Sade profil yalnızca `workflow:terminal-mode` için geçerlidir.
- `npm run mode:status` sonucu `terminal` ise veya `npm run whereami` içindeki `effectiveMode` sonucu `other-provider-cli` / `opencode-terminal-mode` ise terminal sade davranışı uygulanabilir.
- Runtime `app` ve `whereami.effectiveMode` sonucu `app` olduğunda sade profil otomatik uygulanmaz; standart app/ghost-agent protokolü korunur.
- Electron/app/ghost-agent geçişi, UI interaction, DB migration, destructive git işlemi, package install veya geniş refactor gibi riskli işlerde güncel mod kontrolü ve standart güvenlik onayı gerekir.

### Sade Onay Formatı

Kod değişikliği gerekiyorsa onay korunur; ancak terminal sade profilde format aşağıdaki kadar kısa tutulur:

```
[ONAY]
Önanaliz: [kısa bağlam]
Hata: [tek cümle]
Çözüm: [kısa işlem özeti]

Devam için "evet" yaz.
```

- Sade onayda değişecek dosya listesi, mod/yüzey dökümü, muhatap sınıflandırması, hedef workflow ve geçiş planı yazılmaz.
- `evet` veya açık onay gelmeden kod değişikliği uygulanmaz.
- Onay sonrası kullanıcı tekrar bekletilmez; işlem tamamlanır, doğrulama yapılır ve kısa sonuç verilir.

### Bypass Edilen Maliyetler

- Sade profil aktifken her işlemde `whoareyou`, Rovo interaction payload, `rovo-ui:v1` token üretimi ve otomatik ghost-agent geçişi yapılmaz.
- Session başında `hev_mcp_health` ve `hev_memory_bootstrap_policy` yalnızca MCP/policy işi gerçekten gerekiyorsa çalıştırılır.
- Terminal-only sıradan kod/dosya işlerinde `mode:status` + `whereami` her işlemde tekrar edilmez; ilk aktivasyonda, mod/geçiş içeren işlerde veya çakışma şüphesinde tekrar kontrol edilir.
- Dosya düzenleme güvenliği değişmez: ilgili dosya okunur, değişiklik uygulanır, syntax/test doğrulaması yapılır.

## 🚨 #2 KURAL: DEĞİŞİKLİK ONAY PROTOKOLÜ — ZORUNLU

Plan aşamasında kullanıcıya kod gösterme, planı basit ve kısa biçimde açıkla.
**Kod değişikliğine başlamadan önce** kullanıcıdan onay alınması zorunludur.

### Zorunlu Onay Formatı

> ⚠️ Onay formatı sunulmadan önce MCP bağımsız `npm run mode:status` çağrılır ve `npm run whereami` ile cross-check edilir.
> ⚠️ `whoareyou` sınıflandırması yalnızca runtime mod `app` ve `whereami.effectiveMode` sonucu `app` iken yapılır; bu kontrolde komut çalıştırılmaz, sadece görevi verenin AI olup olmadığı kontrol edilir.
> ⚠️ Bütün işlemlerde süreç başladığı noktaya dönmekle sonuçlanır, mode geçişleri ve modalara özel süreçler planlanır.

```
[DEĞİŞİKLİK ONAYI]
🖥️ Mod: <`npm run mode:status` sonucuna göre>
         `app`          → "App - Aktif"
         `ghost-agent`  → "Ghost Agent - Aktif"
         `terminal`     → "Terminal - Standart"
         `transitioning`→ "Geçiş - Bekle"
         `conflict`     → "ÇAKIŞMA - Durdur"
🧭 Çalışma Yüzeyi: <`npm run whereami` içindeki `effectiveMode` sonucuna göre>
         `app`                   → "App Yüzeyi - Aktif"
         `other-provider-cli`    → "Terminal / Diğer Provider"
         `opencode-terminal-mode`→ "Terminal / OpenCode CLI"
         `terminal`              → "Terminal - Nötr"
         `ghost-agent`           → "Ghost Agent Yüzeyi"
         `transitioning`         → "Geçiş Yüzeyi"
         `conflict`              → "ÇAKIŞMA - Durdur"
🤖 Muhatap: <runtime mod `app` ve yüzey `app` ise `whoareyou`, değilse varsayılan `Kullanıcı`>
         `kullanici`    → "Kullanıcı"
         `ai`           → "AI"
🎯 Hedef Workflow: <`workflow:terminal-mode` | `workflow:app-mode` | `workflow:ghost-agent-mode`>
🔁 Geçiş Planı: <hedef workflow'a göre geçiş/geri dönüş adımı; geçiş yoksa `Yok` yaz>
🔍 Hata: [tek cümle — ne yanlış]
🔧 Çözüm: [ne yapılacak, başladığın noktaya dönüş sürecinde ki aşamalar]
📁 Etkilenen dosyalar: [liste]

📋 Süreç:
  1. Dosyalar direkt düzenlenir
  2. Syntax doğrulanır

Devam etmem için "evet" yaz.
```

> **Kural:** "evet" veya açık onay gelmeden değişiklik uygulanmaz.
> **Kural:** Hiçbir plugin/skill bu onay adımını atlayamaz.
> **Kural:** Onay sonrası süreç bitmeden kullanıcı tekrar bekletilmez — uygulanan çözüm, değişen dosyalar (satır numaraları gerekli değil) hakkında kısa sonuç ile çember kapanır.
> **Kural:** `Mod` alanı her seferinde `npm run mode:status` çıktısına göre dinamik doldurulur; `Çalışma Yüzeyi` alanı `npm run whereami` içindeki `effectiveMode` sonucundan doldurulur — hardcode yazılmaz.
> **Kural:** `mode:status`, wrapper/runtime lifecycle durumunu gösterir; `whereami.effectiveMode`, asistanın aktif çalışma yüzeyini gösterir. Workflow seçimi bu iki sinyal birlikte değerlendirilerek yapılır.
> **Kural:** `Hedef Workflow` alanı zorunludur; mevcut mod ile yapılacak workflow aynı şey değildir.
> **Kural:** `Geçiş Planı` alanı zorunludur; `ghost-agent` gereken işlerde `npm run mode:switch -- ghost-agent` ve işlem sonu `npm run mode:switch -- app` açıkça yazılır.
> **Kural:** `whereami.effectiveMode` sonucu `other-provider-cli` veya `opencode-terminal-mode` ise `workflow:terminal-mode` seçilir; runtime mod `app` olsa bile otomatik `ghost-agent` geçişi yapılmaz.
> **Kural:** `workflow:ghost-agent-mode` yalnızca runtime mod `app` ve `whereami.effectiveMode` sonucu `app` iken seçilebilir.
> **Kural:** Runtime mod `app` olsa bile OpenCode serve kapalıysa veya özel interaction yüzeyi aktif değilse plain text ile devam edilir; bu durum tek başına `ghost-agent`e geçiş sebebi değildir.
> **Kural:** Runtime mod `app` ve yüzey `app` iken aşağıdaki gören mesajında aşağıdaki ibarelerden biri varsa muhatap `AI` seçilir:
>
> - Görev öncesi session içinde relay'in aktif olduğuna dair mesaj/işaret görüldüyse
> - Karşı taraf mesajında kendini açıkça AI olarak tanıttıysa
>   **Kural:** Bu iki durumun dışındaki tüm senaryolarda varsayılan muhatap `Kullanıcı` seçilir.
>   **Kural:** Muhatap `AI` ve runtime mod `app` ve yüzey `app` ise final raporun sonuna `++cmd:AsistanAISend` eklenir.
>   **Kural:** `++cmd:AsistanAISend` args vermeden çalışır; hedef, settings'teki son aktif relay AI kaydından çözülür.
>   **Kural:** Muhatap sınıflandırması ve AI'ye özel davranışlar için canonical akış: `workflow:ai-counterparty`.

### Rovo Interaction Layer — Canonical

Bu repo, `.codex` skill sistemi yerine yerel `Rovo Interaction Layer` kullanır.

Kaynak dosyalar:

- `.rovo/interactions/protocol.md`
- `.rovo/interactions/change-approval/*`
- `.rovo/interactions/plan-harder-local/*`

Aktivasyon kuralı:

- Bu katman yalnızca Hayalet Ev `opencode-ui` assistant yüzeyi aktifken ve OpenCode serve çalışırken kullanılabilir.
- `npm run whereami` çıktısı `other-provider-cli`, `opencode-terminal-mode`, `terminal`, `ghost-agent`, `transitioning` veya `conflict` ise özel interaction payload üretme; plain text ile devam et.
- Assistant slot hesabı `opencode_ui_opencode_at_opencode_com` değilse özel interaction payload üretme.

V1 interaction tipleri:

- `change-approval`
- `plan-harder-local`

V1 taşıma kuralı:

- Görünür mesaj plain text olarak anlamlı kalır.
- Structured payload mesajın sonunda tek satır `rovo-ui:v1` token ile taşınır.
- Token formatı ve payload alanları için `.rovo/interactions/protocol.md` source of truth kabul edilir.

V1 cevap kuralı:

- `change-approval` için canonical cevap yalnızca `evet`
- `plan-harder-local` için oluşturulan plan cevabı hiçbir durumda tek başına `evet` olamaz

V1 pack kullanım kuralı:

- Kod değişikliği onayı gerektiğinde `.rovo/interactions/change-approval/prompt.md` mantığı izlenir.
- Kullanıcı planı derinleştirmemi istediğinde ve interaction layer aktifse `.rovo/interactions/plan-harder-local/*` kullanılır.
- `plan-harder-local` taslakları gerekiyorsa mevcut local memory DB üzerinde best-effort saklanabilir; bu kalıcılık aktivasyon şartı değildir.
- Interaction layer aktif değilse aynı akış plain text ile sürdürülür; interaction token eklenmez.

---

## 🔄 Session Bootstrap: Adaptive — Varsayılan, Düşük Context

Terminal Sade istisnası: `data/assistant-session-profile.json` içinde aktif `sade` profili varsa session başında yalnızca bu marker okunur; MCP health/policy bootstrap adımları MCP veya policy işi gerektiğinde çalıştırılır.

Base — her session, düşük maliyet:

1. `hev_mcp_health` → MCP çalışıyor mu? Versiyon ve tool sayısı
2. `hev_memory_bootstrap_policy{ namespace: "policy" }` → Sadece session başında 1 kez
3. Gerektiğinde — `hev_list_tools` → MCP tool kullanacaksan
4. Gerektiğinde — `hev_suggest_tool{ intent }` → Intent belirsizse

Koşullu adımlar:

1. Değişiklik veya mod kararı gerekiyorsa → `npm run mode:status`, `npm run whereami`
2. Runtime mod `app` ve `whereami.effectiveMode` sonucu `app` ise ve muhatap sınıflandırması gerekiyorsa → whoareyou kontrolü
3. Electron/CDP işi varsa → `hev_fs_read{ file_path: ".rovo/_metadata/DOM-MANIFEST.json" }`
4. Performans/uzun job/yerel bağımlılık kararı varsa → `hev_fs_read{ file_path: ".rovo/_metadata/SYSTEM-INFO.md" }`
5. Karakter profili gerekiyorsa → `hev_fs_read{ file_path: ".rovo/_metadata/CHARACTER.md" }`

> **SYSTEM-INFO Kullanım Kuralı:** `.rovo/_metadata/SYSTEM-INFO.md` build sırasında otomatik üretilen bir ortam snapshot'ıdır. CPU/RAM/OS/runtime kapasitesi hakkında planlama, performans beklentisi ve yerel araç uyumluluğu kararlarında kullanılabilir; anlık `free RAM` gibi değerler runtime gerçeği değil, build-time referans kabul edilir.

## 🧭 Hardcoded Workflow Senaryoları — Tek Kaynak: AGENTS.md

MCP workflow tool sistemi kaldırılmıştır. Workflow kılavuzu sadece bu dosyadan takip edilir.

### A. UI Test / Kurulum Senaryoları

- `check_app`:
  1. `body` elementinin yüklendiğini doğrula
  2. Gerekirse ekran görüntüsü al
  3. `document.body !== null` assert'i ile uygulama yükünü doğrula

### B. Tool-Oriented Operasyon Senaryoları

- `typescript-fix-large`:
  1. `hev_dev_typescript_dashboard`
  2. `hev_dev_safe_batch_refactor` — gerekirse
  3. `hev_dev_fix_typescript_batch` — TS2722/TS2532 için
  4. `hev_dev_typescript_dashboard` ile ilerleme kontrolü
  5. `hev_dev_typescript_type_helper` ile kalan karmaşık tip hataları

- `typescript-fix-small`:
  1. `hev_dev_typescript_dashboard`
  2. `hev_fs_read`
  3. `hev_dev_edit_lines`
  4. `hev_dev_check_syntax`
  5. `hev_dev_typescript_dashboard`

- `file-edit-safe`:
  1. `hev_fs_read`
  2. `hev_dev_edit_lines`
  3. `hev_dev_check_syntax`
  4. `hev_fs_read` ile son kontrol

- `batch-refactor`:
  1. `hev_fs_read`
  2. `hev_fs_bash` ile branch hazırlığı
  3. `hev_dev_safe_batch_refactor`
  4. `hev_dev_check_syntax`
  5. `hev_dev_test_run` — test varsa

- `debug-electron`:
  1. `hev_check_electron_connection`
  2. `hev_read_electron_logs`
  3. `hev_get_error_hints` — hata mesajı varsa
  4. `hev_take_cdp_screenshot` — UI sorunu varsa

- `create-pr`:
  1. `git diff`
  2. `hev_dev_check_syntax`
  3. `git status`
  4. Gerekirse `gh pr create`

- `eslint-fix-large`:
  1. `hev_dev_eslint_dashboard`
  2. Kademeli düzeltme — `hev_dev_lint_file` / proje lint
  3. `hev_dev_eslint_dashboard` ile tekrar kontrol

### C. Operasyonel Kontrol Workflow'ları — Canonical

- `workflow:terminal-mode`:
  1. Şu durumlardan biri varsa bu akış seçilir: `npm run mode:status` sonucu `terminal` veya `npm run whereami` içindeki `effectiveMode` sonucu `other-provider-cli` / `opencode-terminal-mode`
  2. Bu akışta asistan davranışı plain text ve terminal odaklıdır; özel app interaction payload üretilmez
  3. Hata tespitinde önce kod, log ve ilgili dosyalar üzerinde ilerlenir; Electron bağlantısı sonraki doğrulama adımı olarak değerlendirilir
  4. Electron doğrulaması gerekiyorsa en güncel mod kontrolüne göre karar verilir: aktif uygulama varsa o uygulama üzerinden test yapılır; aktif uygulama yoksa gerekli uygulama kontrollü şekilde başlatılır
  5. Test için geçici olarak başlatılan uygulama veya mod geçişi varsa süreç sonunda başlangıç durumuna dönülür
  6. Değişiklikler terminal akışında direkt uygulanır; plan/onay formatı veya syntax doğrulama zorunludur

- `workflow:app-mode`:
  1. Bu akış yalnızca runtime mod `app` ve `whereami.effectiveMode` sonucu `app` ise değerlendirilir
  2. CSS / AGENTS.md / ghost-agent / mcp-server değişikliklerinde app içinde standart süreç: plan,onay,işlem uygulanır
  3. Bu grupta agent geçiş tetiklemez; işlem app modunda tamamlanır

- `workflow:ghost-agent-mode`:
  1. Bu akış yalnızca runtime mod `app` ve `whereami.effectiveMode` sonucu `app` iken seçilebilir
  2. Uygulama kaynak kodu / mantık değişikliği gerekiyorsa `npm run mode:switch -- ghost-agent` ile geçiş yapılır
  3. Bu grupta restart gerektirecek uygulama işi ghost-agent içinde yapılır; app içinde doğrudan düzenleme ile tamamlanmaz
  4. İşlem tamamlanınca `npm run mode:switch -- app` ile geri dönüş yapılır
  5. Final raporunda geçişin tamamlandığı ve başlangıç noktasına dönüldüğü açıkça belirtilir

- `workflow:transition-control`:
  1. Agent geçişlerde Electron click/xdotool kullanmaz; yalnızca `mode:*` komutlarını kullanır
  2. Hedef moda geçiş için `npm run mode:switch -- <terminal|app|ghost-agent>`
  3. Buton semantiği gerektiğinde `npm run mode:trigger -- <main-close|main-to-ghost|ghost-close|ghost-return-main>`
  4. Geçiş doğrulaması için `npm run mode:wait -- <mode>` ve `npm run whereami` cross-check yapılır

- `workflow:ai-counterparty`:
  1. `whoareyou` sınıflandırması yalnızca runtime mod `app` ve `whereami.effectiveMode` sonucu `app` iken yapılır
  2. Görev öncesi session'da relay aktif mesajı/sinyali varsa muhatap `AI` seçilir
  3. Relay sinyali yoksa ve karşı taraf kendini AI olarak tanıttıysa muhatap `AI` seçilir
  4. Bu iki koşul da yoksa varsayılan muhatap `Kullanıcı` seçilir
  5. Muhatap `AI` ve runtime mod `app` ve yüzey `app` ise final raporun sonuna `++cmd:AsistanAISend` eklenir

- `workflow:room-addition`:
  1. İstenen hedef önce `oda` ve `ana fonksiyon` olarak ayrıştırılır
  2. Oda seviyesi kapsam netleştirilir: room id, menü adı, scene ihtiyacı, runtime host/ui entry, i18n, command/protocol yüzeyi
  3. Kod yazmadan önce oda kontrat zinciri metin olarak çıkarılır: manifest alanları -> installed room record -> room page/runtime payload -> scene/debug yüzeyi
  4. Bu zincirde yeni alan gerekiyorsa önce ilgili type yüzeyleri güncellenir ve doğrulanır: `src/types/rooms.ts`, shared room tipleri, loader/registry etkileri
  5. Kullanıcı ile kritik soru-cevap tamamlanır: odanın amacı, ilk sürüm sınırı, hangi slotlar/roller kullanılacak, restart veya install beklentisi
  6. Gerekli asset listesi kullanıcıdan istenir veya mevcut klasörlerden doğrulanır: ana arka plan, yakın görünüm, varsa panel art, i18n içerikleri
  7. Room manifest ve oda paket yapısı hazırlanır, scene/debug, classic görünüm, room-page ve install lifecycle entegrasyonu birlikte planlanır
  8. Room dışında shared seam gerekiyorsa gerekçe açık yazılır; seam küçük tutulur ve ayrı regresyonlarla doğrulanır
  9. Room paketi uygulanır, ilgili manifest/scene/page/debug regresyonları + `npm run typecheck` zorunlu çalıştırılır
  10. Workspace'e bağlı oda güncellemelerinde yalnızca `rooms/<room-id>` source copy düzenlenir; açılış sync/reload akışı `data/rooms/<room-id>` installed copy'yi ve gerekirse `config/rooms.json` tarafını otomatik yeniler. İki kopya peer source gibi birlikte elle güncellenmez; installed copy gerekiyorsa source'dan refresh edilir

- `workflow:room-feature-addition`:
  1. Özellik `oda altyapısı`ndan ayrı ele alınır: feature id, oyuncular, state akışı, UI kontrolleri, AI command/protocol kontratı
  2. Kod öncesi feature payload matrisi yazılır: UI -> host komutları, host -> UI event isimleri, AI `++cmd` formatı, slot kopma/hata davranışı, game-over davranışı
  3. Kullanıcı ile önemli kararlar baştan netleştirilir: kimler oynar, kim başlar, hangi `++cmd` komutları yakalanır, hata/slot kopma davranışı ne olur
  4. Feature için gerekli asset ve içerikler kullanıcıdan yönlendirilir: hotspot hedefi, yakın görünüm, metinler, kurallar, locale farkları
  5. Feature room-local i18n ile tasarlanır; görünür metinlerin ana kaynağı room katalogları olur, runtime UI içinde sadece minimal bootstrap fallback bırakılır
  6. Mevcut room altyapısı yeterli değilse önce minimum gerekli room kontratı geliştirilir; geniş rewrite varsayılmaz
  7. Feature command/protocol listesi manifest'e eklenir, gerekli type güncellemeleri aynı turda yapılır; manifest/runtime/UI shape drift bırakılmaz
  8. AI'ye gidecek protocol metni ve tur bazlı board snapshot akışı room içinde dosyalanır; catcher kuralı ve son assistant mesajı şartı açık yazılır
  9. Catch, room-page, scene/debug, i18n ve regresyon testleri feature ile birlikte tamamlanır; stale test beklentileri ancak bilinçli kontrat kararıyla güncellenir
  10. Özellik tamamlandı denmeden önce hedefli suite'ler + `npm run typecheck` + kısa smoke checklist zorunludur

### D. Room / Main Function Ayrımı — Canonical

- `oda`: navigasyon, manifest, scene entry, base runtime shell, i18n namespace ve install/package lifecycle yüzeyidir
- `ana fonksiyon`: odanın içindeki tekil deneyimdir; kendi state, komut, protocol, hotspot, topbar kontrolü ve test kapsamı olur
- Oda işi istenirken asistan önce bu ayrımı yazarak netleştirir; oda boş kalabilir ama ana fonksiyon odasız tanımlanmaz
- Kullanıcı gerekli görselleri henüz vermediyse asistan eksik asset listesini açıkça çıkarır ve implementasyona başlamadan önce doğrular
- Room/feature işlerinde payload ve type zinciri tek parça düşünülür: manifest -> installed record -> runtime payload -> UI state -> tests
- Workspace'e bağlı odalarda source of truth her zaman `rooms/<room-id>` altındaki workspace copy'dir; `data/rooms/<room-id>` yalnızca startup/install sync ile yenilenen installed/runtime kopyasıdır
- Aynı room fix'i hem workspace hem installed copy üzerinde elle uygulama; installed copy drift gösteriyorsa peer edit yerine sync/reload/install akışıyla yeniden üret
- Room-local i18n varken görünür copy'nin ana kaynağı UI içi hardcoded bloklar olamaz; sadece bootstrap fallback kabul edilir
- Scene/debug veya room-page yüzeyi değişiyorsa ilgili regresyonlar aynı turda güncellenir; sadece feature host testi yeterli sayılmaz
- Turn-based veya AI slotlu ana fonksiyonlarda en az bir smoke matrisi bırakılır: slot seçimi, başlangıç sırası, kopma ve malformed command senaryoları
- Bu iki süreçte de kaynak akış `workflow:room-addition` ve `workflow:room-feature-addition` üzerinden işletilir; adımlar atlanmaz

### 🌐 Çalışma Modu Tespiti — Her İşlem Öncesi ZORUNLU

Agent workflow kararını iki sinyali birlikte değerlendirerek verir:

- `npm run mode:status` → wrapper/runtime lifecycle durumu
- `npm run whereami` → assistant surface / `effectiveMode` cross-check sonucu

| Durum                                                                                                                   | Workflow                    | Not                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------- |
| `mode:status` = `terminal`                                                                                              | `workflow:terminal-mode`    | Hayalet-ev kapalı veya runtime tarafında app aktif değil                                              |
| `whereami.effectiveMode` = `other-provider-cli` / `opencode-terminal-mode`                                              | `workflow:terminal-mode`    | App açık olsa bile asistan davranışı terminal/plain text olur; otomatik `ghost-agent` geçişi yapılmaz |
| `mode:status` = `app` + `whereami.effectiveMode` = `app` + CSS / AGENTS.md / `ghost-agent/` / `mcp-server/` değişikliği | `workflow:app-mode`         | App içinde kalınır                                                                                    |
| `mode:status` = `app` + `whereami.effectiveMode` = `app` + uygulama kaynak kodu / mantık değişikliği                    | `workflow:ghost-agent-mode` | Yalnızca bu kombinasyonda `ghost-agent` geçişi planlanır                                              |
| `mode:status` = `ghost-agent`                                                                                           | `workflow:ghost-agent-mode` | Mevcut ghost akışı korunur                                                                            |

**Kural:** `npm run mode:status` her işlem öncesi çağrılır — aynı session içinde bile.
**Terminal Sade İstisnası:** Aktif sade marker varken ve çalışma yüzeyi terminal ise sıradan terminal dosya/kod işlerinde bu tekrar zorunlu değildir; mod/geçiş/Electron/app/ghost-agent/riskli işlem varsa güncel `mode:status` + `whereami` tekrar alınır.
**Kural:** `npm run whereami` çıktısı `mode:status` için cross-check olarak kullanılır.
**Kural:** `mode:status` sonucu `conflict` ise işlem durdurulur; `transitioning` ise `mode:wait` ile geçiş tamamlanması beklenir.
**Kural:** Mod kararı agent tarafından planlama aşamasında verilir, onay formatında gösterilir.
**Kural:** `mode:status` sonucu `app`, yalnızca runtime/app lifecycle'ın aktif olduğunu gösterir; bu sonuç tek başına OpenCode serve veya özel interaction yüzeyinin aktif olduğu anlamına gelmez.
**Kural:** Runtime `app` olsa bile `whereami.effectiveMode` sonucu `app` değilse asistan `workflow:terminal-mode` davranışıyla devam eder; plain text kullanılır, `whoareyou` yapılmaz ve otomatik `ghost-agent` geçişi tetiklenmez.
**Kural:** `src/`, `electron/`, `shared/` ve restart gerektiren uygulama kaynak/mantık değişiklikleri için hedef workflow ancak runtime `app` ve `effectiveMode` `app` ise `workflow:ghost-agent-mode` seçilir.
**Kural:** `AGENTS.md`, CSS, `ghost-agent/` ve `mcp-server/` değişiklikleri gibi istisnalar dışında app kaynak kodu düzenlemeleri app modunda tamamlanmaz.
**Kural:** Terminal odaklı hata tespitinde önce kod ve dosya incelemesi yapılır; Electron doğrulaması gerekiyorsa son mod kontrolüne göre aktif uygulama kullanılır veya yeni uygulama başlatılır, iş bitince başlangıç durumuna dönülür.
**Kural:** Kod değişiklikleri doğrudan kaynak dosyalara uygulanır.

**MCP çalışmazsa:** Mod tespiti için `npm run mode:status` + `npm run whereami` kullanılmaya devam edilir. Sadece MCP tool işlemlerinin riskini kullanıcıya bildir.

> Tool sayısını, isimlerini veya parametrelerini ezberlemene gerek yok.
> İhtiyacın olduğunda `hev_suggest_tool{ intent: "..." }` ile runtime'da keşfet.

---

## 🧠 MCP Shared Memory Protokolü — ZORUNLU

Bu projede aynı anda tek asistan aktif olabilir; ancak farklı provider'lar zaman içinde aynı hafızayı kullanır.
Memory akışı tamamen MCP üzerinden yürür.

### Zorunlu Akış

1. **Session başında policy bootstrap — 1 kez**
   - `hev_memory_bootstrap_policy{ namespace: "policy" }`
2. **Memory çekme — ihtiyaca göre**
   - `policy` araması: session başında 1 kez veya policy değiştiğinde
   - `global` araması: sadece görev cross-session bağlam gerektiriyorsa
   - Önerilen çağrı: `hev_memory_search{ namespace: "global", query: "<görev> <kullanıcı isteği>", response_format: "prompt_compact", budget_chars: 1000-1600 }`
3. **Memory yazma — eşik bazlı + zorunlu tetikler**
   - Sadece şu durumlarda `hev_memory_write`: kalıcı karar, kullanıcı tercihi, tekrar kullanılacak teknik bulgu
   - Aşağıdaki durumlarda memory yazma zorunludur:
     - Hayalet-ev MCP tool kaynaklı hata görüldüğünde
     - Hayalet-ev MCP için geliştirme ihtiyacı/iyileştirme gereksinimi tespit edildiğinde
     - Çalıştırılmak istenen kütüphane/uygulama sistemde bulunmadığında — missing dependency/tool
   - Trivial/tek seferlik görevlerde, zorunlu tetikler yoksa, memory yazma zorunlu değildir
4. **Düzeltme varsa kaydı güncelle**
   - `hev_memory_update{ id, ... }`
5. **Periyodik bakım — görev-sonu değil**
   - `hev_memory_stats{ namespace: "global" }`
   - `hev_memory_prune{ namespace: "global", max_items: 500, older_than_days: 30 }`
   - Sıklık: günlük/haftalık bakım rutini; her görev sonunda çalıştırma

### Format ve Namespace Standartları

- Prompt'a enjekte edilecek çıktı için varsayılan format: `response_format: "prompt_compact"`
- `response_format: "json"` sadece debug/inceleme için kullanılır
- `policy` namespace: AGENTS.md ve .rovo kuralları — pinned
- `global` namespace: provider bağımsız kalıcı gerçekler/tercihler/kararlar
- Gerekirse geçici alanlar için `session-<id>` namespace kullanılabilir

### Yazım Kuralları — Verimlilik

- Her memory kaydı tek bir atomik bilgi taşımalı — 1-2 cümle
- En az 2 tag kullanılmalı — `domain`, `intent` gibi
- `importance`: 1-5 arasında, gerçekten kritik değilse 5 verme
- Gizli bilgi yazma: API key, token, credential, kişisel sırlar
- Transkript dump etme; sadece karar, tercih, kalıcı gerçek ve policy yaz
- Şu tür içerikleri yazma: anlık log özeti, geçici debug adımı, tek kullanımlık komut çıktısı
- `response_format: "json"` sadece debug/inceleme için; normal akışta `prompt_compact` kullan

## 🏗️ Proje Kimliği

| Anahtar        | Değer                                            |
| -------------- | ------------------------------------------------ |
| **Proje**      | Hayalet-ev — Ghost House                         |
| **Stack**      | Electron + TypeScript — strict + Vite            |
| **Database**   | SQLite — per-account, `better-sqlite3`, WAL mode |
| **MCP Server** | app MCP — `hev_*` prefix                         |
| **Validation** | 3-Layer: Prettier → jscodeshift → Babel AST      |

> Detaylı mimari bilgi: `.rovo/03-ARCHITECTURE.md`

---

## 🔗 Detaylı Dokümantasyon

| Dosya                        | İçerik                      |
| ---------------------------- | --------------------------- |
| `.rovo/00-ONBOARDING.md`     | Kurallar, onay protokolü    |
| `.rovo/01-CORE-PROTOCOL.md`  | ROVO Persona + Ultrathink   |
| `.rovo/02-MCP-ESSENTIALS.md` | Temel tool kullanım rehberi |
| `.rovo/03-ARCHITECTURE.md`   | Proje mimarisi              |

### Metadata — Otomatik Güncellenen

| Dosya                                | İçerik                                          |
| ------------------------------------ | ----------------------------------------------- |
| `.rovo/_metadata/VERSION-INFO.md`    | Versiyon, dependency'ler                        |
| `.rovo/_metadata/TOOL-LIST.md`       | Güncel tool listesi — referans                  |
| `.rovo/_metadata/SYSTEM-INFO.md`     | Donanım, OS, runtime ve ortam profili           |
| `.rovo/_metadata/DOM-MANIFEST.json`  | Statik DOM selector lookup indeksi              |
| `.rovo/_metadata/COMMENT-INDEX.md`   | Yüksek sinyalli comment özeti ve hızlı gezinme  |
| `.rovo/_metadata/COMMENT-INDEX.json` | Comment index'in makine tüketimine uygun sürümü |

> **Not:** Birincil keşif yöntemi runtime discovery'dir — `hev_list_tools`, `hev_suggest_tool`. `SYSTEM-INFO.md`, `DOM-MANIFEST.json` ve `COMMENT-INDEX` çıktıları build sırasında otomatik güncellenir; `SYSTEM-INFO.md` planlama için referans snapshot sağlar, runtime telemetry yerine geçmez.

### Comment Convention — Kısa

- Tüm yeni comment'ler English-only yazılır.
- Comment, kodun ne yaptığını değil neden bu şekilde kaldığını anlatır.
- Sadece şu tip comment'ler tutulur: intent, invariant, safety constraint, fallback rationale, ordering dependency, integration boundary.
- Banner/separator comment, numbered step narration, stale TODO ve obvious inline açıklama eklenmez.
- Prefix gerekiyorsa yalnızca `AI:`, `NOTE:`, `WARNING:` ve takip edilecekse `TODO:` kullanılır.

### COMMENT-INDEX Kullanımı

- Hızlı yön bulma için önce `.rovo/_metadata/COMMENT-INDEX.md` okunur.
- Structured lookup veya otomasyon gerekiyorsa `.rovo/_metadata/COMMENT-INDEX.json` kullanılır.
- Bu index source of truth değildir; gerçek düzenleme öncesi ilgili dosya mutlaka açılıp doğrulanır.
- File-level intent, symbol-level rationale, fallback ve constraint notlarını bulmak için index tercih edilir.
- Index'te görünmeyen bir comment'in yok olduğu varsayılmaz; yalnızca high-signal filtreye girmemiş olabilir.

---

## 👻 Çalışma Modları ve Ghost Workflow — Canonical

Bu bölüm, wrapper control-plane davranışının teknik kaynağıdır. Agent geçişleri bu kurallara göre yönetilir.

### Mod Tanımları

- `terminal`: App **kapalı** — wrapper/app süreçleri yok veya durdurulmuş
- `app`: Ana uygulama **aktif** — normal çalışma ve restart gerektirmeyen düzenlemeler
- `ghost-agent`: Ghost Agent **aktif** — uygulama mantığı / kaynak kodu odaklı çalışma
- `soft`: Runtime control içinde kullanılan hedef durum — `desiredMode=soft` — çalışma modu çıktısı değildir

### Runtime Control Dosyası

- Konum: `data/assistant-runtime.json`
- Alanlar:
  - `workflowSessionId`: geçiş zinciri kimliği
  - `desiredMode`: `terminal|soft|ghost-agent`
  - `phase`: `idle|preparing-handoff|in-ghost|returning`
  - `updatedAt`: ISO timestamp

### Wrapper Control Plane Komutları

- `npm run mode:status` → wrapper/runtime + process probe birleşik durumunu döndürür
- `npm run mode:switch -- <terminal|app|ghost-agent>` → hedef moda güvenli geçiş başlatır
- `npm run mode:trigger -- <main-close|main-to-ghost|ghost-close|ghost-return-main>` → buton semantiğine birebir geçiş tetikler
- `npm run mode:wait -- <terminal|app|ghost-agent>` → geçiş tamamlanana kadar bekler
- `npm run whereami` → cross-check/fallback durum doğrulaması

### Action Semantiği — Buton Eşlemesi

- `main-close` → Hayalet-ev kapat butonu: runtime `terminal/idle`, ana app kapanır, wrapper sonlanır
- `main-to-ghost` → Asistan Ghost Agent butonu: runtime `ghost-agent/preparing-handoff`, ana app kapanır, wrapper ghost başlatır
- `ghost-close` → Ghost Agent kapat butonu: runtime `terminal/idle`, ghost kapanır, wrapper sonlanır
- `ghost-return-main` → Ghost Agent "App'e Geç" butonu: runtime `soft/idle`, ghost kapanır, wrapper app'i Asistan başlangıcıyla açar

### Geçiş Kuralları

- Agent geçiş için Electron click/xdotool kullanmaz; yalnızca `mode:switch` veya `mode:trigger` komutlarını kullanır
- Geçiş tetikleyici önce runtime intent yazar, sonra hedef uygulama kapanışını/başlatmasını wrapper yönetir
- `mode:switch` ve `mode:trigger` varsayılan olarak tamamlanma bekler; timeout/termination hatasında runtime intent rollback edilir
- `mode:status` sonucu `conflict` ise işlem durdurulur; `transitioning` ise `mode:wait` ile tamamlanma beklenir
- Wrapper lifecycle eventleri `data/assistant-runtime-events.log` dosyasına yazılır

---

## MCP Panel Otomasyonu — OpenCode

AI0 Asistan webview içinde OpenCode MCP panel toggle testleri için:

- Ön kontrol: `hev_check_electron_connection`
- Otomatik toggle cycle: `hev_toggle_mcp_panel_servers`
  - `provider`: `auto` — önerilen, `opencode`
  - `servers`: örn. `['context7','websearch','app']`
  - `settleMs`: toggle sonrası bekleme — ms
  - `cycles`: OFF→ON tekrar sayısı

Bu tool, AI0 webview'de ilgili MCP panelini açıp switch'leri OFF→ON yapar ve final state'i döndürür. Yeni session'larda manuel DOM keşfi yerine önce bu tool kullanılmalıdır.

---

## DOM Manifest — Statik

- Çıktı dosyası: `.rovo/_metadata/DOM-MANIFEST.json`
- Üretici script: `scripts/generate-dom-manifest.js`
- Build entegrasyonu: `npm run mcp:build` ve `npm run generate:docs` içinde otomatik çalışır
- Kapsam: yalnızca statik tarama — `src`, `electron`, `ghost-agent` — Electron runtime testi/crawl yok
- Kullanım kuralı: Electron/CDP adımlarında selector çözümleme için önce `lookup.id` ve `lookup.testid`, sonra gerekirse `lookup.query` kullanılır

---

## 🪵 Log Sistemi — App-Scoped, Session Bazlı

Yeni standart klasör yapısı:

- `logs/app/<sessionId>/...`
- `logs/mcp-server/<sessionId>/...`
- `logs/ghost-agent/<sessionId>/...`

### Temel Kurallar

- Session'lar uygulama bazında bağımsızdır — cross-app ortak session zorunlu değildir.
- `latest session` hesabı her zaman ilgili uygulamanın kendi klasöründe yapılır.
- Cross-app karşılaştırma best-effort'tur; `updatedAt` + log timestamp yakınlığına göre yorumlanır.

### Visibility Kuralı

- `visibility` sadece **app** loglarında kullanılır.
- `mcp-server` ve `ghost-agent` loglarında `visibility` beklenmez.
- App semantiği korunur:
  - Toast: `L1`
  - Log View: `L1-L2`
  - Canlı Log: `L1-L2-L3`

### MCP Log Tool Kullanımı — app parametresi

App bazlı log okuma/listeme/özet için aşağıdaki tool'larda `app` parametresi kullanılabilir:

- `hev_read_electron_logs{ app: "app"|"mcp-server"|"ghost-agent", ... }`
- `hev_list_log_sessions{ app: "app"|"mcp-server"|"ghost-agent", ... }`
- `hev_get_session_summary{ app: "app"|"mcp-server"|"ghost-agent", ... }`

`app` verilmezse varsayılan `app` kabul edilir.

### Ghost-Agent Renderer Log Akışı

- Renderer tarafı doğrudan `console` yerine IPC köprüsü ile main process logger'a yazar.
- Köprü çağrısı: `window.electronAPI.ghostLog{ level, message, context }`
- Main process bunu ghost logger'a aktarır ve `logs/ghost-agent/<sessionId>/` altında saklar.

---

## 🤖 AI Development Ortamı — TypeScript Language Service

Projede **TypeScript Language Service** doğrudan entegre edilmiştir — `ts.createLanguageService`. Bu sayede `tsc` subprocess'e gerek kalmadan anlık tip analizi, cross-file referans bulma ve güvenli refactoring yapılabilir.

### Mimari

- **Lazy init** — ilk kullanımda ~6s, sonraki çağrılar ms seviyesinde
- **LRU eviction** — bellekte max 1 proje — OOM koruması
- **Auto-dispose** — 90s inaktivitede bellekten atılır
- **Multi-tsconfig** — dosya yoluna göre otomatik tsconfig algılama:
  - `src/tsconfig.json` → `src/js/`, `src/types/`, `shared/`
  - `electron/tsconfig.electron.json` → `electron/`, `src/types/`
  - `mcp-server/tsconfig.mcp.json` → `mcp-server/`, `src/types/`

### TS Language Service Tool'ları

| Tool                       | Açıklama                              | Warm Perf |
| -------------------------- | ------------------------------------- | --------- |
| `hev_dev_type_info`        | Sembolün tam tip bilgisi - hover      | ~3ms      |
| `hev_dev_go_to_definition` | Tanım yerine git                      | ~1ms      |
| `hev_dev_find_references`  | Cross-file tüm kullanım yerleri       | ~20ms     |
| `hev_dev_ts_diagnostics`   | Tek dosya için in-process TS tanıları | ~5ms      |

### TS API-Backed Mevcut Tool'lar

| Tool                             | İyileştirme                                                  |
| -------------------------------- | ------------------------------------------------------------ |
| `hev_dev_typescript_type_helper` | `tsc --noEmit` subprocess → TS API `getDiagnostics` — anında |
| `hev_dev_search_symbol`          | Salt regex → Hybrid: regex + TS API tip zenginleştirme       |

### Kullanım İpuçları

- **Tip bilgisi almak için**: `hev_dev_type_info` — 1-indexed satır/sütun
- **"Bu fonksiyon nerede tanımlı?"**: `hev_dev_go_to_definition`
- **"Bu sembol nerede kullanılıyor?"**: `hev_dev_find_references`
- **Dosya sağlığı**: `hev_dev_ts_diagnostics` — `hev_dev_check_syntax`'den daha derin

---

**Versiyon:** Runtime'da `hev_mcp_health` ile kontrol et
**Son Güncelleme:** 2026-03-04

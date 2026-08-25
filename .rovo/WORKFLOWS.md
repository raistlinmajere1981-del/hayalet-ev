# WORKFLOWS.md

İş bazlı playbook'lar. Yalnızca ilgili iş yapılırken okunur; session başında yüklenmez.

## Oda / Özellik Ekleme

**Oda ile ana fonksiyon farkı:**
- *Oda*: navigasyon, manifest, scene entry, base runtime shell, i18n namespace, install/package lifecycle.
- *Ana fonksiyon*: odanın içindeki tekil deneyim — kendi state/komut/protocol/hotspot/topbar/test kapsamı.
- Oda boş kalabilir ama bir ana fonksiyon odasız tanımlanmaz.

İstekten hangisinin kastedildiği güvenle çıkarılabiliyorsa doğrudan ilerle. Yalnızca iki makul yorum farklı mimari veya kullanıcı sonucu doğuruyorsa netleştirme iste.

**Yeni özellik eklerken:**
1. Hedef/kapsam tek cümleye indirgenir. Kritik kararlar mevcut istek, oda kontratı ve codebase'den çıkarılır; yalnız gerçekten bloklayan belirsizlik kullanıcıya sorulur.
2. Payload matrisi çıkarılır: UI→host komutları, host→UI event'leri, AI `++cmd` formatı, slot kopma/hata davranışı.
3. Eksik asset/görsel implementasyonu bloklamıyorsa placeholder/fallback ile ilerlenir. Yalnızca sonucu gerçek anlamda durduran eksikler kullanıcıdan istenir.
4. Room-local i18n ile tasarlanır; runtime'da yalnızca minimal bootstrap fallback bırakılır.
5. Mevcut room altyapısı yetersizse önce minimum gerekli kontrat genişletilir; geniş rewrite varsayılmaz.
6. Manifest'e command/protocol eklenir; type güncellemeleri aynı turda yapılır, drift bırakılmaz.
7. AI protokol metni ve tur bazlı akış room içinde dosyalanır (`main-functions/<feature>/protocols/`).
8. Değişikliğin dokunduğu yüzey için hedefli regresyonlar tamamlanır. İlgisiz test yüzeyleri sırf checklist'i doldurmak için çalıştırılmaz.
9. Bitirmeden önce değişen dosyalarda syntax kontrolü ve ilgili hedefli testler çalıştırılır. Shared/core/type sınırı etkileniyorsa `npm run typecheck`; geniş veya yapısal değişiklikte uygun room gate ya da `npm run check:all` kullanılır.

**Kaynak/kopya kuralı:** Workspace'e bağlı odalarda source of truth her zaman `rooms/<room-id>` workspace kopyasıdır; `data/rooms/<room-id>` yalnızca sync ile yenilenen installed kopyadır. Fix'i iki kopyaya elle uygulama; installed drift varsa sync/reload/install akışıyla yeniden üret.

## Bilinen Tool Senaryoları

**typescript-fix-large:**
`hev_dev_typescript_dashboard` → gerekirse `hev_dev_safe_batch_refactor` → `hev_dev_fix_typescript_batch` (TS2722/TS2532 gibi kalıplar için) → `hev_dev_typescript_dashboard` ile ilerleme kontrolü → kalan karmaşık hatalar için `hev_dev_typescript_type_helper`.

**typescript-fix-small:**
`hev_dev_typescript_dashboard` → `hev_fs_read` → `hev_dev_edit_lines` → `hev_dev_check_syntax` → `hev_dev_typescript_dashboard`.

**file-edit-safe:**
`hev_fs_read` → `hev_dev_edit_lines` → `hev_dev_check_syntax` → yalnız gerekirse `hev_fs_read` ile son kontrol.

**batch-refactor:**
`hev_fs_read` → `hev_fs_bash` ile branch hazırlığı → `hev_dev_safe_batch_refactor` → `hev_dev_check_syntax` → varsa ilgili `hev_dev_test_run`.

**debug-electron:**
`hev_debug_ui_report` (ilk rapor) → şüpheye göre `hev_debug_network_requests` / `hev_debug_console_events` → gerektiğinde `hev_ui_accessibility_snapshot` veya `hev_ui_layout_audit` → mini repro için `hev_ui_action_flow` → test/smoke failure sonrası `hev_debug_failure_bundle`. Fallback: `hev_check_electron_connection`, `hev_read_electron_logs`, `hev_get_error_hints`.

**create-pr:**
`git diff` → ilgili syntax/test kontrolü → `git status` → gerekirse `gh pr create`.

**eslint-fix-large:**
`hev_dev_eslint_dashboard` → kademeli düzeltme → `hev_dev_eslint_dashboard` ile tekrar kontrol.

**check_app (UI test/kurulum doğrulama):**
`body` elementinin yüklendiğini doğrula → gerekirse screenshot → `document.body !== null` assert'i.

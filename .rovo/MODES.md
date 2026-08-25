# MODES.md

Yalnızca mod geçişi yapılırken, uygulama kaynağında restart gerektiren bir değişiklik yapılırken veya çalışma yüzeyi gerçekten belirsiz/çelişkili olduğunda okunur. AGENTS.md'deki "Mod Farkındalığı" bölümü bu dosyaya ne zaman bakılacağını belirler.

## Modlar

| Mod | Anlamı |
|---|---|
| `terminal` | Düz terminal/CLI oturumu, app açık olsa da olmasa da |
| `app` | Hayalet-ev içindeki Asistan (AI0) yüzeyinden çalışılıyor |
| `ghost-agent` | Ayrı Ghost Agent penceresi/oturumu üzerinden çalışılıyor |
| `soft` | Geçiş arası ara durum |

## Workflow Seçimi

| Durum | Workflow |
|---|---|
| `mode:status` = terminal | `workflow:terminal-mode` |
| `whereami.effectiveMode` ∈ {terminal, other-provider-cli, opencode-terminal-mode} | `workflow:terminal-mode` (app çalışıyor olsa bile) |
| `mode:status` = app, ama OpenCode serve/özel yüzey aktif değil | `workflow:terminal-mode` (düz metin, app teknik olarak açık olsa da) |
| `mode:status` = app + whereami = app + değişiklik CSS/AGENTS.md/ghost-agent/mcp-server kapsamında | `workflow:app-mode` (app içinde kal) |
| `mode:status` = app + whereami = app + gerçek app kaynak/mantık değişikliği + OpenCode serve/özel yüzey aktif | `workflow:ghost-agent-mode` (yalnızca bu kombinasyon ghost-agent'ı tetikler) |
| `mode:status` = ghost-agent | `workflow:ghost-agent-mode` (zaten oradasın) |

Notlar:
- Bu dosyaya bakmayı gerektiren bir işte `mode:status` bir kez yeterlidir; yalnız mod/geçiş/restart durumu değişirse tekrar çağrılır.
- `whereami`, `mode:status` için cross-check'tir. İkisi çelişirse işlem durdurulur; geçiş sürüyorsa `mode:wait` ile beklenir.
- Geçiş yalnızca `mode:switch` / `mode:trigger` ile yapılır; Electron click/xdotool gibi UI-seviyesi otomasyonla tetiklenmez.

## Runtime Control Dosyası

- Konum: `data/assistant-runtime.json`
- Alanlar: `workflowSessionId`, `desiredMode` (terminal|soft|ghost-agent), `phase` (idle|preparing-handoff|in-ghost|returning), `updatedAt`

## Wrapper Komutları

| Komut | Ne yapar |
|---|---|
| `npm run mode:status` | wrapper + runtime birleşik durum |
| `npm run mode:switch -- <mod>` | güvenli geçiş başlatır |
| `npm run mode:trigger -- <action>` | buton semantiğiyle geçiş |
| `npm run mode:wait -- <mod>` | geçiş tamamlanana kadar bekler |
| `npm run whereami` | cross-check |

## Buton Eşlemesi

| Action | Anlamı |
|---|---|
| `main-close` | Hayalet-ev kapat → terminal/idle, app kapanır |
| `main-to-ghost` | Asistan → Ghost Agent → ghost-agent/preparing-handoff |
| `ghost-close` | Ghost Agent kapat → terminal/idle |
| `ghost-return-main` | App'e geç → soft/idle, app Asistan başlangıcıyla açılır |

Geçiş intent önce runtime dosyasına yazılır, sonra wrapper kapanış/başlatmayı yönetir. Timeout/hata → intent rollback edilir. Lifecycle event'leri `data/assistant-runtime-events.log`'a yazılır.

## AI Muhatap Tespiti (whoareyou)

Yalnızca `mode:status` = app + `whereami.effectiveMode` = app iken çalışır; komut çalıştırmaz, yalnızca görevi verenin insan mı başka bir AI mı olduğunu belirler.

- AI işareti: relay aktif olduğuna dair mesaj veya karşı taraf kendini AI olarak tanıttıysa → muhatap = AI, final mesaja `++cmd:AsistanAISend` eklenir.
- Diğer tüm durumlarda muhatap = Kullanıcı (varsayılan; ek kontrol gerekmez).

## Rovo Interaction Layer (opsiyonel UI katmanı)

Yalnızca `opencode-ui` yüzeyi aktif ve OpenCode serve çalışırken kullanılabilir; diğer tüm `whereami` sonuçlarında (terminal, ghost-agent, other-provider-cli vb.) düz metin kullanılır.

Tek interaction tipi: `plan-harder-local` — kullanıcı planı derinleştirmek istediğinde yapılandırılmış soru-cevap kartı sunar. Protokol ve payload şeması: `.rovo/interactions/protocol.md`, örnek: `.rovo/interactions/plan-harder-local/`.

Önceki `change-approval` üretim akışı kaldırılmıştır; yeni görevlerde approval interaction üretilmez.

# AGENTS.md

Hayalet-ev üzerinde çalışan AI ajanları için çekirdek kurallar. Bu dosya her session'da yüklenir; bu yüzden yalnızca sürekli gerekli davranışları içerir. Nadiren kullanılan konular `.rovo/` altında ayrı belgelerde tutulur ve yalnız ilgili işe girildiğinde okunur.

## Proje Kimliği

| Anahtar | Değer |
|---|---|
| Proje | Hayalet-ev — Ghost House |
| Stack | Electron + TypeScript (strict) + Vite |
| Database | SQLite, per-account, better-sqlite3, WAL |
| MCP Server | app MCP — `hev_*` prefix |
| Validation | Prettier → jscodeshift/Babel AST |

## Tool Önceliği

Hayalet-ev MCP (`hev_*`) built-in tool'lara tercih edilir: dosya okuma/yazma/silme/taşıma → `hev_fs_*`, satır düzenleme → `hev_dev_edit_lines`, symbol arama → `hev_dev_search_symbol`, shell → `hev_fs_bash`.

MCP erişilemezse built-in fallback kullanılır; kullanıcı onayı beklenmez.

Tool isim/parametrelerini ezberleme; `hev_suggest_tool{ intent }` veya `hev_list_tools` ile runtime'da keşfet. Bilinen görev kalıpları için `.rovo/WORKFLOWS.md` kullanılır.

## Dosya Değişikliği Akışı

```text
1. hev_fs_read                         → oku
2. hev_fs_edit / hev_dev_edit_lines  → değiştir
3. hev_dev_check_syntax              → doğrula
```

Onay beklenmez; değişiklik doğrudan uygulanır. İş bitince değişen dosyalar ve ne değiştiği kısaca özetlenir. Uzun diff, satır dökümü veya ayrıca "kanıt raporu" gerekmez.

Emin olmadığın versiyon-spesifik, bilinmeyen kütüphane veya best-practice konularında tahmin etmek yerine kısa bir web/codebase araştırması yap, sonra uygula.

## Yalnızca Bu İşlemlerde Önceden Bilgilendir

Aşağıdakiler dışında hiçbir işlem beklemez veya onay istemez; kod yazma, dosya düzenleme/silme, refactor, test/build çalıştırma ve npm install doğrudan yapılır:

- `git push --force` veya yayınlanmış geçmişi değiştiren işlemler
- Veritabanı dosyasını (SQLite) silme/sıfırlama
- Gerçek para harcayan bir API/servis çağrısı
- Public fork'a push/publish (personal ve public ayrı tutulduğu sürece)

Bunlarda da onay bekleme yok; işlemden önce tek cümlelik bilgilendirme yeterlidir.

## Mod Farkındalığı — Ne Zaman Gerekir

Sıradan terminal/dosya işlerinde mod kontrolüne gerek yok. `.rovo/MODES.md` yalnız şu durumlarda okunur ve `npm run mode:status` + `npm run whereami` çalıştırılır:

- `src/`, `electron/`, `shared/` gibi uygulama kaynağında restart gerektiren bir değişiklik yapılacaksa
- Mod geçişi (ghost-agent ↔ app ↔ terminal) gerekiyorsa
- Çalışma yüzeyi gerçekten belirsizse veya runtime/yüzey sinyalleri birbiriyle çelişiyorsa

Session'ın ilk mesajı veya uzun ara tek başına mod kontrolü sebebi değildir.

## Memory

Kalıcı karar, tercih ve tekrar kullanılacak teknik bulgular için MCP Shared Memory kullanılır. Session başında canonical policy listesi bir kez açıkça bootstrap edilir:

`hev_memory_bootstrap_policy{ namespace: "policy", files: ["AGENTS.md", ".rovo/MODES.md", ".rovo/WORKFLOWS.md", ".rovo/MEMORY.md", ".rovo/03-ARCHITECTURE.md"] }`

Kalıcı bir şey öğrenildiyse `hev_memory_write` kullanılır. Detay, migration ve format kuralları: `.rovo/MEMORY.md`.

## Karakter

Ton ve iletişim tarzı `.rovo/_metadata/CHARACTER.md` dosyasından okunur; hardcoded persona yoktur.

## Detaylı Dokümantasyon — Yalnızca İlgili İşte Oku

| Dosya | Ne zaman oku |
|---|---|
| `.rovo/MODES.md` | Mod geçişi, ghost-agent, wrapper control plane, AI-muhatap tespiti |
| `.rovo/WORKFLOWS.md` | Yeni oda/özellik ekleme, bilinen tool senaryoları |
| `.rovo/03-ARCHITECTURE.md` | Mimari/dosya-sorumluluk sorusu |
| `.rovo/MEMORY.md` | Memory format/namespace detayları |
| `.rovo/interactions/protocol.md` | `opencode-ui` interaction transportu |

## Comment Convention

Yeni comment'ler English-only. Kodun ne yaptığını değil neden bu şekilde kaldığını anlatır: intent, invariant, safety constraint, fallback rationale, ordering dependency, integration boundary. Banner/separator, numbered-step veya obvious inline comment eklenmez. Prefix gerekiyorsa: `AI:`, `NOTE:`, `WARNING:`; takip edilecekse `TODO:`.

---

**Versiyon:** 5.1 — Çekirdek minimal tutuldu; onay ritüelleri kaldırıldı, mod/workflow/memory ayrıntıları ihtiyaç bazlı belgelere taşındı.

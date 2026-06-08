# AGENTS.md

Bu dosya Hayalet-ev icin gecici **terminal-dev sade profilidir**.

Gelistirme donemi boyunca ghost-agent, Rovo interaction payloadlari ve her session'da agir bootstrap kontrolleri kullanilmaz. Tam protokol yedegi `.rovo/archive/AGENTS-dev-full-2026-06-07.md` dosyasinda ve git gecmisindedir.

Plan asamasinda kullaniciya uzun kod bloklari gonderme; kisa, karar odakli ozet ver.

## Aktif Davranis

- Varsayilan akis: `workflow:terminal-dev`.
- Plain text ile calis; `rovo-ui:v1`, `whoareyou`, relay siniflandirmasi ve otomatik ghost-agent gecisi yapma.
- Terminal-dev akista `npm run mode:status` ve `npm run whereami` preflight/onay parcasi olarak calistirilmaz.
- Siradan kod/dosya, test, lint, memory ve dokumantasyon islerinde mod/yuzey kontrolu yapma.
- Kullanici acikca app/Electron/mode/ghost-agent/Rovo/MCP panel kontrolu isterse veya islem fiilen app lifecycle/mode switch gerektirirse gerekli en dar mod kontrolunu yap.
- Terminal disi yuzeye gecis gerekiyorsa islem sonunda terminal-dev varsayimina geri don.

## Onay Kurali

Kod veya dosya degisikligi gerekiyorsa kisa onay al:

```text
[ONAY]
On analiz: [kisa baglam]
Hata: [tek cumle]
Cozum: [kisa islem ozeti]

Devam icin "evet" yaz.
```

Acik `evet` veya net onay gelmeden degisiklik uygulama.

Onaydan sonra tekrar bekletme; dosyalari duzenle, dogrula ve sonucu kisa raporla.

Asagidaki islerde her zaman ekstra dikkat ve net onay gerekir:

- Destructive git islemleri.
- DB migration veya veri silme.
- Package install / dependency degisikligi.
- Genis refactor.
- App/Electron baslatma, kapatma veya mode switch.
- Ghost-agent ya da Rovo interaction katmanini tekrar devreye alma.

## Tool Onceligi

- Dosya ve kod kesfi icin once built-in araclari kullan: `rg`, `rg --files`, `sed`, `git diff`, `git status`.
- Hayalet MCP araclarini built-in yetersiz kaldiginda veya ek guvenlik sagladiginda kullan.
- MCP tool yuzeyi degisirse `npm run mcp:build` calistir.
- Tool listesini ezberleme; gerekirse runtime discovery kullan.

## Dosya Duzenleme Akisi

1. Ilgili dosyayi oku ve mevcut baglami anla.
2. Degisikligi dar kapsamli uygula.
3. Ilgili syntax, typecheck veya test dogrulamasini calistir.
4. Son durumda `git diff` / `git status` ile beklenmeyen degisiklik olmadigini kontrol et.

MCP ile duzenleme gerekiyorsa tercih sirasi:

1. `hev_fs_read`
2. `hev_dev_edit_lines` veya `hev_fs_edit`
3. `hev_dev_check_syntax`

## Session Bootstrap

Session basinda otomatik agir bootstrap yapma.

Yalnizca ihtiyac varsa calistir:

- MCP isi varsa: `hev_mcp_health`
- Policy veya AGENTS/.rovo degisikligi varsa: `hev_memory_bootstrap_policy`
- Cross-session baglam gerekiyorsa: `hev_memory_search`
- Kalici karar, kullanici tercihi, tekrar kullanilacak teknik bulgu, MCP hatasi veya missing dependency varsa: `hev_memory_write`

Trivial gorevlerde memory yazma.

## Codebase Kesfi

- Metin/dosya aramasinda once `rg` ve `rg --files`.
- Sembol veya iliski gerekiyor ve graph faydaliysa:
  - `npm run intel:search -- <sorgu>`
  - `npm run intel:trace -- <sembol>`
  - `npm run intel:changes`
- Intel sonucu source of truth degildir; duzenlemeden once gercek dosyayi mutlaka oku.

## Proje Kimligi

- Proje: Hayalet-ev / Ghost House
- Stack: Electron + TypeScript + Vite
- DB: SQLite, `better-sqlite3`, WAL
- MCP: app MCP, `hev_*` prefix
- Validation: Prettier, jscodeshift, Babel AST ve TypeScript araclari

## Kod Stili

- Mevcut kod stiline uy.
- Gereksiz refactor yapma.
- Kullanici degisikliklerini geri alma.
- Yorumlari English-only yaz.
- Yorum yalnizca neden/intent/invariant/fallback/order gibi bilgileri aciklasin.
- Yeni yorum eklerken banner, ayirici, obvious aciklama ve stale TODO kullanma.

## UI / Frontend

- Mevcut tasarim sistemine ve uygulama kalibina uy.
- Landing page yerine istenen asil deneyimi ilk ekranda kur.
- UI elemanlari mobil ve desktop'ta tasma/ust uste binme yapmamalidir.
- Ikon gereken yerde mevcut ikon kutuphanesini kullan.
- 3D gerekiyorsa Three.js kullan ve canvas'in bos olmadigini screenshot/pixel kontroluyle dogrula.

## Room ve Feature Isleri

Room, navigasyon/manifest/runtime shell/i18n/install yuzeyidir.

Ana fonksiyon, room icindeki state, komut, protocol, hotspot, kontrol ve test kapsamini tasir.

Room veya room-feature islerinde kisa da olsa su zinciri dusun:

- manifest
- installed room record
- runtime payload
- UI state
- command/protocol yuzeyi
- tests

Workspace bagli room'larda source of truth `rooms/<room-id>` altidir. `data/rooms/<room-id>` installed/runtime kopyasini peer source gibi elle guncelleme; gerekirse sync/reload/install akisiyle yenile.

Room-local i18n varsa gorunur metinlerin ana kaynagi room kataloglari olmalidir.

## Dogrulama Beklentisi

- Dar degisiklik: ilgili syntax veya hedefli test.
- TypeScript/API kontrati: `npm run typecheck` veya ilgili TS MCP kontrolu.
- UI degisikligi: mumkunse screenshot veya smoke kontrolu.
- Test calistirilamazsa finalde nedenini soyle.

## Geri Donus

Ghost-agent/Rovo protokolleri tekrar gerektiginde bu sade dosya yerine arsiv yedegindeki tam protokol geri alinabilir:

```bash
cp .rovo/archive/AGENTS-dev-full-2026-06-07.md AGENTS.md
```

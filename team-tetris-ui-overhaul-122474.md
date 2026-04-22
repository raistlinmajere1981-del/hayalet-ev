# Team Tetris — UI Overhaul + 2 Asamali Hamle Sistemi

Game-room Team Tetris icin UI'i oyun arayuzu olarak yeniden tasarlayan, 2 asamali hamle sistemi ekleyen ve gizli es modunu gorsel olarak destekleyen revizyon plani.

---

## Kararlar (Onaylanan)

| Konu                       | Karar                                                                                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| User slotu                 | Her zaman hazir kabul edilir                                                                                                                |
| Avatar fallback            | Bos avatar alani (placeholder circle, icerik yok)                                                                                           |
| Kirilma satiri secimi      | Hibrit: tahta tiklama + sol panelde satir gostergesi                                                                                        |
| Lobby → in-game gecisi     | Fade + slide (~300ms)                                                                                                                       |
| Hidden-pair display safety | Reveal oncesi takim / seat / role yapisini ifsa eden gorsel isaret kullanilmaz; non-local gizli kartlar sadece generic masked copy kullanir |
| Hidden partner clues       | `boardBeforePartnerPieceRows` + `partnerLastPiece` ipuclari korunur; sadece daha compact ve neutral bir yuzeye tasinir                      |

---

## Sprint 1 — Planner Model + Compiler

**Amac**: 2 asamali draft state ve rowShifts compiler'i, host degistirmeden.

### 1.1 Draft State Genisletme

- **Dosya**: `rooms/game-room/ui/game-room-ui-runtime-contracts.d.ts`
- `GameRoomTeamTetrisDraftState`'e yeni alanlar:
  - `stage: "positioning" | "route"` — aktif asama
  - `stagedOriginX: number` — Stage 1'de secilen entry column
  - `routeMode: "straight" | "bend-left" | "bend-right"` — rota tipi
  - `bendRow: number | null` — kirilma satiri
  - `interactionMode: "positioning" | "route-row-picker" | "preview"` — board click semantigi
- Legacy drag state icin acik migration karari:
  - `dragTargets` / `dragActive` ya Sprint 1 sonunda tamamen kaldirilir
  - veya gecis sureci icin tutulsa bile preview artik bu alanlara bagli kalmaz
- **Dosya**: `rooms/game-room/main-functions/team-tetris/ui/state-shape-runtime.ts`
  - `createTeamTetrisDraft()` yeni alanlari initialize eder
  - `sanitize` fonksiyonlari yeni alanlari normalize eder
  - legacy drag alanlari icin backward-compatible sanitize karari acik yazilir

### 1.2 Canonical Compiler

- **Dosya**: `rooms/game-room/main-functions/team-tetris/ui/draft-runtime.ts`
- Yeni pure helper: `compileStageToRowShifts(stagedOriginX, rotation, pieceId, routeMode, bendRow)` → `number[]`
  - Compiler, mevcut host semantigine birebir uyar:
    - her `rowShifts[i]`, ilgili asamadan once yatay kaymayi ifade eder
    - legality her ara satirda replay edilerek dogrulanir
    - compiler "spawn'a bir kere git, sonra 0 yaz" gibi gevsek shortcut kullanmaz
  - Straight: row-by-row replay ile staged origin'e ulasan canonical shift dizisi + kalan adimlarda `0`
  - Bend-left/right: canonical dizide yalnizca secilen kirilma aninda `-1/+1`, diger satirlarda replay ile uyumlu deger
- Mevcut `replayTeamTetrisDraft` bu compiler ciktisini alip preview uretir
- Host tarafi degismez
- Ayrica parity fixture'lari eklenir:
  - revealed / normal board semantiginde UI compiler preview sonucu == host replay semantigi
  - kisa / uzun `rowShifts` dizileri ayni lock noktasina gidiyorsa UI preview drift etmez
  - hidden-partner clue modunda mevcut "gizli lock ifsa etmeden oynanabilir clue" davranisi korunur; bu modda yeni preview mantigi mevcut davranistan daha kotu hale gelmez

### 1.3 UI Contract + Wiring Genisletme

- **Dosyalar**:
  - `rooms/game-room/main-functions/team-tetris/ui/module.ts`
  - `rooms/game-room/main-functions/team-tetris/ui/state-runtime.ts`
  - `rooms/game-room/main-functions/team-tetris/ui/module-card-runtime.ts`
  - `rooms/game-room/ui/game-room-ui-runtime-contracts.d.ts`
- Yeni handler surface'leri acik tanimlanir:
  - `onTeamTetrisMoveLeft`
  - `onTeamTetrisMoveRight`
  - `onTeamTetrisRotateCw`
  - `onTeamTetrisRotateCcw`
  - `onTeamTetrisConfirmPosition`
  - `onTeamTetrisBackToPosition`
  - `onTeamTetrisRouteModeSelect`
  - `onTeamTetrisBendRowSelect`
- `GameRoomTeamTetrisBoardCardOptions` sadece `interactive?: boolean` ile kalmaz; row-picker / positioning / preview modlarini acik ifade eden alanlar eklenir

### 1.4 Preview + Trace Entegrasyonu

- Compiler ciktisi mevcut replay pipeline'a beslenir
- `preview`, `errorKey` hala tek kaynaktan gelir
- Ancak trace rendering icin yeni explicit helper gerekir:
  - mevcut basit "duz cizgi + en altta tek turn cell" mantigi korunmaz
  - secilebilir `bendRow` icin ayri `pathCells` / `pathTurnCell` uretimi yazilir
- Preview olusumu legacy drag state'e degil `stage + stagedOriginX + routeMode + bendRow` kombinasyonuna baglanir
- Blocked path mantigi aynen korunur

### 1.5 Host Uyumluluk Dogrulamasi

- Mevcut engine regresyonlari yeni compiler ciktilariyla calistirilir
- Host kodu sadece dogrulama gapi cikarsa patch edilir
- Mirrored `us1` local-turn submit akisi yeni 2-stage planner sonrasi da yesil kalir
- Hidden-pair serialization / anonymity davranisi korunur

**Dogrulama**:

- `npm run typecheck`
- mevcut engine testleri yesil
- host regressions icinde mirrored `us1` akisi yesil
- planner parity fixtures yesil

---

## Sprint 2 — Yeni UI Shell + Lobby

**Amac**: Sol panel + 2 tahta layout, lobby fazinda slot kartlari ve avatar gosterimi; aktif mac ekrani hicbir ara sprintte oynanamaz hale gelmez.

### 2.1 Layout Yeniden Yapilandirma

- **Dosya**: `rooms/game-room/main-functions/team-tetris/styles/layout.css`
- `tt-arena`: 3 bolge → `tt-rail` (sol, ~200px) + `tt-boards` (2 tahta grid)
- `tt-support-stack` dogrudan silinmez; icindeki gameplay-control + clue surface yeni shell'e tasinmadan kaldirilmaz
- `tt-context-card--status` tam kaldirilmak yerine compact status bar / control rail'e donusturulur
- `tt-stage-main` sadece board-grid icermez; replacement gameplay controls veya compact clue strip ayni sprintte erisilebilir kalir
- `--tt-cell-size` default buyutulur: `clamp(0.82rem, 1.1vw, 1.4rem)`

### 2.2 Lobby Slot Kartlari (Pre-Game)

- **Dosya**: `rooms/game-room/main-functions/team-tetris/ui/module-card-runtime.ts`
- Yeni: `createTeamTetrisLobbyCard(seatId, slotRecord, ready, hiddenPairs)` → HTMLElement
  - Avatar alani: `<div class="tt-lobby-avatar">` — assigned ise `<img>`, fallback ise bos circle
  - Nickname: local user kartinda gercek isim kalabilir; non-local gizli kartlarda sadece generic masked copy kullanilir
  - Ready badge: yesil dot / gri dot
  - Unassigned: `data-assigned="false"` → opacity:0.4, border yok
- `user` slotu her zaman `ready: true` olarak render edilir
- Hidden mode lobby kartlarinda `Takim A/B`, `Oyuncu 1/2`, seat id veya role bazli label kullanilmaz

### 2.3 Gizli Es Modu Gorsel Mantigi

- **Dosya**: `rooms/game-room/main-functions/team-tetris/ui/state-view-runtime.ts`
- Yeni helper: `getTeamTetrisPlayerDisplay(seatId)` → `{ avatarUrl: string | null, label: string, isAnonymous: boolean }`
  - `hiddenPairs && !revealedPairs` durumunda:
    - `Takim A`, `Takim B`, `Oyuncu 1`, `Oyuncu 2`, seat id, role bazli label yok
    - non-local gizli kartlarda yalnizca generic maskeli copy kullanilir: or. `Gizli Oyuncu`
    - aktif tur vurgusu gizli non-local kart uzerinde gosterilmez; bunun yerine neutral status bar kullanilir
  - Diger durum → `{ avatarUrl: slot.avatar, label: slot.nickname, isAnonymous: false }`
- Anonymous avatar: CSS-only `?` character icinde bos circle
- Safe display model sadece lobby kartlarinda degil su yuzeylerde de tek kaynak olur:
  - turn indicator
  - pair status copy
  - `getTeamTetrisPartnerRoleLabel`
  - `getTeamTetrisTurnLabel`
  - `getTeamTetrisPlacedByLabel`
- Ayrica mevcut hidden-pair visibility contract'lari referans alinarak safe display model task'i ayrica testlenir

### 2.4 Info Sadellestirme

- **Dosya**: `rooms/game-room/main-functions/team-tetris/ui/module-shell-runtime.ts`
- Kaldirilan ogeleri:
  - `tt-panel--intro` hero baslik blogu → kucuk badge'e donusur
  - `tt-context-card--status` path rule, public hint, pair hint metinleri → tek satirlik status mesaji
  - `tt-overview-grid / tt-overview-copy` metin blogu → lobby kartlarina tasindi
  - `tt-support-pair` kaldirilmaz; compact `tt-clue-strip` / collapse panel olarak yeniden kurulur
- Korunan gameplay clue yuzeyi:
  - `boardBeforePartnerPieceRows`
  - `partnerLastPiece`
  - mevcut hidden partner clue mantigi
- Kalan: compact status bar + turn indicator + compact clue strip

### 2.5 Lobby → In-Game Gecis Animasyonu

- **Dosya**: `rooms/game-room/main-functions/team-tetris/styles/layout.css`
- Sadece CSS attribute toggle yeterli sayilmaz; `renderTeamTetris()` her render'da root'u yeniden kurdugu icin:
  - persistent container veya explicit transition-state wrapper eklenir
  - gerekiyorsa bir onceki faz kisa sure tutulup fade-out/fade-in gecisi oyle tamamlanir
- Hedef animasyon:
  - Lobby kartlari: `opacity 300ms ease-out` + `transform: translateX(-8px)` fade-out
  - Game kontrolleri: `opacity 300ms ease-in 100ms` + `transform: translateX(0)` fade-in
  - Tahtalar: `opacity 300ms ease-in` reveal
- Eger render mimarisi bunu pahali hale getirirse fallback: tam crossfade yerine tek seferlik board reveal animasyonu
- Gecis sirasinda aktif mac kontrolleri ve clue strip bir frame bile kaybolup inputsuz state uretmez

### 2.6 Sprint Boundary Safety

- Sprint 2 tek basina merge edilecekse mevcut rotate / clear / submit akislarinin replacement'i ayni sprintte gelir
- `tt-support-stack` veya mevcut kontrol blogu, Stage 1/Stage 2 replacement UI gelmeden silinmez
- Validation icinde "active match halen oynanabilir" smoke testi zorunludur

**Dogrulama**:

- `npm run typecheck`
- aktif mac oynanabilirlik smoke testi
- goruntusel smoke test

---

## Sprint 3 — 2 Asamali Hamle UX

**Amac**: Stage 1 pozisyonlama + Stage 2 rota editoru, hibrit kontroller.

### 3.1 Stage 1 — Pozisyonlama Kontrolleri

- **Dosya**: `rooms/game-room/main-functions/team-tetris/ui/module-shell-runtime.ts`
- Sol panelde:
  - Mini-grid (10 sutun × parca yuksekligi) → secili sutun vurgulanir
  - Sol/Sag butonlari (← →)
  - CW / CCW rotasyon butonlari
  - "Pozisyonu Onayla" butonu → `stage: "route"`'a gecer
- Tahta uzerinde tiklama da `stagedOriginX` gunceller (convenience shortcut)
- Stage 1 preview olusumu drag target cizimine bagli kalmaz; sadece pozisyon state'i ile hesaplanir

### 3.2 Stage 2 — Rota Editoru (Hibrit)

- Sol panelde:
  - 3 rota butonu: Duz Inis / Sola Kir / Saga Kir
  - Kirilma satiri gostergesi: secili satir numarasi badge
  - "Pozisyona Don" butonu → stage reset
- Tahta uzerinde:
  - Kirilma satiri secimi: satira tiklama ile bendRow ayarlanir
  - Canli preview trace yeni explicit bend-row renderer ile guncellenir
- Sol panelde satir gostergesi tahtadaki secimle senkronize
- Hidden-pair clue strip Stage 2'de de ayni yerde erisilebilir kalir; yeni UI bu ipucunu kaybetmez

### 3.3 Board Preview-Only Mode

- Stage 2'de drag devre disi kalir
- Ancak board tamamen pasif olmaz; `interactionMode: "route-row-picker"` ile sadece satir secimi aktif kalir
- Stage 1'de board tiklamasi convenience shortcut olarak `stagedOriginX` guncelleyebilir
- Overlay + trace rendering compiler ciktisiyla beslenir
- Mevcut boolean `interactive` yerine mod-bazli board davranisi kullanilir
- Legacy `dragTargets` / `dragActive` event zinciri bu sprintte ya tamamen kaldirilir ya da no-op transitional hale getirilir; yeni preview pipeline bunlara dayanmaz

### 3.4 Submit + Reset Akisi

- Submit: sadece Stage 2'de gecerli preview varken aktif
- Turn degisiminde planner Stage 1'e sifirlanir
- "Temizle" butonu her iki asamada da planner'i sifirlar
- `command-result` ve yeni host push arasinda stale planner state kalmaz
- Mirrored `us1` local turn submit akisi ayni command shape ile calisir

**Dogrulama**:

- `npm run typecheck`
- hamle compile + preview dogru render
- bendRow secimi ile trace geometry beklenen satirda kirilir
- turn-token reset sonrasi planner Stage 1'e doner
- preview, legacy drag state olmadan da olusur

---

## Sprint 4 — Responsive + Turn Gorsellestirme + Polish

**Amac**: Responsive breakpoints, turn indicator, i18n, regresyonlar.

### 4.1 Responsive Breakpoints

- **Dosya**: `rooms/game-room/main-functions/team-tetris/styles/presentation.css`
- `>1200px`: rail + 2 tahta yan yana (3 kolon)
- `800–1200px`: rail ustte collapse (yatay bar), tahtalar yan yana
- `<800px`: tek kolon, tahtalar ust uste

### 4.2 Turn Indicator

- **Dosya**: `rooms/game-room/main-functions/team-tetris/ui/module-shell-runtime.ts`
- Reveal sonrasi veya local user kartinda: aktif oyuncu kartina glow border + pulse animasyon
- Gizli modda non-local kartlarda:
  - kart bazli glow yok
  - `?` avatar + generic masked label
  - aktif tur bilgisi neutral status / badge uzerinden verilir
- Gizli modda turn indicator hicbir yerde takim / seat / role mapping'i geri sizdirmaz
- Normal modda: gercek avatar + nickname

### 4.3 Gorsel Detaylar

- Font: `.tt-panel__title` → `system-ui` sans-serif, compact
- Glass-morphism azaltilir → daha opak panel backgrounds
- Parca yerlesim animasyonu: kisa `scale(0.95→1) + opacity(0→1)` (~200ms)
- Turn gecisi: indicator pulse animation (~400ms)

### 4.4 i18n Guncelleme

- **Dosyalar**: `rooms/game-room/i18n/en.json`, `rooms/game-room/i18n/tr.json`
- Yeni keyler: stage labels, rota buton labels, lobby kartlari, anonymous seat labels
- Kaldirilan metin keyleri temizlenir

### 4.5 Regresyon + Dogrulama

- Mevcut UI-path testleri yeni akisa uyarlanir
- Engine testleri aynen yesil kalir
- Room package smoke regressions guncellenir
- Yeni zorunlu regressions:
  - hidden-pair kart render'i team/seat ifsa etmez
  - compact clue strip halen `boardBeforePartnerPieceRows` + `partnerLastPiece` ipuclarini gosterir
  - planner reset on turn change
  - explicit bendRow trace geometry
  - mirrored `us1` local-turn submit after 2-stage draft
  - Sprint 2 shell tek basina da aktif maci oynanabilir birakir
- `npm run typecheck` temiz

---

## Etkilenen Dosyalar (Ozet)

| Dosya                                                                   | Degisiklik                                     |
| ----------------------------------------------------------------------- | ---------------------------------------------- |
| `rooms/game-room/ui/game-room-ui-runtime-contracts.d.ts`                | Draft state genisletme                         |
| `rooms/game-room/main-functions/team-tetris/ui/state-shape-runtime.ts`  | Yeni draft alanlari init/sanitize              |
| `rooms/game-room/main-functions/team-tetris/ui/state-runtime.ts`        | Yeni handler surface'leri                      |
| `rooms/game-room/main-functions/team-tetris/ui/draft-runtime.ts`        | 2-stage compiler + stage transitions           |
| `rooms/game-room/main-functions/team-tetris/ui/module.ts`               | UI wiring / contract gecisleri                 |
| `rooms/game-room/main-functions/team-tetris/ui/module-shell-runtime.ts` | Yeni layout, lobby kartlari, hamle kontrolleri |
| `rooms/game-room/main-functions/team-tetris/ui/module-card-runtime.ts`  | Lobby kart factory, avatar rendering           |
| `rooms/game-room/main-functions/team-tetris/ui/state-view-runtime.ts`   | Player display helper, anonymous labels        |
| `rooms/game-room/main-functions/team-tetris/styles/layout.css`          | Yeni grid layout, lobby kartlari, animasyonlar |
| `rooms/game-room/main-functions/team-tetris/styles/board.css`           | Cell size, compact card styles                 |
| `rooms/game-room/main-functions/team-tetris/styles/presentation.css`    | Responsive breakpoints                         |
| `rooms/game-room/i18n/en.json`                                          | Yeni/guncellenen text keyleri                  |
| `rooms/game-room/i18n/tr.json`                                          | Yeni/guncellenen text keyleri                  |
| `scripts/tests/game-room-team-tetris-ui-path-regressions.test.ts`       | Yeni 2-stage UI regressions                    |
| `scripts/tests/game-room-team-tetris-visibility-regressions.test.ts`    | Hidden-mode safety regressions                 |
| `scripts/tests/game-room-team-tetris-host-regressions.test.ts`          | Mirrored `us1` + submit flow                   |
| `scripts/tests/game-room-team-tetris-room-regressions.test.ts`          | Runtime surface / script wiring regressions    |

---

## Riskler

- Hidden-pair modunda kart label / glow / team copy ile istemeden takim/seat ifsasi olabilir → safe display model ayrica testlenir
- Compiler output host replay semantiginden saparsa preview/submit drift olur → parity fixture zorunlu
- Hidden-partner clue model mevcut kontratta kisitli bilgi verir; bu sprint exact hidden-occupancy parity vaadi vermez, mevcut oynanabilir clue davranisini korur
- Stage 1 mini-grid sol panele sigmayabilir dar ekranlarda → responsive'de gizlenir, sadece butonlar kalir
- Genis parcalar (I rotated) duvar kenarinda clamp sorunlari → compiler'da bounds check zorunlu
- Board interactive'den preview-only'ye gecis mevcut drag testlerini kirar → Sprint 4'te rewrite
- Root replaceChildren tabanli render, CSS-only phase transition'i snap'e cevirebilir → persistent wrapper veya staged transition gerekir
- Host tarafi degismez ama compiler hata uretirse move reject edilir → preview'da blocked gosterim yeterli
- Sprint 2 ve Sprint 3 ayri merge edilirse gameplay controls kaybolabilir → replacement controls ayni sprintte gelmeden eski yuzey kaldirilmaz

## Rollback

- Varsayilan yol host/engine'i degistirmemektir; eger zorunlu parity patch'i cikarsa UI'den ayri ve kucuk tutulur
- Rollback: Team Tetris UI + style dosyalari revert edilir
- Engine/host testleri her sprintte yesil kalir
